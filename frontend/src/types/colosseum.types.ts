// 모래 위의 밀약: 서버의 getColosseumPlayerView 가 돌려주는 플레이어 시점 상태

export type ColoGrade = 'champion' | 'veteran' | 'rookie';
export type ColoCardValue = number | 'whim';
export type ColoRound = 'first' | 'semi' | 'final';
export type ColoSide = 'red' | 'blue';
export type ColoPhase = 'missions' | 'eve' | 'betting' | 'dawn' | 'settled' | 'finished';
export type ColoMissionStatus = 'open' | 'done' | 'failed';

export interface ColoGladiator { id: string; type: string; nick: string; grade: ColoGrade; bonus: number }
export interface ColoCard { id: string; value: ColoCardValue }
export interface ColoPeekNote { match: number; slot: number; value: ColoCardValue; step: number }

export interface ColoMissionOffer { id: string; name: string; text: string; points: number }
export interface ColoMission extends ColoMissionOffer {
  status: ColoMissionStatus;
  count: number | null;
  need: number | null;
}

export interface ColoFighterDetail { gladiatorId: string; sword: ColoCardValue; shackle: ColoCardValue; bonus: number; hits: number }
export interface ColoDeciderRound { red: ColoCardValue; blue: ColoCardValue; redScore: number | null; blueScore: number | null; reshuffled: boolean }

export interface ColoMatchRecord {
  matchIndex: number;
  round: ColoRound;
  redId: string;
  blueId: string;
  red: ColoFighterDetail;
  blue: ColoFighterDetail;
  whim: boolean;
  decider: ColoDeciderRound[];
  winnerSide: ColoSide;
  winnerId: string;
  loserId: string;
  margin: number;
  underdogId: string | null;
  upset: boolean;
  bets: Record<string, ColoSide>;
  hitters: string[];
}

export interface ColoStanding {
  playerId: string;
  name: string;
  laurels: number;
  missions: ColoMission[];
  missionPoints: number;
  total: number;
  rank: number;
}

export interface ColoPlayerSummary {
  id: string;
  name: string;
  laurels: number;
  isMe: boolean;
  missionsChosen: boolean;
  hasBet: boolean;
}

export interface ColoMatchView {
  index: number;
  round: ColoRound;
  redId: string;
  blueId: string;
  openCards: ColoCard[];
  deckCount: number;
  order: string[];
  actionIndex: number;
  currentActor: string | null;
  actionLog: { playerId: string; type: 'peek' | 'swap'; slots: number[]; step: number; lap: 1 | 2 }[];
  pendingSwap: { playerId: string; slot: number; options: ColoCard[] | null } | null;
  bets: { playerId: string; placed: boolean; side: ColoSide | null }[];
  hiddenSlots: { slot: number; name: string; value: ColoCardValue | null }[];
  result: ColoMatchRecord | null;
}

export interface ColosseumClientState {
  phase: ColoPhase;
  gladiators: ColoGladiator[];
  bracket: { first: string[]; semi: (string | null)[]; final: (string | null)[]; champion: string | null };
  matchIndex: number;
  totalMatches: number;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  standings: ColoStanding[] | null;
  history: ColoMatchRecord[];
  myId: string | null;
  me: {
    laurels: number;
    notes: ColoPeekNote[];
    offered: ColoMissionOffer[] | null;
    missions: ColoMission[];
    bet: ColoSide | null;
  } | null;
  players: ColoPlayerSummary[];
  match: ColoMatchView | null;
}

export type ColosseumAction =
  | { type: 'choose_missions'; keep: string[] }
  | { type: 'peek'; slots: number[] }
  | { type: 'swap_start'; slot: number }
  | { type: 'swap_keep'; index: number }
  | { type: 'bet'; side: ColoSide }
  | { type: 'next_match' };
