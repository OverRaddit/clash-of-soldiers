// 월드 배팅 컵: 뒷세계의 승부조작단 엔진. 규칙과 해석은 docs/world-betting-cup-rulebook.md 를 따른다.
// 모든 함수는 순수 함수다. 잘못된 행동은 예외를 던지고 입력 상태를 바꾸지 않는다.

export type Tier = 'seed' | 'strong' | 'weak';
export type CardValue = number | 'draw';
export type RoundName = 'quarter' | 'semi' | 'final';
export type WbcPhase = 'prebet' | 'info' | 'betting' | 'settled' | 'finished';

export interface Country { id: string; name: string; tier: Tier; bonus: number }
export interface ScoreCard { id: string; value: CardValue }

export interface PeekNote { match: number; slot: number; value: CardValue; step: number }

export interface WbcPlayer {
  id: string;
  name: string;
  tokens: number;      // 일반(패배 배팅) 토큰 = 화폐
  fixTokens: number;   // 승부 조작 토큰 (경기마다 돌려받음)
  winTokens: number;   // 승리 배팅 토큰 (경기마다 돌려받음)
  prebet?: string;     // 우승팀 선배팅 국가
  notes: PeekNote[];   // 내부 정보 수집으로 본 카드 (본인만)
}

export interface Bet {
  playerId: string;
  die: boolean;
  countryId?: string;
  normal: number;
  fix: number;
  win: number;
}

export interface RevealedBet extends Bet {
  units: number;
  forfeited: boolean;
  effectiveLoserId?: string;  // 이 배팅이 "패배"에 건 국가
  won?: boolean;
}

export interface TeamDetail { countryId: string; shots: CardValue; saves: CardValue; bonus: number; fix: number; goals: number }
export interface ShootoutRound { home: CardValue; away: CardValue; homeScore: number | null; awayScore: number | null; reshuffled: boolean }

export interface MatchResult {
  matchIndex: number;
  round: RoundName;
  homeId: string;
  awayId: string;
  scoreCards: { home: ScoreCard[]; away: ScoreCard[] };
  home: TeamDetail;
  away: TeamDetail;
  forcedDraw: boolean;
  shootout: ShootoutRound[];
  winnerId: string;
  loserId: string;
  bets: RevealedBet[];
  pot: number;
  winners: string[];
  payoutEach: number;
  bonuses: { playerId: string; amount: number; reason: string }[];
  upset: boolean;
  soloWin: boolean;
}

export interface ActionLogEntry { playerId: string; type: 'peek' | 'fix'; slots: number[]; step: number }

export interface WbcMatch {
  index: number;
  round: RoundName;
  homeId: string;
  awayId: string;
  hidden: ScoreCard[];        // 0,1 홈 점수 / 2,3 원정 점수 / 4 홈 승부차기 / 5 원정 승부차기
  openCards: ScoreCard[];
  deck: ScoreCard[];
  usedShootout: ScoreCard[];
  actionOrder: string[];
  actionIndex: number;
  actionLog: ActionLogEntry[];
  pendingFix?: { playerId: string; slot: number; options: ScoreCard[] };
  betOrder: string[];
  betIndex: number;
  bets: Bet[];
  maxUnits: number;
  betCap: number;
  result?: MatchResult;
}

export interface Standing { playerId: string; name: string; tokens: number; prebet?: string; prebetResult: string; prebetReward: number; rank: number }

export interface WbcGameState {
  phase: WbcPhase;
  players: WbcPlayer[];
  countries: Country[];
  bracket: { quarter: string[]; semi: (string | null)[]; final: (string | null)[]; champion: string | null };
  matchIndex: number;
  match?: WbcMatch;
  history: MatchResult[];
  bank: number;
  step: number;
  log: string[];
  result?: { message: string; type?: 'info' | 'error' };
  standings?: Standing[];
  seed: number;
}

export type WbcAction =
  | { type: 'prebet'; countryId: string }
  | { type: 'peek'; slots: number[] }
  | { type: 'fix_start'; slot: number }
  | { type: 'fix_keep'; index: number }
  | { type: 'bet'; countryId: string; normal: number; fix: number; win: number }
  | { type: 'die' }
  | { type: 'next_match' };

export const START_TOKENS = 7;
export const START_FIX_TOKENS = 2;
export const START_WIN_TOKENS = 3;
export const START_BANK = 30;
export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 6;
export const TIER_BONUS: Record<Tier, number> = { seed: 2, strong: 1, weak: 0 };
export const TIER_NAMES: Record<Tier, string> = { seed: '시드', strong: '강팀', weak: '약팀' };
export const ROUND_NAMES: Record<RoundName, string> = { quarter: '8강', semi: '4강', final: '결승' };
export const PREBET_REWARDS = { champion: 5, runnerUp: 2, semi: 1, quarter: 0 };
export const SLOT_NAMES = ['홈 점수 1', '홈 점수 2', '원정 점수 1', '원정 점수 2', '홈 승부차기', '원정 승부차기'];

export const ALL_COUNTRIES: Country[] = [
  ...['브라질', '프랑스', '아르헨티나', '스페인', '독일'].map((name, i) => ({ id: `seed-${i + 1}`, name, tier: 'seed' as Tier, bonus: 2 })),
  ...['잉글랜드', '포르투갈', '네덜란드', '이탈리아', '벨기에', '크로아티아'].map((name, i) => ({ id: `strong-${i + 1}`, name, tier: 'strong' as Tier, bonus: 1 })),
  ...['대한민국', '일본', '미국', '모로코', '호주'].map((name, i) => ({ id: `weak-${i + 1}`, name, tier: 'weak' as Tier, bonus: 0 })),
];

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

/** 스코어 카드 25장: 0,1,6,7 각 2장 / 2,3,4,5 각 4장 / 무조건 무승부 1장 */
export function buildScoreDeck(): ScoreCard[] {
  const deck: ScoreCard[] = [];
  for (const value of [0, 1, 6, 7]) for (let i = 1; i <= 2; i++) deck.push({ id: `s${value}-${i}`, value });
  for (const value of [2, 3, 4, 5]) for (let i = 1; i <= 4; i++) deck.push({ id: `s${value}-${i}`, value });
  deck.push({ id: 'draw', value: 'draw' });
  return deck;
}

export function cardLabel(value: CardValue): string { return value === 'draw' ? '무승부' : String(value); }
export function shootoutValue(value: CardValue): number | null {
  if (value === 'draw') return null;
  return value > 5 ? value - 5 : value;
}

function pushLog(state: WbcGameState, message: string) {
  state.log.push(message);
  if (state.log.length > 60) state.log.splice(0, state.log.length - 60);
}

function playerOf(state: WbcGameState, playerId: string): WbcPlayer {
  const player = state.players.find(p => p.id === playerId);
  if (!player) throw new Error('이 게임에 참여한 플레이어가 아닙니다.');
  return player;
}

export function countryOf(state: WbcGameState, countryId: string): Country {
  const country = state.countries.find(c => c.id === countryId);
  if (!country) throw new Error('대진표에 없는 국가입니다.');
  return country;
}

function rng(state: WbcGameState): () => number {
  // 상태마다 다른 시드를 써서 같은 게임 안에서도 예측 불가능하게 한다.
  return mulberry32(state.seed + state.step * 7919 + state.matchIndex * 104729);
}

// --- 초기화 ---

export function initializeWbcGame(playerIds: string[], playerNames: string[], seed?: number): WbcGameState {
  if (playerIds.length < MIN_PLAYERS || playerIds.length > MAX_PLAYERS) {
    throw new Error(`월드 배팅 컵은 ${MIN_PLAYERS}~${MAX_PLAYERS}명이 필요합니다.`);
  }
  const actualSeed = seed ?? Math.floor(Math.random() * 2 ** 31);
  const random = mulberry32(actualSeed);
  const seeds = shuffle(ALL_COUNTRIES.filter(c => c.tier === 'seed'), random).slice(0, 4);
  const strong = shuffle(ALL_COUNTRIES.filter(c => c.tier === 'strong'), random).slice(0, 3);
  const weak = shuffle(ALL_COUNTRIES.filter(c => c.tier === 'weak'), random).slice(0, 1);
  const others = shuffle([...strong, ...weak], random);
  // 시드는 홀수 번째 칸(0,2,4,6)에, 나머지는 짝수 번째 칸(1,3,5,7)에 놓아 8강마다 시드 대 비시드가 되게 한다.
  const quarter: string[] = [];
  for (let i = 0; i < 4; i++) quarter.push(seeds[i].id, others[i].id);
  const countries = quarter.map(id => ALL_COUNTRIES.find(c => c.id === id)!);
  const state: WbcGameState = {
    phase: 'prebet',
    players: playerIds.map((id, i) => ({
      id, name: playerNames[i] ?? `승부사 ${i + 1}`,
      tokens: START_TOKENS, fixTokens: START_FIX_TOKENS, winTokens: START_WIN_TOKENS, notes: [],
    })),
    countries,
    bracket: { quarter, semi: [null, null, null, null], final: [null, null], champion: null },
    matchIndex: 0,
    history: [],
    bank: START_BANK,
    step: 0,
    log: [],
    seed: actualSeed,
  };
  pushLog(state, `8강 대진이 완성되었습니다: ${quarter.map(id => countryOf(state, id).name).join(', ')}`);
  pushLog(state, '모든 플레이어는 일반 토큰 1개로 우승팀을 선배팅하세요.');
  state.result = { message: '우승할 것 같은 국가에 선배팅 토큰 1개를 올려놓으세요.' };
  return state;
}

function matchPairing(state: WbcGameState, index: number): { round: RoundName; homeId: string; awayId: string } {
  const b = state.bracket;
  if (index < 4) return { round: 'quarter', homeId: b.quarter[index * 2], awayId: b.quarter[index * 2 + 1] };
  if (index < 6) {
    const i = (index - 4) * 2;
    if (!b.semi[i] || !b.semi[i + 1]) throw new Error('4강 대진이 아직 정해지지 않았습니다.');
    return { round: 'semi', homeId: b.semi[i]!, awayId: b.semi[i + 1]! };
  }
  if (!b.final[0] || !b.final[1]) throw new Error('결승 대진이 아직 정해지지 않았습니다.');
  return { round: 'final', homeId: b.final[0], awayId: b.final[1] };
}

function startMatch(state: WbcGameState, index: number) {
  const random = rng(state);
  const { round, homeId, awayId } = matchPairing(state, index);
  const deck = shuffle(buildScoreDeck(), random);
  const hidden = deck.splice(0, 6);
  const openCards = deck.splice(0, 5);
  const n = state.players.length;
  const start = index % n;
  const forward = Array.from({ length: n }, (_, i) => state.players[(start + i) % n].id);
  state.matchIndex = index;
  state.match = {
    index, round, homeId, awayId, hidden, openCards, deck, usedShootout: [],
    actionOrder: [...forward, ...forward.slice().reverse()],
    actionIndex: 0,
    actionLog: [],
    betOrder: forward,
    betIndex: 0,
    bets: [],
    maxUnits: 0,
    betCap: round === 'final' ? 4 : 3,
  };
  state.phase = 'info';
  const home = countryOf(state, homeId);
  const away = countryOf(state, awayId);
  pushLog(state, `${ROUND_NAMES[round]} ${index < 4 ? index + 1 : index < 6 ? index - 3 : ''}경기: ${home.name}(${TIER_NAMES[home.tier]}) 대 ${away.name}(${TIER_NAMES[away.tier]}). 공개 카드 ${openCards.map(c => cardLabel(c.value)).join(', ')}.`);
  pushLog(state, `${playerOf(state, forward[0]).name}부터 정보 탐색을 시작합니다.`);
}

// --- 정보 탐색 ---

function currentActor(match: WbcMatch): string | undefined {
  return match.actionOrder[match.actionIndex];
}

function advanceAction(state: WbcGameState) {
  const match = state.match!;
  match.actionIndex += 1;
  const n = state.players.length;
  if (match.actionIndex === n) {
    const revealed = match.deck.splice(0, 2);
    match.openCards.push(...revealed);
    pushLog(state, `카드 더미에서 ${revealed.map(c => cardLabel(c.value)).join(', ')} 두 장이 추가로 공개되었습니다. 이제 역순으로 한 번 더 행동합니다.`);
  }
  if (match.actionIndex >= match.actionOrder.length) {
    state.phase = 'betting';
    pushLog(state, `배팅 단계입니다. ${playerOf(state, match.betOrder[0]).name}부터 질 것 같은 국가에 배팅하거나 다이를 외치세요.`);
  }
}

// --- 배팅 ---

export interface BetConstraints {
  required: number;        // 최소 배팅 개수 = 앞사람 중 최고 배팅 (0이면 자유). 이 수 이상이면 레이즈가 된다.
  cap: number;             // 최대 배팅 개수 (8강·4강 3, 결승 4)
  allInAllowed: boolean;   // 일반 토큰이 required보다 적어 올인이 허용되는가
  canRaise: boolean;       // required보다 더 낼 여지가 있는가 (required < cap)
}

export function betConstraints(state: WbcGameState, player: WbcPlayer): BetConstraints {
  const match = state.match!;
  return {
    required: match.maxUnits,
    cap: match.betCap,
    allInAllowed: match.maxUnits > 0 && player.tokens < match.maxUnits,
    canRaise: match.maxUnits < match.betCap,
  };
}

function validateBet(state: WbcGameState, player: WbcPlayer, action: Extract<WbcAction, { type: 'bet' }>) {
  const match = state.match!;
  const { normal, fix, win } = action;
  for (const value of [normal, fix, win]) {
    if (!Number.isInteger(value) || value < 0) throw new Error('토큰 수는 0 이상의 정수여야 합니다.');
  }
  if (action.countryId !== match.homeId && action.countryId !== match.awayId) throw new Error('현재 경기 중인 국가에만 배팅할 수 있습니다.');
  const units = normal + fix + win;
  if (units < 1) throw new Error('최소 1개의 토큰을 배팅해야 합니다. 참여하지 않으려면 다이를 선택하세요.');
  if (units > match.betCap) throw new Error(`이 경기에는 최대 ${match.betCap}개까지 배팅할 수 있습니다.`);
  if (normal > player.tokens) throw new Error('가진 일반 토큰보다 많이 배팅할 수 없습니다.');
  if (fix > player.fixTokens) throw new Error('승부 조작 토큰이 부족합니다.');
  if (win > player.winTokens) throw new Error('승리 배팅 토큰이 부족합니다.');
  // 콜 또는 레이즈: 앞사람 중 최고 배팅 이상을 내야 한다. 일반 토큰이 모자라면 전부 걸어 올인(최고 배팅 이하)할 수 있다.
  const c = betConstraints(state, player);
  if (c.required > 0 && units < c.required) {
    const allIn = c.allInAllowed && normal === player.tokens;
    if (!allIn) throw new Error(`현재 최고 배팅 ${c.required}개 이상을 배팅해야 합니다. (더 내면 레이즈, 일반 토큰이 부족하면 전부 걸어 올인할 수 있습니다.)`);
  }
}

// --- 정산 ---

function teamDetail(countryId: string, bonus: number, cards: ScoreCard[], fix: number): TeamDetail {
  const values = cards.map(c => c.value as number);
  const shots = Math.max(...values);
  const saves = Math.min(...values);
  return { countryId, shots, saves, bonus, fix, goals: Math.max(0, shots + bonus - saves - fix) };
}

function runShootout(state: WbcGameState, match: WbcMatch): { rounds: ShootoutRound[]; homeWins: boolean } {
  const random = rng(state);
  const rounds: ShootoutRound[] = [];
  let home = match.hidden[4];
  let away = match.hidden[5];
  let reshuffled = false;
  for (let i = 0; i < 100; i++) {
    const homeScore = shootoutValue(home.value);
    const awayScore = shootoutValue(away.value);
    rounds.push({ home: home.value, away: away.value, homeScore, awayScore, reshuffled });
    if (homeScore !== null && awayScore !== null && homeScore !== awayScore) {
      match.usedShootout.push(home, away);
      return { rounds, homeWins: homeScore > awayScore };
    }
    match.usedShootout.push(home, away);
    reshuffled = false;
    if (match.deck.length < 2) {
      match.deck = shuffle([...match.deck, ...match.usedShootout], random);
      match.usedShootout = [];
      reshuffled = true;
    }
    home = match.deck.shift()!;
    away = match.deck.shift()!;
  }
  return { rounds, homeWins: random() < 0.5 };
}

function settleMatch(state: WbcGameState) {
  const match = state.match!;
  const homeCountry = countryOf(state, match.homeId);
  const awayCountry = countryOf(state, match.awayId);

  // 1. 토큰 공개와 몰수 판정
  const bets: RevealedBet[] = match.bets.filter(b => !b.die).map(b => {
    const forfeited = b.win > 0 && (b.normal > 0 || b.fix > 0);
    return { ...b, units: b.normal + b.fix + b.win, forfeited };
  });
  for (const bet of bets) {
    const player = playerOf(state, bet.playerId);
    if (bet.forfeited) {
      state.bank += bet.normal;
      pushLog(state, `${player.name}: 승리 배팅 토큰을 다른 토큰과 섞어 내어 토큰 ${bet.units}개를 모두 몰수당했습니다.`);
      continue;
    }
    bet.effectiveLoserId = bet.win > 0 ? (bet.countryId === match.homeId ? match.awayId : match.homeId) : bet.countryId;
    player.fixTokens += bet.fix;
    player.winTokens += bet.win;
    state.bank -= bet.fix + bet.win; // 특수 토큰은 은행의 일반 토큰 1개로 바꿔 판돈에 넣는다
    const parts = [bet.normal ? `일반 ${bet.normal}` : '', bet.fix ? `조작 ${bet.fix}` : '', bet.win ? `승리 ${bet.win}` : ''].filter(Boolean).join(', ');
    pushLog(state, `${player.name}: ${countryOf(state, bet.countryId!).name}에 ${parts}.`);
  }
  const valid = bets.filter(b => !b.forfeited);
  const fixOn = (countryId: string) => valid.filter(b => b.countryId === countryId).reduce((sum, b) => sum + b.fix, 0);

  // 2. 점수 공개
  const homeCards = [match.hidden[0], match.hidden[1]];
  const awayCards = [match.hidden[2], match.hidden[3]];
  const forcedDraw = [...homeCards, ...awayCards].some(c => c.value === 'draw');
  let home: TeamDetail;
  let away: TeamDetail;
  if (forcedDraw) {
    home = { countryId: match.homeId, shots: 'draw', saves: 'draw', bonus: homeCountry.bonus, fix: fixOn(match.homeId), goals: 0 };
    away = { countryId: match.awayId, shots: 'draw', saves: 'draw', bonus: awayCountry.bonus, fix: fixOn(match.awayId), goals: 0 };
    pushLog(state, '점수 칸에 [무조건 무승부] 카드가 있어 곧바로 승부차기로 넘어갑니다.');
  } else {
    home = teamDetail(match.homeId, homeCountry.bonus, homeCards, fixOn(match.homeId));
    away = teamDetail(match.awayId, awayCountry.bonus, awayCards, fixOn(match.awayId));
    pushLog(state, `${homeCountry.name} ${home.goals}골 (유효슈팅 ${home.shots} + 보너스 ${home.bonus} - 선방 ${home.saves} - 조작 ${home.fix}) : ` +
      `${awayCountry.name} ${away.goals}골 (유효슈팅 ${away.shots} + 보너스 ${away.bonus} - 선방 ${away.saves} - 조작 ${away.fix})`);
  }

  // 3. 승부차기
  let homeWins: boolean;
  let shootout: ShootoutRound[] = [];
  if (forcedDraw || home.goals === away.goals) {
    const result = runShootout(state, match);
    shootout = result.rounds;
    homeWins = result.homeWins;
    const last = shootout[shootout.length - 1];
    pushLog(state, `승부차기 ${shootout.length}차전 끝에 ${homeCountry.name} ${last.homeScore ?? '?'} : ${awayCountry.name} ${last.awayScore ?? '?'}.`);
  } else {
    homeWins = home.goals > away.goals;
  }
  const winnerId = homeWins ? match.homeId : match.awayId;
  const loserId = homeWins ? match.awayId : match.homeId;
  const winnerCountry = countryOf(state, winnerId);
  const loserCountry = countryOf(state, loserId);
  pushLog(state, `${winnerCountry.name}이(가) 승리해 다음 라운드로 진출합니다.`);

  // 4. 배당
  const pot = valid.reduce((sum, b) => sum + b.units, 0);
  for (const bet of valid) bet.won = bet.effectiveLoserId === loserId;
  const winners = valid.filter(b => b.won).map(b => b.playerId);
  const losers = valid.filter(b => !b.won).map(b => b.playerId);
  let payoutEach = 0;
  if (winners.length) {
    payoutEach = Math.ceil(pot / winners.length);
    state.bank -= payoutEach * winners.length - pot;
    for (const id of winners) playerOf(state, id).tokens += payoutEach;
    pushLog(state, `판돈 ${pot}개를 ${winners.map(id => playerOf(state, id).name).join(', ')}이(가) ${payoutEach}개씩 가져갑니다.`);
  } else if (pot > 0) {
    state.bank += pot;
    pushLog(state, `패배팀을 맞힌 사람이 없어 판돈 ${pot}개는 공용 더미로 갑니다.`);
  } else {
    pushLog(state, '아무도 배팅하지 않았습니다.');
  }

  // 5. 보너스
  const bonuses: MatchResult['bonuses'] = [];
  const roundBonus = match.round === 'semi' ? 1 : match.round === 'final' ? 2 : 0;
  const upset = winnerCountry.bonus < loserCountry.bonus;
  const soloWin = winners.length === 1 && losers.length >= 2;
  for (const id of winners) {
    if (roundBonus) bonuses.push({ playerId: id, amount: roundBonus, reason: `${ROUND_NAMES[match.round]} 보너스` });
    if (upset || soloWin) bonuses.push({ playerId: id, amount: 2, reason: upset && soloWin ? '역배 성공 (약팀 승리 + 단독 적중)' : upset ? '역배 성공 (약팀 승리)' : '역배 성공 (단독 적중)' });
  }
  for (const bonus of bonuses) {
    playerOf(state, bonus.playerId).tokens += bonus.amount;
    state.bank -= bonus.amount;
    pushLog(state, `${playerOf(state, bonus.playerId).name}: ${bonus.reason}으로 토큰 ${bonus.amount}개 추가.`);
  }

  // 6. 대진표 갱신
  const b = state.bracket;
  if (match.round === 'quarter') b.semi[match.index] = winnerId;
  else if (match.round === 'semi') b.final[match.index - 4] = winnerId;
  else b.champion = winnerId;

  match.result = {
    matchIndex: match.index, round: match.round, homeId: match.homeId, awayId: match.awayId,
    scoreCards: { home: homeCards, away: awayCards },
    home, away, forcedDraw, shootout, winnerId, loserId, bets, pot, winners, payoutEach, bonuses, upset, soloWin,
  };
  state.history.push(match.result);
  state.phase = 'settled';
  if (match.round === 'final') finishGame(state);
}

function finishGame(state: WbcGameState) {
  const b = state.bracket;
  const champion = b.champion!;
  const runnerUp = b.final.find(id => id !== champion)!;
  const semiLosers = b.semi.filter(id => id && id !== champion && id !== runnerUp) as string[];
  const standings: Standing[] = state.players.map(player => {
    let prebetResult = '8강 탈락';
    let prebetReward = PREBET_REWARDS.quarter;
    if (player.prebet === champion) { prebetResult = '최종 우승'; prebetReward = PREBET_REWARDS.champion; }
    else if (player.prebet === runnerUp) { prebetResult = '준우승'; prebetReward = PREBET_REWARDS.runnerUp; }
    else if (player.prebet && semiLosers.includes(player.prebet)) { prebetResult = '4강 진출'; prebetReward = PREBET_REWARDS.semi; }
    player.tokens += prebetReward;
    state.bank -= prebetReward;
    if (prebetReward) pushLog(state, `${player.name}: 선배팅한 ${countryOf(state, player.prebet!).name}의 ${prebetResult}으로 토큰 ${prebetReward}개 수령.`);
    return { playerId: player.id, name: player.name, tokens: player.tokens, prebet: player.prebet, prebetResult, prebetReward, rank: 0 };
  });
  standings.sort((a, b2) => b2.tokens - a.tokens);
  standings.forEach((s, i) => { s.rank = i > 0 && standings[i - 1].tokens === s.tokens ? standings[i - 1].rank : i + 1; });
  state.standings = standings;
  state.phase = 'finished';
  const top = standings.filter(s => s.rank === 1).map(s => s.name).join(', ');
  pushLog(state, `${countryOf(state, champion).name} 우승. 월드 배팅 컵 최고의 승부사: ${top} (토큰 ${standings[0].tokens}개).`);
}

// --- 행동 적용 ---

export function applyWbcAction(input: WbcGameState, playerId: string, action: WbcAction): WbcGameState {
  const state = clone(input);
  state.result = undefined;
  if (!action || typeof action !== 'object') throw new Error('올바른 행동을 선택해주세요.');
  if (state.phase === 'finished') throw new Error('게임이 이미 끝났습니다.');
  const player = playerOf(state, playerId);
  state.step += 1;

  switch (action.type) {
    case 'prebet': {
      if (state.phase !== 'prebet') throw new Error('지금은 선배팅 단계가 아닙니다.');
      if (player.prebet) throw new Error('이미 선배팅을 마쳤습니다.');
      const country = countryOf(state, action.countryId);
      player.prebet = country.id;
      player.tokens -= 1;
      pushLog(state, `${player.name}이(가) ${country.name}에 우승 선배팅을 했습니다.`);
      state.result = { message: `${country.name}에 선배팅했습니다.` };
      if (state.players.every(p => p.prebet)) startMatch(state, 0);
      return state;
    }
    case 'peek': {
      const match = requireInfoTurn(state, player);
      const slots = Array.isArray(action.slots) ? action.slots : [];
      if (slots.length !== 2 || slots.some(s => !Number.isInteger(s) || s < 0 || s > 5) || slots[0] === slots[1]) {
        throw new Error('비공개 카드 6장 중 서로 다른 2장을 고르세요.');
      }
      for (const slot of slots) player.notes.push({ match: match.index, slot, value: match.hidden[slot].value, step: state.step });
      match.actionLog.push({ playerId, type: 'peek', slots: slots.slice().sort(), step: state.step });
      pushLog(state, `${player.name}이(가) ${slots.map(s => SLOT_NAMES[s]).join(', ')} 카드를 몰래 확인했습니다.`);
      // 결과 메시지는 모두에게 전송되므로 카드 값은 본인의 메모에서만 보여준다.
      state.result = { message: `${player.name}이(가) ${slots.map(s => SLOT_NAMES[s]).join(', ')} 카드를 확인했습니다.` };
      advanceAction(state);
      return state;
    }
    case 'fix_start': {
      const match = requireInfoTurn(state, player);
      if (!Number.isInteger(action.slot) || action.slot < 0 || action.slot > 5) throw new Error('비공개 카드 6장 중 1장을 고르세요.');
      const drawn = match.deck.splice(0, 2);
      match.pendingFix = { playerId, slot: action.slot, options: [match.hidden[action.slot], ...drawn] };
      match.actionLog.push({ playerId, type: 'fix', slots: [action.slot], step: state.step });
      pushLog(state, `${player.name}이(가) ${SLOT_NAMES[action.slot]} 칸에 승부 조작을 시도합니다.`);
      state.result = { message: '세 장 중 칸에 남길 카드 한 장을 고르세요. 나머지는 더미 맨 아래로 갑니다.' };
      return state;
    }
    case 'fix_keep': {
      const match = state.match;
      if (state.phase !== 'info' || !match?.pendingFix || match.pendingFix.playerId !== playerId) throw new Error('승부 조작 중이 아닙니다.');
      const { slot, options } = match.pendingFix;
      if (!Number.isInteger(action.index) || action.index < 0 || action.index >= options.length) throw new Error('세 장 중 하나를 고르세요.');
      const keep = options[action.index];
      match.hidden[slot] = keep;
      match.deck.push(...options.filter((_, i) => i !== action.index));
      match.pendingFix = undefined;
      player.notes.push({ match: match.index, slot, value: keep.value, step: state.step });
      pushLog(state, `${player.name}이(가) ${SLOT_NAMES[slot]} 칸에 카드를 내려놓았습니다.`);
      state.result = { message: `${player.name}이(가) ${SLOT_NAMES[slot]} 칸에 카드를 내려놓았습니다. 교체 여부는 비밀입니다.` };
      advanceAction(state);
      return state;
    }
    case 'bet':
    case 'die': {
      const match = state.match;
      if (state.phase !== 'betting' || !match) throw new Error('지금은 배팅 단계가 아닙니다.');
      if (match.betOrder[match.betIndex] !== playerId) throw new Error('아직 당신의 배팅 차례가 아닙니다.');
      if (action.type === 'die') {
        match.bets.push({ playerId, die: true, normal: 0, fix: 0, win: 0 });
        pushLog(state, `${player.name}: 다이.`);
        state.result = { message: '이번 경기에 참여하지 않습니다.' };
      } else {
        validateBet(state, player, action);
        const units = action.normal + action.fix + action.win;
        player.tokens -= action.normal;
        player.fixTokens -= action.fix;
        player.winTokens -= action.win;
        match.bets.push({ playerId, die: false, countryId: action.countryId, normal: action.normal, fix: action.fix, win: action.win });
        const raised = match.maxUnits > 0 && units > match.maxUnits;
        const allIn = match.maxUnits > 0 && units < match.maxUnits;
        match.maxUnits = Math.max(match.maxUnits, units);
        const how = raised ? ` (레이즈 → 최고 배팅 ${units}개)` : allIn ? ' (올인)' : '';
        pushLog(state, `${player.name}이(가) ${countryOf(state, action.countryId).name}에 토큰 ${units}개를 뒷면으로 배팅했습니다.${how}`);
        state.result = { message: `${countryOf(state, action.countryId).name}에 ${units}개 배팅${raised ? ' — 레이즈!' : allIn ? ' — 올인' : ''}.` };
      }
      match.betIndex += 1;
      if (match.betIndex >= match.betOrder.length) {
        settleMatch(state);
        const r = match.result!;
        state.result = { message: `${countryOf(state, r.winnerId).name} 승리. ${r.winners.length ? `${r.winners.map(id => playerOf(state, id).name).join(', ')} 적중!` : '적중자 없음.'}` };
      }
      return state;
    }
    case 'next_match': {
      if (state.phase !== 'settled') throw new Error('경기 결과를 정산한 뒤에 넘어갈 수 있습니다.');
      startMatch(state, state.matchIndex + 1);
      state.result = { message: `${ROUND_NAMES[state.match!.round]} 경기를 시작합니다.` };
      return state;
    }
    default:
      throw new Error('알 수 없는 행동입니다.');
  }
}

function requireInfoTurn(state: WbcGameState, player: WbcPlayer): WbcMatch {
  const match = state.match;
  if (state.phase !== 'info' || !match) throw new Error('지금은 정보 탐색 단계가 아닙니다.');
  if (match.pendingFix) throw new Error(match.pendingFix.playerId === player.id ? '먼저 남길 카드를 고르세요.' : '다른 플레이어가 승부 조작 중입니다.');
  if (currentActor(match) !== player.id) throw new Error('아직 당신 차례가 아닙니다.');
  return match;
}

// --- 플레이어 시점 뷰 ---

export function getWbcPlayerView(state: WbcGameState, playerId?: string): Record<string, unknown> {
  const me = state.players.find(p => p.id === playerId);
  const match = state.match;
  const settled = state.phase === 'settled' || state.phase === 'finished';
  return {
    phase: state.phase,
    countries: state.countries,
    bracket: state.bracket,
    matchIndex: state.matchIndex,
    bank: state.bank,
    log: state.log,
    result: state.result ?? null,
    standings: state.standings ?? null,
    history: state.history.map(r => ({ matchIndex: r.matchIndex, round: r.round, homeId: r.homeId, awayId: r.awayId,
      homeGoals: r.home.goals, awayGoals: r.away.goals, forcedDraw: r.forcedDraw, shootoutRounds: r.shootout.length,
      winnerId: r.winnerId, winners: r.winners, payoutEach: r.payoutEach, pot: r.pot })),
    myId: me?.id ?? null,
    me: me ? { tokens: me.tokens, fixTokens: me.fixTokens, winTokens: me.winTokens, prebet: me.prebet ?? null,
      notes: me.notes.filter(n => n.match === state.matchIndex),
      betConstraints: match && state.phase === 'betting' ? betConstraints(state, me) : null } : null,
    players: state.players.map(p => ({
      id: p.id, name: p.name, tokens: p.tokens, fixTokens: p.fixTokens, winTokens: p.winTokens,
      prebet: p.prebet ?? null, isMe: p.id === playerId,
    })),
    match: match ? {
      index: match.index,
      round: match.round,
      homeId: match.homeId,
      awayId: match.awayId,
      openCards: match.openCards,
      deckCount: match.deck.length,
      betCap: match.betCap,
      maxUnits: match.maxUnits,
      actionOrder: match.actionOrder,
      actionIndex: match.actionIndex,
      currentActor: state.phase === 'info' ? currentActor(match) ?? null : null,
      actionLog: match.actionLog,
      pendingFix: match.pendingFix ? {
        playerId: match.pendingFix.playerId, slot: match.pendingFix.slot,
        options: match.pendingFix.playerId === playerId ? match.pendingFix.options : null,
      } : null,
      betOrder: match.betOrder,
      betIndex: match.betIndex,
      currentBettor: state.phase === 'betting' ? match.betOrder[match.betIndex] ?? null : null,
      bets: match.bets.map(b => settled || b.playerId === playerId
        ? { ...b, units: b.normal + b.fix + b.win, revealed: true }
        : { playerId: b.playerId, die: b.die, countryId: b.countryId ?? null, units: b.normal + b.fix + b.win, revealed: false }),
      hiddenSlots: match.hidden.map((card, slot) => ({ slot, name: SLOT_NAMES[slot], value: settled ? card.value : null })),
      result: match.result ?? null,
    } : null,
  };
}
