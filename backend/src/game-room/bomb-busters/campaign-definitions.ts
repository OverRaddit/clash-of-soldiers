import { BombMissionDefinition } from './missions';
import { BombConstraintId } from './rule-cards';

/** Research-backed configuration, deliberately separate from the playable mission registry. */
export type BombCampaignRule =
  | { kind: 'sequence'; cards: 3 | 5; cutThreshold: 2 | 4; chooseEnd: boolean }
  | { kind: 'timer'; seconds: number; twoPlayerSeconds: number; turnOrder: 'first_volunteer'; consecutiveOnlyWithTwoRemaining: true }
  | { kind: 'blue_value_is_red'; randomValue: true }
  | { kind: 'equipment_extra_number_lock' }
  | { kind: 'triple_red_cut'; count: 3; distributeFromCaptain: true }
  | { kind: 'captain_failure_explodes'; forbidSharedEquipment: boolean; forbidPersonalEquipment: boolean; forbidStabilizer: true }
  | { kind: 'hidden_equipment_completion'; skipAlreadyComplete: true }
  | { kind: 'false_hints'; players: 'captain' | 'all'; initialCount: 2; initialRedAllowed: boolean; sharedEquipmentForbidden: boolean }
  | { kind: 'radar_director'; turnFollowsDirector: true }
  | { kind: 'audio'; mission: 19 | 30 | 42 | 54 | 66 }
  | { kind: 'x_wire'; perRack: 1; blueOnly: boolean; unlockAfterYellowCount: number; equipmentImmune: true; noInitialHint: true }
  | { kind: 'parity_hints' }
  | { kind: 'absent_hints'; initialCount: 2; yellowPairGiftsToLeft: true }
  | { kind: 'quad_cut_reward'; reward: 'equipment' | 'hints'; deckCount: 7 | 8; discardEveryRoundUntilCut: true }
  | { kind: 'multiplicity_hints'; includeCut: true; discardHintOnExchange: true; postItOnCutAllowed: true }
  | { kind: 'communication'; restriction: 'no_numbers' | 'silent_except_oxygen' | 'volunteers_only'; penalty: 0 | 1 }
  | { kind: 'number_cycle'; noMatchingValuePassPenalty: 0 }
  | { kind: 'disable_personal_equipment'; players: 'all' | 'captain' }
  | { kind: 'yellow_pair_hint_reward'; randomTokensPerPlayer: 1 }
  | { kind: 'hidden_number_prediction'; initialHand: 2; rightOfCaptainHand: 3; matchingCutPenalty: 1 }
  | { kind: 'constraints'; mode: 'choose_individual' | 'captain_changes_global' | 'completed_changes_global' | 'number_linked' | 'rotating_individual'; pool: BombConstraintId[]; noActionRound: 'none' | 'advance_and_replace' | 'explode'; permanentReleaseWhenImpossible?: boolean; swapCost?: number }
  | { kind: 'secret_constraint_role'; pool: BombConstraintId[]; wrongGuessPenalty: 1; stuckPenalty: 2 }
  | { kind: 'reverse_wires'; players: 'captain' | 'all'; countPerPlayer: 1 | 2; ownFailureExplodes: true; otherCut: 'forbidden' | 'penalty_one'; positions: 'right' | 'outer_ends' }
  | { kind: 'yellow_single_cut'; yellowPerPlayer: true; captainExcludedAtFive: true; successRewinds: 1 }
  | { kind: 'nano_reserve'; countByPlayers: Record<number, number>; startingPosition: 1; bounceAt: 12; matchingCutTakesWire: true }
  | { kind: 'oxygen'; mode: 'shared_round' | 'transfer_exact' | 'pay_bands' | 'captain_relay'; perPlayerByPlayers?: Record<number, number>; totalByPlayers?: Record<number, number>; sharedPerPlayer?: number; voluntaryPass: boolean; completionReward?: number; removeOnExit?: boolean }
  | { kind: 'volunteer_number'; leaderChoosesIfNone: true; absentValuePenalty: 1 }
  | { kind: 'sevens_last'; value: 7; count: 4; wrongTargetOnlyRegularFailure: true }
  | { kind: 'arithmetic'; cardCount: 12; cardsPerCut: 2; operations: ['add', 'subtract']; passPenalty: 1 }
  | { kind: 'triple_yellow_cut'; count: 3; distributeFromCaptain: true; allWrongHints: true; failurePenalty: 1 }
  | { kind: 'memory_hints'; hideMarkersAfterPreview: true; showHintPositionTemporarily: true; completionTokens: false }
  | { kind: 'number_director'; absentValuePenalty: 1; redOnlyTargetExplodes: true; turnFollowsDirector: true }
  | { kind: 'nano_race'; start: 0; lossPosition: 12; regularSuccessMove: 1; matchingSuccessMove: -1; failureMove: 2 }
  | { kind: 'challenges'; count: 'players'; rewardRewind: 1; allRequiredForVictory: false }
  | { kind: 'unlimited_detector'; suppressAllHints: true; originalCharactersOnly: true }
  | { kind: 'nano_path'; startValue: 7; faceLongerSide: true; reverseAfterCutOptional: true; stuckPenalty: 1 }
  | { kind: 'number_healing'; count: 'players'; completionRewind: 1 }
  | { kind: 'number_pass'; evenlyDeal: true; passCardAfterTurn: true; noMatchingValuePenalty: 1; remainingCardOnExitExplodes: true }
  | { kind: 'bunker'; constraints: BombConstraintId[]; moveAfterFailure: true; fourWireSoloMoves: 2; yellowsWaitForAudio: true };

export interface BombCampaignDefinition extends BombMissionDefinition {
  minPlayers: number;
  maxPlayers: number;
  rules: BombCampaignRule[];
  /** Only count changes belong in twoPlayer; setup information remains explicit here. */
  initialHintMode?: 'normal' | 'none' | 'random' | 'false' | 'absent';
  twoPlayerCaptainHint?: 'none' | 'random';
  equipmentMode?: 'random' | 'none' | 'radar_only' | 'hidden';
  extraEquipmentTier: 'false_bottom' | 'all';
  excludedExtraEquipment?: string[];
  excludedPersonalEquipment?: string[];
  fixedYellowValues?: number[];
  /** None of these red tiles enter the initial hands. */
  redSupplyCount?: number;
  yellowCountByPlayers?: Record<number, number>;
  dialStart?: 'one_from_explosion' | 'one_safer' | 'unused';
  sourceFront: string;
  sourceBack: string;
}

const simple = ['A', 'B', 'C', 'D', 'E'] as BombConstraintId[];
const all = ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 'K', 'L'] as BombConstraintId[];
const parity: BombCampaignRule = { kind: 'parity_hints' };
const multiplicity: BombCampaignRule = { kind: 'multiplicity_hints', includeCut: true, discardHintOnExchange: true, postItOnCutAllowed: true };
const silentOxygen: BombCampaignRule = { kind: 'communication', restriction: 'silent_except_oxygen', penalty: 0 };
const challenges: BombCampaignRule = { kind: 'challenges', count: 'players', rewardRewind: 1, allRequiredForVictory: false };

function mission(id: number, name: string, red: number, yellow: number, rules: BombCampaignRule[], extra: Partial<BombCampaignDefinition> = {}): BombCampaignDefinition {
  return {
    id, name, description: name, blueMax: 12,
    redCount: red, redCandidateCount: red, yellowCount: yellow, yellowCandidateCount: yellow,
    redCandidateMax: 12, yellowCandidateMax: 12,
    minPlayers: 2, maxPlayers: 5, equipment: true, equipmentMode: 'random',
    extraEquipmentTier: id >= 55 ? 'all' : 'false_bottom',
    rules, sourceFront: `https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%20${id}%20Front.png`,
    sourceBack: `https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%20${id}%20Back.png`,
    ...extra,
  };
}

/** These rules are source data only, NOT a list of supported gameplay. */
export const BOMB_CAMPAIGN_DEFINITIONS: BombCampaignDefinition[] = [
  mission(9, '우선순위', 1, 2, [{ kind: 'sequence', cards: 3, cutThreshold: 2, chooseEnd: false }], { twoPlayer: { redCount: 2, redCandidateCount: 2, yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(10, '힘든 하루', 1, 4, [{ kind: 'timer', seconds: 900, twoPlayerSeconds: 720, turnOrder: 'first_volunteer', consecutiveOnlyWithTwoRemaining: true }], { equipmentExcluded: [11] }),
  mission(11, '파란 전선의 배신', 0, 2, [{ kind: 'blue_value_is_red', randomValue: true }], { twoPlayer: { yellowCount: 4, yellowCandidateCount: 4 }, twoPlayerCaptainHint: 'none' }),
  mission(12, '서류에 묶인 장비', 1, 4, [{ kind: 'equipment_extra_number_lock' }], { twoPlayer: { redCount: 2, redCandidateCount: 2 } }),
  mission(13, '적색경보', 3, 0, [{ kind: 'triple_red_cut', count: 3, distributeFromCaptain: true }], { initialHintMode: 'random', twoPlayerCaptainHint: 'none' }),
  mission(14, '위험한 신입', 2, 2, [{ kind: 'captain_failure_explodes', forbidSharedEquipment: false, forbidPersonalEquipment: false, forbidStabilizer: true }], { yellowCandidateCount: 3, twoPlayer: { redCount: 3, redCandidateCount: 3, yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(15, '노보시비르스크 임무', 1, 0, [{ kind: 'hidden_equipment_completion', skipAlreadyComplete: true }], { redCandidateCount: 3, equipmentMode: 'hidden', twoPlayer: { redCount: 2 } }),
  mission(16, '더 엄격한 우선순위', 1, 2, [{ kind: 'sequence', cards: 3, cutThreshold: 4, chooseEnd: false }], { yellowCandidateCount: 3, twoPlayer: { redCount: 2, redCandidateCount: 2, yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(17, '거짓 단서의 대장', 2, 0, [{ kind: 'false_hints', players: 'captain', initialCount: 2, initialRedAllowed: false, sharedEquipmentForbidden: true }], { redCandidateCount: 3, twoPlayer: { redCount: 3 } }),
  mission(18, '배트 레이더의 도움', 2, 0, [{ kind: 'radar_director', turnFollowsDirector: true }], { initialHintMode: 'none', equipmentMode: 'radar_only', twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(19, '괴수의 뱃속', 1, 2, [{ kind: 'audio', mission: 19 }], { yellowCandidateCount: 3 }),
  mission(20, '크고 나쁜 늑대', 2, 2, [{ kind: 'x_wire', perRack: 1, blueOnly: false, unlockAfterYellowCount: 0, equipmentImmune: true, noInitialHint: true }], { equipmentExcluded: [2], twoPlayer: { redCandidateCount: 3, yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(21, '해기스 속 폭탄', 1, 0, [parity], { redCandidateCount: 2, twoPlayer: { redCount: 2 } }),
  mission(22, '없는 값으로 전하는 단서', 1, 4, [{ kind: 'absent_hints', initialCount: 2, yellowPairGiftsToLeft: true }], { initialHintMode: 'absent' }),
  mission(23, '포드위치의 해체 작전', 1, 0, [{ kind: 'quad_cut_reward', reward: 'equipment', deckCount: 7, discardEveryRoundUntilCut: true }], { redCandidateCount: 3, equipmentMode: 'hidden', twoPlayer: { redCount: 2 } }),
  mission(24, '전선 개수 세기', 2, 0, [multiplicity], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(25, '숫자를 말하지 마세요', 2, 0, [{ kind: 'communication', restriction: 'no_numbers', penalty: 1 }], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(26, '늑대 이야기', 2, 0, [{ kind: 'number_cycle', noMatchingValuePassPenalty: 0 }], { equipmentExcluded: [10] }),
  mission(27, '전선과의 장난', 1, 4, [{ kind: 'disable_personal_equipment', players: 'all' }, { kind: 'yellow_pair_hint_reward', randomTokensPerPlayer: 1 }], { equipmentExcluded: [7], twoPlayerCaptainHint: 'none' }),
  mission(28, '덜렁대는 대장', 2, 4, [{ kind: 'captain_failure_explodes', forbidSharedEquipment: true, forbidPersonalEquipment: true, forbidStabilizer: true }], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(29, '추측 게임', 3, 0, [{ kind: 'hidden_number_prediction', initialHand: 2, rightOfCaptainHand: 3, matchingCutPenalty: 1 }], { twoPlayerCaptainHint: 'none' }),
  mission(30, '속도전', 1, 4, [{ kind: 'audio', mission: 30 }], { redCandidateCount: 2 }),
  mission(31, '한 손이 묶인 채', 2, 0, [{ kind: 'constraints', mode: 'choose_individual', pool: simple, noActionRound: 'none', permanentReleaseWhenImpossible: true }], { redCandidateCount: 3 }),
  mission(32, '장난 연발', 2, 0, [{ kind: 'constraints', mode: 'captain_changes_global', pool: all, noActionRound: 'none' }], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(33, '베이거스에서 생긴 일', 2, 0, [parity], { redCandidateCount: 3, twoPlayer: { redCount: 3 } }),
  mission(34, '약한 고리', 1, 0, [{ kind: 'secret_constraint_role', pool: simple, wrongGuessPenalty: 1, stuckPenalty: 2 }], { minPlayers: 3 }),
  mission(35, '홀로 놓인 전선', 2, 4, [{ kind: 'x_wire', perRack: 1, blueOnly: true, unlockAfterYellowCount: 4, equipmentImmune: true, noInitialHint: true }], { redCandidateCount: 3, equipmentExcluded: [2], twoPlayer: { redCount: 3 } }),
  mission(36, '야자수 아래의 혼란', 1, 2, [{ kind: 'sequence', cards: 5, cutThreshold: 2, chooseEnd: true }], { redCandidateCount: 3, twoPlayer: { redCount: 2, yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(37, '제멋대로 조커', 2, 0, [{ kind: 'constraints', mode: 'completed_changes_global', pool: all, noActionRound: 'advance_and_replace' }], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(38, '전선 뜨개질', 2, 0, [{ kind: 'reverse_wires', players: 'captain', countPerPlayer: 1, ownFailureExplodes: true, otherCut: 'forbidden', positions: 'right' }], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(39, '고귀한 네 전선', 2, 4, [{ kind: 'quad_cut_reward', reward: 'hints', deckCount: 8, discardEveryRoundUntilCut: true }], { redCandidateCount: 3, initialHintMode: 'random', equipment: false, equipmentMode: 'none', twoPlayer: { redCount: 3 } }),
  mission(40, '크리스마스의 위기', 3, 0, [multiplicity], { twoPlayerCaptainHint: 'none' }),
  mission(41, '노란 전선의 구조', 1, 4, [{ kind: 'yellow_single_cut', yellowPerPlayer: true, captainExcludedAtFive: true, successRewinds: 1 }], { redCandidateCount: 3, initialHintMode: 'random', dialStart: 'one_from_explosion', yellowCountByPlayers: { 2: 2, 3: 3, 4: 4, 5: 4 }, excludedExtraEquipment: ['false-bottom'], twoPlayer: { redCount: 2, yellowCount: 2, yellowCandidateCount: 2 } }),
  mission(42, '서커스 탈출', 1, 4, [{ kind: 'audio', mission: 42 }], { redCandidateCount: 3 }),
  mission(43, '나노 로봇', 3, 0, [{ kind: 'nano_reserve', countByPlayers: { 2: 5, 3: 4, 4: 4, 5: 3 }, startingPosition: 1, bounceAt: 12, matchingCutTakesWire: true }], { twoPlayerCaptainHint: 'random' }),
  mission(44, '수중 압박', 1, 0, [{ kind: 'oxygen', mode: 'shared_round', sharedPerPlayer: 2, voluntaryPass: true }, silentOxygen], { redCandidateCount: 3, equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'] }),
  mission(45, '자원자를 찾습니다', 2, 0, [{ kind: 'volunteer_number', leaderChoosesIfNone: true, absentValuePenalty: 1 }, { kind: 'communication', restriction: 'volunteers_only', penalty: 1 }], { equipmentExcluded: [10, 11], excludedPersonalEquipment: ['xy-ray'], twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(46, '비밀요원', 0, 4, [{ kind: 'sevens_last', value: 7, count: 4, wrongTargetOnlyRegularFailure: true }], { fixedYellowValues: [5.1, 6.1, 7.1, 8.1], equipmentExcluded: [7], twoPlayerCaptainHint: 'none' }),
  mission(47, '계산으로 절단하기', 2, 0, [{ kind: 'arithmetic', cardCount: 12, cardsPerCut: 2, operations: ['add', 'subtract'], passPenalty: 1 }], { redCandidateCount: 3, equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'], twoPlayer: { redCount: 3 } }),
  mission(48, '치명적인 세 전선', 2, 3, [{ kind: 'triple_yellow_cut', count: 3, distributeFromCaptain: true, allWrongHints: true, failurePenalty: 1 }], { twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(49, '산소통의 메시지', 2, 0, [{ kind: 'oxygen', mode: 'transfer_exact', perPlayerByPlayers: { 2: 7, 3: 6, 4: 5, 5: 4 }, voluntaryPass: true, removeOnExit: true }, silentOxygen], { equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'], twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(50, '암흑의 바다', 2, 2, [{ kind: 'memory_hints', hideMarkersAfterPreview: true, showHintPositionTemporarily: true, completionTokens: false }], { twoPlayer: { redCount: 3, redCandidateCount: 3, yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(51, '당신의 운을 시험합니다', 1, 0, [{ kind: 'number_director', absentValuePenalty: 1, redOnlyTargetExplodes: true, turnFollowsDirector: true }], { dialStart: 'one_safer', equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'], twoPlayer: { redCount: 2, redCandidateCount: 2 }, twoPlayerCaptainHint: 'none' }),
  mission(52, '거짓 정보', 3, 0, [{ kind: 'false_hints', players: 'all', initialCount: 2, initialRedAllowed: true, sharedEquipmentForbidden: false }], { initialHintMode: 'false', equipmentExcluded: [1, 12], twoPlayer: { yellowCount: 4, yellowCandidateCount: 4 } }),
  mission(53, '나노의 역주행', 2, 0, [{ kind: 'nano_race', start: 0, lossPosition: 12, regularSuccessMove: 1, matchingSuccessMove: -1, failureMove: 2 }], { dialStart: 'unused', equipmentExcluded: [6, 9], twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(54, '붉은 토끼의 습격', 0, 0, [{ kind: 'audio', mission: 54 }, { kind: 'oxygen', mode: 'pay_bands', perPlayerByPlayers: { 2: 9, 3: 6, 4: 3, 5: 2 }, voluntaryPass: false, completionReward: 1, removeOnExit: true }], { redSupplyCount: 11, equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'] }),
  mission(55, '닥터 노프의 도전', 2, 0, [challenges], { dialStart: 'one_from_explosion', twoPlayer: { redCandidateCount: 3 } }),
  mission(56, '뒤집힌 전선', 2, 0, [{ kind: 'reverse_wires', players: 'all', countPerPlayer: 1, ownFailureExplodes: true, otherCut: 'penalty_one', positions: 'right' }], { redCandidateCount: 3, twoPlayer: { redCount: 3 } }),
  mission(57, '불가능한 임무', 1, 0, [{ kind: 'constraints', mode: 'number_linked', pool: all, noActionRound: 'explode' }], { excludedExtraEquipment: ['disintegrator'], twoPlayer: { redCount: 2, redCandidateCount: 2 } }),
  mission(58, '무제한 더블 탐지기', 2, 0, [{ kind: 'unlimited_detector', suppressAllHints: true, originalCharactersOnly: true }], { initialHintMode: 'none', equipmentExcluded: [4, 7], twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(59, '나노의 구조 작전', 2, 0, [{ kind: 'nano_path', startValue: 7, faceLongerSide: true, reverseAfterCutOptional: true, stuckPenalty: 1 }], { redCandidateCount: 3, equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'], twoPlayer: { redCount: 3 } }),
  mission(60, '다시 닥터 노프', 2, 0, [challenges], { redCandidateCount: 3, dialStart: 'one_from_explosion', twoPlayer: { redCount: 3 } }),
  mission(61, '제약 나누기', 1, 0, [{ kind: 'constraints', mode: 'rotating_individual', pool: simple, noActionRound: 'explode', swapCost: 1 }], { twoPlayer: { redCount: 2, redCandidateCount: 2 } }),
  mission(62, '아마겟돈 룰렛', 2, 0, [{ kind: 'number_healing', count: 'players', completionRewind: 1 }], { dialStart: 'one_from_explosion', twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(63, '타이타닉 작전', 2, 0, [{ kind: 'oxygen', mode: 'captain_relay', totalByPlayers: { 2: 14, 3: 18, 4: 24, 5: 30 }, voluntaryPass: false }, silentOxygen], { equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'], twoPlayer: { redCount: 3, redCandidateCount: 3 } }),
  mission(64, '돌아온 뒤집힌 전선', 1, 0, [{ kind: 'reverse_wires', players: 'all', countPerPlayer: 2, ownFailureExplodes: true, otherCut: 'penalty_one', positions: 'outer_ends' }], { twoPlayer: { redCount: 2, redCandidateCount: 2 } }),
  mission(65, '숫자 넘겨주기', 3, 0, [{ kind: 'number_pass', evenlyDeal: true, passCardAfterTurn: true, noMatchingValuePenalty: 1, remainingCardOnExitExplodes: true }], { minPlayers: 3, equipmentExcluded: [10], excludedPersonalEquipment: ['xy-ray'] }),
  mission(66, '마지막 카운트다운', 2, 2, [{ kind: 'audio', mission: 66 }, { kind: 'bunker', constraints: simple, moveAfterFailure: true, fourWireSoloMoves: 2, yellowsWaitForAudio: true }]),
];

export function getBombCampaignDefinition(id: number, playerCount: number): BombCampaignDefinition {
  const definition = BOMB_CAMPAIGN_DEFINITIONS.find(candidate => candidate.id === id);
  if (!definition || playerCount < definition.minPlayers || playerCount > definition.maxPlayers) throw new Error('해당 인원수로 진행할 수 없는 미션입니다.');
  const result = structuredClone({ ...definition, ...(playerCount === 2 ? definition.twoPlayer : {}) });
  if (definition.yellowCountByPlayers) {
    result.yellowCount = definition.yellowCountByPlayers[playerCount];
    result.yellowCandidateCount = result.yellowCount;
  }
  return result;
}
