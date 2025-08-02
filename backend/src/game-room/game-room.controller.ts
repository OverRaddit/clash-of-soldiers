import {
  Controller,
  Post,
  Get,
  Body,
  Param,
  Delete,
  Patch,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { GameRoomService } from './game-room.service';
import { GameLogicService } from './game-logic.service';
import { CreateRoomDto } from './dto/create-room.dto';
import { JoinRoomDto } from './dto/join-room.dto';
import { GameState } from './entities/game-state.entity';

@Controller('game-rooms')
export class GameRoomController {
  constructor(
    private readonly gameRoomService: GameRoomService,
    private readonly gameLogicService: GameLogicService
  ) {}

  @Post()
  createRoom(@Body() createRoomDto: CreateRoomDto) {
    try {
      const room = this.gameRoomService.createRoom(createRoomDto);
      return {
        success: true,
        data: room.toJSON(),
        message: '방이 성공적으로 생성되었습니다.',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':roomId/join')
  joinRoom(@Param('roomId') roomId: string, @Body() joinRoomDto: JoinRoomDto) {
    try {
      joinRoomDto.roomId = roomId;
      const room = this.gameRoomService.joinRoom(joinRoomDto);
      return {
        success: true,
        data: room.toJSON(),
        message: '방에 성공적으로 참여했습니다.',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Delete(':roomId/leave/:playerId')
  leaveRoom(
    @Param('roomId') roomId: string,
    @Param('playerId') playerId: string
  ) {
    try {
      const room = this.gameRoomService.leaveRoom(roomId, playerId);
      return {
        success: true,
        data: room?.toJSON() || null,
        message: '방에서 나갔습니다.',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Patch(':roomId/ready/:playerId')
  toggleReady(
    @Param('roomId') roomId: string,
    @Param('playerId') playerId: string
  ) {
    try {
      const room = this.gameRoomService.toggleReady(roomId, playerId);
      return {
        success: true,
        data: room.toJSON(),
        message: '준비 상태가 변경되었습니다.',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':roomId/start')
  startGame(@Param('roomId') roomId: string, @Body() body: { hostId: string }) {
    try {
      const room = this.gameRoomService.startGame(roomId, body.hostId);

      // 게임 로직 초기화
      const playerIds = room.players.map((p) => p.id);
      const playerNames = room.players.map((p) => p.name);
      const gameState = this.gameLogicService.initializeGame(
        playerIds,
        playerNames
      );

      // 방에 게임 상태 저장
      room.gameState = gameState.toJSON();

      return {
        success: true,
        data: room.toJSON(),
        message: '게임이 시작되었습니다.',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Get(':roomId')
  getRoom(@Param('roomId') roomId: string) {
    try {
      const room = this.gameRoomService.getRoom(roomId);
      if (!room) {
        throw new HttpException(
          { success: false, message: '방을 찾을 수 없습니다.' },
          HttpStatus.NOT_FOUND
        );
      }

      return {
        success: true,
        data: room.toJSON(),
      };
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      throw new HttpException(
        { success: false, message: '서버 오류가 발생했습니다.' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  @Get()
  getAllRooms() {
    try {
      const rooms = this.gameRoomService.getAllRooms();
      return {
        success: true,
        data: rooms.map((room) => room.toJSON()),
        count: rooms.length,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: '서버 오류가 발생했습니다.' },
        HttpStatus.INTERNAL_SERVER_ERROR
      );
    }
  }

  // 게임 진행 중 액션들
  @Post(':roomId/game/draw')
  drawSoldiers(
    @Param('roomId') roomId: string,
    @Body() body: { playerId: string }
  ) {
    try {
      const room = this.gameRoomService.getRoom(roomId);
      if (!room || !room.gameState) {
        throw new Error('게임을 찾을 수 없습니다.');
      }

      // GameState 복원
      const gameState = GameState.fromJSON(room.gameState);

      if (gameState.currentTurn !== body.playerId) {
        throw new Error('현재 턴이 아닙니다.');
      }

      const success = this.gameLogicService.drawTwoSoldiers(
        gameState,
        body.playerId
      );
      if (!success) {
        throw new Error('병정을 뽑을 수 없습니다.');
      }

      // 턴 변경
      this.gameLogicService.nextTurn(gameState);

      // 상태 저장
      room.gameState = gameState.toJSON();

      return {
        success: true,
        data: room.toJSON(),
        message: '병정 2개를 뽑았습니다.',
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }

  @Post(':roomId/game/place')
  placeSoldier(
    @Param('roomId') roomId: string,
    @Body()
    body: {
      playerId: string;
      soldierIndex: number;
      targetVertex: string;
    }
  ) {
    try {
      const room = this.gameRoomService.getRoom(roomId);
      if (!room || !room.gameState) {
        throw new Error('게임을 찾을 수 없습니다.');
      }

      // GameState 복원
      const gameState = GameState.fromJSON(room.gameState);

      if (gameState.currentTurn !== body.playerId) {
        throw new Error('현재 턴이 아닙니다.');
      }

      const result = this.gameLogicService.placeSoldier(
        gameState,
        body.playerId,
        body.soldierIndex,
        body.targetVertex
      );

      if (!result.success) {
        throw new Error(result.reason || '병정을 배치할 수 없습니다.');
      }

      // 2번 병정(캡틴) 효과가 아닌 경우 턴 변경
      const player = gameState.players.get(body.playerId);
      const placedSoldier = gameState.vertices
        .get(body.targetVertex)
        ?.soldiers.slice(-1)[0];

      if (!placedSoldier || placedSoldier.type !== 2) {
        this.gameLogicService.nextTurn(gameState);
      }

      // 상태 저장
      room.gameState = gameState.toJSON();

      let message = '병정을 배치했습니다.';
      if (result.medalAwarded && result.medalAwarded > 0) {
        message += ` 승점 ${result.medalAwarded}점을 획득했습니다!`;
      }
      if (result.gameEnded) {
        message += ' 게임이 종료되었습니다!';
        room.status = 'finished';
      }

      return {
        success: true,
        data: room.toJSON(),
        message,
        medalAwarded: result.medalAwarded,
        gameEnded: result.gameEnded,
      };
    } catch (error) {
      throw new HttpException(
        { success: false, message: error.message },
        HttpStatus.BAD_REQUEST
      );
    }
  }
}
