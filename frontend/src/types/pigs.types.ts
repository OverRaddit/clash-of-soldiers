// 아기 돼지 삼형제의 아파트 짓기: 서버의 getPigsPlayerView 가 돌려주는 플레이어 시점 상태

export type PigsCardKind = 'lot' | 'rebar' | 'concrete' | 'dynamite' | 'guard' | 'garden';
export type PigsPhase = 'playing' | 'finished';

export interface PigsTarget { playerId: string; apartmentIndex: number }
export interface PigsHandCard { id: string; kind: PigsCardKind; targets: PigsTarget[] }

export interface PigsApartmentView {
  lots: number;
  floors: { concrete: boolean }[];
  guard: number;
  completed: boolean;
  completeFloors: number;
  score: number;
}

export interface PigsPlayerView {
  id: string;
  name: string;
  handCount: number;
  isMe: boolean;
  score: number;
  apartments: PigsApartmentView[];
}

export interface PigsStanding { playerId: string; name: string; score: number; completed: number; rank: number; finisher: boolean }

export interface PigsLastAction {
  playerId: string;
  type: 'play' | 'discard' | 'skip';
  kind?: PigsCardKind;
  targetPlayerId?: string;
  apartmentIndex?: number;
  destroyedComplete?: boolean;
}

export interface PigsClientState {
  phase: PigsPhase;
  turn: number;
  currentPlayerId: string | null;
  deckCount: number;
  discardCount: number;
  discardTop: PigsCardKind | null;
  reshuffles: number;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  standings: PigsStanding[] | null;
  finisherId: string | null;
  lastAction: PigsLastAction | null;
  myId: string | null;
  me: { hand: PigsHandCard[] } | null;
  players: PigsPlayerView[];
}

export type PigsAction =
  | { type: 'play'; cardId: string; targetPlayerId: string; apartmentIndex: number }
  | { type: 'discard'; cardId: string };
