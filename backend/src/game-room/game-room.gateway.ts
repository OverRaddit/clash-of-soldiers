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
import { GameState } from './entities/game-state.entity';

interface ClientInfo {
  playerId: string;
  roomId?: string;
}

interface DisconnectedClient {
  playerId: string;
  roomId: string;
  disconnectTime: Date;
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
export class GameRoomGateway implements OnGatewayConnection, OnGatewayDisconnect {
  @WebSocketServer()
  server: Server;

  private clients: Map<string, ClientInfo> = new Map();
  private disconnectedClients: Map<string, DisconnectedClient> = new Map();
  private reconnectTimeout = 30 * 1000; // 30초

  constructor(
    private readonly gameRoomService: GameRoomService,
    private readonly gameLogicService: GameLogicService,
  ) {}

  handleConnection(client: Socket) {
    console.log(`Client connected: ${client.id}`);
  }

  handleDisconnect(client: Socket) {
    console.log(`Client disconnected: ${client.id}`);
    
    const clientInfo = this.clients.get(client.id);
    if (clientInfo?.roomId && clientInfo?.playerId) {
      // 즉시 방에서 제거하지 않고 재연결 대기 목록에 추가
      this.disconnectedClients.set(clientInfo.playerId, {
        playerId: clientInfo.playerId,
        roomId: clientInfo.roomId,
        disconnectTime: new Date()
      });

      // 소켓 룸에서 나가기
      client.leave(clientInfo.roomId);

      // 30초 후 재연결이 없으면 방에서 제거
      setTimeout(() => {
        const disconnectedClient = this.disconnectedClients.get(clientInfo.playerId);
        if (disconnectedClient && disconnectedClient.roomId === clientInfo.roomId) {
          try {
            // 재연결이 없었으므로 방에서 제거
            const room = this.gameRoomService.leaveRoom(clientInfo.roomId, clientInfo.playerId);
            
            // 방이 존재하면 다른 플레이어들에게 알림
            if (room) {
              this.server.to(clientInfo.roomId).emit('room_updated', {
                type: 'player_left',
                room: room.toJSON(),
                message: `플레이어가 연결 해제되어 나갔습니다.`
              });
            } else {
              console.log(`방이 삭제됨: ${clientInfo.roomId}`);
            }
          } catch (error) {
            console.error('지연된 연결 해제 처리 중 오류:', error);
          }
          
          this.disconnectedClients.delete(clientInfo.playerId);
        }
      }, this.reconnectTimeout);

      // 다른 플레이어들에게 일시적 연결 해제 알림
      this.server.to(clientInfo.roomId).emit('room_updated', {
        type: 'player_disconnected',
        room: this.gameRoomService.getRoom(clientInfo.roomId)?.toJSON(),
        message: `${clientInfo.playerId}님의 연결이 일시적으로 끊어졌습니다.`
      });
    }
    
    this.clients.delete(client.id);
  }

  @SubscribeMessage('join_room')
  handleJoinRoom(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; playerId: string; playerName: string }
  ) {
    try {
      // 기존 방에서 나가기
      const existingInfo = this.clients.get(client.id);
      if (existingInfo?.roomId) {
        client.leave(existingInfo.roomId);
      }

      // 재연결인지 확인
      const disconnectedClient = this.disconnectedClients.get(data.playerId);
      const isReconnecting = disconnectedClient && disconnectedClient.roomId === data.roomId;

      // 새 방 참여
      const room = this.gameRoomService.joinRoom({
        roomId: data.roomId,
        playerId: data.playerId,
        playerName: data.playerName
      });

      // 재연결인 경우 대기 목록에서 제거
      if (isReconnecting) {
        this.disconnectedClients.delete(data.playerId);
      }

      // 클라이언트 정보 저장
      this.clients.set(client.id, {
        playerId: data.playerId,
        roomId: data.roomId
      });

      // 소켓 룸 참여
      client.join(data.roomId);

      // 방 전체에 업데이트 알림
      this.server.to(data.roomId).emit('room_updated', {
        type: isReconnecting ? 'player_reconnected' : 'player_joined',
        room: room.toJSON(),
        message: isReconnecting 
          ? `${data.playerName}님이 재연결했습니다.` 
          : `${data.playerName}님이 입장했습니다.`
      });

      // 참여한 클라이언트에 성공 응답
      client.emit('join_room_success', {
        room: room.toJSON(),
        playerId: data.playerId
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
      const room = this.gameRoomService.leaveRoom(data.roomId, data.playerId);
      
      // 소켓 룸에서 나가기
      client.leave(data.roomId);
      
      // 클라이언트 정보 업데이트
      const clientInfo = this.clients.get(client.id);
      if (clientInfo) {
        clientInfo.roomId = undefined;
      }

      // 방이 존재하면 다른 플레이어들에게 알림
      if (room) {
        this.server.to(data.roomId).emit('room_updated', {
          type: 'player_left',
          room: room.toJSON(),
          message: `플레이어가 나갔습니다.`
        });
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
      const room = this.gameRoomService.toggleReady(data.roomId, data.playerId);
      
      this.server.to(data.roomId).emit('room_updated', {
        type: 'ready_changed',
        room: room.toJSON(),
        message: '준비 상태가 변경되었습니다.'
      });

    } catch (error) {
      client.emit('toggle_ready_error', {
        message: error.message
      });
    }
  }

  @SubscribeMessage('start_game')
  handleStartGame(
    @ConnectedSocket() client: Socket,
    @MessageBody() data: { roomId: string; hostId: string }
  ) {
    try {
      const room = this.gameRoomService.startGame(data.roomId, data.hostId);
      
      // 게임 로직 초기화
      const playerIds = room.players.map(p => p.id);
      const playerNames = room.players.map(p => p.name);
      const gameState = this.gameLogicService.initializeGame(playerIds, playerNames);
      
      // 방에 게임 상태 저장
      room.gameState = gameState.toJSON();

      this.server.to(data.roomId).emit('game_started', {
        room: room.toJSON(),
        gameState: gameState.toJSON(),
        message: '게임이 시작되었습니다!'
      });

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
      const room = this.gameRoomService.getRoom(data.roomId);
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
      const room = this.gameRoomService.getRoom(data.roomId);
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
      const room = this.gameRoomService.getRoom(data.roomId);
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
      const room = this.gameRoomService.getRoom(data.roomId);
      if (!room) {
        throw new Error('방을 찾을 수 없습니다.');
      }

      client.emit('room_state', {
        room: room.toJSON()
      });

    } catch (error) {
      client.emit('get_room_state_error', {
        message: error.message
      });
    }
  }
}