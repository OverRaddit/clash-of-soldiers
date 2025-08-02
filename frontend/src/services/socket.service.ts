import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      this.socket = io(`${serverUrl}/game`, {
        withCredentials: true, // CORS 설정을 위해 필요
      });
    }
    return this.socket;
  }

  disconnect(): void {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  getSocket(): Socket | null {
    return this.socket;
  }

  // 방 참여
  joinRoom(roomId: string, playerId: string, playerName: string): void {
    this.socket?.emit('join_room', { roomId, playerId, playerName });
  }

  // 방 나가기
  leaveRoom(roomId: string, playerId: string): void {
    this.socket?.emit('leave_room', { roomId, playerId });
  }

  // 준비 상태 토글
  toggleReady(roomId: string, playerId: string): void {
    this.socket?.emit('toggle_ready', { roomId, playerId });
  }

  // 게임 시작
  startGame(roomId: string, hostId: string): void {
    this.socket?.emit('start_game', { roomId, hostId });
  }

  // 병정 뽑기
  drawSoldiers(roomId: string, playerId: string): void {
    this.socket?.emit('draw_soldiers', { roomId, playerId });
  }

  // 병정 배치
  placeSoldier(
    roomId: string,
    playerId: string,
    soldierIndex: number,
    targetVertex: string
  ): void {
    this.socket?.emit('place_soldier', {
      roomId,
      playerId,
      soldierIndex,
      targetVertex,
    });
  }

  // 거인병 대상 선택
  selectGiantTarget(roomId: string, playerId: string, selectedVertex: string): void {
    this.socket?.emit('select_giant_target', { roomId, playerId, selectedVertex });
  }

  // 방 상태 요청
  getRoomState(roomId: string): void {
    this.socket?.emit('get_room_state', { roomId });
  }

  // 이벤트 리스너 등록
  onRoomUpdated(callback: (data: any) => void): void {
    this.socket?.on('room_updated', callback);
  }

  onGameStarted(callback: (data: any) => void): void {
    this.socket?.on('game_started', callback);
  }

  onGameUpdated(callback: (data: any) => void): void {
    this.socket?.on('game_updated', callback);
  }

  onGameEnded(callback: (data: any) => void): void {
    this.socket?.on('game_ended', callback);
  }

  onJoinRoomSuccess(callback: (data: any) => void): void {
    this.socket?.on('join_room_success', callback);
  }

  onJoinRoomError(callback: (data: any) => void): void {
    this.socket?.on('join_room_error', callback);
  }

  onPlaceSoldierError(callback: (data: any) => void): void {
    this.socket?.on('place_soldier_error', callback);
  }

  onDrawSoldiersError(callback: (data: any) => void): void {
    this.socket?.on('draw_soldiers_error', callback);
  }

  onGiantSelectionRequired(callback: (data: any) => void): void {
    this.socket?.on('giant_selection_required', callback);
  }

  onSelectGiantTargetError(callback: (data: any) => void): void {
    this.socket?.on('select_giant_target_error', callback);
  }

  onError(callback: (data: any) => void): void {
    this.socket?.on('connect_error', callback);
    this.socket?.on('error', callback);
  }

  // 이벤트 리스너 제거
  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }
}

export default new SocketService();
