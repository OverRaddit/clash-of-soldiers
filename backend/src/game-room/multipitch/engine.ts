// 확보! (멀티피치) v0 엔진. 규칙은 docs/multipitch-rulebook-v0.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export type Suit = 'crimp' | 'sloper' | 'jug' | 'crack';
export type SeatNumber = 1 | 2 | 3 | 4;

export interface HoldCard { id: string; kind: 'hold'; suit: Suit; rank: number }
export interface FallCard { id: string; kind: 'fall' }
export type MultipitchCard = HoldCard | FallCard;

export interface BoardCell {
  index: number;
  name: string;
  suit?: Suit;
  difficulty?: number;
  safe: boolean;
}

export interface Seat {
  seat: SeatNumber;
  playerId: string;
  name: string;
  position: number;
  hand: MultipitchCard[];
  callAvailable: boolean;
  revealedCardId?: string;        // "확보 봐줘!" 로 공개한 카드
  declaredVoidSuit?: Suit;        // "줄 줘!" 로 공개한 없는 무늬
  declaredFall?: { count: number; trickIndex: number }; // "떨어진다!" 선언
  tension: boolean;               // 텐션 마커가 올라가 있는가
}

export interface TrickPlay { seat: SeatNumber; card: MultipitchCard }

export interface FallOutcome {
  seat: SeatNumber;
  safeZone: boolean;
  caught: boolean;
  byTension: boolean;
  from: number;
  to: number;
  injured: boolean;
  groundFall: boolean;
}

export interface ClimbOutcome { seat: SeatNumber; from: number; to: number; climbed: boolean; reason?: string }

export interface TrickResult {
  trickIndex: number;
  leadSuit?: Suit;
  winnerSeat?: SeatNumber;
  plays: TrickPlay[];
  falls: FallOutcome[];
  climbs: ClimbOutcome[];
  recoveredGear: number;
}

export type MultipitchPhase = 'play' | 'bonus' | 'finished';
export type BonusType = 'tension' | 'gear' | 'recall_call' | 'none';

export type MultipitchAction =
  | { type: 'call'; call: 'belay' }
  | { type: 'call'; call: 'falling'; timing: 'this' | 'next' }
  | { type: 'call'; call: 'slack'; suit: Suit }
  | { type: 'play_card'; cardId: string }
  | { type: 'choose_bonus'; bonus: 'tension'; targetSeat: SeatNumber }
  | { type: 'choose_bonus'; bonus: 'gear' | 'recall_call' | 'none' };

export interface MultipitchConfig {
  ropeLength: number;
  suitBonus: number;
  gearCount: number;
  injuryLimit: number;
  dealsAllowed: number;
  fallCards: number;
}

export interface MultipitchGameState {
  phase: MultipitchPhase;
  config: MultipitchConfig;
  board: BoardCell[];
  seats: Seat[];
  deal: number;                   // 1부터
  trickIndex: number;             // 게임 전체 누적, 1부터
  trickInDeal: number;            // 1~11
  leadSeat: SeatNumber;
  turnSeat: SeatNumber;
  plays: TrickPlay[];
  rack: number;                   // 랙에 남은 장비
  gearOnWall: number[];           // 장비가 걸린 칸 번호
  injuries: number;
  sunset: number;                 // 끝난 딜 수
  pendingBonusSeat?: SeatNumber;
  lastTrick?: TrickResult;
  outcome?: 'victory' | 'defeat';
  outcomeReason?: string;
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  seed: number;
}

export const SUITS: Suit[] = ['crimp', 'sloper', 'jug', 'crack'];
export const SUIT_NAMES: Record<Suit, string> = { crimp: '크림프', sloper: '슬로퍼', jug: '저그', crack: '크랙' };
export const SUMMIT_INDEX = 10;

export const DEFAULT_CONFIG: MultipitchConfig = {
  ropeLength: 3,
  suitBonus: 2,
  gearCount: 5,
  injuryLimit: 3,
  dealsAllowed: 2,
  fallCards: 4,
};

/** 연습 루트: 인수봉 연습길 (2피치). 룰북의 표와 같다. */
export const PRACTICE_ROUTE: BoardCell[] = [
  { index: 0, name: '바닥', safe: true },
  { index: 1, name: '1피치 시작', suit: 'jug', difficulty: 2, safe: false },
  { index: 2, name: '크랙 구간', suit: 'crack', difficulty: 3, safe: false },
  { index: 3, name: '슬로퍼 구간', suit: 'sloper', difficulty: 4, safe: false },
  { index: 4, name: '크림프 구간', suit: 'crimp', difficulty: 5, safe: false },
  { index: 5, name: '테라스(확보점)', suit: 'jug', difficulty: 3, safe: true },
  { index: 6, name: '2피치 시작', suit: 'crack', difficulty: 4, safe: false },
  { index: 7, name: '크림프 구간', suit: 'crimp', difficulty: 6, safe: false },
  { index: 8, name: '슬로퍼 구간', suit: 'sloper', difficulty: 5, safe: false },
  { index: 9, name: '크럭스', suit: 'crimp', difficulty: 7, safe: false },
  { index: 10, name: '정상', suit: 'jug', difficulty: 3, safe: true },
];

const BELAYER: Record<SeatNumber, SeatNumber> = { 1: 2, 2: 1, 3: 2, 4: 3 };
export function belayerOf(seat: SeatNumber): SeatNumber { return BELAYER[seat]; }
export function belayeesOf(seat: SeatNumber): SeatNumber[] {
  return ([1, 2, 3, 4] as SeatNumber[]).filter(s => BELAYER[s] === seat);
}

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

export function buildDeck(fallCards: number): MultipitchCard[] {
  const deck: MultipitchCard[] = [];
  for (const suit of SUITS) {
    for (let rank = 1; rank <= 9; rank++) deck.push({ id: `${suit}-${rank}`, kind: 'hold', suit, rank });
  }
  for (let i = 1; i <= fallCards; i++) deck.push({ id: `fall-${i}`, kind: 'fall' });
  return deck;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

function seatOf(state: MultipitchGameState, seat: SeatNumber): Seat {
  return state.seats.find(s => s.seat === seat)!;
}

function seatByPlayer(state: MultipitchGameState, playerId: string): Seat {
  const seat = state.seats.find(s => s.playerId === playerId);
  if (!seat) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return seat;
}

function nextSeat(seat: SeatNumber): SeatNumber { return ((seat % 4) + 1) as SeatNumber; }

function pushLog(state: MultipitchGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 40) state.log.splice(0, state.log.length - 40);
}

function cardLabel(card: MultipitchCard): string {
  return card.kind === 'fall' ? '추락' : `${SUIT_NAMES[card.suit]} ${card.rank}`;
}

function dealCards(state: MultipitchGameState, random: () => number) {
  const deck = shuffle(buildDeck(state.config.fallCards), random);
  const perHand = deck.length / 4;
  state.seats.forEach((seat, i) => {
    seat.hand = deck.slice(i * perHand, (i + 1) * perHand)
      .sort((a, b) => sortKey(a) - sortKey(b));
    seat.revealedCardId = undefined;
    seat.declaredVoidSuit = undefined;
    seat.declaredFall = undefined;
  });
  state.trickInDeal = 1;
  state.plays = [];
  state.leadSeat = 1;
  state.turnSeat = 1;
}

function sortKey(card: MultipitchCard): number {
  if (card.kind === 'fall') return 1000;
  return SUITS.indexOf(card.suit) * 10 + card.rank;
}

export function initializeMultipitchGame(playerIds: string[], playerNames: string[], seed?: number,
  configOverrides: Partial<MultipitchConfig> = {}): MultipitchGameState {
  if (playerIds.length !== 4) throw new Error('확보!는 정확히 4명이 필요합니다.');
  const config = { ...DEFAULT_CONFIG, ...configOverrides };
  if ((36 + config.fallCards) % 4 !== 0) throw new Error('추락 카드 수는 덱이 4로 나누어떨어지게 해야 합니다.');
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(actualSeed);
  const state: MultipitchGameState = {
    phase: 'play',
    config,
    board: clone(PRACTICE_ROUTE),
    seats: playerIds.map((playerId, i) => ({
      seat: (i + 1) as SeatNumber,
      playerId,
      name: playerNames[i] ?? `등반자 ${i + 1}`,
      position: 0,
      hand: [],
      callAvailable: true,
      tension: false,
    })),
    deal: 1,
    trickIndex: 1,
    trickInDeal: 1,
    leadSeat: 1,
    turnSeat: 1,
    plays: [],
    rack: config.gearCount,
    gearOnWall: [],
    injuries: 0,
    sunset: 0,
    log: [],
    seed: actualSeed,
  };
  dealCards(state, random);
  pushLog(state, '1번 딜 시작. 1번 등반자가 선입니다.');
  state.result = { message: '등반을 시작합니다. 1번 등반자가 첫 카드를 냅니다.' };
  return state;
}

// --- 규칙 판단 보조 ---

export function currentLeadSuit(plays: TrickPlay[]): Suit | undefined {
  const first = plays.find(p => p.card.kind === 'hold');
  return first && first.card.kind === 'hold' ? first.card.suit : undefined;
}

/** 안전지대(바닥·확보점·정상)에서는 추락 카드를 낼 수 없다. 손에 추락 카드만 남았을 때만 예외로 낼 수 있고, 그때는 무효 처리된다. */
export function canPlayFall(state: MultipitchGameState, seat: Seat): boolean {
  return !state.board[seat.position].safe || seat.hand.every(c => c.kind === 'fall');
}

export function legalCards(state: MultipitchGameState, seat: Seat): MultipitchCard[] {
  if (state.phase !== 'play' || state.turnSeat !== seat.seat) return [];
  const fallAllowed = canPlayFall(state, seat);
  const fallDue = fallAllowed && seat.declaredFall?.trickIndex === state.trickIndex && seat.hand.some(c => c.kind === 'fall');
  if (fallDue) return seat.hand.filter(c => c.kind === 'fall');
  const leadSuit = currentLeadSuit(state.plays);
  const hasLead = leadSuit && seat.hand.some(c => c.kind === 'hold' && c.suit === leadSuit);
  return seat.hand.filter(c => (c.kind === 'fall' ? fallAllowed : !hasLead || c.suit === leadSuit));
}

export function bonusOptions(state: MultipitchGameState, seat: Seat): { bonus: BonusType; targetSeat?: SeatNumber; label: string }[] {
  const options: { bonus: BonusType; targetSeat?: SeatNumber; label: string }[] = [];
  for (const target of belayeesOf(seat.seat)) {
    const other = seatOf(state, target);
    if (!other.tension && other.position < SUMMIT_INDEX) {
      options.push({ bonus: 'tension', targetSeat: target, label: `텐션: ${target}번(${other.name})의 다음 추락을 자동으로 잡는다` });
    }
  }
  if (seat.seat === 1 && state.rack > 0 && !state.board[seat.position].safe && !state.gearOnWall.includes(seat.position)) {
    options.push({ bonus: 'gear', label: `장비 걸기: ${seat.position}번 칸에 장비를 건다 (랙 ${state.rack}개)` });
  }
  if (!seat.callAvailable) options.push({ bonus: 'recall_call', label: '콜 회복: 콜 토큰을 다시 쓸 수 있게 한다' });
  options.push({ bonus: 'none', label: '보너스 없이 넘어간다' });
  return options;
}

function climbCheck(state: MultipitchGameState, seat: Seat, card: HoldCard): { ok: boolean; reason?: string; to: number } {
  if (seat.position >= SUMMIT_INDEX) return { ok: false, reason: '이미 정상', to: seat.position };
  const target = state.board[seat.position + 1];
  const difficulty = (target.difficulty ?? 0) - (target.suit === card.suit ? state.config.suitBonus : 0);
  if (card.rank < difficulty) return { ok: false, reason: `난이도 ${difficulty} 미달`, to: seat.position };
  if (seat.seat > 1) {
    const above = seatOf(state, (seat.seat - 1) as SeatNumber);
    if (above.position < seat.position + 1) return { ok: false, reason: '추월 금지', to: seat.position };
  }
  if (seat.seat < 4) {
    const below = seatOf(state, (seat.seat + 1) as SeatNumber);
    if (seat.position + 1 - below.position > state.config.ropeLength) return { ok: false, reason: '로프 길이 부족', to: seat.position };
  }
  return { ok: true, to: seat.position + 1 };
}

function finish(state: MultipitchGameState, outcome: 'victory' | 'defeat', reason: string) {
  state.phase = 'finished';
  state.outcome = outcome;
  state.outcomeReason = reason;
  state.pendingBonusSeat = undefined;
  pushLog(state, outcome === 'victory' ? `승리! ${reason}` : `패배. ${reason}`);
}

// --- 트릭 해결 ---

function resolveTrick(state: MultipitchGameState) {
  const plays = state.plays;
  const leadSuit = currentLeadSuit(plays);
  let winnerSeat: SeatNumber | undefined;
  let best = -1;
  for (const play of plays) {
    if (play.card.kind === 'hold' && play.card.suit === leadSuit && play.card.rank > best) {
      best = play.card.rank;
      winnerSeat = play.seat;
    }
  }
  const result: TrickResult = { trickIndex: state.trickIndex, leadSuit, winnerSeat, plays: clone(plays), falls: [], climbs: [], recoveredGear: 0 };
  pushLog(state, `트릭 ${state.trickIndex}: ${plays.map(p => `${p.seat}번 ${cardLabel(p.card)}`).join(', ')}` +
    (winnerSeat ? ` → ${winnerSeat}번 승리` : ' → 승자 없음'));

  // 3단계: 추락 처리 (1번부터)
  for (const play of plays.slice().sort((a, b) => a.seat - b.seat)) {
    if (play.card.kind !== 'fall') continue;
    const seat = seatOf(state, play.seat);
    const from = seat.position;
    if (state.board[from].safe) {
      result.falls.push({ seat: seat.seat, safeZone: true, caught: true, byTension: false, from, to: from, injured: false, groundFall: false });
      pushLog(state, `${seat.seat}번은 안전지대라 추락 카드가 무효입니다(홀드 카드가 없어 낸 경우).`);
      continue;
    }
    const byTension = seat.tension;
    const caught = winnerSeat === belayerOf(seat.seat) || byTension;
    if (byTension) seat.tension = false;
    let to = from;
    let groundFall = false;
    if (seat.seat === 1) {
      const second = seatOf(state, 2);
      const protection = [...state.gearOnWall, ...state.board.filter(c => c.safe && c.index > 0).map(c => c.index)]
        .filter(index => index < from);
      const bestProtection = protection.length ? Math.max(...protection) : undefined;
      if (bestProtection === undefined && second.position === 0) {
        groundFall = true;
        to = 0;
      } else {
        to = Math.max(bestProtection ?? 0, second.position);
      }
    } else if (!caught) {
      const below = seat.seat < 4 ? seatOf(state, (seat.seat + 1) as SeatNumber).position : 0;
      to = Math.max(from - 1, below, 0);
    }
    const injured = !caught && !groundFall;
    seat.position = to;
    if (injured) state.injuries += 1;
    result.falls.push({ seat: seat.seat, safeZone: false, caught, byTension, from, to, injured, groundFall });
    pushLog(state, groundFall ? `${seat.seat}번 선등자가 그라운드 폴!`
      : caught ? `${seat.seat}번 추락, ${byTension ? '텐션 마커로' : `${belayerOf(seat.seat)}번이`} 잡았습니다.` + (to !== from ? ` ${from}→${to}칸.` : '')
      : `${seat.seat}번 추락, 잡지 못했습니다. ${from}→${to}칸, 부상 ${state.injuries}/${state.config.injuryLimit}.`);
    if (groundFall) { state.lastTrick = result; finish(state, 'defeat', '선등자가 장비 없이 바닥까지 떨어졌습니다.'); return; }
    if (state.injuries >= state.config.injuryLimit) { state.lastTrick = result; finish(state, 'defeat', '부상이 누적되어 하산합니다.'); return; }
  }

  // 4단계: 등반. 1번부터 차례로 판정하고, 추월 금지나 로프 길이에 막힌 사람은
  // 다른 사람이 움직인 뒤 다시 판정한다. 한 트릭에 한 칸만 오른다.
  const climbers = plays.filter(p => p.card.kind === 'hold').sort((a, b) => a.seat - b.seat);
  const startPositions = new Map(climbers.map(p => [p.seat, seatOf(state, p.seat).position]));
  const lastReason = new Map<SeatNumber, string | undefined>();
  const climbed = new Set<SeatNumber>();
  for (let progress = true; progress;) {
    progress = false;
    for (const play of climbers) {
      if (climbed.has(play.seat) || play.card.kind !== 'hold') continue;
      const seat = seatOf(state, play.seat);
      const check = climbCheck(state, seat, play.card);
      lastReason.set(play.seat, check.reason);
      if (!check.ok) continue;
      seat.position = check.to;
      climbed.add(play.seat);
      progress = true;
      pushLog(state, `${seat.seat}번이 ${check.to}번 칸(${state.board[check.to].name})으로 올랐습니다.`);
    }
  }
  for (const play of climbers) {
    const seat = seatOf(state, play.seat);
    result.climbs.push({ seat: play.seat, from: startPositions.get(play.seat)!, to: seat.position,
      climbed: climbed.has(play.seat), reason: climbed.has(play.seat) ? undefined : lastReason.get(play.seat) });
  }

  // 5단계: 장비 회수
  const fourth = seatOf(state, 4);
  const recovered = state.gearOnWall.filter(index => index <= fourth.position);
  if (recovered.length) {
    state.gearOnWall = state.gearOnWall.filter(index => index > fourth.position);
    state.rack += recovered.length;
    result.recoveredGear = recovered.length;
    pushLog(state, `4번이 장비 ${recovered.length}개를 회수했습니다. 랙 ${state.rack}개.`);
  }

  state.lastTrick = result;
  if (state.seats.every(s => s.position >= SUMMIT_INDEX)) { finish(state, 'victory', '전원이 정상에 올랐습니다.'); return; }

  // 6단계: 승자 보너스
  if (winnerSeat) {
    const winner = seatOf(state, winnerSeat);
    const options = bonusOptions(state, winner);
    if (options.length > 1) {
      state.phase = 'bonus';
      state.pendingBonusSeat = winnerSeat;
      state.leadSeat = winnerSeat;
      return;
    }
    state.leadSeat = winnerSeat;
  }
  advanceTrick(state);
}

function advanceTrick(state: MultipitchGameState) {
  state.phase = 'play';
  state.pendingBonusSeat = undefined;
  state.plays = [];
  state.trickIndex += 1;
  state.trickInDeal += 1;
  state.turnSeat = state.leadSeat;
  if (state.seats.every(s => s.hand.length === 0)) {
    state.sunset += 1;
    if (state.sunset >= state.config.dealsAllowed) {
      finish(state, 'defeat', '해가 져서 더 오를 수 없습니다.');
      return;
    }
    state.deal += 1;
    dealCards(state, mulberry32(state.seed + state.deal * 7919));
    pushLog(state, `${state.deal}번 딜 시작. 남은 딜 ${state.config.dealsAllowed - state.sunset}회. 1번이 선입니다.`);
  }
}

// --- 행동 적용 ---

export function applyMultipitchAction(input: MultipitchGameState, playerId: string, action: MultipitchAction): MultipitchGameState {
  const state = clone(input);
  state.result = undefined;
  if (state.phase === 'finished') throw new Error('게임이 이미 끝났습니다.');
  const seat = seatByPlayer(state, playerId);
  if (!action || typeof action !== 'object') throw new Error('올바른 행동을 선택해주세요.');

  switch (action.type) {
    case 'call': {
      if (state.phase !== 'play' || state.plays.length > 0) throw new Error('콜은 트릭의 첫 카드가 나오기 전에만 외칠 수 있습니다.');
      if (!seat.callAvailable) throw new Error('콜 토큰을 이미 사용했습니다.');
      if (action.call === 'belay') {
        const holds = seat.hand.filter((c): c is HoldCard => c.kind === 'hold');
        if (!holds.length) throw new Error('공개할 홀드 카드가 없습니다.');
        const highest = holds.reduce((a, b) => (b.rank > a.rank ? b : a));
        seat.revealedCardId = highest.id;
        pushLog(state, `${seat.seat}번: "확보 봐줘!" 가장 높은 카드 ${cardLabel(highest)}를 공개했습니다.`);
        state.result = { message: `"확보 봐줘!" ${cardLabel(highest)} 공개` };
      } else if (action.call === 'falling') {
        const count = seat.hand.filter(c => c.kind === 'fall').length;
        if (!count) throw new Error('추락 카드가 없으면 예고할 수 없습니다.');
        if (action.timing !== 'this' && action.timing !== 'next') throw new Error('이번 트릭 또는 다음 트릭을 선택하세요.');
        if (action.timing === 'this' && !canPlayFall(state, seat)) throw new Error('안전지대에서는 이번 트릭에 추락 카드를 낼 수 없습니다.');
        const trickIndex = action.timing === 'this' ? state.trickIndex : state.trickIndex + 1;
        seat.declaredFall = { count, trickIndex };
        pushLog(state, `${seat.seat}번: "떨어진다!" 추락 카드 ${count}장, ${action.timing === 'this' ? '이번' : '다음'} 트릭에 냅니다.`);
        state.result = { message: `"떨어진다!" ${action.timing === 'this' ? '이번' : '다음'} 트릭 예고` };
      } else if (action.call === 'slack') {
        if (!SUITS.includes(action.suit)) throw new Error('무늬를 선택하세요.');
        if (seat.hand.some(c => c.kind === 'hold' && c.suit === action.suit)) throw new Error('손에 있는 무늬는 없다고 말할 수 없습니다.');
        seat.declaredVoidSuit = action.suit;
        pushLog(state, `${seat.seat}번: "줄 줘!" ${SUIT_NAMES[action.suit]} 없음.`);
        state.result = { message: `"줄 줘!" ${SUIT_NAMES[action.suit]} 없음 공개` };
      } else throw new Error('알 수 없는 콜입니다.');
      seat.callAvailable = false;
      return state;
    }
    case 'play_card': {
      if (state.phase !== 'play') throw new Error('지금은 카드를 낼 수 없습니다.');
      if (state.turnSeat !== seat.seat) throw new Error('아직 당신 차례가 아닙니다.');
      const card = seat.hand.find(c => c.id === action.cardId);
      if (!card) throw new Error('손에 없는 카드입니다.');
      const legal = legalCards(state, seat);
      if (!legal.some(c => c.id === card.id)) {
        if (card.kind === 'fall') throw new Error('안전지대에서는 추락 카드를 낼 수 없습니다. 홀드 카드가 다 떨어졌을 때만 예외입니다.');
        const fallDue = seat.declaredFall?.trickIndex === state.trickIndex;
        throw new Error(fallDue ? '예고한 대로 이번 트릭에는 추락 카드를 내야 합니다.' : '리드 무늬가 손에 있으면 같은 무늬를 내야 합니다.');
      }
      seat.hand = seat.hand.filter(c => c.id !== card.id);
      if (seat.revealedCardId === card.id) seat.revealedCardId = undefined;
      // 추락 카드를 내면 예고는 이행된 것으로 본다.
      if (card.kind === 'fall') seat.declaredFall = undefined;
      state.plays.push({ seat: seat.seat, card });
      state.result = { message: `${seat.seat}번이 ${cardLabel(card)}를 냈습니다.` };
      if (state.plays.length < 4) {
        state.turnSeat = nextSeat(seat.seat);
        return state;
      }
      resolveTrick(state);
      const phaseAfterTrick = state.phase as MultipitchPhase;
      if (phaseAfterTrick === 'finished') state.result = { message: state.outcome === 'victory' ? '전원 정상 도착!' : `하산: ${state.outcomeReason}` };
      else if (phaseAfterTrick === 'bonus') state.result = { message: `${state.pendingBonusSeat}번이 트릭을 이겼습니다. 보너스를 고르세요.` };
      else state.result = { message: state.lastTrick?.winnerSeat ? `${state.lastTrick.winnerSeat}번이 트릭을 이겼습니다.` : '승자 없이 트릭이 끝났습니다.' };
      return state;
    }
    case 'choose_bonus': {
      if (state.phase !== 'bonus' || state.pendingBonusSeat !== seat.seat) throw new Error('보너스를 고를 차례가 아닙니다.');
      const options = bonusOptions(state, seat);
      if (action.bonus === 'tension') {
        const option = options.find(o => o.bonus === 'tension' && o.targetSeat === action.targetSeat);
        if (!option) throw new Error('그 등반자에게는 텐션을 걸 수 없습니다.');
        seatOf(state, action.targetSeat).tension = true;
        pushLog(state, `${seat.seat}번이 ${action.targetSeat}번에게 텐션을 걸었습니다.`);
      } else if (action.bonus === 'gear') {
        if (!options.some(o => o.bonus === 'gear')) throw new Error('지금은 장비를 걸 수 없습니다.');
        state.rack -= 1;
        state.gearOnWall.push(seat.position);
        state.gearOnWall.sort((a, b) => a - b);
        pushLog(state, `1번이 ${seat.position}번 칸에 장비를 걸었습니다. 랙 ${state.rack}개.`);
      } else if (action.bonus === 'recall_call') {
        if (!options.some(o => o.bonus === 'recall_call')) throw new Error('콜 토큰이 이미 앞면입니다.');
        seat.callAvailable = true;
        pushLog(state, `${seat.seat}번이 콜 토큰을 회복했습니다.`);
      } else if (action.bonus !== 'none') throw new Error('알 수 없는 보너스입니다.');
      advanceTrick(state);
      const phaseAfterBonus = state.phase as MultipitchPhase;
      state.result = { message: phaseAfterBonus === 'finished' ? `하산: ${state.outcomeReason}` : `${state.leadSeat}번이 다음 트릭의 선입니다.` };
      return state;
    }
    default:
      throw new Error('알 수 없는 행동입니다.');
  }
}

// --- 플레이어 시점 뷰 ---

export function getMultipitchPlayerView(state: MultipitchGameState, playerId?: string): Record<string, unknown> {
  const me = state.seats.find(s => s.playerId === playerId);
  return {
    phase: state.phase,
    config: state.config,
    board: state.board,
    deal: state.deal,
    dealsAllowed: state.config.dealsAllowed,
    trickIndex: state.trickIndex,
    trickInDeal: state.trickInDeal,
    tricksPerDeal: (36 + state.config.fallCards) / 4,
    leadSeat: state.leadSeat,
    turnSeat: state.turnSeat,
    leadSuit: currentLeadSuit(state.plays) ?? null,
    plays: state.plays,
    rack: state.rack,
    gearOnWall: state.gearOnWall,
    injuries: state.injuries,
    injuryLimit: state.config.injuryLimit,
    sunset: state.sunset,
    pendingBonusSeat: state.pendingBonusSeat ?? null,
    lastTrick: state.lastTrick ?? null,
    outcome: state.outcome ?? null,
    outcomeReason: state.outcomeReason ?? null,
    log: state.log,
    result: state.result ?? null,
    mySeat: me?.seat ?? null,
    hand: me ? me.hand : [],
    legalCardIds: me ? legalCards(state, me).map(c => c.id) : [],
    bonusOptions: me && state.phase === 'bonus' && state.pendingBonusSeat === me.seat ? bonusOptions(state, me) : [],
    callsOpen: state.phase === 'play' && state.plays.length === 0,
    seats: state.seats.map(seat => ({
      seat: seat.seat,
      playerId: seat.playerId,
      name: seat.name,
      position: seat.position,
      handCount: seat.hand.length,
      callAvailable: seat.callAvailable,
      tension: seat.tension,
      belayer: belayerOf(seat.seat),
      revealedCard: seat.revealedCardId ? seat.hand.find(c => c.id === seat.revealedCardId) ?? null : null,
      declaredVoidSuit: seat.declaredVoidSuit ?? null,
      declaredFall: seat.declaredFall ?? null,
      isMe: seat.playerId === playerId,
    })),
  };
}
