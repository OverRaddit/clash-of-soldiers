import { CHAPTERS, CHARACTERS } from './catalog';

export type FellowshipPhase = 'event_selection' | 'character_selection' | 'setup' | 'play' | 'round_end' | 'chapter_complete';
export type FellowshipObjectiveStatus = 'pending' | 'complete' | 'failed';
export type Suit = 'hills' | 'mountains' | 'shadows' | 'forests' | 'rings' | 'rivers';
export interface FellowshipCard { id: string; suit: Suit; rank: number; special?: 'willow' | 'balrog' }
export interface FellowshipTrickPlay { seatId: string; card: FellowshipCard; trump: boolean; hiddenUntilComplete?: boolean }
export interface FellowshipTrick {
  number: number;
  leaderSeatId: string;
  leadSuit: Suit;
  plays: FellowshipTrickPlay[];
  winnerSeatId?: string;
  eventCard?: FellowshipCard;
  balrogCards?: FellowshipCard[];
}
export interface FellowshipSeat {
  id: string;
  controllerId: string;
  name: string;
  characterId?: string;
  hand: FellowshipCard[];
  won: FellowshipCard[];
  wonTricks: number[];
  threatValues: number[];
  threatChoice?: number | number[];
  comparison?: 'more' | 'fewer';
  curses: string[];
  gifts: string[];
  tucked?: FellowshipCard;
  presetLast?: FellowshipCard;
  presetFirst?: FellowshipCard;
  presetFirstTrump?: boolean;
  revealedHand?: boolean;
  forcedFullHand?: boolean;
  retainedCardsCount: number;
}
export interface PyramidSlot {
  row: number;
  col: number;
  cardId: string;
  faceUp: boolean;
  removed: boolean;
  flipAtTrickEnd?: boolean;
}
export interface FellowshipPendingAction {
  type: string;
  seatId: string;
  prompt: string;
  options?: { id: string; label: string }[];
  targetSeatId?: string;
  count?: number;
  targetSeatIds?: string[];
  [key: string]: unknown;
}
export type FellowshipAction =
  | { type: 'choose_event'; eventId: string }
  | { type: 'choose_group'; groupId: string }
  | { type: 'select_character'; characterId: string }
  | { type: 'setup_choice'; choiceId?: string; cardId?: string; targetSeatId?: string; cardsBySeat?: Record<string, string>; cardIds?: string[]; trump?: boolean }
  | { type: 'play_card'; cardId: string; trump?: boolean }
  | { type: 'use_gift'; giftId?: string; accept?: boolean }
  | { type: 'pass_lead'; targetSeatId: string }
  | { type: 'untuck' }
  | { type: 'next_round' };
type SetupStep = { type: string; seatId: string; targets?: string[]; targetSeatId?: string; params?: Record<string, unknown> };
type ExchangeState = { kind: 'normal' | 'simultaneous' | 'donation' | 'mirror'; initiatorSeatId?: string; targets: string[]; submitted: Record<string, Record<string, string>>; remaining: string[]; returnTo?: string; sentCardId?: string; targetSeatId?: string; mirrorStage?: number };

export interface FellowshipGameState {
  chapterNumber: number;
  phase: FellowshipPhase;
  playerIds: string[];
  playerNames: string[];
  seats: FellowshipSeat[];
  round: number;
  seed: number;
  deck: FellowshipCard[];
  lostCards: FellowshipCard[];
  eventDeck: FellowshipCard[];
  threatDeck: number[];
  ringTokenActive: boolean;
  ringHolderSeatId?: string;
  selectionOrder: string[];
  selectionIndex: number;
  setupQueue: SetupStep[];
  pendingAction?: FellowshipPendingAction;
  exchange?: ExchangeState;
  soloExchangeActor?: string;
  currentEvent?: string;
  completedEvents: string[];
  currentGroup?: string;
  completedGroups: string[];
  completedCharacters: string[];
  currentTurn?: string;
  currentLeader?: string;
  trick: FellowshipTrickPlay[];
  history: FellowshipTrick[];
  pendingEventCard?: FellowshipCard;
  pendingBalrogCards?: FellowshipCard[];
  pyramid: PyramidSlot[];
  giftUsed: string[];
  roundGiftUsedAtStart: string[];
  pendingFailure?: { seatId: string; reason: string; resume: boolean };
  forgivenGoalSeatIds: string[];
  objectivesEvaluated: boolean;
  failedObjectiveSeatIds: string[];
  announcements: string[];
  longDarkPlans: Array<{ from: string; to: string; cardId: string }>;
  longDarkReturns: Array<{ from: string; to: string; cardId: string }>;
  longDarkReturnQueue: string[];
  longDarkExchangeResolved: boolean;
  result?: { success: boolean; message: string; failedSeatIds?: string[] };
}

function fail(message: string): never { throw new Error(message); }
function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }
function hashSeed(): number { return (Math.random() * 0xffffffff) >>> 0; }
function nextRandom(state: FellowshipGameState): number {
  state.seed = (Math.imul(state.seed, 1664525) + 1013904223) >>> 0;
  return state.seed / 0x100000000;
}
function shuffle<T>(state: FellowshipGameState, items: T[]): T[] {
  const result = items.slice();
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(nextRandom(state) * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}
function baseDeck(): FellowshipCard[] {
  const cards: FellowshipCard[] = [];
  for (const suit of ['hills', 'mountains', 'shadows', 'forests'] as Suit[]) {
    for (let rank = 1; rank <= 8; rank++) cards.push({ id: `${suit}-${rank}`, suit, rank });
  }
  for (let rank = 1; rank <= 5; rank++) cards.push({ id: `rings-${rank}`, suit: 'rings', rank });
  return cards;
}
function seat(state: FellowshipGameState, id: string): FellowshipSeat {
  const item = state.seats.find(x => x.id === id);
  if (!item) fail('존재하지 않는 좌석입니다.');
  return item;
}
function char(state: FellowshipGameState, item: FellowshipSeat): any {
  return (CHARACTERS as any)[item.characterId || ''];
}
function activeChapter(state: FellowshipGameState): any {
  const chapter = (CHAPTERS as any)[state.chapterNumber];
  if (!chapter) fail('지원하지 않는 챕터입니다.');
  return chapter;
}
function physicalCount(state: FellowshipGameState): number { return state.seats.length; }
function indexOfSeat(state: FellowshipGameState, id: string): number { return state.seats.findIndex(x => x.id === id); }
function nextSeat(state: FellowshipGameState, id: string, filter?: (s: FellowshipSeat) => boolean): FellowshipSeat | undefined {
  const start = indexOfSeat(state, id);
  for (let i = 1; i <= state.seats.length; i++) {
    const candidate = state.seats[(start + i) % state.seats.length];
    if (!filter || filter(candidate)) return candidate;
  }
  return undefined;
}
function actorSeat(state: FellowshipGameState, playerId: string, expectedId: string): FellowshipSeat {
  const item = seat(state, expectedId);
  if (item.controllerId !== playerId) fail('이 행동을 할 차례가 아닙니다.');
  return item;
}
function takeCard(item: FellowshipSeat, cardId: string): FellowshipCard {
  const index = item.hand.findIndex(card => card.id === cardId);
  if (index < 0) fail('선택한 카드가 손에 없습니다.');
  return item.hand.splice(index, 1)[0];
}
function findCard(item: FellowshipSeat, cardId: string): FellowshipCard | undefined { return item.hand.find(card => card.id === cardId); }
function hasCharacter(state: FellowshipGameState, id: string): boolean { return state.seats.some(s => s.characterId === id); }
function characterAlias(id: string | undefined): string {
  if (!id) return '';
  if (id === 'samwise') return 'sam';
  if (id === 'meriadoc') return 'merry';
  if (id === 'peregrin') return 'pippin';
  if (id === 'aragorn_son') return 'aragorn';
  if (id === 'boromir_son') return 'boromir';
  if (id === 'legolas_greenleaf') return 'legolas';
  if (id === 'gimli_son') return 'gimli';
  if (id === 'bilbo_baggins') return 'bilbo';
  return id;
}
function cardCountsAs(card: FellowshipCard, suit: Suit, rank: number): boolean { return card.suit === suit && card.rank === rank; }

function pyramidRows(size: number): number[] {
  if (size === 9) return [4, 3, 2];
  if (size === 14) return [5, 4, 3, 2];
  return [5, 4, 3];
}
function pyramidInitialFaceUp(size: number, row: number, col: number): boolean {
  if (row === 0) return true;
  if (size !== 9 && row === 2 && (col === 0 || col === 2)) return true;
  return false;
}
function pyramidIsUncovered(state: FellowshipGameState, slot: PyramidSlot): boolean {
  if (slot.removed) return false;
  if (slot.row === 0) return true;
  return !state.pyramid.some(other => !other.removed && other.row === slot.row - 1 && (other.col === slot.col || other.col === slot.col + 1));
}
function refreshPyramid(state: FellowshipGameState, deferFlip: boolean): void {
  for (const slot of state.pyramid) {
    if (!slot.removed && !slot.faceUp && pyramidIsUncovered(state, slot)) {
      if (deferFlip) slot.flipAtTrickEnd = true;
      else slot.faceUp = true;
    }
  }
}
function playableCards(state: FellowshipGameState, item: FellowshipSeat): FellowshipCard[] {
  if (item.id !== '__pyramid__') return item.hand;
  return item.hand.filter(card => {
    const slot = state.pyramid.find(p => p.cardId === card.id && !p.removed);
    return !slot || (slot.faceUp && pyramidIsUncovered(state, slot));
  });
}
function cardsOfSuit(cards: FellowshipCard[], suit: Suit): FellowshipCard[] { return cards.filter(c => c.suit === suit); }
function legalPlayCards(state: FellowshipGameState, item: FellowshipSeat): FellowshipCard[] {
  if (state.phase !== 'play' || state.currentTurn !== item.id) return [];
  const available = playableCards(state, item);
  if (item.presetLast && item.hand.length === 0) return [item.presetLast];
  const lead = state.trick.find(p => p.seatId === state.currentLeader);
  if (lead) {
    if (item.characterId === 'gandalf_fire') return available;
    const matching = cardsOfSuit(available, lead.card.suit);
    return matching.length ? matching : available;
  }
  const canLeadRings = state.ringTokenActive || available.every(c => c.suit === 'rings') || item.characterId === 'gandalf_fire';
  return available.filter(c => c.suit !== 'rings' || canLeadRings);
}

function makeSeats(playerIds: string[], playerNames: string[]): FellowshipSeat[] {
  if (playerIds.length < 1 || playerIds.length > 4) fail('참가자는 1~4명이어야 합니다.');
  if (new Set(playerIds).size !== playerIds.length || playerNames.length !== playerIds.length) fail('참가자 정보가 올바르지 않습니다.');
  const count = playerIds.length === 1 ? 4 : playerIds.length === 2 ? 3 : playerIds.length;
  return Array.from({ length: count }, (_, index) => ({
    id: playerIds.length === 1 ? `${playerIds[0]}#${index + 1}` : index === 2 && playerIds.length === 2 ? '__pyramid__' : playerIds[index],
    controllerId: index === 2 && playerIds.length === 2 ? playerIds[1] : playerIds.length === 1 ? playerIds[0] : playerIds[index],
    name: playerIds.length === 1 ? `${playerNames[0]} ${index + 1}` : index === 2 && playerIds.length === 2 ? '피라미드' : playerNames[index],
    hand: [], won: [], wonTricks: [], threatValues: [], curses: [], gifts: [], retainedCardsCount: 0,
  }));
}

function prepareDeck(state: FellowshipGameState): void {
  let cards = baseDeck();
  state.eventDeck = [];
  if (state.chapterNumber === 5) {
    state.eventDeck = cards.filter(c => c.suit === 'forests');
    state.eventDeck.push({ id: 'forests-9', suit: 'forests', rank: 9, special: 'willow' });
    cards = cards.filter(c => c.suit !== 'forests');
  }
  if (state.chapterNumber === 14 && state.currentEvent === 'bridge_of_khazad_dum') {
    state.eventDeck = cards.filter(c => c.suit === 'shadows');
    state.eventDeck.push({ id: 'shadows-5-balrog', suit: 'shadows', rank: 5, special: 'balrog' });
    cards = cards.filter(c => c.suit !== 'shadows');
  }
  if (state.chapterNumber >= 17) {
    const max = state.playerIds.length === 2 || state.playerIds.length === 3 ? 6 : 8;
    for (let rank = 1; rank <= max; rank++) cards.push({ id: `rivers-${rank}`, suit: 'rivers', rank });
  }
  if (state.chapterNumber === 6) {
    const nonRings = shuffle(state, cards.filter(c => c.suit !== 'rings'));
    const barrowSize = state.playerIds.length === 2 || state.playerIds.length === 3 ? 10 : 5;
    state.eventDeck = nonRings.splice(0, barrowSize);
    cards = [...nonRings, ...cards.filter(c => c.suit === 'rings')];
  }
  state.deck = shuffle(state, cards);
  state.eventDeck = shuffle(state, state.eventDeck);
}

function dealRound(state: FellowshipGameState, keepRingHolder?: string): void {
  for (const s of state.seats) {
    s.characterId = undefined; s.hand = []; s.won = []; s.wonTricks = []; s.threatValues = [];
    s.threatChoice = undefined; s.comparison = undefined; s.curses = []; s.gifts = [];
    s.tucked = undefined; s.presetLast = undefined; s.presetFirst = undefined; s.presetFirstTrump = undefined;
    s.revealedHand = false; s.forcedFullHand = false; s.retainedCardsCount = 0;
  }
  state.round += 1;
  state.phase = 'character_selection';
  state.lostCards = []; state.trick = []; state.history = []; state.pyramid = [];
  state.pendingAction = undefined; state.exchange = undefined; state.currentTurn = undefined;
  state.currentLeader = undefined; state.pendingEventCard = undefined; state.pendingBalrogCards = undefined;
  state.ringTokenActive = false; state.result = undefined; state.pendingFailure = undefined;
  state.forgivenGoalSeatIds = [];
  state.objectivesEvaluated = false;
  state.failedObjectiveSeatIds = [];
  state.announcements = [];
  state.longDarkPlans = []; state.longDarkReturns = []; state.longDarkReturnQueue = []; state.longDarkExchangeResolved = false;
  state.soloExchangeActor = undefined; state.roundGiftUsedAtStart = [...state.giftUsed];
  prepareDeck(state);
  state.threatDeck = shuffle(state, (activeChapter(state).threats || []).map((id: string) => parseInt(id.match(/(\d+)$/)?.[1] || '0', 10)));
  const playerCount = state.playerIds.length;
  if (playerCount === 1) {
    const ringIndex = state.deck.findIndex(c => c.id === 'rings-1');
    const [ring] = state.deck.splice(ringIndex, 1);
    if (state.chapterNumber !== 6) {
      const lost = state.deck.shift();
      if (lost) state.lostCards.push(lost);
    }
    const initial = shuffle(state, [ring, ...state.deck.splice(0, 15)]);
    for (let i = 0; i < 4; i++) state.seats[i].hand = initial.slice(i * 4, i * 4 + 4);
  } else {
    if (state.chapterNumber !== 6) {
      const lostCount = (playerCount === 2 || playerCount === 3) && (state.chapterNumber === 5 || (state.chapterNumber === 14 && state.currentEvent === 'bridge_of_khazad_dum')) ? 2 : 1;
      while (state.lostCards.length < lostCount) {
        const card = state.deck.shift();
        if (!card) fail('카드 배분에 실패했습니다.');
        if (card.id === 'rings-1') { state.deck.push(card); state.deck = shuffle(state, state.deck); continue; }
        state.lostCards.push(card);
      }
    }
    if (state.deck.length % state.seats.length !== 0) fail('챕터 카드 수가 참가자 수와 맞지 않습니다.');
    const each = state.deck.length / state.seats.length;
    for (let i = 0; i < state.seats.length; i++) state.seats[i].hand = state.deck.splice(0, each);
    if (playerCount === 2) {
      const size = each;
      const rows = pyramidRows(size);
      const cards = state.seats[2].hand;
      let n = 0;
      for (let row = 0; row < rows.length; row++) {
        for (let col = 0; col < rows[row]; col++) {
          state.pyramid.push({ row, col, cardId: cards[n].id, faceUp: pyramidInitialFaceUp(size, row, col), removed: false });
          n += 1;
        }
      }
    }
  }
  const holder = state.seats.find(s => s.hand.some(c => c.id === 'rings-1'));
  if (!holder) fail('반지 1 카드를 찾지 못했습니다.');
  if (keepRingHolder && holder.id !== keepRingHolder) {
    const previous = seat(state, keepRingHolder);
    const ring = takeCard(holder, 'rings-1');
    const replacement = previous.hand.pop();
    if (!replacement) fail('반지 소유자를 유지할 수 없습니다.');
    holder.hand.push(replacement); previous.hand.push(ring);
    if (playerCount === 2) {
      if (holder.id === '__pyramid__') {
        const slot = state.pyramid.find(p => p.cardId === ring.id);
        if (slot) slot.cardId = replacement.id;
      } else if (previous.id === '__pyramid__') {
        const slot = state.pyramid.find(p => p.cardId === replacement.id);
        if (slot) slot.cardId = ring.id;
      }
    }
  }
  state.ringHolderSeatId = keepRingHolder || holder.id;
  if (playerCount === 2) seat(state, '__pyramid__').controllerId = state.ringHolderSeatId === '__pyramid__' ? state.seats[1].controllerId : seat(state, state.ringHolderSeatId).controllerId;
  const start = indexOfSeat(state, state.ringHolderSeatId);
  state.selectionOrder = state.seats.map((_, i) => state.seats[(start + i) % state.seats.length].id);
  state.selectionIndex = 0;
  if (state.chapterNumber === 14 && !state.currentEvent) {
    state.phase = 'event_selection';
    state.pendingAction = { type: 'choose_event', seatId: state.ringHolderSeatId, prompt: '이번 라운드의 모리아 사건을 선택하세요.', options: moriaEventOptions(state).map(id => ({ id, label: eventLabel(id) })) };
  } else if (state.chapterNumber === 18 && !state.currentGroup) {
    state.phase = 'event_selection';
    state.pendingAction = { type: 'choose_group', seatId: state.ringHolderSeatId, prompt: '이번 라운드의 일행을 선택하세요.', options: ['first_group', 'second_group'].filter(id => !state.completedGroups.includes(id)).map(id => ({ id, label: id === 'first_group' ? '첫 번째 일행' : '두 번째 일행' })) };
  } else if (state.chapterNumber === 16) {
    initializeMirror(state);
  } else {
    setSelectionPending(state);
  }
}

function moriaEventOptions(state: FellowshipGameState): string[] {
  const early = ['doors_of_durin', 'balins_tomb', 'long_dark'];
  const uncompleted = early.filter(id => !state.completedEvents.includes(id));
  if (uncompleted.length) return [...uncompleted, ...(state.completedEvents.includes('long_dark') ? ['long_dark'] : [])];
  return state.completedEvents.includes('bridge_of_khazad_dum') ? ['long_dark'] : ['long_dark', 'bridge_of_khazad_dum'];
}
function eventLabel(id: string): string {
  const labels: Record<string,string> = { 'doors_of_durin': '두린의 문', 'balins_tomb': '발린의 무덤', 'long_dark': '오랜 어둠', 'bridge_of_khazad_dum': '카자드둠의 다리' };
  return labels[id] || id;
}
function chapterPool(state: FellowshipGameState): string[] {
  const chapter = activeChapter(state);
  if (state.chapterNumber === 18) {
    const group = (chapter.rounds || []).find((x: any) => x.id === state.currentGroup);
    if (!group) fail('일행을 먼저 선택해야 합니다.');
    return group.characters;
  }
  let ids = [...chapter.characters];
  if (state.chapterNumber === 14) {
    const event = (chapter.rounds || []).find((x: any) => x.id === state.currentEvent);
    if (event?.characters) ids = event.characters;
  }
  return ids;
}
function requiredCharacters(state: FellowshipGameState): string[] {
  const chapter = activeChapter(state);
  if (state.chapterNumber === 18) return [...((chapter.rounds || []).find((x: any) => x.id === state.currentGroup)?.required || [])];
  let required: string[] = [...chapter.required];
  if (state.chapterNumber === 14) {
    const event = (chapter.rounds || []).find((x: any) => x.id === state.currentEvent);
    if (event?.required) required = event.required;
  }
  return required;
}
function selectableCharacters(state: FellowshipGameState): string[] {
  const used = new Set(state.seats.map(s => s.characterId).filter(Boolean));
  const choices = chapterPool(state).filter(id => !used.has(id));
  const fits = (seatId: string, id: string): boolean => {
    if (id === 'frodo' && seatId !== state.ringHolderSeatId && state.chapterNumber !== 16) return false;
    if (state.chapterNumber === 15 && state.playerIds.length === 2 && seatId === '__pyramid__' && id === 'gimli') return false;
    return true;
  };
  const canFinish = (index: number, chosen: Set<string>): boolean => {
    if (index === state.selectionOrder.length) return requiredCharacters(state).every(id => chosen.has(id));
    const seatId = state.selectionOrder[index];
    return chapterPool(state).some(id => !chosen.has(id) && fits(seatId,id) && canFinish(index+1,new Set([...chosen,id])));
  };
  return choices.filter(id => fits(state.selectionOrder[state.selectionIndex],id) && canFinish(state.selectionIndex+1,new Set([...used,id])));
}
function setSelectionPending(state: FellowshipGameState): void {
  if (state.selectionIndex >= state.selectionOrder.length) { beginSetup(state); return; }
  const seatId = state.selectionOrder[state.selectionIndex];
  const choices = selectableCharacters(state);
  if (choices.length === 0) fail('선택 가능한 캐릭터가 없습니다.');
  state.pendingAction = {
    type: 'select_character', seatId, prompt: `${seat(state, seatId).name}: 캐릭터를 선택하세요.`,
    options: choices.map(id => ({ id, label: (CHARACTERS as any)[id]?.nameKo || (CHARACTERS as any)[id]?.name || id })),
  };
}

export function initializeFellowshipGame(playerIds: string[], playerNames: string[], chapter: number, seed?: number): FellowshipGameState {
  if (!Number.isInteger(chapter) || chapter < 1 || chapter > 18) fail('챕터는 1~18이어야 합니다.');
  const state: FellowshipGameState = {
    chapterNumber: chapter, phase: 'character_selection', playerIds: [...playerIds], playerNames: [...playerNames], seats: makeSeats(playerIds, playerNames),
    round: 0, seed: seed ?? hashSeed(), deck: [], lostCards: [], eventDeck: [], threatDeck: [], ringTokenActive: false,
    selectionOrder: [], selectionIndex: 0, setupQueue: [], completedEvents: [], completedGroups: [], completedCharacters: [],
    trick: [], history: [], pyramid: [], giftUsed: [], roundGiftUsedAtStart: [], announcements: [], forgivenGoalSeatIds: [],
    objectivesEvaluated: false, failedObjectiveSeatIds: [],
    longDarkPlans: [], longDarkReturns: [], longDarkReturnQueue: [], longDarkExchangeResolved: false,
  };
  dealRound(state);
  return state;
}

function initializeMirror(state: FellowshipGameState): void {
  const chapter = activeChapter(state);
  const pool: string[] = chapter.characters.filter((id: string) => state.playerIds.length === 1 || state.playerIds.length === 4 || id !== 'sam');
  if (state.playerIds.length === 1) {
    seat(state, state.ringHolderSeatId!).characterId = 'frodo';
    const others = shuffle(state, pool.filter((id: string) => id !== 'frodo'));
    let i = 0;
    for (const s of state.seats) if (!s.characterId) s.characterId = others[i++];
  } else {
    const chosen = shuffle(state, pool).slice(0, state.seats.length);
    for (let i = 0; i < state.seats.length; i++) state.seats[i].characterId = chosen[i];
  }
  state.selectionIndex = state.seats.length;
  if (state.playerIds.length === 1) { beginSetup(state); return; }
  const allCards = shuffle(state, [...state.deck, ...state.lostCards, ...state.seats.flatMap(s => s.hand)]);
  state.deck = allCards; state.lostCards = [];
  for (const s of state.seats) s.hand = [];
  state.pyramid = [];
  if (state.playerIds.length === 2) {
    const pyramid = state.seats[2];
    pyramid.hand = state.deck.splice(0, 12);
    const rows = pyramidRows(12);
    let i = 0;
    for (let row = 0; row < rows.length; row++) for (let col = 0; col < rows[row]; col++) {
      state.pyramid.push({ row, col, cardId: pyramid.hand[i++].id, faceUp: pyramidInitialFaceUp(12, row, col), removed: false });
    }
  }
  for (const s of state.seats) if (s.id !== '__pyramid__') s.hand.push(...state.deck.splice(0, 4));
  startMirrorExchange(state, 1);
}

function startMirrorExchange(state: FellowshipGameState, stage: number): void {
  const targets = state.seats.filter(s => s.id !== '__pyramid__').map(s => s.id);
  state.phase = 'setup';
  state.exchange = { kind: 'mirror', targets, remaining: [...targets], submitted: {}, mirrorStage: stage };
  setSimultaneousPending(state);
}

function finishMirrorStage(state: FellowshipGameState, stage: number): void {
  const humanSeats = state.seats.filter(s => s.id !== '__pyramid__');
  if (stage === 1) {
    for (const s of humanSeats) s.hand.push(...state.deck.splice(0, 4));
    startMirrorExchange(state, 2);
    return;
  }
  const lost = state.deck.pop();
  if (!lost) fail('거울 사건의 유실 카드를 찾지 못했습니다.');
  state.lostCards = [lost];
  if (state.deck.length % humanSeats.length !== 0) fail('거울 사건의 나머지 카드를 균등하게 나눌 수 없습니다.');
  const extra = state.deck.length / humanSeats.length;
  for (const s of humanSeats) s.hand.push(...state.deck.splice(0, extra));
  const ringHolder = state.seats.find(s => s.hand.some(c => c.id === 'rings-1'));
  state.ringHolderSeatId = ringHolder?.id || state.seats.find(s => s.characterId === 'frodo')?.id;
  if (state.playerIds.length === 2) seat(state, '__pyramid__').controllerId = state.ringHolderSeatId === '__pyramid__' || !ringHolder ? state.seats[1].controllerId : seat(state, state.ringHolderSeatId).controllerId;
  beginSetup(state);
}

function effectiveCharacterFace(state: FellowshipGameState, item: FellowshipSeat): any {
  const definition = char(state, item);
  if (!definition) fail(`정의되지 않은 캐릭터: ${item.characterId}`);
  if (state.chapterNumber === 18 && definition.burdened) return definition.burdened;
  return definition;
}
function goalFor(state: FellowshipGameState, item: FellowshipSeat): any {
  const chapter = activeChapter(state);
  if (state.chapterNumber === 14 && state.currentEvent) {
    const round = (chapter.rounds || []).find((x: any) => x.id === state.currentEvent);
    if (round?.goalOverrides?.[item.characterId]) return round.goalOverrides[item.characterId];
  }
  if (chapter.goalOverrides?.[item.characterId]) return chapter.goalOverrides[item.characterId];
  const def = char(state, item);
  return def.goalByPlayerCount?.[state.playerIds.length] || effectiveCharacterFace(state, item).goal;
}
function setupRuleActions(state: FellowshipGameState, item: FellowshipSeat): any[] { return effectiveCharacterFace(state, item).setupActions || []; }
function identityMatches(item: FellowshipSeat, target: string): boolean { return characterAlias(item.characterId) === target || item.characterId === target; }

function beginSetup(state: FellowshipGameState): void {
  state.phase = 'setup';
  state.pendingAction = undefined;
  state.exchange = undefined;
  const chapter = activeChapter(state);
  const curseAssignments: Record<string, string> = state.chapterNumber === 8 ? { frodo: 'morgul_knife', merry: 'black_breath' }
    : state.chapterNumber === 9 ? { frodo: 'morgul_knife', merry: 'black_breath', pippin: 'wraith', strider: 'unseen', sam: 'terror' } : {};
  for (const s of state.seats) {
    const curse = curseAssignments[characterAlias(s.characterId)];
    if (curse) s.curses.push(curse);
    for (const gift of chapter.gifts || []) if (identityMatches(s, gift.recipient)) s.gifts.push(gift.id);
    if (state.playerIds.length === 1) {
      const full = s.characterId === 'fatty_bolger' ? 9 : s.characterId === 'goldberry' ? 8 : 0;
      if (full) {
        const need = full - s.hand.length;
        if (need < 0 || state.deck.length < need) fail('완전한 손패를 배분할 수 없습니다.');
        s.hand.push(...state.deck.splice(0, need));
        s.forcedFullHand = true;
      }
    }
  }
  const setupAnchor = state.chapterNumber === 16 ? state.seats.find(s => s.characterId === 'frodo')?.id : state.ringHolderSeatId;
  let start = indexOfSeat(state, setupAnchor || state.seats[0].id);
  const order = state.seats.map((_, i) => state.seats[(start + i + 1) % state.seats.length]);
  state.setupQueue = [];
  for (const s of order) for (const effect of setupRuleActions(state, s)) {
    const kind = effect.kind;
    if (['requires_ring_one_holder', 'forbid_exchange_card', 'lead_first', 'solo_fixed_hand', 'exclude_exchange_target'].includes(kind)) continue;
    state.setupQueue.push({ type: kind, seatId: s.id, params: effect.params || {} });
  }
  if (state.playerIds.length === 1) {
    const exchangers = state.seats.filter(s => !s.curses.includes('wraith') && setupRuleActions(state, s).some((rule: any) => {
      if (rule.kind === 'exchange') return validExchangeTargets(state, s, rule.params || {}).length > 0;
      if (rule.kind === 'exchange_lost_or_character') return state.lostCards.length > 0 || state.seats.some(other => other.id !== s.id && identityMatches(other, 'gandalf') && !other.curses.includes('wraith'));
      return false;
    }));
    if (exchangers.length > 1) {
      state.pendingAction = { type: 'choose_solo_exchanger', seatId: state.seats[0].id, prompt: '준비 중 교환을 수행할 한 캐릭터를 선택하세요.', options: exchangers.map(s => ({ id: s.id, label: char(state, s).nameKo })) };
      return;
    }
    state.soloExchangeActor = exchangers[0]?.id || '';
  }
  runSetupQueue(state);
}

function drawThreat(state: FellowshipGameState, item: FellowshipSeat): number {
  while (state.threatDeck.length) {
    const value = state.threatDeck.shift()!;
    const goal = goalFor(state, item);
    const suits = goal.kind === 'multi_target_suit_rank' ? goal.params.suits : goal.kind === 'target_suit_rank' ? [goal.params.suit] : [];
    if (suits.some((suit: Suit) => state.lostCards.some(c => cardCountsAs(c, suit, value)))) continue;
    return value;
  }
  fail('목표에 사용할 위협 카드가 남아 있지 않습니다.');
}
function validExchangeTargets(state: FellowshipGameState, item: FellowshipSeat, params: Record<string, unknown>): FellowshipSeat[] {
  const specified = params.targets;
  const targets = state.seats.filter(other => other.id !== item.id && !other.curses.includes('wraith') && other.hand.length > 0 &&
    (specified === 'any' || (Array.isArray(specified) && specified.some((identity: string) => identityMatches(other, identity)))));
  if (['boromir', 'boromir_son'].includes(item.characterId || '')) return targets.filter(s => !identityMatches(s, 'frodo'));
  if (item.characterId === 'haldir') return targets.filter(s => !identityMatches(s, 'gimli'));
  return targets;
}
function setupSeatLabel(state: FellowshipGameState, item: FellowshipSeat): string {
  const characterName = char(state, item)?.nameKo;
  return characterName ? `${characterName} (${item.name})` : item.name;
}
function canOfferCard(state: FellowshipGameState, item: FellowshipSeat, cardId: string): boolean {
  if (!findCard(item, cardId)) return false;
  if (identityMatches(item, 'frodo') && cardId === 'rings-1') return false;
  return playableCards(state, item).some(c => c.id === cardId);
}
function setupChoicePrompt(state: FellowshipGameState, type: string, item: FellowshipSeat, options?: {id:string;label:string}[], extra?: Record<string, unknown>): FellowshipPendingAction {
  const prompts: Record<string, string> = {
    exchange_start: '교환할 상대와 내 카드를 선택하세요.', exchange_return: '돌려줄 카드를 선택하세요.',
    simultaneous_exchange: '각 상대에게 보낼 카드를 선택하세요.', donate: '줄 카드를 선택하세요.',
    donate_right: '오른쪽 이웃에게 보낼 카드를 선택하세요.', choose_threat: '목표로 삼을 위협값을 선택하세요.',
    choose_comparison: '위협값보다 트릭을 더 많이 또는 적게 이길지 선언하세요.',
    threat_redraw: '위협 카드를 다시 뽑을 수 있습니다.', tuck_card: '보관할 카드를 선택하세요.',
    precommit_last_card: '마지막 트릭에 낼 카드를 선택하세요.', preplay_first_card: '첫 트릭에 미리 낼 카드를 선택하세요.',
    exchange_lost: '유실 카드와 교환할 손패를 선택하세요.',
  };
  return { type, seatId: item.id, prompt: `${setupSeatLabel(state, item)}: ${prompts[type] || '준비 행동을 선택하세요.'}`, options, ...extra };
}

function runSetupQueue(state: FellowshipGameState): void {
  state.pendingAction = undefined;
  while (state.setupQueue.length) {
    const step = state.setupQueue.shift()!;
    const item = seat(state, step.seatId);
    const params = step.params || {};
    switch (step.type) {
      case 'add_lost_cards': {
        if (state.chapterNumber === 6 && item.characterId === 'tom_bombadil') {
          const barrow = state.eventDeck.splice(0, 5);
          item.hand.push(...barrow); item.retainedCardsCount += barrow.length;
        }
        else if (state.lostCards.length) {
          const take = params.all ? state.lostCards.splice(0) : state.lostCards.splice(0, 1);
          item.hand.push(...take);
          item.retainedCardsCount += take.length;
          if (item.id === '__pyramid__') for (const card of take) state.pyramid.push({ row: -1, col: state.pyramid.length, cardId: card.id, faceUp: true, removed: false });
        }
        break;
      }
      case 'draw_threat': {
        if (state.chapterNumber === 14 && state.currentEvent === 'balins_tomb' && item.characterId === 'gimli') break;
        const count = Number(params.count || 1);
        const values = Array.from({ length: count }, () => drawThreat(state, item));
        item.threatValues = values;
        if (count > 1) {
          state.pendingAction = setupChoicePrompt(state, 'choose_threat', item, values.map(v => ({ id: String(v), label: `위협 ${v}` })), { values });
          return;
        }
        item.threatChoice = values[0];
        if (hasCharacter(state, 'meriadoc')) {
          state.pendingAction = setupChoicePrompt(state, 'threat_redraw', item, [{id:'keep',label:'유지'}, {id:'redraw',label:'다시 뽑기'}]);
          return;
        }
        break;
      }
      case 'choose_threat': {
        const options = item.gifts.includes('broken_sword') ? ['1-2', '3-4', '5-6'] : state.threatDeck.map(String);
        if (!options.length) fail('선택할 수 있는 위협 카드가 없습니다.');
        state.pendingAction = setupChoicePrompt(state, 'choose_threat', item, options.map((x: string) => ({ id: x, label: x.includes('-') ? `${x} 범위` : `위협 ${x}` })));
        return;
      }
      case 'declare_comparison':
        state.pendingAction = setupChoicePrompt(state, 'choose_comparison', item, [{id:'more',label:'더 많이'}, {id:'fewer',label:'더 적게'}]); return;
      case 'exchange': {
        if (state.playerIds.length === 1 && state.soloExchangeActor !== item.id) break;
        if (item.curses.includes('wraith')) break;
        const targets = validExchangeTargets(state, item, params);
        if (!targets.length) break;
        const count = Number(params.count || 1);
        if (count > 1) for (let i = count - 1; i >= 1; i--) state.setupQueue.unshift({ ...step, params: { ...params, count: 1 } });
        const longDark = state.currentEvent === 'long_dark' && state.playerIds.length > 1;
        const simultaneous = Boolean(params.simultaneous) || longDark;
        const actualTargets = item.characterId === 'glorfindel' || item.characterId === 'bill_pony' ? targets : targets;
        if (simultaneous) {
          const selected = item.characterId === 'glorfindel' || item.characterId === 'bill_pony' ? actualTargets.map(s => s.id) : undefined;
          if (selected) { beginSimultaneousExchange(state, item.id, selected); return; }
        }
        state.pendingAction = setupChoicePrompt(state, 'exchange_start', item, targets.map(s => ({ id: s.id, label: setupSeatLabel(state, s) })), { simultaneous, longDark });
        return;
      }
      case 'exchange_lost_or_character': {
        if (state.playerIds.length === 1 && state.soloExchangeActor !== item.id) break;
        if (item.curses.includes('wraith')) break;
        const options: {id:string;label:string}[] = [];
        if (state.lostCards.length) options.push({id:'lost',label:'유실 카드'});
        const gandalf = state.seats.find(s => s.id !== item.id && identityMatches(s, 'gandalf') && !s.curses.includes('wraith'));
        if (gandalf) options.push({id:gandalf.id,label:setupSeatLabel(state, gandalf)});
        if (!options.length) break;
        state.pendingAction = setupChoicePrompt(state, 'exchange_start', item, options);
        return;
      }
      case 'donate_to_all': {
        const targets = state.seats.filter(s => s.id !== item.id);
        for (let i = targets.length - 1; i >= 0; i--) state.setupQueue.unshift({ type: 'donate', seatId: item.id, targetSeatId: targets[i].id });
        break;
      }
      case 'donate':
        state.pendingAction = setupChoicePrompt(state, 'donate', item, undefined, { targetSeatId: step.targetSeatId }); return;
      case 'simultaneous_donate_right':
        beginSimultaneousDonation(state); return;
      case 'reveal_hand':
        item.revealedHand = state.playerIds.length > 1;
        if (item.id === '__pyramid__' && item.revealedHand) for (const slot of state.pyramid) slot.faceUp = true;
        break;
      case 'tuck_card': state.pendingAction = setupChoicePrompt(state, 'tuck_card', item); return;
      case 'precommit_last_card': state.pendingAction = setupChoicePrompt(state, 'precommit_last_card', item); return;
      case 'preplay_first_card': state.pendingAction = setupChoicePrompt(state, 'preplay_first_card', item); return;
      default: fail(`아직 구현되지 않은 준비 규칙: ${step.type}`);
    }
  }
  if (state.currentEvent === 'long_dark' && state.playerIds.length > 1 && state.longDarkPlans.length && !state.longDarkExchangeResolved) {
    state.longDarkReturnQueue = [...new Set(state.longDarkPlans.map(x => x.to))];
    setLongDarkReturnPending(state);
    return;
  }
  if (state.chapterNumber === 11 && state.playerIds.length > 1) {
    const horn = state.seats.find(s => s.gifts.includes('horn_of_gondor'));
    if (horn && horn.id !== '__pyramid__') {
      const counts = ['hills','mountains','shadows','forests','rings','rivers'].map(suit => ({suit,count:horn.hand.filter(c => c.suit === suit).length}));
      const maximum = Math.max(...counts.map(x => x.count));
      const suits = counts.filter(x => x.count === maximum).map(x => x.suit);
      state.announcements.push(`${horn.name}: 가장 많은 문양은 ${suits.join(', ')}입니다.`);
      state.giftUsed.push('horn_of_gondor');
    }
  }
  beginPlay(state);
}

function beginSimultaneousExchange(state: FellowshipGameState, initiatorSeatId: string, targets: string[]): void {
  state.exchange = { kind: 'simultaneous', initiatorSeatId, targets, remaining: [initiatorSeatId, ...targets], submitted: {} };
  setSimultaneousPending(state);
}
function beginSimultaneousDonation(state: FellowshipGameState): void {
  const ids = state.seats.map(s => s.id);
  state.exchange = { kind: 'donation', targets: ids, remaining: [...ids], submitted: {} };
  setSimultaneousPending(state);
}
function setSimultaneousPending(state: FellowshipGameState): void {
  const ex = state.exchange!;
  if (!ex.remaining.length) { finishSimultaneousExchange(state); return; }
  const id = ex.remaining[0];
  const item = seat(state, id);
  const targetIds = ex.kind === 'mirror' ? ex.targets.filter(x => x !== id)
    : ex.kind === 'donation' ? [state.seats[(indexOfSeat(state, id) + state.seats.length - 1) % state.seats.length].id]
    : id === ex.initiatorSeatId ? ex.targets : [ex.initiatorSeatId!];
  state.pendingAction = setupChoicePrompt(state, ex.kind === 'donation' ? 'donate_right' : 'simultaneous_exchange', item, undefined,
    { targetSeatIds: targetIds, count: targetIds.length });
}
function transferSimultaneously(state: FellowshipGameState, submitted: Record<string, Record<string, string>>): void {
  const transfers: Array<{ from: string; to: string; card: FellowshipCard; slot?: PyramidSlot }> = [];
  const used = new Set<string>();
  for (const [from, perTarget] of Object.entries(submitted)) for (const [to, cardId] of Object.entries(perTarget)) {
    const giver = seat(state, from);
    if (used.has(`${from}:${cardId}`) || !canOfferCard(state, giver, cardId)) fail('동시 교환에서 한 카드를 두 번 사용할 수 없습니다.');
    used.add(`${from}:${cardId}`);
    const slot = from === '__pyramid__' ? state.pyramid.find(p => !p.removed && p.cardId === cardId) : undefined;
    transfers.push({ from, to, card: takeCard(giver, cardId), slot });
    if (slot) slot.removed = true;
  }
  for (const t of transfers) {
    seat(state, t.to).hand.push(t.card);
    if (t.to === '__pyramid__') {
      const outbound = transfers.find(x => x.from === '__pyramid__' && x.to === t.from && x.slot)?.slot || transfers.find(x => x.from === '__pyramid__' && x.slot)?.slot;
      if (outbound) { outbound.cardId = t.card.id; outbound.removed = false; outbound.faceUp = true; }
      else state.pyramid.push({ row: -1, col: state.pyramid.length, cardId: t.card.id, faceUp: true, removed: false });
    }
  }
  refreshPyramid(state, false);
}
function finishSimultaneousExchange(state: FellowshipGameState): void {
  const ex = state.exchange!;
  transferSimultaneously(state, ex.submitted);
  state.exchange = undefined;
  state.pendingAction = undefined;
  if (ex.kind === 'mirror') finishMirrorStage(state, ex.mirrorStage!);
  else runSetupQueue(state);
}
function setLongDarkReturnPending(state: FellowshipGameState): void {
  if (!state.longDarkReturnQueue.length) { finishLongDarkExchanges(state); return; }
  const id = state.longDarkReturnQueue[0];
  const item = seat(state, id);
  const targetSeatIds = state.longDarkPlans.filter(plan => plan.to === id).map(plan => plan.from);
  state.pendingAction = setupChoicePrompt(state, 'long_dark_return', item, undefined, { targetSeatIds, count: targetSeatIds.length });
}
function finishLongDarkExchanges(state: FellowshipGameState): void {
  const all = [...state.longDarkPlans, ...state.longDarkReturns];
  const used = new Set<string>();
  for (const transfer of all) {
    if (used.has(`${transfer.from}:${transfer.cardId}`) || !canOfferCard(state, seat(state, transfer.from), transfer.cardId)) fail('오랜 어둠의 동시 교환에서 같은 카드를 중복 선택했습니다.');
    used.add(`${transfer.from}:${transfer.cardId}`);
  }
  const removedSlots: PyramidSlot[] = [];
  const removed = all.map(t => {
    const slot = t.from === '__pyramid__' ? state.pyramid.find(p => !p.removed && p.cardId === t.cardId) : undefined;
    if (slot) { slot.removed = true; removedSlots.push(slot); }
    return { to:t.to, card:takeCard(seat(state,t.from),t.cardId) };
  });
  for (const t of removed) {
    seat(state,t.to).hand.push(t.card);
    if (t.to === '__pyramid__') {
      const slot = removedSlots.shift();
      if (slot) { slot.cardId=t.card.id; slot.removed=false; slot.faceUp=true; }
      else state.pyramid.push({row:-1,col:state.pyramid.length,cardId:t.card.id,faceUp:true,removed:false});
    }
  }
  refreshPyramid(state,false);
  state.longDarkExchangeResolved = true;
  state.pendingAction = undefined;
  runSetupQueue(state);
}
function handleSimultaneousChoice(state: FellowshipGameState, item: FellowshipSeat, action: Extract<FellowshipAction, {type:'setup_choice'}>): void {
  const ex = state.exchange!;
  const expected = state.pendingAction?.targetSeatIds || [];
  const cardsBySeat = action.cardsBySeat || {};
  if (Object.keys(cardsBySeat).length !== expected.length || expected.some(id => !cardsBySeat[id])) fail('각 상대에게 보낼 카드를 하나씩 골라야 합니다.');
  const offered = Object.values(cardsBySeat);
  if (new Set(offered).size !== offered.length || offered.some(id => !canOfferCard(state, item, id))) fail('보낼 수 없는 카드가 포함되어 있습니다.');
  ex.submitted[item.id] = cardsBySeat;
  ex.remaining.shift();
  setSimultaneousPending(state);
}
function startNormalExchangeReturn(state: FellowshipGameState, initiator: FellowshipSeat, target: FellowshipSeat, cardId: string): void {
  const outgoingSlot = initiator.id === '__pyramid__' ? state.pyramid.find(p => p.cardId === cardId && !p.removed) : undefined;
  const card = takeCard(initiator, cardId);
  if (outgoingSlot) outgoingSlot.removed = true;
  target.hand.push(card);
  if (target.id === '__pyramid__') state.pyramid.push({ row: -1, col: state.pyramid.length, cardId: card.id, faceUp: true, removed: false });
  state.exchange = { kind: 'normal', initiatorSeatId: initiator.id, targets: [target.id], targetSeatId: target.id, sentCardId: card.id, remaining: [], submitted: {} };
  state.pendingAction = setupChoicePrompt(state, 'exchange_return', target, undefined, { targetSeatId: initiator.id });
}
function finishNormalExchange(state: FellowshipGameState, target: FellowshipSeat, cardId: string): void {
  const ex = state.exchange!;
  const initiator = seat(state, ex.initiatorSeatId!);
  const outgoingSlot = target.id === '__pyramid__' ? state.pyramid.find(p => p.cardId === cardId && !p.removed) : undefined;
  const card = takeCard(target, cardId);
  if (outgoingSlot) outgoingSlot.removed = true;
  initiator.hand.push(card);
  if (target.id === '__pyramid__') {
    const incoming = target.hand.find(c => c.id === ex.sentCardId);
    if (incoming && outgoingSlot) {
      state.pyramid = state.pyramid.filter(p => !(p.row === -1 && p.cardId === incoming.id));
      outgoingSlot.cardId = incoming.id; outgoingSlot.removed = false; outgoingSlot.faceUp = true;
    }
  }
  if (initiator.id === '__pyramid__') {
    const old = state.pyramid.find(p => p.cardId === ex.sentCardId && p.removed);
    if (old) { old.cardId = card.id; old.removed = false; old.faceUp = true; }
    else state.pyramid.push({ row: -1, col: state.pyramid.length, cardId: card.id, faceUp: true, removed: false });
  }
  refreshPyramid(state, false);
  state.exchange = undefined;
  runSetupQueue(state);
}

function handleSetupChoice(state: FellowshipGameState, playerId: string, action: Extract<FellowshipAction, {type:'setup_choice'}>): void {
  const pending = state.pendingAction;
  if (!pending) fail('선택해야 할 준비 행동이 없습니다.');
  const item = actorSeat(state, playerId, pending.seatId);
  if (pending.type === 'choose_solo_exchanger') {
    if (!pending.options?.some(o => o.id === action.choiceId)) fail('교환할 캐릭터를 선택하세요.');
    state.soloExchangeActor = action.choiceId;
    runSetupQueue(state); return;
  }
  if (pending.type === 'simultaneous_exchange' || pending.type === 'donate_right') {
    handleSimultaneousChoice(state, item, action); return;
  }
  if (pending.type === 'long_dark_return') {
    const expected = pending.targetSeatIds || [];
    const cardsBySeat = action.cardsBySeat || {};
    if (Object.keys(cardsBySeat).length !== expected.length || expected.some(id => !cardsBySeat[id])) fail('교환에 응할 카드를 모두 선택하세요.');
    const reserved = state.longDarkPlans.filter(p => p.from === item.id).map(p => p.cardId);
    const chosen = Object.values(cardsBySeat);
    if (new Set([...reserved,...chosen]).size !== reserved.length + chosen.length || chosen.some(id => !canOfferCard(state,item,id))) fail('동시 교환에 사용할 수 없는 카드입니다.');
    state.longDarkReturns.push(...expected.map(target => ({from:item.id,to:target,cardId:cardsBySeat[target]})));
    state.longDarkReturnQueue.shift();
    setLongDarkReturnPending(state);
    return;
  }
  if (pending.type === 'choose_threat') {
    const chosen = action.choiceId;
    if (!pending.options?.some(o => o.id === chosen)) fail('유효한 위협값을 선택하세요.');
    if (chosen?.includes('-')) {
      item.threatChoice = chosen.split('-').map(Number);
      state.giftUsed.push('broken_sword');
    } else {
      item.threatChoice = Number(chosen);
      if (item.threatValues.length === 0) {
        const index = state.threatDeck.indexOf(Number(chosen));
        if (index < 0) fail('선택한 위협 카드가 덱에 없습니다.');
        state.threatDeck.splice(index, 1);
      }
    }
    if (hasCharacter(state, 'meriadoc') && !chosen?.includes('-')) {
      state.pendingAction = setupChoicePrompt(state, 'threat_redraw', item, [{id:'keep',label:'유지'}, {id:'redraw',label:'다시 뽑기'}]);
    } else runSetupQueue(state);
    return;
  }
  if (pending.type === 'threat_redraw') {
    if (action.choiceId !== 'keep' && action.choiceId !== 'redraw') fail('위협 카드를 유지하거나 다시 뽑으세요.');
    if (action.choiceId === 'redraw') { const value = drawThreat(state, item); item.threatValues.push(value); item.threatChoice = value; }
    runSetupQueue(state); return;
  }
  if (pending.type === 'choose_comparison') {
    if (action.choiceId !== 'more' && action.choiceId !== 'fewer') fail('더 많이 또는 더 적게를 선택하세요.');
    item.comparison = action.choiceId;
    runSetupQueue(state); return;
  }
  if (pending.type === 'exchange_start') {
    const targetId = action.targetSeatId || action.choiceId;
    if (!targetId || !pending.options?.some(o => o.id === targetId)) fail('교환 대상을 선택하세요.');
    if (!action.cardId || !canOfferCard(state, item, action.cardId)) fail('교환할 손패 카드를 선택하세요.');
    if (targetId === 'lost') {
      const lost = state.lostCards.shift();
      if (!lost) fail('유실 카드가 없습니다.');
      if (state.chapterNumber === 16 && item.characterId === 'galadriel') {
        const offered = findCard(item, action.cardId);
        const needed = state.seats.some(other => other.id !== item.id && other.threatChoice !== undefined && (() => {
          const goal = goalFor(state, other);
          const suits = goal.kind === 'target_suit_rank' ? [goal.params.suit] : goal.kind === 'multi_target_suit_rank' ? goal.params.suits : [];
          return suits.some((suit: Suit) => offered?.suit === suit && (Array.isArray(other.threatChoice) ? other.threatChoice.includes(offered.rank) : other.threatChoice === offered.rank));
        })());
        if (needed) { state.lostCards.unshift(lost); fail('다른 캐릭터의 위협 목표 카드는 유실 카드와 바꿀 수 없습니다.'); }
      }
      const offered = takeCard(item, action.cardId);
      state.lostCards.unshift(offered); item.hand.push(lost);
      runSetupQueue(state); return;
    }
    const target = seat(state, targetId);
    if (pending.longDark) {
      if (state.longDarkPlans.some(p => p.from === item.id && p.cardId === action.cardId)) fail('동시 교환에서 같은 카드를 다시 사용할 수 없습니다.');
      state.longDarkPlans.push({from:item.id,to:target.id,cardId:action.cardId});
      runSetupQueue(state); return;
    }
    if (pending.simultaneous) {
      state.exchange = { kind: 'simultaneous', initiatorSeatId: item.id, targets: [target.id], remaining: [target.id], submitted: { [item.id]: { [target.id]: action.cardId } } };
      setSimultaneousPending(state); return;
    }
    startNormalExchangeReturn(state, item, target, action.cardId); return;
  }
  if (pending.type === 'exchange_return') {
    if (!action.cardId || !canOfferCard(state, item, action.cardId)) fail('돌려줄 카드를 선택하세요.');
    finishNormalExchange(state, item, action.cardId); return;
  }
  if (pending.type === 'donate') {
    if (!action.cardId || !canOfferCard(state, item, action.cardId)) fail('줄 카드를 선택하세요.');
    const target = seat(state, pending.targetSeatId as string);
    const slot = item.id === '__pyramid__' ? state.pyramid.find(p => p.cardId === action.cardId && !p.removed) : undefined;
    target.hand.push(takeCard(item, action.cardId));
    if (slot) slot.removed = true;
    if (target.id === '__pyramid__') state.pyramid.push({ row: -1, col: state.pyramid.length, cardId: action.cardId, faceUp: true, removed: false });
    refreshPyramid(state, false); runSetupQueue(state); return;
  }
  if (['tuck_card', 'precommit_last_card', 'preplay_first_card'].includes(pending.type)) {
    if (!action.cardId || !canOfferCard(state, item, action.cardId)) fail('손패 카드를 선택하세요.');
    const card = takeCard(item, action.cardId);
    if (pending.type === 'tuck_card') item.tucked = card;
    if (pending.type === 'precommit_last_card') item.presetLast = card;
    if (pending.type === 'preplay_first_card') {
      if (action.trump && card.id !== 'rings-1') fail('반지 1만 트럼프로 낼 수 있습니다.');
      item.presetFirst = card; item.presetFirstTrump = Boolean(action.trump);
    }
    if (item.id === '__pyramid__') {
      const slot = state.pyramid.find(p => p.cardId === card.id && !p.removed);
      if (slot) slot.removed = true;
      refreshPyramid(state, false);
    }
    if (pending.type === 'preplay_first_card' && card.suit === 'rings') state.ringTokenActive = true;
    runSetupQueue(state); return;
  }
  fail(`지원하지 않는 준비 선택: ${pending.type}`);
}

function firstLeader(state: FellowshipGameState): FellowshipSeat {
  const byId = (id: string) => state.seats.find(s => s.characterId === id);
  if (state.chapterNumber === 18 && state.currentGroup === 'second_group') return seat(state, state.ringHolderSeatId!);
  if (state.chapterNumber === 9) return byId('glorfindel')!;
  if (state.chapterNumber === 10) return byId('elrond')!;
  if (state.chapterNumber === 12) return byId('gandalf')!;
  if (state.chapterNumber === 15) return byId('orophin_rumil')!;
  return state.seats.find(s => setupRuleActions(state, s).some((rule: any) => rule.kind === 'lead_first')) || seat(state, state.ringHolderSeatId!);
}
function beginPlay(state: FellowshipGameState): void {
  state.phase = 'play';
  state.pendingAction = undefined;
  let leader = firstLeader(state);
  if (leader.hand.length === 0 && !leader.presetLast) leader = nextSeat(state, leader.id, s => s.hand.length > 0 || Boolean(s.presetLast))!;
  state.currentLeader = leader.id;
  state.currentTurn = leader.id;
  const radagast = state.seats.find(s => s.presetFirst);
  if (radagast) {
    const card = radagast.presetFirst!;
    radagast.presetFirst = undefined;
    state.trick.push({ seatId: radagast.id, card, trump: Boolean(radagast.presetFirstTrump) });
    if (card.suit === 'rings') state.ringTokenActive = true;
  }
  revealEventChallenge(state);
}
function revealEventChallenge(state: FellowshipGameState): void {
  state.pendingEventCard = undefined; state.pendingBalrogCards = undefined;
  if (state.chapterNumber === 5) {
    const card = state.eventDeck.shift();
    if (!card) fail('버드나무 카드가 부족합니다.');
    state.pendingEventCard = card;
  }
  if (state.chapterNumber === 14 && state.currentEvent === 'bridge_of_khazad_dum') {
    const count = state.playerIds.length === 2 || state.playerIds.length === 3 ? 2 : 3;
    state.pendingBalrogCards = [];
    while (state.pendingBalrogCards.length < count) {
      if (!state.eventDeck.length) {
        const fresh = baseDeck().filter(c => c.suit === 'shadows');
        fresh.push({ id: 'shadows-5-balrog', suit: 'shadows', rank: 5, special: 'balrog' });
        state.eventDeck = shuffle(state, fresh);
      }
      state.pendingBalrogCards.push(state.eventDeck.shift()!);
    }
  }
}
function trickLeadSuit(state: FellowshipGameState): Suit | undefined {
  return state.trick.find(play => play.seatId === state.currentLeader)?.card.suit;
}
function activeSeatsForTrick(state: FellowshipGameState): FellowshipSeat[] {
  return state.seats.filter(s => s.hand.length > 0 || Boolean(s.presetLast) || Boolean(s.presetFirst) || Boolean(s.tucked));
}
function nextToPlay(state: FellowshipGameState, afterId: string): FellowshipSeat | undefined {
  for (let i = 1; i <= state.seats.length; i++) {
    const s = state.seats[(indexOfSeat(state, afterId) + i) % state.seats.length];
    if (state.trick.some(p => p.seatId === s.id)) continue;
    if (s.hand.length > 0 || s.presetLast || s.tucked) return s;
  }
  return undefined;
}
function finishRoundWithFailure(state: FellowshipGameState, reason: string, failedSeatIds: string[] = []): void {
  state.phase = 'round_end'; state.pendingAction = undefined; state.pendingFailure = undefined;
  state.giftUsed = [...state.roundGiftUsedAtStart];
  state.result = { success: false, message: reason, failedSeatIds };
}
function playCard(state: FellowshipGameState, playerId: string, action: Extract<FellowshipAction, {type:'play_card'}>): void {
  if (state.phase !== 'play') fail('지금은 카드를 낼 수 없습니다.');
  if (state.pendingAction?.type === 'gift_save') fail('먼저 선물 사용 여부를 결정하세요.');
  const item = actorSeat(state, playerId, state.currentTurn!);
  const legal = legalPlayCards(state, item);
  if (!legal.some(c => c.id === action.cardId)) fail('문양 따르기 또는 반지 선 규칙에 어긋납니다.');
  const card = item.presetLast?.id === action.cardId && item.hand.length === 0 ? (item.presetLast = undefined, legal.find(c => c.id === action.cardId)!) : takeCard(item, action.cardId);
  const isLead = item.id === state.currentLeader && !trickLeadSuit(state);
  if (isLead && ((item.curses.includes('morgul_knife') && card.suit === 'rings') || (item.curses.includes('terror') && card.suit === 'hills'))) {
    finishRoundWithFailure(state, `${item.name}의 저주를 위반했습니다.`, [item.id]); return;
  }
  if (action.trump && card.id !== 'rings-1') fail('반지 1만 선택적으로 트럼프가 될 수 있습니다.');
  if (item.id === '__pyramid__') {
    const slot = state.pyramid.find(p => !p.removed && p.cardId === card.id);
    if (slot) slot.removed = true;
    refreshPyramid(state, true);
  }
  state.trick.push({ seatId: item.id, card, trump: Boolean(action.trump), hiddenUntilComplete: state.chapterNumber === 15 && item.characterId === 'gimli' && state.playerIds.length > 1 && card.id !== 'rings-1' });
  if (card.suit === 'rings') state.ringTokenActive = true;
  const next = nextToPlay(state, item.id);
  if (next) { state.currentTurn = next.id; return; }
  finishTrick(state);
}
function determineTrickWinner(state: FellowshipGameState, plays: FellowshipTrickPlay[], leadSuit: Suit): FellowshipTrickPlay {
  const ringTrump = plays.find(p => p.card.id === 'rings-1' && p.trump);
  if (ringTrump) return ringTrump;
  if (state.chapterNumber === 17) {
    const rivers = plays.filter(p => p.card.suit === 'rivers');
    if (rivers.length) return rivers.reduce((best, p) => p.card.rank > best.card.rank ? p : best);
  }
  const following = plays.filter(p => p.card.suit === leadSuit);
  if (!following.length) fail('트릭의 선 문양 카드를 찾지 못했습니다.');
  return following.reduce((best, p) => p.card.rank > best.card.rank ? p : best);
}
function finishTrick(state: FellowshipGameState): void {
  const lead = trickLeadSuit(state);
  if (!lead) fail('트릭 선 문양이 설정되지 않았습니다.');
  const number = state.history.length + 1;
  const plays = state.trick.map(p => ({ ...p, hiddenUntilComplete: false }));
  const winnerPlay = determineTrickWinner(state, plays, lead);
  let winnerSeatId: string | undefined = winnerPlay.seatId;
  if (state.chapterNumber === 5 && state.pendingEventCard && !winnerPlay.trump && winnerPlay.card.rank < state.pendingEventCard.rank) winnerSeatId = undefined;
  const record: FellowshipTrick = { number, leaderSeatId: state.currentLeader!, leadSuit: lead, plays, winnerSeatId, eventCard: state.pendingEventCard, balrogCards: state.pendingBalrogCards };
  state.history.push(record);
  if (winnerSeatId) {
    const winner = seat(state, winnerSeatId);
    winner.wonTricks.push(number);
    winner.won.push(...plays.map(p => p.card));
    if (winner.curses.includes('black_breath') && plays.some(p => p.card.rank === 8)) {
      finishRoundWithFailure(state, `${winner.name}의 검은 숨결 저주를 위반했습니다.`, [winner.id]); return;
    }
  }
  if (state.pendingBalrogCards && plays.reduce((n,p) => n + p.card.rank, 0) < state.pendingBalrogCards.reduce((n,c) => n + c.rank, 0)) {
    finishRoundWithFailure(state, '발록의 힘을 막지 못했습니다.'); return;
  }
  state.trick = [];
  for (const p of state.pyramid) if (p.flipAtTrickEnd) { p.faceUp = true; p.flipAtTrickEnd = false; }
  if (state.playerIds.length === 1 && state.deck.length) {
    for (const s of state.seats) if (!s.forcedFullHand && state.deck.length) s.hand.push(state.deck.shift()!);
  }
  for (const s of state.seats) if (!s.hand.length && s.tucked) { s.hand.push(s.tucked); s.tucked = undefined; }
  if (roundCardsExhausted(state)) { evaluateRound(state); return; }
  let newLeader = seat(state, winnerSeatId || record.leaderSeatId);
  if (!newLeader.hand.length && !newLeader.presetLast) newLeader = nextSeat(state, newLeader.id, s => s.hand.length > 0 || Boolean(s.presetLast))!;
  state.currentLeader = newLeader.id;
  state.currentTurn = newLeader.id;
  revealEventChallenge(state);
  detectPermanentGoalFailure(state);
}
function roundCardsExhausted(state: FellowshipGameState): boolean {
  if (state.playerIds.length === 1 && state.deck.length) return false;
  return state.seats.every(s => {
    if (s.presetLast || s.tucked) return false;
    return s.hand.length <= s.retainedCardsCount;
  });
}

function goalSatisfied(state: FellowshipGameState, item: FellowshipSeat): boolean {
  if (state.forgivenGoalSeatIds.includes(item.id)) return true;
  const goal = goalFor(state, item);
  const p = goal.params || {};
  const count = item.wonTricks.length;
  const threat = item.threatChoice;
  const threatMatches = (value: number): boolean => Array.isArray(threat) ? threat.includes(value) : threat === value;
  const capturedCount = (suit: Suit, rank?: number): number => item.won.filter(c => c.suit === suit && (rank === undefined || c.rank === rank)).length;
  if (Array.isArray(p.forbiddenCardIds) && item.won.some(c => p.forbiddenCardIds.includes(c.id))) return false;
  if (p.forbiddenSuit && item.won.some(c => c.suit === p.forbiddenSuit)) return false;
  switch (goal.kind) {
    case 'none': return true;
    case 'rings_count': {
      const fromSam = state.seats.filter(s => s.characterId === 'samwise').flatMap(s => s.won).filter(c => c.suit === 'rings').length;
      return capturedCount('rings') + (item.characterId === 'frodo' ? fromSam : 0) >= Number(p.minimum);
    }
    case 'trick_count_min': return count >= Number(p.minimum);
    case 'trick_count_exact': return count === Number(p.exact);
    case 'trick_count_range': return count >= Number(p.minimum) && count <= Number(p.maximum);
    case 'trick_count_exact_threat': return Array.isArray(threat) ? threat.includes(count) : count === threat;
    case 'fewest_tricks': return state.seats.every(other => other.id === item.id || count <= other.wonTricks.length);
    case 'most_suit_cards': return state.seats.every(other => other.id === item.id || capturedCount(p.suit) > other.won.filter(c => c.suit === p.suit).length);
    case 'target_suit_rank': return item.won.some(c => c.suit === p.suit && threatMatches(c.rank));
    case 'target_rank_count': return item.won.filter(c => threatMatches(c.rank)).length >= Number(p.minimum);
    case 'last_trick_play_suit': return state.history[state.history.length - 1]?.plays.some(play => play.seatId === item.id && play.card.suit === p.suit) || false;
    case 'retained_suit_set_count': return item.hand.some(c => capturedCount(c.suit) >= Number(p.minimum));
    case 'consecutive_tricks_exact': {
      if (count !== Number(p.exact)) return false;
      return item.wonTricks.every((n, i) => i === 0 || n === item.wonTricks[i - 1] + 1);
    }
    case 'ring_only_trick_wins': {
      const own = state.history.filter(t => t.winnerSeatId === item.id);
      return own.filter(t => t.plays.some(play => play.card.suit === 'rings')).length >= Number(p.minimum)
        && own.every(t => t.plays.some(play => play.card.suit === 'rings'));
    }
    case 'late_trick_win': return item.wonTricks.some(n => n > state.history.length - Number(p.finalTrickWindow));
    case 'trick_count_vs_threat': {
      if (typeof threat !== 'number' || !item.comparison) return false;
      return item.comparison === 'more' ? count > threat : count < threat;
    }
    case 'all_players_rings': return state.seats.every(s => s.won.some(c => c.suit === 'rings'));
    case 'last_trick_win': return state.history[state.history.length - 1]?.winnerSeatId === item.id;
    case 'tricks_with_suit_min': return state.history.filter(t => t.winnerSeatId === item.id && t.plays.some(play => play.card.suit === p.suit)).length >= Number(p.minimum);
    case 'all_ranks_won': return (p.ranks || [1,2,3,4,5,6,7,8]).every((rank: number) => item.won.some(c => c.rank === rank));
    case 'all_suits_won': return (p.suits || []).every((suit: Suit) => capturedCount(suit) >= 1);
    case 'consecutive_rank_suit_count': {
      const ranks = [...new Set(item.won.filter(c => c.suit === p.suit).map(c => c.rank))].sort((a,b) => a-b);
      let streak = 0, prior = -2;
      for (const rank of ranks) { streak = rank === prior + 1 ? streak + 1 : 1; if (streak >= Number(p.minimum)) return true; prior = rank; }
      return false;
    }
    case 'same_rank_count': return Array.from({length:9}, (_, i) => i + 1).some(rank => item.won.filter(c => c.rank === rank).length >= Number(p.minimum));
    case 'middle_trick_count': return state.seats.some(s => s.wonTricks.length < count) && state.seats.some(s => s.wonTricks.length > count);
    case 'zero_tricks_others_win': return count === 0 && state.seats.every(s => s.id === item.id || s.wonTricks.length >= Number(p.othersMinimum));
    case 'multi_target_suit_rank': return (p.suits || []).every((suit: Suit) => item.won.some(c => c.suit === suit && threatMatches(c.rank)));
    case 'suit_card_count_exact': return capturedCount(p.suit) === Number(p.exact);
    default: fail(`아직 구현되지 않은 목표 규칙: ${goal.kind}`);
  }
}
function evaluateRound(state: FellowshipGameState): void {
  const failed = state.seats.filter(s => !goalSatisfied(state, s));
  state.objectivesEvaluated = true;
  state.failedObjectiveSeatIds = failed.map(s => s.id);
  if (failed.length === 1 && state.seats.some(s => s.gifts.includes('mithril_shirt')) && !state.giftUsed.includes('mithril_shirt')) {
    const holder = state.seats.find(s => s.gifts.includes('mithril_shirt'))!;
    state.pendingFailure = { seatId: failed[0].id, reason: `${failed[0].name}의 목표를 달성하지 못했습니다.`, resume: false };
    state.pendingAction = { type: 'gift_save', seatId: holder.id, prompt: `${failed[0].name}의 실패를 미스릴 셔츠로 구할까요?`, options: [{id:'yes',label:'사용'}, {id:'no',label:'사용하지 않음'}] };
    return;
  }
  if (failed.length) { finishRoundWithFailure(state, '목표를 달성하지 못했습니다.', failed.map(s => s.id)); return; }
  finishRoundSuccess(state);
}
function detectPermanentGoalFailure(state: FellowshipGameState): void {
  const failed = state.seats.filter(item => {
    if (state.forgivenGoalSeatIds.includes(item.id)) return false;
    const goal = goalFor(state, item), p = goal.params || {}, n = item.wonTricks.length;
    if (p.forbiddenSuit && item.won.some(c => c.suit === p.forbiddenSuit)) return true;
    if (Array.isArray(p.forbiddenCardIds) && item.won.some(c => p.forbiddenCardIds.includes(c.id))) return true;
    if (goal.kind === 'trick_count_exact' && n > Number(p.exact)) return true;
    if (goal.kind === 'trick_count_range' && n > Number(p.maximum)) return true;
    if (goal.kind === 'trick_count_exact_threat' && item.threatChoice !== undefined && n > (Array.isArray(item.threatChoice) ? Math.max(...item.threatChoice) : item.threatChoice)) return true;
    if (goal.kind === 'consecutive_tricks_exact' && (n > Number(p.exact) || item.wonTricks.some((t,i) => i > 0 && t !== item.wonTricks[i-1]+1))) return true;
    if (goal.kind === 'ring_only_trick_wins' && state.history.some(t => t.winnerSeatId === item.id && !t.plays.some(play => play.card.suit === 'rings'))) return true;
    if (goal.kind === 'zero_tricks_others_win' && n > 0) return true;
    if (goal.kind === 'trick_count_vs_threat' && item.comparison === 'fewer' && typeof item.threatChoice === 'number' && n >= item.threatChoice) return true;
    return false;
  });
  if (!failed.length) return;
  state.failedObjectiveSeatIds = failed.map(s => s.id);
  if (failed.length === 1 && state.seats.some(s => s.gifts.includes('mithril_shirt')) && !state.giftUsed.includes('mithril_shirt')) {
    const holder = state.seats.find(s => s.gifts.includes('mithril_shirt'))!;
    state.pendingFailure = { seatId: failed[0].id, reason: `${failed[0].name}의 목표가 실패했습니다.`, resume: true };
    state.pendingAction = { type:'gift_save', seatId:holder.id, prompt:`${failed[0].name}의 실패를 미스릴 셔츠로 구할까요?`, options:[{id:'yes',label:'사용'},{id:'no',label:'사용하지 않음'}] };
  } else finishRoundWithFailure(state, '목표가 실패했습니다.', failed.map(s => s.id));
}
function finishRoundSuccess(state: FellowshipGameState): void {
  for (const item of state.seats) if (!state.completedCharacters.includes(item.characterId!)) state.completedCharacters.push(item.characterId!);
  if (state.chapterNumber === 14 && state.currentEvent && !state.completedEvents.includes(state.currentEvent)) state.completedEvents.push(state.currentEvent);
  if (state.chapterNumber === 18 && state.currentGroup && !state.completedGroups.includes(state.currentGroup)) state.completedGroups.push(state.currentGroup);
  const chapter = activeChapter(state);
  let complete = chapter.mode === 'short';
  if (chapter.mode === 'special') complete = state.completedGroups.includes('first_group') && state.completedGroups.includes('second_group');
  if (chapter.mode === 'long') {
    const core = chapter.characters.filter((id: string) => !(chapter.optional || []).includes(id));
    complete = core.every((id: string) => state.completedCharacters.includes(id));
    if (state.chapterNumber === 14) complete = complete && ['doors_of_durin', 'balins_tomb', 'long_dark', 'bridge_of_khazad_dum'].every(id => state.completedEvents.includes(id));
  }
  state.phase = complete ? 'chapter_complete' : 'round_end';
  state.pendingAction = undefined; state.pendingFailure = undefined;
  state.result = { success: true, message: complete ? `챕터 ${state.chapterNumber} 완료` : `라운드 ${state.round} 성공. 다음 라운드를 진행하세요.` };
}

export function applyFellowshipAction(input: FellowshipGameState, playerId: string, action: FellowshipAction): FellowshipGameState {
  if (!input.playerIds.includes(playerId)) fail('방 참가자가 아닙니다.');
  if (!action || typeof action.type !== 'string') fail('행동이 올바르지 않습니다.');
  const state = clone(input);
  if (action.type === 'choose_event') {
    if (state.phase !== 'event_selection' || state.chapterNumber !== 14 || state.pendingAction?.type !== 'choose_event') fail('지금은 사건을 선택할 수 없습니다.');
    actorSeat(state, playerId, state.pendingAction.seatId);
    if (!moriaEventOptions(state).includes(action.eventId)) fail('선택할 수 없는 모리아 사건입니다.');
    state.currentEvent = action.eventId;
    if (action.eventId === 'bridge_of_khazad_dum') { const ringHolder = state.ringHolderSeatId; state.round -= 1; dealRound(state, ringHolder); }
    else { state.phase = 'character_selection'; setSelectionPending(state); }
    return state;
  }
  if (action.type === 'choose_group') {
    if (state.phase !== 'event_selection' || state.chapterNumber !== 18 || state.pendingAction?.type !== 'choose_group') fail('지금은 일행을 선택할 수 없습니다.');
    actorSeat(state, playerId, state.pendingAction.seatId);
    if (!['first_group', 'second_group'].includes(action.groupId) || state.completedGroups.includes(action.groupId)) fail('이미 완료했거나 존재하지 않는 일행입니다.');
    state.currentGroup = action.groupId;
    state.phase = 'character_selection';
    setSelectionPending(state);
    return state;
  }
  if (action.type === 'select_character') {
    if (state.phase !== 'character_selection') fail('지금은 캐릭터를 선택할 수 없습니다.');
    const item = actorSeat(state, playerId, state.selectionOrder[state.selectionIndex]);
    if (!selectableCharacters(state).includes(action.characterId)) fail('선택할 수 없는 캐릭터입니다.');
    item.characterId = action.characterId;
    state.selectionIndex += 1;
    setSelectionPending(state);
    return state;
  }
  if (action.type === 'setup_choice') {
    if (state.phase !== 'setup') fail('준비 행동을 선택할 때가 아닙니다.');
    handleSetupChoice(state, playerId, action); return state;
  }
  if (action.type === 'play_card') { playCard(state, playerId, action); return state; }
  if (action.type === 'use_gift') {
    if (state.phase !== 'play' || state.pendingAction?.type !== 'gift_save') fail('사용할 선물이 없습니다.');
    actorSeat(state, playerId, state.pendingAction.seatId);
    if (!action.accept) finishRoundWithFailure(state, state.pendingFailure!.reason, [state.pendingFailure!.seatId]);
    else {
      const resume = state.pendingFailure!.resume;
      const savedSeatId = state.pendingFailure!.seatId;
      state.forgivenGoalSeatIds.push(savedSeatId);
      state.failedObjectiveSeatIds = state.failedObjectiveSeatIds.filter(id => id !== savedSeatId);
      state.giftUsed.push('mithril_shirt');
      state.pendingFailure = undefined; state.pendingAction = undefined;
      if (!resume) evaluateRound(state);
    }
    return state;
  }
  if (action.type === 'pass_lead') {
    if (state.phase !== 'play' || state.trick.length || state.currentTurn !== state.currentLeader) fail('지금은 선을 넘길 수 없습니다.');
    if (state.pendingAction?.type === 'gift_save') fail('먼저 선물 사용 여부를 결정하세요.');
    const leader = actorSeat(state, playerId, state.currentLeader!);
    if (leader.characterId !== 'bilbo_baggins') fail('빌보 배긴스만 선을 넘길 수 있습니다.');
    const target = seat(state, action.targetSeatId);
    if (target.id === leader.id || target.hand.length === 0) fail('선을 받을 캐릭터를 선택하세요.');
    state.currentLeader = target.id; state.currentTurn = target.id;
    return state;
  }
  if (action.type === 'untuck') {
    if (state.phase !== 'play' || state.trick.length) fail('트릭이 시작되기 전에만 카드를 꺼낼 수 있습니다.');
    if (state.pendingAction?.type === 'gift_save') fail('먼저 선물 사용 여부를 결정하세요.');
    const item = state.seats.find(s => s.controllerId === playerId && s.tucked);
    if (!item) fail('꺼낼 보관 카드가 없습니다.');
    item.hand.push(item.tucked!); item.tucked = undefined;
    if (item.id === '__pyramid__') state.pyramid.push({row:-1,col:state.pyramid.length,cardId:item.hand[item.hand.length-1].id,faceUp:true,removed:false});
    return state;
  }
  if (action.type === 'next_round') {
    if (state.phase !== 'round_end') fail('다음 라운드를 시작할 수 없습니다.');
    if (state.chapterNumber === 14) state.currentEvent = undefined;
    if (state.chapterNumber === 18) state.currentGroup = undefined;
    dealRound(state);
    return state;
  }
  fail(`지원하지 않는 행동: ${(action as any).type}`);
}

function objectiveStatusFor(state: FellowshipGameState, item: FellowshipSeat, canSeeThreat: boolean, isController: boolean): FellowshipObjectiveStatus | undefined {
  if (!item.characterId) return undefined;
  const goal = goalFor(state, item);
  const roundOver = state.phase === 'round_end' || state.phase === 'chapter_complete';
  // A status change can reveal the hidden threat rank even when the value itself is concealed.
  if (!canSeeThreat && ['target_suit_rank', 'target_rank_count', 'multi_target_suit_rank',
    'trick_count_exact_threat', 'trick_count_vs_threat'].includes(goal.kind)) return 'pending';
  // Strider's comparison is not otherwise included in the opponent's view.
  if (goal.kind === 'trick_count_vs_threat' && !isController && !roundOver) return 'pending';
  // Mithril has not decided the outcome yet; an over-limit goal is not final while the offer is open.
  if (state.pendingAction?.type === 'gift_save' && state.pendingFailure?.seatId === item.id) return 'pending';
  if (state.objectivesEvaluated) return goalSatisfied(state, item) ? 'complete' : 'failed';
  if (state.failedObjectiveSeatIds.includes(item.id) && state.phase === 'round_end') return 'failed';
  if (goal.kind === 'none') return 'complete';
  if (state.forgivenGoalSeatIds.includes(item.id)) {
    return state.result?.success === false ? 'pending' : 'complete';
  }
  // These goals cannot become false after they are met. Exact counts, comparisons against
  // other players, last-trick goals, and goals with forbidden cards stay pending until scored.
  const p = goal.params || {};
  if (p.forbiddenSuit || (Array.isArray(p.forbiddenCardIds) && p.forbiddenCardIds.length)) return 'pending';
  const monotone = ['rings_count', 'trick_count_min', 'target_suit_rank', 'target_rank_count',
    'tricks_with_suit_min', 'all_ranks_won', 'all_suits_won', 'consecutive_rank_suit_count',
    'same_rank_count', 'multi_target_suit_rank', 'all_players_rings'].includes(goal.kind)
    || (goal.kind === 'trick_count_vs_threat' && item.comparison === 'more');
  return monotone && goalSatisfied(state, item) ? 'complete' : 'pending';
}

export function getFellowshipPlayerView(state: FellowshipGameState, playerId?: string): Record<string, unknown> {
  const chapter = activeChapter(state);
  const handsBySeat: Record<string, Array<Record<string, unknown>>> = {};
  const legalCardsBySeat: Record<string, string[]> = {};
  const offerableCardsBySeat: Record<string, string[]> = {};
  const tuckedBySeat: Record<string, FellowshipCard | undefined> = {};
  const canControl = (s: FellowshipSeat) => Boolean(playerId && s.controllerId === playerId);
  for (const s of state.seats) {
    if (s.id === '__pyramid__') {
      handsBySeat[s.id] = state.pyramid.filter(p => !p.removed).map(p => {
        const card = s.hand.find(c => c.id === p.cardId);
        if (!card) return {id:`missing-${p.row}-${p.col}`,row:p.row,col:p.col,faceDown:true,covered:true};
        const covered = !pyramidIsUncovered(state, p);
        return p.faceUp ? {...card,row:p.row,col:p.col,faceDown:false,covered} : {id:`hidden-${p.row}-${p.col}`,row:p.row,col:p.col,faceDown:true,covered};
      });
    } else if (canControl(s) || s.revealedHand) handsBySeat[s.id] = s.hand.map(c => ({...c}));
    else handsBySeat[s.id] = [];
    legalCardsBySeat[s.id] = canControl(s) ? legalPlayCards(state, s).map(c => c.id) : [];
    offerableCardsBySeat[s.id] = canControl(s) ? playableCards(state, s).filter(c => canOfferCard(state, s, c.id) && !(state.pendingAction?.type === 'long_dark_return' && state.pendingAction.seatId === s.id && state.longDarkPlans.some(p => p.from === s.id && p.cardId === c.id))).map(c => c.id) : [];
    if (canControl(s)) tuckedBySeat[s.id] = s.tucked;
  }
  const pending = state.pendingAction ? {...state.pendingAction} : undefined;
  const selection = state.phase === 'character_selection' ? selectableCharacters(state) : [];
  const viewerSeat = state.seats.find(s => canControl(s) && s.id === state.currentTurn) || state.seats.find(canControl);
  const trick = state.trick.map(p => {
    if (p.hiddenUntilComplete && !canControl(seat(state, p.seatId))) return {seatId:p.seatId,card:{suit:p.card.suit,faceDown:true},trump:p.trump};
    return {...p};
  });
  const players = state.seats.map(s => {
    const canSeeThreat = state.phase === 'round_end' || state.phase === 'chapter_complete'
      || canControl(s) || (!s.curses.includes('unseen') && state.currentEvent !== 'long_dark');
    const objectiveStatus = objectiveStatusFor(state, s, canSeeThreat, canControl(s));
    return {
      id:s.id, name:s.name, controllerId:s.controllerId, characterId:s.characterId,
      characterName:s.characterId ? char(state,s)?.nameKo || char(state,s)?.name : undefined,
      handCount:s.hand.length + (s.presetLast ? 1 : 0), wonTricks:s.wonTricks.length, wonCards:s.won,
      threatChoice: canSeeThreat ? s.threatChoice : undefined,
      curses:s.curses, gifts:s.gifts, revealedHand:Boolean(s.revealedHand),
      goal:s.characterId ? goalFor(state,s).description : undefined,
      objective:s.characterId ? goalFor(state,s).description : undefined,
      objectiveStatus, objectiveComplete:objectiveStatus === 'complete',
    };
  });
  return {
    chapter:{number:chapter.number,title:chapter.title,titleKo:chapter.titleKo,mode:chapter.mode,summary:chapter.summary},
    phase:state.phase, round:state.round, playerCount:state.playerIds.length,
    players, hand:viewerSeat ? handsBySeat[viewerSeat.id] : [], handsBySeat, legalCardsBySeat, offerableCardsBySeat, tuckedBySeat,
    availableCharacters:selection.map(id => {
      const temporary = {...state.seats[0],characterId:id};
      return {id,name:(CHARACTERS as any)[id]?.name,nameKo:(CHARACTERS as any)[id]?.nameKo,
        objective:goalFor(state,temporary).description, required:requiredCharacters(state).includes(id),
        setup:setupRuleActions(state,temporary).map((rule: any) => rule.description)};
    }),
    currentTurn:state.currentTurn, currentLeader:state.currentLeader, ringHolderSeatId:state.ringHolderSeatId,
    trick, history:state.history, lostCards:state.lostCards, ringTokenActive:state.ringTokenActive,
    pendingAction:pending, eventCard:state.pendingEventCard, balrogCards:state.pendingBalrogCards,
    currentEvent:state.currentEvent, completedEvents:state.completedEvents, currentGroup:state.currentGroup, completedGroups:state.completedGroups,
    completedCharacters:state.completedCharacters, result:state.result, giftUsed:state.giftUsed, announcements:state.announcements,
    canPassLead:Boolean(viewerSeat && state.phase === 'play' && state.currentLeader === viewerSeat.id && state.currentTurn === viewerSeat.id && state.trick.length === 0 && viewerSeat.characterId === 'bilbo_baggins'),
    objectiveProgress:Object.fromEntries(state.seats.filter(s => s.characterId).map(s => [s.id,{wonTricks:s.wonTricks.length,wonCards:s.won.length,goal:goalFor(state,s).description}])),
  };
}
