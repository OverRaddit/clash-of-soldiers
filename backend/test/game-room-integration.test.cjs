const test = require('node:test');
const assert = require('node:assert/strict');
const { setTimeout: delay } = require('node:timers/promises');
const { GameRoomService } = require('../dist/game-room/game-room.service');
const { GameRoomGateway } = require('../dist/game-room/game-room.gateway');
const { GameRoomController } = require('../dist/game-room/game-room.controller');

// The engine is isolated here so these tests catch transport/serialization defects,
// independently of the rule engine's own tests.
function fixture(t) {
  const engine = {
    tick(state, now = Date.now()) {
      if (state.phase === 'finished' || !state.deadlineAt || now < state.deadlineAt) return false;
      state.phase = 'finished'; state.log = ['expired']; return true;
    },
    initializeGame(ids, names, missionId = 1) {
      if (missionId !== 1) throw new Error('unsupported mission');
      return {
        phase: 'setup',
        revision: 0,
        secrets: Object.fromEntries(ids.map(id => [id, `PRIVATE-${id}`])),
      };
    },
    getPlayerView(state, viewerId) {
      return { phase: state.phase, revision: state.revision, ownWire: state.secrets[viewerId] ?? null };
    },
    applyAction(state, playerId, action) {
      state.revision += 1;
      if (action.type === 'invalid') throw new Error('invalid action');
      state.phase = action.type === 'finish' ? 'finished' : 'playing';
      return { message: 'accepted' };
    },
  };
  const service = new GameRoomService(engine);
  const gateway = new GameRoomGateway(service, {}, {}, engine);
  const controller = new GameRoomController(service, {});
  const messages = [];
  const record = (recipient, event, payload) => messages.push({ recipient, event, payload: structuredClone(payload) });
  gateway.server = { to: recipient => ({ emit: (event, payload) => record(recipient, event, payload) }) };
  const socket = id => ({ id, join() {}, leave() {}, emit: (event, payload) => record(id, event, payload) });
  const host = socket('socket-host');
  const guest = socket('socket-guest');
  const outsider = socket('socket-outsider');
  const room = service.createRoom({ roomName: 'Bomb room', hostId: 'host', gameType: 'bomb-busters' });
  gateway.handleJoinRoom(host, { roomId: room.id, playerId: 'host', playerName: 'Host',
    sessionToken: service.getInitialPrivateSessionToken(room.id, 'host') });
  gateway.handleJoinRoom(guest, { roomId: room.id, playerId: 'guest', playerName: 'Guest' });
  gateway.handleToggleReady(guest, { roomId: room.id, playerId: 'guest' });
  const start = () => gateway.handleStartGame(host, { roomId: room.id, hostId: 'host', missionId: 1 });
  const latest = (recipient, event) => messages.filter(message => message.recipient === recipient && message.event === event).at(-1)?.payload;
  t.after(() => { gateway.onModuleDestroy(); service.onModuleDestroy(); });
  return { engine, service, gateway, controller, messages, socket, host, guest, outsider, room, start, latest };
}

function assertPrivateView(payload, viewer) {
  const serialized = JSON.stringify(payload);
  assert.ok(!serialized.includes(`PRIVATE-${viewer === 'host' ? 'guest' : 'host'}`), serialized);
  assert.equal(payload.room.gameState.ownWire, `PRIVATE-${viewer}`);
  if (payload.gameState) assert.deepEqual(payload.gameState, payload.room.gameState);
}

test('Bomb room capacity, ready checks, and rejected mission initialization preserve waiting state', t => {
  const { service, room } = fixture(t);
  assert.equal(room.maxPlayers, 5);
  for (const maxPlayers of [1, 6, 2.5]) {
    assert.throws(() => service.createRoom({ roomName: 'Bad', hostId: 'h', gameType: 'bomb-busters', maxPlayers }));
  }
  assert.throws(() => service.startGame(room.id, 'host', 99), /지원하지 않는 미션/);
  assert.equal(room.status, 'waiting');
  assert.equal(room.gameState, null);
  service.toggleReady(room.id, 'guest');
  assert.throws(() => service.startGame(room.id, 'host', 1), /준비/);
  service.toggleReady(room.id, 'guest');
  service.startGame(room.id, 'host', 1);
  assert.throws(() => service.startGame(room.id, 'host', 1), /대기/);
  assert.throws(() => service.toggleReady(room.id, 'guest'), /대기/);
  assert.throws(() => service.joinRoom({ roomId: room.id, playerId: 'new', playerName: 'New' }), /시작/);
});

test('start, room reads, join/reconnect, and lifecycle broadcasts only expose the recipient rack', t => {
  const { room, gateway, host, guest, outsider, latest, start } = fixture(t);
  start();
  assertPrivateView(latest(host.id, 'game_started'), 'host');
  assertPrivateView(latest(guest.id, 'game_started'), 'guest');
  assert.equal(room.toJSON().gameState, null, 'bare serialization must fail closed');

  gateway.handleGetRoomState(host, { roomId: room.id });
  assertPrivateView(latest(host.id, 'room_state'), 'host');
  gateway.handleGetRoomState(outsider, { roomId: room.id });
  assert.ok(latest(outsider.id, 'get_room_state_error'));
  assert.equal(latest(outsider.id, 'room_state'), undefined);

  gateway.handleJoinRoom(guest, { roomId: room.id, playerId: 'guest', playerName: 'Guest' });
  assertPrivateView(latest(guest.id, 'join_room_success'), 'guest');
  assertPrivateView(latest(host.id, 'room_updated'), 'host');
  assertPrivateView(latest(guest.id, 'room_updated'), 'guest');

  gateway.handleDisconnect(guest);
  assertPrivateView(latest(host.id, 'room_updated'), 'host');
});

test('HTTP room paths never expose private racks, including start and existing-player join', t => {
  const { room, controller, service, latest, host } = fixture(t);
  const token = latest(host.id, 'join_room_success').sessionToken;
  assert.throws(() => controller.startGame(room.id, { hostId: 'host', missionId: 1 }));
  assert.throws(() => controller.toggleReady(room.id, 'guest'));
  assert.throws(() => controller.leaveRoom(room.id, 'guest'));
  assert.throws(() => controller.joinRoom(room.id, { playerId: 'host', playerName: 'Impostor' }));
  const started = controller.startGame(room.id, { hostId: 'host', missionId: 1 }, token);
  const responses = [
    started,
    controller.getRoom(room.id),
    controller.joinRoom(room.id, { playerId: 'host', playerName: 'Host' }, token),
    controller.getAllRooms(),
  ];
  for (const response of responses) {
    assert.ok(!JSON.stringify(response).includes('PRIVATE-'));
  }
  assert.equal(started.data.gameState.ownWire, null);
  assert.equal(service.serializeRoom(room, 'nonmember').gameState.ownWire, null);
  assert.throws(() => controller.drawSoldiers(room.id, { playerId: 'host' }));
  assert.throws(() => controller.placeSoldier(room.id, { playerId: 'host', soldierIndex: 0, targetVertex: 'A' }));
  assert.equal(room.gameState.phase, 'setup');
});

test('socket-bound actor validation rejects impersonation and old-game actions', t => {
  const { room, gateway, host, guest, outsider, latest, start } = fixture(t);
  gateway.handleStartGame(guest, { roomId: room.id, hostId: 'host' });
  assert.equal(room.status, 'waiting');
  assert.ok(latest(guest.id, 'start_game_error'));
  start();
  const original = structuredClone(room.gameState);
  gateway.handleBombBustersAction(guest, { roomId: room.id, playerId: 'host', action: { type: 'hint' } });
  gateway.handleBombBustersAction(outsider, { roomId: room.id, playerId: 'host', action: { type: 'hint' } });
  gateway.handleDrawSoldiers(host, { roomId: room.id, playerId: 'host' });
  gateway.handleKrakenSelectCard(host, { roomId: room.id, playerId: 'host', targetPlayerId: 'guest', cardIndex: 0 });
  gateway.handleReturnToRoom(guest, { roomId: room.id, playerId: 'host' });
  gateway.handleLeaveRoom(outsider, { roomId: room.id, playerId: 'host' });
  assert.deepEqual(room.gameState, original);
  assert.equal(room.players.length, 2);
  assert.ok(latest(guest.id, 'bomb_busters_error'));
  assert.ok(latest(outsider.id, 'bomb_busters_error'));
  assert.ok(latest(host.id, 'draw_soldiers_error'));
  assert.ok(latest(host.id, 'kraken_error'));
});

test('Bomb session tokens prevent public-player-ID impersonation and never enter shared room payloads', t => {
  const { room, gateway, host, guest, outsider, service, latest, messages, start } = fixture(t);
  const token = latest(guest.id, 'join_room_success').sessionToken;
  assert.equal(typeof token, 'string');
  assert.ok(token.length >= 40);
  start();
  gateway.handleJoinRoom(outsider, { roomId: room.id, playerId: 'guest', playerName: 'Impostor' });
  assert.ok(latest(outsider.id, 'join_room_error'));
  assert.equal(latest(outsider.id, 'join_room_success'), undefined);
  assert.equal(room.players.find(player => player.id === 'guest').name, 'Guest');
  gateway.handleJoinRoom(outsider, { roomId: room.id, playerId: 'guest', playerName: 'Impostor', sessionToken: 'wrong' });
  assert.equal(latest(outsider.id, 'join_room_success'), undefined);
  for (const message of messages.filter(message => message.recipient !== guest.id)) {
    assert.ok(!JSON.stringify(message.payload).includes(token));
  }
  gateway.handleReturnToRoom(host, { roomId: room.id, playerId: 'host' });
  gateway.handleJoinRoom(outsider, { roomId: room.id, playerId: 'guest', playerName: 'Guest', sessionToken: token });
  assert.equal(latest(outsider.id, 'join_room_success').sessionToken, token);
  service.leaveRoom(room.id, 'guest');
  const newlyJoined = service.joinSocketRoom({ roomId: room.id, playerId: 'guest', playerName: 'Guest' });
  assert.notEqual(newlyJoined.sessionToken, token, 'leaving revokes the old session');
});

test('Bomb action commits are atomic and personalized through game end and return to room', t => {
  const { room, gateway, host, guest, latest, start } = fixture(t);
  start();
  gateway.handleBombBustersAction(host, { roomId: room.id, playerId: 'host', action: { type: 'invalid' } });
  assert.equal(room.gameState.revision, 0, 'mutation before an engine exception must not leak into room state');
  gateway.handleBombBustersAction(host, { roomId: room.id, playerId: 'host', action: { type: 'hint' } });
  assert.equal(room.gameState.revision, 1);
  assertPrivateView(latest(host.id, 'bomb_busters_state_updated'), 'host');
  assertPrivateView(latest(guest.id, 'bomb_busters_state_updated'), 'guest');
  gateway.handleBombBustersAction(host, { roomId: room.id, playerId: 'host', action: { type: 'finish' } });
  assert.equal(room.status, 'finished');
  assertPrivateView(latest(host.id, 'game_ended'), 'host');
  assertPrivateView(latest(guest.id, 'game_ended'), 'guest');
  gateway.handleReturnToRoom(host, { roomId: room.id, playerId: 'host' });
  assert.equal(room.status, 'waiting');
  assert.equal(room.gameState, null);
  assert.equal(room.players.find(player => player.id === 'guest').isReady, false);
  assert.equal(latest(guest.id, 'room_updated').type, 'returned_to_room');
});

test('revoked sockets never regain views or disconnect a new session that reuses the same public player ID', async t => {
  const { room, gateway, service, guest, socket, latest, start } = fixture(t);
  gateway.reconnectTimeout = 10;
  service.leaveRoom(room.id, 'guest');
  const replacement = socket('replacement-guest');
  gateway.handleJoinRoom(replacement, { roomId: room.id, playerId: 'guest', playerName: 'Replacement' });
  gateway.handleToggleReady(replacement, { roomId: room.id, playerId: 'guest' });
  start();
  assert.ok(latest(replacement.id, 'game_started'));
  assert.equal(latest(guest.id, 'game_started'), undefined);
  gateway.handleGetRoomState(guest, { roomId: room.id });
  assert.ok(latest(guest.id, 'get_room_state_error'));
  assert.equal(latest(guest.id, 'room_state'), undefined);
  gateway.handleJoinRoom(guest, { roomId: room.id, playerId: 'guest', playerName: 'Old session' });
  assert.ok(latest(guest.id, 'join_room_error'));
  assert.equal(room.players.find(player => player.id === 'guest').name, 'Replacement');
  gateway.handleDisconnect(guest);
  await delay(20);
  assert.equal(room.status, 'playing');
  assert.equal(room.players.length, 2);
});

test('reconnect cancels stale removal, while a timed-out active player returns everyone to the lobby', async t => {
  const { room, gateway, host, guest, socket, latest, start } = fixture(t);
  gateway.reconnectTimeout = 15;
  start();
  gateway.handleDisconnect(guest);
  const reconnected = socket('socket-reconnected');
  gateway.handleJoinRoom(reconnected, { roomId: room.id, playerId: 'guest', playerName: 'Guest',
    sessionToken: latest(guest.id, 'join_room_success').sessionToken });
  assertPrivateView(latest(reconnected.id, 'join_room_success'), 'guest');
  await delay(30);
  assert.equal(room.status, 'playing');
  assert.equal(room.players.length, 2);
  gateway.handleDisconnect(reconnected);
  await delay(30);
  assert.equal(room.status, 'waiting');
  assert.equal(room.gameState, null);
  assert.deepEqual(room.players.map(player => player.id), ['host']);
  assert.equal(latest(host.id, 'room_updated').room.gameState, null);
});

test('another open tab prevents disconnect removal; explicit active leave resets the cooperative deal', async t => {
  const { room, gateway, service, host, guest, socket, latest, start } = fixture(t);
  gateway.reconnectTimeout = 10;
  start();
  const guestTab = socket('socket-guest-tab');
  gateway.handleJoinRoom(guestTab, { roomId: room.id, playerId: 'guest', playerName: 'Guest',
    sessionToken: latest(guest.id, 'join_room_success').sessionToken });
  gateway.handleDisconnect(guest);
  await delay(20);
  assert.equal(room.status, 'playing');
  assert.equal(room.players.length, 2);
  gateway.handleLeaveRoom(host, { roomId: room.id, playerId: 'host' });
  assert.equal(room.status, 'waiting');
  assert.equal(room.gameState, null);
  assert.equal(room.hostId, 'guest');
  assert.equal(room.players[0].isHost, true);
  assert.equal(service.getRoom(room.id), room);
});

test('server shutdown does not schedule new reconnect timers while the socket adapter closes', t => {
  const { room, gateway, guest, start } = fixture(t);
  start();
  gateway.onModuleDestroy();
  gateway.handleDisconnect(guest);
  assert.equal(gateway.disconnectedClients.size, 0);
  assert.equal(room.status, 'playing');
});

test('only bound host changes mission, catalog is shared, and selection resets readiness', t => {
  const {service,gateway,room,host,guest,outsider,latest}=fixture(t);
  assert.ok(service.serializeRoom(room).bombMissions.some(m=>m.id===8));
  assert.equal(room.selectedMissionId,1);
  gateway.handleSelectBombMission(guest,{roomId:room.id,playerId:'guest',missionId:2});
  assert.ok(latest(guest.id,'bomb_busters_error'));assert.equal(room.selectedMissionId,1);
  gateway.handleSelectBombMission(outsider,{roomId:room.id,playerId:'host',missionId:2});
  assert.ok(latest(outsider.id,'bomb_busters_error'));assert.equal(room.selectedMissionId,1);
  gateway.handleSelectBombMission(host,{roomId:room.id,playerId:'host',missionId:2});
  assert.equal(room.selectedMissionId,2);assert.equal(room.players[1].isReady,false);
  assert.equal(latest(guest.id,'room_updated').room.selectedMissionId,2);
  assert.throws(()=>service.startGame(room.id,'host',2),/준비/);
  gateway.handleToggleReady(guest,{roomId:room.id,playerId:'guest'});
  assert.throws(()=>service.startGame(room.id,'host',3),/먼저 선택/);
  service.selectBombMission(room.id,'host',1);service.toggleReady(room.id,'guest');
  service.startGame(room.id,'host');
  assert.throws(()=>service.selectBombMission(room.id,'host',2),/대기/);
});

test('next mission rotates the captain after returning to the lobby', t => {
  const {service,room}=fixture(t);
  room.status='finished';room.gameState={captainId:'host'};
  service.resetRoom(room.id);
  assert.equal(room.nextBombCaptainId,'guest');
  assert.equal(room.status,'waiting');assert.equal(room.gameState,null);
  assert.equal(service.serializeRoom(room).nextBombCaptainId,undefined);
});

test('lobby catalog previews the actual player-count setup and still exposes minimum-player limits', t=>{
 const {service,room}=fixture(t);
 let catalog=service.serializeRoom(room).bombMissions;
 assert.equal(catalog.find(m=>m.id===4).yellowCount,4);
 assert.equal(catalog.find(m=>m.id===34).minPlayers,3);
 assert.equal(catalog.find(m=>m.id===41).yellowCount,2);
 service.joinRoom({roomId:room.id,playerId:'third',playerName:'Third'});
 catalog=service.serializeRoom(room).bombMissions;
 assert.equal(catalog.find(m=>m.id===4).yellowCount,2);
 assert.equal(catalog.find(m=>m.id===41).yellowCount,3);
});

test('server clock ends a timed mission without player actions and keeps personalized views', async t => {
  const { gateway, service, room, start, host, guest, latest } = fixture(t);
  start();
  room.gameState.deadlineAt = Date.now() - 1;
  assert.deepEqual(service.getActiveBombRooms().map(r => r.id), [room.id]);
  gateway.onModuleInit();
  await delay(350);
  assert.equal(room.status, 'finished');
  assert.equal(service.getActiveBombRooms().length, 0);
  assertPrivateView(latest(host.id, 'game_ended'), 'host');
  assertPrivateView(latest(guest.id, 'game_ended'), 'guest');
});

test('deadline wins over an arriving action and leaves the expired state committed', t => {
  const { gateway, room, start, host, latest } = fixture(t);
  start(); room.gameState.deadlineAt = Date.now() - 1;
  gateway.handleBombBustersAction(host, { roomId: room.id, playerId: 'host', action: { type: 'hint' } });
  assert.equal(room.status, 'finished');
  assert.equal(room.gameState.revision, 0);
  assert.equal(room.gameState.phase, 'finished');
  assert.ok(latest(host.id, 'game_ended'));
  assert.ok(latest(host.id, 'bomb_busters_error'));
});

test('destroying gateway clears the clock before its next interval', async t => {
  const { gateway, room, start, messages } = fixture(t);
  start(); room.gameState.deadlineAt = Date.now() - 1;
  gateway.onModuleInit(); gateway.onModuleDestroy();
  await delay(300);
  assert.equal(room.status, 'playing');
  assert.ok(!messages.some(m => m.event === 'game_ended'));
});
