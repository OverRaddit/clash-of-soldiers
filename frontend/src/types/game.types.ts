// Common types shared across all games
import type { BombMission } from './bomb-busters.types';
import type { FellowshipChapterPreview } from './fellowship.types';
export type GameRoomStatus = 'waiting' | 'playing' | 'finished';
export type GameType = 'toy-battle' | 'no-touch-kraken' | 'bomb-busters' | 'fellowship' | 'world-betting-cup' | 'multipitch';

/** 비공개 정보가 있어 세션 토큰과 플레이어별 상태 복원을 쓰는 게임 */
export const PRIVATE_GAME_TYPES: GameType[] = ['bomb-busters', 'fellowship', 'world-betting-cup', 'multipitch'];

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
