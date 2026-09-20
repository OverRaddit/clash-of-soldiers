/** Factual card metadata. Importing these definitions does not enable a mission. */
export type BombConstraintId = 'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H' | 'I' | 'J' | 'K' | 'L';

export interface BombConstraintDefinition {
  id: BombConstraintId;
  description: string;
  allowedBlueValues?: number[];
  equipmentForbidden?: boolean;
  suppressFailureHint?: boolean;
  hintedWiresForbidden?: boolean;
  postItForbidden?: boolean;
  forbiddenTargetEdge?: 'left' | 'right';
  soloForbidden?: boolean;
  mistakeIncrement?: number;
  source: string;
}

const constraintSource = (id: BombConstraintId) => `https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Items/Constraint%20${id}.png`;
export const BOMB_CONSTRAINTS: BombConstraintDefinition[] = [
  { id: 'A', description: '짝수만 절단할 수 있습니다.', allowedBlueValues: [2, 4, 6, 8, 10, 12] },
  { id: 'B', description: '홀수만 절단할 수 있습니다.', allowedBlueValues: [1, 3, 5, 7, 9, 11] },
  { id: 'C', description: '1~6만 절단할 수 있습니다.', allowedBlueValues: [1, 2, 3, 4, 5, 6] },
  { id: 'D', description: '7~12만 절단할 수 있습니다.', allowedBlueValues: [7, 8, 9, 10, 11, 12] },
  { id: 'E', description: '4~9만 절단할 수 있습니다.', allowedBlueValues: [4, 5, 6, 7, 8, 9] },
  { id: 'F', description: '4~9를 절단할 수 없습니다.', allowedBlueValues: [1, 2, 3, 10, 11, 12] },
  { id: 'G', description: '공용·개인 장비를 사용할 수 없습니다.', equipmentForbidden: true },
  { id: 'H', description: '자신이 참여한 실패에서는 정보를 놓지 않습니다. 정보가 놓인 전선을 자르거나 포스트잇을 쓸 수 없습니다.', suppressFailureHint: true, hintedWiresForbidden: true, postItForbidden: true },
  { id: 'I', description: '동료 받침대의 맨 오른쪽 전선을 자를 수 없습니다.', forbiddenTargetEdge: 'right' },
  { id: 'J', description: '동료 받침대의 맨 왼쪽 전선을 자를 수 없습니다.', forbiddenTargetEdge: 'left' },
  { id: 'K', description: '단독 절단을 할 수 없습니다.', soloForbidden: true },
  { id: 'L', description: '절단 실패로 기폭기가 2칸 전진합니다.', mistakeIncrement: 2 },
].map(definition => ({ ...definition, source: constraintSource(definition.id as BombConstraintId) })) as BombConstraintDefinition[];

export type BombChallengeCondition =
  | { kind: 'special_red_cut'; count: 1; wrongGuessExplodes: true }
  | { kind: 'consecutive_even_cuts'; turns: 4; repeatedActorPolicy: 'consecutive_turns' }
  | { kind: 'uncut_adjacent_pairs'; separatedByCutSlots: true }
  | { kind: 'first_completed_sum'; count: 3; sum: 18 }
  | { kind: 'consecutive_solo_cuts'; turns: 2 }
  | { kind: 'isolated_uncut_wires'; minimum: 5; includeRackEnds: true }
  | { kind: 'consecutive_step_cuts'; turns: 3; step: 1; repeatedActorPolicy: 'consecutive_turns' }
  | { kind: 'first_completed_targets'; count: 2 }
  | { kind: 'all_remaining_blue_odd'; minimum: 6 }
  | { kind: 'cut_middle_keep_ends'; minimumCut: 7 };

export interface BombChallengeDefinition {
  id: number;
  description: string;
  condition: BombChallengeCondition;
  source: string;
}

export const BOMB_CHALLENGES: BombChallengeDefinition[] = [
  { id: 1, description: '동료 전선 하나를 빨강이라 선언하여 특별 절단합니다. 틀리면 즉시 폭발합니다.', condition: { kind: 'special_red_cut', count: 1, wrongGuessExplodes: true } },
  { id: 2, description: '연속 네 차례에서 짝수를 절단합니다.', condition: { kind: 'consecutive_even_cuts', turns: 4, repeatedActorPolicy: 'consecutive_turns' } },
  { id: 3, description: '한 받침대의 남은 전선들이 절단된 자리로 분리된 인접 두 개 묶음들로만 남습니다.', condition: { kind: 'uncut_adjacent_pairs', separatedByCutSlots: true } },
  { id: 4, description: '처음 완료한 세 숫자의 합이 18입니다.', condition: { kind: 'first_completed_sum', count: 3, sum: 18 } },
  { id: 5, description: '연속 두 차례에서 단독 절단합니다.', condition: { kind: 'consecutive_solo_cuts', turns: 2 } },
  { id: 6, description: '한 받침대의 미절단 전선 다섯 개 이상이 각각 고립됩니다. 양끝도 포함합니다.', condition: { kind: 'isolated_uncut_wires', minimum: 5, includeRackEnds: true } },
  { id: 7, description: '연속 세 차례의 절단 숫자가 1씩 증가하거나 감소합니다.', condition: { kind: 'consecutive_step_cuts', turns: 3, step: 1, repeatedActorPolicy: 'consecutive_turns' } },
  { id: 8, description: '처음 완료하는 두 숫자가 준비 중 공개한 목표 카드 두 장과 일치합니다.', condition: { kind: 'first_completed_targets', count: 2 } },
  { id: 9, description: '한 받침대에 파란 전선이 여섯 개 이상 남아 있고 모두 홀수입니다.', condition: { kind: 'all_remaining_blue_odd', minimum: 6 } },
  { id: 10, description: '한 받침대에서 일곱 개 이상 절단했으나 양끝 전선은 미절단입니다.', condition: { kind: 'cut_middle_keep_ends', minimumCut: 7 } },
].map(definition => ({ ...definition, source: `https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Items/Challenge%20${definition.id}.png` })) as BombChallengeDefinition[];
