import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn } from 'typeorm';

export enum GameRoomStatus {
  WAITING = 'waiting',
  PLAYING = 'playing',
  FINISHED = 'finished',
}

@Entity()
export class GameRoom {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  name: string;

  @Column({
    type: 'enum',
    enum: GameRoomStatus,
    default: GameRoomStatus.WAITING,
  })
  status: GameRoomStatus;

  @Column({ default: 2 })
  maxPlayers: number;

  @Column({ default: 0 })
  currentPlayers: number;

  @Column('json', { nullable: true })
  players: string[];

  @Column('json', { nullable: true })
  gameState: any;

  @CreateDateColumn()
  createdAt: Date;

  @UpdateDateColumn()
  updatedAt: Date;
}