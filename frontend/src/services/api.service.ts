import axios from 'axios';
import { GameRoom } from '../types/game.types';

const API_BASE_URL = 'http://localhost:3001';

const api = axios.create({
  baseURL: API_BASE_URL,
  headers: {
    'Content-Type': 'application/json',
  },
  withCredentials: true,
});

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  message?: string;
  count?: number;
}

class ApiService {
  // 방 생성
  async createRoom(roomName: string, hostId: string, maxPlayers: number = 2): Promise<ApiResponse<GameRoom>> {
    const response = await api.post('/game-rooms', {
      roomName,
      hostId,
      maxPlayers,
    });
    return response.data;
  }

  // 방 목록 조회
  async getRooms(): Promise<ApiResponse<GameRoom[]>> {
    const response = await api.get('/game-rooms');
    return response.data;
  }

  // 특정 방 조회
  async getRoom(roomId: string): Promise<ApiResponse<GameRoom>> {
    const response = await api.get(`/game-rooms/${roomId}`);
    return response.data;
  }

  // 방 참여 (REST API)
  async joinRoom(roomId: string, playerId: string, playerName: string): Promise<ApiResponse<GameRoom>> {
    const response = await api.post(`/game-rooms/${roomId}/join`, {
      playerId,
      playerName,
    });
    return response.data;
  }

  // 방 나가기 (REST API)
  async leaveRoom(roomId: string, playerId: string): Promise<ApiResponse<GameRoom | null>> {
    const response = await api.delete(`/game-rooms/${roomId}/leave/${playerId}`);
    return response.data;
  }

  // 준비 상태 토글 (REST API)
  async toggleReady(roomId: string, playerId: string): Promise<ApiResponse<GameRoom>> {
    const response = await api.patch(`/game-rooms/${roomId}/ready/${playerId}`);
    return response.data;
  }

  // 게임 시작 (REST API)
  async startGame(roomId: string, hostId: string): Promise<ApiResponse<GameRoom>> {
    const response = await api.post(`/game-rooms/${roomId}/start`, {
      hostId,
    });
    return response.data;
  }

  // 병정 뽑기 (REST API)
  async drawSoldiers(roomId: string, playerId: string): Promise<ApiResponse<GameRoom>> {
    const response = await api.post(`/game-rooms/${roomId}/game/draw`, {
      playerId,
    });
    return response.data;
  }

  // 병정 배치 (REST API)
  async placeSoldier(
    roomId: string,
    playerId: string,
    soldierIndex: number,
    targetVertex: string
  ): Promise<ApiResponse<GameRoom>> {
    const response = await api.post(`/game-rooms/${roomId}/game/place`, {
      playerId,
      soldierIndex,
      targetVertex,
    });
    return response.data;
  }
}

export default new ApiService();