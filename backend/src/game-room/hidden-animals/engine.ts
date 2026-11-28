// 숨은 동물 찾기 엔진. 규칙과 해석은 docs/hidden-animals-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

/** 일반 동물. 카드가 덜 필요하면 뒤에서부터 빠진다 (곰은 자리가 남을 때만 들어간다). */
export const NORMALS = ['raccoon', 'deer', 'rabbit', 'squirrel', 'fox', 'woodpecker', 'cuckoo', 'owl', 'bear'] as const;
/** 특수 동물. Lv.1 은 맨 앞의 오소리를 쓴다. */
export const SPECIALS = ['badger', 'parrot', 'monkey', 'snake'] as const;
export const ANIMALS = [...NORMALS, ...SPECIALS] as const;
export type Animal = typeof ANIMALS[number];
export type Special = typeof SPECIALS[number];
export type Card = Animal | 'empty';
/** peek = 은신처 2곳 엿보기, clue = 단서 토큰 놓기, guess = 최종 추리, reveal = 라운드 정답 공개 */
export type HiddenPhase = 'peek' | 'clue' | 'guess' | 'reveal' | 'finished';

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const MAX_TOKENS_PER_HIDEOUT = 2;
export const HIDEOUT_NAMES = ['나무', '바위', '계곡', '덤불', '절벽', '꽃밭', '동굴', '폭포'];
/** 원숭이가 숨으면 빈 은신처처럼 보이는 곳 (1번 나무) */
export const TREE_SLOT = 0;
/** 뱀이 숨으면 빈 은신처처럼 보이는 곳 (4번 덤불) */
export const BUSH_SLOT = 3;
export const ANIMAL_NAMES: Record<Animal, string> = {
  raccoon: '너구리', deer: '사슴', rabbit: '토끼', squirrel: '다람쥐', fox: '여우',
  woodpecker: '딱따구리', cuckoo: '뻐꾸기', owl: '부엉이', bear: '곰',
  badger: '오소리', parrot: '앵무새', monkey: '원숭이', snake: '뱀',
};

/** 인원수별 은신처 수: 3인 6곳, 4~5인 7곳, 6인 8곳 */
export function hideoutCountFor(playerCount: number): number {
  return playerCount <= 3 ? 6 : playerCount <= 5 ? 7 : 8;
}
/** 인원수별 동물 카드 수: 3~5인 9장, 6인 10장 (빈 은신처 1장은 별도) */
export function animalCountFor(playerCount: number): number {
  return playerCount >= 6 ? 10 : 9;
}

/** 방장이 고르는 난이도. 특수 동물은 일반 동물 카드와 1:1 로 바꿔 넣는다. */
export interface HiddenOptions {
  level: number;        // 0~4 = 넣는 특수 동물 수
  random: boolean;      // Lv.2·3 에서만: 어떤 특수 동물이 들어갔는지 숨기고 라운드마다 무작위로 뽑는다
  specials: Special[];  // 직접 고른 특수 동물 (random 이면 빈 배열)
}
export const DEFAULT_HIDDEN_OPTIONS: HiddenOptions = { level: 0, random: false, specials: [] };

/** 난이도 옵션을 검증한다. 규칙에 맞지 않으면 예외를 던진다. */
export function normalizeHiddenOptions(raw?: Partial<HiddenOptions> | null): HiddenOptions {
  const level = raw?.level ?? DEFAULT_HIDDEN_OPTIONS.level;
  if (!Number.isInteger(level) || level < 0 || level > SPECIALS.length) throw new Error('난이도는 Lv.0~Lv.4 중에서 고르세요.');
  // Lv.0·1·4 는 구성이 정해져 있다: 없음 / 오소리 / 네 종 모두
  if (level === 0) return { level, random: false, specials: [] };
  if (level === 1) return { level, random: false, specials: ['badger'] };
  if (level === SPECIALS.length) return { level, random: false, specials: [...SPECIALS] };
  if (raw?.random !== undefined && typeof raw.random !== 'boolean') throw new Error('무작위 여부가 올바르지 않습니다.');
  if (raw?.random) return { level, random: true, specials: [] };
  const picked = raw?.specials ?? SPECIALS.slice(0, level);
  if (!Array.isArray(picked) || picked.some(s => !(SPECIALS as readonly string[]).includes(s)) || new Set(picked).size !== picked.length) {
    throw new Error('특수 동물은 앵무새·오소리·원숭이·뱀 중에서 겹치지 않게 고르세요.');
  }
  if (picked.length !== level) throw new Error(`Lv.${level}은 특수 동물을 정확히 ${level}종 골라야 합니다.`);
  return { level, random: false, specials: SPECIALS.filter(s => picked.includes(s)) };
}

/** 이 인원·난이도에서 쓰는 일반 동물. 특수 동물 수만큼 줄어든다. 너구리는 항상 포함된다. */
export function normalsFor(playerCount: number, level: number): Animal[] {
  return NORMALS.slice(0, Math.min(NORMALS.length, animalCountFor(playerCount) - level));
}

export interface HiddenPlayer {
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
  specials: Special[];
  tokens: Partial<Record<Animal, number | null>>;
  boards: Record<string, (Animal | null)[]>;
  correct: Record<string, boolean[]>;
  scores: Record<string, number>;
}

export interface Standing { playerId: string; name: string; total: number; lastRound: number; rank: number; winner: boolean }

export interface HiddenGameState {
  phase: HiddenPhase;
  round: number;
  totalRounds: number;
  players: HiddenPlayer[];
  options: HiddenOptions;
  hideoutCount: number;
  hideouts: Card[];                       // 비공개: 은신처별 카드
  removed: Card[];                        // 비공개: 치워 둔 카드
  roundSpecials: Special[];               // 이번 라운드 덱에 든 특수 동물 (무작위 모드에서는 공개 전까지 비공개)
  animals: Animal[];                      // 이번 라운드의 단서·추리 토큰 종류
  tokens: Partial<Record<Animal, number | null>>;  // 단서 토큰 위치. null = 대기석
  turnOrder: number[];                    // 스네이크 순서 (players 인덱스)
  turnPos: number;
  roundStartIndex: number;
  eyes: number[] | null;                  // 눈 토큰 2개가 놓인 은신처: 가장 최근에 엿본 2곳
  eyesBy: string | null;                  // 눈 토큰을 놓은 사람
  peekSeen: Card[] | null;                // 비공개: 현재 턴에 엿본 카드 (eyes 와 같은 순서)
  lastClue: { playerId: string; animal: Animal; to: number } | null;  // 직전 턴에 놓인 최신 단서 토큰
  history: TurnRecord[];                  // 이번 라운드의 턴 기록
  results: RoundResult[];
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  standings?: Standing[];
  step: number;
  seed: number;
}

export type HiddenAction =
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

function shuffle<T>(items: T[], random: () => number): T[] {
  const list = items.slice();
  for (let i = list.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [list[i], list[j]] = [list[j], list[i]];
  }
  return list;
}

function clone<T>(value: T): T { return JSON.parse(JSON.stringify(value)); }

// 조사: 받침이 있으면 앞의 것, 없으면 뒤의 것
function hasBatchim(word: string): boolean {
  const code = word.charCodeAt(word.length - 1);
  return code >= 0xac00 && code <= 0xd7a3 && (code - 0xac00) % 28 !== 0;
}
const iga = (word: string) => `${word}${hasBatchim(word) ? '이' : '가'}`;
const eulreul = (word: string) => `${word}${hasBatchim(word) ? '을' : '를'}`;

function pushLog(state: HiddenGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function playerOf(state: HiddenGameState, playerId: string): HiddenPlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return player;
}

/** 이번 라운드에 토큰이 있는 동물인가 */
function isAnimal(state: HiddenGameState, value: unknown): value is Animal {
  return typeof value === 'string' && (state.animals as string[]).includes(value);
}

function isSlot(state: HiddenGameState, value: unknown): value is number {
  return Number.isInteger(value) && (value as number) >= 0 && (value as number) < state.hideoutCount;
}

function hideoutLabel(slot: number): string { return `${slot + 1}번 ${HIDEOUT_NAMES[slot]}`; }

// --- 조회 ---

export function currentPlayer(state: HiddenGameState): HiddenPlayer | null {
  if (state.phase !== 'peek' && state.phase !== 'clue') return null;
  return state.players[state.turnOrder[state.turnPos]];
}

/** 은신처 위에 놓인 단서 토큰 */
export function tokensOn(state: HiddenGameState, slot: number): Animal[] {
  return state.animals.filter(animal => state.tokens[animal] === slot);
}

/** 잠금 규칙: 단서 토큰이 2개 놓인 은신처는 엿볼 수 없다 */
export function peekableSlots(state: HiddenGameState): number[] {
  return Array.from({ length: state.hideoutCount }, (_, i) => i).filter(i => tokensOn(state, i).length < MAX_TOKENS_PER_HIDEOUT);
}

/** 그 자리에서 빈 은신처처럼 보이는 카드인가: 빈 은신처, 1번 나무의 원숭이, 4번 덤불의 뱀 */
export function looksEmpty(card: Card, slot: number): 'empty' | 'monkey' | 'snake' | null {
  if (card === 'empty') return 'empty';
  if (card === 'monkey' && slot === TREE_SLOT) return 'monkey';
  if (card === 'snake' && slot === BUSH_SLOT) return 'snake';
  return null;
}

export interface ClueInfo {
  animals: Animal[];                          // 놓을 수 있는 단서 토큰
  any: ('empty' | 'monkey' | 'snake')[];      // 아무 토큰이나 놓을 수 있게 된 이유 (없으면 빈 배열)
  disguise: boolean;                          // 오소리를 봐서 너구리 토큰으로 위장할 수 있다
  copy: Animal | null;                        // 앵무새를 봐서 따라 놓을 수 있는 직전 단서 토큰
}

/** 이번 턴에 고를 수 있는 단서 토큰과 그 이유 */
export function clueInfo(state: HiddenGameState): ClueInfo {
  if (state.phase !== 'clue' || !state.peekSeen || !state.eyes) return { animals: [], any: [], disguise: false, copy: null };
  const seen = state.peekSeen;
  const any = seen.map((card, i) => looksEmpty(card, state.eyes![i])).filter((x): x is 'empty' | 'monkey' | 'snake' => !!x);
  const disguise = seen.includes('badger') && state.animals.includes('raccoon');
  const copy = seen.includes('parrot') && state.lastClue ? state.lastClue.animal : null;
  const allowed = new Set<Card>(seen);
  if (disguise) allowed.add('raccoon');
  if (copy) allowed.add(copy);
  return { animals: any.length ? [...state.animals] : state.animals.filter(animal => allowed.has(animal)), any, disguise, copy };
}

export function clueAnimals(state: HiddenGameState): Animal[] { return clueInfo(state).animals; }

/** 단서 토큰을 놓을 수 있는 은신처: 눈 토큰이 놓인 2곳 중, 그 토큰이 지금 놓인 곳이 아닌 곳 */
export function clueTargets(state: HiddenGameState, animal: Animal): number[] {
  return (state.eyes ?? []).filter(slot => tokensOn(state, slot).length < MAX_TOKENS_PER_HIDEOUT && state.tokens[animal] !== slot);
}

/** 스네이크 드래프트 순서: 시작 플레이어부터 한 바퀴, 이어서 역순으로 한 바퀴 */
export function snakeOrder(playerCount: number, startIndex: number): number[] {
  const forward = Array.from({ length: playerCount }, (_, i) => (startIndex + i) % playerCount);
  return [...forward, ...forward.slice().reverse()];
}

// --- 초기화 ---

function setupRound(state: HiddenGameState, round: number) {
  const random = mulberry32(state.seed + round * 7919);
  const { options } = state;
  const playerCount = state.players.length;
  // 무작위 모드는 라운드마다 특수 동물을 새로 뽑는다 (정답 공개로 드러나기 때문)
  const drawn = options.random ? shuffle<Special>([...SPECIALS], random).slice(0, options.level) : options.specials;
  const specials: Special[] = SPECIALS.filter(s => drawn.includes(s));
  const normals = normalsFor(playerCount, options.level);
  const deck = shuffle<Card>([...normals, ...specials, 'empty'], random);
  state.round = round;
  state.roundSpecials = specials;
  // 무작위 모드에서는 어떤 특수 동물이 들었는지 모르도록 네 종의 토큰을 모두 꺼내 둔다
  const inPlay: Animal[] = [...normals, ...(options.random ? SPECIALS : specials)];
  state.animals = ANIMALS.filter(animal => inPlay.includes(animal));
  state.hideouts = deck.slice(0, state.hideoutCount);
  state.removed = deck.slice(state.hideoutCount);
  state.tokens = Object.fromEntries(state.animals.map(animal => [animal, null]));
  state.turnOrder = snakeOrder(playerCount, state.roundStartIndex);
  state.turnPos = 0;
  state.eyes = null;
  state.eyesBy = null;
  state.peekSeen = null;
  state.lastClue = null;
  state.history = [];
  for (const p of state.players) {
    p.board = Array(state.hideoutCount).fill(null);
    p.known = Array(state.hideoutCount).fill(null);
    p.submitted = false;
  }
  state.phase = 'peek';
  const first = state.players[state.roundStartIndex];
  pushLog(state, `${round}라운드 시작 — 카드 ${deck.length}장(동물 ${deck.length - 1} + 빈 은신처 1)을 섞어 은신처 ${state.hideoutCount}곳에 숨기고 ${state.removed.length}장을 치웠습니다. ${first.name}부터 시작합니다.`);
  state.result = { message: `${round}라운드입니다. ${first.name}의 차례 — 은신처 2곳을 엿보세요.` };
}

export function initializeHiddenGame(playerIds: string[], playerNames: string[], seed?: number, rawOptions?: Partial<HiddenOptions> | null): HiddenGameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`숨은 동물 찾기는 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const options = normalizeHiddenOptions(rawOptions);
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const first = Math.floor(mulberry32(actualSeed)() * playerIds.length);
  const state: HiddenGameState = {
    phase: 'peek',
    round: 1,
    totalRounds: playerIds.length,
    players: playerIds.map((id, i) => ({
      id, name: playerNames[i] ?? `술래 ${i + 1}`, total: 0, roundScores: [],
      board: [], known: [], submitted: false,
    })),
    options,
    hideoutCount: hideoutCountFor(playerIds.length),
    hideouts: [],
    removed: [],
    roundSpecials: [],
    animals: [],
    tokens: {},
    turnOrder: [],
    turnPos: 0,
    roundStartIndex: first,
    eyes: null,
    eyesBy: null,
    peekSeen: null,
    lastClue: null,
    history: [],
    results: [],
    log: [],
    step: 0,
    seed: actualSeed,
  };
  const levelText = options.level === 0 ? '특수 동물 없음'
    : options.random ? `특수 동물 ${options.level}종 비공개 무작위`
      : `특수 동물 ${options.specials.map(s => ANIMAL_NAMES[s]).join('·')}`;
  pushLog(state, `술래 ${playerIds.length}명이 모였습니다. Lv.${options.level}(${levelText}), 은신처 ${state.hideoutCount}곳으로 ${playerIds.length}라운드를 진행합니다.`);
  setupRound(state, 1);
  return state;
}

// --- 추리판 ---

/** 개인 추리 토큰은 동물마다 1개뿐이라, 다른 칸에 올려 둔 같은 동물은 내려온다 */
function setBoard(player: HiddenPlayer, slot: number, animal: Animal | null) {
  if (animal) {
    for (let i = 0; i < player.board.length; i++) if (player.board[i] === animal) player.board[i] = null;
  }
  player.board[slot] = animal;
}

// --- 점수 ---

function scoreRound(state: HiddenGameState) {
  const boards: Record<string, (Animal | null)[]> = {};
  const correct: Record<string, boolean[]> = {};
  const scores: Record<string, number> = {};
  for (const p of state.players) {
    // 나무의 원숭이·덤불의 뱀도 실제 카드(원숭이·뱀)를 맞혀야 한다
    const flags = state.hideouts.map((card, i) => p.board[i] === (card === 'empty' ? null : card));
    const score = flags.filter(Boolean).length;
    boards[p.id] = [...p.board];
    correct[p.id] = flags;
    scores[p.id] = score;
    p.total += score;
    p.roundScores.push(score);
  }
  state.results.push({
    round: state.round, hideouts: [...state.hideouts], removed: [...state.removed], specials: [...state.roundSpecials],
    tokens: { ...state.tokens }, boards, correct, scores,
  });
  const emptySlot = state.hideouts.indexOf('empty');
  pushLog(state, `${state.round}라운드 정답 공개 — ${emptySlot >= 0 ? `빈 은신처는 ${hideoutLabel(emptySlot)}였습니다.` : `빈 은신처는 없었습니다 (동물 ${state.hideoutCount}마리).`}`);
  for (const p of state.players) pushLog(state, `${p.name}: ${scores[p.id]}곳 적중 (누적 ${p.total}점)`);
  if (state.round >= state.totalRounds) {
    finishGame(state);
  } else {
    state.phase = 'reveal';
    state.result = { message: `${state.round}라운드 정답이 공개됐습니다. 결과를 확인하고 다음 라운드로 넘어가세요.` };
  }
}

function finishGame(state: HiddenGameState) {
  const last = (p: HiddenPlayer) => p.roundScores[p.roundScores.length - 1] ?? 0;
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
    ? `${iga(winners.map(w => w.name).join('·'))} ${winners[0].total}점으로 공동 승리했습니다!`
    : tiedOnTotal > 1
      ? `${iga(winners[0].name)} ${winners[0].total}점 동점에서 마지막 라운드 점수(${winners[0].lastRound}점)로 승리했습니다!`
      : `${iga(winners[0].name)} ${winners[0].total}점으로 승리했습니다!`;
  pushLog(state, message);
  state.result = { message };
}

// --- 행동 ---

export function applyHiddenAction(input: HiddenGameState, playerId: string, action: HiddenAction): HiddenGameState {
  const state = clone(input);
  state.step += 1;
  const player = playerOf(state, playerId);
  const actor = currentPlayer(state);

  if (action.type === 'peek') {
    if (state.phase !== 'peek') throw new Error('지금은 은신처를 엿볼 수 없습니다.');
    if (actor?.id !== playerId) throw new Error('내 차례가 아닙니다.');
    const slots = action.slots;
    if (!Array.isArray(slots) || slots.length !== 2 || !slots.every(slot => isSlot(state, slot)) || slots[0] === slots[1]) {
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
    // 눈 토큰 2개를 새로 고른 2곳으로 옮긴다
    state.eyes = peeked;
    state.eyesBy = playerId;
    state.peekSeen = peeked.map(slot => state.hideouts[slot]);
    state.phase = 'clue';
    pushLog(state, `${iga(player.name)} ${eulreul(peeked.map(hideoutLabel).join(', '))} 몰래 엿봤습니다.`);
    state.result = { message: `${iga(player.name)} ${peeked.map(slot => `${slot + 1}번`).join('·')} 은신처를 엿봤습니다. 이제 단서 토큰을 놓습니다.` };
    return state;
  }

  if (action.type === 'clue') {
    if (state.phase !== 'clue') throw new Error('지금은 단서 토큰을 놓을 수 없습니다.');
    if (actor?.id !== playerId) throw new Error('내 차례가 아닙니다.');
    if (!isAnimal(state, action.animal)) throw new Error('단서 토큰을 고르세요.');
    if (!isSlot(state, action.to)) throw new Error('단서 토큰을 놓을 은신처를 고르세요.');
    if (!clueInfo(state).animals.includes(action.animal)) throw new Error('이번 턴에는 그 단서 토큰을 놓을 수 없습니다. 방금 엿본 동물의 토큰을 고르세요.');
    if (!state.eyes?.includes(action.to)) throw new Error('단서 토큰은 눈 토큰이 놓인(방금 엿본) 두 은신처 중 한 곳에만 놓을 수 있습니다.');
    const from = state.tokens[action.animal] ?? null;
    if (from === action.to) throw new Error('이미 그 은신처에 놓여 있는 토큰입니다. 다른 곳으로 옮기세요.');
    if (tokensOn(state, action.to).length >= MAX_TOKENS_PER_HIDEOUT) throw new Error('단서 토큰은 한 은신처에 2개까지만 놓을 수 있습니다.');
    state.tokens[action.animal] = action.to;
    state.history.push({ playerId, peeked: state.eyes, animal: action.animal, from, to: action.to });
    state.lastClue = { playerId, animal: action.animal, to: action.to };
    const locked = tokensOn(state, action.to).length >= MAX_TOKENS_PER_HIDEOUT;
    const reopened = from !== null && tokensOn(state, from).length === MAX_TOKENS_PER_HIDEOUT - 1;
    pushLog(state, `${iga(player.name)} ${ANIMAL_NAMES[action.animal]} 단서를 ${from === null ? '대기석에서 가져와' : `${hideoutLabel(from)}에서 옮겨`} ${hideoutLabel(action.to)}에 놓았습니다.`
      + (locked ? ` ${action.to + 1}번 은신처가 잠겼습니다.` : '') + (reopened ? ` ${(from as number) + 1}번 은신처가 다시 열렸습니다.` : ''));
    // 눈 토큰은 다음 사람이 엿볼 때까지 그 자리에 남는다
    state.peekSeen = null;
    state.turnPos += 1;
    if (state.turnPos >= state.turnOrder.length) {
      state.phase = 'guess';
      pushLog(state, '모든 술래가 두 번씩 턴을 마쳤습니다. 가림막 뒤에서 최종 추리를 확정하세요.');
      state.result = { message: `최종 추리 단계입니다. 추리판 ${state.hideoutCount}칸을 채우고 확정하세요. 빈 은신처라고 생각하면 비워 둡니다.` };
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
    if (!isSlot(state, action.slot)) throw new Error('추리판에 없는 칸입니다.');
    if (action.animal !== null && !isAnimal(state, action.animal)) throw new Error('올바른 동물 토큰이 아닙니다.');
    setBoard(player, action.slot, action.animal);
    return state;
  }

  if (action.type === 'submit_guess') {
    if (state.phase !== 'guess') throw new Error('지금은 최종 추리 단계가 아닙니다.');
    if (player.submitted) throw new Error('이미 추리를 확정했습니다.');
    player.submitted = true;
    pushLog(state, `${iga(player.name)} 추리를 확정했습니다.`);
    if (state.players.every(p => p.submitted)) {
      scoreRound(state);
    } else {
      const waiting = state.players.filter(p => !p.submitted).map(p => p.name).join(', ');
      state.result = { message: `${iga(player.name)} 추리를 확정했습니다. 남은 사람: ${waiting}` };
    }
    return state;
  }

  if (action.type === 'unsubmit_guess') {
    if (state.phase !== 'guess') throw new Error('지금은 최종 추리 단계가 아닙니다.');
    if (!player.submitted) throw new Error('아직 추리를 확정하지 않았습니다.');
    player.submitted = false;
    pushLog(state, `${iga(player.name)} 확정을 취소하고 추리판을 다시 살핍니다.`);
    state.result = { message: `${iga(player.name)} 확정을 취소했습니다.` };
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

export function getHiddenPlayerView(state: HiddenGameState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const revealed = state.phase === 'reveal' || state.phase === 'finished';
  const actor = currentPlayer(state);
  const myTurn = !!me && actor?.id === me.id;
  const myClueTurn = myTurn && state.phase === 'clue';
  const lastResult = revealed ? state.results[state.results.length - 1] : null;
  const turnsTaken = (index: number) => state.turnOrder.slice(0, state.turnPos).filter(i => i === index).length;
  return {
    phase: state.phase,
    round: state.round,
    totalRounds: state.totalRounds,
    currentPlayerId: actor?.id ?? null,
    turnOrder: state.turnOrder.map(i => state.players[i].id),
    turnPos: state.turnPos,
    animals: state.animals,
    options: state.options,
    deck: {
      hideouts: state.hideoutCount,
      animals: state.hideouts.length + state.removed.length - 1,
      removed: state.removed.length,
      // 무작위 모드에서는 어떤 특수 동물이 들었는지 라운드 공개 뒤에만 알려 준다
      specials: state.options.random && !revealed ? null : state.roundSpecials,
    },
    hideouts: state.hideouts.map((card, i) => {
      const tokens = tokensOn(state, i);
      return {
        index: i,
        name: HIDEOUT_NAMES[i],
        tokens,
        locked: tokens.length >= MAX_TOKENS_PER_HIDEOUT,
        eye: !revealed && !!state.eyes?.includes(i),   // 눈 토큰: 가장 최근에 엿본 곳
        card: revealed ? card : null,                  // 정답은 라운드 공개 뒤에만
        known: revealed ? null : me?.known[i] ?? null, // 내가 직접 본 카드는 나에게만
      };
    }),
    eyesBy: revealed ? null : state.eyesBy,
    eyesNow: state.phase === 'clue',                   // 눈 토큰이 지금 진행 중인 턴의 것인가 (아니면 직전 턴의 것)
    lastClue: revealed ? null : state.lastClue,
    reserve: state.animals.filter(animal => state.tokens[animal] === null),
    removed: revealed ? state.removed : null,
    peekable: myTurn && state.phase === 'peek' ? peekableSlots(state) : [],
    // 내 단서 차례에만: 엿본 카드와, 고를 수 있는 토큰과 그 이유
    mySeen: myClueTurn && state.eyes && state.peekSeen ? state.eyes.map((slot, i) => ({ slot, card: state.peekSeen![i] })) : null,
    clue: myClueTurn ? clueInfo(state) : null,
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
