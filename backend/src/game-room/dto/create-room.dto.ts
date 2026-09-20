import { IsString, IsNotEmpty, IsOptional, IsInt, Min, Max, IsIn } from 'class-validator';

export class CreateRoomDto {
  @IsString()
  @IsNotEmpty()
  roomName: string;

  @IsString()
  @IsNotEmpty()
  hostId: string;

  @IsOptional()
  @IsInt()
  @Min(2)
  @Max(8)
  maxPlayers?: number;

  @IsOptional()
  @IsString()
  @IsIn(['toy-battle', 'no-touch-kraken', 'bomb-busters'])
  gameType?: string = 'toy-battle';
}
