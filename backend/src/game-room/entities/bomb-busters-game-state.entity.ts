import type { BombAudioState } from '../bomb-busters/audio-state';
import type { BombCampaignState, BombCampaignView, BombClue, BombMissionCommand } from '../bomb-busters/campaign-state';

export type BombWireValue = number | 'yellow' | 'red';
export type BombBustersPhase = 'setup' | 'playing' | 'finished';

export interface BombWire {
  id: string;
  value: BombWireValue;
  sortValue: number;
  cut: boolean;
  hint: BombWireValue | null;
  clue?: BombClue;
  reversed?: boolean;
  excluded?: boolean;
  singleLabel?: boolean;
}

export interface BombRack {
  id: string;
  wires: BombWire[];
}

export interface BombPlayer {
  id: string;
  name: string;
  racks: BombRack[];
  initialHintPlaced: boolean;
  detectorUsed: boolean;
  personalEquipmentId?: number;
}

export interface BombMission {
  id: number;
  name: string;
  description: string;
  blueMax: number;
  redCount: number;
  yellowCount: number;
  redCandidateCount: number;
  yellowCandidateCount: number;
  /** Candidate values are 1.1/1.5 up to (max - 1).1/.5. */
  redCandidateMax?: number;
  yellowCandidateMax?: number;
  equipmentExcluded?: number[];
  equipment: boolean;
}

export interface BombEquipment {
  id: number;
  name: string;
  description: string;
  unlocked: boolean;
  used: boolean;
  /** Card identity and its unlock requirement are independent. */
  unlock?: { value: BombWireValue; count: number };
}

export interface BombDetectorChoice {
  actorId: string;
  targetPlayerId: string;
  ownWireId: string;
  targetWireIds: string[];
  guess: BombWireValue;
  eligibleWireIds: string[];
  success: boolean;
  kind?: 'detector' | 'xy';
  guesses?: BombWireValue[];
  alternativeWireId?: string;
}

export interface BombExchange {
  actorId: string;
  targetPlayerId: string;
  /** Server only: a submitted wire is hidden until both parties have selected. */
  selections: Record<string, string>;
}

export interface BombRelationMarker {
  id: string;
  playerId: string;
  rackId: string;
  wireIds: [string, string];
  relation: 'equal' | 'different';
}

export interface BombRadarResult {
  value: number;
  racks: { playerId: string; rackId: string; present: boolean }[];
}

export interface BombExchangeMove {
  wireId: string;
  fromPlayerId: string;
  fromRackId: string;
  fromIndex: number;
  toPlayerId: string;
  toRackId: string;
  toIndex: number;
}

/** Latest committed action result, intentionally free of wire identities or values. */
export interface BombFeedback {
  id: string;
  kind: 'success' | 'failure';
}

/** Wire positions from the latest resolved turn; the view filters hidden clues. */
export interface BombLastTurn {
  cutWireIds: string[];
  clueWireIds: string[];
}

export interface BombPreparedEquipment {
  equipmentId: 3 | 5 | 9 | 10;
  playerId: string;
  personal: boolean;
}

export interface BombBustersState {
  phase: BombBustersPhase;
  mission: BombMission;
  players: BombPlayer[];
  captainId: string;
  currentPlayerId: string;
  mistakes: number;
  maxMistakes: number;
  turnNumber: number;
  outcome: 'won' | 'lost' | null;
  feedback?: BombFeedback;
  lastTurn?: BombLastTurn;
  endReason: string | null;
  redMarkers: number[];
  yellowMarkers: number[];
  equipment: BombEquipment[];
  stabilizerActive: boolean;
  superDetectorActive: boolean;
  tripleDetectorActive: boolean;
  pendingDetector: BombDetectorChoice | null;
  xyRayActive: boolean;
  preparedEquipment?: BombPreparedEquipment[];
  pendingExchange: BombExchange | null;
  relationMarkers: BombRelationMarker[];
  radarResults: BombRadarResult[];
  lastExchange: BombExchangeMove[];
  campaign?: BombCampaignState;
  audio?: BombAudioState;
  log: string[];
}

export type BombBustersAction =
  | { type: 'hint'; wireId: string }
  | { type: 'dual'; ownWireId: string; alternativeWireId?: string; guess?: BombWireValue; targetPlayerId: string; targetWireIds: string[]; useDetector?: boolean }
  | { type: 'resolve_detector'; wireId: string }
  | { type: 'exchange_wire'; wireId: string }
  | { type: 'cancel_equipment' }
  | { type: 'solo'; value: BombWireValue }
  | { type: 'reveal_red' }
  | { type: 'equipment'; equipmentId: number; personal?: boolean; targetPlayerId?: string; targetPlayerIds?: string[]; wireIds?: string[]; value?: BombWireValue; rackId?: string }
  | BombMissionCommand;

export interface BombClientWire {
  id: string;
  value: BombWireValue | null;
  sortValue: number | null;
  cut: boolean;
  hint: BombWireValue | null;
  clue?: BombClue;
  reversed?: boolean;
  excluded?: boolean;
  singleLabel?: boolean;
}

/** Public DTO is deliberately enumerated: future server secrets must not leak by spread. */
export interface BombBustersClientState {
  serverNow: number;
  phase: BombBustersPhase;
  mission: BombMission;
  captainId: string;
  currentPlayerId: string;
  mistakes: number;
  maxMistakes: number;
  turnNumber: number;
  outcome: 'won' | 'lost' | null;
  feedback?: BombFeedback;
  lastTurn?: BombLastTurn;
  endReason: string | null;
  redMarkers: number[];
  yellowMarkers: number[];
  equipment: BombEquipment[];
  stabilizerActive: boolean;
  superDetectorActive: boolean;
  tripleDetectorActive: boolean;
  xyRayActive: boolean;
  preparedEquipment?: BombPreparedEquipment[];
  pendingExchange: {
    actorId: string; targetPlayerId: string; selectedPlayerIds: string[]; ownSelectedWireId?: string;
  } | null;
  relationMarkers: BombRelationMarker[];
  radarResults: BombRadarResult[];
  lastExchange: BombExchangeMove[];
  log: string[];
  campaign?: BombCampaignView;
  players: (Omit<BombPlayer, 'racks'> & { racks: { id: string; wires: BombClientWire[] }[] })[];
  pendingDetector: {
    actorId: string; targetPlayerId: string; targetWireIds: string[]; guess: BombWireValue;
    kind?: 'detector' | 'xy'; guesses?: BombWireValue[]; eligibleWireIds?: string[];
  } | null;
  cutCounts: Record<string, number>;
}
