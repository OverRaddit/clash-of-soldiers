import type { BombWire, BombWireValue } from '../entities/bomb-busters-game-state.entity';
import type { BombMissionControl } from './campaign-state';
import type { BombBunkerState } from './campaign-bunker';

export interface BombAudioPending {
  kind: 'ack' | 'magician' | 'juggler' | 'transfer' | 'red_rack' | 'yellow_rescue' | 'move' | 'boing' | 'laser_hint';
  actorId: string;
  remainingMoves?: number;
  success?: boolean;
  value?: BombWireValue;
  queue?: string[];
  wireIds?: string[];
}
export interface BombAudioState {
  missionId: number;
  stepIndex: number;
  status: 'ready' | 'running' | 'paused' | 'complete';
  deadlineAt: number | null;
  pending: BombAudioPending | null;
  numberDeck: number[];
  targets: number[];
  reserveRed: BombWire[];
  mutedIds: string[];
  taDaRequired: boolean;
  lastCutActorId: string | null;
  lastCutAnnounced: boolean;
  validationTokensRemoved: boolean;
  processedTurn: number;
  repeatPlayerId: string | null;
  notices: string[];
  removedCutWireIds?: string[];
  hideCutCounts?: boolean;
  bunker?: BombBunkerState;
}
export interface BombAudioView {
  title: string;
  instructions: string[];
  sourceUrl: string;
  stepIndex: number;
  stepCount: number;
  status: BombAudioState['status'];
  deadlineAt?: number;
  pendingActorId?: string;
  controls: BombMissionControl[];
  targetNumbers: number[];
  speechRule?: string;
  validationTokensRemoved?: boolean;
  hideCutCounts?: boolean;
  removedCutWireIds?: string[];
  bunker?: BombBunkerState & { map: Record<string, unknown> };
}
