// 동물들의 숨바꼭질: 서버의 getHidePlayerView 가 돌려주는 플레이어 시점 상태

export type HideAnimal = 'lion' | 'rabbit' | 'fox' | 'bear' | 'owl' | 'squirrel' | 'penguin' | 'elephant' | 'crocodile';
export type HideCard = HideAnimal | 'empty';
/** peek = 은신처 2곳 엿보기, clue = 단서 토큰 놓기, guess = 최종 추리, reveal = 라운드 정답 공개 */
export type HidePhase = 'peek' | 'clue' | 'guess' | 'reveal' | 'finished';

export interface HideHideoutView {
  index: number;
  name: string;
  tokens: HideAnimal[];          // 이 은신처 위에 놓인 공용 단서 토큰
  locked: boolean;               // 토큰 2개 = 잠김(엿볼 수 없음)
  peeking: boolean;              // 현재 차례인 사람이 이번 턴에 엿본 곳
  card: HideCard | null;         // 정답. 라운드 공개 전에는 null
  known: HideCard | null;        // 내가 직접 엿본 카드 (나에게만)
}

export interface HideTurnRecord {
  playerId: string;
  peeked: number[];
  animal: HideAnimal;
  from: number | null;           // null = 대기석
  to: number;
}

export interface HideRoundResult {
  round: number;
  hideouts: HideCard[];
  removed: HideCard[];
  tokens: Record<HideAnimal, number | null>;
  boards: Record<string, (HideAnimal | null)[]>;
  correct: Record<string, boolean[]>;
  scores: Record<string, number>;
}

export interface HidePlayerView {
  id: string;
  name: string;
  total: number;
  roundScores: number[];
  turnsTaken: number;
  submitted: boolean;
  isMe: boolean;
}

export interface HideStanding { playerId: string; name: string; total: number; lastRound: number; rank: number; winner: boolean }

export interface HideClientState {
  phase: HidePhase;
  round: number;
  totalRounds: number;
  currentPlayerId: string | null;
  turnOrder: string[];
  turnPos: number;
  animals: HideAnimal[];
  hideouts: HideHideoutView[];
  reserve: HideAnimal[];
  removed: HideCard[] | null;
  peekable: number[];            // 내 탐색 차례에 엿볼 수 있는 은신처
  clueAnimals: HideAnimal[];     // 내 단서 차례에 고를 수 있는 토큰
  board: (HideAnimal | null)[] | null;   // 내 개인 추리판
  submitted: boolean;
  history: HideTurnRecord[];
  lastResult: HideRoundResult | null;
  standings: HideStanding[] | null;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  myId: string | null;
  players: HidePlayerView[];
}

export type HideAction =
  | { type: 'peek'; slots: number[] }
  | { type: 'clue'; animal: HideAnimal; to: number }
  | { type: 'set_board'; slot: number; animal: HideAnimal | null }
  | { type: 'submit_guess' }
  | { type: 'unsubmit_guess' }
  | { type: 'next_round' };
