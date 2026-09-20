export type BombWireValue = number | 'yellow' | 'red';

export interface BombClientWire {
  id: string;
  value: BombWireValue | null;
  sortValue: number | null;
  cut: boolean;
  hint: BombWireValue | null;
  clue?: { kind: 'value' | 'parity' | 'count' | 'not'; value: BombWireValue | 'odd' | 'even' };
  reversed?: boolean;
  excluded?: boolean;
  singleLabel?: boolean;
}

export interface BombClientPlayer {
  id: string;
  name: string;
  racks: { id: string; wires: BombClientWire[] }[];
  initialHintPlaced: boolean;
  detectorUsed: boolean;
  personalEquipmentId?: 0 | 2 | 3 | 8 | 10;
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
  equipment: boolean;
  rules?: string[];
  equipmentCount?: number;
  redCandidateMax?: number;
  yellowCandidateMax?: number;
  equipmentExcluded?: number[];
}

/** Server-resolved setup for the room's current player count. */
export interface BombMissionCatalogEntry extends BombMission {
  minPlayers?: number;
  maxPlayers?: number;
  supported?: boolean;
}

export interface BombEquipment {
  id: number;
  name: string;
  description: string;
  unlocked: boolean;
  used: boolean;
  unlock?: { value: BombWireValue; count: number };
}

export interface BombCampaignControl {
  id: string;
  label: string;
  description?: string;
  values?: BombWireValue[];
  cards?: { id: string; label: string }[];
  cardSelection?: { min: number; max: number };
  playerIds?: string[];
  wireSelection?: { owner: 'self' | 'others' | 'all'; min: number; max: number; counts?: number[]; allowCut?: boolean; onlyCut?: boolean };
  directions?: string[];
  rackIds?: string[];
}

export interface BombBunkerView {
  floor: 'ground' | 'basement';
  position: [number, number];
  constraints: Record<'north' | 'east' | 'south' | 'west' | 'action', string>;
  stage: string;
  doorOpen: boolean;
  guardNeutralized: boolean;
  laserDisabled: boolean;
  doctorHandcuffed: boolean;
  map: {
    cells: { at: [number, number]; type: string; striped?: boolean }[];
    walls: [[number, number], [number, number]][];
    gates: [[number, number], [number, number]][];
  };
}

export interface BombAudioView {
  title: string;
  instructions: string[];
  sourceUrl: string;
  stepIndex: number;
  stepCount: number;
  status: 'ready' | 'running' | 'paused' | 'complete';
  deadlineAt?: number;
  pendingActorId?: string;
  controls: BombCampaignControl[];
  targetNumbers: number[];
  validationTokensRemoved?: boolean;
  hideCutCounts?: boolean;
  removedCutWireIds?: string[];
  remainingSeconds?: number;
  speechRule?: string;
  bunker?: Omit<BombBunkerView, 'map'> & { map: Record<'ground' | 'basement', BombBunkerView['map']> };
}

export interface BombCampaignPanel {
  redValues?: BombWireValue[];
  bunker?: BombBunkerView;
  audio?: BombAudioView;
  title: string;
  description: string;
  counters: { label: string; value: number | string; max?: number }[];
  cards: { id: string; label: string; description?: string; ownerId?: string; active?: boolean }[];
  controls: BombCampaignControl[];
  pendingActorId?: string;
  deadlineAt?: number;
  flashClues?: { wireId: string; clue: NonNullable<BombClientWire['clue']>; expiresAt: number }[];
}

export interface BombBustersClientState {
  feedback?: { id: string; kind: 'success' | 'failure' };
  serverNow?: number;
  campaign?: BombCampaignPanel;
  phase: 'setup' | 'playing' | 'finished';
  mission: BombMission;
  players: BombClientPlayer[];
  captainId: string;
  currentPlayerId: string;
  mistakes: number;
  maxMistakes: number;
  turnNumber: number;
  outcome: 'won' | 'lost' | null;
  endReason: string | null;
  redMarkers: number[];
  yellowMarkers: number[];
  equipment: BombEquipment[];
  stabilizerActive: boolean;
  superDetectorActive: boolean;
  tripleDetectorActive: boolean;
  xyRayActive?: boolean;
  pendingExchange?: {
    actorId: string;
    targetPlayerId: string;
    selectedPlayerIds: string[];
    ownSelectedWireId?: string;
  } | null;
  relationMarkers?: { id: string; playerId: string; rackId: string; wireIds: string[]; relation: 'equal' | 'different' }[];
  lastExchange?: { wireId: string; fromPlayerId: string; fromRackId: string; fromIndex: number; toPlayerId: string; toRackId: string; toIndex: number }[];
  radarResults?: { value: number; racks: { playerId: string; rackId: string; present: boolean }[] }[];
  pendingDetector: {
    actorId: string;
    targetPlayerId: string;
    targetWireIds: string[];
    guess: BombWireValue;
    kind?: 'detector' | 'xy';
    guesses?: BombWireValue[];
    eligibleWireIds?: string[];
  } | null;
  log: string[];
  cutCounts: Record<string, number>;
}

export type BombBustersAction =
  | { type: 'hint'; wireId: string }
  | { type: 'dual'; ownWireId: string; targetPlayerId: string; targetWireIds: string[]; useDetector?: boolean; alternativeWireId?: string; guess?: BombWireValue }
  | { type: 'resolve_detector'; wireId: string }
  | { type: 'exchange_wire'; wireId: string }
  | { type: 'solo'; value: BombWireValue }
  | { type: 'reveal_red' }
  | { type: 'cancel_equipment' }
  | { type: 'mission'; operation: string; value?: BombWireValue; cardId?: string; cardIds?: string[]; targetPlayerId?: string; wireIds?: string[]; direction?: string; rackId?: string }
  | { type: 'equipment'; personal?: boolean; rackId?: string; equipmentId: number; targetPlayerId?: string; targetPlayerIds?: string[]; wireIds?: string[]; value?: BombWireValue };
