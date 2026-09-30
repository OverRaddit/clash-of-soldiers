const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initializeFellowshipGame,
  applyFellowshipAction,
  getFellowshipPlayerView,
} = require('../dist/game-room/fellowship/engine.js');

function ids(count) { return Array.from({ length: count }, (_, i) => `player-${i + 1}`); }
function act(state, seatId, action) {
  return applyFellowshipAction(state, state.seats.find(s => s.id === seatId).controllerId, action);
}
function toPlay(chapter, count, seed = 1000, eventId, groupId) {
  const players = ids(count);
  let state = initializeFellowshipGame(players, players, chapter, seed);
  for (let steps = 0; state.phase !== 'play' && steps < 180; steps++) {
    const pending = state.pendingAction;
    assert.ok(pending, `chapter ${chapter}, phase ${state.phase} needs a pending action`);
    const actor = state.seats.find(s => s.id === pending.seatId).controllerId;
    const view = getFellowshipPlayerView(state, actor);
    let action;
    if (pending.type === 'choose_event') action = { type:'choose_event', eventId:eventId || pending.options[0].id };
    else if (pending.type === 'choose_group') action = { type:'choose_group', groupId:groupId || pending.options[0].id };
    else if (pending.type === 'select_character') action = { type:'select_character', characterId:pending.options[0].id };
    else if (['simultaneous_exchange','donate_right','long_dark_return'].includes(pending.type)) {
      const offered = view.offerableCardsBySeat[pending.seatId];
      action = { type:'setup_choice', cardsBySeat:Object.fromEntries(pending.targetSeatIds.map((target, index) => [target,offered[index]])) };
    } else if (pending.type === 'exchange_start') {
      action = { type:'setup_choice', choiceId:pending.options[0].id, cardId:view.offerableCardsBySeat[pending.seatId][0] };
    } else if (['exchange_return','donate','tuck_card','precommit_last_card','preplay_first_card'].includes(pending.type)) {
      action = { type:'setup_choice', cardId:view.offerableCardsBySeat[pending.seatId][0] };
    } else action = { type:'setup_choice', choiceId:pending.options[0].id };
    state = applyFellowshipAction(state, actor, action);
  }
  assert.equal(state.phase, 'play', `chapter ${chapter} did not reach play`);
  return state;
}
function finishOneRound(initial) {
  let state = initial;
  for (let i = 0; state.phase === 'play' && i < 180; i++) {
    if (state.pendingAction?.type === 'gift_save') {
      state = act(state, state.pendingAction.seatId, {type:'use_gift',accept:true});
      continue;
    }
    const seat = state.seats.find(s => s.id === state.currentTurn);
    const view = getFellowshipPlayerView(state, seat.controllerId);
    const cardId = view.legalCardsBySeat[seat.id][0];
    assert.ok(cardId, `no legal card for ${seat.id} in chapter ${state.chapterNumber}`);
    state = act(state, seat.id, {type:'play_card',cardId,trump:cardId === 'rings-1'});
  }
  assert.notEqual(state.phase, 'play');
  return state;
}

test('all 18 chapters can complete a legal initial round at every player count', () => {
  for (let chapter = 1; chapter <= 18; chapter++) for (let count = 1; count <= 4; count++) {
    const state = finishOneRound(toPlay(chapter,count,chapter * 100 + count));
    assert.ok(['round_end','chapter_complete'].includes(state.phase), `chapter ${chapter}, ${count} players`);
    assert.ok(state.result?.message);
  }
});

test('special decks and two-player pyramids use their chapter-specific sizes', () => {
  for (const [chapter, expectedPyramid, expectedLost] of [[1,12,1],[5,9,2],[6,9,0],[17,14,1],[18,14,1]]) {
    const state = initializeFellowshipGame(ids(2),ids(2),chapter,chapter);
    assert.equal(state.pyramid.length, expectedPyramid, `chapter ${chapter} pyramid`);
    assert.equal(state.lostCards.length, expectedLost, `chapter ${chapter} lost`);
  }
  const bridge = initializeFellowshipGame(ids(3),ids(3),14,707);
  bridge.completedEvents = ['doors_of_durin','balins_tomb','long_dark'];
  const selected = act(bridge,bridge.pendingAction.seatId,{type:'choose_event',eventId:'bridge_of_khazad_dum'});
  assert.equal(selected.eventDeck.length,9);
  assert.equal(selected.lostCards.length,2);
  assert.equal(selected.deck.length,0);
  assert.equal(selected.seats[0].hand.length,9);
});

test('solo exposes four hands; chapter 16 keeps Frodo with the One Ring', () => {
  const state = toPlay(16,1,811);
  const frodo = state.seats.find(s => s.characterId === 'frodo');
  assert.ok(frodo.hand.some(c => c.id === 'rings-1'));
  const view = getFellowshipPlayerView(state,'player-1');
  assert.equal(Object.keys(view.handsBySeat).length,4);
  assert.ok(state.seats.every(s => view.handsBySeat[s.id].length > 0));
});

test('solo may exchange with a non-Frodo target and that target chooses the return card', () => {
  let state = initializeFellowshipGame(ids(1), ids(1), 2, 882);
  const others = ['sam', 'merry', 'pippin'];
  while (state.phase === 'character_selection') {
    const pending = state.pendingAction;
    const characterId = pending.seatId === state.ringHolderSeatId ? 'frodo' : others.shift();
    assert.ok(pending.options.some(option => option.id === characterId));
    state = act(state, pending.seatId, { type: 'select_character', characterId });
  }
  const frodo = state.seats.find(s => s.characterId === 'frodo');
  const sam = state.seats.find(s => s.characterId === 'sam');
  const merry = state.seats.find(s => s.characterId === 'merry');
  assert.equal(state.pendingAction.type, 'choose_solo_exchanger');
  state = act(state, state.pendingAction.seatId, { type: 'setup_choice', choiceId: sam.id });
  assert.equal(state.soloExchangeActor, sam.id);
  assert.equal(state.pendingAction.type, 'exchange_start');
  assert.equal(state.pendingAction.seatId, sam.id);
  assert.ok(state.pendingAction.options.find(option => option.id === merry.id).label.includes('메리'));
  const frodoCards = frodo.hand.map(card => card.id);
  const sentCardId = sam.hand[0].id;
  const returnCardId = merry.hand[0].id;
  state = act(state, sam.id, { type: 'setup_choice', targetSeatId: merry.id, cardId: sentCardId });
  assert.equal(state.pendingAction.type, 'exchange_return');
  assert.equal(state.pendingAction.seatId, merry.id);
  assert.ok(state.pendingAction.prompt.includes('메리'));
  assert.ok(state.seats.find(s => s.id === merry.id).hand.some(card => card.id === sentCardId));
  state = act(state, merry.id, { type: 'setup_choice', cardId: returnCardId });
  assert.equal(state.phase, 'play');
  assert.ok(state.seats.find(s => s.id === sam.id).hand.some(card => card.id === returnCardId));
  assert.deepEqual(state.seats.find(s => s.id === frodo.id).hand.map(card => card.id), frodoCards);
});

test('solo chooses one exchanging character, but performs both exchanges on Gwaihir', () => {
  let state = initializeFellowshipGame(ids(1), ids(1), 12, 1201);
  for (const characterId of ['gandalf', 'gwaihir', 'shadowfax', 'radagast']) {
    const pending = state.pendingAction;
    assert.ok(pending.options.some(option => option.id === characterId));
    state = act(state, pending.seatId, { type: 'select_character', characterId });
  }
  const gwaihir = state.seats.find(s => s.characterId === 'gwaihir');
  const gandalf = state.seats.find(s => s.characterId === 'gandalf');
  assert.equal(state.soloExchangeActor, gwaihir.id);
  for (let exchange = 0; exchange < 2; exchange++) {
    assert.equal(state.pendingAction.type, 'exchange_start');
    assert.equal(state.pendingAction.seatId, gwaihir.id);
    assert.deepEqual(state.pendingAction.options.map(option => option.id), [gandalf.id]);
    state = act(state, gwaihir.id, { type: 'setup_choice', targetSeatId: gandalf.id, cardId: state.seats.find(s => s.id === gwaihir.id).hand[0].id });
    assert.equal(state.pendingAction.type, 'exchange_return');
    assert.equal(state.pendingAction.seatId, gandalf.id);
    state = act(state, gandalf.id, { type: 'setup_choice', cardId: state.seats.find(s => s.id === gandalf.id).hand[0].id });
  }
  assert.notEqual(state.pendingAction?.type, 'exchange_start');
});

test('another player cannot inspect private hands or covered pyramid cards', () => {
  const state = initializeFellowshipGame(ids(2),ids(2),1,991);
  const view = getFellowshipPlayerView(state,'player-1');
  assert.deepEqual(view.handsBySeat['player-2'],[]);
  const hidden = view.handsBySeat.__pyramid__.filter(c => c.faceDown);
  assert.ok(hidden.length > 0);
  assert.ok(hidden.every(c => !('rank' in c) && !('suit' in c)));
  assert.ok(view.offerableCardsBySeat.__pyramid__.every(id => view.handsBySeat.__pyramid__.some(c => c.id === id && !c.covered)) || state.seats[2].controllerId !== 'player-1');
});

test('objective status stays pending for a temporary exact match, but confirms irreversible progress', () => {
  const exact = toPlay(4,3,404);
  const merry = exact.seats.find(s => s.characterId === 'merry');
  assert.ok(merry);
  merry.wonTricks = [1];
  const merryView = getFellowshipPlayerView(exact, merry.controllerId).players.find(p => p.id === merry.id);
  assert.equal(merryView.objectiveStatus, 'pending');
  assert.equal(merryView.objectiveComplete, false);

  const growing = toPlay(1,3,101);
  const frodo = growing.seats.find(s => s.characterId === 'frodo');
  assert.ok(frodo);
  frodo.won = [1,2,3,4].map(rank => ({id:`rings-${rank}`,suit:'rings',rank}));
  const frodoView = getFellowshipPlayerView(growing, frodo.controllerId).players.find(p => p.id === frodo.id);
  assert.equal(frodoView.objectiveStatus, 'complete');
  assert.equal(frodoView.objectiveComplete, true);
});

test('round scoring marks every chosen objective complete or failed', () => {
  const state = finishOneRound(toPlay(1,3,1103));
  assert.equal(state.objectivesEvaluated, true);
  const view = getFellowshipPlayerView(state, state.seats[0].controllerId);
  assert.ok(view.players.every(p => ['complete','failed'].includes(p.objectiveStatus)));
  assert.deepEqual(view.players.filter(p => p.objectiveStatus === 'failed').map(p => p.id).sort(), state.failedObjectiveSeatIds.slice().sort());
});

test('hidden threat goal status is private until round end', () => {
  const state = toPlay(3,3,303);
  const farmer = state.seats.find(s => s.characterId === 'farmer_maggot');
  assert.ok(farmer);
  assert.equal(typeof farmer.threatChoice, 'number');
  farmer.curses.push('unseen');
  farmer.won = ['hills','mountains'].map(suit => ({id:`${suit}-${farmer.threatChoice}`,suit,rank:farmer.threatChoice}));
  const own = getFellowshipPlayerView(state, farmer.controllerId).players.find(p => p.id === farmer.id);
  const other = getFellowshipPlayerView(state, state.seats.find(s => s.id !== farmer.id).controllerId).players.find(p => p.id === farmer.id);
  assert.equal(own.objectiveStatus, 'complete');
  assert.equal(other.threatChoice, undefined);
  assert.equal(other.objectiveStatus, 'pending');
  state.phase = 'round_end';
  state.objectivesEvaluated = true;
  const revealed = getFellowshipPlayerView(state, state.seats.find(s => s.id !== farmer.id).controllerId).players.find(p => p.id === farmer.id);
  assert.equal(revealed.objectiveStatus, 'complete');
});

test('an unshared comparison choice is not inferred from opponent objective status', () => {
  const state = toPlay(8,3,803);
  const strider = state.seats.find(s => s.characterId === 'strider');
  assert.ok(strider);
  strider.threatChoice = 1;
  strider.comparison = 'more';
  strider.wonTricks = [1,2];
  const own = getFellowshipPlayerView(state, strider.controllerId).players.find(p => p.id === strider.id);
  const other = getFellowshipPlayerView(state, state.seats.find(s => s.id !== strider.id).controllerId).players.find(p => p.id === strider.id);
  assert.equal(own.objectiveStatus, 'complete');
  assert.equal(other.objectiveStatus, 'pending');
});

test('Ring lead restriction, follow suit, and optional One Ring trump', () => {
  let state = toPlay(1,3,471);
  const [a,b,c] = state.seats;
  state.phase='play'; state.pendingAction=undefined; state.currentLeader=a.id; state.currentTurn=a.id;
  state.trick=[]; state.history=[]; state.ringTokenActive=false; state.deck=[];
  a.hand=[{id:'hills-8',suit:'hills',rank:8}];
  b.hand=[{id:'hills-2',suit:'hills',rank:2},{id:'rings-1',suit:'rings',rank:1}];
  c.hand=[{id:'mountains-7',suit:'mountains',rank:7}];
  const before = getFellowshipPlayerView(state,a.controllerId);
  assert.deepEqual(before.legalCardsBySeat[a.id],['hills-8']);
  state=act(state,a.id,{type:'play_card',cardId:'hills-8'});
  assert.throws(()=>act(state,b.id,{type:'play_card',cardId:'rings-1',trump:true}),/문양/);
  state=act(state,b.id,{type:'play_card',cardId:'hills-2'});
  state=act(state,c.id,{type:'play_card',cardId:'mountains-7'});
  assert.equal(state.history[0].winnerSeatId,a.id);

  state.phase='play'; state.pendingAction=undefined; state.currentLeader=a.id; state.currentTurn=a.id;
  state.trick=[]; state.history=[]; state.ringTokenActive=false;
  state.seats[0].hand=[{id:'hills-8',suit:'hills',rank:8}];
  state.seats[1].hand=[{id:'rings-1',suit:'rings',rank:1}];
  state.seats[2].hand=[{id:'hills-7',suit:'hills',rank:7}];
  for (const [who,cardId,trump] of [[a.id,'hills-8',false],[b.id,'rings-1',true],[c.id,'hills-7',false]]) state=act(state,who,{type:'play_card',cardId,trump});
  assert.equal(state.history[0].winnerSeatId,b.id);
  assert.equal(state.ringTokenActive,true);
});

test('chapter 17 Rivers trump, while chapter 18 Rivers are ordinary cards', () => {
  for (const [chapter,riverWins] of [[17,true],[18,false]]) {
    let state=toPlay(chapter,3,chapter*9);
    const [a,b,c]=state.seats;
    state.phase='play'; state.pendingAction=undefined; state.currentLeader=a.id; state.currentTurn=a.id;
    state.trick=[]; state.history=[]; state.deck=[];
    a.hand=[{id:'hills-8',suit:'hills',rank:8}];
    b.hand=[{id:'rivers-1',suit:'rivers',rank:1}];
    c.hand=[{id:'hills-7',suit:'hills',rank:7}];
    for (const [who,cardId] of [[a.id,'hills-8'],[b.id,'rivers-1'],[c.id,'hills-7']]) state=act(state,who,{type:'play_card',cardId});
    assert.equal(state.history[0].winnerSeatId,riverWins?b.id:a.id);
  }
});

test('chapter 15 selection keeps Gimli available to a human in two-player mode', () => {
  let state=initializeFellowshipGame(ids(2),ids(2),15,222);
  while (state.phase === 'character_selection') {
    const pending=state.pendingAction;
    if (pending.seatId !== '__pyramid__' && !state.seats.some(s => s.characterId === 'gimli') && state.selectionOrder.slice(state.selectionIndex+1).every(id => id === '__pyramid__')) {
      assert.deepEqual(pending.options.map(o => o.id),['gimli']);
    }
    state=act(state,pending.seatId,{type:'select_character',characterId:pending.options[0].id});
  }
  assert.ok(state.seats.find(s => s.characterId === 'gimli').id !== '__pyramid__');
});

test('Moria bridge redeals a 9-card Balrog deck, and Long Dark runs simultaneous setup', () => {
  let bridge=initializeFellowshipGame(ids(2),ids(2),14,1414);
  bridge.completedEvents=['doors_of_durin','balins_tomb','long_dark'];
  bridge=act(bridge,bridge.pendingAction.seatId,{type:'choose_event',eventId:'bridge_of_khazad_dum'});
  assert.equal(bridge.eventDeck.length,9);
  assert.equal(bridge.pyramid.length,9);
  assert.equal(bridge.lostCards.length,2);
  assert.equal(bridge.phase,'character_selection');

  const dark=toPlay(14,4,1504,'long_dark');
  assert.equal(dark.currentEvent,'long_dark');
  assert.equal(dark.longDarkExchangeResolved,true);
  assert.ok(dark.longDarkPlans.length > 0);
});

test('the Bridge of Khazad-dûm cannot be replayed after completion', () => {
  let state=initializeFellowshipGame(ids(3),ids(3),14,1415);
  state.phase='round_end';
  state.completedEvents=['doors_of_durin','balins_tomb','long_dark','bridge_of_khazad_dum'];
  state=applyFellowshipAction(state,'player-1',{type:'next_round'});
  assert.deepEqual(state.pendingAction.options.map(o => o.id),['long_dark']);
  assert.throws(()=>act(state,state.pendingAction.seatId,{type:'choose_event',eventId:'bridge_of_khazad_dum'}),/선택할 수 없는/);
});

test('Mithril pauses a permanent objective failure and only its holder decides', () => {
  let state=toPlay(13,3,1313);
  const frodo=state.seats.find(s => s.characterId==='frodo');
  const other=state.seats.find(s => s.id!==frodo.id);
  state.phase='play'; state.pendingAction=undefined; state.currentLeader=frodo.id; state.currentTurn=frodo.id;
  state.trick=[]; state.history=[]; state.deck=[]; state.giftUsed=[];
  state.seats.forEach(s => {s.hand=[];s.won=[];s.wonTricks=[];s.retainedCardsCount=0});
  // Give a selected exact-count character an over-limit tally before the next trick.
  other.characterId='merry'; other.wonTricks=[1,2];
  const third=state.seats.find(s => s.id!==frodo.id&&s.id!==other.id);
  frodo.hand=[{id:'hills-1',suit:'hills',rank:1},{id:'mountains-1',suit:'mountains',rank:1}];
  other.hand=[{id:'hills-8',suit:'hills',rank:8},{id:'mountains-8',suit:'mountains',rank:8}];
  third.hand=[{id:'hills-2',suit:'hills',rank:2},{id:'mountains-2',suit:'mountains',rank:2}];
  for(const [who,cardId] of [[frodo.id,'hills-1'],[other.id,'hills-8'],[third.id,'hills-2']]) state=act(state,who,{type:'play_card',cardId});
  // An over-limit objective pauses the round immediately. Other players cannot decide.
  assert.equal(state.pendingAction?.type,'gift_save');
  assert.equal(getFellowshipPlayerView(state, other.controllerId).players.find(p => p.id === other.id).objectiveStatus,'pending');
  assert.throws(()=>act(state,other.id,{type:'use_gift',accept:true}),/차례/);
  const declined = act(state,frodo.id,{type:'use_gift',accept:false});
  assert.equal(getFellowshipPlayerView(declined, other.controllerId).players.find(p => p.id === other.id).objectiveStatus,'failed');
  state=act(state,frodo.id,{type:'use_gift',accept:true});
  assert.ok(state.giftUsed.includes('mithril_shirt'));
  assert.equal(getFellowshipPlayerView(state, other.controllerId).players.find(p => p.id === other.id).objectiveStatus,'complete');
});
