const test = require('node:test');
const assert = require('node:assert/strict');
const { BombBustersLogicService } = require('../dist/game-room/bomb-busters-logic.service');

const engine = new BombBustersLogicService();
const allWires = player => player.racks.flatMap(rack => rack.wires);
const wireAt = (state, playerIndex, wireIndex = 0, rackIndex = 0) => state.players[playerIndex].racks[rackIndex].wires[wireIndex];

function deal(layout, overrides = {}) {
  const ids = layout.map((_, index) => `player-${index}`);
  const state = engine.initializeGame(ids, ids, 1);
  state.players.forEach((player, playerIndex) => {
    player.initialHintPlaced = true;
    player.racks = layout[playerIndex].map((values, rackIndex) => ({
      id: `rack-${playerIndex}-${rackIndex}`,
      wires: values.map((input, wireIndex) => {
        const value = typeof input === 'object' ? input.value : input;
        return {
          id: `wire-${playerIndex}-${rackIndex}-${wireIndex}`,
          value,
          sortValue: typeof value === 'number' ? value : wireIndex + (value === 'red' ? 1.5 : 1.1),
          cut: false,
          hint: null,
          ...(typeof input === 'object' ? input : {}),
        };
      }),
    }));
  });
  return Object.assign(state, { phase: 'playing', captainId: ids[0], currentPlayerId: ids[0], log: [] }, overrides);
}

function act(state, action, playerIndex = 0) {
  return engine.applyAction(state, state.players[playerIndex].id, action);
}

function dual(state, ownIndex, targetIndex, options = {}) {
  return {
    type: 'dual',
    ownWireId: wireAt(state, 0, ownIndex).id,
    targetPlayerId: state.players[1].id,
    targetWireIds: [wireAt(state, 1, targetIndex).id],
    ...options,
  };
}

function rejectsUnchanged(state, action, playerIndex = 0) {
  const before = structuredClone(state);
  assert.throws(() => act(state, action, playerIndex));
  assert.deepEqual(state, before, 'rejected action changed the live state');
}

test('mission 1 deals four copies of 1–6, sorted racks, private random IDs, and the proper 2–5 player setup', () => {
  for (let count = 2; count <= 5; count++) {
    const ids = Array.from({ length: count }, (_, index) => `p${index}`);
    const state = engine.initializeGame(ids, ids, 1);
    assert.equal(state.phase, 'setup');
    assert.equal(state.currentPlayerId, state.captainId);
    assert.equal(state.maxMistakes, count);
    assert.equal(state.players.length, count);
    const wires = state.players.flatMap(allWires);
    assert.equal(wires.length, 24);
    assert.equal(new Set(wires.map(wire => wire.id)).size, 24);
    for (let value = 1; value <= 6; value++) assert.equal(wires.filter(wire => wire.value === value).length, 4);
    for (const player of state.players) {
      const expectedRacks = count === 2 || (count === 3 && player.id === state.captainId) ? 2 : 1;
      assert.equal(player.racks.length, expectedRacks);
      for (const rack of player.racks) {
        assert.deepEqual(rack.wires.map(wire => wire.sortValue), rack.wires.map(wire => wire.sortValue).sort((a, b) => a - b));
      }
    }
    const rackSizes = state.players.flatMap(player => player.racks.map(rack => rack.wires.length));
    assert.ok(Math.max(...rackSizes) - Math.min(...rackSizes) <= 1);
    const firstView = engine.getPlayerView(state, ids[0]);
    for (const player of firstView.players) {
      assert.ok(allWires(player).every(wire => player.id === ids[0]
        ? typeof wire.value === 'number' && typeof wire.sortValue === 'number'
        : wire.value === null && wire.sortValue === null));
    }
    assert.ok(engine.getPlayerView(state).players.flatMap(allWires).every(wire => wire.value === null && wire.sortValue === null));
  }
  assert.throws(() => engine.initializeGame(['a'], ['A']));
  assert.throws(() => engine.initializeGame(['a', 'a'], ['A', 'A']));
  assert.throws(() => engine.initializeGame(['a', 'b', 'c', 'd', 'e', 'f'], []));
  assert.throws(() => engine.initializeGame(['a', 'b'], [], 999));
});

test('captain-led setup places one truthful blue clue per player and returns the turn to the captain', () => {
  const state = engine.initializeGame(['a', 'b', 'c'], ['A', 'B', 'C']);
  const captainId = state.captainId;
  for (let index = 0; index < state.players.length; index++) {
    const currentIndex = state.players.findIndex(player => player.id === state.currentPlayerId);
    const currentPlayer = state.players[currentIndex];
    const wire = allWires(currentPlayer)[0];
    rejectsUnchanged(state, { type: 'solo', value: wire.value }, currentIndex);
    rejectsUnchanged(state, { type: 'hint', wireId: wire.id }, (currentIndex + 1) % state.players.length);
    act(state, { type: 'hint', wireId: wire.id }, currentIndex);
    assert.equal(allWires(state.players[currentIndex]).find(candidate => candidate.id === wire.id).hint, wire.value);
    assert.equal(state.players[currentIndex].initialHintPlaced, true);
  }
  assert.equal(state.phase, 'playing');
  assert.equal(state.currentPlayerId, captainId);
  rejectsUnchanged(state, { type: 'hint', wireId: allWires(state.players[0])[0].id }, 0);
  const colored = deal([[['yellow', 'red']], [[1, 1]]], { phase: 'setup' });
  colored.players[0].initialHintPlaced = false;
  rejectsUnchanged(colored, { type: 'hint', wireId: wireAt(colored, 0).id });
});

test('dual success cuts a matching pair; failure only publishes the target clue without exposing the acting wire', () => {
  const success = deal([[[1, 2]], [[1, 3]]]);
  act(success, dual(success, 0, 0));
  assert.equal(wireAt(success, 0).cut, true);
  assert.equal(wireAt(success, 1).cut, true);
  assert.equal(success.currentPlayerId, success.players[1].id);
  assert.equal(success.mistakes, 0);
  assert.equal(engine.getPlayerView(success).cutCounts['1'], 2);

  const failed = deal([[[1, 3]], [[2, 4]]]);
  act(failed, dual(failed, 0, 0));
  assert.equal(failed.mistakes, 1);
  assert.equal(wireAt(failed, 0).hint, null);
  assert.equal(wireAt(failed, 1).hint, 2);
  assert.ok(failed.players.flatMap(allWires).every(wire => !wire.cut));
  const targetView = engine.getPlayerView(failed, failed.players[1].id);
  assert.equal(wireAt(targetView, 0).value, null);
  assert.equal(wireAt(targetView, 0).sortValue, null);
  const actorView = engine.getPlayerView(failed, failed.players[0].id);
  assert.equal(wireAt(actorView, 1).value, null);
  assert.equal(wireAt(actorView, 1).hint, 2);
});

test('solo requires every remaining copy, allows two or four across own racks, and yellow wires pair despite sort values', () => {
  const incomplete = deal([[[1, 1]], [[1, 1]]]);
  rejectsUnchanged(incomplete, { type: 'solo', value: 1 });
  const four = deal([[[1, 1], [1, 1, 2]], [[2, 2, 2]]]);
  act(four, { type: 'solo', value: 1 });
  assert.equal(allWires(four.players[0]).filter(wire => wire.cut).length, 4);
  const two = deal([[[1, 1, 2]], [[{ value: 1, cut: true }, { value: 1, cut: true }, 3]]]);
  act(two, { type: 'solo', value: 1 });
  assert.equal(engine.getPlayerView(two).cutCounts['1'], 4);
  const yellow = deal([[['yellow', 1]], [[2, 'yellow']]]);
  assert.notEqual(wireAt(yellow, 0).sortValue, wireAt(yellow, 1, 1).sortValue);
  act(yellow, dual(yellow, 0, 1));
  assert.equal(wireAt(yellow, 0).cut, true);
  assert.equal(wireAt(yellow, 1, 1).cut, true);
  const yellowSolo = deal([[['yellow', 'yellow', 1]], [[2, 2]]]);
  act(yellowSolo, { type: 'solo', value: 'yellow' });
  assert.equal(engine.getPlayerView(yellowSolo).cutCounts.yellow, 2);
});

test('red cuts and dial exhaustion lose; safe reveal only works when every remaining own wire is red', () => {
  const red = deal([[[1, 2]], [['red', 3]]]);
  act(red, dual(red, 0, 0));
  assert.equal(red.phase, 'finished');
  assert.equal(red.outcome, 'lost');
  assert.equal(wireAt(red, 1).cut, true);
  const dial = deal([[[1, 3]], [[2, 4]]], { mistakes: 1, maxMistakes: 2 });
  act(dial, dual(dial, 0, 0));
  assert.equal(dial.outcome, 'lost');
  assert.equal(dial.mistakes, 2);
  const unsafe = deal([[['red', 1]], [[2, 3]]]);
  rejectsUnchanged(unsafe, { type: 'reveal_red' });
  rejectsUnchanged(unsafe, { type: 'solo', value: 'red' });
  rejectsUnchanged(unsafe, dual(unsafe, 0, 0));
  const safe = deal([[['red', 'red']], [[2, 2]]]);
  act(safe, { type: 'reveal_red' });
  assert.ok(allWires(safe.players[0]).every(wire => wire.cut));
  assert.equal(safe.phase, 'playing');
  assert.equal(safe.mistakes, 0);
  assert.equal(safe.currentPlayerId, safe.players[1].id);
});

test('detector succeeds safely with one matching wire and loses only when both selected wires are red', () => {
  const success = deal([[[1, 2]], [[1, 'red', 3]]]);
  act(success, dual(success, 0, 0, { useDetector: true, targetWireIds: [wireAt(success, 1).id, wireAt(success, 1, 1).id] }));
  assert.equal(success.players[0].detectorUsed, true);
  assert.ok(success.pendingDetector);
  act(success, { type: 'resolve_detector', wireId: wireAt(success, 1).id }, 1);
  assert.equal(success.pendingDetector, null);
  assert.equal(wireAt(success, 1).cut, true);
  assert.equal(wireAt(success, 1, 1).cut, false);
  assert.equal(success.phase, 'playing');
  const red = deal([[[1, 2]], [['red', 'red', 3]]]);
  act(red, dual(red, 0, 0, { useDetector: true, targetWireIds: [wireAt(red, 1).id, wireAt(red, 1, 1).id] }));
  assert.equal(red.outcome, 'lost');
  assert.equal(red.pendingDetector, null);
  assert.equal(red.players[0].detectorUsed, true);
  const safeFailure = deal([[[1, 2]], [['red', 3, 4]]]);
  act(safeFailure, dual(safeFailure, 0, 0, { useDetector: true, targetWireIds: [wireAt(safeFailure, 1).id, wireAt(safeFailure, 1, 1).id] }));
  assert.ok(safeFailure.pendingDetector);
  act(safeFailure, { type: 'resolve_detector', wireId: wireAt(safeFailure, 1, 1).id }, 1);
  assert.equal(safeFailure.phase, 'playing');
  assert.equal(safeFailure.mistakes, 1);
  assert.equal(wireAt(safeFailure, 1, 1).hint, 3);
  assert.equal(wireAt(safeFailure, 1).hint, null);
});

test('one or two detector matches expose the same public pending payload until the target responds', () => {
  const oneMatch = deal([[[1, 2]], [[1, 'red', 3]]]);
  const twoMatches = deal([[[1, 2]], [[1, 1, 3]]]);
  for (const state of [oneMatch, twoMatches]) {
    act(state, dual(state, 0, 0, { useDetector: true,
      targetWireIds: [wireAt(state, 1).id, wireAt(state, 1, 1).id] }));
    assert.ok(state.pendingDetector);
    assert.equal(state.turnNumber, 1);
    assert.equal(state.mistakes, 0);
    assert.ok(state.players.flatMap(allWires).every(wire => !wire.cut));
  }
  assert.deepEqual(engine.getPlayerView(oneMatch, oneMatch.players[0].id).pendingDetector,
    engine.getPlayerView(twoMatches, twoMatches.players[0].id).pendingDetector);
});

test('detector target chooses either matching wire; only its owner receives eligible choices, and result advances once', () => {
  const state = deal([[[1, 2]], [[1, 1, 3]]]);
  const firstId = wireAt(state, 1).id;
  const secondId = wireAt(state, 1, 1).id;
  act(state, dual(state, 0, 0, { useDetector: true, targetWireIds: [firstId, secondId] }));
  assert.ok(state.pendingDetector);
  assert.equal(state.currentPlayerId, state.players[0].id);
  assert.equal(state.turnNumber, 1);
  for (const viewerId of [undefined, state.players[0].id]) {
    const pending = engine.getPlayerView(state, viewerId).pendingDetector;
    assert.equal(pending.eligibleWireIds, undefined);
    assert.equal(pending.ownWireId, undefined);
    assert.equal(pending.success, undefined);
  }
  assert.deepEqual(engine.getPlayerView(state, state.players[1].id).pendingDetector.eligibleWireIds, [firstId, secondId]);
  rejectsUnchanged(state, { type: 'resolve_detector', wireId: secondId });
  rejectsUnchanged(state, { type: 'resolve_detector', wireId: wireAt(state, 1, 2).id }, 1);
  rejectsUnchanged(state, { type: 'solo', value: 1 }, 1);
  act(state, { type: 'resolve_detector', wireId: secondId }, 1);
  assert.equal(wireAt(state, 0).cut, true);
  assert.equal(wireAt(state, 1).cut, false);
  assert.equal(wireAt(state, 1, 1).cut, true);
  assert.equal(state.pendingDetector, null);
  assert.equal(state.turnNumber, 2);
  assert.equal(state.currentPlayerId, state.players[1].id);
});

test('failed detector permits the target to choose a truthful clue without cutting or revealing the acting rack', () => {
  const state = deal([[[1, 4]], [[2, 3, 4]]]);
  const secondId = wireAt(state, 1, 1).id;
  act(state, dual(state, 0, 0, { useDetector: true, targetWireIds: [wireAt(state, 1).id, secondId] }));
  assert.ok(state.pendingDetector);
  assert.equal(state.mistakes, 0);
  act(state, { type: 'resolve_detector', wireId: secondId }, 1);
  assert.equal(state.mistakes, 1);
  assert.equal(wireAt(state, 1, 1).hint, 3);
  assert.ok(state.players.flatMap(allWires).every(wire => !wire.cut));
  assert.equal(wireAt(engine.getPlayerView(state, state.players[1].id), 0).value, null);
  assert.equal(wireAt(engine.getPlayerView(state, state.players[1].id), 0).hint, null);
});

test('malformed, repeated, cross-rack detector, own-target, nonmember, and out-of-turn actions cannot mutate state', () => {
  const state = deal([[[1, 2]], [[1, 3], [2, 3]]]);
  const normal = dual(state, 0, 0);
  rejectsUnchanged(state, normal, 1);
  rejectsUnchanged(state, { ...normal, targetPlayerId: state.players[0].id });
  rejectsUnchanged(state, { ...normal, ownWireId: 'missing' });
  rejectsUnchanged(state, { ...normal, targetWireIds: [] });
  rejectsUnchanged(state, { ...normal, useDetector: true, targetWireIds: [wireAt(state, 1).id, wireAt(state, 1).id] });
  rejectsUnchanged(state, { ...normal, useDetector: true, targetWireIds: [wireAt(state, 1).id, wireAt(state, 1, 0, 1).id] });
  rejectsUnchanged(state, { type: 'unknown' });
  rejectsUnchanged(state, null);
  const before = structuredClone(state);
  assert.throws(() => engine.applyAction(state, 'nonmember', normal));
  assert.deepEqual(state, before);
  state.players[0].detectorUsed = true;
  rejectsUnchanged(state, { ...normal, useDetector: true, targetWireIds: [wireAt(state, 1).id, wireAt(state, 1, 1).id] });
  act(state, normal);
  state.currentPlayerId = state.players[0].id;
  rejectsUnchanged(state, normal);
});

test('empty players are skipped and clearing the last remaining pair wins with no further actions', () => {
  const skip = deal([[[1, 3]], [[1]], [[2, 2]]]);
  act(skip, dual(skip, 0, 0));
  assert.equal(skip.currentPlayerId, skip.players[2].id);
  const win = deal([[[1]], [[1]]]);
  act(win, dual(win, 0, 0));
  assert.equal(win.phase, 'finished');
  assert.equal(win.outcome, 'won');
  assert.match(win.endReason, /해체/);
  rejectsUnchanged(win, { type: 'solo', value: 1 });
  assert.ok(engine.getPlayerView(win).players.flatMap(allWires).every(wire => wire.value !== null));
});
