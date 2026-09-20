import { Module } from '@nestjs/common';
import { GameRoomService } from './game-room.service';
import { GameRoomController } from './game-room.controller';
import { GameLogicService } from './game-logic.service';
import { KrakenLogicService } from './kraken-logic.service';
import { GameRoomGateway } from './game-room.gateway';
import { BombBustersLogicService } from './bomb-busters-logic.service';

@Module({
  controllers: [GameRoomController],
  providers: [GameRoomService, GameLogicService, KrakenLogicService, BombBustersLogicService, GameRoomGateway],
})
export class GameRoomModule {}
