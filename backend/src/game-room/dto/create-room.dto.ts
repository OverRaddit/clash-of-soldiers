import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max, IsIn } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  roomName: string;

  @IsString()
  @IsNotEmpty()
  hostId: string;

  @IsOptional()
  @IsNumber()
  @Min(2)
  @Max(8)
  maxPlayers?: number = 2;

  @IsOptional()
  @IsString()
  @IsIn(['toy-battle', 'no-touch-kraken'])
  gameType?: string = 'toy-battle';
}
