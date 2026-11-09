// 확보! (멀티피치) 클라이언트 타입. 백엔드 getMultipitchPlayerView 의 결과와 같다.
export type MultipitchSuit = 'crimp' | 'sloper' | 'jug' | 'crack';
export type SeatNumber = 1 | 2 | 3 | 4;

export interface MultipitchHoldCard { id: string; kind: 'hold'; suit: MultipitchSuit; rank: number }
export interface MultipitchFallCard { id: string; kind: 'fall' }
export type MultipitchCard = MultipitchHoldCard | MultipitchFallCard;

export interface MultipitchCell {
  index: number;
  name: string;
  suit?: MultipitchSuit;
  difficulty?: number;
  safe: boolean;
}

export interface MultipitchSeatView {
  seat: SeatNumber;
  playerId: string;
  name: string;
  position: number;
  handCount: number;
  callAvailable: boolean;
  tension: boolean;
  belayer: SeatNumber;
  revealedCard: MultipitchHoldCard | null;
  declaredVoidSuit: MultipitchSuit | null;
  declaredFall: { count: number; trickIndex: number } | null;
  isMe: boolean;
}

export interface MultipitchTrickPlay { seat: SeatNumber; card: MultipitchCard }

export interface MultipitchFallOutcome {
  seat: SeatNumber; safeZone: boolean; caught: boolean; byTension: boolean;
  from: number; to: number; injured: boolean; groundFall: boolean;
}
export interface MultipitchClimbOutcome { seat: SeatNumber; from: number; to: number; climbed: boolean; reason?: string }

export interface MultipitchTrickResult {
  trickIndex: number;
  leadSuit?: MultipitchSuit;
  winnerSeat?: SeatNumber;
  plays: MultipitchTrickPlay[];
  falls: MultipitchFallOutcome[];
  climbs: MultipitchClimbOutcome[];
  recoveredGear: number;
}

export type MultipitchBonus = 'tension' | 'gear' | 'recall_call' | 'none';
export interface MultipitchBonusOption { bonus: MultipitchBonus; targetSeat?: SeatNumber; label: string }

export type MultipitchAction =
  | { type: 'call'; call: 'belay' }
  | { type: 'call'; call: 'falling'; timing: 'this' | 'next' }
  | { type: 'call'; call: 'slack'; suit: MultipitchSuit }
  | { type: 'play_card'; cardId: string }
  | { type: 'choose_bonus'; bonus: 'tension'; targetSeat: SeatNumber }
  | { type: 'choose_bonus'; bonus: 'gear' | 'recall_call' | 'none' };

export interface MultipitchClientState {
  phase: 'play' | 'bonus' | 'finished';
  config: { ropeLength: number; suitBonus: number; gearCount: number; injuryLimit: number; dealsAllowed: number; fallCards: number };
  board: MultipitchCell[];
  deal: number;
  dealsAllowed: number;
  trickIndex: number;
  trickInDeal: number;
  tricksPerDeal: number;
  leadSeat: SeatNumber;
  turnSeat: SeatNumber;
  leadSuit: MultipitchSuit | null;
  plays: MultipitchTrickPlay[];
  rack: number;
  gearOnWall: number[];
  injuries: number;
  injuryLimit: number;
  sunset: number;
  pendingBonusSeat: SeatNumber | null;
  lastTrick: MultipitchTrickResult | null;
  outcome: 'victory' | 'defeat' | null;
  outcomeReason: string | null;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  mySeat: SeatNumber | null;
  hand: MultipitchCard[];
  legalCardIds: string[];
  bonusOptions: MultipitchBonusOption[];
  callsOpen: boolean;
  seats: MultipitchSeatView[];
}
