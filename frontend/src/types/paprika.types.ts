// 파프리카 대축제: 서버의 getPaprikaPlayerView 가 돌려주는 플레이어 시점 상태

export type PaprikaTokenKind = 'seed' | 'thief';
export type PaprikaPhase = 'planting' | 'harvest' | 'finished';
export type PaprikaOutcome = 'festival' | 'farmer' | 'famine' | 'none';

export interface PaprikaCell { id: string; q: number; r: number }

export interface PaprikaTokenView {
  cell: string;
  ownerId: string;
  order: number;
  kind: PaprikaTokenKind | null;   // 남의 토큰은 파종 중 null
  removed: boolean;
  loot: number | null;
  stolenBy: string | null;
  harvested: boolean;
}

export interface PaprikaTokenFate {
  cell: string; ownerId: string; kind: PaprikaTokenKind;
  removed?: boolean; loot?: number; stolenBy?: string; harvested?: boolean;
}

export interface PaprikaHarvest { round: number; fates: PaprikaTokenFate[]; gains: Record<string, number>; total: number }

export interface PaprikaPlayerView {
  id: string;
  name: string;
  paprika: number;
  placed: number;
  skipped: boolean;
  roundGains: number[];
  isMe: boolean;
  seeds: number | null;
  thieves: number | null;
}

export interface PaprikaStanding { playerId: string; name: string; paprika: number; rank: number; winner: boolean }

export interface PaprikaClientState {
  phase: PaprikaPhase;
  round: number;
  rounds: number;
  radius: number;
  tokensPerPlayer: number;
  festivalGoal: number;
  currentPlayerId: string | null;
  cells: PaprikaCell[];
  board: PaprikaTokenView[];
  legalCells: string[];
  lastPlaced: { cell: string; ownerId: string } | null;
  harvests: PaprikaHarvest[];
  total: number;
  outcome: PaprikaOutcome | null;
  standings: PaprikaStanding[] | null;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  myId: string | null;
  players: PaprikaPlayerView[];
}

export type PaprikaAction =
  | { type: 'place'; cell: string; kind: PaprikaTokenKind }
  | { type: 'next_round' };
