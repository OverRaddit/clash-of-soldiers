/** Public catalog data. The host picks a chapter before a game begins. */
export interface FellowshipChapterPreview {
  number: number;
  title: string;
  mode: 'short' | 'long' | 'special';
  characters: string[];
  required: string[];
  summary?: string;
}

export interface FellowshipCard {
  id: string;
  suit?: string;
  rank?: number;
  name?: string;
  faceDown?: boolean;
  row?: number;
  col?: number;
  covered?: boolean;
}

export interface FellowshipCharacter {
  id: string;
  name: string;
  nameKo?: string;
  objective: string;
  setup?: string | string[];
  required?: boolean;
  selectedBy?: string;
}

export interface FellowshipPlayerView {
  id: string;
  name: string;
  controllerId?: string;
  characterId?: string;
  characterName?: string;
  handCount: number;
  wonTricks: number;
  wonCards?: FellowshipCard[];
  objective?: string;
  goal?: string;
  objectiveStatus?: 'pending' | 'complete' | 'failed';
  objectiveComplete?: boolean;
  isDummy?: boolean;
  faceUpHand?: FellowshipCard[];
  revealedHand?: boolean;
  threatChoice?: number | number[];
  curses?: string[];
  gifts?: string[];
}

export interface FellowshipTrickPlay {
  seatId?: string;
  playerId?: string;
  card: FellowshipCard;
  trump?: boolean;
}

export interface FellowshipTrickHistory {
  number: number;
  leaderSeatId: string;
  leadSuit: string;
  winnerSeatId?: string;
  plays: FellowshipTrickPlay[];
  eventCard?: FellowshipCard;
  balrogCards?: FellowshipCard[];
}

/** Setup requests are server-authored and only sent to the player who can respond. */
export interface FellowshipPendingAction {
  type: string;
  playerId?: string;
  seatId?: string;
  prompt?: string;
  characterId?: string;
  targetPlayerId?: string;
  targetSeatIds?: string[];
  count?: number;
  choices?: Array<{ id: string; label: string; action?: Record<string, unknown> }>;
  options?: Array<{ id: string; label: string; action?: Record<string, unknown> }>;
  [key: string]: unknown;
}

export interface FellowshipResult {
  success?: boolean;
  title?: string;
  message?: string;
  reason?: string;
  failedSeatIds?: string[];
  objectives?: Array<{ playerId: string; characterName?: string; success: boolean; detail?: string }>;
  [key: string]: unknown;
}

/**
 * This is the player's view, never the full server game state. In particular,
 * `hand` contains only this connection's cards.
 */
export interface FellowshipClientState {
  phase: 'event_selection' | 'character_selection' | 'setup' | 'play' | 'round_end' | 'chapter_complete';
  chapter: { number: number; title: string; titleKo?: string; victory?: string; mode?: string; summary?: string };
  round?: number;
  players: FellowshipPlayerView[];
  hand: FellowshipCard[];
  handsBySeat?: Record<string, FellowshipCard[]>;
  legalCardsBySeat?: Record<string, string[]>;
  offerableCardsBySeat?: Record<string, string[]>;
  tuckedBySeat?: Record<string, FellowshipCard | null>;
  legalCards?: string[];
  availableCharacters?: FellowshipCharacter[];
  currentTurn?: string | null;
  currentLeader?: string | null;
  trick?: FellowshipTrickPlay[];
  history?: FellowshipTrickHistory[];
  lostCards?: FellowshipCard[];
  eventCard?: FellowshipCard | null;
  balrogCards?: FellowshipCard[];
  announcements?: string[];
  ringTokenActive?: boolean;
  pendingAction?: FellowshipPendingAction | null;
  result?: FellowshipResult | null;
  completedCharacters?: string[];
  completedEvents?: string[];
  completedGroups?: string[];
  currentEvent?: string;
  canPassLead?: boolean;
  message?: string;
  [key: string]: unknown;
}

export type FellowshipAction =
  | { type: 'select_character'; characterId: string }
  | { type: 'setup_choice'; choiceId?: string; cardId?: string; targetSeatId?: string; cardsBySeat?: Record<string, string>; cardIds?: string[]; trump?: boolean }
  | { type: 'choose_event'; eventId: string }
  | { type: 'choose_group'; groupId: string }
  | { type: 'play_card'; cardId: string; trump?: boolean }
  | { type: 'use_gift'; giftId?: string; accept?: boolean }
  | { type: 'untuck' }
  | { type: 'pass_lead'; targetSeatId: string }
  | { type: 'next_round' };
