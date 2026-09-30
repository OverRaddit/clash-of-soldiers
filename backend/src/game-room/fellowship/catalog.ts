/**
 * Data for the 18 chapters of the base Fellowship trick-taking game.
 * The Korean descriptions paraphrase card mechanics; they do not reproduce story/card prose.
 * Source page numbers refer to OlimarAlpha, Unofficial Fan Guide v1.05 (PDF pages 1–46).
 * The official rulebook remains authoritative if a fan-guide clarification conflicts with it.
 */

export type FellowshipSuit = 'hills' | 'mountains' | 'shadows' | 'forests' | 'rings' | 'rivers';
export type FellowshipVictoryMode = 'short' | 'long' | 'special';

/** Machine-readable rule. The engine interprets `kind`; `description` is for the UI. */
export interface RuleEffect {
  kind: string;
  params?: Record<string, any>;
  description: string;
}

export type GoalDefinition = RuleEffect;

export interface CharacterFace {
  setupActions: RuleEffect[];
  goal: GoalDefinition;
  abilities?: RuleEffect[];
}

export interface CharacterDefinition extends CharacterFace {
  id: string;
  cardNumber: string;
  name: string;
  nameKo: string;
  /** Another card with this identity may be a valid exchange target. */
  alias?: string;
  goalByPlayerCount?: Record<number, GoalDefinition>;
  burdened?: CharacterFace;
  sourcePage: number;
}

export interface FellowshipCardDefinition {
  id: string;
  cardNumber: string;
  name: string;
  nameKo: string;
  effects: RuleEffect[];
  sourcePage: number;
}

export interface ThreatDefinition {
  id: string;
  cardNumber: string;
  family: 'black-rider' | 'threat';
  value: number;
}

export interface ChapterRound {
  id: string;
  characters: string[];
  required: string[];
  burdened?: string[];
  event?: string;
  /** Some rounds override a character's normal goal. */
  goalOverrides?: Record<string, GoalDefinition>;
}

export interface ChapterDefinition {
  number: number;
  title: string;
  titleKo: string;
  mode: FellowshipVictoryMode;
  characters: string[];
  required: string[];
  optional?: string[];
  threats: string[];
  events?: string[];
  gifts?: { id: string; recipient: string; requiredActivation?: boolean }[];
  setup?: RuleEffect[];
  rounds?: ChapterRound[];
  goalOverrides?: Record<string, GoalDefinition>;
  summary: string;
  sourcePage: number;
}

const rule = (kind: string, description: string, params?: Record<string, any>): RuleEffect =>
  ({ kind, description, ...(params ? { params } : {}) });

const threatDraw = (count = 1, choose = 1): RuleEffect =>
  rule('draw_threat', '위협 카드를 뽑아 목표값으로 사용합니다.', { count, choose, redrawIfLostTarget: true });
const exchange = (targets: string[] | 'any', count = 1, simultaneous = false): RuleEffect =>
  rule('exchange', '지정된 상대와 카드를 교환합니다.', { targets, count, simultaneous });
const leadFirst = (): RuleEffect => rule('lead_first', '첫 트릭을 선도합니다.');
const addLost = (all = false): RuleEffect =>
  rule('add_lost_cards', '유실 카드를 손패에 넣습니다. 마지막에 남은 카드는 사용하지 않습니다.', { all });
const targetSuit = (suit: FellowshipSuit): GoalDefinition =>
  rule('target_suit_rank', `위협값과 같은 숫자의 ${suit} 카드를 획득합니다.`, { suit, rankSource: 'threat', minimum: 1 });
const trickMin = (minimum: number): GoalDefinition =>
  rule('trick_count_min', `트릭 ${minimum}회 이상 승리합니다.`, { minimum });
const trickExact = (exact: number): GoalDefinition =>
  rule('trick_count_exact', `트릭을 정확히 ${exact}회 승리합니다.`, { exact });

// Card list and mechanics: fan guide pp. 4–5, 14–36, 45.
export const CHARACTERS: Record<string, CharacterDefinition> = {
  frodo: {
    id: 'frodo', cardNumber: '1.02', name: 'Frodo', nameKo: '프로도', sourcePage: 14,
    setupActions: [rule('requires_ring_one_holder', '반지 1을 받은 플레이어만 선택할 수 있습니다.'),
      rule('forbid_exchange_card', '반지 1은 교환할 수 없습니다.', { cardId: 'rings-1' }), leadFirst()],
    goal: rule('rings_count', '반지 카드 4장 이상을 획득합니다.', { minimum: 4 }),
    goalByPlayerCount: { 4: rule('rings_count', '4인에서는 반지 카드 2장 이상을 획득합니다.', { minimum: 2 }) },
  },
  bilbo: {
    id: 'bilbo', cardNumber: '1.03', name: 'Bilbo', nameKo: '빌보', sourcePage: 14,
    setupActions: [], goal: trickMin(3),
  },
  gandalf: {
    id: 'gandalf', cardNumber: '1.04', name: 'Gandalf', nameKo: '간달프', sourcePage: 14,
    setupActions: [addLost(), exchange(['frodo'])], goal: trickMin(1),
  },
  pippin: {
    id: 'pippin', cardNumber: '1.05', name: 'Pippin', nameKo: '피핀', sourcePage: 14,
    setupActions: [exchange(['frodo', 'sam', 'merry'])],
    goal: rule('fewest_tricks', '승리 트릭 수가 가장 적으면 됩니다. 동률도 허용됩니다.', { allowTie: true }),
  },
  sam: {
    id: 'sam', cardNumber: '2.02', name: 'Sam', nameKo: '샘', sourcePage: 15,
    setupActions: [threatDraw(), exchange(['frodo', 'merry', 'pippin'])], goal: targetSuit('hills'),
  },
  merry: {
    id: 'merry', cardNumber: '2.03', name: 'Merry', nameKo: '메리', sourcePage: 15,
    setupActions: [exchange(['frodo', 'sam', 'pippin'])],
    goal: rule('trick_count_range', '트릭을 1~2회 승리합니다.', { minimum: 1, maximum: 2 }),
  },
  gildor: {
    id: 'gildor', cardNumber: '2.09', name: 'Gildor Inglorion', nameKo: '길도르 잉글로리온', sourcePage: 16,
    setupActions: [exchange(['frodo'])],
    goal: rule('last_trick_play_suit', '마지막 트릭에 숲 카드를 냅니다.', { suit: 'forests' }),
  },
  farmer_maggot: {
    id: 'farmer_maggot', cardNumber: '2.10', name: 'Farmer Maggot', nameKo: '농부 매것', sourcePage: 16,
    setupActions: [threatDraw(), exchange(['merry', 'pippin'])],
    goal: rule('target_rank_count', '위협값과 같은 숫자의 카드를 2장 이상 획득합니다.', { rankSource: 'threat', minimum: 2 }),
  },
  fatty_bolger: {
    id: 'fatty_bolger', cardNumber: '2.12', name: 'Fatty Bolger', nameKo: '뚱보 볼저', sourcePage: 17,
    setupActions: [rule('donate_to_all', '다른 모든 플레이어에게 손패를 한 장씩 줍니다. 교환이 아닙니다.', { perTarget: 1 }),
      rule('solo_fixed_hand', '1인에서는 처음에 9장을 받고 이후 보충을 받지 않습니다.', { playerCount: 1, handSize: 9 })],
    goal: trickExact(1),
  },
  tom_bombadil: {
    id: 'tom_bombadil', cardNumber: '2.16', name: 'Tom Bombadil', nameKo: '톰 봄바딜', sourcePage: 18,
    setupActions: [addLost(true), exchange(['frodo'])],
    goal: rule('retained_suit_set_count', '획득한 카드 중 3장 이상이 마지막 손패에 남은 카드 한 장과 같은 문양이어야 합니다.', { minimum: 3, retainedSameSuit: true }),
  },
  goldberry: {
    id: 'goldberry', cardNumber: '2.19', name: 'Goldberry', nameKo: '골드베리', sourcePage: 19,
    setupActions: [rule('reveal_hand', '2~4인에서는 손패를 공개합니다.', { playerCounts: [2, 3, 4] }),
      rule('solo_fixed_hand', '1인에서는 처음에 완전한 손패를 받고 이후 보충받지 않습니다.', { playerCount: 1, chapterSixSize: 8 })],
    goal: rule('consecutive_tricks_exact', '연속 트릭을 정확히 3회 승리합니다.', { exact: 3 }),
  },
  mr_underhill: {
    id: 'mr_underhill', cardNumber: '2.21', name: 'Mr. Underhill', nameKo: '언더힐 씨', sourcePage: 20,
    setupActions: [leadFirst()],
    goal: rule('ring_only_trick_wins', '반지 카드가 포함된 트릭을 1회 이상 이기고, 반지가 없는 트릭은 이기지 않습니다.', { minimum: 1, forbiddenWithoutSuit: 'rings' }),
  },
  barliman: {
    id: 'barliman', cardNumber: '2.22', name: 'Barliman Butterbur', nameKo: '바를리먼 버터버', sourcePage: 20,
    setupActions: [exchange('any')],
    goal: rule('late_trick_win', '마지막 세 트릭 중 하나 이상을 승리합니다.', { finalTrickWindow: 3, minimum: 1 }),
  },
  strider: {
    id: 'strider', cardNumber: '2.24', name: 'Strider', nameKo: '스트라이더', sourcePage: 21,
    setupActions: [threatDraw(), rule('declare_comparison', '위협값보다 트릭을 많이 또는 적게 이길지 선언합니다.', { choices: ['more', 'fewer'] }), exchange(['frodo'])],
    goal: rule('trick_count_vs_threat', '선언한 방향으로 위협값과 자신의 승리 트릭 수를 비교합니다.', { thresholdSource: 'threat', comparisonSource: 'declaration', strict: true }),
  },
  glorfindel: {
    id: 'glorfindel', cardNumber: '2.28', name: 'Glorfindel', nameKo: '글로르핀델', sourcePage: 22,
    setupActions: [addLost(), exchange('any', 1, true), leadFirst()],
    goal: rule('suit_card_count_exact', '그림자 카드 8장을 모두 획득합니다.', { suit: 'shadows', exact: 8 }),
  },
  bill_pony: {
    id: 'bill_pony', cardNumber: '2.29', name: 'Bill the Pony', nameKo: '조랑말 빌', sourcePage: 23,
    setupActions: [exchange(['frodo', 'sam'], 1, true)], goal: trickExact(1),
  },
  elrond: {
    id: 'elrond', cardNumber: '2.35', name: 'Elrond', nameKo: '엘론드', sourcePage: 24,
    setupActions: [rule('simultaneous_donate_right', '모든 플레이어가 오른쪽 이웃에게 한 장씩 동시에 줍니다.', { count: 1 }), leadFirst()],
    goal: rule('all_players_rings', '모든 플레이어가 반지 카드 한 장 이상을 획득합니다.', { minimum: 1 }),
  },
  arwen: {
    id: 'arwen', cardNumber: '2.36', name: 'Arwen', nameKo: '아르웬', sourcePage: 24,
    setupActions: [exchange(['elrond', 'aragorn'])],
    goal: rule('most_suit_cards', '숲 카드 획득 수가 단독 최다여야 합니다.', { suit: 'forests', allowTie: false }),
  },
  gloin: {
    id: 'gloin', cardNumber: '2.37', name: 'Glóin', nameKo: '글로인', sourcePage: 24,
    setupActions: [exchange(['bilbo', 'gimli'])],
    goal: rule('most_suit_cards', '산 카드 획득 수가 단독 최다여야 합니다.', { suit: 'mountains', allowTie: false }),
  },
  bilbo_baggins: {
    id: 'bilbo_baggins', cardNumber: '2.38', name: 'Bilbo Baggins', nameKo: '빌보 배긴스', alias: 'bilbo', sourcePage: 24,
    setupActions: [],
    goal: rule('trick_count_min', '트릭 3회 이상을 이기되 반지 1은 획득하지 않습니다.', { minimum: 3, forbiddenCardIds: ['rings-1'] }),
    abilities: [rule('pass_lead', '선 플레이 차례에 다른 플레이어에게 선을 넘길 수 있습니다.')],
  },
  aragorn: {
    id: 'aragorn', cardNumber: '2.40', name: 'Aragorn', nameKo: '아라고른', sourcePage: 25,
    setupActions: [rule('choose_threat', '위협 카드의 목표값을 선택합니다.', { count: 1 }), exchange('any')],
    goal: rule('trick_count_exact_threat', '선택한 위협값만큼 정확히 트릭을 승리합니다.', { countSource: 'threat' }),
  },
  boromir: {
    id: 'boromir', cardNumber: '2.41', name: 'Boromir', nameKo: '보로미르', sourcePage: 25,
    setupActions: [exchange('any'), rule('exclude_exchange_target', '프로도와는 교환할 수 없습니다.', { targets: ['frodo'] })],
    goal: rule('last_trick_win', '마지막 트릭을 승리하되 반지 1은 획득하지 않습니다.', { forbiddenCardIds: ['rings-1'] }),
  },
  gwaihir: {
    id: 'gwaihir', cardNumber: '2.46', name: 'Gwaihir', nameKo: '그와이히르', sourcePage: 26,
    setupActions: [exchange(['gandalf'], 2)],
    goal: rule('tricks_with_suit_min', '산 카드가 포함된 트릭을 2회 이상 승리합니다.', { suit: 'mountains', minimum: 2 }),
  },
  shadowfax: {
    id: 'shadowfax', cardNumber: '2.47', name: 'Shadowfax', nameKo: '섀도우팩스', sourcePage: 26,
    setupActions: [rule('tuck_card', '손패 한 장을 카드 아래에 보관했다가 트릭 전에 꺼낼 수 있습니다.', { count: 1 })],
    goal: rule('tricks_with_suit_min', '언덕 카드가 포함된 트릭을 2회 이상 승리합니다.', { suit: 'hills', minimum: 2 }),
  },
  radagast: {
    id: 'radagast', cardNumber: '2.48', name: 'Radagast', nameKo: '라다가스트', sourcePage: 26,
    setupActions: [rule('precommit_last_card', '마지막 트릭에 낼 카드 한 장을 따로 둡니다.'),
      rule('preplay_first_card', '첫 트릭에 낼 카드를 미리 놓습니다. 이 카드는 선 문양을 정하지 않습니다.')],
    goal: rule('tricks_with_suit_min', '숲 카드가 포함된 트릭을 2회 이상 승리합니다.', { suit: 'forests', minimum: 2 }),
  },
  legolas: {
    id: 'legolas', cardNumber: '3.09', name: 'Legolas', nameKo: '레골라스', sourcePage: 28,
    setupActions: [threatDraw(), exchange(['gimli', 'aragorn'])], goal: targetSuit('forests'),
  },
  gimli: {
    id: 'gimli', cardNumber: '3.10', name: 'Gimli', nameKo: '김리', sourcePage: 28,
    setupActions: [threatDraw(), exchange(['legolas', 'aragorn'])], goal: targetSuit('mountains'),
  },
  gandalf_fire: {
    id: 'gandalf_fire', cardNumber: '3.17', name: 'Gandalf, Servant of the Secret Fire', nameKo: '간달프, 비밀의 불꽃의 종', alias: 'gandalf', sourcePage: 30,
    setupActions: [addLost(true)], goal: rule('none', '개인 목표가 없습니다.'),
    abilities: [rule('ignore_follow_suit', '문양 따르기 의무를 무시합니다.'),
      rule('lead_rings_anytime', '반지 문양을 언제든 선으로 낼 수 있습니다.')],
  },
  orophin_rumil: {
    id: 'orophin_rumil', cardNumber: '3.21', name: 'Orophin & Rúmil', nameKo: '오로핀과 루밀', sourcePage: 31,
    setupActions: [threatDraw(), exchange(['haldir']), leadFirst()], goal: targetSuit('forests'),
  },
  haldir: {
    id: 'haldir', cardNumber: '3.22', name: 'Haldir', nameKo: '할디르', sourcePage: 31,
    setupActions: [threatDraw(), exchange('any'), rule('exclude_exchange_target', '김리와는 교환하지 않습니다.', { targets: ['gimli'] })],
    goal: targetSuit('forests'),
  },
  galadriel: {
    id: 'galadriel', cardNumber: '3.25', name: 'Galadriel', nameKo: '갈라드리엘', sourcePage: 32,
    setupActions: [rule('exchange_lost_or_character', '유실 카드 또는 간달프와 교환합니다.', { targets: ['lost', 'gandalf'] })],
    goal: rule('middle_trick_count', '트릭 승리 수가 단독 최다도 단독 최소도 아니어야 합니다.', { tiesAllowed: false }),
  },
  celeborn: {
    id: 'celeborn', cardNumber: '3.26', name: 'Celeborn', nameKo: '켈레보른', sourcePage: 32,
    setupActions: [exchange('any')],
    goal: rule('same_rank_count', '같은 숫자의 카드를 3장 이상 획득합니다.', { minimum: 3 }),
  },
};

// The seven gold cards (pp. 34–36) have normal fronts and altered reverse faces.
const goldCards: Array<{ id: string; cardNumber: string; name: string; nameKo: string; base: string; page: number; burdened: CharacterFace }> = [
  { id: 'samwise', cardNumber: '3.39', name: 'Samwise Gamgee', nameKo: '샘와이즈 갬지', base: 'sam', page: 34,
    burdened: { setupActions: [threatDraw()], goal: rule('multi_target_suit_rank', '위협값의 언덕·그림자 카드를 모두 획득합니다.', { suits: ['hills', 'shadows'], rankSource: 'threat' }),
      abilities: [rule('count_rings_for_frodo', '샘와이즈가 획득한 반지 카드는 프로도 목표에도 더합니다.', { character: 'frodo' })] } },
  { id: 'peregrin', cardNumber: '3.40', name: 'Peregrin Took', nameKo: '페레그린 툭', base: 'pippin', page: 35,
    burdened: { setupActions: [exchange('any')], goal: rule('zero_tricks_others_win', '자신은 트릭을 이기지 않고 다른 모두는 적어도 한 번씩 이깁니다.', { selfExact: 0, othersMinimum: 1 }) } },
  { id: 'meriadoc', cardNumber: '3.41', name: 'Meriadoc Brandybuck', nameKo: '메리아독 브랜디벅', base: 'merry', page: 35,
    burdened: { setupActions: [exchange(['frodo', 'sam', 'pippin'])], goal: trickExact(2),
      abilities: [rule('optional_threat_redraw_all', '각 플레이어는 자기 준비 단계에서 위협 카드를 한 번 더 뽑아 바꿀 수 있습니다.', { usesPerCharacter: 1 })] } },
  { id: 'aragorn_son', cardNumber: '3.42', name: 'Aragorn son of Arathorn', nameKo: '아라소른의 아들 아라고른', base: 'aragorn', page: 35,
    burdened: { setupActions: [threatDraw(2, 1), exchange('any')],
      goal: rule('trick_count_exact_threat', '뽑은 두 위협값 중 선택한 값만큼 트릭을 승리합니다.', { countSource: 'threat' }) } },
  { id: 'boromir_son', cardNumber: '3.43', name: 'Boromir son of Denethor', nameKo: '데네소르의 아들 보로미르', base: 'boromir', page: 34,
    burdened: { setupActions: [exchange('any'), rule('exclude_exchange_target', '프로도와 교환하지 않습니다.', { targets: ['frodo'] })],
      goal: rule('last_trick_win', '마지막 트릭을 이기되 반지 카드는 하나도 획득하지 않습니다.', { forbiddenSuit: 'rings' }) } },
  { id: 'legolas_greenleaf', cardNumber: '3.44', name: 'Legolas Greenleaf', nameKo: '레골라스 그린리프', base: 'legolas', page: 35,
    burdened: { setupActions: [threatDraw(), exchange(['gimli', 'aragorn'])],
      goal: rule('multi_target_suit_rank', '위협값의 숲·그림자 카드를 모두 획득합니다.', { suits: ['forests', 'shadows'], rankSource: 'threat' }) } },
  { id: 'gimli_son', cardNumber: '3.45', name: 'Gimli son of Glóin', nameKo: '글로인의 아들 김리', base: 'gimli', page: 36,
    burdened: { setupActions: [threatDraw(), exchange(['legolas', 'aragorn'])],
      goal: rule('multi_target_suit_rank', '위협값의 산·그림자 카드를 모두 획득합니다.', { suits: ['mountains', 'shadows'], rankSource: 'threat' }) } },
];
for (const card of goldCards) {
  const front = CHARACTERS[card.base];
  CHARACTERS[card.id] = {
    id: card.id, cardNumber: card.cardNumber, name: card.name, nameKo: card.nameKo,
    alias: card.base, sourcePage: card.page,
    setupActions: front.setupActions, goal: front.goal,
    ...(front.abilities ? { abilities: front.abilities } : {}), burdened: card.burdened,
  };
}

export const THREATS: Record<string, ThreatDefinition> = Object.fromEntries([
  ...Array.from({ length: 4 }, (_, i) => ({ id: `black-rider-${i + 1}`, cardNumber: `2.0${i + 4}`, family: 'black-rider' as const, value: i + 1 })),
  ...Array.from({ length: 7 }, (_, i) => ({ id: `threat-${i + 1}`, cardNumber: `3.0${i + 2}`, family: 'threat' as const, value: i + 1 })),
].map(card => [card.id, card]));

export const BLACK_RIDER_THREATS = Object.keys(THREATS).filter(id => id.startsWith('black-rider-'));
export const FELLOWSHIP_THREATS = Object.keys(THREATS).filter(id => id.startsWith('threat-'));

// Event instructions, paraphrased from guide pp. 18–19, 22, 26, 29–34.
export const EVENTS: Record<string, FellowshipCardDefinition> = {
  old_man_willow: { id: 'old_man_willow', cardNumber: '2.14', name: 'Old Man Willow', nameKo: '늙은 버드나무', sourcePage: 18,
    effects: [rule('split_suit_deck', '숲 1~8과 별도 숲 9를 버드나무 덱으로 사용합니다.', { suit: 'forests', ranks: [1, 2, 3, 4, 5, 6, 7, 8, 9], extraCardId: 'forests-9' }),
      rule('lost_count_by_player', '1·4인은 유실 1장, 2·3인은 2장입니다.', { one: 1, two: 2, three: 2, four: 1 }),
      rule('event_trick_challenge', '트릭마다 버드나무 카드를 공개합니다. 승리 카드 숫자가 낮으면 버드나무가 트릭을 가져갑니다.', { comparator: 'winningCardRankGteEventRank', immunity: 'rings-1-trump', leaderRetainsLeadOnEventWin: true }),
      rule('two_player_pyramid_size', '2인 피라미드는 9장입니다.', { count: 9 })] },
  barrow_wights: { id: 'barrow_wights', cardNumber: '2.18', name: 'Barrow-wights', nameKo: '무덤귀신', sourcePage: 19,
    effects: [rule('barrow_deck', '반지 카드를 빼고 무덤 덱을 분리한 뒤 반지 카드를 본 덱에 돌려놓습니다.', { barrowSizeByPlayerCount: { 1: 5, 2: 10, 3: 10, 4: 5 }, excludeSuitBeforeSplit: 'rings', lostCount: 0, tomDrawCount: 5 }),
      rule('two_player_pyramid_size', '2인 피라미드는 9장입니다.', { count: 9 })] },
  the_nine: { id: 'the_nine', cardNumber: '2.33', name: 'The Nine', nameKo: '아홉 기수', sourcePage: 22,
    effects: [rule('assign_curses', '캐릭터별 저주를 배정합니다.', { assignments: { frodo: 'morgul_knife', merry: 'black_breath', pippin: 'wraith', strider: 'unseen', sam: 'terror' } })] },
  saruman: { id: 'saruman', cardNumber: '2.45', name: 'Saruman of Many Colours', nameKo: '여러 색의 사루만', sourcePage: 26,
    effects: [rule('character_goal_override', '간달프는 모든 숫자 1~8의 카드를 적어도 한 장씩 획득해야 합니다.', { character: 'gandalf', goalKind: 'all_ranks_won', ranks: [1, 2, 3, 4, 5, 6, 7, 8] }),
      rule('first_leader_override', '간달프가 첫 트릭을 선도합니다.', { character: 'gandalf' })] },
  doors_of_durin: { id: 'doors_of_durin', cardNumber: '3.13', name: 'The Doors of Durin', nameKo: '두린의 문', sourcePage: 29,
    effects: [rule('required_character', '이 이벤트에는 간달프가 필수입니다.', { character: 'gandalf' }),
      rule('character_goal_override', '간달프는 언덕·산·숲을 각각 적어도 한 장씩 획득합니다.', { character: 'gandalf', goalKind: 'all_suits_won', suits: ['hills', 'mountains', 'forests'] }),
      rule('single_completion', '성공 후에는 다시 선택하지 않습니다.')] },
  balins_tomb: { id: 'balins_tomb', cardNumber: '3.14', name: "Balin's Tomb", nameKo: '발린의 무덤', sourcePage: 29,
    effects: [rule('required_character', '이 이벤트에는 김리가 필수입니다.', { character: 'gimli' }),
      rule('skip_threat_draw', '김리는 위협을 뽑지 않습니다.', { character: 'gimli' }),
      rule('character_goal_override', '김리는 숫자가 연속되는 산 카드 4장 이상을 획득합니다.', { character: 'gimli', goalKind: 'consecutive_rank_suit_count', suit: 'mountains', minimum: 4 }),
      rule('single_completion', '성공 후에는 다시 선택하지 않습니다.')] },
  long_dark: { id: 'long_dark', cardNumber: '3.15', name: 'The Long Dark', nameKo: '오랜 어둠', sourcePage: 29,
    effects: [rule('required_character', '이 이벤트에는 아라고른이 필수입니다.', { character: 'aragorn' }),
      rule('hide_threats', '위협값은 라운드 끝까지 숨깁니다.'),
      rule('all_exchanges_simultaneous', '모든 교환을 동시에 진행합니다.'),
      rule('repeatable', '성공 후에도 재선택할 수 있습니다.')] },
  bridge_of_khazad_dum: { id: 'bridge_of_khazad_dum', cardNumber: '3.16', name: 'The Bridge of Khazad-dûm', nameKo: '카자드둠의 다리', sourcePage: 30,
    effects: [rule('unlock_after_events', '두린의 문·발린의 무덤·오랜 어둠을 성공해야 선택할 수 있습니다.', { requiredEvents: ['doors_of_durin', 'balins_tomb', 'long_dark'] }),
      rule('required_character', '불꽃의 종 간달프가 필수이며 일반 간달프는 사용할 수 없습니다.', { character: 'gandalf_fire', excludedCharacter: 'gandalf' }),
      rule('split_suit_deck', '그림자 1~8과 발록 카드를 별도 덱으로 만듭니다.', { suit: 'shadows', ranks: [1, 2, 3, 4, 5, 6, 7, 8], extraCardId: 'shadows-5-balrog' }),
      rule('lost_count_by_player', '1·4인은 유실 1장, 2·3인은 2장입니다.', { one: 1, two: 2, three: 2, four: 1 }),
      rule('balrog_rank_check', '각 트릭의 플레이 카드 숫자 합이 공개한 발록 카드 합보다 작으면 모두 실패합니다.', { revealByPlayerCount: { 1: 3, 2: 2, 3: 2, 4: 3 }, reshuffleOnExhaustion: true, playFullRound: true }),
      rule('two_player_pyramid_size', '2인 피라미드는 9장입니다.', { count: 9 })] },
  blindfolded: { id: 'blindfolded', cardNumber: '3.20', name: 'Blindfolded', nameKo: '눈가리개', sourcePage: 31,
    effects: [rule('face_down_trick_play', '김리 카드는 문양만 밝히고 뒤집어 냅니다. 트릭이 모이면 공개합니다.', { character: 'gimli', revealSuit: true, exceptionFaceUpCardId: 'rings-1', playerCounts: [2, 3, 4] }),
      rule('forbid_pyramid_character', '2인 피라미드는 김리를 맡을 수 없습니다.', { character: 'gimli' })] },
  mirror: { id: 'mirror', cardNumber: '3.24', name: 'The Mirror', nameKo: '거울', sourcePage: 32,
    effects: [rule('mirror_deal', '캐릭터를 무작위로 나눈 뒤 4장 배분·동시 교환을 두 번 수행하고 남은 카드를 나눕니다.', { partialDeal: 4, exchangeRounds: 2, exchangeEachOther: true, allowLostRingOne: true, excludeSamForPlayerCounts: [2, 3], soloOnlyRandomCharacters: true, twoPlayerPyramidFirst: 12, pyramidExchanges: false })] },
  anduin: { id: 'anduin', cardNumber: '3.28', name: 'The Anduin', nameKo: '안두인 강', sourcePage: 33,
    effects: [rule('add_rivers', '1·4인은 강 1~8, 2·3인은 강 1~6을 본 덱에 더합니다.', { riverRanksByPlayerCount: { 1: 8, 2: 6, 3: 6, 4: 8 }, twoPlayerPyramidSize: 14 }),
      rule('rivers_trump', '강 문양은 트럼프이며 반지 1의 선택 트럼프에 밀립니다.', { exceptChapter: 18, supersededBy: 'rings-1-trump' })] },
  breaking_fellowship: { id: 'breaking_fellowship', cardNumber: '3.38', name: 'Breaking of the Fellowship', nameKo: '원정대의 해산', sourcePage: 34,
    effects: [rule('two_group_chapter', '지정된 두 캐릭터 그룹을 각각 한 라운드씩 성공합니다.', { groups: 2, ringOneHolderChoosesOrder: true }),
      rule('burdened_faces', '금색 캐릭터는 부담 면으로 사용합니다.'),
      rule('group_two_first_leader', '두 번째 그룹은 반지 1을 받은 플레이어가 첫 트릭을 선도합니다.')] },
  road_goes_ever_on: { id: 'road_goes_ever_on', cardNumber: '3.46', name: 'The Road Goes Ever On', nameKo: '길은 계속 이어진다', sourcePage: 37,
    effects: [rule('postgame_random_mode', '본편 완료 후 무작위 동료·저주·선물로 플레이하는 별도 모드입니다.')] },
};

// Curse text and recipients: guide pp. 21–22.
export const CURSES: Record<string, FellowshipCardDefinition> = {
  black_breath: { id: 'black_breath', cardNumber: '2.25', name: 'The Black Breath', nameKo: '검은 숨결', sourcePage: 21,
    effects: [rule('forbid_won_rank', '숫자 8 카드를 획득하면 실패합니다.', { rank: 8 })] },
  morgul_knife: { id: 'morgul_knife', cardNumber: '2.26', name: 'Morgul-knife', nameKo: '모르굴 검', sourcePage: 21,
    effects: [rule('forbid_lead_suit', '반지 문양으로 선 플레이하면 실패합니다.', { suit: 'rings' })] },
  wraith: { id: 'wraith', cardNumber: '2.30', name: 'Wraith', nameKo: '망령', sourcePage: 22,
    effects: [rule('forbid_exchange', '교환을 요청하거나 상대가 될 수 없습니다.')] },
  unseen: { id: 'unseen', cardNumber: '2.31', name: 'Unseen', nameKo: '보이지 않음', sourcePage: 22,
    effects: [rule('hide_threat_value', '라운드 끝까지 자신의 위협값을 공개하지 않습니다.', { soloNoEffect: true })] },
  terror: { id: 'terror', cardNumber: '2.32', name: 'Terror', nameKo: '공포', sourcePage: 22,
    effects: [rule('forbid_lead_suit', '언덕 문양으로 선 플레이하면 실패합니다.', { suit: 'hills' })] },
};

// Base-game gifts: three campaign gifts and two unlocked post-game (pp. 25, 28, 37).
export const GIFTS: Record<string, FellowshipCardDefinition> = {
  broken_sword: { id: 'broken_sword', cardNumber: '2.42', name: 'The Sword That Was Broken', nameKo: '부러진 검', sourcePage: 25,
    effects: [rule('threat_range_choice', '위협값을 선택한 두 숫자 범위로 대체합니다.', { timing: 'would_draw_threat', rangeChoices: [[1, 2], [3, 4], [5, 6]] })] },
  horn_of_gondor: { id: 'horn_of_gondor', cardNumber: '2.43', name: 'The Horn of Gondor', nameKo: '곤도르의 뿔', sourcePage: 25,
    effects: [rule('announce_largest_hand_suits', '준비가 끝날 때 손패에서 가장 많은 문양을 선언합니다. 동률 문양은 모두 말합니다.', { timing: 'end_of_setup', usableByPyramid: false, soloNoEffect: true })] },
  mithril_shirt: { id: 'mithril_shirt', cardNumber: '3.11', name: 'Mithril Shirt', nameKo: '미스릴 셔츠', sourcePage: 28,
    effects: [rule('forgive_goal_failure', '플레이어 목표가 실패할 때 한 번 성공으로 처리합니다.', { timing: 'goal_failure', oncePerChapter: true, resetIfRoundFails: true })] },
  sting: { id: 'sting', cardNumber: '3.47', name: 'Sting', nameKo: '스팅', sourcePage: 37,
    effects: [rule('exchange_with_lost', '트릭 전에 유실 카드 또는 그 카드를 받은 플레이어와 교환합니다.', { timing: 'before_any_trick', restrictedTo: 'frodo', oncePerChapter: true })] },
  glamdring: { id: 'glamdring', cardNumber: '3.48', name: 'Glamdring', nameKo: '글람드링', sourcePage: 37,
    effects: [rule('ignore_follow_suit_first_trick', '첫 트릭에서 문양 따르기 의무를 무시합니다.', { timing: 'before_first_trick_card', restrictedTo: 'gandalf', oncePerChapter: true })] },
};

const short = (number: number, title: string, titleKo: string, characters: string[], required: string[], summary: string, sourcePage: number,
  extra: Partial<ChapterDefinition> = {}): ChapterDefinition => ({
  number, title, titleKo, mode: 'short', characters, required, threats: [], summary, sourcePage, ...extra,
});
const long = (number: number, title: string, titleKo: string, characters: string[], required: string[], summary: string, sourcePage: number,
  extra: Partial<ChapterDefinition> = {}): ChapterDefinition => ({
  number, title, titleKo, mode: 'long', characters, required, threats: [], summary, sourcePage, ...extra,
});

// Chapter cards: guide pp. 14–36. In a long chapter, every non-optional character must
// complete their goal in a successful round at least once (guide p. 6).
export const FELLOWSHIP_CHAPTERS: ChapterDefinition[] = [
  short(1, 'A Long-Expected Party', '뜻밖의 생일 잔치', ['frodo', 'bilbo', 'gandalf', 'pippin'], ['frodo', 'bilbo'], '프로도와 빌보를 필수로 선택해 첫 라운드를 성공합니다.', 14),
  short(2, 'A Little Delay in the Shire', '샤이어에서의 잠깐 지체', ['frodo', 'sam', 'merry', 'gandalf', 'pippin'], ['frodo', 'sam', 'merry'], '샘과 메리의 목표가 추가되며 검은 기수 위협 1~4를 사용합니다.', 15, { threats: BLACK_RIDER_THREATS }),
  short(3, 'The Ring Sets Out', '반지의 출발', ['frodo', 'farmer_maggot', 'gildor', 'sam', 'merry', 'pippin'], ['frodo', 'farmer_maggot', 'gildor'], '농부 매것은 같은 숫자 카드 두 장, 길도르는 마지막 트릭의 숲 카드를 노립니다.', 16, { threats: BLACK_RIDER_THREATS }),
  short(4, 'Conspiracy in Crickhollow', '크릭할로의 모의', ['frodo', 'fatty_bolger', 'sam', 'merry', 'pippin'], ['frodo', 'fatty_bolger', 'merry'], '뚱보 볼저가 모두에게 카드를 주고 정확히 한 트릭을 승리해야 합니다.', 17, { threats: BLACK_RIDER_THREATS }),
  short(5, 'The Old Forest', '오래된 숲', ['frodo', 'tom_bombadil', 'sam', 'merry', 'pippin'], ['frodo', 'tom_bombadil'], '숲 카드를 분리한 버드나무 덱이 매 트릭의 승자를 위협합니다.', 18,
    { threats: BLACK_RIDER_THREATS, events: ['old_man_willow'] }),
  short(6, 'Fog on the Barrow-downs', '고분 구릉의 안개', ['frodo', 'tom_bombadil', 'goldberry', 'sam', 'merry', 'pippin'], ['frodo', 'tom_bombadil', 'goldberry'], '무덤 덱을 분리하며 골드베리는 연속 3트릭을 정확히 획득합니다.', 19,
    { threats: BLACK_RIDER_THREATS, events: ['barrow_wights'] }),
  short(7, 'At the Sign of the Prancing Pony', '달리는 조랑말 여관', ['mr_underhill', 'barliman', 'sam', 'merry', 'pippin'], ['mr_underhill', 'barliman'], '언더힐 씨는 반지가 든 트릭만 승리할 수 있습니다.', 20,
    { threats: BLACK_RIDER_THREATS }),
  short(8, 'A Knife in the Dark', '어둠 속의 칼날', ['frodo', 'merry', 'strider', 'sam', 'pippin', 'barliman'], ['frodo', 'merry', 'strider'], '프로도와 메리가 저주를 받고 스트라이더가 위협값과 트릭 수를 비교합니다.', 21,
    { threats: BLACK_RIDER_THREATS, setup: [rule('assign_curses', '프로도에게 모르굴 검, 메리에게 검은 숨결을 줍니다.', { assignments: { frodo: 'morgul_knife', merry: 'black_breath' } })] }),
  long(9, 'Flight to the Ford', '나루터로의 질주', ['glorfindel', 'frodo', 'sam', 'merry', 'pippin', 'strider', 'bill_pony'], ['glorfindel'], '다섯 저주를 배정합니다. 프로도는 적어도 한 번 완료해야 합니다.', 22,
    { threats: BLACK_RIDER_THREATS, events: ['the_nine'], setup: [rule('required_once', '프로도의 목표를 챕터 중 한 번 이상 완료합니다.', { character: 'frodo' })] }),
  short(10, 'Recovery in Rivendell', '리븐델에서의 회복', ['elrond', 'bilbo_baggins', 'gloin', 'arwen', 'gandalf'], ['elrond', 'bilbo_baggins'], '엘론드의 공동 목표에 따라 모든 플레이어가 반지 카드를 획득해야 합니다.', 24),
  short(11, 'The Council of Elrond', '엘론드의 회의', ['frodo', 'aragorn', 'boromir', 'gloin', 'bilbo_baggins'], ['frodo', 'aragorn', 'boromir'], '아라고른은 검으로 목표 범위를 정하고 보로미르는 마지막 트릭을 노립니다.', 25,
    { gifts: [{ id: 'broken_sword', recipient: 'aragorn', requiredActivation: true }, { id: 'horn_of_gondor', recipient: 'boromir' }] }),
  short(12, 'Delayed in Isengard', '아이센가드에서의 지체', ['gandalf', 'radagast', 'shadowfax', 'gwaihir'], ['gandalf'], '사루만 이벤트가 간달프의 목표를 숫자 1~8 수집으로 바꿉니다.', 26,
    { events: ['saruman'], goalOverrides: { gandalf: rule('all_ranks_won', '각 숫자 1~8의 카드를 적어도 한 장씩 획득합니다.', { ranks: [1, 2, 3, 4, 5, 6, 7, 8] }) } }),
  long(13, 'The Ring Goes South', '남쪽으로 향하는 반지', ['frodo', 'gandalf', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin', 'bill_pony'], ['frodo'], '위협 1~7과 미스릴 셔츠가 등장합니다. 조랑말 빌은 선택 목표입니다.', 28,
    { threats: FELLOWSHIP_THREATS, optional: ['bill_pony'], gifts: [{ id: 'mithril_shirt', recipient: 'frodo' }] }),
  // Guide p. 29 omits Aragorn from its roster while requiring him for The Long Dark.
  // The event requirement is explicit, so he is included here for that sub-round.
  long(14, 'The Mines of Moria', '모리아 광산', ['frodo', 'gandalf', 'gandalf_fire', 'aragorn', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin'], ['frodo'], '세 모리아 이벤트를 완료한 뒤 카자드둠의 다리를 통과합니다.', 29,
    { threats: FELLOWSHIP_THREATS, events: ['doors_of_durin', 'balins_tomb', 'long_dark', 'bridge_of_khazad_dum'],
      gifts: [{ id: 'mithril_shirt', recipient: 'frodo' }],
      rounds: [
        { id: 'doors_of_durin', event: 'doors_of_durin', characters: ['frodo', 'gandalf', 'aragorn', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin'], required: ['frodo', 'gandalf'], goalOverrides: { gandalf: rule('all_suits_won', '언덕·산·숲을 각각 적어도 한 장씩 획득합니다.', { suits: ['hills', 'mountains', 'forests'] }) } },
        { id: 'balins_tomb', event: 'balins_tomb', characters: ['frodo', 'gandalf', 'aragorn', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin'], required: ['frodo', 'gimli'], goalOverrides: { gimli: rule('consecutive_rank_suit_count', '연속 숫자 산 카드 4장 이상을 획득합니다.', { suit: 'mountains', minimum: 4 }) } },
        { id: 'long_dark', event: 'long_dark', characters: ['frodo', 'gandalf', 'aragorn', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin'], required: ['frodo', 'aragorn'] },
        { id: 'bridge_of_khazad_dum', event: 'bridge_of_khazad_dum', characters: ['frodo', 'gandalf_fire', 'aragorn', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin'], required: ['frodo', 'gandalf_fire'] },
      ] }),
  short(15, 'The Leaves of Lothlórien', '로슬로리엔의 나뭇잎', ['gimli', 'haldir', 'orophin_rumil', 'legolas'], ['gimli', 'haldir', 'orophin_rumil'], '김리는 카드를 가려 내고, 두 엘프는 각자 목표 숲 카드를 획득합니다.', 31,
    { threats: FELLOWSHIP_THREATS, events: ['blindfolded'] }),
  short(16, 'The Mirror of Galadriel', '갈라드리엘의 거울', ['frodo', 'galadriel', 'celeborn', 'sam'], ['frodo', 'galadriel', 'celeborn'], '무작위 캐릭터 배정과 단계별 동시 교환 후 목표를 수행합니다.', 32,
    { threats: FELLOWSHIP_THREATS, events: ['mirror'] }),
  long(17, 'The Great River', '큰 강', ['frodo', 'aragorn', 'legolas', 'gimli', 'boromir', 'sam', 'merry', 'pippin', 'galadriel', 'celeborn'], ['frodo'], '강 문양이 트럼프로 추가됩니다. 켈레보른은 선택 목표입니다.', 33,
    { threats: FELLOWSHIP_THREATS, events: ['anduin'], optional: ['celeborn'], gifts: [{ id: 'mithril_shirt', recipient: 'frodo' }] }),
  {
    number: 18, title: 'The Breaking of the Fellowship', titleKo: '원정대의 해산', mode: 'special',
    characters: ['frodo', 'boromir_son', 'samwise', 'aragorn_son', 'meriadoc', 'peregrin', 'legolas_greenleaf', 'gimli_son'],
    required: ['frodo', 'boromir_son', 'meriadoc', 'peregrin'], threats: FELLOWSHIP_THREATS,
    events: ['anduin', 'breaking_fellowship'],
    setup: [rule('add_rivers_without_trump', '강 카드를 인원에 맞게 추가하지만 트럼프 기능은 사용하지 않습니다.', { riverRanksByPlayerCount: { 1: 8, 2: 6, 3: 6, 4: 8 } })],
    rounds: [
      { id: 'first_group', characters: ['frodo', 'boromir_son', 'samwise', 'aragorn_son'], required: ['frodo', 'boromir_son'], burdened: ['boromir_son', 'samwise', 'aragorn_son'] },
      { id: 'second_group', characters: ['meriadoc', 'peregrin', 'legolas_greenleaf', 'gimli_son'], required: ['meriadoc', 'peregrin'], burdened: ['meriadoc', 'peregrin', 'legolas_greenleaf', 'gimli_son'] },
    ],
    summary: '정해진 두 그룹의 부담 면 목표를 각각 한 라운드씩 성공합니다. 강 문양은 일반 문양입니다.', sourcePage: 34,
  },
];

export const CHAPTERS: Record<number, ChapterDefinition> = Object.fromEntries(
  FELLOWSHIP_CHAPTERS.map(chapter => [chapter.number, chapter]),
);
