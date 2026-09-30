// Common types shared across all games
import type { BombMission } from './bomb-busters.types';
import type { FellowshipChapterPreview } from './fellowship.types';
export type GameRoomStatus = 'waiting' | 'playing' | 'finished';
export type GameType = 'toy-battle' | 'no-touch-kraken' | 'bomb-busters' | 'fellowship';

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
  gameType: GameType;
  selectedMissionId?: number;
  bombMissions?: BombMission[];
  selectedFellowshipChapter?: number;
  fellowshipChapters?: FellowshipChapterPreview[];
}

// Re-export toy-battle types for backward compatibility
export type { PlayerColor, Soldier, Vertex, GamePlayer, MedalZone, PendingAction } from './toy-battle.types';
export type { ToyBattleGameState as GameState } from './toy-battle.types';
