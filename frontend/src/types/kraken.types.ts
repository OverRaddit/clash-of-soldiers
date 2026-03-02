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

export const PLAYER_COLORS = [
  '#4fc3f7', '#ff7043', '#66bb6a', '#ab47bc',
  '#ffd54f', '#ef5350', '#26c6da', '#ec407a',
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

export interface KrakenOtherPlayer {
  id: string;
  name: string;
  cardCount: number;
  role?: KrakenRole; // Only at game end
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
  winner?: 'explorers' | 'skeletons' | 'all-lose';
  winReason?: string;
  allPlayersWithRoles?: KrakenPlayerWithRole[];
  lastRevealedCard?: LastRevealedCardInfo;
}
