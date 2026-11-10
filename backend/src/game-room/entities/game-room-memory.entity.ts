export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

export type GameRoomStatus = 'waiting' | 'playing' | 'finished';
export type GameType = 'toy-battle' | 'no-touch-kraken' | 'bomb-busters' | 'fellowship' | 'world-betting-cup' | 'multipitch' | 'three-pigs' | 'gacha';

/** 비공개 정보(손패, 몰래 본 카드)가 있어 플레이어별 뷰와 세션 토큰이 필요한 게임 */
export const PRIVATE_GAME_TYPES: GameType[] = ['bomb-busters', 'fellowship', 'world-betting-cup', 'multipitch', 'three-pigs', 'gacha'];
export function hasPrivateState(gameType?: GameType): boolean {
  return !!gameType && PRIVATE_GAME_TYPES.includes(gameType);
}

export class GameRoom {
  id: string;
  name: string;
  hostId: string;
  maxPlayers: number;
  players: Player[];
  status: GameRoomStatus;
  createdAt: Date;
  gameState: any;
  gameType: GameType;
  selectedMissionId: number = 1;
  selectedFellowshipChapter: number = 1;
  nextBombCaptainId?: string;

  constructor(id: string, name: string, hostId: string, maxPlayers: number = 2, gameType: GameType = 'toy-battle') {
    this.id = id;
    this.name = name;
    this.hostId = hostId;
    this.maxPlayers = maxPlayers;
    this.players = [];
    this.status = 'waiting';
    this.createdAt = new Date();
    this.gameState = null;
    this.gameType = gameType;
  }

  addPlayer(player: Player): void {
    if (this.players.length >= this.maxPlayers) {
      throw new Error('방이 가득 찼습니다.');
    }
    this.players.push(player);
  }

  removePlayer(playerId: string): void {
    this.players = this.players.filter(player => player.id !== playerId);
  }

  startGame(): void {
    this.status = 'playing';
  }

  finishGame(): void {
    this.status = 'finished';
  }

  toJSON() {
    return {
      id: this.id,
      name: this.name,
      hostId: this.hostId,
      maxPlayers: this.maxPlayers,
      players: this.players,
      status: this.status,
      createdAt: this.createdAt,
      // Cooperative card games contain private hands and must use the player-view serializer.
      gameState: hasPrivateState(this.gameType) ? null : this.gameState,
      gameType: this.gameType,
      ...(this.gameType === 'bomb-busters' ? { selectedMissionId: this.selectedMissionId } : {}),
      ...(this.gameType === 'fellowship' ? { selectedFellowshipChapter: this.selectedFellowshipChapter } : {}),
    };
  }
}
