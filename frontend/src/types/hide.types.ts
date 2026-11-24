// 동물들의 숨바꼭질: 서버의 getHidePlayerView 가 돌려주는 플레이어 시점 상태

// 서버 엔진의 ANIMALS 와 같은 순서. 고양이(특수 동물)가 맨 앞이고, 동물 수를 줄이면 뒤에서부터 빠진다.
export const HIDE_ANIMALS = ['cat', 'bear', 'owl', 'rabbit', 'fox', 'squirrel', 'penguin', 'elephant', 'crocodile', 'lion'] as const;
export type HideAnimal = typeof HIDE_ANIMALS[number];
export const HIDE_ANIMAL_LABEL: Record<HideAnimal, string> = {
  cat: '고양이', bear: '곰', owl: '부엉이', rabbit: '토끼', fox: '여우',
  squirrel: '다람쥐', penguin: '펭귄', elephant: '코끼리', crocodile: '악어', lion: '사자',
};
export const HIDE_ANIMAL_EMOJI: Record<HideAnimal, string> = {
  cat: '🐱', bear: '🐻', owl: '🦉', rabbit: '🐰', fox: '🦊',
  squirrel: '🐿️', penguin: '🐧', elephant: '🐘', crocodile: '🐊', lion: '🦁',
};

/** 방장이 고르는 카드 구성 */
export interface HideOptions {
  cat: boolean;         // 고양이 포함 여부
  animalCount: number;  // 동물 카드 수 (고양이 포함)
  emptyCount: number;   // 빈 은신처 카드 수
}
export const HIDE_HIDEOUT_COUNT = 7;
export const HIDE_DEFAULT_OPTIONS: HideOptions = { cat: true, animalCount: 9, emptyCount: 1 };
export const HIDE_OPTION_LIMITS = { minAnimals: 4, maxAnimals: HIDE_ANIMALS.length, maxEmpty: 3 };
export function hideMaxAnimalCount(cat: boolean): number {
  return cat ? HIDE_OPTION_LIMITS.maxAnimals : HIDE_OPTION_LIMITS.maxAnimals - 1;
}
export function hideAnimalsInPlay(options: HideOptions): HideAnimal[] {
  const normal = HIDE_ANIMALS.filter((animal) => animal !== 'cat');
  return options.cat ? ['cat', ...normal.slice(0, options.animalCount - 1)] : normal.slice(0, options.animalCount);
}
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
  swapped: boolean | null;       // 고양이가 자리를 바꿨는가. null = 아직 모름(본인이 아니고 라운드 공개 전)
}

export interface HideRoundResult {
  round: number;
  hideouts: HideCard[];
  removed: HideCard[];
  tokens: Partial<Record<HideAnimal, number | null>>;
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
  animals: HideAnimal[];         // 이 판에 쓰는 동물
  options: HideOptions;
  deck: { animals: number; empty: number; removed: number };
  hideouts: HideHideoutView[];
  reserve: HideAnimal[];
  removed: HideCard[] | null;
  peekable: number[];            // 내 탐색 차례에 엿볼 수 있는 은신처
  clueAnimals: HideAnimal[];     // 내 단서 차례에 고를 수 있는 토큰
  mySeen: { slot: number; card: HideCard }[] | null;   // 내 단서 차례에만: 엿본 순간의 카드
  mySwapped: boolean;            // 내 단서 차례에만: 고양이가 두 카드의 자리를 바꿨는가
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
