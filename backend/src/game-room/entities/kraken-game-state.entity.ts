export type KrakenRole = 'explorer' | 'skeleton';
export type KrakenCardType = 'empty' | 'treasure' | 'kraken';
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

export interface KrakenCard {
  id: string;
  type: KrakenCardType;
}

export interface RevealedCard {
  cardType: KrakenCardType;
  revealedBy: string;       // playerId who chose to reveal
  revealedFrom: string;     // playerId whose card was revealed
  round: number;
}

export interface KrakenPlayer {
  id: string;
  name: string;
  role: KrakenRole;
  cards: KrakenCard[];              // Server-only: actual card array with positions
  knownCardTypes: KrakenCardType[]; // Card composition the player knows (unordered)
}

export interface ChatMessage {
  id: string;
  playerId: string;
  playerName: string;
  text: string;
  timestamp: number;
  isSystem: boolean;
}

export type KrakenGamePhase = 'selecting' | 'discussing' | 'revealing' | 'round-end' | 'finished';

export class KrakenGameState {
  players: Map<string, KrakenPlayer>;
  playerOrder: string[];            // Turn order for action marker
  currentRound: number;             // 1~4
  actionsThisRound: number;
  totalActionsPerRound: number;     // = player count
  actionMarkerHolder: string;       // playerId
  gamePhase: KrakenGamePhase;
  revealedCards: RevealedCard[];     // All revealed cards (public info)
  selectedCard?: { targetPlayerId: string; cardIndex: number };
  winner?: 'explorers' | 'skeletons' | 'all-lose';
  winReason?: string;
  chatMessages: ChatMessage[];
  allRoles: KrakenRole[];           // All roles dealt (including unused), hidden until game end

  constructor() {
    this.players = new Map();
    this.playerOrder = [];
    this.currentRound = 1;
    this.actionsThisRound = 0;
    this.totalActionsPerRound = 0;
    this.actionMarkerHolder = '';
    this.gamePhase = 'selecting';
    this.revealedCards = [];
    this.chatMessages = [];
    this.allRoles = [];
  }

  toJSON(): any {
    return {
      players: Array.from(this.players.entries()).map(([id, player]) => [id, {
        id: player.id,
        name: player.name,
        role: player.role,
        cards: player.cards,
        knownCardTypes: player.knownCardTypes,
      }]),
      playerOrder: this.playerOrder,
      currentRound: this.currentRound,
      actionsThisRound: this.actionsThisRound,
      totalActionsPerRound: this.totalActionsPerRound,
      actionMarkerHolder: this.actionMarkerHolder,
      gamePhase: this.gamePhase,
      revealedCards: this.revealedCards,
      selectedCard: this.selectedCard,
      winner: this.winner,
      winReason: this.winReason,
      chatMessages: this.chatMessages,
      allRoles: this.allRoles,
    };
  }

  static fromJSON(data: any): KrakenGameState {
    const state = new KrakenGameState();
    state.players = new Map(
      data.players.map(([id, p]: [string, any]) => [id, {
        id: p.id,
        name: p.name,
        role: p.role,
        cards: p.cards,
        knownCardTypes: p.knownCardTypes,
      }])
    );
    state.playerOrder = data.playerOrder;
    state.currentRound = data.currentRound;
    state.actionsThisRound = data.actionsThisRound;
    state.totalActionsPerRound = data.totalActionsPerRound;
    state.actionMarkerHolder = data.actionMarkerHolder;
    state.gamePhase = data.gamePhase;
    state.revealedCards = data.revealedCards || [];
    state.selectedCard = data.selectedCard;
    state.winner = data.winner;
    state.winReason = data.winReason;
    state.chatMessages = data.chatMessages || [];
    state.allRoles = data.allRoles || [];
    return state;
  }
}
