// 숨은 동물 찾기: 서버의 getHiddenPlayerView 가 돌려주는 플레이어 시점 상태

// 서버 엔진과 같은 순서. 일반 동물은 카드가 덜 필요하면 뒤에서부터 빠진다.
export const HIDDEN_NORMALS = ['raccoon', 'deer', 'rabbit', 'squirrel', 'fox', 'woodpecker', 'cuckoo', 'owl', 'bear'] as const;
export const HIDDEN_SPECIALS = ['badger', 'parrot', 'monkey', 'snake'] as const;
export type HiddenSpecial = typeof HIDDEN_SPECIALS[number];
export type HiddenAnimal = typeof HIDDEN_NORMALS[number] | HiddenSpecial;
export type HiddenCard = HiddenAnimal | 'empty';
/** peek = 은신처 2곳 엿보기, clue = 단서 토큰 놓기, guess = 최종 추리, reveal = 라운드 정답 공개 */
export type HiddenPhase = 'peek' | 'clue' | 'guess' | 'reveal' | 'finished';

export const HIDDEN_ANIMAL_LABEL: Record<HiddenAnimal, string> = {
  raccoon: '너구리', deer: '사슴', rabbit: '토끼', squirrel: '다람쥐', fox: '여우',
  woodpecker: '딱따구리', cuckoo: '뻐꾸기', owl: '부엉이', bear: '곰',
  badger: '오소리', parrot: '앵무새', monkey: '원숭이', snake: '뱀',
};
export const HIDDEN_ANIMAL_EMOJI: Record<HiddenAnimal, string> = {
  raccoon: '🦝', deer: '🦌', rabbit: '🐰', squirrel: '🐿️', fox: '🦊',
  woodpecker: '🐦', cuckoo: '🐤', owl: '🦉', bear: '🐻',
  badger: '🦡', parrot: '🦜', monkey: '🐒', snake: '🐍',
};
/** 특수 동물의 효과 한 줄 설명 */
export const HIDDEN_SPECIAL_EFFECT: Record<HiddenSpecial, string> = {
  badger: '너구리와 닮아서, 본 사람은 너구리 토큰으로 위장해 놓을 수 있어요.',
  parrot: '본 사람은 직전 사람이 놓은 최신 단서 토큰을 가져와 따라 놓을 수 있어요.',
  monkey: '1번 나무에 숨으면 빈 은신처처럼 아무 토큰이나 놓을 수 있어요.',
  snake: '4번 덤불에 숨으면 빈 은신처처럼 아무 토큰이나 놓을 수 있어요.',
};

/** 방장이 고르는 난이도 */
export interface HiddenOptions {
  level: number;              // 0~4 = 넣는 특수 동물 수
  random: boolean;            // Lv.2·3 에서만: 비공개 무작위
  specials: HiddenSpecial[];  // 직접 고른 특수 동물
}
export const HIDDEN_DEFAULT_OPTIONS: HiddenOptions = { level: 0, random: false, specials: [] };
export const HIDDEN_LEVEL_NAMES = ['입문', '초급', '중급', '상급', '전문가'];

export function hiddenHideoutCount(playerCount: number): number {
  return playerCount <= 3 ? 6 : playerCount <= 5 ? 7 : 8;
}
export function hiddenAnimalCount(playerCount: number): number {
  return playerCount >= 6 ? 10 : 9;
}
export function hiddenNormalsFor(playerCount: number, level: number): HiddenAnimal[] {
  return HIDDEN_NORMALS.slice(0, Math.min(HIDDEN_NORMALS.length, hiddenAnimalCount(playerCount) - level));
}

export interface HiddenHideoutView {
  index: number;
  name: string;
  tokens: HiddenAnimal[];        // 이 은신처 위에 놓인 공용 단서 토큰
  locked: boolean;               // 토큰 2개 = 잠김(엿볼 수 없음)
  eye: boolean;                  // 눈 토큰: 가장 최근에 엿본 곳
  card: HiddenCard | null;       // 정답. 라운드 공개 전에는 null
  known: HiddenCard | null;      // 내가 직접 엿본 카드 (나에게만)
}

export interface HiddenTurnRecord {
  playerId: string;
  peeked: number[];
  animal: HiddenAnimal;
  from: number | null;           // null = 대기석
  to: number;
}

export interface HiddenRoundResult {
  round: number;
  hideouts: HiddenCard[];
  removed: HiddenCard[];
  specials: HiddenSpecial[];
  tokens: Partial<Record<HiddenAnimal, number | null>>;
  boards: Record<string, (HiddenAnimal | null)[]>;
  correct: Record<string, boolean[]>;
  scores: Record<string, number>;
}

export interface HiddenPlayerView {
  id: string;
  name: string;
  total: number;
  roundScores: number[];
  turnsTaken: number;
  submitted: boolean;
  isMe: boolean;
}

export interface HiddenStanding { playerId: string; name: string; total: number; lastRound: number; rank: number; winner: boolean }

/** 내 단서 차례에 고를 수 있는 토큰과 그 이유 */
export interface HiddenClueInfo {
  animals: HiddenAnimal[];
  any: ('empty' | 'monkey' | 'snake')[];   // 아무 토큰이나 놓을 수 있게 된 이유
  disguise: boolean;                       // 오소리 → 너구리 토큰 위장 가능
  copy: HiddenAnimal | null;               // 앵무새 → 따라 놓을 수 있는 직전 단서
}

export interface HiddenClientState {
  phase: HiddenPhase;
  round: number;
  totalRounds: number;
  currentPlayerId: string | null;
  turnOrder: string[];
  turnPos: number;
  animals: HiddenAnimal[];       // 이번 라운드의 단서·추리 토큰 종류
  options: HiddenOptions;
  deck: { hideouts: number; animals: number; removed: number; specials: HiddenSpecial[] | null };  // specials null = 비공개
  hideouts: HiddenHideoutView[];
  eyesBy: string | null;         // 눈 토큰을 놓은 사람
  eyesNow: boolean;              // 눈 토큰이 지금 진행 중인 턴의 것인가
  lastClue: { playerId: string; animal: HiddenAnimal; to: number } | null;   // 직전 턴의 최신 단서
  reserve: HiddenAnimal[];
  removed: HiddenCard[] | null;
  peekable: number[];            // 내 탐색 차례에 엿볼 수 있는 은신처
  mySeen: { slot: number; card: HiddenCard }[] | null;   // 내 단서 차례에만: 엿본 카드
  clue: HiddenClueInfo | null;   // 내 단서 차례에만
  board: (HiddenAnimal | null)[] | null;   // 내 개인 추리판
  submitted: boolean;
  history: HiddenTurnRecord[];
  lastResult: HiddenRoundResult | null;
  standings: HiddenStanding[] | null;
  log: string[];
  result: { message: string; type?: 'info' | 'error' } | null;
  myId: string | null;
  players: HiddenPlayerView[];
}

export type HiddenAction =
  | { type: 'peek'; slots: number[] }
  | { type: 'clue'; animal: HiddenAnimal; to: number }
  | { type: 'set_board'; slot: number; animal: HiddenAnimal | null }
  | { type: 'submit_guess' }
  | { type: 'unsubmit_guess' }
  | { type: 'next_round' };
