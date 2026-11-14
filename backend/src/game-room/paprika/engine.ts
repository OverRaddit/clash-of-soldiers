// 파프리카 대축제 엔진. 규칙과 해석은 docs/paprika-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export type TokenKind = 'seed' | 'thief';
export type PaprikaPhase = 'planting' | 'harvest' | 'finished';
export type Outcome = 'festival' | 'farmer' | 'famine' | 'none';

export interface Cell { id: string; q: number; r: number }

export interface Token {
  cell: string;
  ownerId: string;
  kind: TokenKind;
  order: number;        // 이번 라운드에서 몇 번째로 놓였는가 (1부터). 같은 씨앗을 노리는 도둑 사이의 우선권
}

/** 수확 단계에서 토큰 하나가 맞은 운명 */
export interface TokenFate {
  cell: string;
  ownerId: string;
  kind: TokenKind;
  removed?: boolean;      // 도둑끼리 붙어 제거됨
  loot?: number;          // 살아남은 도둑이 털어간 파프리카 수
  stolenBy?: string;      // 씨앗의 파프리카를 가져간 도둑 주인
  harvested?: boolean;    // 씨앗 주인이 안전하게 수확
}

export interface HarvestResult {
  round: number;
  fates: TokenFate[];
  gains: Record<string, number>;   // 이번 라운드에 플레이어별로 얻은 파프리카
  total: number;                    // 이번 라운드에 생긴 파프리카 합계
}

export interface PaprikaPlayer {
  id: string;
  name: string;
  paprika: number;
  placed: number;           // 이번 라운드에 놓은 토큰 수
  skipped: boolean;         // 놓을 칸이 없어 이번 라운드 파종을 마감했는가
  roundGains: number[];     // 라운드별 획득량
}

export interface Standing { playerId: string; name: string; paprika: number; rank: number; winner: boolean }

export interface PaprikaGameState {
  phase: PaprikaPhase;
  round: number;             // 1 또는 2
  players: PaprikaPlayer[];
  turnIndex: number;         // players 배열에서 현재 차례
  roundStartIndex: number;   // 이번 라운드의 선플레이어
  tokensPerPlayer: number;
  radius: number;
  cells: Cell[];
  board: Token[];
  harvests: HarvestResult[];
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  outcome?: Outcome;
  standings?: Standing[];
  total?: number;
  lastPlaced?: { cell: string; ownerId: string };
  step: number;
  seed: number;
}

export type PaprikaAction =
  | { type: 'place'; cell: string; kind: TokenKind }
  | { type: 'next_round' };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const ROUNDS = 2;
export const FESTIVAL_GOAL = 25;
export const FARMER_MIN = 4;
export const BOARD_RADIUS = 3; // 육각 반지름 3 = 37칸
/** 인원별 1인당 토큰 수. 두 라운드의 토큰 총합이 축제 목표(25)를 넘도록 잡았다. */
export const TOKENS_BY_PLAYERS: Record<number, number> = { 3: 5, 4: 4, 5: 3, 6: 3 };
export const KIND_NAMES: Record<TokenKind, string> = { seed: '씨앗', thief: '도둑' };

const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

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

function pushLog(state: PaprikaGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 80) state.log.splice(0, state.log.length - 80);
}

function playerOf(state: PaprikaGameState, playerId: string): PaprikaPlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return player;
}

// --- 육각 격자 ---

export function cellId(q: number, r: number): string { return `${q},${r}`; }

export function buildCells(radius: number): Cell[] {
  const cells: Cell[] = [];
  for (let q = -radius; q <= radius; q++) {
    for (let r = -radius; r <= radius; r++) {
      if (Math.abs(q + r) <= radius) cells.push({ id: cellId(q, r), q, r });
    }
  }
  return cells;
}

export function neighborsOf(cell: string): string[] {
  const [q, r] = cell.split(',').map(Number);
  return DIRS.map(([dq, dr]) => cellId(q + dq, r + dr));
}

function tokenAt(state: PaprikaGameState, cell: string): Token | undefined {
  return state.board.find(t => t.cell === cell);
}

/** 거리두기 규칙: 비어 있고, 내 토큰과 인접하지 않은 칸 */
export function legalCells(state: PaprikaGameState, playerId: string): string[] {
  const occupied = new Set(state.board.map(t => t.cell));
  const mine = new Set(state.board.filter(t => t.ownerId === playerId).map(t => t.cell));
  return state.cells
    .map(c => c.id)
    .filter(id => !occupied.has(id) && !neighborsOf(id).some(n => mine.has(n)));
}

// --- 초기화 ---

export function initializePaprikaGame(playerIds: string[], playerNames: string[], seed?: number): PaprikaGameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`파프리카 대축제는 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(actualSeed);
  const first = Math.floor(random() * playerIds.length);
  const state: PaprikaGameState = {
    phase: 'planting',
    round: 1,
    players: playerIds.map((id, i) => ({ id, name: playerNames[i] ?? `농부 ${i + 1}`, paprika: 0, placed: 0, skipped: false, roundGains: [] })),
    turnIndex: first,
    roundStartIndex: first,
    tokensPerPlayer: TOKENS_BY_PLAYERS[playerIds.length],
    radius: BOARD_RADIUS,
    cells: buildCells(BOARD_RADIUS),
    board: [],
    harvests: [],
    log: [],
    step: 0,
    seed: actualSeed,
  };
  pushLog(state, `농부 ${playerIds.length}명이 모였습니다. 1인당 토큰 ${state.tokensPerPlayer}개씩, 두 라운드를 심습니다.`);
  pushLog(state, `1라운드 파종 시작 — ${state.players[first].name}부터 심습니다.`);
  state.result = { message: `${state.players[first].name}의 차례입니다. 씨앗이나 도둑을 빈칸에 뒷면으로 놓으세요.` };
  return state;
}

// --- 파종 ---

function placementsDone(state: PaprikaGameState): boolean {
  return state.players.every(p => p.placed >= state.tokensPerPlayer || p.skipped);
}

/** 다음 차례를 찾는다. 놓을 칸이 없는 사람은 건너뛰며, 모두 끝났으면 false */
function advanceTurn(state: PaprikaGameState): boolean {
  for (let i = 1; i <= state.players.length; i++) {
    const index = (state.turnIndex + i) % state.players.length;
    const player = state.players[index];
    if (player.placed >= state.tokensPerPlayer || player.skipped) continue;
    if (legalCells(state, player.id).length === 0) {
      player.skipped = true;
      pushLog(state, `${player.name}은(는) 거리두기 규칙 때문에 더 놓을 칸이 없어 파종을 마칩니다.`);
      continue;
    }
    state.turnIndex = index;
    return true;
  }
  return false;
}

// --- 수확 ---

export function resolveHarvest(state: PaprikaGameState): HarvestResult {
  const byCell = new Map(state.board.map(t => [t.cell, t]));
  const fates = new Map<string, TokenFate>(state.board.map(t => [t.cell, { cell: t.cell, ownerId: t.ownerId, kind: t.kind }]));
  const gains: Record<string, number> = Object.fromEntries(state.players.map(p => [p.id, 0]));

  // ① 정의의 심판: 다른 도둑과 인접한 도둑은 모두 제거
  const thieves = state.board.filter(t => t.kind === 'thief');
  for (const thief of thieves) {
    if (neighborsOf(thief.cell).some(n => byCell.get(n)?.kind === 'thief')) fates.get(thief.cell)!.removed = true;
  }
  const survivors = thieves.filter(t => !fates.get(t.cell)!.removed).sort((a, b) => a.order - b.order);

  // ② 씨앗 발아 → ③ 도둑의 약탈 (같은 씨앗을 노리면 먼저 놓인 도둑이 가져간다) → ④ 농부의 수확
  const taken = new Set<string>();
  for (const thief of survivors) {
    let loot = 0;
    for (const n of neighborsOf(thief.cell)) {
      const seed = byCell.get(n);
      if (!seed || seed.kind !== 'seed' || taken.has(n)) continue;
      taken.add(n);
      fates.get(n)!.stolenBy = thief.ownerId;
      loot += 1;
    }
    fates.get(thief.cell)!.loot = loot;
    gains[thief.ownerId] += loot;
  }
  let total = 0;
  for (const token of state.board) {
    if (token.kind !== 'seed') continue;
    total += 1;
    if (!taken.has(token.cell)) {
      fates.get(token.cell)!.harvested = true;
      gains[token.ownerId] += 1;
    }
  }
  return { round: state.round, fates: [...fates.values()], gains, total };
}

function finishRound(state: PaprikaGameState) {
  const harvest = resolveHarvest(state);
  state.harvests.push(harvest);
  for (const p of state.players) {
    const gain = harvest.gains[p.id] ?? 0;
    p.paprika += gain;
    p.roundGains.push(gain);
  }
  const removed = harvest.fates.filter(f => f.removed).length;
  pushLog(state, `${state.round}라운드 수확 — 모든 토큰을 뒤집었습니다. 도둑 ${removed}개가 서로 싸우다 제거됐고, 파프리카 ${harvest.total}개가 열렸습니다.`);
  for (const p of state.players) pushLog(state, `${p.name}: +${harvest.gains[p.id] ?? 0} (누적 ${p.paprika})`);
  if (state.round >= ROUNDS) {
    finishGame(state);
  } else {
    state.phase = 'harvest';
    state.result = { message: `${state.round}라운드 수확이 끝났습니다. 결과를 확인하고 다음 라운드로 넘어가세요.` };
  }
}

function finishGame(state: PaprikaGameState) {
  const total = state.players.reduce((sum, p) => sum + p.paprika, 0);
  const sorted = state.players.slice().sort((a, b) => b.paprika - a.paprika);
  const top = sorted[0].paprika;
  const leaders = sorted.filter(p => p.paprika === top);
  let outcome: Outcome;
  if (total >= FESTIVAL_GOAL) outcome = 'festival';
  else if (leaders.length > 1) outcome = 'famine';
  else if (top >= FARMER_MIN) outcome = 'farmer';
  else outcome = 'none';
  const winners = new Set(outcome === 'festival' ? state.players.map(p => p.id) : outcome === 'farmer' ? [leaders[0].id] : []);
  let rank = 0;
  let prev = -1;
  state.standings = sorted.map((p, i) => {
    if (p.paprika !== prev) { rank = i + 1; prev = p.paprika; }
    return { playerId: p.id, name: p.name, paprika: p.paprika, rank, winner: winners.has(p.id) };
  });
  state.total = total;
  state.outcome = outcome;
  state.phase = 'finished';
  const message = outcome === 'festival' ? `파프리카 ${total}개! 축제 대성공 — 모두의 승리입니다.`
    : outcome === 'farmer' ? `파프리카 ${total}개로 축제는 망했지만, ${leaders[0].name}이(가) ${top}개로 올해의 농부가 되었습니다.`
      : outcome === 'famine' ? `파프리카 ${total}개, 1등이 ${leaders.map(p => p.name).join('·')} 동점. 대흉작 — 탐욕의 끝은 공멸입니다.`
        : `파프리카 ${total}개, 1등도 ${top}개뿐. 올해의 농부는 없습니다.`;
  pushLog(state, message);
  state.result = { message };
}

// --- 행동 ---

export function applyPaprikaAction(input: PaprikaGameState, playerId: string, action: PaprikaAction): PaprikaGameState {
  const state = clone(input);
  state.step += 1;
  const player = playerOf(state, playerId);

  if (action.type === 'place') {
    if (state.phase !== 'planting') throw new Error('지금은 파종 단계가 아닙니다.');
    if (state.players[state.turnIndex].id !== playerId) throw new Error('내 차례가 아닙니다.');
    if (action.kind !== 'seed' && action.kind !== 'thief') throw new Error('씨앗 또는 도둑을 고르세요.');
    if (typeof action.cell !== 'string' || !state.cells.some(c => c.id === action.cell)) throw new Error('농장에 없는 칸입니다.');
    if (tokenAt(state, action.cell)) throw new Error('이미 토큰이 놓인 칸입니다.');
    if (!legalCells(state, playerId).includes(action.cell)) throw new Error('거리두기 규칙: 내 토큰 바로 옆에는 내 토큰을 놓을 수 없습니다.');
    state.board.push({ cell: action.cell, ownerId: playerId, kind: action.kind, order: state.board.length + 1 });
    player.placed += 1;
    state.lastPlaced = { cell: action.cell, ownerId: playerId };
    pushLog(state, `${player.name}이(가) 토큰을 뒷면으로 놓았습니다. (${player.placed}/${state.tokensPerPlayer})`);
    if (placementsDone(state) || !advanceTurn(state)) {
      finishRound(state);
    } else {
      const next = state.players[state.turnIndex];
      state.result = { message: `${next.name}의 차례입니다. (${next.placed + 1}/${state.tokensPerPlayer}번째 토큰)` };
    }
    return state;
  }

  if (action.type === 'next_round') {
    if (state.phase !== 'harvest') throw new Error('지금은 다음 라운드로 넘어갈 수 없습니다.');
    state.round += 1;
    state.board = [];
    state.lastPlaced = undefined;
    for (const p of state.players) { p.placed = 0; p.skipped = false; }
    state.roundStartIndex = (state.roundStartIndex + 1) % state.players.length;
    state.turnIndex = state.roundStartIndex;
    state.phase = 'planting';
    const first = state.players[state.turnIndex];
    pushLog(state, `${state.round}라운드 파종 시작 — 토큰을 모두 회수했습니다. ${first.name}부터 심습니다.`);
    state.result = { message: `${state.round}라운드입니다. ${first.name}부터 토큰을 놓으세요.` };
    return state;
  }

  throw new Error('알 수 없는 행동입니다.');
}

// --- 플레이어 시점 ---

export function getPaprikaPlayerView(state: PaprikaGameState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const revealed = state.phase !== 'planting';
  const myTurn = !!me && state.phase === 'planting' && state.players[state.turnIndex].id === me.id;
  const lastHarvest = state.harvests[state.harvests.length - 1];
  const fateByCell = revealed && lastHarvest && lastHarvest.round === state.round ? new Map(lastHarvest.fates.map(f => [f.cell, f])) : null;
  return {
    phase: state.phase,
    round: state.round,
    rounds: ROUNDS,
    radius: state.radius,
    tokensPerPlayer: state.tokensPerPlayer,
    festivalGoal: FESTIVAL_GOAL,
    currentPlayerId: state.phase === 'planting' ? state.players[state.turnIndex].id : null,
    cells: state.cells,
    board: state.board.map(t => {
      const fate = fateByCell?.get(t.cell);
      const visible = revealed || t.ownerId === playerId;
      return {
        cell: t.cell, ownerId: t.ownerId, order: t.order,
        kind: visible ? t.kind : null,
        removed: fate?.removed ?? false,
        loot: fate?.loot ?? null,
        stolenBy: fate?.stolenBy ?? null,
        harvested: fate?.harvested ?? false,
      };
    }),
    legalCells: myTurn && me ? legalCells(state, me.id) : [],
    lastPlaced: state.lastPlaced ?? null,
    harvests: state.harvests,
    total: state.players.reduce((sum, p) => sum + p.paprika, 0),
    outcome: state.outcome ?? null,
    standings: state.standings ?? null,
    log: state.log,
    result: state.result ?? null,
    myId: me?.id ?? null,
    players: state.players.map(p => ({
      id: p.id, name: p.name, paprika: p.paprika, placed: p.placed, skipped: p.skipped,
      roundGains: p.roundGains, isMe: p.id === playerId,
      seeds: revealed || p.id === playerId ? state.board.filter(t => t.ownerId === p.id && t.kind === 'seed').length : null,
      thieves: revealed || p.id === playerId ? state.board.filter(t => t.ownerId === p.id && t.kind === 'thief').length : null,
    })),
  };
}
