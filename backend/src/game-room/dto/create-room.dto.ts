import { IsString, IsNotEmpty, IsOptional, IsNumber, Min, Max } from 'class-validator';

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
  @Max(2)
  maxPlayers?: number = 2;
}