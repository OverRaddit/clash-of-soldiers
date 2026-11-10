// 가챠: 서버의 getGachaPlayerView 가 돌려주는 플레이어 시점 상태

export type GachaKind = 'A' | 'B' | 'C' | 'D';
export type GachaPhase = 'setup' | 'stocking' | 'pulling' | 'trading' | 'finished';

export interface GachaCard { id: string; kind: GachaKind }
export type GachaTradeItem = { type: 'coin' } | { type: 'card'; kind: GachaKind };
export interface GachaFavorites { first: GachaKind; second: GachaKind }
export type GachaKindCounts = Record<GachaKind, number>;

export interface GachaOffer {
  id: number;
  from: string;
  to: string;
  give: GachaTradeItem;
  want: GachaTradeItem;
}

export interface GachaPullRecord { round: number; playerId: string; kind: GachaKind }

export interface GachaMe {
  coins: number;
  hand: GachaCard[];
  kindCounts: GachaKindCounts;
  favorites: GachaFavorites | null;
  setupCards: GachaCard[];
  drawn: GachaCard[];
  isOwner: boolean;
  pullDone: boolean;
  tradeDone: boolean;
}

export interface GachaPlayerView {
  id: string;
  name: string;
  isMe: boolean;
  coins: number;
  handCount: number;
  pulled: GachaCard[];
  chosen: boolean;
  pullDone: boolean;
  tradeDone: boolean;
  ownerOrder: number;
  favorites: GachaFavorites | null;
  kindCounts: GachaKindCounts | null;
}

export interface GachaStanding {
  playerId: string;
  name: string;
  score: number;
  breakdown: { first: number; second: number; coins: number; setBonus: number };
  favorites: GachaFavorites;
  kindCounts: GachaKindCounts;
  coins: number;
  ownerOrder: number;
  rank: number;
}

export interface GachaClientState {
  phase: GachaPhase;
  round: number;
  totalRounds: number;
  ownerId: string | null;
  currentPlayerId: string | null;
  deckCount: number;
  machineCount: number;
  drawnCount: number;
  offers: GachaOffer[];
  pullHistory: GachaPullRecord[];
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  standings: GachaStanding[] | null;
  myId: string | null;
  me: GachaMe | null;
  players: GachaPlayerView[];
}

export type GachaAction =
  | { type: 'choose'; first: GachaKind; second: GachaKind }
  | { type: 'stock'; cardIds: string[] }
  | { type: 'pull'; slot: number }
  | { type: 'pass' }
  | { type: 'offer'; to: string; give: GachaTradeItem; want: GachaTradeItem }
  | { type: 'cancel'; offerId: number }
  | { type: 'accept'; offerId: number }
  | { type: 'decline'; offerId: number }
  | { type: 'done' };
