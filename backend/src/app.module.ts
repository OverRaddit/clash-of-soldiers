import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GameRoomModule } from './game-room/game-room.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
    }),
    GameRoomModule,
  ],
})
export class AppModule {}