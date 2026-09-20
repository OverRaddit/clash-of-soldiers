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
