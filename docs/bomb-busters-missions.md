# 봄버스터즈 미션 1–66 조사

확인일: **2026-09-20**. 기본판 **66개 미션의 앞뒷면 132장**을 전부 확보해 직접 읽고, 전선 구성·특수 준비·핵심 진행 규칙·2인 변경점을 한국어로 정리했다. 카드 원문 전체 번역이 아닌 규칙 요약이며 한국어 제목은 설명용 임시 번역이다.

## 출처와 확인 범위

- 주 근거: 공개 TTS용 [영문 미션 카드 스캔](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/). 제작사 공식 배포 사이트는 아니다. 각 미션 끝에 실제 앞면·뒷면 링크를 넣었다.
- 공식 검증: [기본 룰북](https://www.cocktailgames.com/wp-content/uploads/2023/10/BombBusters_rules_EN.pdf), [제작사 FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/). 아래 ‘정정’은 FAQ의 해석·보완·오류 수정을 포함한다.
- 발견 경로와 보조 대조: [TTS 스크립트 저장소](https://github.com/Brawlboxgaming/Bomb-Busters-Scripted). 코드보다 실물 카드 내용을 우선했다.
- 관련 자료: [제약·도전·장비·규칙 스티커·벙커 지도·공식 음원](bomb-busters-mission-components.md), [66개 원본 링크 JSON](bomb-busters-mission-sources.json).

**19·30·42·54·66번은 음성 미션이다.** 공식 음원 5개의 접근 가능 여부도 확인했다. 이 문서는 카드에 적힌 규칙을 정리하며 음원의 시간별 지시를 전사한 자료는 아니다. 해당 미션의 전체 진행은 연결된 음원이 추가로 필요하다. 66번 벙커 지도도 원본을 연결했으며 격자를 코드로 전사하지 않았다.

이 문서는 조사 결과이고 현재 웹앱의 구현 완료 목록은 아니다. 현재 지원 모드는 [구현 문서](bomb-busters.md)를 따른다.

## 읽는 법

- 별도 지시가 없으면 파랑은 **1–12 각 4개, 총 48개**다. 훈련 1·2·3은 각각 1–6, 1–8, 1–10만 사용한다.
- `빨강 2/3`은 공개한 후보 3개 중 무작위 2개를 실제 사용하고 나머지는 비공개 제외한다는 뜻이다. `노랑 2/3`도 같다. 단순히 ‘빨강 2개’이면 실제 사용한 2개의 후보 값이 알려진다.
- 따로 쓰지 않은 준비·행동·승패는 기본 규칙을 적용한다. 2인 변경이 없어도 기본 규칙에 따라 두 받침대를 쓴다. **34·65번은 2인 플레이 불가**다.
- ‘협력 절단’, ‘듀얼 절단’은 같은 Dual Cut이다. ‘단독 절단’, ‘솔로 절단’은 Solo Cut이다. 완료 토큰은 특정 파란 숫자 네 개를 모두 처리했음을 표시한다.
- 반복 설명을 줄이기 위해 공용 장비 효과와 9·31·55번부터의 추가 규칙은 [부속 규칙 문서](bomb-busters-mission-components.md)에 모았다. 미션별 예외가 우선한다.

| 구간 | 바로가기 |
| --- | --- |
| 훈련 1–8 | [1](#mission-1) · [2](#mission-2) · [3](#mission-3) · [4](#mission-4) · [5](#mission-5) · [6](#mission-6) · [7](#mission-7) · [8](#mission-8) |
| 첫 상자 9–19 | [9](#mission-9) · [10](#mission-10) · [11](#mission-11) · [12](#mission-12) · [13](#mission-13) · [14](#mission-14) · [15](#mission-15) · [16](#mission-16) · [17](#mission-17) · [18](#mission-18) · [19](#mission-19) |
| 두 번째 상자 20–30 | [20](#mission-20) · [21](#mission-21) · [22](#mission-22) · [23](#mission-23) · [24](#mission-24) · [25](#mission-25) · [26](#mission-26) · [27](#mission-27) · [28](#mission-28) · [29](#mission-29) · [30](#mission-30) |
| 세 번째 상자 31–42 | [31](#mission-31) · [32](#mission-32) · [33](#mission-33) · [34](#mission-34) · [35](#mission-35) · [36](#mission-36) · [37](#mission-37) · [38](#mission-38) · [39](#mission-39) · [40](#mission-40) · [41](#mission-41) · [42](#mission-42) |
| 네 번째 상자 43–54 | [43](#mission-43) · [44](#mission-44) · [45](#mission-45) · [46](#mission-46) · [47](#mission-47) · [48](#mission-48) · [49](#mission-49) · [50](#mission-50) · [51](#mission-51) · [52](#mission-52) · [53](#mission-53) · [54](#mission-54) |
| 마지막 상자 55–66 | [55](#mission-55) · [56](#mission-56) · [57](#mission-57) · [58](#mission-58) · [59](#mission-59) · [60](#mission-60) · [61](#mission-61) · [62](#mission-62) · [63](#mission-63) · [64](#mission-64) · [65](#mission-65) · [66](#mission-66) |

<a id="mission-1"></a>

## 1. 훈련 1일차 — TRAINING, Day 1

- 전선: 파랑 1–6 각 4개, 총 24개. 노랑·빨강 없음. 2인 별도 구성 변경 없음.
- 준비: 공용 장비를 사용하지 않는다. 기폭기는 인원수에 맞추고 각자 개인 이중 탐지기를 한 번 사용할 수 있다. 대장부터 시계 방향으로 각자 자신의 파란 전선 하나에 일치하는 정보 토큰을 놓는다.
- 진행: 협력 절단으로 자신의 전선과 동료의 같은 값 전선을 하나씩 자른다. 오답이면 기폭기 1칸 전진, 대상 전선에 실제 값 토큰 표시. 자신의 절단 예정 위치는 공개하지 않는다. 한 숫자의 남은 전선 전부(4개 또는 마지막 2개)를 혼자 보유하면 단독 절단한다.
- 의존: 기본 구성물만. 모든 전선 처리 시 성공, 기폭 시 실패.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%201%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%201%20Back.png)

<a id="mission-2"></a>

## 2. 훈련 2일차 — TRAINING, Day 2

- 전선: 파랑 1–8 각 4개, 총 32개. 노랑 1.1–7.1에서 무작위 2개. 빨강 없음. 2인 별도 변경 없음.
- 준비: 공용 장비 없음. 시작 정보 토큰으로 노란 전선을 알려줄 수 없다.
- 진행: 노랑은 정렬할 때만 소수 값이 있고 절단할 때는 모두 같은 값인 ‘노랑’으로 취급한다. 노란 전선을 가진 사람이 동료의 전선을 ‘노랑’으로 선언해 협력 절단하거나, 남은 노란 전선 전부를 보유하면 단독 절단할 수 있다. 노란 전선을 숫자로 잘못 추측했다면 노란 정보 토큰으로 표시한다. 파란 전선과 기폭 처리, 성공 조건은 기본 규칙과 같다.
- 의존: 노란 전선·노란 정보 토큰. 새로운 공용 장비나 카드 없음.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%202%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%202%20Back.png)

<a id="mission-3"></a>

## 3. 훈련 3일차 — TRAINING, Day 3

- 전선: 파랑 1–10 각 4개, 총 40개. 빨강 1.5–9.5 중 무작위 1개. 노랑 없음. 2인 별도 구성 변경 없음.
- 준비: 이 미션부터 공용 장비를 인원수만큼 무작위로 배치한다. 이 미션에서는 장비 2(무전기)와 12(= 표식)를 제외하고 다시 뽑는다.
- 진행: 빨간 전선을 절단하면 즉시 실패한다. 자기 차례 시작에 빨강만 남았다면 모두 공개하고 이후 행동에서 빠진다. 공용 장비는 해당 숫자의 전선 2개를 처음 절단하면 활성화되며, 한 번 사용한 뒤 뒤집는다. 나머지 전선을 모두 처리하면 성공한다.
- 의존: 빨간 전선·기본 공용 장비 카드. 준비가 충분하면 훈련 4–7을 거치지 않고 8번 시험으로 이동해도 된다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%203%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%203%20Back.png)

<a id="mission-4"></a>

## 4. 첫 현장 훈련 — TRAINING: First Day in the Field

- 전선: 파랑 48개, 빨강 1개, 노랑 2개. 2인은 노랑만 4개로 늘린다.
- 준비: 이 미션부터 파랑 1–12 전체를 쓴다. 공용 장비를 인원수만큼 배치하고 기존 시작 준비를 따른다.
- 진행: 지금까지 배운 파랑·노랑·빨강과 장비 규칙을 함께 적용한다. 노랑 2개를 한 쌍으로 자르고, 2인에서 4개일 때도 같은 값인 노랑으로 처리한다. 빨강은 절단하지 않고 소유자의 마지막 전선이 되었을 때 공개한다. 장비는 대응 숫자의 전선 2개가 절단된 뒤 활성화된다.
- 의존: 기본 구성물 전체. 새로운 추가 규칙은 없으며 기본 성공·실패 조건을 따른다. 준비가 되면 8번으로 건너뛸 수 있다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%204%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%204%20Back.png)

<a id="mission-5"></a>

## 5. 두 번째 현장 훈련 — TRAINING: Second Day in the Field

- 전선: 파랑 48개, 빨강 1개, 노랑 2/3. 2인은 빨강을 2개로 늘린다.
- 준비: 노란 전선 3개를 공개해 보드에 후보 위치를 물음표 마커로 표시한다. 세 전선을 뒤집어 섞고 2개만 다른 전선과 섞으며, 나머지 1개는 누구에게도 보여주지 않고 제외한다.
- 진행: 실제 노랑은 2개지만 가능한 값은 3곳이므로 어떤 후보가 빠졌는지 추리한다. 노랑의 절단 자체는 평소처럼 한 쌍으로 처리한다. 파랑·빨강·장비·승패 규칙은 기존과 같다.
- 의존: 물음표 면이 있는 노란 마커 3개. 별도 특수 카드 없음. 훈련을 충분히 익혔다면 8번 시험으로 이동할 수 있다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%205%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%205%20Back.png)

<a id="mission-6"></a>

## 6. 세 번째 현장 훈련 — TRAINING: Third Day in the Field

- 전선: 파랑 48개, 빨강 1개, 노랑 4개. 2인은 빨강만 2개로 늘린다.
- 준비: 일반 준비를 따르며, 노랑 4개의 후보 값은 모두 알려져 있다.
- 진행: 노랑 4개는 소수 값이 서로 달라도 절단상 같은 값이다. 보통 협력 절단 두 번으로 2개씩 처리한다. 단독 절단은 자신의 손에 남은 노랑 전부가 있어야 하며, 처음 4개 전부 또는 다른 한 쌍이 이미 절단된 뒤 마지막 2개일 때 가능하다. 노랑 4개 중 2개만 가진 상태에서는 단독 절단할 수 없다.
- 의존: 기본 구성물만. 별도 승패 변경 없음. 자신이 있으면 8번 시험으로 이동할 수 있다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%206%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%206%20Back.png)

<a id="mission-7"></a>

## 7. 마지막 수업 — TRAINING: Last Day of Class

- 전선: 파랑 48개, 빨강 1/2, 노랑 없음. 2인은 빨강 1/3으로 바꾼다.
- 준비: 빨간 전선 후보 2개(2인은 3개)를 공개하고 보드에 물음표 마커를 놓는다. 후보 전선을 뒤집어 섞어 그중 1개만 전선 더미에 넣고 나머지는 비공개로 제외한다.
- 진행: 실제 빨간 전선은 하나지만 가능한 값이 두 곳 또는 세 곳이라 위치를 확정할 수 없다. 기본 절단·장비·기폭 규칙을 그대로 적용하고, 빨간 전선은 그 사람의 손에 빨강만 남았을 때 공개한다.
- 의존: 물음표 면이 있는 빨간 마커. 별도 특수 카드나 승패 조건 없음.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%207%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%207%20Back.png)

<a id="mission-8"></a>

## 8. 최종 시험 — FINAL EXAM

- 전선: 파랑 48개, 빨강 1/2, 노랑 2/3. 2인은 빨강 1/3, 노랑 4개로 변경한다.
- 준비: 앞선 훈련에서 익힌 공개 후보와 비공개 제외 방식을 빨강·노랑에 각각 적용한다. 일반적인 인원수별 기폭기·개인 장비·공용 장비·시작 정보 토큰을 사용한다.
- 진행: 추가 특수 규칙 없이 앞선 기본 규칙 전부를 적용하는 시험이다. 기폭 전에 모든 절단 대상 전선을 제거하고 남은 빨강을 공개하면 성공한다.
- 의존: 기본 구성물만. 성공하면 ‘미션 9–19’ 상자를 개봉한다. 실패하면 다시 도전할 수 있으며, 일회성 소모나 영구 변경을 요구하지 않는다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%208%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%208%20Back.png)

<a id="mission-9"></a>

## 9. 우선순위 — A Sense of Priorities

- 전선: 파랑 48개, 빨강 1개, 노랑 2개. 2인은 빨강 2개·노랑 4개.
- 준비: 숫자 카드 3장을 무작위로 뽑아 왼쪽부터 a·b·c 순서로 공개하고, 순서 카드 A면을 a 위에 둔다.
- 진행: a 전선 2개를 자르기 전에는 b를 자를 수 없고, a와 b를 각각 2개씩 자르기 전에는 c를 자를 수 없다. 조건을 채우면 해당 숫자 카드를 뒤집고 순서 표시를 다음 카드로 옮긴다. 나머지 숫자는 자유롭게 절단한다.
- 의존: 숫자 카드 3장·순서 카드 A. 이 상자에서 추가되는 장비 규칙은 별도 스티커 A를 확인해야 한다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 금지된 값만 남아 자기 차례에 행동할 수 없으면 패배.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%209%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%209%20Back.png)

<a id="mission-10"></a>

## 10. 힘든 하루 — A Rough Patch

- 전선: 파랑 48개, 빨강 1개, 노랑 4개. 2인에서도 전선은 같다.
- 준비: 15분 타이머를 준비한다. 2인은 12분. 장비 11(커피잔)은 뽑히면 교체한다.
- 진행: 모든 준비가 끝나면 시간을 재며 제한 시간 안에 해체해야 한다. 시계 방향 순서 대신 현재 행동이 끝난 후 먼저 행동을 선언한 사람이 다음 차례를 가진다. 다른 사람의 진행 중에는 선언하지 않는다. 동일 인물은 연속 두 차례를 맡을 수 없다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 연속 차례는 남은 플레이어가 2명 이하일 때만 허용.
- 의존: 타이머. 시간 만료는 추가 실패 조건이며 기존 기폭·성공 조건도 적용된다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2010%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2010%20Back.png)

<a id="mission-11"></a>

## 11. 파란 전선의 배신 — Blue on Red, Looks Like We Are Dead

- 전선: 파랑 48개, 노랑 2개, 실제 빨강 없음. 2인은 노랑 4개이며 대장은 시작 정보 토큰을 놓지 않는다.
- 준비: 숫자 카드 1장을 무작위로 뽑아 미션 카드의 지정 영역에 공개한다.
- 진행: 공개 숫자에 해당하는 파란 전선 4개를 빨간 전선처럼 취급한다. 이 숫자의 전선을 절단하면 즉시 실패한다. 자신의 손에 해당 전선만 남았을 때 자기 차례에 공개할 수 있다. 그 외 숫자와 노랑은 기본 규칙으로 해체한다.
- 의존: 숫자 카드 1장. 실제 빨간 타일을 쓰지 않더라도 지정된 파란 전선 4개가 위험 전선 역할을 한다. 전선 처리와 공개를 모두 마치면 성공한다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2011%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2011%20Back.png)

<a id="mission-12"></a>

## 12. 서류에 묶인 장비 — Wrapped in Red Tape

- 전선: 파랑 48개, 빨강 1개, 노랑 4개. 2인은 빨강 2개.
- 준비: 사용할 공용 장비마다 숫자 카드 1장을 공개해 덮는다. 장비 본래 숫자가 보이도록 겹쳐 놓는다.
- 진행: 장비를 활성화하려면 장비에 적힌 숫자의 전선 2개뿐 아니라, 덮인 숫자 카드의 전선 2개도 절단되어 있어야 한다. 숫자 카드 조건을 채우면 그 카드부터 제거한다. 두 조건이 모두 충족된 장비만 사용할 수 있다. 다른 절단·기폭·승리 규칙은 그대로다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 같은 숫자 한 쌍으로 장비와 덮개 카드를 동시에 해제.
- 의존: 장비 수만큼의 숫자 카드.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2012%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2012%20Back.png)

<a id="mission-13"></a>

## 13. 적색경보 — Red Alert!

- 전선: 파랑 48개, 빨강 3개, 노랑 없음. 빨강은 섞어 배분하지 않고 대장부터 한 사람당 하나씩 준다. 2인은 대장이 2개를 받아 받침대마다 하나씩 놓으며 시작 정보 토큰을 놓지 않는다.
- 준비: 시작 정보 토큰은 무작위로 뽑는다. 해당 숫자가 없으면 손 옆에 공개한다. 노란 토큰은 다시 뽑는다. 빨간 후보 값은 분배 전에 공개한다.
- 진행: 특별 행동으로 남은 모든 전선 중 빨강 3개를 동시에 지목해 절단한다. 하나라도 틀리면 즉시 실패. 빨강만 남은 사람은 일반적인 빨강 공개 대신 이 행동을 해야 한다. 4–5인에서는 빨강 없는 사람도 실행 가능하다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 특수 절단에 장비 금지. 빨강이 든 받침대도 비공개.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2013%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2013%20Back.png)

<a id="mission-14"></a>

## 14. 위험한 신입 — High-Risk Bomb Disposal Expert (aka. NOOB)

- 전선: 파랑 48개, 빨강 2개, 노랑 2/3. 2인은 빨강 3개·노랑 4개.
- 준비: 인원수에 맞는 캐릭터 카드를 뒤집어 섞어 한 장씩 나누고 공개한다. 대장 카드를 받은 사람을 이 미션의 ‘신입’으로 취급한다.
- 진행: 신입이 능동적으로 시도한 협력 절단이 실패하면 기폭기의 남은 여유와 관계없이 즉시 폭발한다. 신입은 장비 9(안정기)를 사용할 수 없다. 다른 플레이어의 실패는 기본 규칙대로 처리하며, 신입의 단독 절단 등 다른 합법적인 행동을 금지하는 규정은 없다.
- 의존: 대장 구분이 있는 기본 캐릭터 카드. 무작위 역할과 신입의 실패 판정이 추가되고, 성공 조건은 기본 해체 조건과 같다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2014%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2014%20Back.png)

<a id="mission-15"></a>

## 15. 노보시비르스크 임무 — Mission in Новосибирск

- 전선: 파랑 48개, 빨강 1/3, 노랑 없음. 2인은 빨강 2/3.
- 준비: 공용 장비를 인원수만큼 뽑되 누구도 보지 않고 뒤집어 배치한다. 숫자 카드 12장을 섞어 더미로 만들고 맨 위 한 장을 공개한다.
- 진행: 현재 공개된 숫자의 전선 4개가 모두 절단되면 장비 하나를 공개하고, 장비 자체 숫자와 관계없이 즉시 활성화한다. 다음 숫자 카드를 공개해 반복한다. 새로 공개된 숫자의 전선이 이미 모두 절단되었다면 장비 보상 없이 그 숫자를 버리고 다음 숫자로 넘긴다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 노랑이 없어 이중 바닥 사용 불가.
- 의존: 숫자 카드 더미·비공개 장비. 다른 승패 조건은 기본과 같다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2015%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2015%20Back.png)

<a id="mission-16"></a>

## 16. 더 엄격한 우선순위 — Time to Reprioritize

- 전선: 파랑 48개, 빨강 1개, 노랑 2/3. 2인은 빨강 2개·노랑 4개.
- 준비: 무작위 숫자 카드 3장을 a·b·c 순으로 공개하고 순서 카드 B면을 a 위에 둔다.
- 진행: 9번과 달리 a의 전선 4개를 모두 절단해야 b를 자를 수 있다. a와 b를 각각 4개 모두 처리해야 c를 자를 수 있다. 완료한 숫자 카드는 뒤집고 순서 표시를 다음으로 이동한다. 선택되지 않은 숫자는 언제든 정상적으로 절단할 수 있다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 금지된 값만 남아 자기 차례에 행동할 수 없으면 패배.
- 의존: 숫자 카드 3장·순서 카드 B. 기본 해체 목표를 지키면서 세 숫자의 완전 절단 순서를 맞춰야 한다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2016%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2016%20Back.png)

<a id="mission-17"></a>

## 17. 거짓 단서의 대장 — Rhett Herrings

- 전선: 파랑 48개, 빨강 2/3, 노랑 없음. 2인은 빨강 3개.
- 준비: 캐릭터를 무작위로 나누어 대장 카드를 받은 사람을 특수 역할로 지정한다. 이 사람은 시작 정보 토큰을 하나 대신 두 개 놓되, 두 토큰 모두 대상 전선과 다른 숫자여야 하며 빨간 전선에는 놓을 수 없다.
- 진행: 대장 앞의 정보 토큰은 게임 내내 ‘이 전선은 이 값이 아니다’라는 뜻이다. 동료가 대장의 전선을 잘못 추측하면 실제 값 대신 방금 틀리게 선언한 숫자의 토큰을 놓는다. 대장은 공용 장비를 직접 사용할 수 없지만 다른 사람이 사용하는 무전기(2)·일반 레이더(8)의 효과에는 참여한다.
- 의존: 기본 캐릭터와 정보 토큰. 나머지 절단·승패는 기본 규칙이다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2017%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2017%20Back.png)

<a id="mission-18"></a>

## 18. 배트 레이더의 도움 — BAT-Helping-Hand

- 전선: 파랑 48개, 빨강 2개, 노랑 없음. 2인은 빨강 3개.
- 준비: 시작 정보 토큰을 놓지 않는다. 공용 장비는 일반 레이더(8)만 공개하고 숫자 카드 12장을 섞어 더미로 둔다. 레이더는 항상 사용 가능하다.
- 진행: 자기 차례에 숫자 하나를 공개하고 그 숫자로 레이더를 사용한 뒤, 자신을 포함한 한 사람을 지정해 해당 숫자 절단을 맡긴다. 숫자 네 전선이 모두 잘리면 그 카드는 제거하고, 더미가 비면 남은 카드를 섞는다. 자기 차례에 빨강만 남았다면 빨강 공개를 한다. 지난 레이더 응답을 서로 재확인할 수 없다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 절단자만 지명. 다음 차례는 원래 차례자의 왼쪽.
- 의존: 숫자 카드·일반 레이더.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2018%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2018%20Back.png)

<a id="mission-19"></a>

## 19. 괴수의 뱃속 — In the Belly of the Beast

- 전선: 파랑 48개, 빨강 1개, 노랑 2/3. 카드에 2인 전용 변경은 없다.
- 준비·진행: 일반 준비 후 미션 19 전용 음원을 재생한다. 미션 카드에는 음원 재생 지시와 QR 코드만 있고, 음원에서 전달되는 규칙·시간·사건은 카드에 적혀 있지 않다. 따라서 앞뒷면 카드만으로 이 미션을 완전히 구현할 수 없다.
- 성공 시 ‘미션 20–30’ 상자를 개봉한다. 실패 시 같은 음원을 다시 재생해 재도전한다.
- 의존: 미션 19 오디오. [공식 영문 오디오 안내](https://pegasusna.com/welcome-bomb-busters)에 파일이 제공된다. 이 요약 작성 단계에서는 오디오 내용을 아직 청취·전사하지 않았으므로 추가 규칙은 미확정이다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2019%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2019%20Back.png)

<a id="mission-20"></a>

## 20. 크고 나쁜 늑대 — The Big Bad Wolf

- 전선: 파랑 48개, 빨강 2개, 노랑 2개. 2인은 빨강 2/3·노랑 4개.
- 준비: 각 받침대에 마지막으로 받은 전선 하나를 숫자순으로 정렬하지 않고 맨 오른쪽에 놓아 X 토큰으로 표시한다. 나머지는 정상 정렬한다. 무전기(2)는 제외하고 다시 뽑는다.
- 진행: X 전선도 기본 규칙으로 절단해야 하지만 위치에서 숫자 크기를 추론할 수 없다. X 전선에는 모든 공용·개인 장비 효과가 적용되지 않는다. 슈퍼 탐지기(5)와 일반 레이더(8)도 X 전선을 무시한다.
- [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): X 전선에는 시작 정보 토큰을 놓지 않음.
- 의존: 받침대마다 X 표시. 일반 정보 공개·절단·승패는 그대로이며, 정렬되지 않은 전선과 장비 예외를 별도로 추적해야 한다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2020%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2020%20Back.png)

<a id="mission-21"></a>

## 21. 해기스 속 폭탄 — Death by Haggis

- 전선: 파랑 48개, 빨강 1/2, 노랑 없음. 2인은 빨강 2개.
- 준비: 일반 숫자 정보 토큰을 모두 치우고 홀수·짝수 토큰으로 대체한다. 시작 단서도 숫자 대신 해당 전선의 홀짝만 알려준다.
- 진행: 이 대체 규칙은 게임 내내 유지된다. 협력 절단 실패 후에도 정확한 숫자가 아닌 홀짝만 표시하고, 장비 4(포스트잇) 역시 홀짝 토큰을 사용한다. 절단 선언 자체는 홀짝이 아니라 기본 규칙대로 정확한 숫자를 맞혀야 한다. 빨강의 위험과 공개, 장비 활성화·기폭·승리 조건은 그대로다.
- 의존: 홀수·짝수 토큰. 새로운 카드나 시간 제한은 없다. 일반 숫자 정보가 줄어들어 위치와 이미 절단된 전선을 더 많이 추리해야 한다.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2021%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2021%20Back.png)

<a id="mission-22"></a>

## 22. 없는 값으로 전하는 단서 — Negative Impressions

- 전선: 파랑 48개, 빨강 1개, 노랑 4개. 2인 전용 전선 변경 없음.
- 준비: 시작 정보 토큰 대신 자신의 손에 없는 값의 토큰 두 개를 받침대 옆에 놓는다. 노랑도 선택할 수 있다. 받침대가 두 개면 각 받침대 옆에 하나씩 놓는다. 없는 값이 두 개 미만이면 토큰도 한 개 또는 영 개만 놓는다.
- 진행: 첫 노랑 두 개가 절단되는 즉시 대장부터 시계 방향으로 각자 보드에서 정보 토큰 하나를 골라 왼쪽 사람에게 준다. 받은 사람은 그 값의 전선 앞에 올바르게 표시하며, 그 값이 없으면 받침대 옆에 놓는다. 나머지는 기본 규칙이다.
- 의존: 정보 토큰의 ‘부재’ 표시와 노랑 첫 쌍 절단 이벤트. 별도 승패 변경 없음.

[앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2022%20Front.png) · [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2022%20Back.png)

<a id="mission-23"></a>

## 23. Defusing in Fordwich

- **전선:** 파랑 48, 빨강 후보 3개 중 1개, 노랑 없음. 2인은 빨강 후보 3개 중 2개.
- **준비·의존:** 장비를 보드에 놓는 대신 무작위 장비 7장을 뒷면 덱으로 둔다. 숫자 카드 1장을 무작위 공개한다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 숫자 카드는 초기 정보 공개 후.
- **진행:** 지정 숫자 전선 4개는 반드시 한꺼번에 절단한다. 전용 행동으로 네 위치를 모두 지목하며 장비·더블 디텍터를 사용할 수 없다. 하나라도 틀리면 즉시 폭발한다. 성공 전까지 매 라운드 종료(대장 차례 직전)에 장비 덱 맨 위 1장을 버린다. 성공하면 남은 장비 전부를 공개하여 숫자 해금 조건과 무관하게 즉시 사용할 수 있다. 나머지 전선을 기본 방식으로 해체한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2023%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2023%20Back.png)

<a id="mission-24"></a>

## 24. Tally Ho!

- **전선:** 파랑 48, 빨강 2, 노랑 없음. 2인은 빨강 3.
- **준비·의존:** 일반 정보 토큰 대신 `×1·×2·×3` 토큰을 사용한다. 가리킨 숫자가 **해당 받침대 전체에** 몇 개 있는지 나타내며, 이미 잘린 전선도 개수에 포함한다. 같은 값이 여럿이면 어느 전선에 놓아도 된다. 빨강에는 놓을 수 없다.
- **진행:** 초기 정보 공개, 절단 실패, 장비 4(메모) 모두 개수 토큰으로 처리한다. 메모는 이미 절단된 전선에도 놓을 수 있다. 숫자 자체를 공개하는 토큰은 사용하지 않는다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 교환한 전선의 토큰은 제거. 나머지 승패는 기본 규칙이다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2024%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2024%20Back.png)

<a id="mission-25"></a>

## 25. The Better to Hear You with...

- **전선:** 파랑 48, 빨강 2, 노랑 없음. 2인은 빨강 3.
- **준비·의존:** 추가 구성물이나 특별 준비 없음.
- **진행:** 전선의 숫자 이름을 직접 소리 내어 말할 수 없다. 절단하려는 값은 손가락, 몸짓, 소리, 간접적인 표현 등으로 전달한다. 숫자를 직접 말해 버리면 기폭 장치를 1칸 전진시킨다. 이 의사소통 제한 외에는 기본 절단·실패·승리 규칙을 적용한다. 온라인판에서는 숫자 선택 UI만으로 재현되지 않는 대화 규칙이므로 음성/채팅 진행 방식과 위반 판정 수단이 필요하다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2025%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2025%20Back.png)

<a id="mission-26"></a>

## 26. Speaking of the Wolf...

- **전선:** 파랑 48, 빨강 2, 노랑 없음. 2인 별도 변경 없음.
- **준비·의존:** 숫자 카드 1–12를 전부 앞면으로 펼친다. 장비 10(X-or-Y Ray)은 제외하고 다시 뽑는다.
- **진행:** 절단 차례에 공개된 숫자 카드 하나를 뒤집고, 그 숫자로 협력 또는 단독 절단한다. 해당 값의 전선 4개를 모두 잘랐다면 그 숫자 카드는 제거한다. 차례 시작 시 공개된 숫자가 하나도 없으면 남아 있는 숫자 카드를 다시 전부 공개한다. 공개된 숫자에 해당하는 전선이 자기 손패에 없으면 기폭 증가 없이 차례를 건너뛴다. 해당 전선이 있으면 반드시 그중 하나로 절단 행동을 한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2026%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2026%20Back.png)

<a id="mission-27"></a>

## 27. Playing with Wire

- **전선:** 파랑 48, 빨강 1, 노랑 4. 2인도 같지만 대장은 초기 정보 토큰을 놓지 않는다.
- **준비·의존:** 대장을 정한 뒤 캐릭터 카드를 전부 뒤집는다. 이번 미션에는 더블 디텍터가 없다. 장비 7(비상 배터리)은 제외하고 다시 뽑는다.
- **진행:** 첫 노랑 2개를 절단한 즉시, 인원수만큼 정보 토큰을 무작위로 뽑아 공개한다. 대장부터 시계 방향으로 하나씩 골라 자기 손패의 해당 전선 앞에 놓는다. 해당 값이 없다면 그 토큰을 받침대 옆에 공개하여 없다는 사실을 나타낸다. 이 보상은 첫 노랑 쌍을 자를 때 한 번 발생한다. 이후 기본 규칙으로 진행한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2027%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2027%20Back.png)

<a id="mission-28"></a>

## 28. Captain Careless

- **전선:** 파랑 48, 빨강 2, 노랑 4. 2인은 빨강 3, 노랑 4.
- **준비·의존:** 대장은 캐릭터 카드를 제거하여 더블 디텍터를 잃는다.
- **진행:** 대장은 공용 장비와 개인 장비를 사용할 수 없다. 대장이 수행한 협력 절단이 실패하면 일반적인 1칸 증가 대신 즉시 폭발한다. 다만 다른 사람이 사용한 장비 2(무전기)와 8(전체 레이더)의 효과에는 참여할 수 있다. 대장 외 플레이어는 기본 규칙에 따라 장비와 절단 행동을 사용한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2028%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2028%20Back.png)

<a id="mission-29"></a>

## 29. Guessing Game

- **전선:** 파랑 48, 빨강 3, 노랑 없음. 2인은 대장이 초기 정보 토큰을 놓지 않는다.
- **준비·의존:** 숫자 카드를 각자 비공개로 2장씩, 대장 오른쪽 사람에게만 3장 준다. 나머지는 덱이다.
- **진행:** 차례자의 오른쪽 사람이 숫자 카드 1장을 비공개로 제출한다. 차례자가 보통 행동을 한 뒤 공개하고, 방금 절단한 값과 같으면 기폭을 1칸 올린다. 차례자가 그 카드를 받는다. 모두 절단한 값의 숫자 카드는 버린다. 카드가 1장만 남은 사람은 아직 미절단 전선이 있는 값이 나올 때까지 덱에서 보충한다. 미절단 값이 한 종류뿐이면 마지막 숫자 카드도 버린다.
- **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 퇴장자는 카드를 반납하며, 카드 없는 오른쪽 이웃은 건너뛴다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2029%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2029%20Back.png)

<a id="mission-30"></a>

## 30. Speed Mission!

- **전선:** 파랑 48, 빨강 후보 2개 중 1개, 노랑 4. 2인 별도 변경 없음.
- **준비·의존:** 숫자 카드 12장을 섞어 비공개 덱으로 둔다. 음원 재생 기기가 필요하다.
- **진행:** 첫 차례 전에 **미션 30 음원**을 재생하여 지시를 따른다. 카드 뒷면은 음원 의존 지시이며, 시간·추가 조건은 카드에 적혀 있지 않아 이 조사에서 추정하지 않는다. 실패하면 음원을 다시 재생하여 재도전한다. 성공 시 31–42 상자를 연다.
- **필수 추가 출처:** [공식 영문 음원 안내](https://pegasusna.com/welcome-bomb-busters). 음원 본문 청취·시간별 이벤트 분석은 미완료.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2030%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2030%20Back.png)

<a id="mission-31"></a>

## 31. With One Hand Tied Behind My Back...

- **전선:** 파랑 48, 빨강 후보 3개 중 2개, 노랑 없음.
- **준비·의존:** 제약 카드 A–E를 공개한다. 초기 정보 토큰을 놓기 전에 대장부터 시계 방향으로 자기 제약을 하나씩 선택한다. 남은 제약은 버린다. 2인은 A+B 또는 C+D 조합을 함께 선택하지 않도록 권장한다(금지 규칙은 아님).
- **진행:** 각자 자신의 제약을 적용한다. 자기 차례 시작에 그 제약을 이행할 수 없으면 카드를 뒤집어 영구 해제하고 남은 게임은 보통대로 진행한다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 해제 후 재적용하지 않는다. A–E의 실제 조건은 [부속 규칙 문서](bomb-busters-mission-components.md)에 정리했다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2031%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2031%20Back.png)

<a id="mission-32"></a>

## 32. Pranks-A-Plenty

- **전선:** 파랑 48, 빨강 2, 노랑 없음. 2인은 빨강 3.
- **준비·의존:** 제약 카드 12장을 섞어 덱으로 놓고 맨 위 한 장을 공개한다.
- **진행:** 모든 플레이어가 현재 공개된 제약을 적용한다. 매 플레이어의 차례 시작에 대장은 팀과 상의한 뒤 현재 제약을 덱의 다음 카드로 교체할 수 있다. 제약 때문에 행동할 수 없는 플레이어는 그 사실을 알리고 차례를 넘기며 기폭은 증가하지 않는다. 빨강 전선 공개 행동에는 제약을 적용하지 않는다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 덱 소진 후 제약 없음. 12개 제약의 세부 조건은 [부속 규칙 문서](bomb-busters-mission-components.md)를 참조한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2032%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2032%20Back.png)

<a id="mission-33"></a>

## 33. What Happens in Vegas...

- **전선:** 파랑 48, 빨강 후보 3개 중 2개, 노랑 없음. 2인은 빨강 3개를 모두 사용한다.
- **준비·의존:** 일반 숫자 정보 토큰을 치우고 홀수/짝수 토큰을 사용한다. 초기 공개도 특정 값 대신 홀짝만 표시한다.
- **진행:** 게임 내내 정보 토큰을 놓아야 할 때 홀짝 토큰으로 대체한다. 초기 준비뿐 아니라 절단 실패와 장비 4(메모)에도 동일하게 적용한다. 맞는 숫자 추측 자체는 여전히 필요하지만, 실패해도 정확한 숫자가 공개되지 않아 정보가 제한된다. 그 밖의 행동과 승패는 기본 규칙이다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2033%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2033%20Back.png)

<a id="mission-34"></a>

## 34. The Weakest Link

- **전선:** 파랑 48, 빨강 1, 노랑 없음. **2인 플레이 불가.**
- **준비·의존:** 선 플레이어를 정한 뒤 대장 카드를 포함한 캐릭터 카드를 다시 섞어 각자 비공개로 한 장씩 준다. 제약 A–E도 비공개로 한 장씩 준다. 대장 카드 소유자만 비밀 역할인 '약한 고리'가 되어 자기 제약을 적용한다. 나머지는 제약을 무시한다.
- **진행:** 카드가 비공개인 동안 모두 개인 장비가 없다. 비밀 역할자가 제약 때문에 행동하지 못하면 기폭 +2, 전원 캐릭터·제약 카드를 버린다. 다른 사람은 자기 차례 시작에 상의 없이 역할자와 그 제약을 함께 추측할 수 있다. 둘 중 하나라도 틀리면 기폭 +1. 모두 맞으면 캐릭터 카드를 공개하고 제약을 버리며, 개인 장비를 즉시 사용할 수 있게 된다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2034%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2034%20Back.png)

<a id="mission-35"></a>

## 35. No Link, Single Wire

- **전선:** 파랑 48, 빨강 후보 3개 중 2개, 노랑 4. 2인은 빨강 3, 노랑 4.
- **준비·의존:** 빨강·노랑을 섞기 전에 받침대마다 파랑 전선 하나를 먼저 준다. 이 전선은 값 순서와 무관하게 해당 받침대 맨 오른쪽에 놓고 X 토큰으로 표시한다. 나머지를 섞어 정상 분배·정렬한다. 장비 2(무전기)는 제외한다.
- **진행:** X 전선은 노랑 4개가 모두 절단된 **후에만** 일반 협력/단독 절단으로 자를 수 있다. X 전선에는 어떤 공용·개인 장비도 적용할 수 없고, 슈퍼 디텍터나 전체 레이더 효과에서도 제외한다. 장비 제한과 절단 해금 조건 외에는 기본 규칙으로 진행한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2035%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2035%20Back.png)

<a id="mission-36"></a>

## 36. Panic under the Palm Trees

- **전선:** 파랑 48, 빨강 후보 3개 중 1개, 노랑 2. 2인은 빨강 후보 3개 중 2개, 노랑 4.
- **준비·의존:** 숫자 카드 5장을 무작위 순서 그대로 공개한다. 대장은 상의 없이 수열(Sequence) 카드 A면을 줄의 어느 한 끝에 놓아 안쪽을 가리키게 한다.
- **진행:** 공개 숫자에 해당하는 전선은 화살표가 지정하는 순서로 자른다. 수열 카드에 붙어 있는 숫자 전선 2개를 절단하면 해당 숫자 카드를 제거한다. 그 행동자는 상의 없이 수열 카드를 남은 줄의 어느 끝에 둘지 정한다. 공개 카드에 없는 값은 자유롭게 자를 수 있다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 지정값을 못 자르고 다른 합법 행동도 없으면 패배.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2036%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2036%20Back.png)

<a id="mission-37"></a>

## 37. Joker’s Gone Wild

- **전선:** 파랑 48, 빨강 2, 노랑 없음. 2인은 빨강 3.
- **준비·의존:** 제약 카드 12장을 섞어 덱으로 놓고 첫 장을 공개한다.
- **진행:** 모두 자기 차례에 현재 제약을 지킨다. 한 숫자의 전선 4개가 전부 절단될 때마다 다음 제약으로 교체한다. 제약 때문에 행동할 수 없으면 선언하고 기폭 증가 없이 차례를 넘긴다. 단, 한 라운드 동안 아무도 행동하지 못했다면 기폭을 1칸 올리고 제약을 교체한다. 제약 덱을 다 사용하면 제약 없이 계속한다. 빨강 전선 공개 행동은 제약의 영향을 받지 않는다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2037%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2037%20Back.png)

<a id="mission-38"></a>

## 38. Knit a Wire, Purl a Wire...

- **전선:** 파랑 48, 빨강 2, 노랑 없음. 2인은 빨강 3.
- **준비·의존:** 분배 시 대장이 전선 하나를 보지 않고 방향을 뒤집어 받침대 맨 오른쪽에 둔다. 대장에게는 뒷면, 팀원에게는 값이 보이며 정렬 순서에서 벗어난다.
- **진행:** 이 전선은 대장만 자기 절단 행동으로 자를 수 있고 공용 장비·더블 디텍터를 사용할 수 없다. 그 절단이 실패하면 즉시 폭발한다. 다른 사람이 행동하려면 이 전선을 자르는 방법밖에 없는 경우, 차례를 넘기고 기폭 +1이다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 뒤집힌 빨강도 마지막에 공개. 그 밖의 전선은 기본 방식으로 자른다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2038%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2038%20Back.png)

<a id="mission-39"></a>

## 39. The 4 Noble Wires

- **전선:** 파랑 48, 빨강 후보 3개 중 2개, 노랑 4. 2인은 빨강 3, 노랑 4.
- **준비·의존:** 공용 장비 없이 숫자 카드 하나를 장비 칸에 공개하고, 다른 숫자 카드 8장을 무작위 비공개 덱으로 둔다. 초기 정보 토큰은 무작위로 받는다. 해당 전선이 없으면 받침대 옆에 표시하고, 노랑 토큰을 뽑으면 다시 뽑는다.
- **진행:** 공개 숫자의 전선 4개는 전용 행동으로 동시에 지목·절단한다. 자기 손패에 그 값이 없어도 시도할 수 있으나 개인 장비는 금지이며 틀리면 폭발한다. 성공 전까지 라운드 종료마다 숫자 덱 위 1장을 버린다. 성공하면 남은 덱을 대장부터 균등 분배하고, 각자 받은 숫자 중 하나의 정보 토큰 1개를 놓는다. 해당 토큰이 없으면 생략한다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 손패에 없는 값은 무시.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2039%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2039%20Back.png)

<a id="mission-40"></a>

## 40. Hard to Die (A Christmas Tale)

- **전선:** 파랑 48, 빨강 3, 노랑 없음. 2인은 대장이 초기 정보 토큰을 놓지 않는다.
- **준비·의존:** 일반 정보 토큰 대신 `×1·×2·×3` 토큰을 사용한다. 토큰은 해당 전선 값이 같은 받침대에 총 몇 개 있는지 뜻하며 이미 절단한 전선도 센다. 같은 값이 여럿이면 그중 어느 전선을 가리켜도 된다.
- **진행:** 초기 공개·절단 실패·장비 4(메모)에서 모두 개수 토큰만 사용한다. 메모는 이미 절단된 전선에도 놓을 수 있다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 교환한 전선의 토큰은 제거. 24번과 같은 핵심 정보 제한이지만 빨강 구성이 더 위험하고 2인 초기 정보가 적다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2040%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2040%20Back.png)

<a id="mission-41"></a>

## 41. Latin Bombshell

- **전선:** 파랑 48, 빨강 후보 3개 중 1개, 노랑은 인원수만큼(최대 4). 2인은 빨강 후보 3개 중 2개와 노랑 2.
- **준비·의존:** 노랑은 따로 한 사람당 하나씩 주며, 5인일 때 대장은 받지 않는다. 나머지 전선은 보통대로 분배한다. 기폭은 폭발 직전 칸에서 시작한다. 초기 정보 토큰은 무작위이며 해당 값이 없으면 받침대 옆에 둔다. 노랑용 False Bottom 장비는 제외한다.
- **진행:** 노랑은 쌍이 아니라 전용 행동으로 동료의 전선 하나를 지목해 자른다. 성공하면 그 노랑 하나를 공개하고 기폭을 1칸 되돌린다. 틀리면 정보 토큰을 놓고 기폭 +1이며, 빨강을 지목하면 즉시 폭발한다. 자기 노랑(및 빨강)만 남은 사람은 차례를 건너뛴다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2041%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2041%20Back.png)

<a id="mission-42"></a>

## 42. Time to Run Away and Join The Circus...

- **전선:** 파랑 48, 빨강 후보 3개 중 1개, 노랑 4. 2인 별도 변경 없음.
- **준비·의존:** 음원 재생 기기가 필요하며 테이블 주위에 공간을 확보한다.
- **진행:** 첫 라운드 전에 **미션 42 음원**을 재생하고 그 지시로 진행한다. 카드 자체에는 시간이나 음성 이벤트별 특수 규칙이 기록되어 있지 않으므로 임의로 채우지 않는다. 성공하면 43–54 상자를 연다.
- **필수 추가 출처:** [공식 영문 음원 안내](https://pegasusna.com/welcome-bomb-busters). 음원 본문 청취·시간별 이벤트 분석은 미완료.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2042%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2042%20Back.png)

<a id="mission-43"></a>

## 43. Nano the Robot

- **전선:** 파랑 48, 빨강 3, 노랑 없음. 전체 중 로봇에게 비공개 전선을 2인 5개, 3–4인 4개, 5인 3개 배정한다. 2인은 대장의 초기 정보 토큰을 무작위로 정한다.
- **준비·의존:** Nano 로봇을 보드 숫자 1에 둔다. 로봇의 전선은 누구도 미리 보지 않는다.
- **진행:** 매 플레이어 차례 종료에 로봇이 1칸 이동하며 12에 도달하면 방향을 바꿔 11로 돌아온다. 행동자가 로봇의 현재 위치와 같은 숫자를 절단하면 로봇 전선 하나를 받아 값이 보이지 않게 자기 손패의 올바른 위치에 넣는다. 받침대가 둘이면 어느 쪽인지 고른다. 승리하려면 로봇 몫까지 전부 받아 절단/빨강 공개를 마쳐야 한다. 장비 11(커피)로 차례를 넘겨도 로봇은 이동한다.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2043%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2043%20Back.png)

<a id="mission-44"></a>

## 44. Underwater Pressure

- **전선:** 파랑 48, 빨강 후보 3개 중 1개, 노랑 없음. 2인 별도 변경 없음.
- **준비·의존:** 인원당 산소 토큰 2개를 공용 저장소에 둔다. 공용 장비 10(X-or-Y Ray) 및 같은 능력의 새 캐릭터는 제외한다.
- **진행:** 절단 시도 전에 그 숫자에 해당하는 산소를 저장소에서 가져온다. 값 1–4는 1개, 5–8은 2개, 9–12는 3개다. 대장 차례 시작에 전부 저장소로 돌려놓는다. 산소가 모자라면 차례를 넘기고 기폭 +1. 대화는 금지되고 산소가 더 필요하다는 엄지 신호만 허용한다. **[FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/):** 자발적 패스(+1), 안정화로 방지 가능.

원본: [카드 앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2044%20Front.png) | [카드 뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2044%20Back.png)

<a id="mission-45"></a>

## 45. Seeking Volunteers — 자원자를 찾습니다

- **전선/준비:** 빨강 2개(2인 3개). 숫자카드 12장을 뒷면 더미로 만든다. 장비 10(X or Y Ray), 11(Coffee Mug)을 제외하고 다시 뽑으며, X or Y Ray 개인장비 캐릭터도 제외한다.
- **진행:** 시계방향 차례 대신 매번 대장이 숫자카드를 공개한다. 가장 먼저 절단을 자원한 사람이 해당 숫자를 잘라야 한다. 자원자가 없으면 대장이 자신을 포함한 한 명을 지명한다. 네 전선이 모두 잘린 숫자의 카드는 제거하고, 더미가 소진되면 남은 카드를 재사용한다.
- **실패/특례:** 자원자가 그 숫자를 갖지 않았거나 허용된 자원 선언 외에 말하면 기폭장치 +1. 지명받은 사람이 해당 숫자가 없으면 원하는 정보토큰 하나를 놓고 기폭장치 +1. 빨강만 남은 사람은 언제든 자원 선언으로 빨강 공개를 할 수 있다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2045%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2045%20Back.png).

<a id="mission-46"></a>

## 46. Secret Agent — 비밀요원

- **전선/준비:** 노랑 4개, 값은 5.1·6.1·7.1·8.1. 장비 7(Emergency Batteries)은 교체한다. 2인은 대장의 초기 정보토큰을 놓지 않는다.
- **진행:** 7 전선은 마지막에 잘라야 한다. 자신의 차례 시작에 자기 전선이 7만 남았다면 특별 행동으로 테이블 전체의 7 네 개를 한 번에 절단한다.
- **실패/특례:** 이 마지막 동시절단이 틀리면 즉시 폭발한다. 그 전에 다른 숫자를 지목하다 7을 잘못 선택했다면 즉시 폭발이 아니라 일반 실패처럼 정보토큰을 놓고 기폭장치 +1 처리한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2046%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2046%20Back.png).

<a id="mission-47"></a>

## 47. Calculate the Odds — 계산으로 절단하기

- **전선/준비:** 빨강 2/3개(2인 3개). 숫자카드 1–12를 공개해서 두 줄로 펼친다. X or Y Ray 장비와 동일 개인장비 캐릭터는 제외한다.
- **진행:** 절단할 때 사용 가능한 숫자카드 2장을 골라 더하거나 빼서 절단할 전선 값을 만든다. 사용한 두 장은 버린다. 카드가 모두 소진되어야 12장을 다시 펼친다.
- **실패/특례:** 행동을 할 수 없거나 원하지 않으면 차례를 넘기고 기폭장치 +1. 일반 절단의 성공·실패 판정은 그대로 적용한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2047%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2047%20Back.png).

<a id="mission-48"></a>

## 48. Lethal Wires 3 — 치명적인 전선 3

- **전선/준비:** 빨강 2개, 노랑 3개(2인 빨강 3개·노랑 3개). 노랑은 다른 전선과 섞지 않고 대장부터 시계방향으로 한 개씩 미리 배분한다. 2인은 대장이 두 개를 받아 자기 받침대마다 하나씩 넣는다. 이후 나머지 전선을 통상 배분한다.
- **진행:** 노랑은 일반 방식으로 자르지 않고 특별 행동으로 세 개를 동시에 자른다. 4–5인은 노랑을 갖지 않은 사람도 이 행동을 할 수 있다.
- **실패/특례:** 동시절단 실패 시 지목된 모든 전선에 정보토큰을 놓되 기폭장치 증가는 한 칸이다. 빨강 선택 등 기본 즉시 폭발 규칙은 별도 해제가 없다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2048%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2048%20Back.png).

<a id="mission-49"></a>

## 49. Message in a Bottle — 산소통의 메시지

- **전선/준비:** 빨강 2개(2인 3개). 산소는 2/3/4/5인에서 각각 1인당 7/6/5/4개. X or Y Ray 장비와 동일 개인장비 캐릭터 제외.
- **진행:** 절단을 시도하려면 선언할 전선 값만큼 산소를 다른 한 명에게 모두 넘긴다. 수령자는 절단 대상자와 달라도 되지만 여러 명에게 나눌 수 없다. 말은 금지하며 산소가 필요하다는 엄지 신호만 허용한다.
- **실패/특례:** 산소가 부족하면 차례를 넘기고 기폭장치 +1. [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 자발적 패스도 +1. 전선 소진/빨강 공개 시 남은 산소를 제거한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2049%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2049%20Back.png), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-50"></a>

## 50. The Blackest Sea — 암흑의 바다

- **전선/준비:** 빨강 2개·노랑 2개(2인 빨강 3개·노랑 4개). 완료표시 토큰과 빨강/노랑 위치표시 마커를 쓰지 않는다. 섞기 전에 모두 실제 빨강·노랑 값을 본다. 초기 정보는 전선을 손으로 가리킨 후 정보토큰을 받침대 옆에 두며 정확한 위치를 기록하지 않는다.
- **진행:** 실패로 얻는 정보토큰도 전선 앞이 아니라 받침대 옆에 둔다. 각자 기억한 전선 위치·값을 다른 사람에게 전달할 수 없다.
- **특례:** 장비는 통상 규칙대로 사용한다. 값·위치 정보를 기억해야 하는 미션이다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2050%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2050%20Back.png).

<a id="mission-51"></a>

## 51. It's Your (Un)Lucky Day! — 당신의 운을 시험합니다

- **전선/준비:** 빨강 1개(2인 2개). 숫자카드 12장을 뒷면 더미로 만들고 기폭장치를 보통보다 한 칸 뒤에서 시작한다. X or Y Ray 장비·캐릭터 제외. 2인은 대장의 초기 정보토큰을 놓지 않는다.
- **진행:** 현재 차례의 지휘자가 숫자카드를 한 장 공개하고, 상의 없이 자신을 포함한 한 명에게 해당 값 절단을 명령한다. 다음 지휘자는 기존 지휘자의 왼쪽 사람이다. 해당 숫자 전선 네 개가 잘리면 그 숫자카드는 제거하고 더미 소진 시 나머지를 섞는다.
- **실패/특례:** 지명된 사람이 값이 없으면 정보토큰 하나를 놓고 기폭장치 +1. 자기 차례 시작에 빨강만 남았다면 빨강을 공개한다. FAQ: 빨강만 가진 절단자를 지명하면 패배한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2051%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2051%20Back.png), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-52"></a>

## 52. Dirty Double-crossers — 거짓 정보

- **전선/준비:** 빨강 3개(2인 빨강 3개·노랑 4개). 장비 1(≠ Label), 12(= Label)은 교체한다. 각자 초기 정보토큰을 2개 놓으며 둘 다 해당 전선과 다른 값이어야 한다. 준비 문구는 파랑 또는 빨강 전선을 지목하도록 명시한다.
- **진행:** 이 미션의 모든 정보토큰은 값의 일치가 아니라 불일치를 뜻한다. 듀얼 절단이 실패하면 실제 값 대신 방금 선언한 잘못된 값을 정보토큰으로 놓는다.
- **특례:** 기폭장치와 빨강 절단 판정은 기본 규칙이다. 노랑이 있는 2인 준비에서 초기 토큰을 노랑에 놓을 수 있는지는 카드가 별도로 설명하지 않으므로 확대 해석하지 않았다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2052%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2052%20Back.png).

<a id="mission-53"></a>

## 53. Nano Nano — 나노의 역주행

- **전선/준비:** 빨강 2개(2인 3개). 나노 로봇을 보드의 1 바로 앞에 놓는다. 기폭장치 다이얼은 사용하지 않으며 장비 6(Rewinder), 9(Stabilizer)은 교체한다.
- **진행:** 각 차례 끝에 일반적인 절단 성공이면 나노 +1칸, 현재 나노 위치와 같은 숫자의 절단 성공이면 대신 −1칸, 실패이면 +2칸 움직인다.
- **패배:** 나노가 12에 도달하면 즉시 폭발한다. 빨강을 잘랐을 때의 기본 즉시 폭발 규칙도 해제되지 않는다. 별도 구성물로 나노가 필요하다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2053%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2053%20Back.png).

<a id="mission-54"></a>

## 54. The Attack of Rabbit the Red — 붉은 토끼의 습격

- **전선/준비:** 파랑 48개를 배분하고 빨강 11개는 섞지 않은 별도 뒷면 더미로 미션 카드 위에 놓는다. 산소는 2/3/4/5인에서 각각 1인당 9/6/3/2개, 나머지는 공용 공급처에 둔다. X or Y Ray 장비·캐릭터 제외.
- **진행:** 절단 시도 전에 값 1–4는 산소 1개, 5–8은 2개, 9–12는 3개를 공용 공급처에 지불한다. 산소 부족으로 행동 불가면 패스하고 기폭장치 +1. 같은 값 네 개를 모두 잘라 완료토큰을 놓을 때마다 각자 산소 1개를 받는다.
- **의존/해금:** 첫 차례 전에 **미션 54 오디오**를 시작한다. 빨강 투입 등 음성 이벤트 세부 타이밍은 카드에 없으므로 오디오 확인이 별도로 필요하다. 성공하면 55–66 상자를 연다. [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 가능한 절단은 의무이며, 전선 소진자는 산소를 수령하지 않는다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2054%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2054%20Back.png), [공식 오디오](https://pegasusna.com/welcome-bomb-busters), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-55"></a>

## 55. Doctor Nope's Challenge — 닥터 노프의 도전

- **전선/준비:** 빨강 2개(2인 2/3개). 플레이어 수만큼 도전카드를 공개한다. 기폭장치는 인원 기본칸 대신 폭발 바로 전 칸에서 시작한다.
- **진행:** 공개된 도전 조건을 만족하면 그 카드를 버리고 기폭장치를 한 칸 되돌린다. 조건은 한 사람의 전선 배치 또는 팀 전체의 절단 순서 등을 확인할 수 있다.
- **의존:** 실제 목표는 별도 **도전카드** 내용에 따라 달라진다(부속 규칙 문서 참조). 이 미션 카드 자체는 모든 도전 완료를 별도의 승리 조건으로 요구하지 않는다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2055%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2055%20Back.png).

<a id="mission-56"></a>

## 56. Tripwires — 뒤집힌 전선

- **전선/준비:** 빨강 2/3개(2인 3개). 배분받을 때 각자 전선 1개를 보지 않고 반대 방향으로 돌려 받침대 오른쪽 끝에 둔다. 주인만 그 값을 모르며 정렬 순서에서 벗어나도 된다. **FAQ 정정: 숫자 카드는 사용하지 않는다.**
- **진행:** 소유자는 자기 역방향 전선을 일반 절단으로 처리해야 하며 장비·더블 탐지기는 사용할 수 없다. 이것을 잘못 절단하면 즉시 폭발한다. 다른 사람은 듀얼 절단으로 그 역방향 전선을 처리할 수 있지만 기폭장치 +1을 받는다.
- **특례:** 역방향 빨강도 값을 추론한 뒤 공개해야 한다(FAQ).
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2056%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2056%20Back.png), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-57"></a>

## 57. An Impossible Mission — 불가능한 임무

- **전선/준비:** 빨강 1개(2인 2개). 숫자카드 12장을 펼치고 각각 무작위 제약카드 하나를 공개하여 짝짓는다. 추가 장비 10·10(Disintegrator; 숫자 10 네 개 절단으로 해제)은 교체한다.
- **진행:** 같은 숫자 전선 네 개를 모두 잘라 완료토큰을 놓으면, 그 숫자와 짝인 제약을 전원에게 적용한다. 새 제약은 종전 제약을 덮어 항상 한 장만 활성화한다.
- **실패/특례:** 제약 때문에 행동할 수 없으면 알리고 불이익 없이 패스한다. 단, 한 라운드 내내 누구도 행동하지 못하면 폭발한다. 빨강 공개에는 제약을 적용하지 않는다. **제약카드별 조건**은 부속 규칙 문서에 정리되어 있다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2057%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2057%20Back.png).

<a id="mission-58"></a>

## 58. Double and/or Nothing — 무제한 더블 탐지기

- **전선/준비:** 빨강 2개(2인 3개). 모든 정보토큰을 제외한다. 장비 4(Post-It), 7(Emergency Batteries)은 교체한다. 신규 캐릭터를 제외하고 전원이 개인장비로 더블 탐지기를 갖는다.
- **진행:** 시작 정보도 없고, 절단 실패 뒤에도 지목한 전선 정보를 알려주지 않는다. 대신 개인 더블 탐지기가 소진되지 않아 매 차례 사용할 수 있다.
- **특례:** 정보 공개를 제외한 실패·폭발 처리는 기본 규칙이다. 별도의 숫자/제약/도전카드는 사용하지 않는다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2058%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2058%20Back.png).

<a id="mission-59"></a>

## 59. Nano to the Rescue — 나노의 구조 작전

- **전선/준비:** 빨강 2/3개(2인 3개). 숫자카드 12장을 무작위 순서로 일렬 공개한다. 나노를 숫자 7 카드에 놓고 카드가 더 많이 있는 쪽을 보게 한다. X or Y Ray 장비·캐릭터 제외.
- **진행:** 현재 위치에 머물거나 나노가 바라보는 방향의 자기 보유 숫자카드로 전진한 뒤, 나노가 위치한 숫자를 절단한다. 이후 나노의 방향을 그대로 두거나 반대로 돌린다. 네 개가 모두 잘린 숫자카드는 뒤집는다.
- **실패/특례:** 현재 위치·앞쪽에서 절단 가능한 숫자가 없으면 패스, 기폭장치 +1, 나노 180도 회전. 장비 11(Coffee Mug)은 차례 전체를 건너뛴다. 나노 구성물과 숫자카드가 필요하다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2059%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2059%20Back.png).

<a id="mission-60"></a>

## 60. Yep, it's Doctor Nope! — 다시 닥터 노프

- **전선/준비:** 빨강 2/3개(2인 3개). 인원수만큼 도전카드를 공개하고 기폭장치를 폭발 바로 전 칸에 놓는다.
- **진행:** 55번과 같은 도전 메커니즘이다. 개인 배치 또는 팀 전체 진행에 관한 도전 조건을 완수하면 해당 카드를 버리고 기폭장치를 한 칸 되돌린다.
- **차이/의존:** 55번보다 빨강 후보 구성의 불확실성이 높아진다. 도전 조건은 부속 규칙 문서를 참조하며, 미션 카드에는 모든 도전을 반드시 완수해야 한다는 추가 승리 조건은 없다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2060%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2060%20Back.png).

<a id="mission-61"></a>

## 61. Sharing is Caring — 제약 나누기

- **전선/준비:** 빨강 1개(2인 2개). 제약 A–E 중 각자 무작위 한 장을 공개한다. 2인은 대장 왼쪽·오른쪽에 추가 제약을 한 장씩, 3인은 대장 왼쪽에 한 장을 둔다.
- **진행:** 각자는 자기 제약을 지킨다. 매 라운드 대장 차례 직전에 협의하여 모든 제약을 시계 또는 반시계 방향으로 돌릴 수 있다. 언제든 자기 제약을 버리고 F–L 중 무작위 한 장으로 바꿀 수 있으나 기폭장치 +1이다.
- **실패/특례:** 제약 때문에 행동 불가면 불이익 없이 패스하지만, 한 라운드 전원이 행동 불가면 폭발한다. 빨강 공개는 제약에서 제외한다. 제약 A–L 조건은 부속 규칙 문서를 참조한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2061%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2061%20Back.png).

<a id="mission-62"></a>

## 62. Armageddon Roulette — 아마겟돈 룰렛

- **전선/준비:** 빨강 2개(2인 3개). 인원수만큼 무작위 숫자카드를 공개한다. 기폭장치를 폭발 바로 전 칸에 놓는다.
- **진행:** 공개된 카드 숫자의 전선 네 개를 모두 자를 때마다 기폭장치를 한 칸 되돌린다.
- **특례:** 별도의 절단 제한이나 차례 변경은 없다. 숫자카드는 회복 목표를 나타낸다. 초반 실수를 버틸 여유가 없으므로 목표 숫자 완성으로 기폭 여유를 확보하는 구성이다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2062%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2062%20Back.png).

<a id="mission-63"></a>

## 63. It is Positively Titanic — 타이타닉 작전

- **전선/준비:** 빨강 2개(2인 3개). 산소를 대장 혼자 받고 시작한다. 2/3/4/5인에서 총 14/18/24/30개이다. X or Y Ray 장비·캐릭터 제외.
- **진행:** 절단 전에 선언하는 값만큼 산소를 공용 공급처에 지불한다. 차례 끝에 남은 산소 전부를 왼쪽 사람에게 넘긴다. 한 바퀴가 끝나 다음 대장 차례가 오면 공급처 산소를 모두 회수한다. 말은 금지하고 산소 요청 엄지 신호만 허용한다.
- **실패/특례:** 산소 부족으로 절단 불가면 패스·기폭장치 +1. [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 산소로 가능한 절단이 있으면 반드시 행동한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2063%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2063%20Back.png), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-64"></a>

## 64. Return of the Tripwires — 돌아온 뒤집힌 전선

- **전선/준비:** 빨강 1개(2인 2개). 각자 전선 2개를 보지 않고 남들에게만 보이게 돌린다. 동료 안내에 따라 둘 중 작은 것을 왼쪽 끝, 큰 것을 오른쪽 끝에 둔다. [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 받침대가 둘이어도 총 2개만 각 바깥쪽 끝에 놓는다.
- **진행:** 자기 역방향 전선은 장비·더블 탐지기 없이 일반 절단으로 처리하며 실패하면 즉시 폭발한다. 다른 사람이 듀얼 절단으로 대신 처리할 수 있지만 기폭장치 +1이다.
- **특례:** 역방향 빨강 공개 전에는 추론이 필요하다. 자기 역방향 전선과 동료 역방향 전선을 함께 잘라도 +1이다(FAQ).
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2064%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2064%20Back.png), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-65"></a>

## 65. Hand-Me-Downs — 숫자 넘겨주기

- **전선/준비:** **3–5인 전용이며 2인은 플레이 불가.** 빨강 3개. 숫자카드 12장을 최대한 균등하게 나눠 공개한다. 5인은 대장과 왼쪽 사람이 3장, 나머지는 2장씩이다. X or Y Ray 장비·캐릭터 제외.
- **진행:** 자기 공개 숫자카드 중 하나와 일치하는 값을 절단한다. 해당 전선이 없으면 패스·기폭장치 +1. 차례가 끝날 때 성공·실패와 관계없이 자기 숫자카드 하나를 동료에게 준다. 네 전선이 모두 잘린 숫자는 카드를 뒤집고 더 이상 전달하지 않는다. Coffee Mug는 차례를 건너뛴다.
- **추가 패배:** [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 자기 마지막 전선 처리와 카드 양도 후 공개 카드가 남으면 패배한다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2065%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2065%20Back.png), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).

<a id="mission-66"></a>

## 66. The Final Countdown — 마지막 카운트다운

- **전선/준비:** 빨강 2개·노랑 2개. 벙커 양면카드·팀 말·제약 A–E·미션 66 오디오가 필요하다. 말을 헬리콥터 칸에 놓는다. 제약 네 장을 벙커 네 방향에 무작위 공개하고 남은 한 장을 행동 제약으로 둔다.
- **진행:** 절단 성공/실패 후 충족한 제약 방향으로 말을 이동해야 한다. 벽은 통과할 수 없고 모든 가능한 방향이 막혔으면 제자리다. 줄무늬 칸에서는 이동 대신 행동 제약에 맞는 절단을 성공하여 해당 행동을 수행한다. 4개 솔로 절단은 두 번의 절단으로 취급하여 이동/행동도 두 번 처리한다.
- **지도/의존:** 계단은 북쪽 방향을 유지하며 벙커 카드를 뒤집고 반대 층 계단으로 옮긴다. 함정은 기폭장치 +1. 노랑은 지시가 있을 때만 자른다. 첫 차례 전에 오디오를 시작하며 **구체적 행동·진행 목표는 음성 지시를 확인해야 하며 벙커 지도는 부속 규칙 문서를 참조한다.** [FAQ 정정](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/): 노란 레이저는 노랑 줄무늬 칸의 절단 행동 전까지 벽이다.
- **자료:** [앞면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2066%20Front.png), [뒷면](https://files.timwi.de/Tabletop%20Simulator/Bomb%20Busters/Missions/Mission%2066%20Back.png), [공식 오디오](https://pegasusna.com/welcome-bomb-busters), [FAQ](https://www.cocktailgames.com/nos-jeux/bomb-busters-faq/).
