export type KrakenRole = 'explorer' | 'skeleton';
export type KrakenCardType = 'empty' | 'treasure' | 'kraken';
export type KrakenGamePhase = 'selecting' | 'discussing' | 'revealing' | 'round-end' | 'finished';
export type PingType = 'treasure' | 'kraken' | 'avoid';

export interface CardPing {
  pingerId: string;
  pingerName: string;
  targetPlayerId: string;
  cardIndex: number;
  pingType: PingType;
  color: string;
  timestamp: number;
}

export interface LastRevealedCardInfo {
  cardType: KrakenCardType;
  revealedBy: string;
  revealedFrom: string;
  cardIndex: number;
}

/** Seat colours = the Crux hold palette (blue, orange, green, purple, yellow, red, teal, pink). */
export const PLAYER_COLORS = [
  '#2d72c9', '#e2731f', '#27804a', '#6f49b8',
  '#efc132', '#c5302b', '#286f78', '#cc2b68',
];

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

export interface RevealedCard {
  cardType: KrakenCardType;
  revealedBy: string;
  revealedFrom: string;
  round: number;
}

export interface PlayerClaim {
  treasureCount: number;
  hasKraken: boolean;
}

export interface KrakenOtherPlayer {
  id: string;
  name: string;
  cardCount: number;
  role?: KrakenRole; // Only at game end
  claim?: PlayerClaim;
}

export interface KrakenPlayerWithRole {
  id: string;
  name: string;
  role: KrakenRole;
}

export interface KrakenClientState {
  myRole: KrakenRole;
  myKnownCardTypes: KrakenCardType[];
  myCardCount: number;
  otherPlayers: KrakenOtherPlayer[];
  revealedCards: RevealedCard[];
  currentRound: number;
  actionsThisRound: number;
  totalActionsPerRound: number;
  actionMarkerHolder: string;
  gamePhase: KrakenGamePhase;
  selectedCard?: { targetPlayerId: string; cardIndex: number };
  chatMessages: ChatMessage[];
  myClaim?: PlayerClaim;
  winner?: 'explorers' | 'skeletons' | 'all-lose';
  winReason?: string;
  allPlayersWithRoles?: KrakenPlayerWithRole[];
  lastRevealedCard?: LastRevealedCardInfo;
}
