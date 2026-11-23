// 동물들의 숨바꼭질 엔진. 규칙과 해석은 docs/hide-and-seek-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export const ANIMALS = ['lion', 'rabbit', 'fox', 'bear', 'owl', 'squirrel', 'penguin', 'elephant', 'crocodile'] as const;
export type Animal = typeof ANIMALS[number];
export type Card = Animal | 'empty';
/** peek = 은신처 2곳 엿보기, clue = 단서 토큰 놓기, guess = 최종 추리, reveal = 라운드 정답 공개 */
export type HidePhase = 'peek' | 'clue' | 'guess' | 'reveal' | 'finished';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 5;
export const HIDEOUT_COUNT = 7;
export const MAX_TOKENS_PER_HIDEOUT = 2;
export const TURNS_PER_PLAYER = 2;
export const HIDEOUT_NAMES = ['큰 나무', '바위', '우물', '덤불', '통나무', '꽃밭', '동굴'];
export const ANIMAL_NAMES: Record<Animal, string> = {
  lion: '사자', rabbit: '토끼', fox: '여우', bear: '곰', owl: '부엉이',
  squirrel: '다람쥐', penguin: '펭귄', elephant: '코끼리', crocodile: '악어',
};

export interface HidePlayer {
  id: string;
  name: string;
  total: number;
  roundScores: number[];
  board: (Animal | null)[];   // 개인 추리판. null = 비워 둠(빈 은신처로 추리)
  known: (Card | null)[];     // 이번 라운드에 직접 엿본 카드
  submitted: boolean;         // 최종 추리 확정 여부
}

/** 한 턴의 공개 기록: 어디를 엿봤고 어떤 단서를 어디에 놓았는가 */
export interface TurnRecord {
  playerId: string;
  peeked: number[];
  animal: Animal;
  from: number | null;   // null = 대기석
  to: number;
}

export interface RoundResult {
  round: number;
  hideouts: Card[];
  removed: Card[];
  tokens: Record<Animal, number | null>;
  boards: Record<string, (Animal | null)[]>;
  correct: Record<string, boolean[]>;
  scores: Record<string, number>;
}

export interface Standing { playerId: string; name: string; total: number; lastRound: number; rank: number; winner: boolean }

export interface HideGameState {
  phase: HidePhase;
  round: number;
  totalRounds: number;
  players: HidePlayer[];
  hideouts: Card[];                       // 비공개: 은신처별 카드
  removed: Card[];                        // 비공개: 치워 둔 3장
  tokens: Record<Animal, number | null>;  // 단서 토큰 위치. null = 대기석
  turnOrder: number[];                    // 스네이크 순서 (players 인덱스)
  turnPos: number;
  roundStartIndex: number;
  peeked: number[] | null;                // 현재 턴에 엿본 은신처
  history: TurnRecord[];                  // 이번 라운드의 턴 기록
  results: RoundResult[];
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  standings?: Standing[];
  step: number;
  seed: number;
}

export type HideAction =
  | { type: 'peek'; slots: number[] }
  | { type: 'clue'; animal: Animal; to: number }
  | { type: 'set_board'; slot: number; animal: Animal | null }
  | { type: 'submit_guess' }
  | { type: 'unsubmit_guess' }
  | { type: 'next_round' };

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

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

function pushLog(state: HideGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function playerOf(state: HideGameState, playerId: string): HidePlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return player;
}

function isAnimal(value: unknown): value is Animal {
  return typeof value === 'string' && (ANIMALS as readonly string[]).includes(value);
}

function isSlot(value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < HIDEOUT_COUNT;
}

function hideoutLabel(slot: number): string { return `${slot + 1}번 ${HIDEOUT_NAMES[slot]}`; }

// --- 조회 ---

export function currentPlayer(state: HideGameState): HidePlayer | null {
  if (state.phase !== 'peek' && state.phase !== 'clue') return null;
  return state.players[state.turnOrder[state.turnPos]];
}

/** 은신처 위에 놓인 단서 토큰 */
export function tokensOn(state: HideGameState, slot: number): Animal[] {
  return ANIMALS.filter(animal => state.tokens[animal] === slot);
}

/** 봉쇄 규칙: 단서 토큰이 2개 놓인 은신처는 엿볼 수 없다 */
export function peekableSlots(state: HideGameState): number[] {
  return Array.from({ length: HIDEOUT_COUNT }, (_, i) => i).filter(i => tokensOn(state, i).length < MAX_TOKENS_PER_HIDEOUT);
}

/** 이번 턴에 고를 수 있는 단서 토큰: 방금 본 동물. 빈 은신처를 봤다면 9종 모두 */
export function clueAnimals(state: HideGameState): Animal[] {
  if (state.phase !== 'clue' || !state.peeked) return [];
  const seen = state.peeked.map(slot => state.hideouts[slot]);
  if (seen.includes('empty')) return [...ANIMALS];
  return ANIMALS.filter(animal => seen.includes(animal));
}

/** 단서 토큰을 놓을 수 있는 은신처: 토큰이 2개 미만이고, 그 토큰이 지금 놓인 곳이 아닌 곳 */
export function clueTargets(state: HideGameState, animal: Animal): number[] {
  return peekableSlots(state).filter(slot => state.tokens[animal] !== slot);
}

/** 스네이크 드래프트 순서: 시작 플레이어부터 한 바퀴, 이어서 역순으로 한 바퀴 */
export function snakeOrder(playerCount: number, startIndex: number): number[] {
  const forward = Array.from({ length: playerCount }, (_, i) => (startIndex + i) % playerCount);
  return [...forward, ...forward.slice().reverse()];
}

// --- 초기화 ---

function setupRound(state: HideGameState, round: number) {
  const random = mulberry32(state.seed + round * 7919);
  const deck: Card[] = [...ANIMALS, 'empty'];
  for (let i = deck.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [deck[i], deck[j]] = [deck[j], deck[i]];
  }
  state.round = round;
  state.hideouts = deck.slice(0, HIDEOUT_COUNT);
  state.removed = deck.slice(HIDEOUT_COUNT);
  state.tokens = Object.fromEntries(ANIMALS.map(animal => [animal, null])) as Record<Animal, number | null>;
  state.turnOrder = snakeOrder(state.players.length, state.roundStartIndex);
  state.turnPos = 0;
  state.peeked = null;
  state.history = [];
  for (const p of state.players) {
    p.board = Array(HIDEOUT_COUNT).fill(null);
    p.known = Array(HIDEOUT_COUNT).fill(null);
    p.submitted = false;
  }
  state.phase = 'peek';
  const first = state.players[state.roundStartIndex];
  pushLog(state, `${round}라운드 시작 — 카드 10장을 섞어 은신처 7곳에 숨기고 3장을 치웠습니다. ${first.name}부터 시작합니다.`);
  state.result = { message: `${round}라운드입니다. ${first.name}의 차례 — 은신처 2곳을 엿보세요.` };
}

export function initializeHideGame(playerIds: string[], playerNames: string[], seed?: number): HideGameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`동물들의 숨바꼭질은 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const first = Math.floor(mulberry32(actualSeed)() * playerIds.length);
  const state: HideGameState = {
    phase: 'peek',
    round: 1,
    totalRounds: playerIds.length,
    players: playerIds.map((id, i) => ({
      id, name: playerNames[i] ?? `술래 ${i + 1}`, total: 0, roundScores: [],
      board: [], known: [], submitted: false,
    })),
    hideouts: [],
    removed: [],
    tokens: {} as Record<Animal, number | null>,
    turnOrder: [],
    turnPos: 0,
    roundStartIndex: first,
    peeked: null,
    history: [],
    results: [],
    log: [],
    step: 0,
    seed: actualSeed,
  };
  pushLog(state, `술래 ${playerIds.length}명이 모였습니다. ${playerIds.length}라운드를 진행하고 누적 점수로 승부를 가립니다.`);
  setupRound(state, 1);
  return state;
}

// --- 추리판 ---

/** 개인 추리 토큰은 동물마다 1개뿐이라, 다른 칸에 올려 둔 같은 동물은 내려온다 */
function setBoard(player: HidePlayer, slot: number, animal: Animal | null) {
  if (animal) {
    for (let i = 0; i < player.board.length; i++) if (player.board[i] === animal) player.board[i] = null;
  }
  player.board[slot] = animal;
}

// --- 점수 ---

function scoreRound(state: HideGameState) {
  const boards: Record<string, (Animal | null)[]> = {};
  const correct: Record<string, boolean[]> = {};
  const scores: Record<string, number> = {};
  for (const p of state.players) {
    const flags = state.hideouts.map((card, i) => p.board[i] === (card === 'empty' ? null : card));
    const score = flags.filter(Boolean).length;
    boards[p.id] = [...p.board];
    correct[p.id] = flags;
    scores[p.id] = score;
    p.total += score;
    p.roundScores.push(score);
  }
  state.results.push({
    round: state.round, hideouts: [...state.hideouts], removed: [...state.removed],
    tokens: { ...state.tokens }, boards, correct, scores,
  });
  const emptySlot = state.hideouts.indexOf('empty');
  pushLog(state, `${state.round}라운드 정답 공개 — ${emptySlot >= 0 ? `${hideoutLabel(emptySlot)}이(가) 빈 은신처였습니다.` : '빈 은신처는 없었습니다 (동물 7마리).'}`);
  for (const p of state.players) pushLog(state, `${p.name}: ${scores[p.id]}곳 적중 (누적 ${p.total}점)`);
  if (state.round >= state.totalRounds) {
    finishGame(state);
  } else {
    state.phase = 'reveal';
    state.result = { message: `${state.round}라운드 정답이 공개됐습니다. 결과를 확인하고 다음 라운드로 넘어가세요.` };
  }
}

function finishGame(state: HideGameState) {
  const last = (p: HidePlayer) => p.roundScores[p.roundScores.length - 1] ?? 0;
  // 누적 점수 → 마지막 라운드 점수 순. 둘 다 같으면 같은 순위(공동 승리)
  const sorted = state.players.slice().sort((a, b) => b.total - a.total || last(b) - last(a));
  let rank = 0;
  state.standings = sorted.map((p, i) => {
    const prev = sorted[i - 1];
    if (!prev || prev.total !== p.total || last(prev) !== last(p)) rank = i + 1;
    return { playerId: p.id, name: p.name, total: p.total, lastRound: last(p), rank, winner: rank === 1 };
  });
  state.phase = 'finished';
  const winners = state.standings.filter(s => s.winner);
  const tiedOnTotal = sorted.filter(p => p.total === sorted[0].total).length;
  const message = winners.length > 1
    ? `${winners.map(w => w.name).join('·')}이(가) ${winners[0].total}점으로 공동 승리했습니다!`
    : tiedOnTotal > 1
      ? `${winners[0].name}이(가) ${winners[0].total}점 동점에서 마지막 라운드 점수(${winners[0].lastRound}점)로 승리했습니다!`
      : `${winners[0].name}이(가) ${winners[0].total}점으로 승리했습니다!`;
  pushLog(state, message);
  state.result = { message };
}

// --- 행동 ---

export function applyHideAction(input: HideGameState, playerId: string, action: HideAction): HideGameState {
  const state = clone(input);
  state.step += 1;
  const player = playerOf(state, playerId);
  const actor = currentPlayer(state);

  if (action.type === 'peek') {
    if (state.phase !== 'peek') throw new Error('지금은 은신처를 엿볼 수 없습니다.');
    if (actor?.id !== playerId) throw new Error('내 차례가 아닙니다.');
    const slots = action.slots;
    if (!Array.isArray(slots) || slots.length !== 2 || !slots.every(isSlot) || slots[0] === slots[1]) {
      throw new Error('서로 다른 은신처 2곳을 고르세요.');
    }
    const open = peekableSlots(state);
    if (!slots.every(slot => open.includes(slot))) throw new Error('단서 토큰이 2개 놓인 은신처는 잠겨 있어 엿볼 수 없습니다.');
    const peeked = slots.slice().sort((a, b) => a - b);
    for (const slot of peeked) {
      const card = state.hideouts[slot];
      player.known[slot] = card;
      setBoard(player, slot, card === 'empty' ? null : card); // 본 내용을 추리판에 자동 메모
    }
    state.peeked = peeked;
    state.phase = 'clue';
    pushLog(state, `${player.name}이(가) ${peeked.map(hideoutLabel).join(', ')}을(를) 몰래 엿봤습니다.`);
    state.result = { message: `${player.name}이(가) ${peeked.map(slot => `${slot + 1}번`).join('·')} 은신처를 엿봤습니다. 이제 단서 토큰을 놓습니다.` };
    return state;
  }

  if (action.type === 'clue') {
    if (state.phase !== 'clue') throw new Error('지금은 단서 토큰을 놓을 수 없습니다.');
    if (actor?.id !== playerId) throw new Error('내 차례가 아닙니다.');
    if (!isAnimal(action.animal)) throw new Error('단서 토큰을 고르세요.');
    if (!isSlot(action.to)) throw new Error('단서 토큰을 놓을 은신처를 고르세요.');
    if (!clueAnimals(state).includes(action.animal)) throw new Error('방금 엿본 동물의 단서 토큰만 놓을 수 있습니다. (빈 은신처를 봤다면 아무 토큰이나 가능)');
    const from = state.tokens[action.animal];
    if (from === action.to) throw new Error('이미 그 은신처에 놓여 있는 토큰입니다. 다른 곳으로 옮기세요.');
    if (tokensOn(state, action.to).length >= MAX_TOKENS_PER_HIDEOUT) throw new Error('단서 토큰은 한 은신처에 2개까지만 놓을 수 있습니다.');
    state.tokens[action.animal] = action.to;
    state.history.push({ playerId, peeked: state.peeked ?? [], animal: action.animal, from, to: action.to });
    const locked = tokensOn(state, action.to).length >= MAX_TOKENS_PER_HIDEOUT;
    const reopened = from !== null && tokensOn(state, from).length === MAX_TOKENS_PER_HIDEOUT - 1;
    pushLog(state, `${player.name}이(가) ${ANIMAL_NAMES[action.animal]} 단서를 ${from === null ? '대기석에서 가져와' : `${hideoutLabel(from)}에서 옮겨`} ${hideoutLabel(action.to)}에 놓았습니다.`
      + (locked ? ` ${action.to + 1}번 은신처가 잠겼습니다.` : '') + (reopened ? ` ${(from as number) + 1}번 은신처가 다시 열렸습니다.` : ''));
    state.peeked = null;
    state.turnPos += 1;
    if (state.turnPos >= state.turnOrder.length) {
      state.phase = 'guess';
      pushLog(state, '모든 술래가 두 번씩 턴을 마쳤습니다. 가림막 뒤에서 최종 추리를 확정하세요.');
      state.result = { message: '최종 추리 단계입니다. 추리판 7칸을 채우고 확정하세요. 빈 은신처라고 생각하면 비워 둡니다.' };
    } else {
      state.phase = 'peek';
      const next = state.players[state.turnOrder[state.turnPos]];
      state.result = { message: `${next.name}의 차례 — 은신처 2곳을 엿보세요.` };
    }
    return state;
  }

  if (action.type === 'set_board') {
    if (state.phase !== 'peek' && state.phase !== 'clue' && state.phase !== 'guess') throw new Error('지금은 추리판을 바꿀 수 없습니다.');
    if (player.submitted) throw new Error('이미 추리를 확정했습니다. 수정하려면 확정을 취소하세요.');
    if (!isSlot(action.slot)) throw new Error('추리판에 없는 칸입니다.');
    if (action.animal !== null && !isAnimal(action.animal)) throw new Error('올바른 동물 토큰이 아닙니다.');
    setBoard(player, action.slot, action.animal);
    return state;
  }

  if (action.type === 'submit_guess') {
    if (state.phase !== 'guess') throw new Error('지금은 최종 추리 단계가 아닙니다.');
    if (player.submitted) throw new Error('이미 추리를 확정했습니다.');
    player.submitted = true;
    pushLog(state, `${player.name}이(가) 추리를 확정했습니다.`);
    if (state.players.every(p => p.submitted)) {
      scoreRound(state);
    } else {
      const waiting = state.players.filter(p => !p.submitted).map(p => p.name).join(', ');
      state.result = { message: `${player.name}이(가) 추리를 확정했습니다. 남은 사람: ${waiting}` };
    }
    return state;
  }

  if (action.type === 'unsubmit_guess') {
    if (state.phase !== 'guess') throw new Error('지금은 최종 추리 단계가 아닙니다.');
    if (!player.submitted) throw new Error('아직 추리를 확정하지 않았습니다.');
    player.submitted = false;
    pushLog(state, `${player.name}이(가) 확정을 취소하고 추리판을 다시 살핍니다.`);
    state.result = { message: `${player.name}이(가) 확정을 취소했습니다.` };
    return state;
  }

  if (action.type === 'next_round') {
    if (state.phase !== 'reveal') throw new Error('지금은 다음 라운드로 넘어갈 수 없습니다.');
    state.roundStartIndex = (state.roundStartIndex + 1) % state.players.length;
    setupRound(state, state.round + 1);
    return state;
  }

  throw new Error('알 수 없는 행동입니다.');
}

// --- 플레이어 시점 ---

export function getHidePlayerView(state: HideGameState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const revealed = state.phase === 'reveal' || state.phase === 'finished';
  const actor = currentPlayer(state);
  const myTurn = !!me && actor?.id === me.id;
  const lastResult = revealed ? state.results[state.results.length - 1] : null;
  const turnsTaken = (index: number) => state.turnOrder.slice(0, state.turnPos).filter(i => i === index).length;
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    currentPlayerId: actor?.id ?? null,
    turnOrder: state.turnOrder.map(i => state.players[i].id),
    turnPos: state.turnPos,
    animals: ANIMALS,
    hideouts: state.hideouts.map((card, i) => {
      const tokens = tokensOn(state, i);
      return {
        index: i,
        name: HIDEOUT_NAMES[i],
        tokens,
        locked: tokens.length >= MAX_TOKENS_PER_HIDEOUT,
        peeking: !!state.peeked?.includes(i),
        card: revealed ? card : null,                 // 정답은 라운드 공개 뒤에만
        known: revealed ? null : me?.known[i] ?? null, // 내가 직접 본 카드는 나에게만
      };
    }),
    reserve: ANIMALS.filter(animal => state.tokens[animal] === null),
    removed: revealed ? state.removed : null,
    peekable: myTurn && state.phase === 'peek' ? peekableSlots(state) : [],
    clueAnimals: myTurn && state.phase === 'clue' ? clueAnimals(state) : [],
    board: me ? me.board : null,
    submitted: me?.submitted ?? false,
    history: state.history,
    lastResult,
    standings: state.standings ?? null,
    log: state.log,
    result: state.result ?? null,
    myId: me?.id ?? null,
    players: state.players.map((p, i) => ({
      id: p.id, name: p.name, total: p.total, roundScores: p.roundScores,
      turnsTaken: turnsTaken(i), submitted: p.submitted, isMe: p.id === playerId,
    })),
  };
}
