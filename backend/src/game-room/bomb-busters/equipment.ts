import { BombEquipment } from '../entities/bomb-busters-game-state.entity';

type EquipmentDefinition = Omit<BombEquipment, 'used' | 'unlocked'>;

const definitions = [
  { id: 1, name: '≠ 표식', description: '자신의 서로 다른 값의 인접 전선 둘에 표식을 놓습니다. 둘 중 하나는 절단되어 있어도 됩니다.' },
  { id: 2, name: '무전기', description: '자신과 동료가 미절단 전선 하나씩 비공개로 선택해 교환합니다. 받침대가 둘이면 꺼낸 받침대로 받아 정렬합니다.' },
  { id: 3, name: '트리플 탐지기', description: '내 차례의 협력 절단에서 한 받침대의 전선 3개(2개만 남으면 2개)를 탐지합니다. 파란 숫자만 선언합니다.' },
  { id: 4, name: '포스트잇', description: '자신의 파란 전선 하나에 정보 토큰을 놓습니다. 차례 밖에도 사용할 수 있습니다.' },
  { id: 5, name: '슈퍼 탐지기', description: '내 차례의 협력 절단에서 동료 받침대 하나 전체를 탐지합니다. 파란 숫자만 선언합니다.' },
  { id: 6, name: '되감기', description: '기폭기를 1칸 되돌립니다. 차례 밖에도 사용할 수 있습니다.' },
  { id: 7, name: '비상 배터리', description: '사용한 개인 더블 탐지기 1~2개를 다시 충전합니다. 차례 밖에도 사용할 수 있습니다.' },
  { id: 8, name: '전체 레이더', description: '숫자 1~12를 선언합니다. 각 받침대에 그 숫자의 미절단 전선이 있는지만 공개합니다.' },
  { id: 9, name: '안정기', description: '내 차례의 협력 절단 전에 사용합니다. 그 차례 오답은 기폭기를 움직이지 않고 빨강도 폭발하지 않습니다.' },
  { id: 10, name: 'X/Y 광선', description: '내 차례의 협력 절단에서 전선 하나에 값 두 개를 선언합니다. 두 값 모두 자신의 미절단 전선에 있어야 하며 노랑도 가능합니다.' },
  { id: 11, name: '커피잔', description: '내 차례를 건너뛰고 다음 플레이어를 지명합니다. 그 사람부터 시계 방향으로 진행합니다.' },
  { id: 12, name: '= 표식', description: '자신의 같은 값의 인접 전선 둘에 표식을 놓습니다. 둘 중 하나는 절단되어 있어도 됩니다. 노랑끼리·빨강끼리도 가능합니다.' },
];

export const BOMB_BUSTERS_EQUIPMENT: EquipmentDefinition[] = [...definitions.map(equipment => ({
  ...equipment, unlock: { value: equipment.id, count: 2 },
})),
  { id: 13, name: '이중 바닥', description: '노랑 한 쌍을 절단하면 장비 2장을 즉시 추가합니다. 이미 충족한 활성화 조건도 적용합니다.', unlock: { value: 'yellow', count: 2 } },
  { id: 14, name: '단일 전선 표식', description: '자신의 파란 전선 하나가 그 받침대에 유일한 값임을 표시합니다. 절단된 전선도 개수에 포함합니다.', unlock: { value: 2, count: 4 } },
  { id: 15, name: '긴급 보급', description: '사용한 공용 장비를 전부 즉시 재충전합니다.', unlock: { value: 3, count: 4 } },
  { id: 16, name: '패스트패스', description: '내 차례에 같은 값 2개를 단독 절단합니다. 동료에게 같은 값이 남아 있어도 됩니다.', unlock: { value: 9, count: 4 } },
  { id: 17, name: '분해기', description: '공급처의 숫자 정보 토큰 하나를 무작위로 뽑아 해당 값의 남은 전선을 모두 즉시 절단합니다.', unlock: { value: 10, count: 4 } },
  { id: 18, name: '갈고리', description: '동료의 미절단 전선 하나를 공개하지 않고 가져와 자신의 받침대에 정렬합니다. 이동 전후 위치는 공개합니다.', unlock: { value: 11, count: 4 } },
];
