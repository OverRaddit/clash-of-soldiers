export type PlayerColor = 'red' | 'blue';

export interface Soldier {
  type: number; // 1-8
  power: number;
  playerId: string;
  playerColor: PlayerColor;
}

export interface Vertex {
  id: string;
  type: 1 | 2 | 3; // 1: base, 2: special, 3: gray
  soldiers: Soldier[];
}

export interface GamePlayer {
  id: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  deck: Soldier[];
  stand: Soldier[];
  medals: number;
  discardPile: Soldier[];
}

export interface MedalZone {
  vertices: string[];
  points: number;
  claimed: boolean;
  claimedBy?: string;
}

export interface PendingAction {
  type: 'select_giant_target' | 'place_additional_soldier';
  playerId: string;
  availableTargets?: string[];
  sourceVertex?: string;
}

export interface ToyBattleGameState {
  vertices: [string, Vertex][];
  players: [string, GamePlayer][];
  currentTurn: string;
  turnCount: number;
  gameStatus: 'waiting' | 'playing' | 'finished';
  winner?: string;
  medalZones: MedalZone[];
  pendingAction?: PendingAction;
  turnStartSnapshot?: any;
}
