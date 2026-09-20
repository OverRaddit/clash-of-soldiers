import { Injectable, OnModuleDestroy } from '@nestjs/common';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameRoom, GameType } from './entities/game-room-memory.entity';
import { BOMB_BUSTERS_MISSIONS, BombBustersLogicService } from './bomb-busters-logic.service';
import { resolveBombMission } from './bomb-busters/missions';
import { getBombCampaignDefinition } from './bomb-busters/campaign-definitions';
import { randomBytes, timingSafeEqual } from 'crypto';

@Injectable()
export class GameRoomService implements OnModuleDestroy {
  private rooms: Map<string, GameRoom> = new Map();
  private bombSessionTokens = new Map<string, Map<string, string>>();
  private cleanupInterval: NodeJS.Timeout;

  constructor(private readonly bombBustersLogicService: BombBustersLogicService) {
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
    const gameType = (createRoomDto.gameType || 'toy-battle') as GameType;
    if (!['toy-battle', 'no-touch-kraken', 'bomb-busters'].includes(gameType)) {
      throw new Error('지원하지 않는 게임입니다.');
    }
    const defaultMaxPlayers = gameType === 'no-touch-kraken' ? 4 : gameType === 'bomb-busters' ? 5 : 2;
    const maxPlayers = createRoomDto.maxPlayers ?? defaultMaxPlayers;
    const playerLimit = gameType === 'bomb-busters' ? 5 : gameType === 'toy-battle' ? 2 : 8;
    const minimumCapacity = gameType === 'no-touch-kraken' ? 3 : 2;
    if (!Number.isInteger(maxPlayers) || maxPlayers < minimumCapacity || maxPlayers > playerLimit) {
      throw new Error(`이 게임의 방 정원은 ${minimumCapacity}~${playerLimit}명입니다.`);
    }
    const room = new GameRoom(
      roomId,
      createRoomDto.roomName,
      createRoomDto.hostId,
      maxPlayers,
      gameType
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

    // 이미 참여한 플레이어인지 확인 (방장 포함)
    const existingPlayer = room.players.find(player => player.id === joinRoomDto.playerId);
    
    if (existingPlayer) {
      // 기존 플레이어의 이름 업데이트 (방장의 경우)
      existingPlayer.name = joinRoomDto.playerName;
      return room;
    }

    if (room.status !== 'waiting') {
      throw new Error('게임이 이미 시작되었습니다.');
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

  joinSocketRoom(joinRoomDto: JoinRoomDto, sessionToken?: string, alreadyBound = false): { room: GameRoom; sessionToken?: string } {
    const existingRoom = this.rooms.get(joinRoomDto.roomId);
    const tokens = this.bombSessionTokens.get(joinRoomDto.roomId);
    const existingToken = tokens?.get(joinRoomDto.playerId);
    if (existingRoom?.gameType === 'bomb-busters' && existingToken && !alreadyBound) {
      this.assertBombSession(joinRoomDto.roomId, joinRoomDto.playerId, sessionToken);
    }

    const room = this.joinRoom(joinRoomDto);
    if (room.gameType !== 'bomb-busters') return { room };
    const roomTokens = tokens ?? new Map<string, string>();
    const token = existingToken ?? randomBytes(32).toString('base64url');
    roomTokens.set(joinRoomDto.playerId, token);
    this.bombSessionTokens.set(room.id, roomTokens);
    return { room, sessionToken: token };
  }

  assertBombSession(roomId: string, playerId: string, sessionToken?: string): void {
    if (this.rooms.get(roomId)?.gameType !== 'bomb-busters') return;
    const token = this.bombSessionTokens.get(roomId)?.get(playerId);
    const received = typeof sessionToken === 'string' ? Buffer.from(sessionToken) : Buffer.alloc(0);
    const expected = token ? Buffer.from(token) : Buffer.alloc(0);
    if (!token || received.length !== expected.length || !timingSafeEqual(received, expected)) {
      throw new Error('이 플레이어의 기존 브라우저 세션 정보가 필요합니다.');
    }
  }

  leaveRoom(roomId: string, playerId: string): GameRoom | null {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    if (!room.players.some(player => player.id === playerId)) {
      throw new Error('방에 참여한 플레이어가 아닙니다.');
    }

    room.removePlayer(playerId);
    this.bombSessionTokens.get(roomId)?.delete(playerId);

    if (room.players.length === 0) {
      this.rooms.delete(roomId);
      this.bombSessionTokens.delete(roomId);
      return null;
    }

    if (room.hostId === playerId && room.players.length > 0) {
      room.hostId = room.players[0].id;
      room.players[0].isHost = true;
    }

    // Removing a rack would invalidate a cooperative deal, so abandon that deal.
    if (room.gameType === 'bomb-busters' && room.status !== 'waiting') {
      return this.resetRoom(roomId);
    }

    return room;
  }

  selectBombMission(roomId: string, playerId: string, missionId: number): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room || room.gameType !== 'bomb-busters') throw new Error('봄버스터즈 방을 찾을 수 없습니다.');
    if (room.hostId !== playerId) throw new Error('방장만 미션을 선택할 수 있습니다.');
    if (room.status !== 'waiting') throw new Error('대기 중에만 미션을 선택할 수 있습니다.');
    if (!Number.isInteger(missionId) || !BOMB_BUSTERS_MISSIONS.some(m => m.id === missionId)) {
      throw new Error('지원하지 않는 미션입니다.');
    }
    if (room.selectedMissionId !== missionId) {
      room.selectedMissionId = missionId;
      room.players.forEach(player => { if (!player.isHost) player.isReady = false; });
    }
    return room;
  }

  startGame(roomId: string, hostId: string, missionId?: number): GameRoom {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    if (room.hostId !== hostId) {
      throw new Error('게임 시작 권한이 없습니다.');
    }

    if (room.status !== 'waiting') {
      throw new Error('대기 중인 방에서만 게임을 시작할 수 있습니다.');
    }

    const minPlayers = room.gameType === 'no-touch-kraken' ? 3 : 2;
    if (room.players.length < minPlayers) {
      throw new Error(`최소 ${minPlayers}명의 플레이어가 필요합니다.`);
    }

    if (!room.players.every(player => player.isReady || player.isHost)) {
      throw new Error('모든 플레이어가 준비 상태여야 합니다.');
    }

    if (room.gameType === 'bomb-busters') {
      if (missionId !== undefined && missionId !== room.selectedMissionId) {
        if (!BOMB_BUSTERS_MISSIONS.some(m => m.id === missionId)) throw new Error('지원하지 않는 미션입니다.');
        throw new Error('대기실에서 미션을 먼저 선택하고 모두 준비해 주세요.');
      }
      room.gameState = this.bombBustersLogicService.initializeGame(
        room.players.map(player => player.id),
        room.players.map(player => player.name),
        room.selectedMissionId,
        room.nextBombCaptainId,
      );
    }

    room.startGame();
    return room;
  }

  toggleReady(roomId: string, playerId: string): GameRoom {
    const room = this.rooms.get(roomId);
    
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }

    if (room.status !== 'waiting') {
      throw new Error('대기 중인 방에서만 준비 상태를 변경할 수 있습니다.');
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

  resetRoom(roomId: string): GameRoom {
    const room = this.rooms.get(roomId);
    if (!room) {
      throw new Error('방을 찾을 수 없습니다.');
    }
    if (room.gameType === 'bomb-busters' && room.gameState?.captainId && room.players.length) {
      const captainIndex = room.players.findIndex(player => player.id === room.gameState.captainId);
      room.nextBombCaptainId = room.players[(captainIndex + 1) % room.players.length].id;
    }
    room.status = 'waiting';
    room.gameState = null;
    for (const player of room.players) {
      if (!player.isHost) {
        player.isReady = false;
      }
    }
    return room;
  }

  getRoom(roomId: string): GameRoom | undefined {
    return this.rooms.get(roomId);
  }

  getAllRooms(): GameRoom[] {
    return Array.from(this.rooms.values()).filter(room => room.status === 'waiting');
  }

  getActiveBombRooms(): GameRoom[] {
    return Array.from(this.rooms.values()).filter(room => room.gameType === 'bomb-busters' && room.status === 'playing' && room.gameState);
  }

  serializeRoom(room: GameRoom, playerId?: string) {
    const result = { ...room.toJSON(), ...(room.gameType === 'bomb-busters' ? {
      bombMissions: BOMB_BUSTERS_MISSIONS.map(m => {
        const metadata = m as typeof m & { minPlayers?: number; maxPlayers?: number };
        const previewCount = Math.max(metadata.minPlayers ?? 2, room.players.length);
        const setup = m.id >= 9 ? getBombCampaignDefinition(m.id, previewCount) : resolveBombMission(m.id, previewCount);
        return { id: m.id, name: m.name, description: m.description, blueMax: setup.blueMax,
          redCount: setup.redCount, yellowCount: setup.yellowCount, redCandidateCount: setup.redCandidateCount,
          yellowCandidateCount: setup.yellowCandidateCount, equipment: setup.equipment,
          minPlayers: metadata.minPlayers ?? 2, maxPlayers: metadata.maxPlayers ?? 5 };
      }),
    } : {}) };
    if (room.gameType === 'bomb-busters' && room.gameState) {
      const viewerId = room.players.some(player => player.id === playerId) ? playerId : undefined;
      result.gameState = this.bombBustersLogicService.getPlayerView(room.gameState, viewerId);
    }
    return result;
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
      this.bombSessionTokens.delete(roomId);
      console.log(`빈 방 삭제됨: ${roomId}`);
    });
  }

  private generateRoomId(): string {
    return Math.random().toString(36).substring(2, 8).toUpperCase();
  }
}
