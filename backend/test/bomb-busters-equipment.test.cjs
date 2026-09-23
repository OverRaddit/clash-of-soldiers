const test = require('node:test');
const assert = require('node:assert/strict');
const { BombBustersLogicService, BOMB_BUSTERS_EQUIPMENT } = require('../dist/game-room/bomb-busters-logic.service');

const engine = new BombBustersLogicService();

function fixture(actorRacks = [[2, 6]], targetRacks = [[2, 8]]) {
  // Select a deterministic equipment pool for focused rule tests.
  const state = engine.initializeGame(['a', 'b', 'c', 'd', 'e'], [], 0);
  state.equipment = BOMB_BUSTERS_EQUIPMENT.filter(e => [3, 4, 5, 7, 9].includes(e.id)).map(e => ({ ...structuredClone(e), unlocked: true, used: false }));
  const player = (id, values) => ({
    id, name: id, initialHintPlaced: true, detectorUsed: false,
    racks: values.map((rack, r) => ({
      id: `${id}-${r}`,
      wires: rack.map((value, w) => ({
        id: `${id}-${r}-${w}`, value,
        sortValue: typeof value === 'number' ? value : value === 'red' ? 5.5 : 5.1,
        cut: false, hint: null,
      })),
    })),
  });
  state.players = [player('actor', actorRacks), player('target', targetRacks)];
  state.players[0].racks[0].wires.push(...[3, 4, 5, 7, 9].flatMap(value => [0, 1].map(copy => ({
    id: `history-${value}-${copy}`, value, sortValue: value, cut: true, hint: null,
  }))));
  Object.assign(state, {
    phase: 'playing', captainId: 'actor', currentPlayerId: 'actor',
    maxMistakes: 2, mistakes: 0, log: [],
  });
  state.equipment.forEach(item => { item.unlocked = true; });
  return state;
}

const wire = (state, id) => state.players.flatMap(player => player.racks.flatMap(rack => rack.wires)).find(item => item.id === id);
const equipment = (state, id) => state.equipment.find(item => item.id === id);
const act = (state, action, playerId = 'actor') => engine.applyAction(state, playerId, action);
const use = (state, equipmentId, extra = {}, playerId = 'actor') => act(state, { type: 'equipment', equipmentId, ...extra }, playerId);
const cut = (state, ids, extra = {}) => act(state, { type: 'dual', ownWireId: 'actor-0-0', targetPlayerId: 'target', targetWireIds: ids, ...extra });
const resolve = (state, id) => act(state, { type: 'resolve_detector', wireId: id }, 'target');

function rejectsAtomically(state, action, playerId = 'actor') {
  const original = structuredClone(state);
  assert.throws(() => act(state, action, playerId));
  assert.deepEqual(state, original, 'rejected commands must not consume equipment, reveal wires, or change turns');
}

test('Post-it reveals only the user blue wire, works outside their turn, and consumes no turn', () => {
  const state = fixture();
  use(state, 4, { wireIds: ['target-0-1'] }, 'target');
  assert.equal(wire(state, 'target-0-1').hint, 8);
  assert.equal(wire(state, 'target-0-1').cut, false);
  assert.equal(state.currentPlayerId, 'actor');
  assert.equal(state.turnNumber, 1);
  assert.equal(equipment(state, 4).used, true);
  assert.equal(engine.getPlayerView(state, 'actor').players[1].racks[0].wires[1].value, null);
  rejectsAtomically(state, { type: 'equipment', equipmentId: 4, wireIds: ['actor-0-0'] });
});

test('Post-it rejects foreign, yellow, red, and already cut wires without mutation', () => {
  for (const id of ['target-0-0', 'actor-0-1', 'actor-0-2', 'history-4-0']) {
    const state = fixture([[2, 'yellow', 'red']], [[8]]);
    rejectsAtomically(state, { type: 'equipment', equipmentId: 4, wireIds: [id] });
  }
});

test('Spare Batteries recharges one or two used personal detectors outside the user turn', () => {
  for (const ids of [['actor'], ['actor', 'target']]) {
    const state = fixture();
    state.players.forEach(player => { player.detectorUsed = true; });
    use(state, 7, { targetPlayerIds: ids }, 'target');
    assert.equal(state.players[0].detectorUsed, false);
    assert.equal(state.players[1].detectorUsed, ids.length !== 2);
    assert.equal(state.currentPlayerId, 'actor');
    assert.equal(equipment(state, 7).used, true);
  }
});

test('Spare Batteries rejects unused, repeated, missing, or too many targets atomically', () => {
  for (const ids of [['actor', 'target'], ['actor', 'actor'], ['actor', 'missing'], [], ['actor', 'target', 'third']]) {
    const state = fixture();
    state.players[0].detectorUsed = true;
    rejectsAtomically(state, { type: 'equipment', equipmentId: 7, targetPlayerIds: ids });
  }
});

test('Triple Detector needs three wires in one stand, or two when only two remain', () => {
  for (const values of [[2, 6, 8], [2, 8]]) {
    const state = fixture([[2, 11]], [values]);
    use(state, 3);
    const ids = values.map((_, index) => `target-0-${index}`);
    cut(state, ids);
    assert.ok(state.pendingDetector, 'even forced results must await the target, to avoid revealing match count');
    resolve(state, 'target-0-0');
    assert.equal(wire(state, 'actor-0-0').cut, true);
    assert.equal(wire(state, 'target-0-0').cut, true);
    assert.equal(state.players[0].detectorUsed, false, 'shared detector does not consume the personal detector');
    assert.equal(state.tripleDetectorActive, false);
  }
  const state = fixture([[2]], [[2, 6, 8]]);
  use(state, 3);
  rejectsAtomically(state, { type: 'dual', ownWireId: 'actor-0-0', targetPlayerId: 'target', targetWireIds: ['target-0-0', 'target-0-1'] });
});

test('Triple Detector rejects a selection spanning two stands', () => {
  const state = fixture([[2, 11]], [[2, 6], [2, 8]]);
  use(state, 3);
  rejectsAtomically(state, { type: 'dual', ownWireId: 'actor-0-0', targetPlayerId: 'target', targetWireIds: ['target-0-0', 'target-0-1', 'target-1-0'] });
});

test('Super Detector searches exactly one stand and target chooses one matching wire', () => {
  const state = fixture([[2, 11]], [[2, 2, 8], [2, 6]]);
  use(state, 5);
  cut(state, ['target-0-2']);
  assert.deepEqual(state.pendingDetector.targetWireIds, ['target-0-0', 'target-0-1', 'target-0-2']);
  assert.deepEqual(state.pendingDetector.eligibleWireIds, ['target-0-0', 'target-0-1']);
  rejectsAtomically(state, { type: 'resolve_detector', wireId: 'target-1-0' }, 'target');
  rejectsAtomically(state, { type: 'resolve_detector', wireId: 'target-0-0' });
  resolve(state, 'target-0-1');
  assert.equal(wire(state, 'target-0-1').cut, true);
  assert.equal(wire(state, 'target-0-0').cut, false);
  assert.equal(wire(state, 'target-1-0').cut, false);
  assert.equal(state.superDetectorActive, false);
});

test('Detector choice state hides success, own wire, and eligible IDs from actor and observers', () => {
  const state = fixture([[2, 11]], [[2, 2, 8]]);
  use(state, 5);
  cut(state, ['target-0-0']);
  for (const viewer of ['actor', undefined, 'outsider']) {
    const pending = engine.getPlayerView(state, viewer).pendingDetector;
    assert.ok(pending);
    for (const secret of ['success', 'ownWireId', 'eligibleWireIds']) assert.equal(Object.hasOwn(pending, secret), false);
  }
  assert.deepEqual(engine.getPlayerView(state, 'target').pendingDetector.eligibleWireIds, ['target-0-0', 'target-0-1']);
});

test('Detector never reveals the number of matches or red alternatives through automatic resolution', () => {
  for (const values of [[2, 8], [2, 2], [6, 8], ['red', 8]]) {
    const state = fixture([[2, 11]], [values]);
    cut(state, ['target-0-0', 'target-0-1'], { useDetector: true });
    assert.ok(engine.getPlayerView(state, 'actor').pendingDetector, `target response is required for ${JSON.stringify(values)}`);
    assert.equal(state.currentPlayerId, 'actor');
    assert.equal(state.mistakes, 0);
    assert.equal(wire(state, 'actor-0-0').cut, false);
  }
});

test('Failed detector lets only target choose a non-red clue and moves dial once', () => {
  const state = fixture([[2, 11]], [['red', 6, 8]]);
  use(state, 3);
  cut(state, ['target-0-0', 'target-0-1', 'target-0-2']);
  assert.deepEqual(state.pendingDetector.eligibleWireIds, ['target-0-1', 'target-0-2']);
  rejectsAtomically(state, { type: 'resolve_detector', wireId: 'target-0-0' }, 'target');
  resolve(state, 'target-0-2');
  assert.equal(wire(state, 'target-0-2').hint, 8);
  assert.equal(wire(state, 'target-0-1').hint, null);
  assert.equal(wire(state, 'target-0-0').hint, null);
  assert.equal(state.mistakes, 1);
  assert.equal(wire(state, 'actor-0-0').cut, false);
});

test('Stabilizer protects one turn from red without cutting or giving a red clue', () => {
  const state = fixture([[2, 11]], [['red', 8]]);
  use(state, 9);
  cut(state, ['target-0-0']);
  assert.equal(state.phase, 'playing');
  assert.equal(state.mistakes, 0);
  assert.equal(wire(state, 'target-0-0').cut, false);
  assert.equal(wire(state, 'target-0-0').hint, null);
  assert.equal(state.stabilizerActive, false);
  assert.equal(state.currentPlayerId, 'target');
  assert.equal(equipment(state, 9).used, true);
});

test('Stabilizer reveals a failed blue guess without moving dial and combines with detectors', () => {
  const state = fixture([[2, 11]], [[6, 8]]);
  use(state, 9);
  cut(state, ['target-0-0']);
  assert.equal(wire(state, 'target-0-0').hint, 6);
  assert.equal(state.mistakes, 0);

  const bothRed = fixture([[2, 11]], [['red', 'red']]);
  use(bothRed, 9);
  use(bothRed, 5);
  cut(bothRed, ['target-0-0']);
  assert.equal(bothRed.phase, 'playing');
  assert.equal(bothRed.mistakes, 0);
  assert.equal(bothRed.superDetectorActive, false);
  assert.equal(bothRed.stabilizerActive, false);
  assert.ok(bothRed.players[1].racks[0].wires.every(item => !item.cut && item.hint === null));
});

test('Turn-only equipment cannot be used outside own turn or trap a player without a legal dual cut', () => {
  for (const id of [3, 5, 9]) {
    const state = fixture();
    rejectsAtomically(state, { type: 'equipment', equipmentId: id }, 'target');
    const onlyRed = fixture([['red']], [[2, 6, 8]]);
    rejectsAtomically(onlyRed, { type: 'equipment', equipmentId: id });
  }
  for (const id of [3, 5]) {
    const onlyYellow = fixture([['yellow']], [[2, 6, 8]]);
    rejectsAtomically(onlyYellow, { type: 'equipment', equipmentId: id });
  }
  const tooFewTargets = fixture([[2, 6]], [[2], [8]]);
  rejectsAtomically(tooFewTargets, { type: 'equipment', equipmentId: 3 });
});

test('Equipment unlocks after a pair of its number is cut and cannot be spent twice', () => {
  const state = fixture([[4, 2, 6]], [[4, 8]]);
  state.players[0].racks[0].wires = state.players[0].racks[0].wires.filter(item => !item.id.startsWith('history-4-'));
  equipment(state, 4).unlocked = false;
  rejectsAtomically(state, { type: 'equipment', equipmentId: 4, wireIds: ['actor-0-1'] });
  cut(state, ['target-0-0']);
  assert.equal(equipment(state, 4).unlocked, true);
  use(state, 4, { wireIds: ['actor-0-1'] });
  rejectsAtomically(state, { type: 'equipment', equipmentId: 4, wireIds: ['actor-0-2'] });
});

test('Winning still requires red-only hands to be safely revealed after the final colored pair', () => {
  const state = fixture([[2]], [[2, 'red']]);
  cut(state, ['target-0-0']);
  assert.equal(state.phase, 'playing');
  assert.equal(state.currentPlayerId, 'target');
  assert.equal(state.outcome, null);
  act(state, { type: 'reveal_red' }, 'target');
  assert.equal(state.phase, 'finished');
  assert.equal(state.outcome, 'won');
  assert.equal(state.mistakes, 0);
});

function withRay(state) {
  state.equipment.push({ ...structuredClone(BOMB_BUSTERS_EQUIPMENT.find(e => e.id === 10)), unlocked: true, used: false });
  return state;
}

test('prepared shared devices survive cancellation and invalid declarations without consumption', () => {
  for (const id of [3, 5, 9, 10]) {
    const state = withRay(fixture([[2, 6]], [[2, 6, 8]])); use(state, id);
    assert.equal(equipment(state, id).used, false);
    assert.deepEqual(state.preparedEquipment, [{ equipmentId: id, playerId: 'actor', personal: false }]);
    rejectsAtomically(state, { type: 'dual', ownWireId: 'missing', targetPlayerId: 'target', targetWireIds: ['target-0-0'] });
    act(state, { type: 'cancel_equipment' });
    assert.equal(equipment(state, id).used, false); assert.deepEqual(state.preparedEquipment, []); assert.equal(state.turnNumber, 1);
    use(state, id); assert.equal(equipment(state, id).used, false);
  }
});

test('personal preparation spends only its owner device on a valid declaration', () => {
  for (const id of [3, 10]) {
    const state = withRay(fixture([[2, 6]], [[2, 6, 8]])); state.players[0].personalEquipmentId = id;
    use(state, id, { personal: true });
    assert.equal(state.players[0].detectorUsed, false); assert.equal(equipment(state, id).used, false);
    act(state, { type: 'cancel_equipment' }); assert.equal(state.players[0].detectorUsed, false);
    use(state, id, { personal: true });
    const targets = id === 3 ? ['target-0-0', 'target-0-1', 'target-0-2'] : ['target-0-1'];
    cut(state, targets, id === 10 ? { alternativeWireId: 'actor-0-1' } : {});
    assert.ok(state.pendingDetector); assert.equal(state.players[0].detectorUsed, true);
    assert.equal(equipment(state, id).used, false); assert.deepEqual(state.preparedEquipment, []);
    rejectsAtomically(state, { type: 'cancel_equipment' }); resolve(state, targets[0]);
    assert.equal(state.players[0].detectorUsed, true);
  }
});

test('mixed personal/shared preparation cancels together and spends exactly its recorded sources', () => {
  const state = fixture([[2, 6]], [[2, 6, 8]]); state.players[0].personalEquipmentId = 3;
  use(state, 3, { personal: true }); use(state, 9); act(state, { type: 'cancel_equipment' });
  assert.equal(state.players[0].detectorUsed, false); assert.equal(equipment(state, 9).used, false); assert.deepEqual(state.preparedEquipment, []);
  use(state, 3, { personal: true }); use(state, 9); cut(state, ['target-0-0', 'target-0-1', 'target-0-2']);
  assert.equal(state.players[0].detectorUsed, true); assert.equal(equipment(state, 3).used, false); assert.equal(equipment(state, 9).used, true);
});

for (const detector of ['double', 'triple', 'super']) test(`X/Y plus ${detector} selects either matching value privately`, () => {
  for (const rayFirst of [true, false]) {
    const state = withRay(fixture([[2, 6, 11]], [['red', 2, 6, 8]]));
    const id = detector === 'triple' ? 3 : detector === 'super' ? 5 : null;
    if (rayFirst) use(state, 10); if (id) use(state, id); if (!rayFirst) use(state, 10);
    const targets = detector === 'double' ? ['target-0-1', 'target-0-2'] : detector === 'triple' ? ['target-0-0', 'target-0-1', 'target-0-2'] : ['target-0-0'];
    cut(state, targets, { alternativeWireId: 'actor-0-1', useDetector: detector === 'double' });
    assert.equal(state.pendingDetector.kind, 'xy'); assert.deepEqual(state.pendingDetector.guesses, [2, 6]);
    assert.deepEqual(state.pendingDetector.eligibleWireIds, ['target-0-1', 'target-0-2']);
    assert.equal(equipment(state, 10).used, true); if (id) assert.equal(equipment(state, id).used, true);
    assert.equal(state.players[0].detectorUsed, detector === 'double');
    for (const viewer of ['actor', undefined]) for (const hidden of ['success', 'ownWireId', 'alternativeWireId', 'eligibleWireIds']) assert.equal(engine.getPlayerView(state, viewer).pendingDetector[hidden], undefined);
    resolve(state, 'target-0-2');
    assert.equal(wire(state, 'actor-0-0').cut, false); assert.equal(wire(state, 'actor-0-1').cut, true);
    assert.equal(wire(state, 'target-0-2').cut, true); assert.equal(state.turnNumber, 2);
  }
});

test('failed X/Y detector combinations avoid red and may use stabilizer protection', () => {
  const state = withRay(fixture([[2, 6, 11]], [['red', 8, 9]])); use(state, 3); use(state, 10);
  cut(state, ['target-0-0', 'target-0-1', 'target-0-2'], { alternativeWireId: 'actor-0-1' });
  assert.deepEqual(state.pendingDetector.eligibleWireIds, ['target-0-1', 'target-0-2']);
  rejectsAtomically(state, { type: 'resolve_detector', wireId: 'target-0-0' }, 'target'); resolve(state, 'target-0-1');
  assert.equal(state.mistakes, 1); assert.equal(wire(state, 'target-0-1').hint, 8); assert.equal(wire(state, 'actor-0-1').cut, false);
  const guarded = withRay(fixture([[2, 6]], [['red', 'red']])); use(guarded, 10); use(guarded, 5); use(guarded, 9);
  cut(guarded, ['target-0-0'], { alternativeWireId: 'actor-0-1' });
  assert.equal(guarded.phase, 'playing'); assert.equal(guarded.mistakes, 0);
  for (const id of [10, 5, 9]) assert.equal(equipment(guarded, id).used, true);
});

test('combined guesses must both be blue and multiple detector effects remain prohibited', () => {
  const state = withRay(fixture([[2, 'yellow', 6]], [[2, 6, 8]])); use(state, 10);
  rejectsAtomically(state, { type: 'dual', ownWireId: 'actor-0-0', alternativeWireId: 'actor-0-1', targetPlayerId: 'target', targetWireIds: ['target-0-0', 'target-0-1'], useDetector: true });
  assert.equal(equipment(state, 10).used, false); use(state, 3);
  rejectsAtomically(state, { type: 'equipment', equipmentId: 5 }); rejectsAtomically(state, { type: 'equipment', equipmentId: 10 });
  rejectsAtomically(state, { type: 'dual', ownWireId: 'actor-0-0', alternativeWireId: 'actor-0-2', targetPlayerId: 'target', targetWireIds: ['target-0-0', 'target-0-1', 'target-0-2'], useDetector: true });
  const tooFewBlue = withRay(fixture([[2, 'yellow']], [[2, 6, 8]])); use(tooFewBlue, 10);
  rejectsAtomically(tooFewBlue, { type: 'equipment', equipmentId: 3 });
});

test('prepared device views enumerate only public source fields', () => {
  const state = withRay(fixture()); use(state, 10); state.preparedEquipment[0].secret = 'PRIVATE';
  assert.deepEqual(engine.getPlayerView(state, undefined).preparedEquipment, [{ equipmentId: 10, playerId: 'actor', personal: false }]);
});

test('a mission pass that uses stabilizer protection consumes it and clears the prepared effects', () => {
  const state = fixture([[2, 6]], [[3, 8]]);
  const campaign = engine.initializeGame(['actor', 'target'], [], 44, 'actor');
  state.mission = campaign.mission; state.campaign = campaign.campaign;
  state.campaign.pending = null; state.campaign.setupTasks = [];
  use(state, 9); act(state, { type: 'mission', operation: 'pass' });
  assert.equal(state.mistakes, 0); assert.equal(equipment(state, 9).used, true);
  assert.equal(state.stabilizerActive, false); assert.deepEqual(state.preparedEquipment, []);
  assert.equal(state.currentPlayerId, 'target');
});
