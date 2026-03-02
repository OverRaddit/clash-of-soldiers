export interface Player {
  id: string;
  name: string;
  isHost: boolean;
  isReady: boolean;
}

export type GameRoomStatus = 'waiting' | 'playing' | 'finished';
export type GameType = 'toy-battle' | 'no-touch-kraken';

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
      gameState: this.gameState,
      gameType: this.gameType
    };
  }
}