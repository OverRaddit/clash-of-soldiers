import { Injectable } from '@nestjs/common';
import { randomInt, randomUUID } from 'crypto';
import {
  BombBustersAction, BombBustersClientState, BombBustersState,
  BombPlayer, BombWire, BombWireValue,
} from './entities/bomb-busters-game-state.entity';
import { resolveBombMission } from './bomb-busters/missions';
import { BOMB_BUSTERS_EQUIPMENT } from './bomb-busters/equipment';
import { getBombCampaignDefinition } from './bomb-busters/campaign-definitions';
import {
  afterBombCampaignCut, afterBombCampaignTurn, applyBombMissionCommand, applyBombNumberCompletions, availableInfoTokens, beginCampaignCut,
  bombCampaignView, bombRule, campaignConstraintIds, configureBombCampaign, isBombRed,
  placeBombClue, startCampaignTurn, validateBombCampaignCut, evaluateCampaignChallenges,
} from './bomb-busters/campaign-runtime';
import { afterBombAudioCut, afterBombAudioTurn, applyBombAudioCommand, audioWireVisible, bombAudioAllowsVictory, bombAudioHideCutCounts, bombAudioView, configureBombAudio, tickBombAudio, validateBombAudioAction } from './bomb-busters/campaign-audio';
import { failureHintSuppressed, getConstraintViolation } from './bomb-busters/campaign-constraints';
export { BOMB_BUSTERS_MISSIONS } from './bomb-busters/missions';
export { BOMB_BUSTERS_EQUIPMENT } from './bomb-busters/equipment';

@Injectable()
export class BombBustersLogicService {
  /** Called by the gateway clock as well as before actions, so a quiet room still expires. */
  tick(state: BombBustersState, now = Date.now()): boolean {
    const audioChanged = tickBombAudio(state, this.campaignApi(), now);
    if (state.phase === 'playing' && state.campaign?.deadlineAt && now >= state.campaign.deadlineAt) {
      this.finish(state, 'lost', '미션 제한 시간이 끝났습니다.'); return true;
    }
    if (state.campaign?.flashClues?.some(f => f.expiresAt <= now)) {
      state.campaign.flashClues = state.campaign.flashClues.filter(f => f.expiresAt > now); return true;
    }
    return audioChanged;
  }
  initializeGame(playerIds: string[], playerNames: string[], missionId = 1, requestedCaptainId?: string): BombBustersState {
    if (playerIds.length < 2 || playerIds.length > 5 || new Set(playerIds).size !== playerIds.length) {
      throw new Error('봄버스터즈는 서로 다른 2~5명이 필요합니다.');
    }
    const mission = missionId >= 9 ? getBombCampaignDefinition(missionId, playerIds.length) : resolveBombMission(missionId, playerIds.length);
    const campaignDefinition = missionId >= 9 ? getBombCampaignDefinition(missionId, playerIds.length) : null;
    const wires: BombWire[] = [];
    for (let value = 1; value <= mission.blueMax; value++) {
      for (let copy = 0; copy < 4; copy++) wires.push(this.newWire(value, value));
    }
    const redMarkers = this.shuffle(Array.from({ length: (mission.redCandidateMax ?? 12) - 1 }, (_, i) => i + 1.5)).slice(0, mission.redCandidateCount).sort((a, b) => a - b);
    const yellowMarkers = campaignDefinition?.fixedYellowValues ? [...campaignDefinition.fixedYellowValues] : this.shuffle(Array.from({ length: (mission.yellowCandidateMax ?? 12) - 1 }, (_, i) => i + 1.1)).slice(0, mission.yellowCandidateCount).sort((a, b) => a - b);
    this.shuffle([...redMarkers]).slice(0, mission.redCount).forEach(value => wires.push(this.newWire('red', value)));
    this.shuffle([...yellowMarkers]).slice(0, mission.yellowCount).forEach(value => wires.push(this.newWire('yellow', value)));
    if (requestedCaptainId !== undefined && !playerIds.includes(requestedCaptainId)) throw new Error('캡틴은 참가자 중에서 선택해야 합니다.');
    const captainIndex = requestedCaptainId === undefined ? randomInt(playerIds.length) : playerIds.indexOf(requestedCaptainId);
    const players: BombPlayer[] = playerIds.map((id, i) => ({
      id, name: playerNames[i] || `플레이어 ${i + 1}`,
      racks: Array.from({ length: playerIds.length === 2 || (playerIds.length === 3 && i === captainIndex) ? 2 : 1 }, () => ({ id: randomUUID(), wires: [] })),
      initialHintPlaced: false, detectorUsed: false,
    }));
    const racks = players.flatMap(p => p.racks);
    this.shuffle(wires).forEach((wire, i) => racks[i % racks.length].wires.push(wire));
    racks.forEach(rack => rack.wires.sort((a, b) => a.sortValue - b.sortValue));
    const captainId = players[captainIndex].id;
    const equipmentPool = BOMB_BUSTERS_EQUIPMENT.filter(e => !mission.equipmentExcluded?.includes(e.id)
      && (e.id <= 12 || (e.id === 13 && missionId >= 9 && mission.yellowCount > 0 && !campaignDefinition?.excludedExtraEquipment?.includes('false-bottom')) || (e.id >= 14 && missionId >= 55 && !(e.id === 17 && campaignDefinition?.excludedExtraEquipment?.includes('disintegrator')))));
    const equipmentCount = missionId === 23 ? 7 : players.length;
    const selectedEquipment = campaignDefinition?.equipmentMode === 'radar_only' ? equipmentPool.filter(e => e.id === 8) : this.shuffle(equipmentPool).slice(0, equipmentCount);
    const state: BombBustersState = {
      phase: 'setup', mission: { ...mission }, players, captainId, currentPlayerId: captainId,
      mistakes: 0, maxMistakes: players.length, turnNumber: 1,
      outcome: null, endReason: null, redMarkers, yellowMarkers,
      equipment: mission.equipment ? selectedEquipment.map(e => ({ ...structuredClone(e), used: false, unlocked: false })) : [],
      stabilizerActive: false, superDetectorActive: false, tripleDetectorActive: false, pendingDetector: null,
      xyRayActive: false, preparedEquipment: [], pendingExchange: null, relationMarkers: [], radarResults: [], lastExchange: [],
      log: [`${mission.name} 시작. 캡틴부터 파란 전선 하나에 정보 토큰을 놓으세요.`],
    };
    configureBombCampaign(state, this.campaignApi());
    configureBombAudio(state, this.campaignApi());
    return state;
  }

  /** Validate and resolve against a copy: rejected commands never partly mutate a live deal. */
  applyAction(state: BombBustersState, playerId: string, action: BombBustersAction): { message: string } {
    if (state) this.tick(state);
    if (!state || state.phase === 'finished') throw new Error('이미 종료된 미션입니다.');
    if (!action || typeof action !== 'object' || Array.isArray(action)) throw new Error('올바른 행동을 선택하세요.');
    const next: BombBustersState = JSON.parse(JSON.stringify(state));
    const player = this.player(next, playerId);
    validateBombAudioAction(next, player, action);
    if (next.pendingExchange) {
      if (action.type !== 'exchange_wire') throw new Error('무전기로 교환할 전선을 양쪽에서 선택해야 합니다.');
      this.exchangeWire(next, player, action.wireId);
    } else if (next.pendingDetector) {
      if (action.type !== 'resolve_detector' || next.pendingDetector.targetPlayerId !== playerId) {
        throw new Error('선택된 팀원이 탐지기 결과를 결정해야 합니다.');
      }
      this.resolveDetector(next, action.wireId);
    } else if (action.type === 'mission') {
      const protectedPass = action.operation === 'pass' && next.stabilizerActive
        && !bombRule(next, 'constraints') && !bombRule(next, 'secret_constraint_role')
        && !bombRule(next, 'number_cycle') && !bombRule(next, 'yellow_single_cut');
      if (action.operation === 'audio_laser' || protectedPass) this.consumePreparedEquipment(next, player.id, [9]);
      if (!applyBombAudioCommand(next, player, action, this.campaignApi())) applyBombMissionCommand(next, player, action, this.campaignApi());
    } else if (next.campaign?.pending) {
      throw new Error('먼저 미션의 선택을 마치세요.');
    } else if (action.type === 'equipment' && next.phase === 'playing') {
      this.useEquipment(next, player, action);
    } else {
      if (next.currentPlayerId !== playerId) throw new Error('현재 차례가 아닙니다.');
      if (next.phase === 'setup') {
        if (action.type !== 'hint') throw new Error('먼저 파란 전선에 정보 토큰을 놓으세요.');
        this.initialHint(next, player, action.wireId);
      } else {
        if ((next.superDetectorActive || next.tripleDetectorActive || next.stabilizerActive || next.xyRayActive) && action.type !== 'dual' && action.type !== 'cancel_equipment') throw new Error('준비한 장비로 이중 절단을 진행하세요.');
        switch (action.type) {
          case 'dual': this.dual(next, player, action); break;
          case 'solo': this.solo(next, player, action.value); break;
          case 'reveal_red': this.revealRed(next, player); break;
          case 'cancel_equipment': {
            if (!next.superDetectorActive && !next.tripleDetectorActive && !next.stabilizerActive && !next.xyRayActive) throw new Error('취소할 준비 장비가 없습니다.');
            next.superDetectorActive = false; next.tripleDetectorActive = false;
            next.stabilizerActive = false; next.xyRayActive = false; next.preparedEquipment = [];
            next.log.push(`${player.name}님이 장비 준비를 취소했습니다. 장비는 소모되지 않았습니다.`);
            break;
          }
          default: throw new Error('현재 사용할 수 없는 행동입니다.');
        }
      }
    }
    this.updateEquipment(next);
    if (next.phase === 'playing' && !next.pendingDetector && !next.pendingExchange && !next.campaign?.pending
      && bombAudioAllowsVictory(next) && next.players.every(p => this.wires(p).every(w => w.cut)) && !next.campaign?.nano?.reserve.length) this.finish(next, 'won', '모든 전선을 처리하여 폭탄을 해체했습니다!');
    this.updateFeedback(state, next, action);
    next.log = next.log.slice(-80);
    Object.assign(state, next);
    return { message: state.log[state.log.length - 1] };
  }

  getPlayerView(state: BombBustersState, playerId?: string): BombBustersClientState {
    const { players, pendingDetector, pendingExchange, mission } = state;
    const campaign = state.campaign ? bombCampaignView(state, playerId) : undefined;
    const audio = bombAudioView(state, playerId);
    if (campaign && audio) {
      campaign.audio = audio;
      if (state.phase === 'playing' && audio.pendingActorId) { campaign.pendingActorId = audio.pendingActorId; campaign.controls = [...audio.controls]; }
      else campaign.controls.push(...audio.controls);
    }
    const view: BombBustersClientState = {
      serverNow: Date.now(),
      phase: state.phase,
      mission: {
        id: mission.id, name: mission.name, description: mission.description, blueMax: mission.blueMax,
        redCount: mission.redCount, yellowCount: mission.yellowCount,
        redCandidateCount: mission.redCandidateCount, yellowCandidateCount: mission.yellowCandidateCount,
        redCandidateMax: mission.redCandidateMax, yellowCandidateMax: mission.yellowCandidateMax,
        equipment: mission.equipment, equipmentExcluded: mission.equipmentExcluded ? [...mission.equipmentExcluded] : undefined,
      },
      captainId: state.captainId, currentPlayerId: state.currentPlayerId,
      mistakes: state.mistakes, maxMistakes: state.maxMistakes, turnNumber: state.turnNumber,
      outcome: state.outcome, endReason: state.endReason,
      ...(state.feedback ? { feedback: { id: state.feedback.id, kind: state.feedback.kind } } : {}),
      redMarkers: bombRule(state, 'memory_hints') && !state.campaign.memoryPreview ? [] : [...state.redMarkers],
      yellowMarkers: bombRule(state, 'memory_hints') && !state.campaign.memoryPreview ? [] : [...state.yellowMarkers],
      equipment: state.equipment.map(e => ({ id: e.id, name: e.name, description: e.description,
        used: e.used, unlocked: e.unlocked, ...(e.unlock ? { unlock: { value: e.unlock.value, count: e.unlock.count } } : {}),
      })),
      stabilizerActive: state.stabilizerActive, superDetectorActive: state.superDetectorActive,
      tripleDetectorActive: state.tripleDetectorActive, xyRayActive: state.xyRayActive ?? false,
      preparedEquipment: (state.preparedEquipment ?? []).map(e => ({ equipmentId: e.equipmentId, playerId: e.playerId, personal: e.personal })),
      relationMarkers: (state.relationMarkers ?? []).map(m => ({ id: m.id, playerId: m.playerId, rackId: m.rackId, wireIds: [...m.wireIds] as [string, string], relation: m.relation })),
      radarResults: (state.radarResults ?? []).map(r => ({ value: r.value, racks: r.racks.map(p => ({ playerId: p.playerId, rackId: p.rackId, present: p.present })) })),
      lastExchange: (state.lastExchange ?? []).map(m => ({ wireId: m.wireId, fromPlayerId: m.fromPlayerId, fromRackId: m.fromRackId, fromIndex: m.fromIndex, toPlayerId: m.toPlayerId, toRackId: m.toRackId, toIndex: m.toIndex })),
      log: [...state.log],
      ...(campaign ? { campaign } : {}),
      players: players.map(player => ({
        id: player.id, name: player.name, initialHintPlaced: player.initialHintPlaced, detectorUsed: player.detectorUsed,
        personalEquipmentId: bombRule(state, 'secret_constraint_role') && !state.campaign.secretRevealed && player.id !== playerId ? undefined : player.personalEquipmentId,
        racks: player.racks.map(rack => ({ id: rack.id, wires: rack.wires.map(wire => {
          const audioHidden = audioWireVisible(state, playerId, player) === false;
          const visible = !audioHidden && (wire.cut || state.phase === 'finished' || (players.some(p => p.id === playerId) && (wire.reversed ? player.id !== playerId : player.id === playerId)));
          return { id: wire.id, value: visible ? wire.value : null, sortValue: visible ? wire.sortValue : null, cut: wire.cut, hint: audioHidden ? null : wire.hint,
            ...(wire.clue && !audioHidden ? { clue: { kind: wire.clue.kind, value: wire.clue.value } } : {}),
            ...(wire.reversed ? { reversed: true } : {}), ...(wire.excluded ? { excluded: true } : {}), ...(wire.singleLabel ? { singleLabel: true } : {}),
          };
        }) })),
      })),
      pendingDetector: pendingDetector ? {
        actorId: pendingDetector.actorId, targetPlayerId: pendingDetector.targetPlayerId,
        targetWireIds: [...pendingDetector.targetWireIds], guess: pendingDetector.guess,
        ...(pendingDetector.kind ? { kind: pendingDetector.kind } : {}),
        ...(pendingDetector.guesses ? { guesses: [...pendingDetector.guesses] } : {}),
        ...(playerId === pendingDetector.targetPlayerId ? { eligibleWireIds: [...pendingDetector.eligibleWireIds] } : {}),
      } : null,
      pendingExchange: pendingExchange ? {
        actorId: pendingExchange.actorId, targetPlayerId: pendingExchange.targetPlayerId,
        selectedPlayerIds: Object.keys(pendingExchange.selections),
        ...(playerId && pendingExchange.selections[playerId] ? { ownSelectedWireId: pendingExchange.selections[playerId] } : {}),
      } : null,
      cutCounts: bombAudioHideCutCounts(state) ? {} : this.cutCounts(state),
    };
    return view;
  }

  /** Emit only after an accepted action resolves; snapshots keep the same event identity. */
  private updateFeedback(before: BombBustersState, after: BombBustersState, action: BombBustersAction) {
    if (before.phase !== 'playing' || after.pendingDetector) return;
    const previouslyCut = new Set(before.players.flatMap(p => this.wires(p)).filter(w => w.cut).map(w => w.id));
    const newlyCut = after.players.some(p => this.wires(p).some(w => w.cut && !previouslyCut.has(w.id)));
    const resolvedTurns = (after.campaign?.history ?? []).slice(before.campaign?.history.length ?? 0);
    const failedCut = resolvedTurns.some(turn => ['dual', 'solo', 'special'].includes(turn.kind) && !turn.success);
    const directCut = action.type === 'dual' || action.type === 'resolve_detector'
      || (action.type === 'mission' && action.operation === 'audio_laser');
    const failure = (after.outcome === 'lost' && before.outcome !== 'lost')
      || after.mistakes > before.mistakes || failedCut || (directCut && !newlyCut);
    if (failure || newlyCut) after.feedback = { id: randomUUID(), kind: failure ? 'failure' : 'success' };
  }

  private initialHint(state: BombBustersState, player: BombPlayer, wireId: string) {
    const wire = this.uncutWire(player, wireId);
    if (player.initialHintPlaced || typeof wire.value !== 'number' || wire.reversed || wire.excluded || isBombRed(state, wire)) throw new Error('정보 토큰은 자신의 보이는 일반 파란 전선 하나에만 놓을 수 있습니다.');
    const clue = placeBombClue(state, player, wire, wire.value);
    player.initialHintPlaced = true;
    state.log.push(`${player.name}님이 ${clue?.kind === 'value' ? wire.value : clue?.kind === 'parity' ? '홀짝' : clue?.kind === 'count' ? '개수' : ''} 정보 토큰을 놓았습니다.`);
    if (state.players.every(p => p.initialHintPlaced)) {
      state.phase = 'playing';
      state.currentPlayerId = state.captainId;
      state.log.push('모든 정보 토큰을 놓았습니다. 캡틴부터 전선을 자르세요.');
      startCampaignTurn(state, this.campaignApi());
    } else {
      const index = state.players.findIndex(p => p.id === player.id);
      for (let offset = 1; offset <= state.players.length; offset++) {
        const candidate = state.players[(index + offset) % state.players.length];
        if (!candidate.initialHintPlaced) { state.currentPlayerId = candidate.id; break; }
      }
    }
  }

  private dual(state: BombBustersState, player: BombPlayer, action: Extract<BombBustersAction, { type: 'dual' }>) {
    const ownWire = this.uncutWire(player, action.ownWireId);
    const guess = ownWire.reversed ? action.guess : ownWire.value;
    if (ownWire.reversed && guess !== 'yellow' && (!Number.isInteger(guess) || Number(guess) < 1 || Number(guess) > 12)) throw new Error('역방향 전선의 예상 숫자 또는 노랑을 선언하세요.');
    if (!ownWire.reversed && isBombRed(state, ownWire)) throw new Error('빨간 전선으로 이중 절단할 수 없습니다.');
    if (action.targetPlayerId === player.id) throw new Error('이중 절단은 다른 팀원의 전선을 선택하세요.');
    const target = this.player(state, action.targetPlayerId);
    const superDetector = state.superDetectorActive;
    const tripleDetector = state.tripleDetectorActive;
    const xyRay = state.xyRayActive;
    const detector = action.useDetector === true;
    const usingDetector = detector || superDetector || tripleDetector;
    let alternative: BombWire | undefined;
    const guesses: BombWireValue[] = [ownWire.value];
    if ((superDetector || tripleDetector) && detector) throw new Error('공용 탐지기와 개인 탐지기는 함께 사용할 수 없습니다.');
    if (!xyRay && action.alternativeWireId) throw new Error('두 값을 선언하려면 X/Y 광선을 먼저 사용하세요.');
    if (!Array.isArray(action.targetWireIds) || (tripleDetector ? ![2, 3].includes(action.targetWireIds.length) : action.targetWireIds.length !== (detector ? 2 : 1)) || new Set(action.targetWireIds).size !== action.targetWireIds.length) {
      throw new Error(tripleDetector ? '같은 스탠드의 전선 3개 (2개만 남았다면 2개)를 선택하세요.' : detector ? '서로 다른 전선 두 개를 선택하세요.' : '팀원의 전선 하나를 선택하세요.');
    }
    let targetWires = action.targetWireIds.map(id => this.uncutWire(target, id));
    validateBombCampaignCut(state, player, guess, 'dual', (detector || superDetector || tripleDetector) ? [] : targetWires, ownWire, detector || superDetector || tripleDetector || xyRay || state.stabilizerActive);
    this.consumePreparedEquipment(state, player.id);
    beginCampaignCut(state, player, 'dual', guess);
    if (state.campaign) state.campaign.turn.reversedOwn = !!ownWire.reversed;
    if (ownWire.reversed && ownWire.value !== guess) { this.finish(state, 'lost', '자기 역방향 전선의 값을 잘못 선언하여 폭발했습니다.'); return; }
    if (xyRay) {
      alternative = this.uncutWire(player, action.alternativeWireId);
      if (alternative.reversed || alternative.excluded) throw new Error('X/Y 광선의 두 값은 자신에게 보이는 일반 전선이어야 합니다.');
      if (isBombRed(state, alternative) || alternative.value === ownWire.value) throw new Error('서로 다른 두 값을 선택하세요. 빨강은 선언할 수 없습니다.');
      const targetWire = targetWires[0];
      if (state.campaign) {
        const copy = structuredClone(state); const copiedPlayer = this.player(copy, player.id);
        const copiedTarget = this.player(copy, target.id);
        validateBombCampaignCut(copy, copiedPlayer, alternative.value, 'dual', usingDetector ? [] : [this.uncutWire(copiedTarget, targetWire.id)], this.uncutWire(copiedPlayer, alternative.id), true);
      }
      guesses.push(alternative.value);
      if (!usingDetector) {
        state.pendingDetector = {
          kind: 'xy', actorId: player.id, targetPlayerId: target.id,
          ownWireId: ownWire.id, alternativeWireId: alternative.id,
          targetWireIds: [targetWire.id], guess: ownWire.value, guesses,
          eligibleWireIds: [targetWire.id], success: guesses.includes(targetWire.value),
        };
        state.log.push(`${player.name}님이 ${target.name}님의 전선에 ${guesses.map(value => this.label(value)).join(' 또는 ')}을 선언했습니다.`);
        return;
      }
    }
    if (superDetector) targetWires = target.racks.find(r => r.wires.some(w => w.id === targetWires[0].id)).wires.filter(w => !w.cut);
    if (detector || superDetector || tripleDetector) {
      if (tripleDetector) {
        const rack = target.racks.find(r => r.wires.some(w => w.id === targetWires[0].id));
        if (targetWires.length !== Math.min(3, rack.wires.filter(w => !w.cut && !w.excluded).length) || targetWires.length < 2) throw new Error('트리플 탐지기는 같은 스탠드에서 3개 (2개만 남았으면 2개)를 선택하세요.');
      }
      if (detector && player.personalEquipmentId && player.personalEquipmentId !== 0) throw new Error('선택한 개인 장비는 더블 탐지기가 아닙니다.');
      if (detector && this.personalEquipmentDisabled(state, player.id)) throw new Error('이 미션에서는 현재 개인 장비를 사용할 수 없습니다.');
      if (detector && player.detectorUsed && !bombRule(state, 'unlimited_detector')) throw new Error('개인 더블 탐지기는 미션당 한 번만 사용할 수 있습니다.');
      if (guesses.some(value => typeof value !== 'number')) throw new Error('탐지기와 함께 선언하는 값은 모두 1~12 파란 숫자여야 합니다.');
      if (!target.racks.some(rack => targetWires.every(w => rack.wires.some(r => r.id === w.id)))) {
        throw new Error('탐지기는 같은 스탠드의 전선을 선택해야 합니다.');
      }
      if (!superDetector && targetWires.some(w => w.excluded)) throw new Error('X 전선은 탐지 대상으로 선택할 수 없습니다.');
      targetWires = targetWires.filter(w => !w.excluded).filter(w => {
        const rack = target.racks.find(r => r.wires.includes(w)); const uncut = rack.wires.filter(candidate => !candidate.cut);
        return !campaignConstraintIds(state, player.id).some(id => getConstraintViolation(id, {
          value: ownWire.value, kind: 'dual', usesEquipment: true, ownWireHasClue: !!ownWire.clue || ownWire.hint !== null,
          targetWires: [{ isLeftEdge: uncut[0]?.id === w.id, isRightEdge: uncut[uncut.length - 1]?.id === w.id, hasClue: !!w.clue || w.hint !== null }],
        }));
      });
      if (!targetWires.length) throw new Error('탐지할 일반 전선이 없습니다.');
      if (detector && !bombRule(state, 'unlimited_detector')) player.detectorUsed = true;
      if (targetWires.every(wire => isBombRed(state, wire))) {
        if (state.stabilizerActive) {
          state.log.push('안정기가 빨간 전선의 폭발을 막았습니다. 정보 토큰은 놓지 않습니다.');
          this.endTurn(state);
          return;
        }
        state.log.push(`${player.name}님의 탐지기가 빨간 전선만 선택했습니다.`);
        this.finish(state, 'lost', '빨간 전선을 잘라 폭탄이 폭발했습니다.');
        return;
      }
      const matches = targetWires.filter(wire => guesses.includes(wire.value));
      const eligible = matches.length ? matches : targetWires.filter(wire => !isBombRed(state, wire));
      state.pendingDetector = {
        kind: xyRay ? 'xy' : 'detector',
        ...(xyRay ? { guesses, alternativeWireId: alternative.id } : {}),
        actorId: player.id, targetPlayerId: target.id, ownWireId: ownWire.id,
        targetWireIds: targetWires.map(w => w.id), guess: ownWire.value,
        eligibleWireIds: eligible.map(wire => wire.id), success: matches.length > 0,
      };
      state.log.push(`${player.name}님이 ${target.name}님의 전선에 ${superDetector ? '슈퍼' : tripleDetector ? '트리플' : '더블'} 탐지기 (${guesses.map(value => this.label(value)).join(' 또는 ')})를 사용했습니다.`);
      // Always ask the owner to acknowledge, even for one eligible wire. An automatic
      // result would disclose whether the other selected wire also matched or was red.
      return;
    }
    const targetWire = targetWires[0];
    if (targetWire.value === ownWire.value) {
      ownWire.cut = true;
      targetWire.cut = true;
      state.log.push(`${player.name}님과 ${target.name}님이 ${this.label(ownWire.value)} 전선을 잘랐습니다.`);
    } else if (isBombRed(state, targetWire)) {
      if (state.stabilizerActive) {
        state.log.push('안정기가 빨간 전선의 폭발을 막았습니다. 정보 토큰은 놓지 않습니다.');
        this.endTurn(state);
        return;
      }
      targetWire.cut = true;
      state.log.push(`${player.name}님이 ${target.name}님의 빨간 전선을 잘랐습니다.`);
      this.finish(state, 'lost', '빨간 전선을 잘라 폭탄이 폭발했습니다.');
      return;
    } else {
      if (!failureHintSuppressed([...campaignConstraintIds(state, player.id), ...campaignConstraintIds(state, target.id)])) placeBombClue(state, target, targetWire, guess);
      if (!state.stabilizerActive) state.mistakes++;
      state.log.push(`${player.name}님의 ${this.label(guess)} 추측 실패. 미션 규칙에 따라 정보를 처리했습니다.`);
    }
    this.endTurn(state);
  }

  private resolveDetector(state: BombBustersState, wireId: string) {
    const pending = state.pendingDetector;
    if (!pending || !pending.eligibleWireIds.includes(wireId)) throw new Error('선택할 수 없는 탐지기 결과입니다.');
    const target = this.player(state, pending.targetPlayerId);
    const wire = this.uncutWire(target, wireId);
    if (pending.kind === 'xy' && isBombRed(state, wire)) {
      state.pendingDetector = null;
      if (state.stabilizerActive) {
        state.log.push('안정기가 빨간 전선의 폭발을 막았습니다. 정보 토큰은 놓지 않습니다.');
        this.endTurn(state);
      } else {
        wire.cut = true;
        this.finish(state, 'lost', '빨간 전선을 잘라 폭탄이 폭발했습니다.');
      }
      return;
    }
    if (pending.success) {
      if (state.campaign?.turn) state.campaign.turn.value = wire.value;
      wire.cut = true;
      const actor = this.player(state, pending.actorId);
      const primary = this.uncutWire(actor, pending.ownWireId);
      const own = pending.kind === 'xy' && primary.value !== wire.value
        ? this.uncutWire(actor, pending.alternativeWireId) : primary;
      own.cut = true;
      state.log.push(`${pending.kind === 'xy' ? 'X/Y 광선' : '탐지기'} 성공! ${this.label(wire.value)} 전선 한 쌍을 잘랐습니다.`);
    } else {
      if (!failureHintSuppressed([...campaignConstraintIds(state, pending.actorId), ...campaignConstraintIds(state, target.id)])) placeBombClue(state, target, wire, pending.guess);
      if (!state.stabilizerActive) state.mistakes++;
      state.log.push(`탐지기 실패. ${target.name}님의 미션 정보 규칙을 적용했습니다.`);
    }
    state.pendingDetector = null;
    this.endTurn(state);
  }

  private solo(state: BombBustersState, player: BombPlayer, value: BombWireValue) {
    // Reject before inspecting a guessed value, so errors cannot reveal a hidden own wire.
    if (this.wires(player).some(w => !w.cut && w.reversed)) throw new Error('역방향 전선이 있으면 미션의 단독 절단에서 전선을 직접 선택하세요.');
    if (value !== 'yellow' && (!Number.isInteger(value) || Number(value) < 1 || Number(value) > state.mission.blueMax)) {
      throw new Error('파란 전선의 숫자 또는 노란색을 선택하세요.');
    }
    const all = state.players.flatMap(p => this.wires(p)).filter(w => !w.cut && w.value === value);
    const own = this.wires(player).filter(w => !w.cut && w.value === value);
    validateBombCampaignCut(state, player, value, 'solo', [], own[0]);
    if ((own.length !== 2 && own.length !== 4) || all.length !== own.length) {
      throw new Error('그 값의 남은 전선 전부 (2개 또는 4개)를 가지고 있어야 단독 절단할 수 있습니다.');
    }
    own.forEach(wire => { wire.cut = true; });
    beginCampaignCut(state, player, 'solo', value);
    if (state.campaign) state.campaign.turn.uncutIds.push(...own.map(w => w.id));
    state.log.push(`${player.name}님이 ${this.label(value)} 전선 ${own.length}개를 단독 절단했습니다.`);
    this.endTurn(state);
  }

  private revealRed(state: BombBustersState, player: BombPlayer) {
    const remaining = this.wires(player).filter(w => !w.cut);
    if (bombRule(state, 'triple_red_cut')) throw new Error('이 미션의 빨강은 세 개 동시 절단 행동으로 처리하세요.');
    if (!remaining.length || remaining.some(w => !w.reversed && !isBombRed(state, w))) throw new Error('손에 빨간 전선만 남았을 때 공개할 수 있습니다.');
    if (remaining.some(w => w.reversed && !isBombRed(state, w))) { this.finish(state, 'lost', '역방향 전선을 빨강이라고 잘못 공개하여 폭발했습니다.'); return; }
    beginCampaignCut(state, player, 'reveal_red', 'red');
    remaining.forEach(w => { w.cut = true; });
    state.log.push(`${player.name}님이 남은 빨간 전선을 안전하게 공개했습니다.`);
    this.endTurn(state);
  }

  private useEquipment(state: BombBustersState, player: BombPlayer, action: Extract<BombBustersAction, { type: 'equipment' }>) {
    const personal = action.personal === true;
    if (personal && this.personalEquipmentDisabled(state, player.id)) throw new Error('이 미션에서는 현재 개인 장비를 사용할 수 없습니다.');
    if (personal && (player.personalEquipmentId !== action.equipmentId || ![2, 3, 8, 10].includes(action.equipmentId) || player.detectorUsed)) throw new Error('현재 사용할 수 없는 개인 장비입니다.');
    const equipment = personal ? { ...BOMB_BUSTERS_EQUIPMENT.find(e => e.id === action.equipmentId), unlocked: true, used: false } : state.equipment.find(e => e.id === action.equipmentId);
    if (!equipment || !equipment.unlocked || equipment.used) throw new Error('해당 장비를 아직 사용할 수 없습니다.');
    if (campaignConstraintIds(state, player.id).includes('G')) throw new Error('현재 제약으로 장비를 사용할 수 없습니다.');
    if (campaignConstraintIds(state, player.id).includes('H') && equipment.id === 4) throw new Error('현재 제약으로 포스트잇을 사용할 수 없습니다.');
    const captainRule = bombRule(state, 'captain_failure_explodes');
    if (player.id === state.captainId && ((captainRule?.forbidSharedEquipment && !personal) || (captainRule?.forbidPersonalEquipment && personal) || (captainRule?.forbidStabilizer && equipment.id === 9))) throw new Error('대장은 이 장비를 사용할 수 없습니다.');
    if (!personal && player.id === state.captainId && bombRule(state, 'false_hints')?.sharedEquipmentForbidden) throw new Error('대장은 공용 장비를 직접 사용할 수 없습니다.');
    const wireIds = action.wireIds;
    if ([1, 4, 12, 14].includes(equipment.id) && wireIds?.some(id => this.wires(player).some(w => w.id === id && (w.reversed || w.excluded)))) throw new Error('역방향·X 전선에는 이 장비를 사용할 수 없습니다.');
    switch (equipment.id) {
      case 1:
      case 12: {
        if (!Array.isArray(wireIds) || wireIds.length !== 2 || wireIds[0] === wireIds[1]) throw new Error('자신의 인접한 전선 두 개를 선택하세요.');
        const rack = player.racks.find(r => wireIds.every(id => r.wires.some(w => w.id === id)));
        if (!rack) throw new Error('같은 받침대의 자기 전선만 선택할 수 있습니다.');
        const indices = wireIds.map(id => rack.wires.findIndex(w => w.id === id)).sort((a, b) => a - b);
        if (indices[1] - indices[0] !== 1) throw new Error('바로 옆에 있는 전선을 선택하세요.');
        const first = rack.wires[indices[0]];
        const second = rack.wires[indices[1]];
        if (first.cut && second.cut) throw new Error('최소 하나는 미절단 전선이어야 합니다.');
        if ((first.value === second.value) !== (equipment.id === 12)) throw new Error(equipment.id === 12 ? '같은 값의 전선을 선택하세요.' : '서로 다른 값의 전선을 선택하세요.');
        state.relationMarkers.push({ id: randomUUID(), playerId: player.id, rackId: rack.id, wireIds: [first.id, second.id], relation: equipment.id === 12 ? 'equal' : 'different' });
        break;
      }
      case 2: {
        const target = this.player(state, action.targetPlayerId);
        if (target.id === player.id || !this.wires(player).some(w => !w.cut) || !this.wires(target).some(w => !w.cut)) throw new Error('미절단 전선이 있는 다른 팀원을 선택하세요.');
        state.pendingExchange = { actorId: player.id, targetPlayerId: target.id, selections: {} };
        break;
      }
      case 4: {
        if (!Array.isArray(wireIds) || wireIds.length !== 1) throw new Error('내 파란 전선 하나를 선택하세요.');
        const wire = bombRule(state, 'multiplicity_hints') ? this.wires(player).find(w => w.id === wireIds[0]) : this.uncutWire(player, wireIds[0]);
        if (!wire) throw new Error('자신의 파란 전선을 선택하세요.');
        if (typeof wire.value !== 'number' || isBombRed(state, wire) || wire.hint !== null) throw new Error('아직 정보 토큰이 없는 파란 전선을 선택하세요.');
        const falseHints = bombRule(state, 'false_hints');
        if (falseHints && (falseHints.players === 'all' || player.id === state.captainId)) {
          if (typeof action.value !== 'number' || action.value < 1 || action.value > 12 || action.value === wire.value) throw new Error('실제 값과 다른 1~12 정보 토큰을 선택하세요.');
          placeBombClue(state, player, wire, action.value);
        } else placeBombClue(state, player, wire, wire.value);
        break;
      }
      case 7: {
        const ids = action.targetPlayerIds || (action.targetPlayerId ? [action.targetPlayerId] : []);
        if (!Array.isArray(ids) || ids.length < 1 || ids.length > 2 || new Set(ids).size !== ids.length) throw new Error('충전할 팀원 1~2명을 선택하세요.');
        const targets = ids.map(id => this.player(state, id));
        if (targets.some(p => this.personalEquipmentDisabled(state, p.id))) throw new Error('사용이 금지된 개인 장비는 충전할 수 없습니다.');
        if (targets.some(p => !p.detectorUsed)) throw new Error('이미 사용한 더블 탐지기만 충전할 수 있습니다.');
        targets.forEach(p => { p.detectorUsed = false; });
        break;
      }
      case 6: {
        // Player-count setup starts at different dial spaces, not at its safest space.
        // Negative mistakes therefore represent extra time gained before any error.
        const safestPosition = state.maxMistakes - 5;
        if (state.mistakes <= safestPosition) throw new Error('기폭기가 가장 안전한 위치여서 더 되돌릴 수 없습니다.');
        state.mistakes = Math.max(safestPosition, state.mistakes - 1);
        break;
      }
      case 8: {
        if (!Number.isInteger(action.value) || Number(action.value) < 1 || Number(action.value) > 12) throw new Error('레이더로 확인할 1~12 숫자를 선택하세요.');
        const value = Number(action.value);
        state.radarResults.push({ value, racks: state.players.flatMap(p => p.racks.map(r => ({
          playerId: p.id, rackId: r.id, present: r.wires.some(w => !w.cut && !w.excluded && !isBombRed(state, w) && w.value === value),
        }))) });
        break;
      }
      case 11: {
        if (state.currentPlayerId !== player.id) throw new Error('커피잔은 자기 차례에만 사용할 수 있습니다.');
        if (state.superDetectorActive || state.tripleDetectorActive || state.stabilizerActive || state.xyRayActive) throw new Error('준비한 장비로 협력 절단을 먼저 진행하세요.');
        const target = this.player(state, action.targetPlayerId);
        if (!this.wires(target).some(w => !w.cut)) throw new Error('아직 전선이 남은 팀원을 선택하세요.');
        beginCampaignCut(state, player, 'equipment', null);
        afterBombCampaignCut(state, this.campaignApi());
        if (state.phase === 'finished') break;
        state.currentPlayerId = target.id;
        state.turnNumber++;
        afterBombCampaignTurn(state, player.id, this.campaignApi());
        afterBombAudioTurn(state, player.id, this.campaignApi());
        state.log.push(`${player.name}님이 차례를 건너뛰고 ${target.name}님을 다음 플레이어로 지명했습니다.`);
        break;
      }
      case 14: {
        if (!Array.isArray(wireIds) || wireIds.length !== 1) throw new Error('단일 전선 표식을 놓을 전선을 선택하세요.');
        const wire = this.uncutWire(player, wireIds[0]);
        const rack = player.racks.find(r => r.wires.includes(wire));
        if (typeof wire.value !== 'number' || rack.wires.filter(w => w.value === wire.value).length !== 1) throw new Error('그 받침대에 정확히 하나만 있는 파란 숫자를 선택하세요.');
        wire.singleLabel = true; break;
      }
      case 16: {
        if (state.currentPlayerId !== player.id) throw new Error('패스트패스는 자기 차례에만 사용할 수 있습니다.');
        const candidates = this.wires(player).filter(w => !w.cut && !w.reversed && !w.excluded && w.value === action.value);
        const chosen = wireIds ? candidates.filter(w => wireIds.includes(w.id)) : candidates.slice(0, 2);
        if (chosen.length !== 2 || action.value === 'red') throw new Error('같은 값의 자기 전선 두 개를 선택하세요.');
        validateBombCampaignCut(state, player, action.value, 'solo', [], chosen[0], true);
        beginCampaignCut(state, player, 'solo', action.value);
        chosen.forEach(w => { w.cut = true; });
        this.endTurn(state); break;
      }
      case 18: {
        const target = this.player(state, action.targetPlayerId);
        if (target.id === player.id || !Array.isArray(wireIds) || wireIds.length !== 1) throw new Error('동료의 전선 하나를 선택하세요.');
        const wire = this.uncutWire(target, wireIds[0]);
        if (wire.reversed || wire.excluded) throw new Error('역방향·X 전선에는 갈고리를 사용할 수 없습니다.');
        const source = target.racks.find(r => r.wires.includes(wire));
        const destination = player.racks.find(r => r.id === action.rackId) ?? (player.racks.length === 1 ? player.racks[0] : null);
        if (!destination) throw new Error('받아 넣을 받침대를 선택하세요.');
        const fromIndex = source.wires.indexOf(wire); source.wires.splice(fromIndex, 1);
        destination.wires.push(wire); destination.wires.sort((a, b) => a.sortValue - b.sortValue);
        state.lastExchange = [{ wireId: wire.id, fromPlayerId: target.id, fromRackId: source.id, fromIndex, toPlayerId: player.id, toRackId: destination.id, toIndex: destination.wires.indexOf(wire) }];
        break;
      }
      case 3:
      case 5:
      case 10:
      case 9: {
        if (state.currentPlayerId !== player.id) throw new Error('이 장비는 자기 차례에만 사용할 수 있습니다.');
        const ownWires = this.wires(player).filter(w => !w.cut && !w.reversed && !w.excluded);
        const hasOwnWire = equipment.id === 10
          ? new Set(ownWires.filter(w => w.value !== 'red').map(w => w.value)).size >= 2
          : ownWires.some(w => equipment.id === 9 ? w.value !== 'red' : typeof w.value === 'number');
        const hasTarget = state.players.filter(p => p.id !== player.id).some(p => p.racks.some(r => r.wires.filter(w => !w.cut && !w.excluded).length >= (equipment.id === 3 ? 2 : 1)));
        const canStabilizeLaser = equipment.id === 9 && bombAudioView(state, player.id)?.controls.some(control => control.id === 'audio_laser');
        if (!canStabilizeLaser && (!hasOwnWire || !hasTarget)) throw new Error('현재 이 장비로 이중 절단을 진행할 수 없습니다.');
        if ([3, 5].includes(equipment.id) && (state.superDetectorActive || state.tripleDetectorActive)) throw new Error('다른 탐지기를 이미 준비했습니다.');
        if ((equipment.id === 10 && state.xyRayActive) || (equipment.id === 9 && state.stabilizerActive)) throw new Error('이미 준비한 장비입니다.');
        if ((equipment.id === 10 && (state.superDetectorActive || state.tripleDetectorActive)) || ([3, 5].includes(equipment.id) && state.xyRayActive)) {
          if (new Set(ownWires.filter(w => typeof w.value === 'number' && !isBombRed(state, w)).map(w => w.value)).size < 2) throw new Error('X/Y와 탐지기를 함께 쓰려면 서로 다른 파란 숫자 두 개가 필요합니다.');
        }
        if (equipment.id === 3) state.tripleDetectorActive = true;
        else if (equipment.id === 5) state.superDetectorActive = true;
        else if (equipment.id === 10) state.xyRayActive = true;
        else state.stabilizerActive = true;
        (state.preparedEquipment ??= []).push({ equipmentId: equipment.id as 3 | 5 | 9 | 10, playerId: player.id, personal });
        state.log.push(`${player.name}님이 ${personal ? '개인' : '공용'} 장비 ${equipment.name}을 준비했습니다.`);
        return;
      }
      default: throw new Error('지원하지 않는 장비입니다.');
    }
    equipment.used = true;
    if (personal) player.detectorUsed = true;
    state.log.push(`${player.name}님이 ${personal ? '개인' : '공용'} 장비 ${equipment.name}을 사용했습니다.`);
  }

  /** Mutates only the action copy: rejected declarations leave every prepared source unspent. */
  private consumePreparedEquipment(state: BombBustersState, playerId: string, equipmentIds?: number[]) {
    const prepared = state.preparedEquipment ?? [];
    const consumed = prepared.filter(entry => !equipmentIds || equipmentIds.includes(entry.equipmentId));
    for (const entry of consumed) {
      if (entry.playerId !== playerId) throw new Error('장비를 준비한 플레이어가 절단해야 합니다.');
      if (entry.personal) {
        const owner = this.player(state, entry.playerId);
        if (owner.detectorUsed || owner.personalEquipmentId !== entry.equipmentId || this.personalEquipmentDisabled(state, owner.id)) throw new Error('준비한 개인 장비를 사용할 수 없습니다. 준비를 취소하세요.');
        owner.detectorUsed = true;
      } else {
        const card = state.equipment.find(e => e.id === entry.equipmentId);
        if (!card || !card.unlocked || card.used) throw new Error('준비한 공용 장비를 사용할 수 없습니다. 준비를 취소하세요.');
        card.used = true;
      }
    }
    state.preparedEquipment = prepared.filter(entry => !consumed.includes(entry));
  }

  private exchangeWire(state: BombBustersState, player: BombPlayer, wireId: string) {
    const pending = state.pendingExchange;
    if (!pending || ![pending.actorId, pending.targetPlayerId].includes(player.id)) throw new Error('무전기 교환 당사자만 전선을 선택할 수 있습니다.');
    if (pending.selections[player.id]) throw new Error('이미 교환할 전선을 선택했습니다.');
    const selectedWire = this.uncutWire(player, wireId);
    if (selectedWire.reversed || selectedWire.excluded) throw new Error('역방향·X 전선은 무전기로 교환할 수 없습니다.');
    pending.selections[player.id] = wireId;
    if (Object.keys(pending.selections).length < 2) {
      state.log.push(`${player.name}님이 교환할 전선을 비공개로 선택했습니다.`);
      return;
    }
    const participants = [pending.actorId, pending.targetPlayerId].map(id => this.player(state, id));
    const selected = participants.map(p => {
      const wire = this.uncutWire(p, pending.selections[p.id]);
      const rack = p.racks.find(r => r.wires.includes(wire));
      return { player: p, wire, rack, index: rack.wires.indexOf(wire) };
    });
    selected.forEach(({ rack, index }) => {
      rack.wires.splice(index, 1);
    });
    if (bombRule(state, 'multiplicity_hints')) selected.forEach(({ wire }) => { wire.hint = null; delete wire.clue; });
    // The ordinary Info token follows its wire (official FAQ). Missions 24/40 override this.
    selected.forEach(({ wire }, index) => {
      const destination = selected[1 - index].rack;
      destination.wires.push(wire);
      destination.wires.sort((a, b) => a.sortValue - b.sortValue);
    });
    state.lastExchange = selected.map((source, index) => {
      const destination = selected[1 - index];
      return {
        wireId: source.wire.id, fromPlayerId: source.player.id, fromRackId: source.rack.id, fromIndex: source.index,
        toPlayerId: destination.player.id, toRackId: destination.rack.id, toIndex: destination.rack.wires.indexOf(source.wire),
      };
    });
    // Labels stay meaningful only while their two wires remain adjacent in the original stand.
    state.relationMarkers = state.relationMarkers.filter(marker => {
      const rack = state.players.flatMap(p => p.racks).find(r => r.id === marker.rackId);
      const indices = marker.wireIds.map(id => rack?.wires.findIndex(w => w.id === id) ?? -1);
      return indices.every(i => i >= 0) && Math.abs(indices[0] - indices[1]) === 1;
    });
    state.pendingExchange = null;
    state.log.push(`${participants[0].name}님과 ${participants[1].name}님이 전선을 교환했습니다. 이동 전후 위치만 공개됩니다.`);
  }

  private endTurn(state: BombBustersState) {
    if (state.campaign && afterBombCampaignCut(state, this.campaignApi())) return;
    if (afterBombAudioCut(state, this.campaignApi())) return;
    if (state.phase === 'finished') return;
    state.stabilizerActive = false;
    state.superDetectorActive = false;
    state.tripleDetectorActive = false;
    state.xyRayActive = false;
    state.preparedEquipment = [];
    if (state.mistakes >= state.maxMistakes && !bombRule(state, 'nano_race')) {
      this.finish(state, 'lost', '기폭 다이얼이 끝에 도달했습니다.');
      return;
    }
    if (bombAudioAllowsVictory(state) && state.players.every(p => this.wires(p).every(w => w.cut)) && !state.campaign?.nano?.reserve.length) {
      this.finish(state, 'won', '모든 전선을 처리하여 폭탄을 해체했습니다!');
      return;
    }
    const previousPlayerId = state.campaign?.directorId || state.currentPlayerId;
    const index = state.players.findIndex(p => p.id === previousPlayerId);
    for (let offset = 1; offset <= state.players.length; offset++) {
      const next = state.players[(index + offset) % state.players.length];
      if (this.wires(next).some(w => !w.cut)) {
        state.currentPlayerId = next.id;
        state.turnNumber++;
        break;
      }
    }
    afterBombCampaignTurn(state, previousPlayerId, this.campaignApi());
    afterBombAudioTurn(state, previousPlayerId, this.campaignApi());
  }

  private finish(state: BombBustersState, outcome: 'won' | 'lost', reason: string) {
    state.phase = 'finished'; state.outcome = outcome; state.endReason = reason;
    state.preparedEquipment = [];
    state.pendingDetector = null;
    state.pendingExchange = null;
    if (state.campaign) { state.campaign.pending = null; state.campaign.pendingAfterTurn = false; }
    state.log.push(reason);
  }

  private cutCounts(state: BombBustersState): Record<string, number> {
    const counts: Record<string, number> = {};
    for (let n = 1; n <= state.mission.blueMax; n++) counts[n] = 0;
    counts.yellow = 0; counts.red = 0;
    state.players.flatMap(p => this.wires(p)).forEach(w => { if (w.cut) { const value = isBombRed(state, w) ? 'red' : w.value; counts[value] = (counts[value] || 0) + 1; } });
    return counts;
  }

  private updateEquipment(state: BombBustersState) {
    let changed = true;
    let passes = 0;
    while (changed && passes++ < 20) {
      changed = false;
      const counts = this.cutCounts(state);
      state.equipment.forEach(equipment => {
      const alreadyUnlocked = equipment.unlocked;
      const condition = equipment.unlock ?? { value: equipment.id, count: 2 };
      equipment.unlocked = (counts[condition.value] || 0) >= condition.count;
      if (bombRule(state, 'equipment_extra_number_lock')) {
        const index = state.equipment.indexOf(equipment); const extra = state.campaign.numbers[index];
        equipment.unlocked = equipment.unlocked && (counts[extra] || 0) >= 2;
      }
      // A card remains unlocked even if the circus later restores its cut wires.
      equipment.unlocked = alreadyUnlocked || equipment.unlocked;
      if (!equipment.unlocked || equipment.used || ![13, 15, 17].includes(equipment.id)) return;
      equipment.used = true; changed = true;
      if (equipment.id === 13) {
        const available = BOMB_BUSTERS_EQUIPMENT.filter(e => !state.equipment.some(existing => existing.id === e.id)
          && !state.mission.equipmentExcluded?.includes(e.id) && (e.id <= 12 || (e.id >= 14 && state.mission.id >= 55 && !(e.id === 17 && state.mission.id === 57))));
        this.shuffle(available).slice(0, 2).forEach(e => state.equipment.push({ ...structuredClone(e), unlocked: false, used: false }));
        state.log.push('이중 바닥이 장비 두 장을 추가했습니다.');
      } else if (equipment.id === 15) {
        state.equipment.forEach(e => { if (e.id !== 15) e.used = false; });
        state.log.push('긴급 보급으로 사용한 공용 장비를 다시 사용할 수 있습니다.');
      } else {
        const values = availableInfoTokens(state, false).filter((value): value is number => typeof value === 'number');
        const value = this.shuffle(values)[0];
        if (value !== undefined) {
          const previouslyComplete = this.cutCounts(state)[value] === 4;
          state.players.flatMap(p => this.wires(p)).filter(w => !w.cut && !w.excluded && !w.reversed && w.value === value).forEach(w => { w.cut = true; });
          if (!previouslyComplete && this.cutCounts(state)[value] === 4) applyBombNumberCompletions(state, [value]);
          const history = state.campaign?.history;
          if (history?.length && this.cutCounts(state)[value] === 4 && !history.flatMap(e => e.completedNumbers).includes(value)) history[history.length - 1].completedNumbers.push(value);
          state.log.push(`분해기가 ${value} 전선을 처리했습니다.`);
        }
      }
      });
    }
    evaluateCampaignChallenges(state);
    if (state.campaign?.pending?.operation === 'pass_number' && !state.campaign.playerNumbers[state.campaign.pending.actorId]?.length) {
      state.campaign.pending = null; state.campaign.pendingAfterTurn = false; this.endTurn(state);
    }
  }

  private campaignApi() {
    return {
      shuffle: <T>(items: T[]) => this.shuffle(items),
      finish: (state: BombBustersState, outcome: 'won' | 'lost', reason: string) => this.finish(state, outcome, reason),
      endTurn: (state: BombBustersState) => this.endTurn(state),
      applyCut: (state: BombBustersState, player: BombPlayer, action: BombBustersAction) => {
        if (action.type === 'dual') this.dual(state, player, action);
        else if (action.type === 'solo') this.solo(state, player, action.value);
        else if (action.type === 'reveal_red') this.revealRed(state, player);
        else throw new Error('지원하지 않는 절단 행동입니다.');
      },
      updateEquipment: (state: BombBustersState) => this.updateEquipment(state),
    };
  }

  private personalEquipmentDisabled(state: BombBustersState, playerId: string): boolean {
    const disable = bombRule(state, 'disable_personal_equipment');
    return !!((disable && (disable.players === 'all' || state.captainId === playerId))
      || (bombRule(state, 'captain_failure_explodes')?.forbidPersonalEquipment && state.captainId === playerId)
      || (bombRule(state, 'secret_constraint_role') && (!state.campaign.secretRevealed || state.campaign.personalDisabledForever)));
  }

  private player(state: BombBustersState, id: string): BombPlayer {
    const player = state.players.find(p => p.id === id);
    if (!player) throw new Error('게임에 참여한 플레이어가 아닙니다.');
    return player;
  }
  private wires(player: BombPlayer): BombWire[] { return player.racks.flatMap(r => r.wires); }
  private uncutWire(player: BombPlayer, id: string): BombWire {
    const wire = this.wires(player).find(w => w.id === id);
    if (!wire || wire.cut) throw new Error('남아 있는 전선을 선택하세요.');
    return wire;
  }
  private label(value: BombWireValue): string { return value === 'yellow' ? '노란색' : value === 'red' ? '빨간색' : String(value); }
  private newWire(value: BombWireValue, sortValue: number): BombWire { return { id: randomUUID(), value, sortValue, cut: false, hint: null }; }
  private shuffle<T>(items: T[]): T[] {
    for (let i = items.length - 1; i > 0; i--) {
      const j = randomInt(i + 1);
      [items[i], items[j]] = [items[j], items[i]];
    }
    return items;
  }
}
