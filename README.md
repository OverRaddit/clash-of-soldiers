# 보드게임 플랫폼

## 반지 원정대 트릭테이킹 게임

1. `backend`에서 `npm install && npm run start:dev`, `frontend`에서 `npm install && npm start`를 실행합니다.
2. 로비에서 **반지 원정대** 방을 만들고 1~4명이 참가합니다. 1명은 네 손패를 조종하고, 2명은 공개 피라미드 패를 포함한 세 좌석을 사용합니다.
3. 방장이 1~18장 중 챕터를 선택합니다. 모든 참가자가 준비하면 캐릭터 선택, 준비 행동, 트릭 플레이를 진행합니다.
4. 캐릭터 목표와 사건·저주·선물 효과를 적용해 짧은 장은 한 라운드, 긴 장은 여러 라운드, 마지막 장은 두 그룹의 라운드로 완료합니다.

규칙과 챕터·카드별 출처는 [자료 조사 문서](docs/fellowship-trick-taking-sources.md)에, 기계 판독형 효과는 [카탈로그](backend/src/game-room/fellowship/catalog.ts)에 있습니다. 저작권이 있는 카드 그림과 룰북 PDF는 저장소에 포함하지 않았습니다.

## 검증

- 백엔드: `cd backend && npm test`
- 프런트엔드: `cd frontend && CI=true npm test -- --watchAll=false --runInBand && CI=true npm run build`
- 실제 WebSocket 흐름: `cd backend && npm run build && FELLOWSHIP_ONLY=1 node test/socket-e2e.cjs`
