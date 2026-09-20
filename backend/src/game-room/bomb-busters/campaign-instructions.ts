import { BombCampaignDefinition, BombCampaignRule } from './campaign-definitions';

function describe(rule: BombCampaignRule): string {
  switch (rule.kind) {
    case 'sequence': return `순서 카드의 ${rule.chooseEnd ? '선택한 끝' : '첫 숫자'}부터 ${rule.cutThreshold}개씩 절단합니다. 목록에 없는 숫자는 자유롭게 절단할 수 있습니다.`;
    case 'timer': return '제한 시간 안에 해체합니다. 다음 차례는 먼저 자원한 사람이 맡으며, 대원이 셋 이상 남았을 때 같은 사람이 연속으로 맡을 수 없습니다.';
    case 'blue_value_is_red': return '목표 숫자의 파란 전선은 빨강처럼 취급합니다. 해당 값을 선언해 절단하지 말고 빨강만 남으면 안전하게 공개하세요.';
    case 'equipment_extra_number_lock': return '공용 장비는 원래 활성화 조건과 옆에 놓인 추가 숫자 한 쌍의 절단 조건을 모두 충족해야 합니다.';
    case 'triple_red_cut': return '빨간 전선 세 개를 한 번의 특별 행동으로 지목해 절단합니다. 하나라도 틀리면 즉시 폭발합니다.';
    case 'captain_failure_explodes': return `대장의 협력 절단 실패는 즉시 폭발합니다. 대장은 안정기${rule.forbidSharedEquipment ? '와 공용 장비' : ''}${rule.forbidPersonalEquipment ? ' 및 개인 장비' : ''}를 사용할 수 없습니다.`;
    case 'hidden_equipment_completion': return '공개된 목표 숫자 네 개를 모두 절단하면 비공개 장비 한 장을 즉시 사용 가능하게 받고 다음 목표를 공개합니다.';
    case 'false_hints': return `${rule.players === 'all' ? '모두' : '대장'} 실제 값과 다른 숫자 단서를 사용합니다. 단서는 그 값이 아니라는 뜻입니다.${rule.sharedEquipmentForbidden ? ' 대장은 공용 장비를 직접 사용할 수 없습니다.' : ''}`;
    case 'radar_director': return '진행자가 공개한 숫자의 레이더 결과를 보고 절단할 대원을 지명합니다. 지명된 대원이 그 숫자를 절단한 뒤 진행자 왼쪽부터 이어갑니다.';
    case 'audio': return '공식 음성의 지시를 한국어 안내와 서버 타이머로 진행합니다. 안내 중에는 절단을 멈추고 표시된 선택을 완료하세요.';
    case 'x_wire': return `X 전선은 맨 오른쪽에 놓이며 숫자순 위치가 아닙니다. 모든 장비 효과에서 제외합니다.${rule.unlockAfterYellowCount ? ' 노랑을 모두 절단한 뒤에만 X 전선을 절단할 수 있습니다.' : ' 일반 절단 규칙은 그대로 적용합니다.'}`;
    case 'parity_hints': return '숫자 단서 대신 홀수·짝수 단서를 사용합니다. 시작 정보, 실패 정보, 포스트잇 모두 동일합니다.';
    case 'absent_hints': return '시작할 때 받침대에 없는 값 두 개를 알립니다. 노랑 한 쌍을 절단하면 각자 왼쪽 대원에게 줄 단서 값을 선택합니다.';
    case 'quad_cut_reward': return `목표 숫자는 특별 행동으로 네 개를 동시에 절단해야 합니다. 성공하면 남아 있는 ${rule.reward === 'equipment' ? '장비' : '정보 토큰'}를 받으며, 성공 전 라운드가 지날 때마다 보상이 하나 줄어듭니다.`;
    case 'multiplicity_hints': return '단서는 값이 아니라 그 받침대에 같은 값이 몇 개 있는지 표시합니다. 이미 절단한 전선도 개수에 포함하며, 교환한 전선의 단서는 제거합니다.';
    case 'communication': return rule.restriction === 'no_numbers' ? '숫자를 말할 수 없습니다. 손짓과 모양으로 의사소통하고, 위반하면 신고 버튼으로 기폭기를 한 칸 전진시킵니다.' : rule.restriction === 'silent_except_oxygen' ? '대화는 금지하며 산소가 필요하다는 신호만 허용합니다. 위반 신고는 기록으로 남깁니다.' : '공개 숫자를 가진 대원은 자원할 수 있습니다. 자원자가 없으면 진행자가 지명하며, 허용된 자원 의사표현 외의 대화 위반은 기폭기 +1입니다.';
    case 'number_cycle': return '공개 숫자 중 하나를 선언하고 그 카드를 뒤집습니다. 남은 숫자를 선언할 수 없으면 패스하며, 모두 뒤집히면 완료하지 않은 숫자들을 다시 공개합니다.';
    case 'disable_personal_equipment': return `${rule.players === 'all' ? '모든 대원' : '대장'}은 개인 장비를 사용할 수 없습니다.`;
    case 'yellow_pair_hint_reward': return '노랑 한 쌍을 절단하면 무작위 정보 토큰을 대원 수만큼 공개하고 대장부터 하나씩 선택해 놓습니다.';
    case 'hidden_number_prediction': return '앞 대원이 이번 절단 숫자를 비공개로 예측합니다. 실제 성공한 값과 같으면 기폭기가 한 칸 전진하며, 예측 카드는 절단한 대원에게 넘어갑니다.';
    case 'constraints': {
      const setup = { choose_individual: '자신이 고른 제약을 지킵니다. 자기 차례에 지킬 수 없으면 영구 해제합니다.', captain_changes_global: '모두 공통 제약을 지킵니다. 차례 시작에 대장이 다음 제약으로 교체할 수 있습니다.', completed_changes_global: '모두 공통 제약을 지키며 숫자 네 개를 완료할 때 다음 제약으로 바꿉니다.', number_linked: '숫자 네 개를 완료하면 그 숫자에 연결된 제약이 새 공통 제약이 됩니다.', rotating_individual: '각자 앞의 제약을 지킵니다. 대장 차례에 방향을 골라 제약들을 회전할 수 있고, 새 제약 교체는 기폭기 +1입니다.' }[rule.mode];
      return `${setup} 제약 때문에 절단할 수 없을 때만 패스합니다.${rule.noActionRound === 'explode' ? ' 한 라운드 동안 모두 행동할 수 없으면 폭발합니다.' : rule.noActionRound === 'advance_and_replace' ? ' 모두 패스하면 기폭기 +1 후 다음 제약으로 바꿉니다.' : ''}`;
    }
    case 'secret_constraint_role': return '자신의 비밀 역할·제약만 확인하세요. 약한 고리만 제약을 지킵니다. 다른 대원은 차례 시작에 역할자와 제약을 함께 추측할 수 있습니다. 오답은 기폭기 +1, 역할자가 행동 불능을 선언하면 +2입니다.';
    case 'reverse_wires': return `역방향 전선은 동료에게만 보입니다. 자기 역방향 전선을 선언할 때 틀리면 즉시 폭발하며 장비를 적용할 수 없습니다. 동료가 이 전선을 절단하는 것은 ${rule.otherCut === 'forbidden' ? '금지됩니다' : '기폭기 +1입니다'}.`;
    case 'yellow_single_cut': return '노랑은 동료 전선 하나를 지목하는 특별 절단으로 처리합니다. 성공하면 기폭기를 한 칸 되돌립니다. 노랑을 보유하지 않아도 시도할 수 있습니다.';
    case 'nano_reserve': return '나노가 차례마다 1~12 사이를 왕복합니다. 나노 위치와 같은 값을 성공적으로 절단하면 보관된 전선 하나를 받아 정렬합니다. 나노의 전선도 모두 처리해야 승리합니다.';
    case 'oxygen': return rule.mode === 'shared_round' ? '1~4/5~8/9~12 절단 시 공용 산소 1/2/3개를 가져옵니다. 라운드 끝에 사용 산소를 돌려놓습니다. 산소 부족 또는 자발적 패스는 기폭기 +1입니다.' : rule.mode === 'transfer_exact' ? '절단할 숫자만큼 산소를 다른 대원 한 명에게 먼저 넘깁니다. 대상과 수령자는 달라도 됩니다. 패스하면 기폭기 +1이며, 퇴장한 대원의 산소는 제거됩니다.' : rule.mode === 'pay_bands' ? '1~4/5~8/9~12 절단 시 자기 산소 1/2/3개를 냅니다. 한 숫자를 완료하면 활동 중인 대원 모두 산소 하나를 받습니다. 산소가 부족해 패스하면 기폭기 +1입니다.' : '산소는 대장부터 시작합니다. 절단할 숫자만큼 공용 공간에 내고, 남은 산소를 다음 대원에게 넘깁니다. 라운드가 돌아오면 공용 산소를 다시 받습니다.';
    case 'volunteer_number': return '이번 숫자를 절단할 대원이 자원합니다. 없으면 진행자가 지명하며, 지명된 대원이 그 숫자가 없으면 단서를 놓고 기폭기를 한 칸 전진시킵니다.';
    case 'sevens_last': return '7은 일반 절단할 수 없습니다. 자신에게 7만 남았을 때 특별 행동으로 전체 7 네 개를 한꺼번에 지목합니다.';
    case 'arithmetic': return '숫자 카드 두 장의 합이나 차로 자신이 절단할 값을 만듭니다. 사용한 카드는 뒤집습니다. 패스하면 기폭기 +1입니다.';
    case 'triple_yellow_cut': return '노랑은 특별 행동으로 세 개를 동시에 지목해 절단합니다. 오답은 선택한 전선들에 단서를 놓고 기폭기 +1, 빨강 지목은 즉시 폭발입니다.';
    case 'memory_hints': return '시작할 때 색상 후보 위치를 기억한 뒤 가립니다. 정보 토큰은 위치를 잠깐 보여준 후 받침대 옆으로 이동하며, 숫자 완료 표시는 사용하지 않습니다.';
    case 'number_director': return '진행자가 숫자를 뽑고 절단할 대원을 지명합니다. 해당 값이 없으면 단서를 놓고 기폭기 +1, 빨강만 가진 대원을 지명하면 즉시 폭발합니다.';
    case 'nano_race': return '기폭기 대신 나노를 이동합니다. 성공은 +1, 나노 위치 값의 성공은 −1, 협력 절단 실패는 +2이며 12에 도달하면 폭발합니다.';
    case 'challenges': return '공개된 도전을 달성할 때마다 기폭기를 한 칸 되돌립니다. 도전을 모두 완료하지 않아도 일반 해체 조건으로 승리할 수 있습니다.';
    case 'unlimited_detector': return '개인 더블 탐지기를 횟수 제한 없이 사용합니다. 시작·실패 정보 토큰은 놓지 않으며 다른 개인 장비는 선택하지 않습니다.';
    case 'nano_path': return '나노가 보는 방향의 현재 또는 앞쪽 숫자 중 자신이 절단할 값을 고릅니다. 절단 후 방향을 유지하거나 반대로 바꿀 수 있습니다. 진행할 수 없으면 기폭기 +1 후 방향을 뒤집습니다.';
    case 'number_healing': return '공개된 숫자 네 개를 모두 절단하면 해당 카드를 제거하고 기폭기를 한 칸 되돌립니다.';
    case 'number_pass': return '자신이 가진 숫자 카드의 값만 절단합니다. 차례가 끝나면 카드 한 장을 다른 대원에게 넘깁니다. 전선이 모두 사라졌는데 넘긴 후에도 카드가 남으면 즉시 폭발합니다.';
    case 'bunker': return '성공·실패 절단 후 선언 숫자에 맞는 방향으로 이동합니다. 벽은 통과할 수 없습니다. 목표의 줄무늬 칸에서는 행동 제약에 맞는 절단을 성공해야 합니다. 솔로 네 개 절단은 이동·행동 두 번입니다. 노랑은 레이저 해제 지시가 있을 때만 절단합니다.';
  }
}

export function bombCampaignInstructions(definition: BombCampaignDefinition): string {
  return definition.rules.map(describe).join(' ');
}
