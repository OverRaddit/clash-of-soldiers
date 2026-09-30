// Run from backend: npm run test:socket
// Prerequisites: npm ci in both backend and frontend; this reuses the frontend's
// socket.io-client dependency and starts its own ephemeral localhost Nest server.
require('reflect-metadata');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const { NestFactory } = require('@nestjs/core');
const { ValidationPipe } = require('@nestjs/common');
const { io } = require('../../frontend/node_modules/socket.io-client');
const { AppModule } = require('../dist/app.module');

const errors = ['join_room_error', 'start_game_error', 'toggle_ready_error', 'leave_room_error',
  'get_room_state_error', 'bomb_busters_error', 'fellowship_error', 'kraken_error', 'connect_error'];
const trackedEvents = ['join_room_success', 'room_updated', 'room_state', 'game_started', 'bomb_busters_state_updated', 'fellowship_state_updated', 'game_ended'];
const connections = new Set();
const privacyFailures = [];
let baseUrl;

function waitFor(socket, successes, rejected = errors) {
  const events = Array.isArray(successes) ? successes : [successes];
  return new Promise((resolve, reject) => {
    const listeners = [];
    const cleanup = () => { clearTimeout(timer); listeners.forEach(([event, handler]) => socket.off(event, handler)); };
    const timer = setTimeout(() => {
      cleanup();
      reject(new Error(`Socket ${socket.id} timed out waiting for ${events.join(' or ')}`));
    }, 5000);
    for (const event of new Set([...events, ...rejected])) {
      const handler = payload => {
        cleanup();
        if (events.includes(event)) resolve({ event, payload });
        else reject(new Error(`${event}: ${payload?.message || payload}`));
      };
      listeners.push([event, handler]);
      socket.on(event, handler);
    }
  });
}

async function request(client, event, payload, resultEvent, rejected = errors) {
  const response = waitFor(client.socket, resultEvent, rejected);
  client.socket.emit(event, payload);
  return (await response).payload;
}

function verifyView(state, viewerId) {
  if (!state || !state.mission || state.phase === 'finished') return;
  for (const player of state.players) {
    for (const wire of player.racks.flatMap(rack => rack.wires)) {
      if (wire.cut || (viewerId && (wire.reversed ? player.id !== viewerId : player.id === viewerId))) {
        assert.notEqual(wire.value, null);
      } else {
        assert.equal(wire.value, null, `uncut ${player.id} wire exposed to ${viewerId || 'HTTP visitor'}`);
        assert.equal(wire.sortValue, null, 'hidden sort value exposed');
      }
    }
  }
  if (state.pendingDetector && state.pendingDetector.targetPlayerId !== viewerId) {
    assert.equal(state.pendingDetector.eligibleWireIds, undefined);
    assert.equal(state.pendingDetector.success, undefined);
    assert.equal(state.pendingDetector.ownWireId, undefined);
  }
}

async function connect(playerId = randomUUID()) {
  const client = { playerId, socket: io(`${baseUrl}/game`, {
    autoConnect: false, forceNew: true, reconnection: false, transports: ['websocket'],
  }), view: null, room: null, token: undefined };
  connections.add(client.socket);
  for (const event of trackedEvents) {
    client.socket.on(event, payload => {
      if (payload.room) client.room = payload.room;
      if (payload.sessionToken) client.token = payload.sessionToken;
      if (payload.gameState || payload.room) {
        client.view = payload.gameState ?? payload.room?.gameState ?? null;
        try {
          verifyView(client.view, client.playerId);
          if (payload.room?.gameState) verifyView(payload.room.gameState, client.playerId);
        } catch (error) { privacyFailures.push(`${event}: ${error.message}`); }
      }
    });
  }
  const connected = waitFor(client.socket, 'connect');
  client.socket.connect();
  await connected;
  return client;
}

async function json(path, method = 'GET', body, sessionToken) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { 'Content-Type': 'application/json', ...(sessionToken ? { 'x-game-session': sessionToken } : {}) },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  return { status: response.status, body: await response.json() };
}

async function broadcast(clients, sender, event, payload, expected) {
  const pending = clients.map(client => waitFor(client.socket, expected));
  sender.socket.emit(event, payload);
  const responses = await Promise.all(pending);
  assert.deepEqual(privacyFailures, []);
  return responses;
}

async function createGame(gameType, playerCount) {
  const clients = await Promise.all(Array.from({ length: playerCount }, () => connect()));
  const created = await json('/game-rooms', 'POST', {
    roomName: `Socket E2E ${gameType} ${playerCount}`, hostId: clients[0].playerId, maxPlayers: playerCount, gameType,
  });
  assert.equal(created.status, 201);
  assert.equal(created.body.success, true);
  const roomId = created.body.data.id;
  if (created.body.sessionToken) clients[0].token = created.body.sessionToken;
  for (const [index, client] of clients.entries()) {
    await request(client, 'join_room', { roomId, playerId: client.playerId, playerName: `Tester ${index + 1}`,
      ...(client.token ? { sessionToken: client.token } : {}) }, 'join_room_success');
  }
  for (const client of clients.slice(1)) {
    await broadcast(clients, client, 'toggle_ready', { roomId, playerId: client.playerId }, 'room_updated');
  }
  return { clients, roomId };
}

async function cleanRoom(clients, roomId) {
  for (const client of [...clients].reverse()) {
    await request(client, 'leave_room', { roomId, playerId: client.playerId }, 'leave_room_success');
    client.socket.disconnect();
  }
}

function ownWires(client) {
  return client.view.players.find(player => player.id === client.playerId).racks.flatMap(rack => rack.wires).filter(wire => !wire.cut);
}

async function bombScenario(playerCount, missionId) {
  const { clients, roomId } = await createGame('bomb-busters', playerCount);
  if (missionId !== clients[0].room.selectedMissionId) {
    await broadcast(clients, clients[0], 'select_bomb_mission', { roomId, playerId: clients[0].playerId, missionId }, 'room_updated');
    assert.ok(clients.every(client => client.room.selectedMissionId === missionId));
    for (const client of clients.slice(1)) {
      assert.equal(client.room.players.find(p => p.id === client.playerId).isReady, false);
      await broadcast(clients, client, 'toggle_ready', { roomId, playerId: client.playerId }, 'room_updated');
    }
  }
  await broadcast(clients, clients[0], 'start_game', { roomId, hostId: clients[0].playerId, missionId }, 'game_started');
  assert.equal(clients[0].view.mission.id, missionId);
  assert.equal(clients[0].view.maxMistakes, playerCount);
  const selected = clients[0].view.mission;
  const expectedWires = selected.blueMax * 4 + selected.redCount + selected.yellowCount;
  assert.equal(clients.reduce((sum, client) => sum + ownWires(client).length, 0), expectedWires);
  assert.ok(clients.every(client => typeof client.token === 'string' && client.token.length >= 40));
  const publicRoom = await json(`/game-rooms/${roomId}`);
  assert.equal(publicRoom.status, 200);
  verifyView(publicRoom.body.data.gameState);
  const unauthorizedLeave = await json(`/game-rooms/${roomId}/leave/${clients[0].playerId}`, 'DELETE');
  assert.equal(unauthorizedLeave.status, 400);

  const outsider = await connect();
  await request(outsider, 'join_room', {
    roomId, playerId: clients[1].playerId, playerName: 'Impostor',
  }, 'join_room_error');
  await request(outsider, 'get_room_state', { roomId }, 'get_room_state_error');
  await request(outsider, 'bomb_busters_action', {
    roomId, playerId: clients[0].playerId, action: { type: 'hint', wireId: ownWires(clients[0])[0].id },
  }, 'bomb_busters_error');
  assert.equal(outsider.view, null);
  outsider.socket.disconnect();

  const previous = clients[1];
  const previousOwnWires = ownWires(previous);
  previous.socket.disconnect();
  const reconnected = await connect(previous.playerId);
  await request(reconnected, 'join_room', {
    roomId, playerId: previous.playerId, playerName: 'Tester 2', sessionToken: previous.token,
  }, 'join_room_success');
  assert.equal(reconnected.token, previous.token);
  assert.deepEqual(ownWires(reconnected), previousOwnWires);
  clients[1] = reconnected;
  await request(reconnected, 'get_room_state', { roomId }, 'room_state');
  assert.equal(reconnected.room.status, 'playing');

  let actions = 0;
  let solos = 0;
  let duals = 0;
  let reveals = 0;
  while (clients[0].view.phase !== 'finished') {
    const state = clients[0].view;
    const actor = clients.find(client => client.playerId === state.currentPlayerId);
    const own = ownWires(actor);
    let action;
    if (state.phase === 'setup') {
      const blue = own.find(wire => typeof wire.value === 'number');
      assert.ok(blue, 'each player must have a blue wire available for their initial clue');
      action = { type: 'hint', wireId: blue.id };
    } else if (own.every(wire => wire.value === 'red')) {
      action = { type: 'reveal_red' };
      reveals++;
    } else {
      const chosen = own.find(wire => wire.value !== 'red');
      // The test oracle combines each client's own visible rack. No server-private
      // engine state or service instance is used to solve the randomized deal.
      const partner = clients.filter(client => client !== actor).find(client => ownWires(client).some(wire => wire.value === chosen.value));
      if (partner) {
        action = { type: 'dual', ownWireId: chosen.id, targetPlayerId: partner.playerId,
          targetWireIds: [ownWires(partner).find(wire => wire.value === chosen.value).id] };
        duals++;
      } else {
        action = { type: 'solo', value: chosen.value };
        solos++;
      }
    }
    await broadcast(clients, actor, 'bomb_busters_action', { roomId, playerId: actor.playerId, action },
      ['bomb_busters_state_updated', 'game_ended']);
    assert.ok(++actions < 100, 'solver made no progress');
  }
  assert.ok(clients.every(client => client.view.outcome === 'won' && client.room.status === 'finished'));
  assert.ok(clients.every(client => client.view.mistakes === 0));
  if (missionId === 0) assert.ok(reveals > 0, 'the colored mission must safely reveal remaining red wires');
  await broadcast(clients, clients[0], 'return_to_room', { roomId, playerId: clients[0].playerId }, 'room_updated');
  assert.ok(clients.every(client => client.room.status === 'waiting' && client.view === null));
  assert.ok(clients[0].room.players.slice(1).every(player => !player.isReady));
  await cleanRoom(clients, roomId);
  console.log(`PASS Bomb Busters ${playerCount} players / mission ${missionId}: ${actions} actions (${duals} dual, ${solos} solo, ${reveals} red reveal), privacy, reconnect, win, lobby`);
}

async function legacyScenario(gameType, count) {
  const { clients, roomId } = await createGame(gameType, count);
  await broadcast(clients, clients[0], 'start_game', { roomId, hostId: clients[0].playerId }, 'game_started');
  assert.ok(clients.every(client => client.room.status === 'playing' && client.room.gameType === gameType));
  if (gameType === 'toy-battle') {
    assert.equal(clients[0].view.players.length, 2);
    assert.ok(clients[0].view.currentTurn);
  } else {
    assert.ok(clients.every(client => ['explorer', 'skeleton'].includes(client.view.myRole)));
    assert.ok(clients.every(client => client.view.otherPlayers.length === count - 1));
    assert.ok(clients.every(client => client.view.otherPlayers.every(player => !('role' in player))));
  }
  const read = await json(`/game-rooms/${roomId}`);
  assert.equal(read.status, 200);
  assert.equal(read.body.data.gameType, gameType);
  await broadcast(clients, clients[0], 'return_to_room', { roomId, playerId: clients[0].playerId }, 'room_updated');
  await cleanRoom(clients, roomId);
  console.log(`PASS Existing ${gameType}: ${count} clients create/join/ready/start/HTTP read/return/leave`);
}

async function fellowshipScenario() {
  const { clients, roomId } = await createGame('fellowship', 3);
  assert.equal(clients[0].room.fellowshipChapters.length, 18);
  await broadcast(clients, clients[0], 'start_game', { roomId, hostId: clients[0].playerId }, 'game_started');
  const initial = clients.map(client => structuredClone(client.view));
  assert.ok(clients.every(client => client.room.status === 'playing' && client.view.phase === 'character_selection'));
  for (let i = 0; i < clients.length; i++) {
    assert.ok(initial[i].hand.length > 0);
    for (let j = 0; j < clients.length; j++) {
      if (i === j) continue;
      const otherView = JSON.stringify(initial[j]);
      for (const card of initial[i].hand) assert.ok(!otherView.includes(`"id":"${card.id}"`), `private ${card.id} leaked`);
    }
  }
  const publicRoom = await json(`/game-rooms/${roomId}`);
  assert.equal(publicRoom.status, 200);
  const serializedPublic = JSON.stringify(publicRoom.body.data);
  for (const card of initial[0].hand) assert.ok(!serializedPublic.includes(`"id":"${card.id}"`));
  const ringHolderSeatId = initial[0].ringHolderSeatId;
  const ringHolder = clients.find(client => client.playerId === ringHolderSeatId);
  assert.ok(ringHolder);
  await broadcast(clients, ringHolder, 'fellowship_action', {
    roomId, playerId: ringHolder.playerId, action: { type: 'select_character', characterId: 'frodo' },
  }, 'fellowship_state_updated');
  assert.equal(clients[0].view.players.find(player => player.id === ringHolderSeatId).characterId, 'frodo');
  const impostor = await connect(clients[1].playerId);
  const rejected = await request(impostor, 'join_room', { roomId, playerId: clients[1].playerId, playerName: 'Impostor' }, 'join_room_error', []);
  assert.ok(rejected.message);
  impostor.socket.disconnect();
  await broadcast(clients, clients[0], 'return_to_room', { roomId, playerId: clients[0].playerId }, 'room_updated');
  assert.ok(clients.every(client => client.room.status === 'waiting'));
  await cleanRoom(clients, roomId);
  console.log('PASS Fellowship: 3 clients, private deal, character action, HTTP privacy, session token, lobby');
}

async function campaignSetupScenario(missionId) {
  const { clients, roomId } = await createGame('bomb-busters', 3);
  await broadcast(clients,clients[0],'select_bomb_mission',{roomId,playerId:clients[0].playerId,missionId},'room_updated');
  for(const client of clients.slice(1)) await broadcast(clients,client,'toggle_ready',{roomId,playerId:client.playerId},'room_updated');
  await broadcast(clients,clients[0],'start_game',{roomId,hostId:clients[0].playerId,missionId},'game_started');
  for(let step=0;clients[0].view.phase==='setup'&&step<50;step++) {
    const shared=clients[0].view;
    const pending=shared.campaign?.pendingActorId;
    const actor=clients.find(c=>c.playerId===(pending&&pending!=='any'?pending:shared.currentPlayerId));
    const view=actor.view;const own=view.players.find(p=>p.id===actor.playerId);
    const control=view.campaign?.controls?.[0];let action;
    if(control) {
      action={type:'mission',operation:control.id};
      if(control.cards?.length) action.cardId=control.cards[0].id;
      if(control.directions?.length) action.direction=control.directions[0];
      if(control.id==='false_hint') {
        const wire=ownWires(actor).find(w=>typeof w.value==='number'&&!w.clue&&!w.excluded&&!w.reversed);
        action.wireIds=[wire.id];action.value=wire.value===1?2:1;
      } else if(control.id==='absent_hint') {
        const rack=own.racks.find(r=>r.id===control.rackIds[0]);action.rackId=rack.id;
        const key=own.racks.length===1?actor.playerId:rack.id;const used=(view.campaign?.cards||[]).filter(c=>c.id.startsWith(`absent-${key}-`)).map(c=>c.label.split(' ')[0]);
        action.value=[1,2,3,4,5,6,7,8,9,10,11,12,'yellow'].find(value=>!rack.wires.some(w=>w.value===value)&&!used.includes(value==='yellow'?'노랑':String(value)));
      }
    } else {
      const target=Number(view.campaign?.cards.find(c=>c.id==='target')?.label.match(/\d+/)?.[0]);
      const wire=ownWires(actor).find(w=>typeof w.value==='number'&&!w.excluded&&!w.reversed&&w.value!==target);
      assert.ok(wire,`mission ${missionId} visible initial clue`);action={type:'hint',wireId:wire.id};
    }
    await broadcast(clients,actor,'bomb_busters_action',{roomId,playerId:actor.playerId,action},'bomb_busters_state_updated');
  }
  assert.equal(clients[0].view.phase,'playing',`mission ${missionId} setup completed`);
  const publicRoom=await json(`/game-rooms/${roomId}`);verifyView(publicRoom.body.data.gameState);
  assert.equal(publicRoom.body.data.gameState.campaign?.secretRoleId,undefined);
  const previous=clients[1];const ownBefore=structuredClone(previous.view.players.find(p=>p.id===previous.playerId));
  previous.socket.disconnect();const reconnected=await connect(previous.playerId);
  await request(reconnected,'join_room',{roomId,playerId:previous.playerId,playerName:'Tester 2',sessionToken:previous.token},'join_room_success');
  clients[1]=reconnected;
  assert.deepEqual(reconnected.view.players.find(p=>p.id===previous.playerId),ownBefore);
  await broadcast(clients,clients[0],'return_to_room',{roomId,playerId:clients[0].playerId},'room_updated');
  await cleanRoom(clients,roomId);
  console.log(`PASS campaign ${missionId}: host selection, 3-player setup choices, public/private HTTP/socket views, reconnect, lobby`);
}

(async () => {
  const app = await NestFactory.create(AppModule, { logger: false });
  app.useGlobalPipes(new ValidationPipe());
  try {
    await app.listen(0, '127.0.0.1');
    baseUrl = `http://127.0.0.1:${app.getHttpServer().address().port}`;
    let scenarios=0;
    if(process.env.FELLOWSHIP_ONLY) {
      await fellowshipScenario(); scenarios++;
    } else if(!process.env.CAMPAIGN_ONLY) {
      for (let players = 2; players <= 5; players++) {
        for (let missionId = 0; missionId <= 8; missionId++) { await bombScenario(players, missionId); scenarios++; }
      }
      await legacyScenario('toy-battle', 2);await legacyScenario('no-touch-kraken', 3);scenarios+=2;
      await fellowshipScenario(); scenarios++;
    }
    if(!process.env.TRAINING_ONLY && !process.env.FELLOWSHIP_ONLY) for(let id=9;id<=66;id++) {
      if(process.env.NON_AUDIO_ONLY&&[19,30,42,54,66].includes(id))continue;
      await campaignSetupScenario(id);scenarios++;
    }
    assert.deepEqual(privacyFailures, []);
    console.log(`PASS all ${scenarios} real HTTP/WebSocket end-to-end scenarios`);
  } finally {
    for (const socket of connections) socket.disconnect();
    await app.close();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
