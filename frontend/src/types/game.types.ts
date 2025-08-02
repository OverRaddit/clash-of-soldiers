export type PlayerColor = 'red' | 'blue';
export type GameRoomStatus = 'waiting' | 'playing' | 'finished';

export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

export interface GameRoom {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  status: GameRoomStatus;
  createdAt: string;
  gameState?: any;
}

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
  availableTargets?: string[]; // 거인병용: 제거 가능한 정점들
  sourceVertex?: string; // 거인병이 배치된 정점
}

export interface GameState {
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