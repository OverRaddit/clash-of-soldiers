// 월드 배팅 컵: 서버의 getWbcPlayerView 가 돌려주는 플레이어 시점 상태

export type WbcTier = 'seed' | 'strong' | 'weak';
export type WbcCardValue = number | 'draw';
export type WbcRound = 'quarter' | 'semi' | 'final';
export type WbcPhase = 'prebet' | 'info' | 'betting' | 'settled' | 'finished';

export interface WbcCountry { id: string; name: string; tier: WbcTier; bonus: number }
export interface WbcScoreCard { id: string; value: WbcCardValue }
export interface WbcPeekNote { match: number; slot: number; value: WbcCardValue; step: number }

export interface WbcPlayerSummary {
  id: string;
  name: string;
  tokens: number;
  fixTokens: number;
  winTokens: number;
  prebet: string | null;
  isMe: boolean;
}

export interface WbcBetView {
  playerId: string;
  die: boolean;
  countryId: string | null;
  units: number;
  revealed: boolean;
  normal?: number;
  fix?: number;
  win?: number;
}

export interface WbcRevealedBet {
  playerId: string;
  die: boolean;
  countryId?: string;
  normal: number;
  fix: number;
  win: number;
  units: number;
  forfeited: boolean;
  effectiveLoserId?: string;
  won?: boolean;
}

export interface WbcTeamDetail { countryId: string; shots: WbcCardValue; saves: WbcCardValue; bonus: number; fix: number; goals: number }
export interface WbcShootoutRound { home: WbcCardValue; away: WbcCardValue; homeScore: number | null; awayScore: number | null; reshuffled: boolean }

export interface WbcMatchResult {
  matchIndex: number;
  round: WbcRound;
  homeId: string;
  awayId: string;
  scoreCards: { home: WbcScoreCard[]; away: WbcScoreCard[] };
  home: WbcTeamDetail;
  away: WbcTeamDetail;
  forcedDraw: boolean;
  shootout: WbcShootoutRound[];
  winnerId: string;
  loserId: string;
  bets: WbcRevealedBet[];
  pot: number;
  winners: string[];
  payoutEach: number;
  bonuses: { playerId: string; amount: number; reason: string }[];
  upset: boolean;
  soloWin: boolean;
}

export interface WbcHistoryEntry {
  matchIndex: number;
  round: WbcRound;
  homeId: string;
  awayId: string;
  homeGoals: number;
  awayGoals: number;
  forcedDraw: boolean;
  shootoutRounds: number;
  winnerId: string;
  winners: string[];
  payoutEach: number;
  pot: number;
}

export interface WbcStanding {
  playerId: string;
  name: string;
  tokens: number;
  prebet?: string;
  prebetResult: string;
  prebetReward: number;
  rank: number;
}

export interface WbcMatchView {
  index: number;
  round: WbcRound;
  homeId: string;
  awayId: string;
  openCards: WbcScoreCard[];
  deckCount: number;
  betCap: number;
  maxUnits: number;
  actionOrder: string[];
  actionIndex: number;
  currentActor: string | null;
  actionLog: { playerId: string; type: 'peek' | 'fix'; slots: number[]; step: number }[];
  pendingFix: { playerId: string; slot: number; options: WbcScoreCard[] | null } | null;
  betOrder: string[];
  betIndex: number;
  currentBettor: string | null;
  bets: WbcBetView[];
  hiddenSlots: { slot: number; name: string; value: WbcCardValue | null }[];
  result: WbcMatchResult | null;
}

export interface WbcClientState {
  phase: WbcPhase;
  countries: WbcCountry[];
  bracket: { quarter: string[]; semi: (string | null)[]; final: (string | null)[]; champion: string | null };
  matchIndex: number;
  bank: number;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  standings: WbcStanding[] | null;
  history: WbcHistoryEntry[];
  myId: string | null;
  me: {
    tokens: number;
    fixTokens: number;
    winTokens: number;
    prebet: string | null;
    notes: WbcPeekNote[];
    betConstraints: { required: number; cap: number; allInAllowed: boolean; canRaise?: boolean } | null;
  } | null;
  players: WbcPlayerSummary[];
  match: WbcMatchView | null;
}

export type WbcAction =
  | { type: 'prebet'; countryId: string }
  | { type: 'peek'; slots: number[] }
  | { type: 'fix_start'; slot: number }
  | { type: 'fix_keep'; index: number }
  | { type: 'bet'; countryId: string; normal: number; fix: number; win: number }
  | { type: 'die' }
  | { type: 'next_match' };
