const test = require('node:test');
const assert = require('node:assert/strict');
const { BombBustersLogicService, BOMB_BUSTERS_EQUIPMENT } = require('../dist/game-room/bomb-busters-logic.service');
const engine = new BombBustersLogicService();
const wires = player => player.racks.flatMap(rack => rack.wires);
const act = (state, action, player = 'p0') => engine.applyAction(state, player, action);
const dual = (state, own, targets, extra = {}, player = 'p0') => act(state, {
  type: 'dual', ownWireId: own, targetPlayerId: targets[0].slice(0, 2), targetWireIds: targets, ...extra,
}, player);
function fixture(mission = 0, layout = [[2, 4, 8], [2, 3, 9], [4, 5, 10]], gear = []) {
  const ids = layout.map((_, i) => `p${i}`);
  const state = engine.initializeGame(ids, ids, mission, 'p0');
  state.players.forEach((player, i) => {
    player.initialHintPlaced = true;
    player.detectorUsed = false;
    player.personalEquipmentId = 0;
    player.racks = [{ id: `r${i}`, wires: layout[i].map((value, j) => ({
      id: `p${i}-${j}`, value, sortValue: typeof value === 'number' ? value : 5.5, cut: false, hint: null,
    })) }];
  });
  Object.assign(state, { phase: 'playing', currentPlayerId: 'p0', mistakes: 0, equipment: gear.map(id => ({
    ...structuredClone(BOMB_BUSTERS_EQUIPMENT.find(card => card.id === id)), unlocked: true, used: false,
  })) });
  if (state.campaign) Object.assign(state.campaign, { pending: null, setupTasks: [], turn: null, history: [], requiredValue: null });
  return state;
}

test('feedback is absent during initial clues, equipment preparation and a normal exchange', () => {
  const setup = engine.initializeGame(['p0', 'p1'], ['p0', 'p1'], 1, 'p0');
  while (setup.phase === 'setup') {
    const player = setup.players.find(p => p.id === setup.currentPlayerId);
    act(setup, { type: 'hint', wireId: wires(player)[0].id }, player.id);
    assert.equal(setup.feedback, undefined);
  }
  const state = fixture(0, undefined, [9, 2]);
  act(state, { type: 'equipment', equipmentId: 9 });
  assert.equal(state.feedback, undefined);
  act(state, { type: 'cancel_equipment' });
  act(state, { type: 'equipment', equipmentId: 2, targetPlayerId: 'p1' });
  act(state, { type: 'exchange_wire', wireId: 'p0-0' });
  assert.equal(state.feedback, undefined);
  act(state, { type: 'exchange_wire', wireId: 'p1-0' }, 'p1');
  assert.equal(state.feedback, undefined);
});

test('committed cuts produce fresh IDs and the public feedback contains no private detail', () => {
  const state = fixture();
  dual(state, 'p0-0', ['p1-0']);
  const success = structuredClone(state.feedback);
  assert.equal(success.kind, 'success');
  assert.match(success.id, /^[0-9a-f-]{36}$/i);
  state.feedback.secretWireId = 'PRIVATE';
  for (const viewer of ['p0', 'p1', undefined]) assert.deepEqual(engine.getPlayerView(state, viewer).feedback, success);
  dual(state, 'p1-1', ['p2-1'], {}, 'p1');
  assert.equal(state.feedback.kind, 'failure');
  assert.notEqual(state.feedback.id, success.id);
  assert.deepEqual(Object.keys(state.feedback).sort(), ['id', 'kind']);
});

test('detector requests preserve old feedback until the owner confirms a success', () => {
  const state = fixture();
  state.feedback = { id: 'previous-result', kind: 'failure' };
  dual(state, 'p0-0', ['p1-0', 'p1-1'], { useDetector: true });
  assert.ok(state.pendingDetector);
  assert.deepEqual(state.feedback, { id: 'previous-result', kind: 'failure' });
  act(state, { type: 'resolve_detector', wireId: 'p1-0' }, 'p1');
  assert.equal(state.feedback.kind, 'success');
  assert.notEqual(state.feedback.id, 'previous-result');
});

test('a stabilized detector failure emits failure only after owner confirmation', () => {
  const state = fixture(0, [[2, 7], [3, 4, 8], [5, 6]]);
  state.stabilizerActive = true;
  dual(state, 'p0-0', ['p1-0', 'p1-1'], { useDetector: true });
  assert.equal(state.feedback, undefined);
  act(state, { type: 'resolve_detector', wireId: 'p1-0' }, 'p1');
  assert.equal(state.mistakes, 0);
  assert.equal(state.feedback.kind, 'failure');
});

test('stabilizer prevention is still a confirmed failure without dial movement', () => {
  const state = fixture(0, [[2, 7], ['red', 4], [5, 6]]);
  state.stabilizerActive = true;
  dual(state, 'p0-0', ['p1-0']);
  assert.equal(state.phase, 'playing');
  assert.equal(state.mistakes, 0);
  assert.equal(state.feedback.kind, 'failure');
});

test('nano failures emit failure although the ordinary mistake counter stays zero', () => {
  const state = fixture(53, [[2, 7], [3, 4], [5, 6]]);
  dual(state, 'p0-0', ['p1-0']);
  assert.equal(state.mistakes, 0);
  assert.equal(state.campaign.nano.position, 2);
  assert.equal(state.feedback.kind, 'failure');
});

test('solo success and a fatal red cut report their resolved result, with failure taking priority', () => {
  const solo = fixture(0, [[2, 2, 7], [3, 4], [5, 6]]);
  act(solo, { type: 'solo', value: 2 });
  assert.equal(solo.feedback.kind, 'success');
  const fatal = fixture(0, [[2, 7], ['red', 4], [5, 6]]);
  dual(fatal, 'p0-0', ['p1-0']);
  assert.equal(wires(fatal.players[1])[0].cut, true);
  assert.equal(fatal.outcome, 'lost');
  assert.equal(fatal.feedback.kind, 'failure');
});

test('rejected actions and repeated snapshots never replace a committed feedback ID', () => {
  const state = fixture(53);
  dual(state, 'p0-0', ['p1-0']);
  const result = structuredClone(state.feedback);
  assert.throws(() => dual(state, 'missing', ['p2-0'], {}, 'p1'));
  assert.deepEqual(state.feedback, result);
  state.campaign.flashClues = [{ wireId: 'p0-1', clue: { kind: 'value', value: 4 }, expiresAt: 1 }];
  assert.equal(engine.tick(state, 2), true);
  assert.equal(engine.tick(state, 3), false);
  assert.deepEqual(state.feedback, result);
  assert.deepEqual(engine.getPlayerView(state, 'p0').feedback, result);
  assert.deepEqual(engine.getPlayerView(state, 'p0').feedback, result);
});

test('lastTurn identifies only the new successful pair and survives preparation, cancellation and reconnect', () => {
  const state = fixture(0, undefined, [9]);
  wires(state.players[2])[2].cut = true;
  dual(state, 'p0-0', ['p1-0']);
  const expected = { cutWireIds: ['p0-0', 'p1-0'], clueWireIds: [] };
  assert.deepEqual(state.lastTurn, expected);
  act(state, { type: 'equipment', equipmentId: 9 }, 'p1');
  assert.deepEqual(state.lastTurn, expected);
  act(state, { type: 'cancel_equipment' }, 'p1');
  assert.deepEqual(state.lastTurn, expected);
  assert.throws(() => dual(state, 'missing', ['p2-0'], {}, 'p1'));
  assert.deepEqual(state.lastTurn, expected);
  state.lastTurn.privateValue = 'DO NOT SERIALIZE';
  for (const viewer of ['p0', 'p1', undefined]) {
    assert.deepEqual(engine.getPlayerView(state, viewer).lastTurn, expected);
    assert.deepEqual(engine.getPlayerView(structuredClone(state), viewer).lastTurn, expected);
  }
});

test('a failed turn replaces success highlights and records an identical clue placed again', () => {
  const state = fixture();
  dual(state, 'p0-0', ['p1-0']);
  const target = wires(state.players[2])[1];
  target.hint = 5; target.clue = { kind: 'value', value: 5 };
  dual(state, 'p1-1', ['p2-1'], {}, 'p1');
  const expected = { cutWireIds: [], clueWireIds: ['p2-1'] };
  assert.deepEqual(state.lastTurn, expected);
  for (const viewer of ['p0', 'p1', undefined]) assert.deepEqual(engine.getPlayerView(state, viewer).lastTurn, expected);
});

test('pending detector preserves lastTurn and highlights only the confirmed failure clue', () => {
  const state = fixture(0, [[2, 7], [3, 4, 8], [5, 6]]);
  const previous = { cutWireIds: [], clueWireIds: ['p2-0'] };
  state.lastTurn = structuredClone(previous); wires(state.players[2])[0].hint = 5;
  dual(state, 'p0-0', ['p1-0', 'p1-1'], { useDetector: true });
  assert.deepEqual(state.lastTurn, previous);
  for (const viewer of ['p0', 'p1', undefined]) assert.deepEqual(engine.getPlayerView(state, viewer).lastTurn, previous);
  act(state, { type: 'resolve_detector', wireId: 'p1-1' }, 'p1');
  assert.deepEqual(state.lastTurn, { cutWireIds: [], clueWireIds: ['p1-1'] });
  assert.equal(wires(state.players[1])[0].hint, null);
});

test('detector success and solo include only actually cut wires, while a fatal red hit has no green highlight', () => {
  const detector = fixture();
  dual(detector, 'p0-0', ['p1-0', 'p1-1'], { useDetector: true });
  assert.equal(detector.lastTurn, undefined);
  act(detector, { type: 'resolve_detector', wireId: 'p1-0' }, 'p1');
  assert.deepEqual(detector.lastTurn, { cutWireIds: ['p0-0', 'p1-0'], clueWireIds: [] });
  const solo = fixture(0, [[2, 2, 7], [3, 4], [5, 6]]);
  act(solo, { type: 'solo', value: 2 });
  assert.deepEqual(solo.lastTurn, { cutWireIds: ['p0-0', 'p0-1'], clueWireIds: [] });
  const fatal = fixture(0, [[2, 7], ['red', 4], [5, 6]]);
  dual(fatal, 'p0-0', ['p1-0']);
  assert.equal(fatal.outcome, 'lost');
  assert.deepEqual(fatal.lastTurn, { cutWireIds: [], clueWireIds: [] });
});

test('no-clue failures never identify candidates, even if an older clue is already present', () => {
  for (const mission of [21, 58]) {
    const state = fixture(mission, [[2, 7], [3, 4], [5, 6]]);
    if (mission === 21) state.campaign.constraints.p1 = 'H';
    wires(state.players[1])[0].hint = 3;
    state.lastTurn = { cutWireIds: [], clueWireIds: ['p1-1'] };
    dual(state, 'p0-0', ['p1-0']);
    assert.deepEqual(state.lastTurn, { cutWireIds: [], clueWireIds: [] });
  }
  const stable = fixture(0, [[2, 7], ['red', 4], [5, 6]]);
  stable.stabilizerActive = true;
  dual(stable, 'p0-0', ['p1-0']);
  assert.deepEqual(stable.lastTurn, { cutWireIds: [], clueWireIds: [] });
});

test('public parity, count and negative clues are highlighted without disclosing an exact hidden value', () => {
  for (const [mission, kind] of [[21, 'parity'], [24, 'count'], [52, 'not']]) {
    const state = fixture(mission, [[2, 7], [3, 4], [5, 6]]);
    dual(state, 'p0-0', ['p1-0']);
    const view = engine.getPlayerView(state, 'p0');
    const target = wires(view.players[1])[0];
    assert.equal(target.value, null);
    assert.equal(target.clue.kind, kind);
    assert.deepEqual(view.lastTurn, { cutWireIds: [], clueWireIds: ['p1-0'] });
  }
});

test('a memory clue highlights only while its public position flash remains visible', () => {
  const state = fixture(50, [[2, 7], [3, 4], [5, 6]]);
  dual(state, 'p0-0', ['p1-0']);
  const recorded = { cutWireIds: [], clueWireIds: ['p1-0'] };
  assert.deepEqual(state.lastTurn, recorded);
  assert.deepEqual(engine.getPlayerView(state, 'p0').lastTurn, recorded);
  state.campaign.flashClues.forEach(clue => { clue.expiresAt = 1; });
  for (const viewer of ['p0', 'p1', undefined]) assert.deepEqual(engine.getPlayerView(state, viewer).lastTurn, { cutWireIds: [], clueWireIds: [] });
  const feedback = structuredClone(state.feedback);
  engine.tick(state, 2);
  assert.deepEqual(state.lastTurn, recorded);
  assert.deepEqual(state.feedback, feedback);
});

test('passing or consuming a coffee turn clears both last-turn highlights', () => {
  for (const state of [fixture(44), fixture(0, undefined, [11])]) {
    state.lastTurn = { cutWireIds: ['old-cut'], clueWireIds: ['old-clue'] };
    if (state.mission.id === 44) act(state, { type: 'mission', operation: 'pass' });
    else act(state, { type: 'equipment', equipmentId: 11, targetPlayerId: 'p1' });
    assert.equal(state.turnNumber, 2);
    assert.deepEqual(state.lastTurn, { cutWireIds: [], clueWireIds: [] });
  }
});

test('special yellow failures highlight each clue actually placed', () => {
  const state = fixture(48, [[2, 7], ['yellow', 4], [5, 6]]);
  act(state, { type: 'mission', operation: 'triple_yellow', wireIds: ['p0-0', 'p1-0', 'p2-0'] });
  assert.deepEqual(state.lastTurn, { cutWireIds: [], clueWireIds: ['p0-0', 'p1-0', 'p2-0'] });
  for (const viewer of ['p0', undefined]) assert.deepEqual(engine.getPlayerView(state, viewer).lastTurn, state.lastTurn);
});

function bunkerFixture(layout) {
  const state = fixture(66, layout);
  act(state, { type: 'mission', operation: 'audio_start' });
  return state;
}

test('bunker movement after a resolved cut preserves its highlights rather than creating an empty turn', () => {
  const state = bunkerFixture([[1, 4, 8], [1, 3, 9], [4, 5, 10]]);
  state.audio.bunker.constraints = { north: 'E', east: 'A', south: 'B', west: 'D', action: 'C' };
  dual(state, 'p0-0', ['p1-0']);
  assert.equal(state.audio.pending.kind, 'move');
  const result = structuredClone(state.lastTurn);
  assert.deepEqual(result, { cutWireIds: ['p0-0', 'p1-0'], clueWireIds: [] });
  act(state, { type: 'mission', operation: 'audio_move', direction: 'south' });
  assert.equal(state.turnNumber, 2);
  assert.deepEqual(state.lastTurn, result);
});

test('laser failures wait for the chosen clue and never highlight both pending candidates', () => {
  const state = bunkerFixture([[2, 7], [3, 4], [5, 6]]);
  Object.assign(state.audio.bunker, { floor: 'basement', position: [3, 2], stage: 'disable_laser' });
  const previous = { cutWireIds: [], clueWireIds: [] };
  state.lastTurn = structuredClone(previous);
  act(state, { type: 'mission', operation: 'audio_laser', wireIds: ['p1-0', 'p2-0'] });
  assert.equal(state.audio.pending.kind, 'laser_hint');
  assert.deepEqual(state.lastTurn, previous);
  act(state, { type: 'mission', operation: 'audio_laser_hint', cardId: 'p2-0' });
  assert.deepEqual(state.lastTurn, { cutWireIds: [], clueWireIds: ['p2-0'] });
  assert.equal(wires(state.players[1])[0].hint, null);
});

test('audio concealment and removed wires cannot be recovered through lastTurn', () => {
  const state = fixture(42);
  const cut = wires(state.players[0])[0], clue = wires(state.players[1])[0];
  cut.cut = true; clue.hint = clue.value;
  state.lastTurn = { cutWireIds: [cut.id], clueWireIds: [clue.id] };
  state.audio.status = 'paused'; state.audio.pending = { kind: 'magician', actorId: 'p0' };
  for (const viewer of ['p1', undefined, 'outsider']) assert.deepEqual(engine.getPlayerView(state, viewer).lastTurn, { cutWireIds: [], clueWireIds: [] });
  assert.deepEqual(engine.getPlayerView(state, 'p0').lastTurn, state.lastTurn);
  state.audio.pending = null; state.audio.removedCutWireIds = [cut.id];
  assert.deepEqual(engine.getPlayerView(state, 'p0').lastTurn, { cutWireIds: [], clueWireIds: [clue.id] });
  clue.hint = null;
  assert.deepEqual(engine.getPlayerView(state, 'p1').lastTurn, { cutWireIds: [], clueWireIds: [] });
});
