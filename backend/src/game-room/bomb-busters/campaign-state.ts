import type { BombAudioView } from './audio-state';
import { BombWire, BombWireValue } from '../entities/bomb-busters-game-state.entity';
import { BombConstraintId } from './rule-cards';
import { BombChallengeTurn } from './campaign-challenges';

export interface BombClue { kind: 'value' | 'parity' | 'count' | 'not'; value: BombWireValue | 'odd' | 'even'; }
export interface BombMissionControl {
  id: string; label: string; description?: string;
  values?: BombWireValue[];
  cards?: { id: string; label: string }[];
  cardSelection?: { min: number; max: number };
  playerIds?: string[];
  rackIds?: string[];
  wireSelection?: { owner: 'self' | 'others' | 'all'; min: number; max: number; counts?: number[]; allowCut?: boolean; onlyCut?: boolean };
  directions?: string[];
}
export interface BombCampaignView {
  title: string; description: string;
  counters: { label: string; value: string | number; max?: number }[];
  cards: { id: string; label: string; description?: string; ownerId?: string; active?: boolean }[];
  controls: BombMissionControl[];
  pendingActorId?: string;
  deadlineAt?: number;
  flashClues?: { wireId: string; clue: BombClue; expiresAt: number }[];
  redValues?: BombWireValue[];
  audio?: BombAudioView;
}

export interface BombMissionCommand {
  type: 'mission'; operation: string; value?: BombWireValue; cardId?: string; cardIds?: string[];
  targetPlayerId?: string; wireIds?: string[]; direction?: string; rackId?: string;
}

export interface BombCampaignPending {
  actorId: string; operation: string; queue?: string[]; value?: number; values?: number[];
  returnPlayerId?: string; selection?: string; selectedPlayerId?: string;
}

export interface BombTurnContext {
  actorId: string; kind: BombChallengeTurn['kind']; value: BombWireValue | null;
  uncutIds: string[]; mistakesBefore: number; redOnlyBefore?: boolean;
  reversedOwn?: boolean; declaredValue?: BombWireValue; forcedFailure?: boolean;
  effectsApplied?: boolean;
}

export interface BombCampaignState {
  missionId: number;
  pending: BombCampaignPending | null;
  turn: BombTurnContext | null;
  history: BombChallengeTurn[];
  numberDeck: number[];
  numbers: number[];
  usedNumbers: number[];
  targetValue: number | null;
  requiredValue: number | null;
  directorId: string | null;
  playerNumbers: Record<string, number[]>;
  constraints: Record<string, BombConstraintId | null>;
  constraintDeck: BombConstraintId[];
  globalConstraint: BombConstraintId | null;
  constraintsByNumber: Record<number, BombConstraintId>;
  passedPlayers: string[];
  secretRoleId: string | null;
  secretRevealed: boolean;
  challenges: number[];
  challengeNumbers: number[];
  completedChallenges: number[];
  equipmentDeck: number[];
  nano: { position: number; direction: 1 | -1; reserve: BombWire[] } | null;
  oxygen: Record<string, number>;
  oxygenPool: number;
  selectedPersonal: string[];
  absentClues: Record<string, BombWireValue[]>;
  sideClues: Record<string, BombClue[]>;
  savedHintQueue: string[];
  yellowRewardDone: boolean;
  specialComplete: boolean;
  deadlineAt: number | null;
  timerStarted: boolean;
  memoryPreview: boolean;
  sequenceDirection: 'left' | 'right';
  constraintSwapAvailable: boolean;
  prediction: number | null;
  predictionOwnerId: string | null;
  round: number;
  setupTasks: BombCampaignPending[];
  pendingAfterTurn: boolean;
  personalChoicesComplete: boolean;
  personalDisabledForever: boolean;
  rotationSlots: (BombConstraintId | null)[];
  rewardValues: BombWireValue[];
  flashClues?: { wireId: string; clue: BombClue; expiresAt: number }[];
}
