# 보드게임 플랫폼

## 반지 원정대 트릭테이킹 게임

1. `backend`에서 `npm install && npm run start:dev`, `frontend`에서 `npm install && npm start`를 실행합니다.
2. 로비에서 **반지 원정대** 방을 만들고 1~4명이 참가합니다. 1명은 네 손패를 조종하고, 2명은 공개 피라미드 패를 포함한 세 좌석을 사용합니다.
3. 방장이 1~18장 중 챕터를 선택합니다. 모든 참가자가 준비하면 캐릭터 선택, 준비 행동, 트릭 플레이를 진행합니다.
4. 캐릭터 목표와 사건·저주·선물 효과를 적용해 짧은 장은 한 라운드, 긴 장은 여러 라운드, 마지막 장은 두 그룹의 라운드로 완료합니다.

규칙과 챕터·카드별 출처는 [자료 조사 문서](docs/fellowship-trick-taking-sources.md)에, 기계 판독형 효과는 [카탈로그](backend/src/game-room/fellowship/catalog.ts)에 있습니다. 저작권이 있는 카드 그림과 룰북 PDF는 저장소에 포함하지 않았습니다.

## 월드 배팅 컵: 뒷세계의 승부조작단

1. 로비에서 **월드 배팅 컵** 방을 만들고 2~6명이 참가합니다.
2. 8강 대진이 무작위로 짜이면 모두 일반 토큰 1개로 우승팀을 선배팅합니다.
3. 경기마다 숨겨진 스코어 카드 6장을 몰래 보거나(내부 정보 수집) 바꿔치기(승부 조작)한 뒤, **질 것 같은 나라**에 토큰을 겁니다. 승부 조작 토큰은 그 나라의 점수를 깎고, 승리 배팅 토큰은 반대편에 건 것으로 칩니다.
4. 결승까지 7경기를 치르고 선배팅 보상까지 더해 토큰이 가장 많은 승부사가 이깁니다.

원문 룰북이 정하지 않은 부분의 해석은 [구현 규칙서](docs/world-betting-cup-rulebook.md)에 정리했고, 엔진은 [engine.ts](backend/src/game-room/world-betting-cup/engine.ts)에 있습니다.

## 아기 돼지 삼형제의 아파트 짓기

1. 로비에서 **아기 돼지 삼형제** 방을 만들고 2~5명이 참가합니다.
2. 각자 돼지 카드 3장(아파트 3채)과 손패 5장을 받고, 턴마다 1장을 뽑아 1장을 사용하거나 버립니다.
3. **터 → 철근 → 콘크리트** 순서로 층을 올리고 정원으로 완공합니다. 다이너마이트는 상대 아파트의 맨 위층을 날리고, 방범 마감재는 그 아래층을 지킵니다.
4. 한 사람이 세 채를 모두 완공하면 종료. 아파트마다 터 × 완성 층(3층 이상 +1, 5층 이상 +2)을 더해 가장 높은 점수가 이깁니다.

카드 장수와 해석은 [구현 규칙서](docs/three-pigs-rulebook.md)에, 엔진은 [engine.ts](backend/src/game-room/three-pigs/engine.ts)에 있습니다.

## 검증

- 백엔드: `cd backend && npm test`
- 프런트엔드: `cd frontend && CI=true npm test -- --watchAll=false --runInBand && CI=true npm run build`
- 실제 WebSocket 흐름: `cd backend && npm run build && FELLOWSHIP_ONLY=1 node test/socket-e2e.cjs`
