import {
  WebSocketGateway,
  WebSocketServer,
  SubscribeMessage,
  MessageBody,
  ConnectedSocket,
  OnGatewayConnection,
  OnGatewayDisconnect,
} from '@nestjs/websockets';
import { Server, Socket } from 'socket.io';
import { GameRoomService } from './game-room.service';
import { GameLogicService } from './game-logic.service';
import { KrakenLogicService } from './kraken-logic.service';
import { GameState } from './entities/game-state.entity';
import { GameRoom, GameType } from './entities/game-room-memory.entity';
import { BombBustersLogicService } from './bomb-busters-logic.service';
import { BombBustersAction } from './entities/bomb-busters-game-state.entity';
import { OnModuleDestroy, OnModuleInit } from '@nestjs/common';

interface ClientInfo {
  playerId: string;
  roomId?: string;
  sessionToken?: string;
}

interface DisconnectedClient {
  playerId: string;
  roomId: string;
  disconnectTime: Date;
  timer?: NodeJS.Timeout;
}

@WebSocketGateway({
  cors: {
    origin: [
      'http://localhost:3000',
      'https://clash-of-soldiers.vercel.app',
      /^https:\/\/.*\.vercel\.app$/
    ],
    credentials: true,
  },
  namespace: '/game'
})
export class GameRoomGateway implements OnGatewayConnection, OnGatewayDisconnect, OnModuleInit, OnModuleDestroy {
  @WebSocketServer()
  server: Server;

  private clients: Map<string, ClientInfo> = new Map();
  private disconnectedClients: Map<string, DisconnectedClient> = new Map();
  private reconnectTimeout = 30 * 1000; // 30초
  private shuttingDown = false;
  private bombClock?: ReturnType<typeof setInterval>;

  constructor(
    private readonly gameRoomService: GameRoomService,
    private readonly gameLogicService: GameLogicService,
    private readonly krakenLogicService: KrakenLogicService,
    private readonly bombBustersLogicService: BombBustersLogicService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  onModuleInit() {
    this.bombClock = setInterval(() => {
      if (this.shuttingDown) return;
      for (const room of this.gameRoomService.getActiveBombRooms()) this.tickBombRoom(room);
    }, 250);
    this.bombClock.unref();
  }

  onModuleDestroy() {
    this.shuttingDown = true;
    if (this.bombClock) clearInterval(this.bombClock);
    for (const disconnected of this.disconnectedClients.values()) {
      clearTimeout(disconnected.timer);
    }
    this.disconnectedClients.clear();
  }

  handleDisconnect(client: Socket) {
    const info = this.clients.get(client.id);
    this.clients.delete(client.id);
    if (this.shuttingDown) return;
    if (!info?.roomId || !info.playerId) return;
    const currentRoom = this.gameRoomService.getRoom(info.roomId);
    if (!currentRoom || !this.isBoundMember(info, currentRoom)) return;

    // Another browser tab can still be connected for this same player.
    if ([...this.clients.values()].some(other => other.playerId === info.playerId && this.isBoundMember(other, currentRoom))) {
      return;
    }

    const key = this.reconnectKey(info.roomId, info.playerId);
    const disconnected: DisconnectedClient = {
      playerId: info.playerId,
      roomId: info.roomId,
      disconnectTime: new Date(),
    };
    this.clearReconnect(info.roomId, info.playerId);
    this.disconnectedClients.set(key, disconnected);
    disconnected.timer = setTimeout(() => {
      // A previous disconnect timer must not remove a newly reconnected session.
      if (this.disconnectedClients.get(key) !== disconnected) return;
      this.disconnectedClients.delete(key);
      const existingRoom = this.gameRoomService.getRoom(info.roomId);
      if (!existingRoom || !this.isBoundMember(info, existingRoom)) return;
      const room = this.gameRoomService.leaveRoom(info.roomId, info.playerId);
      if (room) {
        this.emitRoomUpdate(room, 'player_left', room.gameType === 'bomb-busters'
          ? '플레이어가 재연결하지 않아 대기실로 돌아왔습니다.'
          : '플레이어가 연결 해제되어 나갔습니다.');
      }
    }, this.reconnectTimeout);

    const room = this.gameRoomService.getRoom(info.roomId);
    if (room) this.emitRoomUpdate(room, 'player_disconnected', '플레이어의 재연결을 기다리고 있습니다. (30초)');
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; playerName: string; sessionToken?: string }
  ) {
    try {
      if (!data || typeof data.roomId !== 'string' || typeof data.playerId !== 'string' ||
          typeof data.playerName !== 'string' || !data.playerId.trim() || !data.playerName.trim()) {
        throw new Error('올바른 방과 플레이어 정보를 입력해주세요.');
      }
      const existingInfo = this.clients.get(client.id);
      if (existingInfo?.roomId && existingInfo.playerId !== data.playerId) {
        throw new Error('현재 연결의 플레이어를 변경할 수 없습니다.');
      }
      const isReconnecting = this.disconnectedClients.has(this.reconnectKey(data.roomId, data.playerId));
      const existingRoom = this.gameRoomService.getRoom(data.roomId);
      const { room, sessionToken } = this.gameRoomService.joinSocketRoom(data, data.sessionToken,
        existingRoom && existingInfo?.playerId === data.playerId && this.isBoundMember(existingInfo, existingRoom));

      if (existingInfo?.roomId && existingInfo.roomId !== data.roomId) {
        client.leave(existingInfo.roomId);
        const previousRoom = this.gameRoomService.getRoom(existingInfo.roomId);
        if (previousRoom?.players.some(player => player.id === existingInfo.playerId)) {
          const remainingRoom = this.gameRoomService.leaveRoom(existingInfo.roomId, existingInfo.playerId);
          if (remainingRoom) this.emitRoomUpdate(remainingRoom, 'player_left', '플레이어가 나갔습니다.');
        }
      }
      this.clearReconnect(data.roomId, data.playerId);
      this.clients.set(client.id, { playerId: data.playerId, roomId: data.roomId, sessionToken });
      client.join(data.roomId);
      this.emitRoomUpdate(room, isReconnecting ? 'player_reconnected' : 'player_joined',
        `${data.playerName}님이 ${isReconnecting ? '재연결했습니다' : '입장했습니다'}.`);
      client.emit('join_room_success', {
        room: this.gameRoomService.serializeRoom(room, data.playerId),
        playerId: data.playerId,
        ...(sessionToken ? { sessionToken } : {}),
      });

    } catch (error) {
      client.emit('join_room_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('leave_room')
  handleLeaveRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string }
  ) {
    try {
      this.requireMember(client, data.roomId, data.playerId);
      const room = this.gameRoomService.leaveRoom(data.roomId, data.playerId);
      this.clearReconnect(data.roomId, data.playerId);
      
      // 소켓 룸에서 나가기
      client.leave(data.roomId);
      
      // 클라이언트 정보 업데이트
      const clientInfo = this.clients.get(client.id);
      if (clientInfo) {
        clientInfo.roomId = undefined;
      }

      // 방이 존재하면 다른 플레이어들에게 알림
      if (room) {
        this.emitRoomUpdate(room, 'player_left', room.gameType === 'bomb-busters'
          ? '플레이어가 나가 대기실로 돌아왔습니다.'
          : '플레이어가 나갔습니다.');
      }

      client.emit('leave_room_success', {
        message: '방에서 나갔습니다.'
      });

    } catch (error) {
      client.emit('leave_room_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('toggle_ready')
  handleToggleReady(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string }
  ) {
    try {
      this.requireMember(client, data.roomId, data.playerId);
      const room = this.gameRoomService.toggleReady(data.roomId, data.playerId);
      
      this.emitRoomUpdate(room, 'ready_changed', '준비 상태가 변경되었습니다.');

    } catch (error) {
      client.emit('toggle_ready_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('select_bomb_mission')
  handleSelectBombMission(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; missionId: number },
  ) {
    try {
      this.requireMember(client, data?.roomId, data?.playerId, 'bomb-busters');
      const room = this.gameRoomService.selectBombMission(data.roomId, data.playerId, data.missionId);
      this.emitRoomUpdate(room, 'mission_changed', '미션이 변경되었습니다. 규칙을 확인하고 준비해 주세요.');
    } catch (error) {
      client.emit('bomb_busters_error', { message: error.message });
    }
  }

  @SubscribeMessage('start_game')
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; hostId: string; missionId?: number }
  ) {
    try {
      this.requireMember(client, data.roomId, data.hostId);
      const room = this.gameRoomService.startGame(data.roomId, data.hostId, data.missionId);

      const playerIds = room.players.map(p => p.id);
      const playerNames = room.players.map(p => p.name);

      if (room.gameType === 'bomb-busters') {
        this.emitBombBustersStateToAll(room, '게임이 시작되었습니다!', 'game_started');
      } else if (room.gameType === 'no-touch-kraken') {
        // 크라켄 게임 초기화
        const krakenState = this.krakenLogicService.initializeGame(playerIds, playerNames);
        room.gameState = krakenState.toJSON();

        // 플레이어별 다른 상태를 개별 emit
        this.emitKrakenStateToAll(data.roomId, room, '게임이 시작되었습니다!', 'game_started');
      } else {
        // 토이배틀 게임 초기화
        const gameState = this.gameLogicService.initializeGame(playerIds, playerNames);
        room.gameState = gameState.toJSON();

        this.server.to(data.roomId).emit('game_started', {
          room: this.gameRoomService.serializeRoom(room),
          gameState: gameState.toJSON(),
          message: '게임이 시작되었습니다!'
        });
      }

    } catch (error) {
      client.emit('start_game_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('draw_soldiers')
  handleDrawSoldiers(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'toy-battle');
      if (!room || !room.gameState) {
        throw new Error('게임을 찾을 수 없습니다.');
      }

      // GameState 복원
      const gameState = GameState.fromJSON(room.gameState);

      if (gameState.currentTurn !== data.playerId) {
        throw new Error('현재 턴이 아닙니다.');
      }

      // 받침대 상태 확인
      const player = gameState.players.get(data.playerId);
      if (!player) {
        throw new Error('플레이어를 찾을 수 없습니다.');
      }

      if (player.stand.length >= 8) {
        throw new Error('받침대가 가득 차서 더 이상 병정을 뽑을 수 없습니다.');
      }

      if (player.deck.length === 0) {
        throw new Error('덱에 병정이 없어서 뽑을 수 없습니다.');
      }

      const success = this.gameLogicService.drawTwoSoldiers(gameState, data.playerId);
      if (!success) {
        throw new Error('병정을 뽑을 수 없습니다.');
      }

      // 턴 변경
      this.gameLogicService.nextTurn(gameState);
      
      // 상태 저장
      room.gameState = gameState.toJSON();

      this.server.to(data.roomId).emit('game_updated', {
        type: 'soldiers_drawn',
        gameState: gameState.toJSON(),
        playerId: data.playerId,
        message: `${data.playerId}님이 병정 2개를 뽑았습니다.`
      });

    } catch (error) {
      client.emit('draw_soldiers_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('place_soldier')
  handlePlaceSoldier(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      roomId: string; 
      playerId: string; 
      soldierIndex: number; 
      targetVertex: string;
    }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'toy-battle');
      if (!room || !room.gameState) {
        throw new Error('게임을 찾을 수 없습니다.');
      }

      // GameState 복원
      const gameState = GameState.fromJSON(room.gameState);

      // 일반 턴이거나 pendingAction의 플레이어인지 확인
      const isNormalTurn = gameState.currentTurn === data.playerId;
      const isCaptainAdditionalPlace = gameState.pendingAction?.type === 'place_additional_soldier' && 
                                       gameState.pendingAction.playerId === data.playerId;
      
      if (!isNormalTurn && !isCaptainAdditionalPlace) {
        throw new Error('현재 턴이 아니거나 추가 배치 권한이 없습니다.');
      }

      // 캡틴 추가 배치인 경우 미리 pendingAction 클리어
      if (isCaptainAdditionalPlace) {
        gameState.clearPendingAction();
      }

      const result = this.gameLogicService.placeSoldier(
        gameState, 
        data.playerId, 
        data.soldierIndex, 
        data.targetVertex
      );

      if (!result.success) {
        throw new Error(result.reason || '병정을 배치할 수 없습니다.');
      }

      // 캡틴 추가 배치 완료 처리
      if (isCaptainAdditionalPlace) {
        // 새로운 pendingAction이 생겼는지 확인 (연속 캡틴 효과)
        if (!gameState.pendingAction) {
          this.gameLogicService.nextTurn(gameState);
        }
        // pendingAction이 있으면 연속 캡틴 효과로 턴 계속
      } else if (!gameState.pendingAction) {
        // 일반 배치에서 pendingAction이 없는 경우에만 턴 변경
        this.gameLogicService.nextTurn(gameState);
      }

      // 상태 저장
      room.gameState = gameState.toJSON();

      let message = isCaptainAdditionalPlace 
        ? `${data.playerId}님이 캡틴 효과로 추가 병정을 배치했습니다.`
        : `${data.playerId}님이 병정을 배치했습니다.`;
      if (result.medalAwarded && result.medalAwarded > 0) {
        message += ` 승점 ${result.medalAwarded}점 획득!`;
      }

      if (result.gameEnded) {
        room.status = 'finished';
        this.server.to(data.roomId).emit('game_ended', {
          gameState: gameState.toJSON(),
          winner: gameState.winner,
          message: '게임이 종료되었습니다!'
        });
      } else {
        // pendingAction 상태에 따라 적절한 이벤트 전송
        if (gameState.pendingAction) {
          if (gameState.pendingAction.type === 'select_giant_target') {
            this.server.to(data.roomId).emit('giant_selection_required', {
              gameState: gameState.toJSON(),
              pendingAction: gameState.pendingAction,
              message: '거인병 효과: 제거할 상대 병정을 선택하세요.'
            });
          } else if (gameState.pendingAction.type === 'place_additional_soldier') {
            // 캡틴 효과: 특별한 이벤트 없이 일반 게임 상태로 전송
            this.server.to(data.roomId).emit('game_updated', {
              type: 'soldier_placed',
              gameState: gameState.toJSON(),
              playerId: data.playerId,
              targetVertex: data.targetVertex,
              medalAwarded: result.medalAwarded || 0,
              message: message + ' (추가 병정을 배치할 수 있습니다)'
            });
          }
        } else {
          this.server.to(data.roomId).emit('game_updated', {
            type: 'soldier_placed',
            gameState: gameState.toJSON(),
            playerId: data.playerId,
            targetVertex: data.targetVertex,
            medalAwarded: result.medalAwarded || 0,
            message: message
          });
        }
      }

    } catch (error) {
      client.emit('place_soldier_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('select_giant_target')
  handleSelectGiantTarget(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { 
      roomId: string; 
      playerId: string; 
      selectedVertex: string;
    }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'toy-battle');
      if (!room || !room.gameState) {
        throw new Error('게임을 찾을 수 없습니다.');
      }

      const gameState = GameState.fromJSON(room.gameState);

      // 거인병 선택 실행
      const success = this.gameLogicService.executeGiantSelection(
        gameState, 
        data.playerId, 
        data.selectedVertex
      );

      if (!success) {
        throw new Error('잘못된 선택입니다.');
      }

      // 거인병 효과 완료 후 턴 변경
      this.gameLogicService.nextTurn(gameState);

      // 상태 저장
      room.gameState = gameState.toJSON();

      // 게임 상태 업데이트 전송
      this.server.to(data.roomId).emit('game_updated', {
        type: 'giant_target_selected',
        gameState: gameState.toJSON(),
        playerId: data.playerId,
        selectedVertex: data.selectedVertex,
        message: `${data.playerId}님이 거인병 효과로 ${data.selectedVertex}의 병정을 제거했습니다.`
      });

    } catch (error) {
      client.emit('select_giant_target_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('get_room_state')
  handleGetRoomState(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string }
  ) {
    try {
      const room = this.requireMember(client, data.roomId);
      if (!room) {
        throw new Error('방을 찾을 수 없습니다.');
      }

      if (room.gameType === 'no-touch-kraken' && room.gameState) {
        const clientInfo = this.clients.get(client.id);
        if (clientInfo?.playerId) {
          const krakenState = this.krakenLogicService.deserializeState(room.gameState);
          const playerView = this.krakenLogicService.getPlayerView(krakenState, clientInfo.playerId);
          client.emit('room_state', {
            room: { ...this.gameRoomService.serializeRoom(room), gameState: playerView }
          });
        }
      } else {
        client.emit('room_state', {
          room: this.gameRoomService.serializeRoom(room, this.clients.get(client.id)?.playerId)
        });
      }

    } catch (error) {
      client.emit('get_room_state_error', {
        message: error.message
      });
    }
  }

  // --- 크라켄 전용 이벤트 핸들러 ---

  @SubscribeMessage('kraken_select_card')
  handleKrakenSelectCard(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; targetPlayerId: string; cardIndex: number }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'no-touch-kraken');
      if (!room || !room.gameState) throw new Error('게임을 찾을 수 없습니다.');

      const krakenState = this.krakenLogicService.deserializeState(room.gameState);
      this.krakenLogicService.selectCard(krakenState, data.playerId, data.targetPlayerId, data.cardIndex);
      room.gameState = krakenState.toJSON();

      this.emitKrakenStateToAll(data.roomId, room, `카드를 선택했습니다.`);
    } catch (error) {
      client.emit('kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('kraken_change_selection')
  handleKrakenChangeSelection(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; targetPlayerId: string; cardIndex: number }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'no-touch-kraken');
      if (!room || !room.gameState) throw new Error('게임을 찾을 수 없습니다.');

      const krakenState = this.krakenLogicService.deserializeState(room.gameState);
      this.krakenLogicService.changeSelection(krakenState, data.playerId, data.targetPlayerId, data.cardIndex);
      room.gameState = krakenState.toJSON();

      this.emitKrakenStateToAll(data.roomId, room, `선택을 변경했습니다.`);
    } catch (error) {
      client.emit('kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('kraken_confirm_reveal')
  handleKrakenConfirmReveal(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'no-touch-kraken');
      if (!room || !room.gameState) throw new Error('게임을 찾을 수 없습니다.');

      const krakenState = this.krakenLogicService.deserializeState(room.gameState);

      // Capture selectedCard before confirmReveal clears it
      const capturedSelection = krakenState.selectedCard
        ? { targetPlayerId: krakenState.selectedCard.targetPlayerId, cardIndex: krakenState.selectedCard.cardIndex }
        : undefined;

      const result = this.krakenLogicService.confirmReveal(krakenState, data.playerId);
      room.gameState = krakenState.toJSON();

      // Build lastRevealedCard from captured selection + result
      const lastRevealedCard = capturedSelection ? {
        cardType: result.cardType,
        revealedBy: data.playerId,
        revealedFrom: capturedSelection.targetPlayerId,
        cardIndex: capturedSelection.cardIndex,
      } : undefined;

      if (result.gameEnded) {
        room.status = 'finished';
        // 게임 종료 시 모든 플레이어에게 최종 상태 전송
        for (const [socketId, info] of this.clients.entries()) {
          if (info.roomId === data.roomId && info.playerId) {
            const playerView = this.krakenLogicService.getPlayerView(krakenState, info.playerId);
            if (lastRevealedCard) playerView.lastRevealedCard = lastRevealedCard;
            this.server.to(socketId).emit('game_ended', {
              room: this.gameRoomService.serializeRoom(room),
              gameState: playerView,
              winner: krakenState.winner,
              winReason: krakenState.winReason,
              message: result.message
            });
          }
        }
      } else {
        this.emitKrakenStateToAll(data.roomId, room, result.message, 'kraken_state_updated', lastRevealedCard);
      }
    } catch (error) {
      client.emit('kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('return_to_room')
  handleReturnToRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId);
      if (!room) throw new Error('방을 찾을 수 없습니다.');
      if (room.hostId !== data.playerId) throw new Error('방장만 방으로 돌아갈 수 있습니다.');

      this.gameRoomService.resetRoom(data.roomId);

      this.emitRoomUpdate(room, 'returned_to_room', '방으로 돌아왔습니다.');
    } catch (error) {
      client.emit(this.gameRoomService.getRoom(data?.roomId)?.gameType === 'bomb-busters'
        ? 'bomb_busters_error' : 'kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('kraken_ping')
  handleKrakenPing(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; targetPlayerId: string; cardIndex: number; pingType: string; color: string }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'no-touch-kraken');
      if (!room) throw new Error('방을 찾을 수 없습니다.');

      const player = room.players.find(p => p.id === data.playerId);
      const pingerName = player?.name || data.playerId;

      this.server.to(data.roomId).emit('kraken_ping', {
        pingerId: data.playerId,
        pingerName,
        targetPlayerId: data.targetPlayerId,
        cardIndex: data.cardIndex,
        pingType: data.pingType,
        color: data.color,
        timestamp: Date.now(),
      });
    } catch (error) {
      client.emit('kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('kraken_set_claim')
  handleKrakenSetClaim(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; claim: { treasureCount: number; hasKraken: boolean } }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'no-touch-kraken');
      if (!room || !room.gameState) throw new Error('게임을 찾을 수 없습니다.');

      const krakenState = this.krakenLogicService.deserializeState(room.gameState);
      this.krakenLogicService.setClaim(krakenState, data.playerId, data.claim);
      room.gameState = krakenState.toJSON();

      this.emitKrakenStateToAll(data.roomId, room, `${data.playerId}님이 주장을 변경했습니다.`);
    } catch (error) {
      client.emit('kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('kraken_chat')
  handleKrakenChat(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; message: string }
  ) {
    try {
      const room = this.requireMember(client, data.roomId, data.playerId, 'no-touch-kraken');
      if (!room || !room.gameState) throw new Error('게임을 찾을 수 없습니다.');

      const krakenState = this.krakenLogicService.deserializeState(room.gameState);
      const chatMessage = this.krakenLogicService.addChatMessage(krakenState, data.playerId, data.message);
      room.gameState = krakenState.toJSON();

      // 채팅은 모든 플레이어에게 동일하게 전송
      this.server.to(data.roomId).emit('kraken_chat_message', chatMessage);
    } catch (error) {
      client.emit('kraken_error', { message: error.message });
    }
  }

  @SubscribeMessage('bomb_busters_action')
  handleBombBustersAction(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; action: BombBustersAction },
  ) {
    try {
      const room = this.requireMember(client, data?.roomId, data?.playerId, 'bomb-busters');
      if (room.status !== 'playing' || !room.gameState) {
        throw new Error('진행 중인 봄버스터즈 게임이 없습니다.');
      }
      if (!data.action || typeof data.action !== 'object' || Array.isArray(data.action)) {
        throw new Error('올바른 행동을 선택해주세요.');
      }
      // Process elapsed server time before accepting an action at a deadline.
      this.tickBombRoom(room);
      if (room.status !== 'playing') throw new Error('미션 제한 시간이 끝났습니다.');
      // Commit only a complete valid action, keeping rejected payloads atomic.
      const nextState = JSON.parse(JSON.stringify(room.gameState));
      const result = this.bombBustersLogicService.applyAction(nextState, data.playerId, data.action);
      room.gameState = nextState;
      const gameEnded = nextState.phase === 'finished';
      if (gameEnded) room.finishGame();
      this.emitBombBustersStateToAll(room, result.message,
        gameEnded ? 'game_ended' : 'bomb_busters_state_updated');
    } catch (error) {
      client.emit('bomb_busters_error', { message: error.message });
    }
  }

  // --- 헬퍼 메서드 ---

  private tickBombRoom(room: GameRoom): void {
    if (room.status !== 'playing' || !room.gameState) return;
    if (!this.bombBustersLogicService.tick(room.gameState)) return;
    const finished = room.gameState.phase === 'finished';
    if (finished) room.finishGame();
    this.emitBombBustersStateToAll(room, room.gameState.log.at(-1) ?? '미션 시간이 갱신되었습니다.',
      finished ? 'game_ended' : 'bomb_busters_state_updated');
  }

  private reconnectKey(roomId: string, playerId: string): string {
    return JSON.stringify([roomId, playerId]);
  }

  private clearReconnect(roomId: string, playerId: string): void {
    const key = this.reconnectKey(roomId, playerId);
    const disconnected = this.disconnectedClients.get(key);
    if (disconnected) clearTimeout(disconnected.timer);
    this.disconnectedClients.delete(key);
  }

  private requireMember(client: Socket, roomId: string, playerId?: string, gameType?: GameType): GameRoom {
    const info = this.clients.get(client.id);
    const room = this.gameRoomService.getRoom(roomId);
    if (!room) throw new Error('방을 찾을 수 없습니다.');
    if (!info || (playerId !== undefined && info.playerId !== playerId) || !this.isBoundMember(info, room)) {
      throw new Error('현재 연결로 참여한 플레이어만 행동할 수 있습니다.');
    }
    if (gameType && room.gameType !== gameType) throw new Error('이 게임에서 사용할 수 없는 행동입니다.');
    return room;
  }

  private isBoundMember(info: ClientInfo, room: GameRoom): boolean {
    if (!info || info.roomId !== room.id || !room.players.some(player => player.id === info.playerId)) return false;
    try {
      this.gameRoomService.assertBombSession(room.id, info.playerId, info.sessionToken);
      return true;
    } catch {
      return false;
    }
  }

  private emitRoomUpdate(room: GameRoom, type: string, message: string): void {
    for (const [socketId, info] of this.clients) {
      if (this.isBoundMember(info, room)) {
        this.server.to(socketId).emit('room_updated', {
          type,
          room: this.gameRoomService.serializeRoom(room, info.playerId),
          message,
        });
      }
    }
  }

  private emitBombBustersStateToAll(room: GameRoom, message: string, event = 'bomb_busters_state_updated'): void {
    for (const [socketId, info] of this.clients) {
      if (this.isBoundMember(info, room)) {
        const playerRoom = this.gameRoomService.serializeRoom(room, info.playerId);
        this.server.to(socketId).emit(event, {
          room: playerRoom,
          gameState: playerRoom.gameState,
          message,
        });
      }
    }
  }

  private findSocketIdByPlayerId(playerId: string): string | null {
    for (const [socketId, info] of this.clients.entries()) {
      if (info.playerId === playerId) {
        return socketId;
      }
    }
    return null;
  }

  private emitKrakenStateToAll(roomId: string, room: any, message: string, event: string = 'kraken_state_updated', lastRevealedCard?: any) {
    const krakenState = this.krakenLogicService.deserializeState(room.gameState);

    for (const [socketId, info] of this.clients.entries()) {
      if (info.roomId === roomId && info.playerId) {
        const playerView = this.krakenLogicService.getPlayerView(krakenState, info.playerId);
        if (lastRevealedCard) playerView.lastRevealedCard = lastRevealedCard;
        this.server.to(socketId).emit(event, {
          room: { ...this.gameRoomService.serializeRoom(room), gameState: playerView },
          gameState: playerView,
          message
        });
      }
    }
  }
}
