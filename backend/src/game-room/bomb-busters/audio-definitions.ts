export interface BombAudioStep {
  kind: string;
  title: string;
  instructions: string[];
  durationSeconds: number | null;
}
const step = (kind: string, title: string, durationSeconds: number | null, ...instructions: string[]): BombAudioStep => ({kind,title,durationSeconds,instructions});
export const BOMB_AUDIO_SOURCE_URLS: Record<number,string> = {
  19:'https://cdn.pegasus.de/public/media/d6/e0/54/1759224869/BB-Final_Mission-19.mp3?ts=1759240277',
  30:'https://cdn.pegasus.de/public/media/44/46/01/1759224867/BB-Final_Mission-30.mp3?ts=1759240277',
  42:'https://cdn.pegasus.de/public/media/96/d0/2a/1759224868/BB-Final_Mission-42.mp3?ts=1759240277',
  54:'https://cdn.pegasus.de/public/media/d4/e9/5f/1759224868/BB-Final_Mission-54.mp3?ts=1759240277',
  66:'https://cdn.pegasus.de/public/media/1a/1d/84/1759224868/BB-Final_Mission-66.mp3?ts=1759240277',
};
export const BOMB_AUDIO_STEPS: Record<number,BombAudioStep[]> = {
  19:[
    step('normal','15분 카운트다운 시작',180,'평소처럼 전선을 절단하세요. 3분 뒤 다음 안내가 나옵니다.'),
    step('normal','12분 남았습니다',120,'해체를 계속하세요. 2분 뒤 다음 안내가 나옵니다.'),
    step('normal','남은 시간이 5분으로 줄었습니다',180,'10분 남음 안내 직후 기폭 시간이 5분으로 단축되었습니다.'),
    step('normal','2분 남았습니다',90,'해체를 계속하세요.'),
    step('normal','마지막 30초',30,'남은 전선을 모두 처리하세요.'),
  ],
  30:[
    step('normal','버스의 폭탄',20,'평소 차례대로 절단하세요. 곧 숫자 목표가 나타납니다.'),
    step('target','첫 번째 숫자 목표',20,'목표 숫자 전선이 2개 이상 잘려 있어야 합니다. 이미 절단된 전선도 인정됩니다.'),
    step('target_penalty','다음 숫자 목표',20,'직전 목표 실패 시 기폭기가 1칸 전진합니다.'),
    step('target_neutral','속도를 유지하세요',20,'직전 목표의 성공·실패에는 보상과 벌점이 없습니다.'),
    step('target_equipment','장비를 지키세요',20,'직전 목표 실패 시 공개 장비 중 가장 작은 번호를 제거합니다.'),
    step('target_yellow','15초 숫자 목표',15,'직전 목표 성공 시 전원이 자기 노랑 개수를 공개합니다.'),
    step('target_mute','몸짓으로 전달',15,'직전 목표 실패 시 현재 플레이어는 이후 말 대신 몸짓으로 전달합니다.'),
    step('target_presence','숫자 보유 여부',15,'직전 목표 성공 시 현재 플레이어는 무작위 숫자 보유 여부를 공개합니다.'),
    step('three_targets','세 가지 숫자',120,'직전 목표 성공 시 그 값의 남은 전선을 즉시 처리합니다. 새 숫자 3개의 전선 네 개씩만 절단하세요. 해당 값이 없으면 패스합니다.'),
    step('yellow_rescue','마지막 기회',120,'세 숫자를 모두 처리했다면 즉시 승리합니다. 아니라면 현재 플레이어가 남은 노랑 전부를 한 번에 맞혀야 합니다. 성공하면 나머지 전선을 2분 안에 처리하세요.'),
  ],
  42:[
    step('normal','서커스에 잠입',33,'이 미션에는 전체 시간제한이 없습니다. 사건 사이에 절단을 계속하세요.'),
    step('magician','마술사',41,'다른 플레이어의 화면을 가립니다. 같은 값의 절단 전선 한 쌍을 원래 받침대에 복구합니다. 다음 사람 차례가 됩니다.'),
    step('rotate_left','왼쪽 자리로',21,'받침대를 두고 모두 왼쪽 자리로 옮깁니다. 현재 플레이어가 새 전선으로 차례를 계속합니다.'),
    step('juggler','저글링',15,'자신의 이미 절단된 전선 중 서로 다른 값 2개의 위치를 바꿉니다.'),
    step('rotate_right','오른쪽 자리로',23,'받침대를 두고 모두 오른쪽 자리로 옮깁니다.'),
    step('knife','칼 던지기',27,'현재 플레이어의 이미 절단된 전선을 받침대에서 치웁니다. 미절단 위치는 유지합니다.'),
    step('ta_da','절단 후 완료 구호',31,'이제 절단 성공 뒤 완료 구호 버튼을 누릅니다. 빠뜨린 경우 뒤의 점검에서 벌점을 받을 수 있습니다.'),
    step('magician','다시 마술사',47,'같은 값의 절단 전선 한 쌍을 복구하고 다음 사람 차례로 넘깁니다.'),
    step('juggler','다시 저글링',32,'현재 플레이어의 서로 다른 값인 절단 전선 두 개의 위치를 바꿉니다.'),
    step('remove_validation','완료 표시가 사라졌습니다',21,'완료 표시를 게임 끝까지 숨깁니다. 이미 잘린 숫자를 기억하세요.'),
    step('boing','트램펄린',22,'현재 플레이어부터 시계방향으로 구호 버튼을 누르세요.'),
    step('check_ta_da','직전 완료 구호 점검',27,'직전 절단자가 완료 구호를 빠뜨렸으면 기폭기 1칸을 전진합니다.'),
    step('magician','세 번째 마술',24,'같은 값의 절단 전선 한 쌍을 복구하고 다음 사람 차례로 넘깁니다.'),
    step('boing','다시 트램펄린',31,'현재 플레이어부터 시계방향으로 구호 버튼을 누르세요.'),
    step('boing','트램펄린!',40,'현재 플레이어부터 시계방향으로 구호 버튼을 누르세요.'),
    step('rotate_right','다시 오른쪽 자리로',53,'받침대를 두고 모두 오른쪽 자리로 옮깁니다.'),
    step('boing','마지막 트램펄린',null,'구호를 마친 뒤 남은 전선을 계속 해체합니다. 이후 시간제한은 없습니다.'),
  ],
  54:[
    step('normal','잠수함 해체 시작',45,'순수 작업시간은 총 10분입니다. 절단 전에 숫자 구간에 맞는 산소를 지불합니다.'),
    step('insert_red','침수: 빨강 추가',40,'현재 플레이어가 빨강 전선 하나를 받아 정렬합니다. 다른 사람에게 값은 공개하지 않습니다.'),
    step('repeat','비상 추가 차례',35,'현재 플레이어는 이번 행동 뒤 한 차례 더 행동합니다.'),
    step('oxygen','산소통 발견',75,'현재 플레이어가 산소 1개를 받습니다.'),
    step('insert_red','침수: 빨강 추가',25,'현재 플레이어에게 빨강 전선을 하나 추가합니다.'),
    step('transfer','산소 교환',50,'현재 플레이어는 동료 한 명과 원하는 양의 산소를 주거나 받을 수 있습니다.'),
    step('oxygen','산소통 발견',30,'현재 플레이어가 산소 1개를 받습니다.'),
    step('insert_red','침수: 빨강 추가',25,'현재 플레이어에게 빨강 전선을 하나 추가합니다.'),
    step('repeat','비상 추가 차례',35,'현재 플레이어가 한 차례 더 연속 행동합니다.'),
    step('normal','4분 남았습니다',25,'해체를 계속하세요.'),
    step('insert_red','침수: 빨강 추가',25,'현재 플레이어에게 빨강 전선을 하나 추가합니다.'),
    step('transfer','산소 교환',35,'현재 플레이어는 동료 한 명과 산소를 주거나 받을 수 있습니다.'),
    step('insert_red','침수: 빨강 추가',25,'현재 플레이어에게 빨강 전선을 하나 추가합니다.'),
    step('insert_red','연속 침수',10,'현재 플레이어에게 빨강 전선을 하나 추가합니다.'),
    step('normal','2분 남았습니다',25,'해체를 계속하세요.'),
    step('transfer','마지막 산소 교환',55,'현재 플레이어는 동료 한 명과 산소를 주거나 받을 수 있습니다.'),
    step('normal','마지막 해체 구간',40,'남은 전선을 모두 처리하세요. 웹 버전은 실제 숨 참기를 요구하지 않습니다.'),
  ],
  66:[
    step('open_door','벙커 문 열기',80,'열쇠 칸에 도착한 뒤 ACTION 제약에 맞는 절단을 성공하세요. 성공 후 다음 지시까지 대기합니다.'),
    step('neutralize_guard','경비 제압',75,'경비 칸에서 ACTION 제약에 맞는 절단을 성공하세요.'),
    step('reach_basement','지하로 이동',60,'계단에 도착해 지하 지도로 내려가세요.'),
    step('disable_laser','레이저 해제',90,'레버 칸에서 노랑 두 개를 맞히세요. 자신에게 노랑이 없어도 시도할 수 있습니다.'),
    step('bunker_swap','제약 카드 재배치',10,'원하면 10초 안에 북·동·남·서·ACTION 제약을 재배치하세요.'),
    step('handcuff_doctor','닥터 노프 체포',105,'닥터 칸에 도착하여 ACTION 제약에 맞는 절단을 성공하세요.'),
    step('finish_defusal','마지막 20초',20,'남은 전선을 모두 처리하세요.'),
  ],
};
