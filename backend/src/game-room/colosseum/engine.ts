// 모래 위의 밀약 엔진. 규칙은 docs/colosseum-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export type Grade = 'champion' | 'veteran' | 'rookie';
export type CardValue = number | 'whim';
export type RoundName = 'first' | 'semi' | 'final';
export type Side = 'red' | 'blue';
export type ColosseumPhase = 'missions' | 'eve' | 'betting' | 'dawn' | 'settled' | 'finished';
export type MissionId =
  | 'champion_owner' | 'rookie_scout' | 'chaos' | 'old_guard'
  | 'lone_prophet' | 'crowd_voice' | 'secret_pact' | 'rival' | 'shadow_patron'
  | 'showman' | 'landslide' | 'streak' | 'double_books';
export type MissionStatus = 'open' | 'done' | 'failed';

export interface Gladiator { id: string; type: string; nick: string; grade: Grade; bonus: number }
export interface BattleCard { id: string; value: CardValue }
export interface PeekNote { match: number; slot: number; value: CardValue; step: number }

export interface ColosseumPlayer {
  id: string;
  name: string;
  offered: MissionId[];   // 받은 밀명 (본인만)
  missions: MissionId[];  // 고른 밀명 (게임이 끝날 때 공개)
  laurels: number;        // 월계관 = 적중 횟수
  notes: PeekNote[];      // 염탐·바꿔치기로 본 카드 (본인만)
}

export interface FighterDetail { gladiatorId: string; sword: CardValue; shackle: CardValue; bonus: number; hits: number }
export interface DeciderRound { red: CardValue; blue: CardValue; redScore: number | null; blueScore: number | null; reshuffled: boolean }

/** 대회 기록지 한 줄. 전부 공개 정보다. */
export interface MatchRecord {
  matchIndex: number;
  round: RoundName;
  redId: string;
  blueId: string;
  red: FighterDetail;
  blue: FighterDetail;
  whim: boolean;               // 무장 칸에 [황제의 변덕]이 있었는가
  decider: DeciderRound[];     // 결착전 기록 (없으면 빈 배열)
  winnerSide: Side;
  winnerId: string;
  loserId: string;
  margin: number;              // 유효타 차. 결착전으로 끝나면 0
  underdogId: string | null;   // 등급이 낮은 쪽. 동급이면 null
  upset: boolean;              // 언더독이 이겼는가
  bets: Record<string, Side>;
  hitters: string[];
}

export interface ActionLogEntry { playerId: string; type: 'peek' | 'swap'; slots: number[]; step: number; lap: 1 | 2 }

export interface ColosseumMatch {
  index: number;
  round: RoundName;
  redId: string;
  blueId: string;
  hidden: BattleCard[];      // 0,1 붉은 문 무장 / 2,3 푸른 문 무장 / 4 붉은 문 결착 / 5 푸른 문 결착
  openCards: BattleCard[];
  deck: BattleCard[];        // 병기고
  usedDecider: BattleCard[];
  order: string[];           // 전야(시계 방향) + 새벽(역순)
  actionIndex: number;
  actionLog: ActionLogEntry[];
  pendingSwap?: { playerId: string; slot: number; options: BattleCard[] };
  bets: Record<string, Side>;
  result?: MatchRecord;
}

export interface MissionView {
  id: MissionId;
  name: string;
  text: string;
  points: number;
  status: MissionStatus;
  count: number | null;
  need: number | null;
}

export interface Standing {
  playerId: string;
  name: string;
  laurels: number;
  missions: MissionView[];
  missionPoints: number;
  total: number;
  rank: number;
}

export interface ColosseumState {
  phase: ColosseumPhase;
  players: ColosseumPlayer[];
  gladiators: Gladiator[];
  bracket: { first: string[]; semi: (string | null)[]; final: (string | null)[]; champion: string | null };
  matchIndex: number;
  match?: ColosseumMatch;
  history: MatchRecord[];
  step: number;
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  standings?: Standing[];
  seed: number;
}

export type ColosseumAction =
  | { type: 'choose_missions'; keep: MissionId[] }
  | { type: 'peek'; slots: number[] }
  | { type: 'swap_start'; slot: number }
  | { type: 'swap_keep'; index: number }
  | { type: 'bet'; side: Side }
  | { type: 'next_match' };

export const MIN_PLAYERS = 3;
export const MAX_PLAYERS = 6;
export const TOTAL_MATCHES = 7;
export const GRADE_BONUS: Record<Grade, number> = { champion: 2, veteran: 1, rookie: 0 };
export const GRADE_NAMES: Record<Grade, string> = { champion: '챔피언', veteran: '베테랑', rookie: '신참' };
export const ROUND_NAMES: Record<RoundName, string> = { first: '1회전', semi: '준결승', final: '결승' };
export const SIDE_NAMES: Record<Side, string> = { red: '붉은 문', blue: '푸른 문' };
export const SLOT_NAMES = ['붉은 문 무장 1', '붉은 문 무장 2', '푸른 문 무장 1', '푸른 문 무장 2', '붉은 문 결착', '푸른 문 결착'];

const gladiators = (grade: Grade, list: [string, string][]): Gladiator[] =>
  list.map(([type, nick], i) => ({ id: `${grade}-${i + 1}`, type, nick, grade, bonus: GRADE_BONUS[grade] }));

export const ALL_GLADIATORS: Gladiator[] = [
  ...gladiators('champion', [['무르밀로', '황소'], ['세쿠토르', '추격자'], ['레티아리우스', '거미'], ['트라익스', '칼바람'], ['크루펠라리우스', '철벽']]),
  ...gladiators('veteran', [['호플로마쿠스', '창끝'], ['디마카이루스', '쌍날'], ['프로보카토르', '도발꾼'], ['에퀴테스', '기수'], ['에세다리우스', '전차'], ['삼니움', '노병']]),
  ...gladiators('rookie', [['벨레스', '투창'], ['라퀘아리우스', '올가미'], ['사기타리우스', '활잡이'], ['안다바타', '눈먼 자'], ['스키소르', '가위']]),
];

// --- 밀명 ---

interface MissionDef {
  id: MissionId;
  name: string;
  points: (n: number) => number;
  need: (n: number) => number | null;
  text: (n: number, target: string) => string;
}

const byCount = (table: Record<number, number>) => (n: number) => table[n] ?? table[4];

export const MISSIONS: MissionDef[] = [
  { id: 'champion_owner', name: '챔피언의 주인', points: () => 5, need: () => null,
    text: () => '우승한 검투사의 모든 경기에서 그 검투사에게 걸었다.' },
  { id: 'rookie_scout', name: '신참 발굴', points: () => 3, need: () => 2,
    text: () => '내가 건 언더독(등급이 낮은 쪽)이 2번 이겼다.' },
  { id: 'chaos', name: '혼돈의 흥행사', points: () => 3, need: () => 3,
    text: () => '대회 전체에서 이변(언더독의 승리)이 3번 이상 나왔다.' },
  { id: 'old_guard', name: '명문 양성소의 대리인', points: () => 2, need: () => null,
    text: () => '대회 전체에서 이변(언더독의 승리)이 1번 이하였다.' },
  { id: 'lone_prophet', name: '고독한 예언자', points: byCount({ 3: 2, 4: 3, 5: 4, 6: 5 }), need: () => null,
    text: () => '나 혼자 건 문이 이긴 경기가 정확히 1번이다.' },
  { id: 'crowd_voice', name: '군중의 목소리', points: () => 3, need: byCount({ 3: 4, 4: 3, 5: 4, 6: 3 }),
    text: (n) => `과반이 건 문에 걸어 ${byCount({ 3: 4, 4: 3, 5: 4, 6: 3 })(n)}번 적중했다.` },
  { id: 'secret_pact', name: '밀약', points: byCount({ 3: 3, 4: 2, 5: 3, 6: 5 }), need: byCount({ 3: 3, 4: 2, 5: 2, 6: 2 }),
    text: (n) => `나를 포함해 정확히 2명만 건 문이 ${byCount({ 3: 3, 4: 2, 5: 2, 6: 2 })(n)}번 이겼다.` },
  { id: 'rival', name: '정적', points: () => 3, need: () => 3,
    text: (_n, target) => `왼쪽 큰손 ${target}와(과) 다른 문에 걸어 3번 적중했다.` },
  { id: 'shadow_patron', name: '그림자 후견인', points: () => 2, need: () => 3,
    text: (_n, target) => `오른쪽 큰손 ${target}와(과) 같은 문에 걸어 3번 적중했다.` },
  { id: 'showman', name: '명승부 연출가', points: () => 3, need: () => 2,
    text: () => '결착전까지 간 경기에서 2번 적중했다.' },
  { id: 'landslide', name: '압승 청부', points: () => 3, need: () => 2,
    text: () => '내가 건 검투사가 유효타 3 이상 차이로 2번 이겼다.' },
  { id: 'streak', name: '연전연승', points: () => 2, need: () => 3,
    text: () => '3경기 연속으로 적중했다.' },
  { id: 'double_books', name: '이중장부', points: () => 3, need: () => null,
    text: () => '대회가 끝났을 때 적중이 정확히 4번이다.' },
];

function missionDef(id: MissionId): MissionDef {
  const def = MISSIONS.find(m => m.id === id);
  if (!def) throw new Error('알 수 없는 밀명입니다.');
  return def;
}

// --- 공용 도구 ---

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

/** 전투 카드 25장: 0,1,6,7 각 2장 / 2,3,4,5 각 4장 / 황제의 변덕 1장 */
export function buildBattleDeck(): BattleCard[] {
  const deck: BattleCard[] = [];
  for (const value of [0, 1, 6, 7]) for (let i = 1; i <= 2; i++) deck.push({ id: `b${value}-${i}`, value });
  for (const value of [2, 3, 4, 5]) for (let i = 1; i <= 4; i++) deck.push({ id: `b${value}-${i}`, value });
  deck.push({ id: 'whim', value: 'whim' });
  return deck;
}

export function cardLabel(value: CardValue): string { return value === 'whim' ? '황제의 변덕' : String(value); }

/** 결착전에서는 6을 1로, 7을 2로 센다. 황제의 변덕은 비교할 수 없다. */
export function deciderValue(value: CardValue): number | null {
  if (value === 'whim') return null;
  return value > 5 ? value - 5 : value;
}

function pushLog(state: ColosseumState, message: string) {
  state.log.push(message);
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

function playerOf(state: ColosseumState, playerId: string): ColosseumPlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 큰손이 아닙니다.');
  return player;
}

export function gladiatorOf(state: ColosseumState, gladiatorId: string): Gladiator {
  const gladiator = state.gladiators.find(g => g.id === gladiatorId);
  if (!gladiator) throw new Error('대진에 없는 검투사입니다.');
  return gladiator;
}

function label(gladiator: Gladiator): string { return `${gladiator.type} '${gladiator.nick}'`; }

function rng(state: ColosseumState): () => number {
  // 상태마다 다른 시드를 써서 같은 게임 안에서도 예측할 수 없게 한다.
  return mulberry32(state.seed + state.step * 7919 + state.matchIndex * 104729);
}

// --- 초기화 ---

export function initializeColosseumGame(playerIds: string[], playerNames: string[], seed?: number): ColosseumState {
  const n = playerIds.length;
  if (n < MIN_PLAYERS || n > MAX_PLAYERS) {
    throw new Error(`모래 위의 밀약은 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(actualSeed);
  const champions = shuffle(ALL_GLADIATORS.filter(g => g.grade === 'champion'), random).slice(0, 4);
  const veterans = shuffle(ALL_GLADIATORS.filter(g => g.grade === 'veteran'), random).slice(0, 3);
  const rookies = shuffle(ALL_GLADIATORS.filter(g => g.grade === 'rookie'), random).slice(0, 1);
  const others = shuffle([...veterans, ...rookies], random);
  // 챔피언은 1·3·5·7번 칸에 놓아 1회전이 모두 챔피언 대 비챔피언이 되게 한다.
  const first: string[] = [];
  for (let i = 0; i < 4; i++) first.push(champions[i].id, others[i].id);

  // 3~4인은 3장을 받아 2장을 고르고, 5~6인은 2장을 받아 그대로 쓴다.
  const perPlayer = n <= 4 ? 3 : 2;
  const missionDeck = shuffle(MISSIONS.map(m => m.id), random);
  const state: ColosseumState = {
    phase: 'missions',
    players: playerIds.map((id, i) => {
      const offered = missionDeck.slice(i * perPlayer, (i + 1) * perPlayer);
      return { id, name: playerNames[i] ?? `큰손 ${i + 1}`, offered, missions: perPlayer === 2 ? offered.slice() : [], laurels: 0, notes: [] };
    }),
    gladiators: first.map(id => ALL_GLADIATORS.find(g => g.id === id)!),
    bracket: { first, semi: [null, null, null, null], final: [null, null], champion: null },
    matchIndex: 0,
    history: [],
    step: 0,
    log: [],
    seed: actualSeed,
  };
  pushLog(state, `대진이 짜였습니다: ${first.map(id => label(gladiatorOf(state, id))).join(', ')}`);
  if (perPlayer === 2) {
    pushLog(state, '큰손마다 밀명 2장을 받았습니다.');
    startMatch(state, 0);
    state.result = { message: '밀명 2장을 받았습니다. 첫 경기를 시작합니다.' };
  } else {
    pushLog(state, '큰손마다 밀명 3장을 받았습니다. 2장을 고르세요.');
    state.result = { message: '밀명 3장 중 2장을 고르세요.' };
  }
  return state;
}

function matchPairing(state: ColosseumState, index: number): { round: RoundName; redId: string; blueId: string } {
  const b = state.bracket;
  if (index < 4) return { round: 'first', redId: b.first[index * 2], blueId: b.first[index * 2 + 1] };
  if (index < 6) {
    const i = (index - 4) * 2;
    if (!b.semi[i] || !b.semi[i + 1]) throw new Error('준결승 대진이 아직 정해지지 않았습니다.');
    return { round: 'semi', redId: b.semi[i]!, blueId: b.semi[i + 1]! };
  }
  if (!b.final[0] || !b.final[1]) throw new Error('결승 대진이 아직 정해지지 않았습니다.');
  return { round: 'final', redId: b.final[0], blueId: b.final[1] };
}

function startMatch(state: ColosseumState, index: number) {
  state.matchIndex = index;
  const random = rng(state);
  const { round, redId, blueId } = matchPairing(state, index);
  const deck = shuffle(buildBattleDeck(), random);
  const hidden = deck.splice(0, 6);
  const openCards = deck.splice(0, 5);
  const n = state.players.length;
  const start = index % n;
  const forward = Array.from({ length: n }, (_, i) => state.players[(start + i) % n].id);
  state.match = {
    index, round, redId, blueId, hidden, openCards, deck, usedDecider: [],
    order: [...forward, ...forward.slice().reverse()],
    actionIndex: 0,
    actionLog: [],
    bets: {},
  };
  state.phase = 'eve';
  const red = gladiatorOf(state, redId);
  const blue = gladiatorOf(state, blueId);
  pushLog(state, `${ROUND_NAMES[round]} ${index + 1}/${TOTAL_MATCHES}경기: 붉은 문 ${label(red)}(${GRADE_NAMES[red.grade]}) 대 푸른 문 ${label(blue)}(${GRADE_NAMES[blue.grade]}). 공개 카드 ${openCards.map(c => cardLabel(c.value)).join(', ')}.`);
  pushLog(state, `전야: ${playerOf(state, forward[0]).name}부터 염탐하거나 바꿔치기합니다.`);
}

// --- 전야·새벽 행동 ---

function currentActor(match: ColosseumMatch): string | undefined {
  return match.order[match.actionIndex];
}

function advanceAction(state: ColosseumState) {
  const match = state.match!;
  match.actionIndex += 1;
  const n = state.players.length;
  if (match.actionIndex === n) {
    const revealed = match.deck.splice(0, 2);
    match.openCards.push(...revealed);
    state.phase = 'betting';
    pushLog(state, `병기고에서 ${revealed.map(c => cardLabel(c.value)).join(', ')} 두 장이 추가로 공개되었습니다. 모두 이길 것 같은 문에 내기 패를 엎어 놓으세요.`);
  } else if (match.actionIndex >= match.order.length) {
    settleMatch(state);
  }
}

function requireTurn(state: ColosseumState, player: ColosseumPlayer): ColosseumMatch {
  const match = state.match;
  if ((state.phase !== 'eve' && state.phase !== 'dawn') || !match) throw new Error('지금은 염탐하거나 바꿔치기할 수 없습니다.');
  if (match.pendingSwap) throw new Error(match.pendingSwap.playerId === player.id ? '먼저 칸에 남길 카드를 고르세요.' : '다른 큰손이 바꿔치기하는 중입니다.');
  if (currentActor(match) !== player.id) throw new Error('아직 당신 차례가 아닙니다.');
  return match;
}

// --- 결투 ---

function fighterDetail(gladiator: Gladiator, cards: BattleCard[]): FighterDetail {
  const values = cards.map(c => c.value as number);
  const sword = Math.max(...values);
  const shackle = Math.min(...values);
  return { gladiatorId: gladiator.id, sword, shackle, bonus: gladiator.bonus, hits: sword - shackle + gladiator.bonus };
}

function runDecider(state: ColosseumState, match: ColosseumMatch): { rounds: DeciderRound[]; redWins: boolean } {
  const random = rng(state);
  const rounds: DeciderRound[] = [];
  let red = match.hidden[4];
  let blue = match.hidden[5];
  let reshuffled = false;
  for (let i = 0; i < 100; i++) {
    const redScore = deciderValue(red.value);
    const blueScore = deciderValue(blue.value);
    rounds.push({ red: red.value, blue: blue.value, redScore, blueScore, reshuffled });
    match.usedDecider.push(red, blue);
    if (redScore !== null && blueScore !== null && redScore !== blueScore) {
      return { rounds, redWins: redScore > blueScore };
    }
    reshuffled = false;
    if (match.deck.length < 2) {
      match.deck = shuffle([...match.deck, ...match.usedDecider], random);
      match.usedDecider = [];
      reshuffled = true;
    }
    red = match.deck.shift()!;
    blue = match.deck.shift()!;
  }
  return { rounds, redWins: random() < 0.5 };
}

function settleMatch(state: ColosseumState) {
  const match = state.match!;
  const redGladiator = gladiatorOf(state, match.redId);
  const blueGladiator = gladiatorOf(state, match.blueId);

  // 1. 내기 공개
  for (const player of state.players) {
    pushLog(state, `${player.name}의 내기: ${SIDE_NAMES[match.bets[player.id]]}.`);
  }

  // 2. 무장 공개
  const redCards = [match.hidden[0], match.hidden[1]];
  const blueCards = [match.hidden[2], match.hidden[3]];
  const whim = [...redCards, ...blueCards].some(c => c.value === 'whim');
  let red: FighterDetail;
  let blue: FighterDetail;
  if (whim) {
    red = { gladiatorId: match.redId, sword: redCards[0].value, shackle: redCards[1].value, bonus: redGladiator.bonus, hits: 0 };
    blue = { gladiatorId: match.blueId, sword: blueCards[0].value, shackle: blueCards[1].value, bonus: blueGladiator.bonus, hits: 0 };
    pushLog(state, '무장 칸에 [황제의 변덕]이 있어 유효타를 따지지 않고 결착전으로 넘어갑니다.');
  } else {
    red = fighterDetail(redGladiator, redCards);
    blue = fighterDetail(blueGladiator, blueCards);
    pushLog(state, `${label(redGladiator)} 유효타 ${red.hits} (검 ${red.sword} − 족쇄 ${red.shackle} + 등급 ${red.bonus}) : ` +
      `${label(blueGladiator)} 유효타 ${blue.hits} (검 ${blue.sword} − 족쇄 ${blue.shackle} + 등급 ${blue.bonus})`);
  }

  // 3. 결착전
  let redWins: boolean;
  let decider: DeciderRound[] = [];
  if (whim || red.hits === blue.hits) {
    const outcome = runDecider(state, match);
    decider = outcome.rounds;
    redWins = outcome.redWins;
    const last = decider[decider.length - 1];
    pushLog(state, `결착전 ${decider.length}합 끝에 붉은 문 ${last.redScore ?? '?'} : 푸른 문 ${last.blueScore ?? '?'}.`);
  } else {
    redWins = red.hits > blue.hits;
  }
  const winnerSide: Side = redWins ? 'red' : 'blue';
  const winner = redWins ? redGladiator : blueGladiator;
  const loser = redWins ? blueGladiator : redGladiator;
  const underdog = redGladiator.bonus === blueGladiator.bonus ? null : redGladiator.bonus < blueGladiator.bonus ? redGladiator : blueGladiator;
  const upset = !!underdog && underdog.id === winner.id;
  pushLog(state, `${label(winner)}이(가) 이겼습니다${upset ? ' — 이변!' : ''}.`);

  // 4. 월계관
  const hitters = state.players.filter(p => match.bets[p.id] === winnerSide).map(p => p.id);
  for (const id of hitters) playerOf(state, id).laurels += 1;
  pushLog(state, hitters.length ? `적중: ${hitters.map(id => playerOf(state, id).name).join(', ')} — 월계관 1개씩.` : '적중한 큰손이 없습니다.');

  // 5. 기록과 대진 갱신
  const b = state.bracket;
  if (match.round === 'first') b.semi[match.index] = winner.id;
  else if (match.round === 'semi') b.final[match.index - 4] = winner.id;
  else b.champion = winner.id;

  match.result = {
    matchIndex: match.index, round: match.round, redId: match.redId, blueId: match.blueId,
    red, blue, whim, decider, winnerSide, winnerId: winner.id, loserId: loser.id,
    margin: decider.length ? 0 : Math.abs(red.hits - blue.hits),
    underdogId: underdog ? underdog.id : null, upset,
    bets: { ...match.bets }, hitters,
  };
  state.history.push(match.result);
  state.phase = 'settled';
  state.result = { message: `${label(winner)} 승리. ${hitters.length ? `${hitters.map(id => playerOf(state, id).name).join(', ')} 적중!` : '적중자 없음.'}` };
  if (match.round === 'final') finishGame(state);
}

// --- 밀명 판정 ---

function neighbor(state: ColosseumState, playerId: string, offset: 1 | -1): ColosseumPlayer {
  const n = state.players.length;
  const i = state.players.findIndex(p => p.id === playerId);
  return state.players[(i + offset + n) % n];
}

/** 밀명의 대상 큰손 이름. 정적은 왼쪽(다음 자리), 그림자 후견인은 오른쪽(앞 자리)이다. */
function missionTarget(state: ColosseumState, playerId: string, id: MissionId): string {
  if (id === 'rival') return neighbor(state, playerId, 1).name;
  if (id === 'shadow_patron') return neighbor(state, playerId, -1).name;
  return '';
}

/** 현재까지의 기록으로 밀명 상태를 판정한다. 결승이 끝나면 open 은 남지 않는다. */
export function missionStatus(state: ColosseumState, playerId: string, id: MissionId): { status: MissionStatus; count: number | null; need: number | null } {
  const n = state.players.length;
  const history = state.history;
  const over = history.length >= TOTAL_MATCHES;
  const remaining = TOTAL_MATCHES - history.length;
  const need = missionDef(id).need(n);
  const hit = (r: MatchRecord) => r.bets[playerId] === r.winnerSide;
  const sameSide = (r: MatchRecord) => Object.values(r.bets).filter(side => side === r.bets[playerId]).length;
  const tally = (predicate: (r: MatchRecord) => boolean) => history.filter(predicate).length;

  // 횟수를 채우면 달성, 남은 경기를 다 써도 못 채우면 실패
  const atLeast = (count: number, target: number) => ({
    status: (count >= target ? 'done' : over || count + remaining < target ? 'failed' : 'open') as MissionStatus, count, need: target,
  });
  // 결승이 끝나야 확정되는 밀명
  const atEnd = (ok: boolean, deadAlready: boolean, count: number | null) => ({
    status: (deadAlready ? 'failed' : over ? (ok ? 'done' : 'failed') : 'open') as MissionStatus, count, need,
  });

  switch (id) {
    case 'champion_owner': {
      const backed = (gladiatorId: string) => history.every(r =>
        (r.redId !== gladiatorId && r.blueId !== gladiatorId) || r.bets[playerId] === (r.redId === gladiatorId ? 'red' : 'blue'));
      const eliminated = new Set(history.map(r => r.loserId));
      const alive = state.gladiators.filter(g => !eliminated.has(g.id));
      const champion = state.bracket.champion;
      return atEnd(!!champion && backed(champion), !alive.some(g => backed(g.id)), null);
    }
    case 'rookie_scout': return atLeast(tally(r => r.upset && hit(r)), need!);
    case 'chaos': return atLeast(tally(r => r.upset), need!);
    case 'old_guard': {
      const upsets = tally(r => r.upset);
      return atEnd(upsets <= 1, upsets >= 2, upsets);
    }
    case 'lone_prophet': {
      const solo = tally(r => hit(r) && sameSide(r) === 1);
      return atEnd(solo === 1, solo >= 2, solo);
    }
    case 'crowd_voice': return atLeast(tally(r => hit(r) && sameSide(r) * 2 > n), need!);
    case 'secret_pact': return atLeast(tally(r => hit(r) && sameSide(r) === 2), need!);
    case 'rival': {
      const target = neighbor(state, playerId, 1).id;
      return atLeast(tally(r => hit(r) && r.bets[target] !== r.bets[playerId]), need!);
    }
    case 'shadow_patron': {
      const target = neighbor(state, playerId, -1).id;
      return atLeast(tally(r => hit(r) && r.bets[target] === r.bets[playerId]), need!);
    }
    case 'showman': return atLeast(tally(r => hit(r) && r.decider.length > 0), need!);
    case 'landslide': return atLeast(tally(r => hit(r) && r.margin >= 3), need!);
    case 'streak': {
      let best = 0;
      let run = 0;
      for (const r of history) { run = hit(r) ? run + 1 : 0; best = Math.max(best, run); }
      if (best >= need!) return { status: 'done', count: best, need };
      return { status: over || run + remaining < need! ? 'failed' : 'open', count: run, need };
    }
    case 'double_books': {
      const hits = tally(hit);
      return atEnd(hits === 4, hits > 4 || hits + remaining < 4, hits);
    }
    default: throw new Error('알 수 없는 밀명입니다.');
  }
}

export function missionView(state: ColosseumState, playerId: string, id: MissionId): MissionView {
  const def = missionDef(id);
  const n = state.players.length;
  return { id, name: def.name, text: def.text(n, missionTarget(state, playerId, id)), points: def.points(n), ...missionStatus(state, playerId, id) };
}

function finishGame(state: ColosseumState) {
  const finalRecord = state.history[state.history.length - 1];
  const standings: (Standing & { done: number; finalHit: number })[] = state.players.map(player => {
    const missions = player.missions.map(id => missionView(state, player.id, id));
    const achieved = missions.filter(m => m.status === 'done');
    const missionPoints = achieved.reduce((sum, m) => sum + m.points, 0);
    return {
      playerId: player.id, name: player.name, laurels: player.laurels, missions, missionPoints,
      total: player.laurels + missionPoints, rank: 0,
      done: achieved.length, finalHit: finalRecord.hitters.includes(player.id) ? 1 : 0,
    };
  });
  // 동점이면 달성한 밀명 수, 그다음 결승 적중 여부로 가린다.
  const compare = (a: typeof standings[number], b: typeof standings[number]) =>
    b.total - a.total || b.done - a.done || b.finalHit - a.finalHit;
  standings.sort(compare);
  standings.forEach((s, i) => { s.rank = i > 0 && compare(standings[i - 1], s) === 0 ? standings[i - 1].rank : i + 1; });
  state.standings = standings.map(({ done, finalHit, ...rest }) => rest);
  state.phase = 'finished';
  const top = standings.filter(s => s.rank === 1);
  pushLog(state, `${label(gladiatorOf(state, state.bracket.champion!))} 우승. 대회의 진짜 승자: ${top.map(s => s.name).join(', ')} (${top[0].total}점).`);
}

// --- 행동 적용 ---

export function applyColosseumAction(input: ColosseumState, playerId: string, action: ColosseumAction): ColosseumState {
  const state = clone(input);
  state.result = undefined;
  if (!action || typeof action !== 'object') throw new Error('올바른 행동을 선택해주세요.');
  if (state.phase === 'finished') throw new Error('게임이 이미 끝났습니다.');
  const player = playerOf(state, playerId);
  state.step += 1;

  switch (action.type) {
    case 'choose_missions': {
      if (state.phase !== 'missions') throw new Error('지금은 밀명을 고르는 단계가 아닙니다.');
      if (player.missions.length) throw new Error('이미 밀명을 골랐습니다.');
      const keep = Array.isArray(action.keep) ? action.keep : [];
      if (keep.length !== 2 || keep[0] === keep[1] || keep.some(id => !player.offered.includes(id))) {
        throw new Error('받은 밀명 중 서로 다른 2장을 고르세요.');
      }
      player.missions = player.offered.filter(id => keep.includes(id));
      pushLog(state, `${player.name}이(가) 밀명을 골랐습니다.`);
      state.result = { message: `${player.name}이(가) 밀명을 골랐습니다.` };
      if (state.players.every(p => p.missions.length === 2)) {
        startMatch(state, 0);
        state.result = { message: '모두 밀명을 골랐습니다. 첫 경기를 시작합니다.' };
      }
      return state;
    }
    case 'peek': {
      const match = requireTurn(state, player);
      const slots = Array.isArray(action.slots) ? action.slots : [];
      if (slots.length !== 2 || slots.some(s => !Number.isInteger(s) || s < 0 || s > 5) || slots[0] === slots[1]) {
        throw new Error('비공개 카드 6장 중 서로 다른 2장을 고르세요.');
      }
      for (const slot of slots) player.notes.push({ match: match.index, slot, value: match.hidden[slot].value, step: state.step });
      match.actionLog.push({ playerId, type: 'peek', slots: slots.slice().sort(), step: state.step, lap: state.phase === 'eve' ? 1 : 2 });
      // 결과 메시지는 모두에게 전송되므로 카드 값은 본인의 메모에서만 보여 준다.
      const message = `${player.name}이(가) ${slots.slice().sort().map(s => SLOT_NAMES[s]).join(', ')} 칸을 염탐했습니다.`;
      pushLog(state, message);
      state.result = { message };
      advanceAction(state);
      return state;
    }
    case 'swap_start': {
      const match = requireTurn(state, player);
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot > 5) throw new Error('비공개 카드 6장 중 1장을 고르세요.');
      const drawn = match.deck.splice(0, 2);
      match.pendingSwap = { playerId, slot: action.slot, options: [match.hidden[action.slot], ...drawn] };
      match.actionLog.push({ playerId, type: 'swap', slots: [action.slot], step: state.step, lap: state.phase === 'eve' ? 1 : 2 });
      pushLog(state, `${player.name}이(가) ${SLOT_NAMES[action.slot]} 칸의 카드를 집어 들었습니다.`);
      state.result = { message: `${player.name}이(가) ${SLOT_NAMES[action.slot]} 칸에서 바꿔치기를 시도합니다.` };
      return state;
    }
    case 'swap_keep': {
      const match = state.match;
      if ((state.phase !== 'eve' && state.phase !== 'dawn') || !match?.pendingSwap || match.pendingSwap.playerId !== playerId) {
        throw new Error('바꿔치기하는 중이 아닙니다.');
      }
      const { slot, options } = match.pendingSwap;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= options.length) throw new Error('세 장 중 하나를 고르세요.');
      const keep = options[action.index];
      match.hidden[slot] = keep;
      match.deck.push(...options.filter((_, i) => i !== action.index));
      match.pendingSwap = undefined;
      player.notes.push({ match: match.index, slot, value: keep.value, step: state.step });
      const message = `${player.name}이(가) ${SLOT_NAMES[slot]} 칸에 카드를 내려놓았습니다. 실제로 바꿨는지는 본인만 압니다.`;
      pushLog(state, message);
      state.result = { message };
      advanceAction(state);
      return state;
    }
    case 'bet': {
      const match = state.match;
      if (state.phase !== 'betting' || !match) throw new Error('지금은 내기 단계가 아닙니다.');
      if (match.bets[playerId]) throw new Error('이미 내기 패를 엎어 놓았습니다. 바꿀 수 없습니다.');
      if (action.side !== 'red' && action.side !== 'blue') throw new Error('붉은 문과 푸른 문 중 하나를 고르세요.');
      match.bets[playerId] = action.side;
      const message = `${player.name}이(가) 내기 패를 엎어 놓았습니다.`;
      pushLog(state, message);
      state.result = { message };
      if (state.players.every(p => match.bets[p.id])) {
        state.phase = 'dawn';
        const next = playerOf(state, currentActor(match)!);
        pushLog(state, `새벽: 모두 내기를 마쳤습니다. ${next.name}부터 역순으로 한 번 더 행동합니다.`);
        state.result = { message: `모두 내기를 마쳤습니다. ${next.name}부터 역순으로 행동합니다.` };
      }
      return state;
    }
    case 'next_match': {
      if (state.phase !== 'settled') throw new Error('경기 결과가 나온 뒤에 넘어갈 수 있습니다.');
      startMatch(state, state.matchIndex + 1);
      state.result = { message: `${ROUND_NAMES[state.match!.round]} 경기를 시작합니다.` };
      return state;
    }
    default:
      throw new Error('알 수 없는 행동입니다.');
  }
}

// --- 플레이어 시점 뷰 ---

export function getColosseumPlayerView(state: ColosseumState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const match = state.match;
  const settled = state.phase === 'settled' || state.phase === 'finished';
  const n = state.players.length;
  return {
    phase: state.phase,
    gladiators: state.gladiators,
    bracket: state.bracket,
    matchIndex: state.matchIndex,
    totalMatches: TOTAL_MATCHES,
    log: state.log,
    result: state.result ?? null,
    standings: state.standings ?? null,
    history: state.history,
    myId: me?.id ?? null,
    me: me ? {
      laurels: me.laurels,
      notes: me.notes.filter(note => note.match === state.matchIndex),
      // 고르기 전에는 받은 카드를, 고른 뒤에는 고른 카드의 진행 상황을 본인에게만 보여 준다.
      offered: me.missions.length ? null : me.offered.map(id => {
        const def = missionDef(id);
        return { id, name: def.name, text: def.text(n, missionTarget(state, me.id, id)), points: def.points(n) };
      }),
      missions: me.missions.map(id => missionView(state, me.id, id)),
      bet: match?.bets[me.id] ?? null,
    } : null,
    players: state.players.map(p => ({
      id: p.id, name: p.name, laurels: p.laurels, isMe: p.id === playerId,
      missionsChosen: p.missions.length === 2,
      hasBet: !!match?.bets[p.id],
    })),
    match: match ? {
      index: match.index,
      round: match.round,
      redId: match.redId,
      blueId: match.blueId,
      openCards: match.openCards,
      deckCount: match.deck.length,
      order: match.order,
      actionIndex: match.actionIndex,
      currentActor: state.phase === 'eve' || state.phase === 'dawn' ? currentActor(match) ?? null : null,
      actionLog: match.actionLog,
      pendingSwap: match.pendingSwap ? {
        playerId: match.pendingSwap.playerId, slot: match.pendingSwap.slot,
        options: match.pendingSwap.playerId === playerId ? match.pendingSwap.options : null,
      } : null,
      // 남의 내기는 결투가 끝날 때까지 보이지 않는다.
      bets: state.players.map(p => ({
        playerId: p.id, placed: !!match.bets[p.id],
        side: settled || p.id === playerId ? match.bets[p.id] ?? null : null,
      })),
      hiddenSlots: match.hidden.map((card, slot) => ({ slot, name: SLOT_NAMES[slot], value: settled ? card.value : null })),
      result: match.result ?? null,
    } : null,
  };
}
