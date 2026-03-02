import { io, Socket } from 'socket.io-client';

class SocketService {
  private socket: Socket | null = null;

  connect(): Socket {
    if (!this.socket) {
      const serverUrl = process.env.REACT_APP_API_URL || 'http://localhost:3001';
      this.socket = io(`${serverUrl}/game`, {
        withCredentials: true,
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

  // --- 공통 이벤트 ---

  joinRoom(roomId: string, playerId: string, playerName: string): void {
    this.socket?.emit('join_room', { roomId, playerId, playerName });
  }

  leaveRoom(roomId: string, playerId: string): void {
    this.socket?.emit('leave_room', { roomId, playerId });
  }

  toggleReady(roomId: string, playerId: string): void {
    this.socket?.emit('toggle_ready', { roomId, playerId });
  }

  startGame(roomId: string, hostId: string): void {
    this.socket?.emit('start_game', { roomId, hostId });
  }

  getRoomState(roomId: string): void {
    this.socket?.emit('get_room_state', { roomId });
  }

  // --- 토이배틀 이벤트 ---

  drawSoldiers(roomId: string, playerId: string): void {
    this.socket?.emit('draw_soldiers', { roomId, playerId });
  }

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

  selectGiantTarget(roomId: string, playerId: string, selectedVertex: string): void {
    this.socket?.emit('select_giant_target', { roomId, playerId, selectedVertex });
  }

  // --- 크라켄 이벤트 ---

  krakenSelectCard(roomId: string, playerId: string, targetPlayerId: string, cardIndex: number): void {
    this.socket?.emit('kraken_select_card', { roomId, playerId, targetPlayerId, cardIndex });
  }

  krakenChangeSelection(roomId: string, playerId: string, targetPlayerId: string, cardIndex: number): void {
    this.socket?.emit('kraken_change_selection', { roomId, playerId, targetPlayerId, cardIndex });
  }

  krakenConfirmReveal(roomId: string, playerId: string): void {
    this.socket?.emit('kraken_confirm_reveal', { roomId, playerId });
  }

  krakenChat(roomId: string, playerId: string, message: string): void {
    this.socket?.emit('kraken_chat', { roomId, playerId, message });
  }

  returnToRoom(roomId: string, playerId: string): void {
    this.socket?.emit('return_to_room', { roomId, playerId });
  }

  krakenPing(roomId: string, playerId: string, targetPlayerId: string, cardIndex: number, pingType: string, color: string): void {
    this.socket?.emit('kraken_ping', { roomId, playerId, targetPlayerId, cardIndex, pingType, color });
  }

  // --- 공통 리스너 ---

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

  // --- 토이배틀 리스너 ---

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

  // --- 크라켄 리스너 ---

  onKrakenStateUpdated(callback: (data: any) => void): void {
    this.socket?.on('kraken_state_updated', callback);
  }

  onKrakenChatMessage(callback: (data: any) => void): void {
    this.socket?.on('kraken_chat_message', callback);
  }

  onKrakenError(callback: (data: any) => void): void {
    this.socket?.on('kraken_error', callback);
  }

  onKrakenPing(callback: (data: any) => void): void {
    this.socket?.on('kraken_ping', callback);
  }

  // --- 기타 ---

  onError(callback: (data: any) => void): void {
    this.socket?.on('connect_error', callback);
    this.socket?.on('error', callback);
  }

  removeAllListeners(): void {
    this.socket?.removeAllListeners();
  }
}

export default new SocketService();
