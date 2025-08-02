import { Module } from '@nestjs/common';
import { GameRoomService } from './game-room.service';
import { GameRoomController } from './game-room.controller';
import { GameLogicService } from './game-logic.service';
import { GameRoomGateway } from './game-room.gateway';

@Module({
  controllers: [GameRoomController],
  providers: [GameRoomService, GameLogicService, GameRoomGateway],
})
export class GameRoomModule {}