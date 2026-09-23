import { validateBombAudioCut } from './campaign-audio';
import { BombBustersAction, BombBustersState, BombPlayer, BombWire, BombWireValue } from '../entities/bomb-busters-game-state.entity';
import { BOMB_CAMPAIGN_DEFINITIONS, BombCampaignDefinition, BombCampaignRule } from './campaign-definitions';
import { BombCampaignState, BombCampaignView, BombClue, BombMissionCommand, BombMissionControl } from './campaign-state';
import { recordBombFailureClue } from './turn-result';
import { BOMB_CHALLENGES, BOMB_CONSTRAINTS, BombConstraintId } from './rule-cards';
import { evaluateBombChallenges } from './campaign-challenges';
import { getConstraintViolation, failureMistakeCost } from './campaign-constraints';
import { bombCampaignInstructions } from './campaign-instructions';

export interface BombCampaignApi {
  shuffle<T>(items: T[]): T[];
  finish(state: BombBustersState, outcome: 'won' | 'lost', reason: string): void;
  endTurn(state: BombBustersState): void;
  applyCut(state: BombBustersState, player: BombPlayer, action: BombBustersAction): void;
  updateEquipment(state: BombBustersState): void;
}

const wires = (player: BombPlayer) => player.racks.flatMap(r => r.wires);
const allWires = (state: BombBustersState) => state.players.flatMap(wires);
const remaining = (player: BombPlayer) => wires(player).filter(w => !w.cut);
const player = (state: BombBustersState, id: string) => {
  const result = state.players.find(p => p.id === id);
  if (!result) throw new Error('미션 참가자를 선택하세요.');
  return result;
};
const def = (state: BombBustersState) => BOMB_CAMPAIGN_DEFINITIONS.find(d => d.id === state.mission.id);
export function bombRule<K extends BombCampaignRule['kind']>(state: BombBustersState, kind: K): Extract<BombCampaignRule, { kind: K }> | undefined {
  return def(state)?.rules.find(r => r.kind === kind) as Extract<BombCampaignRule, { kind: K }> | undefined;
}
const numbers = () => Array.from({ length: 12 }, (_, i) => i + 1);
const order = (state: BombBustersState) => {
  const start = state.players.findIndex(p => p.id === state.captainId);
  return [...state.players.slice(start), ...state.players.slice(0, start)];
};
const label = (value: BombWireValue) => value === 'red' ? '빨강' : value === 'yellow' ? '노랑' : String(value);
const countCut = (state: BombBustersState, value: BombWireValue) => allWires(state).filter(w => w.cut && w.value === value).length;
const uncutValue = (state: BombBustersState, value: BombWireValue) => allWires(state).filter(w => !w.cut && w.value === value);

export function configureBombCampaign(state: BombBustersState, api: BombCampaignApi) {
  const definition = def(state);
  if (!definition) return;
  const c: BombCampaignState = {
    missionId: definition.id, pending: null, turn: null, history: [], numberDeck: [], numbers: [], usedNumbers: [], targetValue: null,
    requiredValue: null, directorId: null, playerNumbers: {}, constraints: {}, constraintDeck: [], globalConstraint: null,
    constraintsByNumber: {}, passedPlayers: [], secretRoleId: null, secretRevealed: false, challenges: [], challengeNumbers: [],
    completedChallenges: [], equipmentDeck: [], nano: null, oxygen: {}, oxygenPool: 0, selectedPersonal: [], absentClues: {}, sideClues: {},
    savedHintQueue: [], yellowRewardDone: false, specialComplete: false, deadlineAt: null, timerStarted: false, memoryPreview: false,
    sequenceDirection: 'left', constraintSwapAvailable: true, prediction: null, predictionOwnerId: null, round: 1,
    setupTasks: [], pendingAfterTurn: false, personalChoicesComplete: false, personalDisabledForever: false, rotationSlots: [], rewardValues: [],
  };
  state.campaign = c;
  if (definition.dialStart === 'one_from_explosion') state.mistakes = state.maxMistakes - 1;
  if (definition.dialStart === 'one_safer') state.mistakes = -1;

  // Reserve and special first deals happen before the ordinary, even distribution.
  let deck = api.shuffle(allWires(state));
  state.players.forEach(p => p.racks.forEach(r => { r.wires = []; }));
  const racks = state.players.flatMap(p => p.racks);
  const nanoReserve = bombRule(state, 'nano_reserve');
  if (nanoReserve) c.nano = { position: 1, direction: 1, reserve: deck.splice(0, nanoReserve.countByPlayers[state.players.length]) };
  const predealtColor = bombRule(state, 'triple_red_cut') ? 'red' : (bombRule(state, 'yellow_single_cut') || bombRule(state, 'triple_yellow_cut')) ? 'yellow' : null;
  if (predealtColor) {
    const colored = deck.filter(w => w.value === predealtColor);
    deck = deck.filter(w => w.value !== predealtColor);
    const receivers = order(state).filter(p => !(bombRule(state, 'yellow_single_cut') && state.players.length === 5 && p.id === state.captainId));
    colored.forEach((wire, index) => {
      const recipient = receivers[index % receivers.length];
      recipient.racks[Math.floor(index / receivers.length) % recipient.racks.length].wires.push(wire);
    });
  }
  const xRule = bombRule(state, 'x_wire');
  if (xRule?.blueOnly) racks.forEach(r => {
    const index = deck.findIndex(w => typeof w.value === 'number');
    const [wire] = deck.splice(index, 1); wire.excluded = true; r.wires.push(wire);
  });
  deck.forEach((wire, index) => racks[index % racks.length].wires.push(wire));
  if (xRule && !xRule.blueOnly) racks.forEach(r => { r.wires[r.wires.length - 1].excluded = true; });
  const reverseRule = bombRule(state, 'reverse_wires');
  if (reverseRule) state.players.filter(p => reverseRule.players === 'all' || p.id === state.captainId).forEach(p => {
    const chosen = api.shuffle(wires(p)).slice(0, reverseRule.countPerPlayer).sort((a, b) => a.sortValue - b.sortValue);
    chosen.forEach((wire, index) => {
      p.racks.forEach(r => { r.wires = r.wires.filter(w => w.id !== wire.id); });
      wire.reversed = true;
      p.racks[index === 0 && reverseRule.positions === 'outer_ends' ? 0 : p.racks.length - 1].wires.push(wire);
    });
  });
  racks.forEach(r => {
    r.wires.sort((a, b) => a.sortValue - b.sortValue);
    const ordinary = r.wires.filter(w => !w.excluded && !w.reversed);
    const special = r.wires.filter(w => w.excluded || w.reversed);
    r.wires = [...ordinary, ...special];
  });
  if (reverseRule?.positions === 'outer_ends') state.players.forEach(p => {
    const reversed = wires(p).filter(w => w.reversed).sort((a, b) => a.sortValue - b.sortValue);
    p.racks.forEach(r => { r.wires = r.wires.filter(w => !w.reversed); });
    p.racks[0].wires.unshift(reversed[0]); p.racks[p.racks.length - 1].wires.push(reversed[1]);
  });

  if (definition.id >= 31 && !bombRule(state, 'unlimited_detector')) {
    c.setupTasks.push(...order(state).filter(p => p.id !== state.captainId).map(p => ({ actorId: p.id, operation: 'choose_personal' })));
  }
  state.players.forEach(p => {
    p.personalEquipmentId = 0;
    c.absentClues[p.id] = []; c.sideClues[p.id] = [];
    const disable = bombRule(state, 'disable_personal_equipment');
    if (disable && (disable.players === 'all' || p.id === state.captainId)) p.detectorUsed = true;
    if (bombRule(state, 'captain_failure_explodes')?.forbidPersonalEquipment && p.id === state.captainId) p.detectorUsed = true;
  });
  const sequence = bombRule(state, 'sequence');
  if (sequence) {
    c.numbers = api.shuffle(numbers()).slice(0, sequence.cards);
    if (sequence.chooseEnd) c.setupTasks.push({ actorId: state.captainId, operation: 'sequence_direction' });
  }
  if (bombRule(state, 'blue_value_is_red') || bombRule(state, 'quad_cut_reward')) c.targetValue = api.shuffle(numbers())[0];
  if (bombRule(state, 'quad_cut_reward')?.reward === 'hints') c.numberDeck = api.shuffle(numbers().filter(n => n !== c.targetValue)).slice(0, 8);
  if (bombRule(state, 'equipment_extra_number_lock')) c.numbers = api.shuffle(numbers()).slice(0, state.equipment.length);
  if (bombRule(state, 'hidden_equipment_completion')) { c.numberDeck = api.shuffle(numbers()); c.targetValue = c.numberDeck.shift(); }
  if (definition.equipmentMode === 'hidden') {
    c.equipmentDeck = api.shuffle(state.equipment.map(e => e.id)); state.equipment = [];
  }
  if (definition.equipmentMode === 'none') state.equipment = [];
  if (definition.equipmentMode === 'radar_only') state.equipment = state.equipment.filter(e => e.id === 8);
  if (['radar_director', 'number_director', 'volunteer_number', 'number_cycle', 'arithmetic'].some(kind => bombRule(state, kind as BombCampaignRule['kind']))) {
    c.numberDeck = api.shuffle(numbers()); c.numbers = numbers();
  }
  if (bombRule(state, 'number_pass')) {
    api.shuffle(numbers()).forEach((value, index) => {
      const id = order(state)[index % state.players.length].id; (c.playerNumbers[id] ??= []).push(value);
    });
  }
  if (bombRule(state, 'hidden_number_prediction')) {
    c.numberDeck = api.shuffle(numbers());
    order(state).forEach((p, index) => { c.playerNumbers[p.id] = c.numberDeck.splice(0, index === state.players.length - 1 ? 3 : 2); });
  }
  const constraintRule = bombRule(state, 'constraints');
  if (constraintRule) {
    c.constraintDeck = api.shuffle([...constraintRule.pool]);
    if (constraintRule.mode === 'choose_individual') c.setupTasks.push(...order(state).map(p => ({ actorId: p.id, operation: 'choose_constraint' })));
    else if (constraintRule.mode === 'number_linked') numbers().forEach(n => { c.constraintsByNumber[n] = c.constraintDeck.shift(); });
    else if (constraintRule.mode === 'rotating_individual') {
      order(state).forEach(p => { c.constraints[p.id] = c.constraintDeck.shift(); });
      c.rotationSlots = c.constraintDeck.splice(0, state.players.length === 2 ? 2 : state.players.length === 3 ? 1 : 0);
      c.constraintDeck = api.shuffle(['F', 'G', 'H', 'I', 'J', 'K', 'L'] as BombConstraintId[]);
    } else c.globalConstraint = c.constraintDeck.shift();
  }
  if (bombRule(state, 'secret_constraint_role')) {
    const cards = api.shuffle(['A', 'B', 'C', 'D', 'E'] as BombConstraintId[]);
    c.secretRoleId = api.shuffle(state.players)[0].id;
    state.players.forEach(p => { c.constraints[p.id] = cards.pop(); p.detectorUsed = true; });
    c.setupTasks = c.setupTasks.filter(task => task.operation !== 'choose_personal');
    c.setupTasks.push(...order(state).map(p => ({ actorId: p.id, operation: 'choose_personal' })));
  }
  if (bombRule(state, 'nano_race')) c.nano = { position: 0, direction: 1, reserve: [] };
  if (bombRule(state, 'nano_path')) {
    c.numbers = api.shuffle(numbers()); const index = c.numbers.indexOf(7);
    c.nano = { position: index, direction: index < 6 ? 1 : -1, reserve: [] };
  }
  const oxygen = bombRule(state, 'oxygen');
  if (oxygen) {
    if (oxygen.sharedPerPlayer) c.oxygenPool = oxygen.sharedPerPlayer * state.players.length;
    state.players.forEach(p => { c.oxygen[p.id] = oxygen.perPlayerByPlayers?.[state.players.length] ?? (p.id === state.captainId ? oxygen.totalByPlayers?.[state.players.length] ?? 0 : 0); });
  }
  if (bombRule(state, 'challenges')) {
    c.challenges = api.shuffle(Array.from({ length: 10 }, (_, i) => i + 1)).slice(0, state.players.length);
    if (c.challenges.includes(8)) c.challengeNumbers = api.shuffle(numbers()).slice(0, 2);
  }
  if (bombRule(state, 'number_healing')) c.numbers = api.shuffle(numbers()).slice(0, state.players.length);
  if (definition.initialHintMode === 'none') state.players.forEach(p => { p.initialHintPlaced = true; });
  if (definition.initialHintMode === 'random') state.players.forEach(p => randomInitialClue(state, p, api));
  if (state.players.length === 2 && definition.twoPlayerCaptainHint) {
    const captain = player(state, state.captainId);
    if (definition.twoPlayerCaptainHint === 'none') captain.initialHintPlaced = true;
    else randomInitialClue(state, captain, api);
  }
  const falseRule = bombRule(state, 'false_hints');
  if (falseRule) c.setupTasks.push(...order(state).filter(p => falseRule.players === 'all' || p.id === state.captainId).map(p => ({ actorId: p.id, operation: 'false_hint', value: 2 })));
  if (bombRule(state, 'absent_hints')) c.setupTasks.push(...order(state).map(p => ({ actorId: p.id, operation: 'absent_hint', value: 2 })));
  if (bombRule(state, 'memory_hints')) { c.memoryPreview = true; c.setupTasks.unshift({ actorId: state.captainId, operation: 'finish_memory_preview' }); }
  advanceCampaignSetup(state, api);
}

function randomInitialClue(state: BombBustersState, p: BombPlayer, api: BombCampaignApi) {
  const value = api.shuffle(availableInfoTokens(state, false))[0];
  const wire = wires(p).find(w => w.value === value && !w.reversed && !w.excluded);
  if (wire) placeBombClue(state, p, wire, value);
  else state.campaign.absentClues[p.id].push(value);
  p.initialHintPlaced = true;
}

export function availableInfoTokens(state: BombBustersState, yellow: boolean): BombWireValue[] {
  const candidates: BombWireValue[] = [...numbers(), ...(yellow && state.mission.yellowCount ? ['yellow' as const] : [])];
  const placed = [...allWires(state).filter(w => !w.cut && w.clue && ['value', 'not'].includes(w.clue.kind)).map(w => w.clue.value),
    ...Object.values(state.campaign.absentClues).flat(), ...Object.values(state.campaign.sideClues).flat().filter(c => c.kind === 'value').map(c => c.value)];
  return candidates.flatMap(value => Array.from({ length: Math.max(0, 2 - placed.filter(p => p === value).length) }, () => value));
}

function advanceCampaignSetup(state: BombBustersState, api: BombCampaignApi) {
  const c = state.campaign;
  c.pending = c.setupTasks.shift() ?? null;
  if (c.pending) return;
  if (state.players.every(p => p.initialHintPlaced)) {
    state.phase = 'playing'; state.currentPlayerId = state.captainId;
    startCampaignTurn(state, api);
  } else state.currentPlayerId = order(state).find(p => !p.initialHintPlaced).id;
}

export function placeBombClue(state: BombBustersState, owner: BombPlayer, wire: BombWire, guessedValue?: BombWireValue, failedCut = false): BombClue | null {
  const c = state.campaign;
  let clue: BombClue = { kind: 'value', value: wire.value };
  if (bombRule(state, 'unlimited_detector')) return null;
  if (bombRule(state, 'parity_hints') && typeof wire.value === 'number') clue = { kind: 'parity', value: wire.value % 2 ? 'odd' : 'even' };
  if (bombRule(state, 'multiplicity_hints')) clue = { kind: 'count', value: owner.racks.find(r => r.wires.includes(wire)).wires.filter(w => w.value === wire.value).length };
  const falseRule = bombRule(state, 'false_hints');
  if (falseRule && (falseRule.players === 'all' || owner.id === state.captainId)) clue = { kind: 'not', value: guessedValue };
  if (bombRule(state, 'memory_hints')) {
    c.sideClues[owner.id].push(clue); wire.hint = null; delete wire.clue;
    c.flashClues = [...(c.flashClues ?? []).filter(f => f.expiresAt > Date.now()), { wireId: wire.id, clue, expiresAt: Date.now() + 3000 }];
  } else {
    wire.clue = clue;
    wire.hint = clue.kind === 'value' ? wire.value : null;
  }
  if (failedCut) recordBombFailureClue(state, wire.id);
  return clue;
}

export function campaignConstraintIds(state: BombBustersState, playerId: string): BombConstraintId[] {
  const c = state.campaign;
  if (!c) return [];
  if (bombRule(state, 'secret_constraint_role') && (!c.secretRevealed && c.secretRoleId !== playerId)) return [];
  return [c.globalConstraint, c.constraints[playerId]].filter(Boolean) as BombConstraintId[];
}

export function startCampaignTurn(state: BombBustersState, api: BombCampaignApi) {
  const c = state.campaign;
  if (!c || state.phase !== 'playing' || c.pending) return;
  c.constraintSwapAvailable = true;
  const actor = player(state, state.currentPlayerId);
  const constraints = bombRule(state, 'constraints');
  if (constraints?.permanentReleaseWhenImpossible) {
    const id = c.constraints[actor.id]; const card = BOMB_CONSTRAINTS.find(x => x.id === id);
    if (card?.allowedBlueValues && !remaining(actor).some(w => typeof w.value === 'number' && card.allowedBlueValues.includes(w.value))) c.constraints[actor.id] = null;
  }
  const timer = bombRule(state, 'timer');
  if (timer && !c.timerStarted) {
    c.timerStarted = true; c.deadlineAt = Date.now() + (state.players.length === 2 ? timer.twoPlayerSeconds : timer.seconds) * 1000;
    c.pending = { actorId: 'any', operation: 'claim_turn' }; return;
  }
  if (remaining(actor).every(w => isBombRed(state, w))) return;
  if (bombRule(state, 'sequence') && !hasCampaignCut(state, actor)) { api.finish(state, 'lost', '순서 제한으로 현재 플레이어가 절단할 전선이 없습니다.'); return; }
  if (bombRule(state, 'radar_director') || bombRule(state, 'number_director') || bombRule(state, 'volunteer_number')) {
    c.directorId = actor.id;
    c.numberDeck = c.numberDeck.filter(n => countCut(state, n) < 4);
    if (!c.numberDeck.length) c.numberDeck = api.shuffle(numbers().filter(n => countCut(state, n) < 4));
    c.requiredValue = c.numberDeck.shift();
    if (bombRule(state, 'radar_director')) state.radarResults = [{ value: c.requiredValue, racks: state.players.flatMap(p => p.racks.map(r => ({ playerId: p.id, rackId: r.id, present: r.wires.some(w => !w.cut && w.value === c.requiredValue) }))) }];
    c.pending = { actorId: bombRule(state, 'volunteer_number') ? state.captainId : actor.id, operation: 'choose_directed_player' };
  } else if (bombRule(state, 'hidden_number_prediction')) {
    const index = state.players.findIndex(p => p.id === actor.id);
    for (let offset = 1; offset < state.players.length; offset++) {
      const other = state.players[(index - offset + state.players.length) % state.players.length];
      if (c.playerNumbers[other.id]?.length) { c.pending = { actorId: other.id, operation: 'predict_number' }; break; }
    }
  }
}

export function isBombRed(state: BombBustersState, wire: BombWire): boolean {
  return wire.value === 'red' || (!!bombRule(state, 'blue_value_is_red') && wire.value === state.campaign.targetValue);
}

export function beginCampaignCut(state: BombBustersState, actor: BombPlayer, kind: 'dual' | 'solo' | 'special' | 'pass' | 'reveal_red' | 'equipment', value: BombWireValue | null) {
  if (!state.campaign) return;
  state.campaign.turn = { actorId: actor.id, kind, value, mistakesBefore: state.mistakes, uncutIds: allWires(state).filter(w => !w.cut).map(w => w.id) };
}

export function checkBombCampaignTimeout(state: BombBustersState, api: BombCampaignApi) {
  if (state.phase === 'playing' && state.campaign?.deadlineAt && Date.now() >= state.campaign.deadlineAt) api.finish(state, 'lost', '미션 제한 시간이 끝났습니다.');
}

export function validateBombCampaignCut(state: BombBustersState, actor: BombPlayer, value: BombWireValue, kind: 'dual' | 'solo', targets: BombWire[] = [], ownWire?: BombWire, equipment = false) {
  const c = state.campaign;
  if (!c) return;
  validateBombAudioCut(state, actor, value);
  if (bombRule(state, 'blue_value_is_red') && value === c.targetValue) throw new Error('이 숫자는 빨강으로 취급하므로 일반 절단할 수 없습니다.');
  if (c.pending) throw new Error('먼저 미션의 선택을 마치세요.');
  if (c.requiredValue !== null && value !== c.requiredValue) throw new Error(`이번 절단은 ${c.requiredValue}을 선언해야 합니다.`);
  const sequence = bombRule(state, 'sequence');
  if (sequence && typeof value === 'number' && c.numbers.includes(value)) {
    const next = c.sequenceDirection === 'left' ? c.numbers[0] : c.numbers[c.numbers.length - 1];
    if (value !== next) throw new Error('순서 카드가 가리키는 숫자를 먼저 절단하세요.');
  }
  if (bombRule(state, 'quad_cut_reward') && !c.specialComplete && value === c.targetValue) throw new Error('이 숫자는 특별 행동으로 네 전선을 동시에 절단해야 합니다.');
  if (bombRule(state, 'sevens_last') && value === 7) throw new Error('7은 마지막 특별 행동으로 네 개를 동시에 절단하세요.');
  if ((bombRule(state, 'yellow_single_cut') || bombRule(state, 'triple_yellow_cut')) && value === 'yellow') throw new Error('노랑은 미션의 특별 절단 행동을 사용하세요.');
  const x = bombRule(state, 'x_wire');
  if (x && [ownWire, ...targets].filter(Boolean).some(w => w.excluded)) {
    if (equipment) throw new Error('X 전선에는 장비를 사용할 수 없습니다.');
    if (countCut(state, 'yellow') < x.unlockAfterYellowCount) throw new Error('노란 전선을 먼저 모두 절단하세요.');
  }
  const reverse = bombRule(state, 'reverse_wires');
  if (reverse && ownWire?.reversed && equipment) throw new Error('자기 역방향 전선에는 장비를 사용할 수 없습니다.');
  if (reverse?.otherCut === 'forbidden' && targets.some(w => w.reversed)) throw new Error('대장의 역방향 전선은 대장만 자신의 행동으로 절단할 수 있습니다.');
  if (bombRule(state, 'number_cycle')) {
    if (c.numbers.every(n => c.usedNumbers.includes(n))) c.usedNumbers = [];
    if (typeof value !== 'number' || c.usedNumbers.includes(value)) throw new Error('아직 공개된 숫자 카드를 선택하세요.');
    c.usedNumbers.push(value);
  }
  if (bombRule(state, 'arithmetic') && c.requiredValue === null) throw new Error('먼저 숫자 카드 두 장으로 덧셈 또는 뺄셈을 하세요.');
  if (bombRule(state, 'nano_path') && c.requiredValue === null) throw new Error('먼저 나노가 이동할 숫자를 선택하세요.');
  if (bombRule(state, 'number_pass') && !c.playerNumbers[actor.id]?.includes(Number(value))) throw new Error('자신이 가진 숫자 카드의 값을 절단하세요.');
  const targetContext = targets.map(w => {
    const rack = state.players.flatMap(p => p.racks).find(r => r.wires.includes(w));
    const uncut = rack.wires.filter(candidate => !candidate.cut);
    return { isLeftEdge: uncut[0]?.id === w.id, isRightEdge: uncut[uncut.length - 1]?.id === w.id, hasClue: !!w.clue || w.hint !== null };
  });
  for (const constraint of campaignConstraintIds(state, actor.id)) {
    const error = getConstraintViolation(constraint, { value, kind, targetWires: targetContext, usesEquipment: equipment, ownWireHasClue: !!ownWire?.clue || ownWire?.hint != null });
    if (error) throw new Error(error);
  }
  const oxygen = bombRule(state, 'oxygen');
  if (oxygen) {
    const cost = oxygen.mode === 'shared_round' || oxygen.mode === 'pay_bands' ? Math.ceil(Number(value) / 4) : Number(value);
    if (oxygen.mode === 'transfer_exact') {
      if (c.requiredValue !== value) throw new Error('절단 전에 산소를 받을 사람에게 전달하세요.');
    } else if (oxygen.mode === 'shared_round') {
      if (c.oxygenPool < cost) throw new Error('공용 산소가 부족합니다.');
      c.oxygenPool -= cost; c.oxygen[actor.id] = (c.oxygen[actor.id] || 0) + cost;
    } else {
      if ((c.oxygen[actor.id] || 0) < cost) throw new Error('산소가 부족합니다.');
      c.oxygen[actor.id] -= cost; c.oxygenPool += cost;
    }
  }
  c.constraintSwapAvailable = false;
}

/** Runs once after a resolved turn, before ordinary turn advancement. May request a follow-up choice. */
export function afterBombCampaignCut(state: BombBustersState, api: BombCampaignApi): boolean {
  const c = state.campaign;
  if (!c?.turn || c.turn.effectsApplied) return !!c?.pendingAfterTurn;
  const turn = c.turn; turn.effectsApplied = true;
  const newlyCut = allWires(state).filter(w => w.cut && turn.uncutIds.includes(w.id));
  const completedNumbers = numbers().filter(value => newlyCut.some(w => w.value === value) && countCut(state, value) === 4);
  const success = newlyCut.length > 0 && !turn.forcedFailure;
  if (turn.kind !== 'pass') c.passedPlayers = [];
  const event = { actorId: turn.actorId, kind: turn.kind, value: turn.value, success, completedNumbers };
  c.history.push(event);
  const actor = player(state, turn.actorId);
  if (!success && turn.kind === 'dual') {
    const fatal = bombRule(state, 'captain_failure_explodes');
    if ((fatal && actor.id === state.captainId) || turn.reversedOwn) api.finish(state, 'lost', '이 미션에서 해당 플레이어의 절단 실패는 즉시 폭발합니다.');
    if (!state.stabilizerActive) state.mistakes += failureMistakeCost(campaignConstraintIds(state, actor.id)) - 1;
  }
  if (newlyCut.some(w => w.reversed && !wires(actor).includes(w)) && bombRule(state, 'reverse_wires')?.otherCut === 'penalty_one') state.mistakes++;
  const sequence = bombRule(state, 'sequence');
  if (sequence && typeof turn.value === 'number' && c.numbers.includes(turn.value) && countCut(state, turn.value) >= sequence.cutThreshold) {
    c.numbers = c.numbers.filter(n => n !== turn.value);
    if (sequence.chooseEnd && c.numbers.length) c.pending = { actorId: actor.id, operation: 'sequence_direction' };
  }
  if (bombRule(state, 'hidden_number_prediction')) {
    if (success && turn.value === c.prediction) state.mistakes++;
    if (c.prediction !== null) (c.playerNumbers[actor.id] ??= []).push(c.prediction);
    c.prediction = null; c.predictionOwnerId = null;
    Object.entries(c.playerNumbers).forEach(([id, cards]) => {
      if (!remaining(player(state, id)).length) c.numberDeck.push(...cards.filter(n => countCut(state, n) < 4));
      c.playerNumbers[id] = remaining(player(state, id)).length ? cards.filter(n => countCut(state, n) < 4) : [];
      if (c.playerNumbers[id].length === 1) {
        while (c.numberDeck.length && c.playerNumbers[id].length < 2) { const n = c.numberDeck.shift(); if (countCut(state, n) < 4) c.playerNumbers[id].push(n); }
      }
    });
    if (numbers().filter(n => countCut(state, n) < 4).length <= 1) c.playerNumbers = {};
  }
  applyBombNumberCompletions(state, completedNumbers);
  evaluateCampaignChallenges(state);
  const oxygen = bombRule(state, 'oxygen');
  if (oxygen?.removeOnExit) state.players.filter(p => !remaining(p).length).forEach(p => { c.oxygen[p.id] = 0; });
  if (bombRule(state, 'nano_reserve') && success && turn.value === c.nano.position && c.nano.reserve.length) c.pending = { actorId: actor.id, operation: 'take_nano_wire' };
  if (bombRule(state, 'nano_race')) {
    c.nano.position += turn.kind === 'dual' && !success ? 2 : success ? (turn.value === c.nano.position ? -1 : 1) : 1;
    c.nano.position = Math.max(0, c.nano.position);
    state.mistakes = 0;
    if (c.nano.position >= 12) api.finish(state, 'lost', '나노가 12에 도달하여 폭탄이 폭발했습니다.');
  }
  if (bombRule(state, 'nano_path') && ['dual', 'solo'].includes(turn.kind)) c.pending = { actorId: actor.id, operation: 'nano_direction' };
  if (bombRule(state, 'number_pass') && c.playerNumbers[actor.id]?.length && turn.kind !== 'equipment') c.pending = { actorId: actor.id, operation: 'pass_number' };
  if (!c.yellowRewardDone && countCut(state, 'yellow') >= 2 && (bombRule(state, 'yellow_pair_hint_reward') || bombRule(state, 'absent_hints'))) {
    c.yellowRewardDone = true; c.savedHintQueue = order(state).map(p => p.id);
    c.rewardValues = api.shuffle(availableInfoTokens(state, true)).slice(0, state.players.length);
    c.pending = { actorId: c.savedHintQueue.shift(), operation: bombRule(state, 'absent_hints') ? 'gift_hint' : 'choose_reward_hint' };
  }
  if (c.pending && state.phase !== 'finished') { c.pendingAfterTurn = true; return true; }
  return false;
}

/** Numeric completion effects are shared with automatic equipment cuts. */
export function applyBombNumberCompletions(state: BombBustersState, completedNumbers: number[]) {
  const c = state.campaign;
  if (!c || !completedNumbers.length) return;
  if (bombRule(state, 'hidden_equipment_completion') && completedNumbers.includes(c.targetValue)) {
    unlockRewardEquipment(state, c.equipmentDeck.splice(0, 1), true);
    do { c.targetValue = c.numberDeck.shift() ?? null; } while (c.targetValue !== null && countCut(state, c.targetValue) === 4);
  }
  const constraintRule = bombRule(state, 'constraints');
  if (completedNumbers.length && constraintRule?.mode === 'completed_changes_global') c.globalConstraint = c.constraintDeck.shift() ?? null;
  if (constraintRule?.mode === 'number_linked') completedNumbers.forEach(n => { c.globalConstraint = c.constraintsByNumber[n]; });
  if (bombRule(state, 'number_healing')) completedNumbers.forEach(n => {
    if (c.numbers.includes(n)) { rewindBomb(state); c.numbers = c.numbers.filter(value => value !== n); }
  });
  const oxygen = bombRule(state, 'oxygen');
  if (oxygen?.completionReward && completedNumbers.length) state.players.filter(p => remaining(p).length).forEach(p => { c.oxygen[p.id] += completedNumbers.length; });
  if (bombRule(state, 'number_cycle') || bombRule(state, 'number_pass')) {
    c.numbers = c.numbers.filter(n => !completedNumbers.includes(n));
    Object.entries(c.playerNumbers).forEach(([id, values]) => { c.playerNumbers[id] = values.filter(n => !completedNumbers.includes(n)); });
  }
}

export function afterBombCampaignTurn(state: BombBustersState, previousPlayerId: string, api: BombCampaignApi) {
  const c = state.campaign;
  if (!c || state.phase !== 'playing') return;
  const turn = c.turn;
  const ordered = order(state);
  const previousIndex = ordered.findIndex(p => p.id === previousPlayerId);
  const nextIndex = ordered.findIndex(p => p.id === state.currentPlayerId);
  const newRound = nextIndex <= previousIndex;
  if (newRound) {
    c.round++;
    if (bombRule(state, 'quad_cut_reward') && !c.specialComplete) {
      if (bombRule(state, 'quad_cut_reward').reward === 'equipment') c.equipmentDeck.shift(); else c.numberDeck.shift();
    }
    if (bombRule(state, 'oxygen')?.mode === 'shared_round') { c.oxygenPool += Object.values(c.oxygen).reduce((a, b) => a + b, 0); Object.keys(c.oxygen).forEach(id => { c.oxygen[id] = 0; }); }
    if (bombRule(state, 'oxygen')?.mode === 'captain_relay') { c.oxygen[state.currentPlayerId] = (c.oxygen[state.currentPlayerId] || 0) + c.oxygenPool; c.oxygenPool = 0; }
  }
  if (bombRule(state, 'oxygen')?.mode === 'captain_relay' && state.currentPlayerId !== previousPlayerId) {
    c.oxygen[state.currentPlayerId] = (c.oxygen[state.currentPlayerId] || 0) + (c.oxygen[previousPlayerId] || 0); c.oxygen[previousPlayerId] = 0;
  }
  if (bombRule(state, 'nano_reserve')) {
    if (c.nano.position === 12) c.nano.direction = -1;
    if (c.nano.position === 1) c.nano.direction = 1;
    c.nano.position += c.nano.direction;
  }
  c.requiredValue = null; c.directorId = null; c.turn = null;
  if (bombRule(state, 'arithmetic') && c.usedNumbers.length === 12) c.usedNumbers = [];
  if (bombRule(state, 'timer')) c.pending = { actorId: 'any', operation: 'claim_turn', selectedPlayerId: turn?.actorId ?? previousPlayerId };
  else startCampaignTurn(state, api);
}

export function rewindBomb(state: BombBustersState) { state.mistakes = Math.max(state.maxMistakes - 5, state.mistakes - 1); }

export function evaluateCampaignChallenges(state: BombBustersState) {
  const c = state.campaign;
  if (!c || !bombRule(state, 'challenges')) return;
  evaluateBombChallenges(state, c.history, c.challengeNumbers).forEach(id => {
    if (c.challenges.includes(id) && !c.completedChallenges.includes(id)) { c.completedChallenges.push(id); rewindBomb(state); state.log.push(`도전 ${id} 완료! 기폭기를 한 칸 되돌렸습니다.`); }
  });
}

// Kept here so hidden reward decks never need to be exposed in the public equipment list.
import { BOMB_BUSTERS_EQUIPMENT } from './equipment';
function unlockRewardEquipment(state: BombBustersState, ids: number[], forceUnlocked = false) {
  ids.forEach(id => {
    const definition = BOMB_BUSTERS_EQUIPMENT.find(e => e.id === id);
    if (definition) state.equipment.push({ ...structuredClone(definition), used: false, unlocked: forceUnlocked, ...(forceUnlocked ? { unlock: { value: 1, count: 0 } } : {}) });
  });
}

export function applyBombMissionCommand(state: BombBustersState, actor: BombPlayer, action: BombMissionCommand, api: BombCampaignApi) {
  const c = state.campaign;
  if (!c) throw new Error('현재 미션에는 이 행동이 없습니다.');
  const available = bombCampaignView(state, actor.id).controls;
  if (!available.some(control => control.id === action.operation)) throw new Error('지금 선택할 수 없는 미션 행동입니다.');
  const operation = action.operation;
  const pending = c.pending;
  const selectOwn = () => {
    if (action.wireIds?.length !== 1) throw new Error('전선 하나를 선택하세요.');
    const wire = wires(actor).find(w => w.id === action.wireIds[0]);
    if (!wire || wire.cut || wire.reversed || wire.excluded) throw new Error('자신에게 보이는 미절단 전선을 선택하세요.');
    return wire;
  };
  const completePending = () => {
    c.pending = null;
    if (state.phase === 'setup') advanceCampaignSetup(state, api);
    else if (c.pendingAfterTurn) { c.pendingAfterTurn = false; api.endTurn(state); }
  };
  if (operation === 'choose_personal') {
    const selected = Number(action.cardId);
    if (![0, 2, 3, 8, 10].includes(selected) || (selected === 10 && def(state).excludedPersonalEquipment?.includes('xy-ray'))) throw new Error('사용할 수 있는 개인 장비를 선택하세요.');
    if (c.secretRoleId === actor.id && selected !== 0) throw new Error('비밀 대장 역할은 기본 개인 장비를 사용합니다.');
    actor.personalEquipmentId = selected; c.selectedPersonal.push(actor.id); completePending(); return;
  }
  if (operation === 'choose_constraint') {
    const id = action.cardId as BombConstraintId;
    if (!c.constraintDeck.includes(id)) throw new Error('공개된 제약을 선택하세요.');
    c.constraints[actor.id] = id; c.constraintDeck = c.constraintDeck.filter(card => card !== id); completePending(); return;
  }
  if (operation === 'finish_memory_preview') { c.memoryPreview = false; completePending(); return; }
  if (operation === 'sequence_direction') {
    if (!['left', 'right'].includes(action.direction)) throw new Error('왼쪽 또는 오른쪽 끝을 선택하세요.');
    c.sequenceDirection = action.direction as 'left' | 'right'; completePending(); return;
  }
  if (operation === 'false_hint') {
    const wire = selectOwn(); const value = action.value;
    if (typeof value !== 'number' || !numbers().includes(value) || value === wire.value || wire.clue || (wire.value === 'red' && !bombRule(state, 'false_hints').initialRedAllowed) || wire.value === 'yellow') throw new Error('정보가 없는 허용 전선에 실제 값과 다른 숫자를 놓으세요.');
    placeBombClue(state, actor, wire, value);
    pending.value--;
    if (pending.value === 0) { actor.initialHintPlaced = true; completePending(); }
    return;
  }
  if (operation === 'absent_hint' || operation === 'finish_absent_hint') {
    const rack = actor.racks.find(r => r.id === action.rackId) ?? (actor.racks.length === 1 ? actor.racks[0] : null);
    if (operation === 'absent_hint') {
      if (!rack) throw new Error('단서를 놓을 받침대를 선택하세요.');
      const value = action.value;
      if (![...numbers(), 'yellow'].includes(value) || rack.wires.some(w => w.value === value)) throw new Error('해당 받침대에 없는 값을 선택하세요.');
      const key = actor.racks.length === 1 ? actor.id : rack.id;
      if ((c.absentClues[key] ?? []).includes(value) || (actor.racks.length > 1 && c.absentClues[key]?.length)) throw new Error('중복되지 않는 단서를 각 받침대에 놓으세요.');
      (c.absentClues[key] ??= []).push(value); pending.value--;
    }
    if (operation === 'finish_absent_hint' || pending.value === 0) { actor.initialHintPlaced = true; completePending(); }
    return;
  }
  if (operation === 'claim_turn') {
    if (!remaining(actor).length) throw new Error('전선이 남은 플레이어만 자원할 수 있습니다.');
    if (actor.id === pending.selectedPlayerId && state.players.filter(p => remaining(p).length).length > 2) throw new Error('같은 플레이어는 연속으로 자원할 수 없습니다.');
    state.currentPlayerId = actor.id; c.pending = null; return;
  }
  if (operation === 'choose_directed_player' || operation === 'volunteer') {
    const target = player(state, operation === 'volunteer' ? actor.id : action.targetPlayerId);
    if (!remaining(target).length) throw new Error('전선이 남은 플레이어를 선택하세요.');
    if (bombRule(state, 'number_director') && remaining(target).every(w => isBombRed(state, w))) { api.finish(state, 'lost', '빨강만 가진 플레이어에게 절단을 명령했습니다.'); return; }
    c.pending = null; state.currentPlayerId = target.id;
    if (!remaining(target).some(w => w.value === c.requiredValue)) {
      if (bombRule(state, 'radar_director')) throw new Error('공개한 레이더 숫자를 보유한 플레이어를 선택하세요.');
      if (operation === 'volunteer' && remaining(target).every(w => isBombRed(state, w))) { c.requiredValue = null; api.applyCut(state, target, { type: 'reveal_red' }); return; }
      c.pending = { actorId: target.id, operation: 'absent_directed_hint' };
    }
    return;
  }
  if (operation === 'absent_directed_hint') {
    const wire = selectOwn(); if (typeof wire.value !== 'number') throw new Error('파란 전선을 선택하세요.');
    placeBombClue(state, actor, wire, wire.value); c.pending = null;
    beginCampaignCut(state, actor, 'pass', null); state.mistakes++; api.endTurn(state); return;
  }
  if (operation === 'predict_number') {
    const value = Number(action.cardId);
    if (!c.playerNumbers[actor.id]?.includes(value)) throw new Error('보유한 숫자 카드를 선택하세요.');
    c.playerNumbers[actor.id] = c.playerNumbers[actor.id].filter(n => n !== value);
    c.prediction = value; c.predictionOwnerId = actor.id; c.pending = null; return;
  }
  if (operation === 'take_nano_wire') {
    const rack = actor.racks.find(r => r.id === action.rackId); if (!rack) throw new Error('받을 받침대를 선택하세요.');
    const wire = c.nano.reserve.shift(); if (!wire) throw new Error('로봇에게 남은 전선이 없습니다.');
    rack.wires.push(wire); rack.wires.sort((a, b) => a.sortValue - b.sortValue); completePending(); return;
  }
  if (operation === 'nano_direction') {
    if (!['keep', 'reverse'].includes(action.direction)) throw new Error('나노의 방향을 선택하세요.');
    if (action.direction === 'reverse') c.nano.direction = c.nano.direction === 1 ? -1 : 1;
    completePending(); return;
  }
  if (operation === 'pass_number') {
    const value = Number(action.cardId); const target = player(state, action.targetPlayerId);
    if (!c.playerNumbers[actor.id]?.includes(value) || target.id === actor.id || !remaining(target).length) throw new Error('보유한 숫자 카드와 전선이 남은 다른 팀원을 선택하세요.');
    c.playerNumbers[actor.id] = c.playerNumbers[actor.id].filter(n => n !== value);
    (c.playerNumbers[target.id] ??= []).push(value);
    if (!remaining(actor).length && c.playerNumbers[actor.id].length) { api.finish(state, 'lost', '마지막 전선을 처리한 플레이어에게 숫자 카드가 남았습니다.'); return; }
    completePending(); return;
  }
  if (operation === 'choose_reward_hint' || operation === 'gift_hint' || operation === 'accept_gift_hint') {
    const value = operation === 'accept_gift_hint' ? (pending.selection === 'yellow' ? 'yellow' : Number(pending.selection)) : action.value;
    if (![...numbers(), 'yellow'].includes(value)) throw new Error('정보 토큰의 값을 선택하세요.');
    if (operation === 'gift_hint') {
      const index = state.players.findIndex(p => p.id === actor.id);
      c.pending = { actorId: state.players[(index + 1) % state.players.length].id, operation: 'accept_gift_hint', selection: String(value) }; return;
    }
    const rewardValues: BombWireValue[] = bombRule(state, 'quad_cut_reward')?.reward === 'hints' ? c.playerNumbers[actor.id] ?? [] : c.rewardValues;
    if (operation === 'choose_reward_hint' && !rewardValues.includes(value)) throw new Error('남은 무작위 정보 토큰을 선택하세요.');
    const possible = remaining(actor).filter(w => w.value === value && !w.reversed && !w.excluded);
    if (possible.length) {
      const wire = possible.find(w => action.wireIds?.includes(w.id)); if (!wire) throw new Error('선택한 값의 전선에 정보 토큰을 놓으세요.');
      placeBombClue(state, actor, wire, value);
    } else if (bombRule(state, 'quad_cut_reward')?.reward !== 'hints') c.absentClues[actor.id].push(value);
    if (operation === 'choose_reward_hint' && bombRule(state, 'quad_cut_reward')?.reward !== 'hints') c.rewardValues.splice(c.rewardValues.indexOf(value), 1);
    if (c.savedHintQueue.length) c.pending = { actorId: c.savedHintQueue.shift(), operation: bombRule(state, 'absent_hints') ? 'gift_hint' : 'choose_reward_hint' };
    else completePending();
    return;
  }
  if (operation === 'arithmetic') {
    const values = action.cardIds?.map(Number);
    if (values?.length !== 2 || values[0] === values[1] || values.some(n => !numbers().includes(n) || c.usedNumbers.includes(n))) throw new Error('공개된 서로 다른 숫자 카드 두 장을 선택하세요.');
    const result = action.direction === 'add' ? values[0] + values[1] : action.direction === 'subtract' ? Math.abs(values[0] - values[1]) : 0;
    if (!numbers().includes(result) || !remaining(actor).some(w => w.value === result)) throw new Error('자신이 보유한 1~12 값을 만드는 덧셈 또는 뺄셈을 선택하세요.');
    c.usedNumbers.push(...values); c.requiredValue = result; return;
  }
  if (operation === 'nano_move') {
    const value = Number(action.value); const index = c.numbers.indexOf(value);
    if (index < 0 || (index - c.nano.position) * c.nano.direction < 0 || countCut(state, value) === 4 || !remaining(actor).some(w => w.value === value)) throw new Error('나노의 현재 위치 또는 앞쪽에서 보유한 숫자를 선택하세요.');
    c.nano.position = index; c.requiredValue = value; return;
  }
  if (operation === 'pay_oxygen') {
    const target = player(state, action.targetPlayerId); const value = Number(action.value);
    if (target.id === actor.id || !remaining(target).length || !numbers().includes(value) || !remaining(actor).some(w => w.value === value) || c.oxygen[actor.id] < value) throw new Error('절단할 값만큼 산소를 보유하고 다른 활동 중인 팀원을 선택하세요.');
    c.oxygen[actor.id] -= value; c.oxygen[target.id] += value; c.requiredValue = value; return;
  }
  if (operation === 'replace_constraint') {
    c.globalConstraint = c.constraintDeck.shift() ?? null; c.constraintSwapAvailable = false; return;
  }
  if (operation === 'swap_constraint') {
    if (!c.constraintDeck.length) throw new Error('교체할 제약 카드가 없습니다.');
    c.constraints[actor.id] = c.constraintDeck.shift(); state.mistakes++;
    if (state.mistakes >= state.maxMistakes) api.finish(state, 'lost', '제약 교체로 기폭기가 끝에 도달했습니다.');
    return;
  }
  if (operation === 'rotate_constraints') {
    const people = order(state);
    const positions = state.players.length === 2 ? [people[0].id, 'slot-0', people[1].id, 'slot-1'] : state.players.length === 3 ? [people[0].id, 'slot-0', people[1].id, people[2].id] : people.map(p => p.id);
    const entries = positions.map(id => id.startsWith('slot-') ? c.rotationSlots[Number(id.slice(5))] : c.constraints[id]);
    if (action.direction === 'cw') entries.unshift(entries.pop()); else if (action.direction === 'ccw') entries.push(entries.shift()); else throw new Error('회전 방향을 선택하세요.');
    positions.forEach((id, index) => { if (id.startsWith('slot-')) c.rotationSlots[Number(id.slice(5))] = entries[index]; else c.constraints[id] = entries[index]; }); c.constraintSwapAvailable = false; return;
  }
  if (operation === 'guess_secret') {
    if (action.targetPlayerId === c.secretRoleId && action.cardId === c.constraints[c.secretRoleId]) {
      c.secretRevealed = true; c.constraints = {}; state.players.forEach(p => { p.detectorUsed = false; });
    } else state.mistakes++;
    c.constraintSwapAvailable = false;
    if (state.mistakes >= state.maxMistakes) api.finish(state, 'lost', '비밀 역할 추측 실패로 폭발했습니다.');
    return;
  }
  if (operation === 'report_violation') {
    state.mistakes += bombRule(state, 'communication')?.penalty ?? 0; state.log.push(`${actor.name}님이 의사소통 규칙 위반을 신고했습니다.`);
    if (state.mistakes >= state.maxMistakes) api.finish(state, 'lost', '의사소통 규칙 위반으로 폭발했습니다.');
    return;
  }
  if (operation === 'oxygen_signal') { state.log.push(`${actor.name}님이 산소를 요청했습니다.`); return; }
  if (operation === 'pass') {
    beginCampaignCut(state, actor, 'pass', null);
    const constraint = bombRule(state, 'constraints');
    if (constraint) {
      if (hasCampaignCut(state, actor)) throw new Error('합법적인 절단이 가능하면 차례를 넘길 수 없습니다.');
      if (!c.passedPlayers.includes(actor.id)) c.passedPlayers.push(actor.id);
      if (c.passedPlayers.length >= state.players.filter(p => remaining(p).length).length) {
        if (constraint.noActionRound === 'explode') { api.finish(state, 'lost', '한 라운드 동안 아무도 행동할 수 없습니다.'); return; }
        if (constraint.noActionRound === 'advance_and_replace') { state.mistakes++; c.globalConstraint = c.constraintDeck.shift() ?? null; c.passedPlayers = []; }
      }
    } else if (bombRule(state, 'secret_constraint_role')) {
      if (actor.id !== c.secretRoleId || hasCampaignCut(state, actor)) throw new Error('제약 때문에 절단할 수 없을 때만 선언하세요.');
      state.mistakes += 2; c.secretRevealed = true; c.personalDisabledForever = true; c.constraints = {};
    } else {
      const voluntary = bombRule(state, 'arithmetic') || bombRule(state, 'oxygen')?.voluntaryPass;
      if (!voluntary && hasCampaignCut(state, actor)) throw new Error('합법적인 절단이 가능한 동안에는 차례를 넘길 수 없습니다.');
      if (!bombRule(state, 'number_cycle') && !bombRule(state, 'yellow_single_cut') && !state.stabilizerActive) state.mistakes++;
      if (bombRule(state, 'nano_path')) c.nano.direction = c.nano.direction === 1 ? -1 : 1;
    }
    api.endTurn(state); return;
  }
  const specialKinds = ['triple_red', 'quad_cut', 'yellow_single', 'triple_yellow', 'seven_cut', 'challenge_red', 'reversed_solo'];
  if (specialKinds.includes(operation)) {
    const ids = action.wireIds;
    const required = operation === 'triple_red' || operation === 'triple_yellow' ? 3 : operation === 'quad_cut' || operation === 'seven_cut' ? 4 : operation === 'reversed_solo' ? ids?.length : 1;
    if (!Array.isArray(ids) || ids.length !== required || new Set(ids).size !== ids.length || (operation === 'reversed_solo' && ![2, 4].includes(required))) throw new Error('특별 행동에 필요한 전선을 정확히 선택하세요.');
    const selected = ids.map(id => allWires(state).find(w => w.id === id && !w.cut));
    if (selected.some(w => !w)) throw new Error('미절단 전선을 선택하세요.');
    const value: BombWireValue = ['triple_red', 'challenge_red'].includes(operation) ? 'red' : ['yellow_single', 'triple_yellow'].includes(operation) ? 'yellow' : operation === 'seven_cut' ? 7 : operation === 'quad_cut' ? c.targetValue : action.value;
    if (operation === 'seven_cut' && !remaining(actor).every(w => w.value === 7)) throw new Error('자신에게 7만 남았을 때 실행하세요.');
    if (['yellow_single', 'challenge_red'].includes(operation) && wires(actor).includes(selected[0])) throw new Error('동료의 전선을 선택하세요.');
    if (operation === 'reversed_solo' && selected.some(w => !wires(actor).includes(w))) throw new Error('자기 전선만 단독 절단할 수 있습니다.');
    validateBombAudioCut(state, actor, value);
    beginCampaignCut(state, actor, operation === 'reversed_solo' ? 'solo' : 'special', value);
    const correct = selected.every(w => w.value === value);
    if (!correct) {
      if (operation === 'yellow_single' || operation === 'triple_yellow') {
        if (selected.some(w => isBombRed(state, w))) { api.finish(state, 'lost', '빨간 전선을 지목해 폭발했습니다.'); return; }
        selected.forEach(w => placeBombClue(state, state.players.find(p => wires(p).includes(w)), w, value, true)); state.mistakes++;
      } else { api.finish(state, 'lost', '특별 절단의 선언이 틀려 폭발했습니다.'); return; }
    } else {
      if (operation === 'reversed_solo' && uncutValue(state, value).length !== selected.length) throw new Error('그 값의 남은 전선 전부를 보유해야 합니다.');
      selected.forEach(w => { w.cut = true; });
      if (operation === 'yellow_single') rewindBomb(state);
      if (operation === 'challenge_red') { c.completedChallenges.push(1); rewindBomb(state); }
      if (operation === 'quad_cut') {
        c.specialComplete = true;
        if (bombRule(state, 'quad_cut_reward').reward === 'equipment') unlockRewardEquipment(state, c.equipmentDeck.splice(0), true);
        else {
          order(state).forEach(p => { c.playerNumbers[p.id] = []; });
          c.numberDeck.forEach((n, index) => c.playerNumbers[order(state)[index % state.players.length].id].push(n));
          c.savedHintQueue = order(state).filter(p => c.playerNumbers[p.id].some(n => remaining(p).some(w => w.value === n))).map(p => p.id);
          if (c.savedHintQueue.length) c.pending = { actorId: c.savedHintQueue.shift(), operation: 'choose_reward_hint' };
        }
      }
    }
    api.endTurn(state); return;
  }
  throw new Error('구현되지 않은 미션 행동입니다.');
}

function hasCampaignCut(state: BombBustersState, actor: BombPlayer): boolean {
  if (remaining(actor).some(w => isBombRed(state, w)) && remaining(actor).every(w => isBombRed(state, w))) return true;
  return remaining(actor).filter(w => !isBombRed(state, w)).some(wire => {
    const copy = structuredClone(state); const p = player(copy, actor.id); const own = wires(p).find(w => w.id === wire.id);
    try {
      if (bombRule(copy, 'arithmetic') && copy.campaign.requiredValue === null) {
        const cards = numbers().filter(n => !copy.campaign.usedNumbers.includes(n));
        if (!cards.some(a => cards.some(b => a !== b && (a + b === wire.value || Math.abs(a - b) === wire.value)))) return false;
        copy.campaign.requiredValue = Number(wire.value);
      }
      if (bombRule(copy, 'nano_path') && copy.campaign.requiredValue === null) {
        const index = copy.campaign.numbers.indexOf(Number(wire.value));
        if ((index - copy.campaign.nano.position) * copy.campaign.nano.direction < 0) return false;
        copy.campaign.requiredValue = Number(wire.value);
      }
      if (bombRule(copy, 'oxygen')?.mode === 'transfer_exact') {
        if (copy.campaign.oxygen[actor.id] < Number(wire.value)) return false;
        copy.campaign.requiredValue = Number(wire.value);
      }
      const targets = copy.players.filter(other => other.id !== p.id).flatMap(remaining);
      for (const target of targets) {
        const attempt = structuredClone(copy); const attemptPlayer = player(attempt, actor.id);
        const attemptedOwn = wires(attemptPlayer).find(w => w.id === own.id);
        const attemptedTarget = allWires(attempt).find(w => w.id === target.id);
        try { validateBombCampaignCut(attempt, attemptPlayer, wire.value, 'dual', [attemptedTarget], attemptedOwn); return true; } catch { /* Try another public position. */ }
      }
      const ownMatching = remaining(p).filter(w => w.value === wire.value && !w.reversed);
      if ([2, 4].includes(ownMatching.length) && uncutValue(copy, wire.value).length === ownMatching.length) {
        const attempt = structuredClone(copy); const attemptPlayer = player(attempt, actor.id);
        validateBombCampaignCut(attempt, attemptPlayer, wire.value, 'solo', [], wires(attemptPlayer).find(w => w.id === own.id)); return true;
      }
      return false;
    } catch { return false; }
  });
}

export function bombCampaignView(state: BombBustersState, viewerId?: string): BombCampaignView {
  const c = state.campaign; const definition = def(state);
  const view: BombCampaignView = { title: definition.name, description: bombCampaignInstructions(definition), counters: [{ label: '라운드', value: c.round }], cards: [], controls: [] };
  const own = state.players.find(p => p.id === viewerId);
  const current = viewerId === state.currentPlayerId;
  const control = (id: string, text: string, extra: Partial<BombMissionControl> = {}) => view.controls.push({ id, label: text, ...extra });
  const cardChoices = (values: (string | number)[]) => values.map(n => ({ id: String(n), label: String(n) }));
  const activePlayers = state.players.filter(p => remaining(p).length).map(p => p.id);
  const wireChoice = (owner: 'self' | 'others' | 'all', min: number, max = min) => ({ owner, min, max });
  const constraints = bombRule(state, 'constraints');
  if (c.deadlineAt) view.deadlineAt = c.deadlineAt;
  if (bombRule(state, 'blue_value_is_red')) view.redValues = [c.targetValue];
  if (c.flashClues?.length) view.flashClues = c.flashClues.filter(f => f.expiresAt > Date.now()).map(f => ({ wireId: f.wireId, clue: { kind: f.clue.kind, value: f.clue.value }, expiresAt: f.expiresAt }));
  if (c.nano) view.counters.push({ label: '나노', value: bombRule(state, 'nano_path') ? c.numbers[c.nano.position] : c.nano.position, max: 12 }, { label: '로봇의 남은 전선', value: c.nano.reserve.length });
  if (c.nano) view.counters.push({ label: '나노 진행 방향', value: c.nano.direction === 1 ? '오른쪽 →' : '← 왼쪽' });
  if (bombRule(state, 'sequence')) {
    view.counters.push({ label: '다음 순서', value: c.numbers.length ? (c.sequenceDirection === 'left' ? c.numbers[0] : c.numbers[c.numbers.length - 1]) : '완료' });
    view.counters.push({ label: '진행 방향', value: c.sequenceDirection === 'left' ? '왼쪽부터 →' : '← 오른쪽부터' });
  }
  if (bombRule(state, 'oxygen')) {
    view.counters.push({ label: '공용 산소', value: c.oxygenPool });
    state.players.forEach(p => view.counters.push({ label: `${p.name} 산소`, value: c.oxygen[p.id] || 0 }));
  }
  if (c.targetValue !== null) view.cards.push({ id: 'target', label: `목표 ${c.targetValue}`, active: true });
  if (c.requiredValue !== null) view.cards.push({ id: 'required', label: `이번 절단 ${c.requiredValue}`, active: true });
  if (c.equipmentDeck.length) view.counters.push({ label: '비공개 장비', value: c.equipmentDeck.length });
  if (bombRule(state, 'equipment_extra_number_lock')) c.numbers.forEach((n, i) => view.cards.push({ id: `equipment-lock-${i}`, label: `${state.equipment[i]?.name ?? '장비'} 추가 잠금 ${n}`, active: countCut(state, n) >= 2 }));
  else c.numbers.forEach(n => view.cards.push({ id: `number-${n}`, label: String(n), active: !c.usedNumbers.includes(n) && countCut(state, n) < 4 }));
  const secret = bombRule(state, 'secret_constraint_role') && !c.secretRevealed;
  Object.entries(c.constraints).forEach(([id, constraint]) => {
    if (constraint && (!secret || id === viewerId)) view.cards.push({ id: `constraint-${id}`, label: `제약 ${constraint}`, description: BOMB_CONSTRAINTS.find(card => card.id === constraint)?.description, ownerId: id, active: !secret || id === c.secretRoleId });
  });
  if (secret && own) view.cards.push({ id: 'secret-role', label: own.id === c.secretRoleId ? '당신은 약한 고리입니다' : '당신은 일반 대원입니다', ownerId: own.id });
  if (c.globalConstraint) view.cards.push({ id: 'global-constraint', label: `공통 제약 ${c.globalConstraint}`, description: BOMB_CONSTRAINTS.find(card => card.id === c.globalConstraint)?.description, active: true });
  c.rotationSlots.forEach((id, index) => { if (id) view.cards.push({ id: `rotation-slot-${index}`, label: `대장 ${index === 0 ? '왼쪽' : '오른쪽'} 제약 ${id}`, description: BOMB_CONSTRAINTS.find(card => card.id === id)?.description }); });
  Object.entries(c.constraintsByNumber).forEach(([n, id]) => view.cards.push({ id: `number-constraint-${n}`, label: `${n} 완료 → ${id}`, description: BOMB_CONSTRAINTS.find(card => card.id === id)?.description }));
  Object.entries(c.playerNumbers).forEach(([id, values]) => {
    if ((bombRule(state, 'hidden_number_prediction') || bombRule(state, 'quad_cut_reward')?.reward === 'hints') && id !== viewerId) { view.counters.push({ label: `${player(state, id).name} 숫자 카드`, value: values.length }); return; }
    values.forEach(n => view.cards.push({ id: `${id}-number-${n}`, label: String(n), ownerId: id, active: true }));
  });
  c.challenges.forEach(id => view.cards.push({ id: `challenge-${id}`, label: `도전 ${id}${c.completedChallenges.includes(id) ? ' 완료' : ''}`, description: BOMB_CHALLENGES.find(card => card.id === id)?.description, active: !c.completedChallenges.includes(id) }));
  c.challengeNumbers.forEach(n => view.cards.push({ id: `challenge-target-${n}`, label: `도전 8 목표 ${n}` }));
  Object.entries(c.absentClues).forEach(([id, values]) => values.forEach((n, i) => view.cards.push({ id: `absent-${id}-${i}`, label: `${label(n)} 없음`, ownerId: state.players.some(p => p.id === id) ? id : state.players.find(p => p.racks.some(r => r.id === id))?.id })));
  Object.entries(c.sideClues).forEach(([id, clues]) => clues.forEach((clue, i) => view.cards.push({ id: `side-${id}-${i}`, label: label(clue.value as BombWireValue), ownerId: id })));
  if (!own || state.phase === 'finished') return view;
  if (c.pending) {
    view.pendingActorId = c.pending.actorId;
    const op = c.pending.operation;
    if (op === 'claim_turn') {
      if (activePlayers.includes(own.id) && (c.pending.selectedPlayerId !== own.id || activePlayers.length <= 2)) control(op, '다음 차례 자원');
      return view;
    }
    if (op === 'choose_directed_player' && bombRule(state, 'volunteer_number') && activePlayers.includes(own.id)) control('volunteer', '이 숫자 절단 자원');
    if (c.pending.actorId !== own.id) return view;
    if (op === 'choose_personal') control(op, '개인 장비 선택', { cards: [0, 2, 3, 8, 10].filter(id => !(id === 10 && definition.excludedPersonalEquipment?.includes('xy-ray')) && !(own.id === c.secretRoleId && id !== 0)).map(id => ({ id: String(id), label: id === 0 ? '더블 탐지기 · 두 전선을 함께 탐지' : `${BOMB_BUSTERS_EQUIPMENT.find(e => e.id === id).name} · ${BOMB_BUSTERS_EQUIPMENT.find(e => e.id === id).description}` })) });
    else if (op === 'choose_constraint') control(op, '자신의 제약 선택', { cards: c.constraintDeck.map(id => ({ id, label: `${id} · ${BOMB_CONSTRAINTS.find(card => card.id === id).description}` })) });
    else if (op === 'sequence_direction') control(op, '절단 순서의 시작 방향', { directions: ['left', 'right'] });
    else if (op === 'finish_memory_preview') control(op, '빨강·노랑 위치를 기억했습니다');
    else if (op === 'false_hint') control(op, `거짓 정보 놓기 · ${c.pending.value}개 남음`, { values: numbers(), wireSelection: wireChoice('self', 1) });
    else if (op === 'absent_hint') {
      control(op, `없는 값 알리기 · ${c.pending.value}개 남음`, { values: [...numbers(), 'yellow'], rackIds: own.racks.filter(r => own.racks.length === 1 || !c.absentClues[r.id]?.length).map(r => r.id) });
      const possible = own.racks.some(r => {
        const key = own.racks.length === 1 ? own.id : r.id;
        return !(own.racks.length > 1 && c.absentClues[key]?.length) && [...numbers(), 'yellow'].some(value => !r.wires.some(w => w.value === value) && !(c.absentClues[key] ?? []).includes(value as BombWireValue));
      });
      if (!possible) control('finish_absent_hint', '없는 값 단서가 더 없습니다');
    } else if (op === 'choose_directed_player') control(op, '절단할 플레이어 지명', { playerIds: activePlayers });
    else if (op === 'absent_directed_hint') control(op, '지시된 값 없음 · 단서 놓고 기폭 +1', { wireSelection: wireChoice('self', 1) });
    else if (op === 'predict_number') control(op, '비공개 숫자 예측', { cards: cardChoices(c.playerNumbers[own.id] || []) });
    else if (op === 'take_nano_wire') control(op, '나노 전선 받을 받침대', { rackIds: own.racks.map(r => r.id) });
    else if (op === 'nano_direction') control(op, '다음 나노 방향', { directions: ['keep', 'reverse'] });
    else if (op === 'pass_number') control(op, '숫자 카드 넘기기', { cards: cardChoices(c.playerNumbers[own.id]), playerIds: activePlayers.filter(id => id !== own.id) });
    else if (op === 'choose_reward_hint') control(op, '정보 토큰 선택', { values: bombRule(state, 'quad_cut_reward')?.reward === 'hints' ? c.playerNumbers[own.id] ?? [] : c.rewardValues, wireSelection: wireChoice('self', 0, 1) });
    else if (op === 'gift_hint') control(op, '왼쪽 사람에게 줄 정보 선택', { values: [...numbers(), 'yellow'] });
    else if (op === 'accept_gift_hint') control(op, `받은 ${c.pending.selection} 정보 배치`, { wireSelection: wireChoice('self', 0, 1) });
    return view;
  }
  if (state.phase !== 'playing') return view;
  if (bombRule(state, 'communication')?.restriction === 'silent_except_oxygen') control('oxygen_signal', '산소 필요 신호');
  if (bombRule(state, 'communication')) control('report_violation', `의사소통 규칙 위반 신고${bombRule(state, 'communication').penalty ? ' · 기폭 +1' : ''}`);
  if (constraints?.mode === 'captain_changes_global' && own.id === state.captainId && c.constraintSwapAvailable) control('replace_constraint', '공통 제약 교체');
  if (constraints?.mode === 'rotating_individual') {
    if (c.constraintDeck.length) control('swap_constraint', '제약 교체 · 기폭 +1');
    if (current && own.id === state.captainId && c.constraintSwapAvailable) control('rotate_constraints', '모든 제약 회전', { directions: ['cw', 'ccw'] });
  }
  if (!current) return view;
  if (secret && own.id !== c.secretRoleId && c.constraintSwapAvailable) control('guess_secret', '약한 고리와 제약 추측', { playerIds: activePlayers, cards: cardChoices(['A', 'B', 'C', 'D', 'E']) });
  if (bombRule(state, 'arithmetic') && c.requiredValue === null) control('arithmetic', '숫자 두 장 계산', { cards: cardChoices(numbers().filter(n => !c.usedNumbers.includes(n))), cardSelection: { min: 2, max: 2 }, directions: ['add', 'subtract'] });
  if (bombRule(state, 'nano_path') && c.requiredValue === null) control('nano_move', '나노를 옮길 숫자', { values: c.numbers.filter((n, i) => (i - c.nano.position) * c.nano.direction >= 0 && countCut(state, n) < 4) });
  if (bombRule(state, 'oxygen')?.mode === 'transfer_exact' && c.requiredValue === null) control('pay_oxygen', '절단할 값만큼 산소 전달', { values: numbers(), playerIds: activePlayers.filter(id => id !== own.id) });
  if (bombRule(state, 'triple_red_cut')) control('triple_red', '빨강 세 개 동시 절단', { wireSelection: wireChoice('all', 3) });
  if (bombRule(state, 'quad_cut_reward') && !c.specialComplete) control('quad_cut', `${c.targetValue} 네 개 동시 절단`, { wireSelection: wireChoice('all', 4) });
  if (bombRule(state, 'yellow_single_cut')) control('yellow_single', '동료의 노랑 하나 절단', { wireSelection: wireChoice('others', 1) });
  if (bombRule(state, 'triple_yellow_cut') && countCut(state, 'yellow') < 3) control('triple_yellow', '노랑 세 개 동시 절단', { wireSelection: wireChoice('all', 3) });
  if (bombRule(state, 'sevens_last') && remaining(own).every(w => w.value === 7)) control('seven_cut', '마지막 7 네 개 동시 절단', { wireSelection: wireChoice('all', 4) });
  if (c.challenges.includes(1) && !c.completedChallenges.includes(1)) control('challenge_red', '도전 1 · 동료 빨강 하나 절단', { wireSelection: wireChoice('others', 1) });
  if (remaining(own).some(w => w.reversed)) control('reversed_solo', '역방향 전선을 포함한 단독 절단', { values: [...numbers(), 'yellow'], wireSelection: { ...wireChoice('self', 2, 4), counts: [2, 4] } });
  if (constraints || secret || ['number_cycle', 'arithmetic', 'oxygen', 'nano_path', 'number_pass', 'yellow_single_cut', 'reverse_wires'].some(kind => bombRule(state, kind as BombCampaignRule['kind']))) control('pass', '미션 규칙에 따라 차례 넘기기');
  return view;
}
