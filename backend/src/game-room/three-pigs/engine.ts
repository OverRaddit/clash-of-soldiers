// 아기 돼지 삼형제의 아파트 짓기 엔진. 규칙과 해석은 docs/three-pigs-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export type CardKind = 'lot' | 'rebar' | 'concrete' | 'dynamite' | 'guard' | 'garden';
export type PigsPhase = 'playing' | 'finished';

export interface PigsCard { id: string; kind: CardKind }

/** 한 층: 철근이 먼저 올라가고 콘크리트가 올라가면 완성된다. */
export interface Floor { concrete: boolean }

export interface Apartment {
  lots: number;          // 터 장수 = 평수
  floors: Floor[];       // 아래층부터
  guard: number;         // 방범 마감재가 보호하는 층수 (0 = 없음). 이 층 이하는 다이너마이트 무효
  completed: boolean;    // 정원이 올라가 건설 완료
}

export interface PigsPlayer {
  id: string;
  name: string;
  hand: PigsCard[];
  apartments: Apartment[];   // 돼지 카드 3장 = 아파트 3채
}

export interface Standing { playerId: string; name: string; score: number; completed: number; rank: number; finisher: boolean }

export interface LastAction {
  playerId: string;
  type: 'play' | 'discard' | 'skip';
  kind?: CardKind;
  targetPlayerId?: string;
  apartmentIndex?: number;
  destroyedComplete?: boolean;
}

export interface PigsGameState {
  phase: PigsPhase;
  players: PigsPlayer[];
  turnIndex: number;      // players 배열에서 현재 차례
  turn: number;           // 1부터 세는 턴 번호
  deck: PigsCard[];
  discard: PigsCard[];
  reshuffles: number;
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  standings?: Standing[];
  finisherId?: string;
  lastAction?: LastAction;
  step: number;
  seed: number;
}

export type PigsAction =
  | { type: 'play'; cardId: string; targetPlayerId: string; apartmentIndex: number }
  | { type: 'discard'; cardId: string };

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 5;
export const APARTMENTS_PER_PLAYER = 3;
export const HAND_SIZE = 5;
/** 카드 구성. 원문은 장수를 N으로만 적어 두었다. 바꾸려면 여기만 고치면 된다. */
export const CARD_COUNTS: Record<CardKind, number> = { lot: 16, rebar: 26, concrete: 26, dynamite: 14, guard: 8, garden: 12 };
export const CARD_NAMES: Record<CardKind, string> = {
  lot: '터', rebar: '철근', concrete: '콘크리트', dynamite: '다이너마이트', guard: '방범 마감재', garden: '정원',
};
export const FLOOR_BONUS = { three: 1, five: 2 };

function mulberry32(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], random: () => number): T[] {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

export function buildDeck(): PigsCard[] {
  const deck: PigsCard[] = [];
  for (const kind of Object.keys(CARD_COUNTS) as CardKind[]) {
    for (let i = 1; i <= CARD_COUNTS[kind]; i++) deck.push({ id: `${kind}-${i}`, kind });
  }
  return deck;
}

function pushLog(state: PigsGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function playerOf(state: PigsGameState, playerId: string): PigsPlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return player;
}

function rng(state: PigsGameState): () => number {
  return mulberry32(state.seed + state.step * 7919 + state.turn * 104729);
}

function emptyApartment(): Apartment { return { lots: 0, floors: [], guard: 0, completed: false }; }

// --- 아파트 계산 ---

export function completeFloors(apartment: Apartment): number {
  return apartment.floors.filter(f => f.concrete).length;
}

export function hasUnfinishedTop(apartment: Apartment): boolean {
  const top = apartment.floors[apartment.floors.length - 1];
  return !!top && !top.concrete;
}

/** 아파트 점수 = 터 × 완성 층수, 3층 이상 +1, 5층 이상 +2 (둘 중 큰 쪽 하나만). */
export function apartmentScore(apartment: Apartment): number {
  const floors = completeFloors(apartment);
  const base = apartment.lots * floors;
  const bonus = floors >= 5 ? FLOOR_BONUS.five : floors >= 3 ? FLOOR_BONUS.three : 0;
  return base + bonus;
}

export function playerScore(player: PigsPlayer): number {
  return player.apartments.reduce((sum, a) => sum + apartmentScore(a), 0);
}

/** 카드를 그 아파트에 낼 수 없는 이유. 낼 수 있으면 null. */
export function placementError(kind: CardKind, actorId: string, ownerId: string, apartment: Apartment): string | null {
  const own = actorId === ownerId;
  if (kind === 'dynamite') {
    if (own) return '다이너마이트는 상대의 아파트에만 쓸 수 있습니다.';
    if (apartment.completed) return '정원이 올라간 아파트에는 다이너마이트를 쓸 수 없습니다.';
    if (apartment.floors.length === 0) return '터만 있는 아파트는 폭파할 수 없습니다.';
    if (apartment.floors.length <= apartment.guard) return '방범 마감재가 보호하는 층입니다.';
    return null;
  }
  if (!own) return '내 아파트에만 지을 수 있습니다.';
  if (apartment.completed) return '이미 건설이 완료된 아파트입니다.';
  switch (kind) {
    case 'lot':
      if (apartment.floors.some(f => f.concrete)) return '콘크리트가 올라간 아파트에는 터를 추가할 수 없습니다.';
      return null;
    case 'rebar':
      if (apartment.lots === 0) return '터를 먼저 놓아야 합니다.';
      if (hasUnfinishedTop(apartment)) return '위층 콘크리트를 먼저 올려야 합니다.';
      return null;
    case 'concrete':
      if (!hasUnfinishedTop(apartment)) return '콘크리트를 올릴 철근이 없습니다.';
      return null;
    case 'guard':
      if (completeFloors(apartment) <= apartment.guard) return '방범 마감재를 올릴 완성된 층이 없습니다.';
      return null;
    case 'garden':
      if (apartment.lots === 0 || apartment.floors.length === 0) return '터와 층이 있어야 정원을 올릴 수 있습니다.';
      if (hasUnfinishedTop(apartment)) return '맨 위층 콘크리트를 올린 뒤 정원을 놓을 수 있습니다.';
      return null;
    default:
      return '알 수 없는 카드입니다.';
  }
}

export interface Target { playerId: string; apartmentIndex: number }

export function legalTargets(state: PigsGameState, actorId: string, kind: CardKind): Target[] {
  const targets: Target[] = [];
  for (const owner of state.players) {
    owner.apartments.forEach((apartment, apartmentIndex) => {
      if (placementError(kind, actorId, owner.id, apartment) === null) targets.push({ playerId: owner.id, apartmentIndex });
    });
  }
  return targets;
}

// --- 초기화 ---

export function initializePigsGame(playerIds: string[], playerNames: string[], seed?: number): PigsGameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`아기 돼지 삼형제는 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(actualSeed);
  const deck = shuffle(buildDeck(), random);
  const state: PigsGameState = {
    phase: 'playing',
    players: playerIds.map((id, i) => ({
      id, name: playerNames[i] ?? `돼지 ${i + 1}`,
      hand: deck.splice(0, HAND_SIZE),
      apartments: Array.from({ length: APARTMENTS_PER_PLAYER }, emptyApartment),
    })),
    turnIndex: Math.floor(random() * playerIds.length),
    turn: 1,
    deck,
    discard: [],
    reshuffles: 0,
    log: [],
    step: 0,
    seed: actualSeed,
  };
  const first = state.players[state.turnIndex];
  pushLog(state, `모두 돼지 카드 3장과 손패 ${HAND_SIZE}장을 받았습니다.`);
  pushLog(state, `가장 높은 층에 사는 돼지 대신 무작위로 ${first.name}이(가) 선플레이어가 되었습니다.`);
  drawForCurrent(state);
  state.result = { message: `${first.name}의 차례입니다. 카드 1장을 사용하거나 버리세요.` };
  return state;
}

// --- 턴 진행 ---

function drawOne(state: PigsGameState): PigsCard | undefined {
  if (state.deck.length === 0 && state.discard.length > 0) {
    state.deck = shuffle(state.discard, rng(state));
    state.discard = [];
    state.reshuffles += 1;
    pushLog(state, '덱이 떨어져 버린 카드를 섞어 새 덱을 만들었습니다.');
  }
  return state.deck.shift();
}

/** 현재 차례 플레이어가 턴 시작 시 1장을 뽑는다. */
function drawForCurrent(state: PigsGameState) {
  const player = state.players[state.turnIndex];
  const card = drawOne(state);
  if (card) player.hand.push(card);
}

function advanceTurn(state: PigsGameState) {
  // 아무 카드도 남지 않으면 더 진행할 수 없으므로 점수로 끝낸다.
  for (let guard = 0; guard < state.players.length; guard++) {
    state.turnIndex = (state.turnIndex + 1) % state.players.length;
    state.turn += 1;
    drawForCurrent(state);
    const player = state.players[state.turnIndex];
    if (player.hand.length > 0) return;
    pushLog(state, `${player.name}은(는) 손에 카드가 없어 차례를 넘깁니다.`);
  }
  pushLog(state, '더 이상 뽑거나 낼 카드가 없어 게임을 마칩니다.');
  finishGame(state);
}

function finishGame(state: PigsGameState, finisherId?: string) {
  state.phase = 'finished';
  state.finisherId = finisherId;
  const rows = state.players.map(p => ({
    playerId: p.id, name: p.name, score: playerScore(p),
    completed: p.apartments.filter(a => a.completed).length, finisher: p.id === finisherId, rank: 0,
  }));
  // 점수 내림차순, 동점이면 게임을 끝낸 사람이 앞선다. 그 외 동점은 공동 순위.
  rows.sort((a, b) => b.score - a.score || Number(b.finisher) - Number(a.finisher));
  rows.forEach((row, i) => {
    const prev = rows[i - 1];
    row.rank = prev && prev.score === row.score && prev.finisher === row.finisher ? prev.rank : i + 1;
  });
  state.standings = rows;
  const winners = rows.filter(r => r.rank === 1);
  pushLog(state, `최종 점수: ${rows.map(r => `${r.name} ${r.score}점`).join(', ')}`);
  pushLog(state, `${winners.map(w => w.name).join(', ')} 승리!`);
}

// --- 행동 적용 ---

export function applyPigsAction(input: PigsGameState, playerId: string, action: PigsAction): PigsGameState {
  const state = clone(input);
  state.result = undefined;
  if (!action || typeof action !== 'object') throw new Error('올바른 행동을 선택해주세요.');
  if (state.phase === 'finished') throw new Error('게임이 이미 끝났습니다.');
  const player = playerOf(state, playerId);
  if (state.players[state.turnIndex].id !== playerId) throw new Error('아직 당신 차례가 아닙니다.');
  if (typeof action.cardId !== 'string') throw new Error('손패에서 카드를 고르세요.');
  const handIndex = player.hand.findIndex(c => c.id === action.cardId);
  if (handIndex < 0) throw new Error('손에 없는 카드입니다.');
  const card = player.hand[handIndex];
  state.step += 1;

  if (action.type === 'discard') {
    player.hand.splice(handIndex, 1);
    state.discard.push(card);
    state.lastAction = { playerId, type: 'discard', kind: card.kind };
    pushLog(state, `${player.name}이(가) ${CARD_NAMES[card.kind]} 카드를 버렸습니다.`);
    state.result = { message: `${CARD_NAMES[card.kind]} 카드를 버렸습니다.` };
    advanceTurn(state);
    return state;
  }
  if (action.type !== 'play') throw new Error('알 수 없는 행동입니다.');

  const owner = playerOf(state, action.targetPlayerId);
  const apartmentIndex = action.apartmentIndex;
  if (!Number.isInteger(apartmentIndex) || apartmentIndex < 0 || apartmentIndex >= owner.apartments.length) {
    throw new Error('아파트를 고르세요.');
  }
  const apartment = owner.apartments[apartmentIndex];
  const error = placementError(card.kind, playerId, owner.id, apartment);
  if (error) throw new Error(error);

  player.hand.splice(handIndex, 1);
  const where = owner.id === playerId ? `${apartmentIndex + 1}호 아파트` : `${owner.name}의 ${apartmentIndex + 1}호 아파트`;
  const last: LastAction = { playerId, type: 'play', kind: card.kind, targetPlayerId: owner.id, apartmentIndex };
  switch (card.kind) {
    case 'lot':
      apartment.lots += 1;
      pushLog(state, `${player.name}이(가) ${where}에 터를 놓았습니다 (${apartment.lots}평).`);
      break;
    case 'rebar':
      apartment.floors.push({ concrete: false });
      pushLog(state, `${player.name}이(가) ${where} ${apartment.floors.length}층에 철근을 세웠습니다.`);
      break;
    case 'concrete':
      apartment.floors[apartment.floors.length - 1].concrete = true;
      pushLog(state, `${player.name}이(가) ${where} ${apartment.floors.length}층에 콘크리트를 부어 층을 완성했습니다.`);
      break;
    case 'guard':
      apartment.guard = completeFloors(apartment);
      pushLog(state, `${player.name}이(가) ${where} ${apartment.guard}층에 방범 마감재를 설치했습니다. 그 아래는 폭파할 수 없습니다.`);
      break;
    case 'dynamite': {
      const top = apartment.floors.pop()!;
      last.destroyedComplete = top.concrete;
      // 폭파된 층의 카드(철근, 있으면 콘크리트)와 다이너마이트는 즉시 버린다.
      state.discard.push({ id: `rebar-x${state.step}`, kind: 'rebar' });
      if (top.concrete) state.discard.push({ id: `concrete-x${state.step}`, kind: 'concrete' });
      pushLog(state, `${player.name}이(가) ${where} ${apartment.floors.length + 1}층을 다이너마이트로 폭파했습니다${top.concrete ? '' : ' (철근만 있던 층)'}.`);
      break;
    }
    case 'garden':
      apartment.completed = true;
      pushLog(state, `${player.name}이(가) ${where}에 정원을 꾸며 건설을 완료했습니다 (${apartment.lots}평 × ${completeFloors(apartment)}층 = ${apartmentScore(apartment)}점).`);
      break;
  }
  // 터·철근·콘크리트·방범·정원은 아파트 위에 남고, 다이너마이트만 버린 더미로 간다.
  if (card.kind === 'dynamite') state.discard.push(card);
  state.lastAction = last;
  state.result = { message: state.log[state.log.length - 1] };

  if (card.kind === 'garden' && owner.apartments.every(a => a.completed)) {
    pushLog(state, `${player.name}이(가) 세 아파트를 모두 완성해 게임이 끝났습니다.`);
    finishGame(state, playerId);
    const winners = state.standings!.filter(r => r.rank === 1).map(r => r.name).join(', ');
    state.result = { message: `${player.name}이(가) 세 아파트를 모두 완성했습니다. ${winners} 승리!` };
    return state;
  }
  advanceTurn(state);
  return state;
}

// --- 플레이어 시점 뷰 ---

export function getPigsPlayerView(state: PigsGameState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const myTurn = !!me && state.phase === 'playing' && state.players[state.turnIndex].id === me.id;
  return {
    phase: state.phase,
    turn: state.turn,
    currentPlayerId: state.phase === 'playing' ? state.players[state.turnIndex].id : null,
    deckCount: state.deck.length,
    discardCount: state.discard.length,
    discardTop: state.discard[state.discard.length - 1]?.kind ?? null,
    reshuffles: state.reshuffles,
    log: state.log,
    result: state.result ?? null,
    standings: state.standings ?? null,
    finisherId: state.finisherId ?? null,
    lastAction: state.lastAction ?? null,
    myId: me?.id ?? null,
    me: me ? {
      hand: me.hand.map(card => ({ ...card, targets: myTurn ? legalTargets(state, me.id, card.kind) : [] })),
    } : null,
    players: state.players.map(p => ({
      id: p.id,
      name: p.name,
      handCount: p.hand.length,
      isMe: p.id === playerId,
      score: playerScore(p),
      apartments: p.apartments.map(a => ({
        lots: a.lots, floors: a.floors, guard: a.guard, completed: a.completed,
        completeFloors: completeFloors(a), score: apartmentScore(a),
      })),
    })),
  };
}
