// 가챠 엔진. 규칙과 해석은 docs/gacha-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export type CharacterKind = 'A' | 'B' | 'C' | 'D';
export type GachaPhase = 'setup' | 'stocking' | 'pulling' | 'trading' | 'finished';

export interface GachaCard { id: string; kind: CharacterKind }

export type TradeItem = { type: 'coin' } | { type: 'card'; kind: CharacterKind };

export interface TradeOffer {
  id: number;
  from: string;
  to: string;
  give: TradeItem;   // from 이 주는 것
  want: TradeItem;   // from 이 받는 것
}

export interface Favorites { first: CharacterKind; second: CharacterKind }

export interface GachaPlayer {
  id: string;
  name: string;
  coins: number;
  hand: GachaCard[];          // 모은 캐릭터 카드 (비공개)
  favorites: Favorites | null; // 최애·차애 (게임 끝까지 비공개)
  setupCards: GachaCard[];     // 세팅 때 받은 종류별 1장
  pulled: GachaCard[];         // 이번 라운드에 뽑은 카드 (공개)
  pullDone: boolean;
  tradeDone: boolean;
}

export interface PullRecord { round: number; playerId: string; kind: CharacterKind }

export interface ScoreBreakdown { first: number; second: number; coins: number; setBonus: number }

export interface Standing {
  playerId: string;
  name: string;
  score: number;
  breakdown: ScoreBreakdown;
  favorites: Favorites;
  kindCounts: Record<CharacterKind, number>;
  coins: number;
  ownerOrder: number;  // 0 = 가장 먼저 사장님을 한 사람
  rank: number;
}

export interface GachaGameState {
  phase: GachaPhase;
  players: GachaPlayer[];
  round: number;        // 1부터
  totalRounds: number;
  startIndex: number;   // 1라운드 사장님
  ownerIndex: number;   // 이번 라운드 사장님
  turnIndex: number;    // pulling 단계에서 가챠를 돌릴 차례
  deck: GachaCard[];
  drawn: GachaCard[];   // 사장님이 덱에서 가져온 카드 (stocking 단계)
  machine: GachaCard[]; // 가챠기계 위의 뒷면 카드 (순서는 섞여 있음)
  offers: TradeOffer[];
  nextOfferId: number;
  pullHistory: PullRecord[];
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  standings?: Standing[];
  step: number;
  seed: number;
}

export type GachaAction =
  | { type: 'choose'; first: CharacterKind; second: CharacterKind }
  | { type: 'stock'; cardIds: string[] }
  | { type: 'pull'; slot: number }
  | { type: 'pass' }
  | { type: 'offer'; to: string; give: TradeItem; want: TradeItem }
  | { type: 'cancel'; offerId: number }
  | { type: 'accept'; offerId: number }
  | { type: 'decline'; offerId: number }
  | { type: 'done' };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const CHARACTER_KINDS: CharacterKind[] = ['A', 'B', 'C', 'D'];
export const CHARACTER_NAMES: Record<CharacterKind, string> = { A: '토끼', B: '고양이', C: '곰', D: '펭귄' };
/** 원문(4인 기준) 구성. 바꾸려면 여기만 고치면 된다. */
export const CARDS_PER_KIND = 13;
export const COINS_PER_PLAYER = 12;
export const ROUNDS_PER_PLAYER = 3;   // 각자 사장님을 3번씩
export const DRAW_COUNT = 4;          // 사장님이 덱에서 가져오는 장수
export const SCORE = { first: 3, second: 2, coin: 1, setBonus: 5, setSize: 2 };

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

export function buildCards(): GachaCard[] {
  const cards: GachaCard[] = [];
  for (const kind of CHARACTER_KINDS) {
    for (let i = 1; i <= CARDS_PER_KIND; i++) cards.push({ id: `${kind}-${i}`, kind });
  }
  return cards;
}

export function kindLabel(kind: CharacterKind): string { return `${kind} ${CHARACTER_NAMES[kind]}`; }

export function itemLabel(item: TradeItem): string {
  return item.type === 'coin' ? '코인 1개' : `${kindLabel(item.kind)} 카드`;
}

function pushLog(state: GachaGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 120) state.log.splice(0, state.log.length - 120);
}

function playerOf(state: GachaGameState, playerId: string): GachaPlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return player;
}

function rng(state: GachaGameState): () => number {
  return mulberry32(state.seed + state.step * 7919 + state.round * 104729);
}

function isKind(value: unknown): value is CharacterKind {
  return typeof value === 'string' && (CHARACTER_KINDS as string[]).includes(value);
}

function isItem(value: unknown): value is TradeItem {
  if (!value || typeof value !== 'object') return false;
  const item = value as { type?: unknown; kind?: unknown };
  if (item.type === 'coin') return true;
  return item.type === 'card' && isKind(item.kind);
}

export function kindCounts(cards: GachaCard[]): Record<CharacterKind, number> {
  const counts = { A: 0, B: 0, C: 0, D: 0 } as Record<CharacterKind, number>;
  for (const card of cards) counts[card.kind] += 1;
  return counts;
}

// --- 점수 ---

export function scoreOf(player: GachaPlayer): { score: number; breakdown: ScoreBreakdown } {
  const favorites = player.favorites ?? { first: 'A' as CharacterKind, second: 'B' as CharacterKind };
  const counts = kindCounts(player.hand);
  const breakdown: ScoreBreakdown = {
    first: counts[favorites.first] * SCORE.first,
    second: counts[favorites.second] * SCORE.second,
    coins: player.coins * SCORE.coin,
    setBonus: CHARACTER_KINDS.every(kind => counts[kind] >= SCORE.setSize) ? SCORE.setBonus : 0,
  };
  return { score: breakdown.first + breakdown.second + breakdown.coins + breakdown.setBonus, breakdown };
}

/** 선플레이어를 먼저 한 순서. 0이 1라운드 사장님. 동점 처리에 쓴다. */
export function ownerOrder(state: GachaGameState, playerIndex: number): number {
  return (playerIndex - state.startIndex + state.players.length) % state.players.length;
}

// --- 초기화 ---

export function initializeGachaGame(playerIds: string[], playerNames: string[], seed?: number): GachaGameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`가챠는 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(actualSeed);
  const all = buildCards();
  const players: GachaPlayer[] = playerIds.map((id, i) => ({
    id, name: playerNames[i] ?? `손님 ${i + 1}`,
    coins: COINS_PER_PLAYER,
    hand: [],
    favorites: null,
    // 종류별로 한 장씩: A-1, B-1, C-1, D-1 / A-2, ... 를 나눠 준다.
    setupCards: CHARACTER_KINDS.map(kind => all.find(c => c.id === `${kind}-${i + 1}`)!),
    pulled: [],
    pullDone: false,
    tradeDone: false,
  }));
  const dealt = new Set(players.flatMap(p => p.setupCards.map(c => c.id)));
  const startIndex = Math.floor(random() * playerIds.length);
  const state: GachaGameState = {
    phase: 'setup',
    players,
    round: 1,
    totalRounds: ROUNDS_PER_PLAYER * playerIds.length,
    startIndex,
    ownerIndex: startIndex,
    turnIndex: startIndex,
    deck: all.filter(c => !dealt.has(c.id)),   // 남은 카드. 고르지 않은 카드와 함께 섞는다.
    drawn: [],
    machine: [],
    offers: [],
    nextOfferId: 1,
    pullHistory: [],
    log: [],
    step: 0,
    seed: actualSeed,
  };
  pushLog(state, `모두 캐릭터 카드 ${CHARACTER_KINDS.length}장과 코인 ${COINS_PER_PLAYER}개를 받았습니다. 최애와 차애를 고르세요.`);
  pushLog(state, `${players[startIndex].name}이(가) 1라운드 사장님입니다. 총 ${state.totalRounds}라운드를 진행합니다.`);
  state.result = { message: '캐릭터 카드 중 최애(3점)와 차애(2점)를 골라 주세요.' };
  return state;
}

// --- 라운드 진행 ---

function customersOf(state: GachaGameState): GachaPlayer[] {
  return state.players.filter((_, i) => i !== state.ownerIndex);
}

function beginRound(state: GachaGameState) {
  const owner = state.players[state.ownerIndex];
  for (const p of state.players) { p.pulled = []; p.pullDone = false; p.tradeDone = false; }
  state.offers = [];
  state.machine = [];
  state.drawn = state.deck.splice(0, DRAW_COUNT);
  pushLog(state, `${state.round}라운드: ${owner.name}이(가) 사장님이 되어 덱에서 ${state.drawn.length}장을 가져왔습니다.`);
  if (state.drawn.length === 0) {
    // 덱이 완전히 비면 이 라운드는 진열할 카드가 없다. 교환만 진행한다.
    pushLog(state, '덱이 비어 이번 라운드는 가챠 없이 교환만 진행합니다.');
    beginTrading(state);
    return;
  }
  state.phase = 'stocking';
  state.result = { message: `${owner.name} 사장님이 가챠기계에 넣을 카드를 고르는 중입니다.` };
}

/** 다음 가챠 차례를 찾는다. 사장님, 뽑기를 마친 사람, 코인이 없는 사람은 건너뛴다. */
function nextPuller(state: GachaGameState, fromIndex: number): number {
  const n = state.players.length;
  for (let k = 1; k <= n; k++) {
    const index = (fromIndex + k) % n;
    if (index === state.ownerIndex) continue;
    const p = state.players[index];
    if (p.pullDone) continue;
    if (p.coins <= 0) {
      p.pullDone = true;
      pushLog(state, `${p.name}은(는) 코인이 없어 가챠를 돌릴 수 없습니다.`);
      continue;
    }
    return index;
  }
  return -1;
}

function advancePulling(state: GachaGameState, fromIndex: number) {
  if (state.machine.length === 0) {
    pushLog(state, '가챠기계가 비었습니다.');
    beginTrading(state);
    return;
  }
  const next = nextPuller(state, fromIndex);
  if (next < 0) {
    beginTrading(state);
    return;
  }
  state.turnIndex = next;
  state.result = { message: `${state.players[next].name}의 가챠 차례입니다. (기계에 ${state.machine.length}장)` };
}

function beginTrading(state: GachaGameState) {
  // 남은 카드는 확인하지 않고 덱 맨 아래로, 뽑은 카드는 각자 손으로.
  if (state.machine.length > 0) {
    pushLog(state, `선택되지 않은 카드 ${state.machine.length}장은 확인하지 않고 덱 맨 아래로 돌아갑니다.`);
    state.deck.push(...state.machine);
    state.machine = [];
  }
  const picked = state.players.filter(p => p.pulled.length > 0);
  if (picked.length > 0) {
    pushLog(state, `이번 라운드 뽑기: ${picked.map(p => `${p.name} ${p.pulled.map(c => kindLabel(c.kind)).join('·')}`).join(' / ')}`);
  }
  for (const p of state.players) {
    p.hand.push(...p.pulled);
    p.pullDone = true;
    p.tradeDone = false;
  }
  state.offers = [];
  state.phase = 'trading';
  const owner = state.players[state.ownerIndex];
  state.result = { message: `교환 시간입니다. ${owner.name} 사장님을 뺀 손님끼리 카드·코인을 1:1로 바꿀 수 있어요.` };
}

function endRound(state: GachaGameState) {
  for (const p of state.players) p.pulled = [];
  state.offers = [];
  pushLog(state, `${state.round}라운드가 끝났습니다.`);
  if (state.round >= state.totalRounds) {
    finishGame(state);
    return;
  }
  state.round += 1;
  state.ownerIndex = (state.ownerIndex + 1) % state.players.length;
  beginRound(state);
}

function finishGame(state: GachaGameState) {
  state.phase = 'finished';
  const rows: Standing[] = state.players.map((p, i) => {
    const { score, breakdown } = scoreOf(p);
    return {
      playerId: p.id, name: p.name, score, breakdown,
      favorites: p.favorites!, kindCounts: kindCounts(p.hand), coins: p.coins,
      ownerOrder: ownerOrder(state, i), rank: 0,
    };
  });
  // 점수 내림차순, 동점이면 사장님을 먼저 한 사람이 이긴다.
  rows.sort((a, b) => b.score - a.score || a.ownerOrder - b.ownerOrder);
  rows.forEach((row, i) => { row.rank = i + 1; });
  state.standings = rows;
  pushLog(state, `최애·차애 공개: ${rows.map(r => `${r.name} ${kindLabel(r.favorites.first)}/${kindLabel(r.favorites.second)}`).join(', ')}`);
  pushLog(state, `최종 점수: ${rows.map(r => `${r.name} ${r.score}점`).join(', ')}`);
  pushLog(state, `${rows[0].name} 승리!`);
  state.result = { message: `${state.totalRounds}라운드가 모두 끝났습니다. ${rows[0].name} 승리!` };
}

// --- 행동 적용 ---

export function applyGachaAction(input: GachaGameState, playerId: string, action: GachaAction): GachaGameState {
  const state = clone(input);
  state.result = undefined;
  if (!action || typeof action !== 'object') throw new Error('올바른 행동을 선택해주세요.');
  if (state.phase === 'finished') throw new Error('게임이 이미 끝났습니다.');
  const player = playerOf(state, playerId);
  const playerIndex = state.players.indexOf(player);
  state.step += 1;

  switch (action.type) {
    case 'choose': return choose(state, player, action);
    case 'stock': return stock(state, player, playerIndex, action);
    case 'pull': return pull(state, player, playerIndex, action);
    case 'pass': return pass(state, player, playerIndex);
    case 'offer': return offer(state, player, playerIndex, action);
    case 'cancel': return cancel(state, player, action);
    case 'accept': return accept(state, player, playerIndex, action);
    case 'decline': return decline(state, player, action);
    case 'done': return done(state, player, playerIndex);
    default: throw new Error('알 수 없는 행동입니다.');
  }
}

function choose(state: GachaGameState, player: GachaPlayer, action: { first: unknown; second: unknown }): GachaGameState {
  if (state.phase !== 'setup') throw new Error('최애·차애는 게임 시작 전에만 고를 수 있습니다.');
  if (player.favorites) throw new Error('이미 최애와 차애를 골랐습니다.');
  if (!isKind(action.first) || !isKind(action.second)) throw new Error('캐릭터를 고르세요.');
  if (action.first === action.second) throw new Error('최애와 차애는 서로 다른 캐릭터여야 합니다.');
  player.favorites = { first: action.first, second: action.second };
  pushLog(state, `${player.name}이(가) 최애와 차애를 정했습니다.`);
  state.result = { message: `${player.name}이(가) 최애와 차애를 정했습니다.` };

  if (state.players.every(p => p.favorites)) {
    // 고르지 않은 카드를 모아 남은 카드와 함께 섞는다.
    const unchosen = state.players.flatMap(p =>
      p.setupCards.filter(c => c.kind !== p.favorites!.first && c.kind !== p.favorites!.second));
    state.deck = shuffle([...state.deck, ...unchosen], rng(state));
    pushLog(state, `모두 최애·차애를 정했습니다. 고르지 않은 카드 ${unchosen.length}장을 섞어 ${state.deck.length}장의 덱을 만들었습니다.`);
    beginRound(state);
  }
  return state;
}

function stock(state: GachaGameState, player: GachaPlayer, playerIndex: number, action: { cardIds: unknown }): GachaGameState {
  if (state.phase !== 'stocking') throw new Error('지금은 가챠기계에 카드를 넣을 때가 아닙니다.');
  if (playerIndex !== state.ownerIndex) throw new Error('사장님만 가챠기계에 카드를 넣을 수 있습니다.');
  const ids = Array.isArray(action.cardIds) ? action.cardIds.filter((id): id is string => typeof id === 'string') : [];
  const unique = Array.from(new Set(ids));
  if (unique.length < 1) throw new Error('카드를 1장 이상 골라야 합니다.');
  if (unique.some(id => !state.drawn.some(c => c.id === id))) throw new Error('가져온 카드 중에서만 고를 수 있습니다.');
  const chosen = state.drawn.filter(c => unique.includes(c.id));
  const returned = state.drawn.filter(c => !unique.includes(c.id));
  // 가챠는 무작위다: 사장님도 어느 칸에 무엇이 들어갔는지 모른다.
  state.machine = shuffle(chosen, rng(state));
  state.drawn = [];
  if (returned.length > 0) state.deck.push(...returned);
  pushLog(state, `${player.name} 사장님이 가챠기계에 카드 ${chosen.length}장을 넣었습니다${returned.length ? ` (${returned.length}장은 덱 맨 아래로)` : ''}.`);
  state.phase = 'pulling';
  advancePulling(state, state.ownerIndex);
  return state;
}

function pull(state: GachaGameState, player: GachaPlayer, playerIndex: number, action: { slot: unknown }): GachaGameState {
  if (state.phase !== 'pulling') throw new Error('지금은 가챠를 돌릴 때가 아닙니다.');
  if (playerIndex !== state.turnIndex) throw new Error('아직 당신 차례가 아닙니다.');
  if (player.coins <= 0) throw new Error('코인이 없어 가챠를 돌릴 수 없습니다.');
  const slot = action.slot;
  if (!Number.isInteger(slot) || (slot as number) < 0 || (slot as number) >= state.machine.length) throw new Error('가챠기계의 칸을 고르세요.');
  const [card] = state.machine.splice(slot as number, 1);
  player.coins -= 1;
  state.players[state.ownerIndex].coins += 1;
  player.pulled.push(card);
  state.pullHistory.push({ round: state.round, playerId: player.id, kind: card.kind });
  pushLog(state, `${player.name}이(가) 코인 1개를 내고 가챠에서 ${kindLabel(card.kind)}을(를) 뽑았습니다.`);
  advancePulling(state, playerIndex);
  if (state.phase === 'pulling') state.result = { message: `${kindLabel(card.kind)}! ${state.result?.message ?? ''}`.trim() };
  return state;
}

function pass(state: GachaGameState, player: GachaPlayer, playerIndex: number): GachaGameState {
  if (state.phase !== 'pulling') throw new Error('지금은 가챠를 돌릴 때가 아닙니다.');
  if (playerIndex !== state.turnIndex) throw new Error('아직 당신 차례가 아닙니다.');
  player.pullDone = true;
  pushLog(state, `${player.name}은(는) 이번 라운드 가챠를 마쳤습니다.`);
  advancePulling(state, playerIndex);
  return state;
}

function requireTrading(state: GachaGameState, playerIndex: number) {
  if (state.phase !== 'trading') throw new Error('지금은 교환할 때가 아닙니다.');
  if (playerIndex === state.ownerIndex) throw new Error('사장님은 교환에 참여할 수 없습니다.');
}

function hasItem(player: GachaPlayer, item: TradeItem): boolean {
  return item.type === 'coin' ? player.coins >= 1 : player.hand.some(c => c.kind === item.kind);
}

function offer(state: GachaGameState, player: GachaPlayer, playerIndex: number, action: { to: unknown; give: unknown; want: unknown }): GachaGameState {
  requireTrading(state, playerIndex);
  if (typeof action.to !== 'string' || action.to === player.id) throw new Error('교환할 상대를 고르세요.');
  const target = playerOf(state, action.to);
  if (state.players.indexOf(target) === state.ownerIndex) throw new Error('사장님과는 교환할 수 없습니다.');
  if (!isItem(action.give) || !isItem(action.want)) throw new Error('주고받을 것을 고르세요.');
  if (action.give.type === 'coin' && action.want.type === 'coin') throw new Error('코인끼리는 바꿀 수 없습니다.');
  if (!hasItem(player, action.give)) throw new Error(`${itemLabel(action.give)}이(가) 없습니다.`);
  if (state.offers.some(o => o.from === player.id)) throw new Error('이미 제안한 교환이 있습니다. 먼저 취소하세요.');
  const created: TradeOffer = { id: state.nextOfferId++, from: player.id, to: target.id, give: action.give, want: action.want };
  state.offers.push(created);
  pushLog(state, `${player.name}이(가) ${target.name}에게 제안: ${itemLabel(created.give)} ↔ ${itemLabel(created.want)}`);
  state.result = { message: `${player.name}이(가) ${target.name}에게 교환을 제안했습니다.` };
  return state;
}

function findOffer(state: GachaGameState, offerId: unknown): TradeOffer {
  const found = state.offers.find(o => o.id === offerId);
  if (!found) throw new Error('이미 사라진 제안입니다.');
  return found;
}

function removeOffer(state: GachaGameState, offerId: number) {
  state.offers = state.offers.filter(o => o.id !== offerId);
}

function cancel(state: GachaGameState, player: GachaPlayer, action: { offerId: unknown }): GachaGameState {
  if (state.phase !== 'trading') throw new Error('지금은 교환할 때가 아닙니다.');
  const found = findOffer(state, action.offerId);
  if (found.from !== player.id) throw new Error('내가 낸 제안만 취소할 수 있습니다.');
  removeOffer(state, found.id);
  state.result = { message: `${player.name}이(가) 제안을 취소했습니다.` };
  return state;
}

function decline(state: GachaGameState, player: GachaPlayer, action: { offerId: unknown }): GachaGameState {
  if (state.phase !== 'trading') throw new Error('지금은 교환할 때가 아닙니다.');
  const found = findOffer(state, action.offerId);
  if (found.to !== player.id) throw new Error('나에게 온 제안만 거절할 수 있습니다.');
  removeOffer(state, found.id);
  const from = playerOf(state, found.from);
  pushLog(state, `${player.name}이(가) ${from.name}의 제안을 거절했습니다.`);
  state.result = { message: `${player.name}이(가) ${from.name}의 제안을 거절했습니다.` };
  return state;
}

function giveItem(from: GachaPlayer, to: GachaPlayer, item: TradeItem) {
  if (item.type === 'coin') {
    from.coins -= 1;
    to.coins += 1;
    return;
  }
  const index = from.hand.findIndex(c => c.kind === item.kind);
  const [card] = from.hand.splice(index, 1);
  to.hand.push(card);
}

function accept(state: GachaGameState, player: GachaPlayer, playerIndex: number, action: { offerId: unknown }): GachaGameState {
  requireTrading(state, playerIndex);
  const found = findOffer(state, action.offerId);
  if (found.to !== player.id) throw new Error('나에게 온 제안만 수락할 수 있습니다.');
  const from = playerOf(state, found.from);
  if (!hasItem(from, found.give)) {
    removeOffer(state, found.id);
    throw new Error(`${from.name}에게 더 이상 ${itemLabel(found.give)}이(가) 없어 제안이 취소되었습니다.`);
  }
  if (!hasItem(player, found.want)) throw new Error(`${itemLabel(found.want)}이(가) 없어 수락할 수 없습니다.`);
  giveItem(from, player, found.give);
  giveItem(player, from, found.want);
  removeOffer(state, found.id);
  pushLog(state, `교환 성립: ${from.name}의 ${itemLabel(found.give)} ↔ ${player.name}의 ${itemLabel(found.want)}`);
  state.result = { message: `${from.name}과(와) ${player.name}의 교환이 성립했습니다.` };
  return state;
}

function done(state: GachaGameState, player: GachaPlayer, playerIndex: number): GachaGameState {
  requireTrading(state, playerIndex);
  if (player.tradeDone) throw new Error('이미 교환을 마쳤습니다.');
  player.tradeDone = true;
  // 내가 낸 제안은 거둔다. 나에게 온 제안은 남겨 두어 상대가 정리할 수 있게 한다.
  state.offers = state.offers.filter(o => o.from !== player.id);
  pushLog(state, `${player.name}이(가) 교환을 마쳤습니다.`);
  state.result = { message: `${player.name}이(가) 교환을 마쳤습니다.` };
  if (customersOf(state).every(p => p.tradeDone)) endRound(state);
  return state;
}

// --- 플레이어 시점 뷰 ---

export function getGachaPlayerView(state: GachaGameState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const owner = state.players[state.ownerIndex];
  const myIndex = me ? state.players.indexOf(me) : -1;
  const isOwner = myIndex === state.ownerIndex;
  const finished = state.phase === 'finished';
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    ownerId: state.phase === 'setup' ? null : owner.id,
    currentPlayerId: state.phase === 'pulling' ? state.players[state.turnIndex].id : null,
    deckCount: state.deck.length,
    machineCount: state.machine.length,
    drawnCount: state.drawn.length,
    offers: state.offers,
    pullHistory: state.pullHistory,
    log: state.log,
    result: state.result ?? null,
    standings: state.standings ?? null,
    myId: me?.id ?? null,
    me: me ? {
      coins: me.coins,
      hand: me.hand,
      kindCounts: kindCounts(me.hand),
      favorites: me.favorites,
      setupCards: me.favorites ? [] : me.setupCards,
      drawn: isOwner && state.phase === 'stocking' ? state.drawn : [],
      isOwner,
      pullDone: me.pullDone,
      tradeDone: me.tradeDone,
    } : null,
    players: state.players.map((p, i) => ({
      id: p.id,
      name: p.name,
      isMe: p.id === playerId,
      coins: p.coins,
      handCount: p.hand.length,
      pulled: p.pulled,
      chosen: !!p.favorites,
      pullDone: p.pullDone,
      tradeDone: p.tradeDone,
      ownerOrder: ownerOrder(state, i),
      // 게임이 끝나면 최애·차애와 모은 카드를 공개한다.
      favorites: finished ? p.favorites : null,
      kindCounts: finished ? kindCounts(p.hand) : null,
    })),
  };
}
