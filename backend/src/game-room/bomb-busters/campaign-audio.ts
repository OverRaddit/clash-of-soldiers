import { randomUUID } from 'crypto';
import type { BombBustersAction, BombBustersState, BombPlayer, BombWire, BombWireValue } from '../entities/bomb-busters-game-state.entity';
import type { BombCampaignApi } from './campaign-runtime';
import type { BombMissionCommand, BombMissionControl } from './campaign-state';
import type { BombAudioState, BombAudioView } from './audio-state';
import { BOMB_AUDIO_SOURCE_URLS, BOMB_AUDIO_STEPS } from './audio-definitions';
import { allowedBunkerMoves, BOMB_BUNKER_MAP, BombBunkerConstraint, BombBunkerDirection, BombBunkerStage, bunkerAtStageAction, bunkerConstraintAllows, bunkerStageComplete, createBombBunker, moveBombBunker, performBunkerAction } from './campaign-bunker';
import { beginCircusEvent, applyCircusCommand, circusControls, afterCircusCut } from './audio-circus';
import { recordBombFailureClue } from './turn-result';

type Host = BombBustersState & { audio?: BombAudioState };
const wires = (p: BombPlayer) => p.racks.flatMap(r => r.wires);
const all = (s: Host) => s.players.flatMap(wires);
const remaining = (p: BombPlayer) => wires(p).filter(w => !w.cut);
const current = (s: Host) => s.players.find(p => p.id === s.currentPlayerId)!;
const step = (s: Host) => BOMB_AUDIO_STEPS[s.audio.missionId][s.audio.stepIndex];
const countCut = (s: Host, n: BombWireValue) => all(s).filter(w => w.cut && w.value === n).length;
const setAck = (s: Host) => { s.audio.pending = { kind: 'ack', actorId: s.captainId }; };
const note = (s: Host, message: string) => { s.audio.notices.push(message); s.log.push(message); };
const danger = (s: Host, api: BombCampaignApi) => {
  if (s.mistakes >= s.maxMistakes) { api.finish(s, 'lost', '기폭 다이얼이 끝에 도달했습니다.'); return true; }
  return false;
};

/** The original recordings provide instructions; only active working windows use server time. */
export function configureBombAudio(state: Host, api: BombCampaignApi): void {
  if (!BOMB_AUDIO_STEPS[state.mission.id]) return;
  state.audio = {
    missionId: state.mission.id, stepIndex: 0, status: 'ready', deadlineAt: null, pending: null,
    numberDeck: api.shuffle(Array.from({ length: 12 }, (_, i) => i + 1)), targets: [], reserveRed: [],
    mutedIds: [], taDaRequired: false, lastCutActorId: null, lastCutAnnounced: true,
    validationTokensRemoved: false, processedTurn: -1, repeatPlayerId: null, notices: [],
  };
  if (state.mission.id === 54) {
    state.audio.reserveRed = api.shuffle(Array.from({ length: 11 }, (_, i): BombWire => ({ id: randomUUID(), value: 'red', sortValue: i + 1.5, cut: false, hint: null })));
    // These are public possible red values, never the secret order of incoming wires.
    state.redMarkers = Array.from({ length: 11 }, (_, i) => i + 1.5);
  }
  if (state.mission.id === 66) state.audio.bunker = createBombBunker(api.shuffle(['A', 'B', 'C', 'D', 'E'] as BombBunkerConstraint[]));
}

function startWindow(state: Host, now: number) {
  const a = state.audio;
  a.pending = null; a.status = 'running';
  a.deadlineAt = step(state).durationSeconds === null ? null : now + step(state).durationSeconds * 1000;
}
function insertRed(state: Host, rackId: string) {
  const actor = current(state), rack = actor.racks.find(r => r.id === rackId);
  if (!rack) throw new Error('자신의 받침대를 선택하세요.');
  const red = state.audio.reserveRed.shift();
  if (!red) return;
  rack.wires.push(red); rack.wires.sort((a, b) => a.sortValue - b.sortValue);
  note(state, `${actor.name}에게 빨강 전선이 추가되었습니다.`);
}
function enterStep(state: Host, index: number, api: BombCampaignApi) {
  const a = state.audio;
  a.stepIndex = index; a.status = 'paused'; a.deadlineAt = null; a.notices = []; setAck(state);
  const kind = step(state).kind;
  if (a.missionId === 30) {
    const success = a.targets.length === 1 && countCut(state, a.targets[0]) >= 2;
    if (kind === 'target_penalty' && !success) state.mistakes++;
    if (kind === 'target_equipment' && !success) {
      const lowest = state.equipment.filter(e => !e.used).sort((x, y) => x.id - y.id)[0];
      if (lowest) { state.equipment = state.equipment.filter(e => e.id !== lowest.id); note(state, `${lowest.name} 장비를 잃었습니다.`); }
    }
    if (kind === 'target_yellow' && success) state.players.forEach(p => note(state, `${p.name}의 남은 노랑: ${remaining(p).filter(w => w.value === 'yellow').length}개`));
    if (kind === 'target_mute' && !success) {
      if (!a.mutedIds.includes(state.currentPlayerId)) a.mutedIds.push(state.currentPlayerId);
      note(state, `${current(state).name}은 이제 말 대신 몸짓으로 전달합니다.`);
    }
    if (kind === 'target_presence' && success) {
      const number = a.numberDeck.shift();
      if (number !== undefined) note(state, `${current(state).name}: 숫자 ${number} ${remaining(current(state)).some(w => w.value === number) ? '있음' : '없음'}`);
    }
    if (kind === 'three_targets') {
      if (success) { all(state).filter(w => w.value === a.targets[0]).forEach(w => { w.cut = true; }); api.updateEquipment(state); }
      a.targets = a.numberDeck.splice(0, 3);
    } else if (kind === 'yellow_rescue') {
      if (a.targets.every(n => countCut(state, n) >= 4)) { api.finish(state, 'won', '세 목표 숫자의 전선을 모두 처리했습니다!'); return; }
      a.targets = [];
      const yellowCount = all(state).filter(w => !w.cut && w.value === 'yellow').length;
      if (yellowCount) a.pending = { kind: 'yellow_rescue', actorId: state.currentPlayerId };
      else note(state, '남은 노랑이 없어 마지막 해체 구간으로 이동합니다.');
    } else if (kind.startsWith('target')) a.targets = a.numberDeck.splice(0, 1);
    danger(state, api);
  }
  if (a.missionId === 42) beginCircusEvent(state, kind, api);
  if (a.missionId === 54) {
    if (kind === 'insert_red') {
      if (current(state).racks.length > 1) a.pending = { kind: 'red_rack', actorId: state.currentPlayerId };
      else insertRed(state, current(state).racks[0].id);
    }
    if (kind === 'repeat') a.repeatPlayerId = state.currentPlayerId;
    if (kind === 'oxygen') state.campaign.oxygen[state.currentPlayerId] = (state.campaign.oxygen[state.currentPlayerId] || 0) + 1;
    if (kind === 'transfer' && state.players.some(p => p.id !== state.currentPlayerId && remaining(p).length)) a.pending = { kind: 'transfer', actorId: state.currentPlayerId };
  }
  if (a.missionId === 66 && kind !== 'bunker_swap') a.bunker.stage = kind as BombBunkerStage;
}

export function tickBombAudio(state: Host, api: BombCampaignApi, now = Date.now()): boolean {
  const a = state.audio;
  if (!a || state.phase !== 'playing' || a.status !== 'running' || a.deadlineAt === null || now < a.deadlineAt) return false;
  const last = a.stepIndex === BOMB_AUDIO_STEPS[a.missionId].length - 1;
  // A queued move still consumes time. Ordinary detector/gear resolutions may finish before the next instruction.
  if (!last && a.missionId !== 66 && (state.pendingDetector || state.pendingExchange || state.campaign?.pending)) return false;
  if (a.missionId === 66 && step(state).kind !== 'bunker_swap' && !last && !bunkerStageComplete(a.bunker)) {
    api.finish(state, 'lost', '벙커 목표를 제한 시간 안에 완료하지 못했습니다.'); return true;
  }
  if (last) {
    api.finish(state, 'lost', '음성 미션의 해체 시간이 끝났습니다.'); return true;
  }
  // Reaching a goal early must not skip the official waiting window.
  enterStep(state, a.stepIndex + 1, api); return true;
}

export function validateBombAudioAction(state: Host, actor: BombPlayer, action: BombBustersAction): void {
  const a = state.audio;
  if (!a || state.phase !== 'playing') return;
  if (action.type === 'mission' && action.operation.startsWith('audio_')) return;
  if (a.status !== 'running' || a.pending) throw new Error('현재 음성 안내의 선택과 확인을 먼저 마치세요.');
  if (a.bunker && (step(state).kind === 'bunker_swap' || bunkerStageComplete(a.bunker))) throw new Error('목표를 완료했습니다. 다음 음성 안내까지 기다리세요.');
}

export function validateBombAudioCut(state: Host, actor: BombPlayer, value: BombWireValue): void {
  const a = state.audio;
  if (!a) return;
  if (a.missionId === 30 && step(state).kind === 'three_targets' && !a.targets.includes(Number(value))) throw new Error('공개된 세 숫자만 절단할 수 있습니다.');
  if (a.bunker) {
    if (value === 'yellow' && (a.bunker.stage !== 'disable_laser' || !bunkerAtStageAction(a.bunker))) throw new Error('노랑 전선은 레이저 레버에서 절단합니다.');
    if (bunkerAtStageAction(a.bunker)) {
      if (a.bunker.stage === 'disable_laser' ? value !== 'yellow' : !bunkerConstraintAllows(a.bunker.constraints.action, value)) throw new Error('현재 ACTION 제약에 맞는 전선을 선택하세요.');
    }
  }
}

/** Returns true while a movement choice holds the end of the current turn. */
export function afterBombAudioCut(state: Host, api: BombCampaignApi): boolean {
  const a = state.audio, turn = state.campaign?.turn;
  if (!a || !turn || a.processedTurn === state.turnNumber || state.phase !== 'playing') return false;
  a.processedTurn = state.turnNumber;
  const cut = all(state).filter(w => turn.uncutIds.includes(w.id) && w.cut);
  const success = cut.length > 0 && !turn.forcedFailure;
  if (a.missionId === 42 && success) afterCircusCut(state, turn.actorId);
  if (!a.bunker || !['dual', 'solo', 'special'].includes(turn.kind) || turn.value === null) return false;
  if (danger(state, api)) return true;
  const moves = turn.kind === 'solo' && cut.length === 4 ? 2 : 1;
  for (let i = 0; i < moves; i++) {
    if (bunkerAtStageAction(a.bunker)) { performBunkerAction(a.bunker, turn.value, success); continue; }
    const directions = allowedBunkerMoves(a.bunker, turn.value);
    if (!directions.length) continue;
    a.pending = { kind: 'move', actorId: turn.actorId, value: turn.value, remainingMoves: moves - i, success };
    return true;
  }
  return false;
}
export function afterBombAudioTurn(state: Host, previousId: string, api: BombCampaignApi): void {
  const a = state.audio;
  if (!a || state.phase !== 'playing') return;
  if (a.repeatPlayerId === previousId) {
    if (remaining(state.players.find(p => p.id === previousId)).length) state.currentPlayerId = previousId;
    a.repeatPlayerId = null;
  }
}

function selectedWires(state: Host, ids: string[] | undefined, count: number) {
  if (!Array.isArray(ids) || ids.length !== count || new Set(ids).size !== count) throw new Error(`서로 다른 미절단 전선 ${count}개를 선택하세요.`);
  const selected = ids.map(id => all(state).find(w => w.id === id));
  if (selected.some(w => !w || w.cut)) throw new Error('미절단 전선을 선택하세요.');
  return selected;
}
function cutYellowRescue(state: Host, command: BombMissionCommand, api: BombCampaignApi) {
  const count = all(state).filter(w => !w.cut && w.value === 'yellow').length;
  const selected = selectedWires(state, command.wireIds, count);
  if (selected.some(w => w.value !== 'yellow')) { api.finish(state, 'lost', '남은 노랑 전선을 한 번에 모두 맞히지 못했습니다.'); return; }
  selected.forEach(w => { w.cut = true; }); api.updateEquipment(state);
  state.audio.pending = null;
  if (state.campaign) state.campaign.turn = null;
  api.endTurn(state);
  if (state.phase === 'playing') setAck(state);
}
function laserAttempt(state: Host, actor: BombPlayer, command: BombMissionCommand, api: BombCampaignApi) {
  const a = state.audio;
  if (!a.bunker || !bunkerAtStageAction(a.bunker) || a.bunker.stage !== 'disable_laser' || actor.id !== state.currentPlayerId || a.status !== 'running' || a.pending) throw new Error('현재 레이저 레버를 해제할 수 없습니다.');
  const selected = selectedWires(state, command.wireIds, 2);
  if (state.campaign) state.campaign.turn = null;
  if (selected.some(w => w.value === 'red')) {
    if (state.stabilizerActive) {
      note(state, '안정기가 빨강 전선의 폭발을 막았습니다. 정보 토큰은 놓지 않습니다.');
      api.endTurn(state);
    } else api.finish(state, 'lost', '레이저 해제 중 빨강 전선을 건드렸습니다.');
    return;
  }
  const success = selected.every(w => w.value === 'yellow');
  if (success) { selected.forEach(w => { w.cut = true; }); api.updateEquipment(state); }
  else {
    if (!state.stabilizerActive) state.mistakes++;
    const wrong = selected.filter(w => w.value !== 'yellow');
    if (wrong.length === 2 && !danger(state, api)) {
      a.pending = { kind: 'laser_hint', actorId: actor.id, wireIds: wrong.map(w => w.id) };
      note(state, '두 대상이 모두 노랑이 아닙니다. 정보를 놓을 한 전선을 선택하세요.');
      return;
    }
    if (wrong.length === 1) { wrong[0].hint = wrong[0].value; recordBombFailureClue(state, wrong[0].id); }
  }
  performBunkerAction(a.bunker, 'yellow', success);
  if (!danger(state, api)) api.endTurn(state);
}

export function applyBombAudioCommand(state: Host, actor: BombPlayer, command: BombMissionCommand, api: BombCampaignApi, now = Date.now()): boolean {
  if (!command.operation.startsWith('audio_')) return false;
  const a = state.audio;
  if (!a || state.phase !== 'playing') throw new Error('음성 미션 진행 중에만 사용할 수 있습니다.');
  const controls = bombAudioView(state, actor.id)?.controls || [];
  if (!controls.some(c => c.id === command.operation)) throw new Error('지금 자신에게 허용된 음성 미션 선택이 아닙니다.');
  const op = command.operation;
  if (op === 'audio_start') { enterStep(state, 0, api); startWindow(state, now); return true; }
  if (op === 'audio_ack') { startWindow(state, now); return true; }
  if (a.missionId === 42 && applyCircusCommand(state, actor, command, api)) return true;
  if (op === 'audio_red_rack') { insertRed(state, command.rackId); setAck(state); return true; }
  if (op === 'audio_transfer') {
    const target = state.players.find(p => p.id === command.targetPlayerId), amount = Number(command.value);
    if (!target || target.id === actor.id || !remaining(target).length || !Number.isInteger(amount) || amount < 0 || !['give', 'take'].includes(command.direction)) throw new Error('전선이 남은 동료 한 명과 산소 이동 방향·개수를 선택하세요.');
    const [from, to] = command.direction === 'give' ? [actor.id, target.id] : [target.id, actor.id];
    if ((state.campaign.oxygen[from] || 0) < amount) throw new Error('이동할 산소가 부족합니다.');
    state.campaign.oxygen[from] -= amount; state.campaign.oxygen[to] = (state.campaign.oxygen[to] || 0) + amount;
    note(state, `산소 ${amount}개를 교환했습니다.`); setAck(state); return true;
  }
  if (op === 'audio_yellow_rescue') { cutYellowRescue(state, command, api); return true; }
  if (op === 'audio_pass') { if (state.campaign) state.campaign.turn = null; api.endTurn(state); return true; }
  if (op === 'audio_speech_violation') { state.mistakes++; note(state, `${actor.name}의 발언 규칙 위반: 기폭기 1칸 전진`); danger(state, api); return true; }
  if (op === 'audio_laser') { laserAttempt(state, actor, command, api); return true; }
  if (op === 'audio_laser_hint') {
    if (!a.pending.wireIds.includes(command.cardId)) throw new Error('이번에 지목한 두 전선 중 하나를 선택하세요.');
    const chosen = all(state).find(w => w.id === command.cardId);
    chosen.hint = chosen.value; recordBombFailureClue(state, chosen.id); a.pending = null; api.endTurn(state); return true;
  }
  if (op === 'audio_move') {
    const pending = a.pending;
    if (!allowedBunkerMoves(a.bunker, pending.value).includes(command.direction as BombBunkerDirection)) throw new Error('가능한 이동 방향을 선택하세요.');
    state.mistakes += moveBombBunker(a.bunker, pending.value, command.direction as BombBunkerDirection);
    if (danger(state, api)) return true;
    pending.remainingMoves--;
    if (pending.remainingMoves > 0 && bunkerAtStageAction(a.bunker)) {
      if (a.bunker.stage === 'disable_laser' ? pending.value === 'yellow' : bunkerConstraintAllows(a.bunker.constraints.action, pending.value)) performBunkerAction(a.bunker, pending.value, pending.success);
      pending.remainingMoves--;
    }
    if (!pending.remainingMoves || !allowedBunkerMoves(a.bunker, pending.value).length) { a.pending = null; api.endTurn(state); }
    return true;
  }
  if (op === 'audio_bunker_swap') {
    const slots = ['north', 'east', 'south', 'west', 'action'] as const;
    if (!slots.includes(command.direction as typeof slots[number]) || !['A','B','C','D','E'].includes(command.cardId)) throw new Error('방향과 배치할 제약 카드를 선택하세요.');
    const slot = command.direction as typeof slots[number];
    const other = slots.find(k => a.bunker.constraints[k] === command.cardId);
    [a.bunker.constraints[slot], a.bunker.constraints[other]] = [a.bunker.constraints[other], a.bunker.constraints[slot]]; return true;
  }
  throw new Error('지원하지 않는 음성 미션 선택입니다.');
}

export function bombAudioView(state: Host, viewer?: string): BombAudioView | undefined {
  const a = state.audio;
  if (!a) return;
  const entry = step(state), own = state.players.find(p => p.id === viewer), controls: BombMissionControl[] = [];
  const control = (id: string, label: string, extra: Partial<BombMissionControl> = {}) => controls.push({ id, label, ...extra });
  if (own && state.phase === 'playing') {
    if (a.status === 'ready' && viewer === state.captainId) control('audio_start', '음성 미션 시작');
    const pending = a.pending;
    if (pending?.actorId === viewer) {
      if (pending.kind === 'ack') control('audio_ack', '안내 확인 · 작업시간 시작');
      if (pending.kind === 'red_rack') control('audio_red_rack', '빨강을 놓을 받침대', { rackIds: own.racks.map(r => r.id) });
      if (pending.kind === 'transfer') control('audio_transfer', '산소 주고받기 (0개로 건너뛰기)', { playerIds: state.players.filter(p => p.id !== viewer && remaining(p).length).map(p => p.id), directions: ['give', 'take'], values: Array.from({ length: Math.max(...Object.values(state.campaign.oxygen), 0) + 1 }, (_, i) => i) });
      if (pending.kind === 'yellow_rescue') {
        const count = all(state).filter(w => !w.cut && w.value === 'yellow').length;
        control('audio_yellow_rescue', `남은 노랑 ${count}개 한 번에 맞히기`, { wireSelection: { owner: 'all', min: count, max: count } });
      }
      if (pending.kind === 'move') control('audio_move', '벙커 이동', { directions: allowedBunkerMoves(a.bunker, pending.value) });
      if (pending.kind === 'laser_hint') control('audio_laser_hint', '실패 정보 토큰을 놓을 전선', { cards: pending.wireIds.map(id => {
        const owner = state.players.find(p => wires(p).some(w => w.id === id));
        const rack = owner.racks.find(r => r.wires.some(w => w.id === id));
        return { id, label: `${owner.name} · 받침대 ${owner.racks.indexOf(rack) + 1} · ${rack.wires.findIndex(w => w.id === id) + 1}번` };
      }) });
    }
    if (a.missionId === 42) controls.push(...circusControls(state, viewer));
    if (a.status === 'running' && !a.pending) {
      if (a.mutedIds.includes(viewer)) control('audio_speech_violation', '내 발언 규칙 위반 신고');
      if (viewer === state.currentPlayerId && a.missionId === 30 && entry.kind === 'three_targets' && !remaining(own).some(w => a.targets.includes(Number(w.value)))) control('audio_pass', '대상 숫자가 없어 패스');
      if (viewer === state.currentPlayerId && a.bunker?.stage === 'disable_laser' && bunkerAtStageAction(a.bunker)) control('audio_laser', '노랑 두 개로 레이저 해제', { wireSelection: { owner: 'all', min: 2, max: 2 } });
      if (viewer === state.captainId && entry.kind === 'bunker_swap') control('audio_bunker_swap', '제약 카드 재배치', { directions: ['north', 'east', 'south', 'west', 'action'], cards: ['A','B','C','D','E'].map(id => ({ id, label: id })) });
    }
  }
  const view: BombAudioView = {
    title: entry.title, instructions: [...entry.instructions, ...a.notices], sourceUrl: BOMB_AUDIO_SOURCE_URLS[a.missionId],
    stepIndex: a.stepIndex, stepCount: BOMB_AUDIO_STEPS[a.missionId].length, status: state.phase === 'finished' ? 'complete' : a.status,
    controls, targetNumbers: [...a.targets], validationTokensRemoved: a.validationTokensRemoved,
    hideCutCounts: bombAudioHideCutCounts(state),
    removedCutWireIds: [...(a.removedCutWireIds || [])],
  };
  if (own && a.pending?.kind === 'red_rack' && a.pending.actorId === viewer && a.reserveRed[0]) view.instructions.push(`이번에 받은 빨강의 정렬 위치는 ${a.reserveRed[0].sortValue}입니다. 자신의 받침대를 선택하세요.`);
  if (state.phase !== 'finished' && a.deadlineAt !== null) view.deadlineAt = a.deadlineAt;
  if (state.phase !== 'finished' && a.pending) view.pendingActorId = a.pending.actorId;
  if (state.phase !== 'finished' && a.status === 'ready') view.pendingActorId = state.captainId;
  if (a.mutedIds.length) view.speechRule = `${a.mutedIds.map(id => state.players.find(p => p.id === id)?.name).join(', ')}: 말 대신 몸짓만 사용합니다.`;
  if (a.taDaRequired) view.speechRule = '절단 성공 뒤 완료 구호 버튼을 누르세요.';
  if (a.bunker) view.bunker = { ...structuredClone(a.bunker), map: structuredClone(BOMB_BUNKER_MAP) };
  return view;
}

export function audioWireVisible(state: Host, viewer: string | undefined, owner: BombPlayer | string): boolean | undefined {
  const a = state.audio;
  if (a?.missionId === 42 && a.pending?.kind === 'magician' && viewer !== a.pending.actorId && state.phase !== 'finished') return false;
  return undefined;
}
export function bombAudioHideCutCounts(state: Host): boolean {
  return state.phase !== 'finished' && !!(state.audio?.hideCutCounts || state.audio?.validationTokensRemoved);
}
export function bombAudioAllowsVictory(state: Host): boolean {
  return !state.audio?.bunker || state.audio.bunker.stage === 'finish_defusal';
}
