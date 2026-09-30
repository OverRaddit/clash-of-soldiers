const test = require('node:test');
const assert = require('node:assert/strict');
const { GameRoomService } = require('../dist/game-room/game-room.service');
const { GameRoomGateway } = require('../dist/game-room/game-room.gateway');
const { GameRoomController } = require('../dist/game-room/game-room.controller');

function fixture(t, count = 3) {
  const bomb = { getPlayerView: state => state };
  const service = new GameRoomService(bomb);
  const gateway = new GameRoomGateway(service, {}, {}, bomb);
  const controller = new GameRoomController(service, {});
  const messages = [];
  const socket = id => ({ id, join() {}, leave() {}, emit: (event, payload) => {
    messages.push({ recipient: id, event, payload: structuredClone(payload) });
  } });
  gateway.server = { to: id => ({ emit: (event, payload) => {
    messages.push({ recipient: id, event, payload: structuredClone(payload) });
  } }) };
  const room = service.createRoom({ roomName: 'Fellowship', hostId: 'p1', gameType: 'fellowship', maxPlayers: count });
  const sockets = Array.from({ length: count }, (_, i) => socket(`socket-${i + 1}`));
  sockets.forEach((client, i) => gateway.handleJoinRoom(client, {
    roomId: room.id, playerId: `p${i + 1}`, playerName: `Player ${i + 1}`,
    ...(i === 0 ? { sessionToken: service.getInitialPrivateSessionToken(room.id, 'p1') } : {}),
  }));
  sockets.slice(1).forEach((client, i) => gateway.handleToggleReady(client, {
    roomId: room.id, playerId: `p${i + 2}`,
  }));
  const latest = (recipient, event) => messages.filter(message =>
    message.recipient === recipient && message.event === event).at(-1)?.payload;
  t.after(() => { gateway.onModuleDestroy(); service.onModuleDestroy(); });
  return { service, gateway, controller, messages, socket, room, sockets, latest };
}

test('private-game host identity is reserved before the first socket joins', t => {
  const bomb = { getPlayerView: state => state };
  const service = new GameRoomService(bomb);
  const controller = new GameRoomController(service, {});
  t.after(() => service.onModuleDestroy());
  const created = controller.createRoom({ roomName: 'Reserved', hostId: 'host', gameType: 'fellowship', maxPlayers: 2 });
  assert.equal(typeof created.sessionToken, 'string');
  assert.ok(created.sessionToken.length >= 40);
  assert.equal(controller.getRoom(created.data.id).data.sessionToken, undefined);
  assert.throws(() => service.joinSocketRoom({ roomId: created.data.id, playerId: 'host', playerName: 'Impostor' }), /세션/);
  const joined = service.joinSocketRoom({ roomId: created.data.id, playerId: 'host', playerName: 'Host' }, created.sessionToken);
  assert.equal(joined.sessionToken, created.sessionToken);
});

test('Fellowship chapter selection is host-only and resets ready players', t => {
  const { room, gateway, sockets, latest, service } = fixture(t);
  assert.equal(room.maxPlayers, 3);
  assert.equal(service.serializeRoom(room).fellowshipChapters.length, 18);
  gateway.handleSelectFellowshipChapter(sockets[1], { roomId: room.id, playerId: 'p2', chapter: 2 });
  assert.ok(latest(sockets[1].id, 'fellowship_error'));
  assert.equal(room.selectedFellowshipChapter, 1);
  gateway.handleSelectFellowshipChapter(sockets[0], { roomId: room.id, playerId: 'p1', chapter: 2 });
  assert.equal(room.selectedFellowshipChapter, 2);
  assert.ok(room.players.slice(1).every(player => !player.isReady));
  assert.throws(() => service.startGame(room.id, 'p1'), /준비/);
});

test('Fellowship starts with per-recipient hands and public endpoints hide the deal', t => {
  const { room, gateway, sockets, latest, controller, service } = fixture(t);
  gateway.handleStartGame(sockets[0], { roomId: room.id, hostId: 'p1' });
  assert.equal(room.status, 'playing', latest(sockets[0].id, 'start_game_error')?.message);
  assert.equal(room.toJSON().gameState, null);
  const views = sockets.map(socket => latest(socket.id, 'game_started'));
  assert.ok(views.every(Boolean));
  for (let i = 0; i < views.length; i++) {
    assert.deepEqual(views[i].gameState, views[i].room.gameState);
    assert.ok(Array.isArray(views[i].gameState.hand));
    assert.ok(views[i].gameState.hand.length > 0);
    for (let j = 0; j < views.length; j++) {
      if (i === j) continue;
      const privateIds = new Set(views[i].gameState.hand.map(card => card.id));
      const serialized = JSON.stringify(views[j]);
      for (const id of privateIds) assert.ok(!serialized.includes(`"id":"${id}"`), `opponent sees ${id}`);
    }
  }
  const publicRoom = controller.getRoom(room.id).data;
  assert.equal(publicRoom.gameState.hand?.length ?? 0, 0);
  assert.equal(service.serializeRoom(room, 'outsider').gameState.hand?.length ?? 0, 0);
  assert.ok(!JSON.stringify(publicRoom).includes(`"id":"${views[0].gameState.hand[0].id}"`));
});

test('Fellowship session tokens reject impersonation and invalid actions preserve state', t => {
  const { room, gateway, sockets, socket, latest } = fixture(t);
  const token = latest(sockets[1].id, 'join_room_success').sessionToken;
  assert.equal(typeof token, 'string');
  const attacker = socket('attacker');
  gateway.handleJoinRoom(attacker, { roomId: room.id, playerId: 'p2', playerName: 'Impostor' });
  assert.ok(latest(attacker.id, 'join_room_error'));
  gateway.handleStartGame(sockets[0], { roomId: room.id, hostId: 'p1' });
  const before = structuredClone(room.gameState);
  gateway.handleFellowshipAction(attacker, { roomId: room.id, playerId: 'p2', action: { type: 'next_round' } });
  gateway.handleFellowshipAction(sockets[1], { roomId: room.id, playerId: 'p1', action: { type: 'next_round' } });
  gateway.handleFellowshipAction(sockets[0], { roomId: room.id, playerId: 'p1', action: { type: 'unknown' } });
  assert.deepEqual(room.gameState, before);
  assert.ok(latest(attacker.id, 'fellowship_error'));
  assert.ok(latest(sockets[1].id, 'fellowship_error'));
  assert.ok(latest(sockets[0].id, 'fellowship_error'));
  gateway.handleJoinRoom(attacker, { roomId: room.id, playerId: 'p2', playerName: 'Player 2', sessionToken: token });
  assert.ok(latest(attacker.id, 'join_room_success'));
});

test('Fellowship active departure abandons the deal and allows a fresh start', t => {
  const { room, gateway, sockets, latest } = fixture(t);
  gateway.handleStartGame(sockets[0], { roomId: room.id, hostId: 'p1' });
  gateway.handleLeaveRoom(sockets[2], { roomId: room.id, playerId: 'p3' });
  assert.equal(room.status, 'waiting');
  assert.equal(room.gameState, null);
  assert.equal(room.players.length, 2);
  assert.equal(latest(sockets[0].id, 'room_updated').room.gameState, null);
});
