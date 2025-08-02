import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameRoom } from './entities/game-room-memory.entity';

@Injectable()
export class GameRoomService implements OnModuleDestroy {
  private rooms: Map<string, GameRoom> = new Map();
  private cleanupInterval: NodeJS.Timeout;

  constructor() {
    // 5분마다 빈 방 정리
    this.cleanupInterval = setInterval(() => {
      this.cleanupEmptyRooms();
    }, 5 * 60 * 1000);
  }

  onModuleDestroy() {
    if (this.cleanupInterval) {
      clearInterval(this.cleanupInterval);
    }
  }

  createRoom(createRoomDto: CreateRoomDto): GameRoom {
    const roomId = this.generateRoomId();
    const room = new GameRoom(
      roomId,
      createRoomDto.roomName,
      createRoomDto.hostId,
      createRoomDto.maxPlayers || 2
    );
    
    // 호스트를 방에 추가
    room.addPlayer({
      id: createRoomDto.hostId,
      name: 'Host', // 이름은 나중에 Socket에서 업데이트
      isHost: true,
      isReady: true
    });
    
    this.rooms.set(roomId, room);
    return room;
  }

  joinRoom(joinRoomDto: JoinRoomDto): GameRoom {
    const room = this.rooms.get(joinRoomDto.roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    if (room.status !== 'waiting') {
      throw new Error('게임이 이미 시작되었습니다.');
    }

    // 이미 참여한 플레이어인지 확인 (방장 포함)
    const existingPlayer = room.players.find(player => player.id === joinRoomDto.playerId);
    
    if (existingPlayer) {
      // 기존 플레이어의 이름 업데이트 (방장의 경우)
      existingPlayer.name = joinRoomDto.playerName;
      return room;
    }

    if (room.players.length >= room.maxPlayers) {
      throw new Error('방이 가득 찼습니다.');
    }

    room.addPlayer({
      id: joinRoomDto.playerId,
      name: joinRoomDto.playerName,
      isHost: false,
      isReady: false
    });

    return room;
  }

  leaveRoom(roomId: string, playerId: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    room.removePlayer(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      return null;
    }

    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    return room;
  }

  startGame(roomId: string, hostId: string): GameRoom {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    if (room.hostId !== hostId) {
      throw new Error('게임 시작 권한이 없습니다.');
    }

    if (room.players.length < 2) {
      throw new Error('최소 2명의 플레이어가 필요합니다.');
    }

    if (!room.players.every(player => player.isReady || player.isHost)) {
      throw new Error('모든 플레이어가 준비 상태여야 합니다.');
    }

    room.startGame();
    return room;
  }

  toggleReady(roomId: string, playerId: string): GameRoom {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    const player = room.players.find(p => p.id === playerId);
    
    if (!player) {
      throw new Error('플레이어를 찾을 수 없습니다.');
    }

    if (player.isHost) {
      throw new Error('호스트는 준비 상태를 변경할 수 없습니다.');
    }

    player.isReady = !player.isReady;
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values()).filter(room => room.status === 'waiting');
  }

  // 빈 방 정리
  private cleanupEmptyRooms(): void {
    const roomsToDelete: string[] = [];
    
    for (const [roomId, room] of this.rooms.entries()) {
      if (room.players.length === 0) {
        roomsToDelete.push(roomId);
      }
    }
    
    roomsToDelete.forEach(roomId => {
      this.rooms.delete(roomId);
      console.log(`빈 방 삭제됨: ${roomId}`);
    });
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}