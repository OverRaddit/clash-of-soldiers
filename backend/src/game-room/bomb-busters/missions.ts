import { BombMission } from '../entities/bomb-busters-game-state.entity';
import { BOMB_CAMPAIGN_DEFINITIONS } from './campaign-definitions';
import { bombCampaignInstructions } from './campaign-instructions';

/** Factual setup data from missions 1–8; player-count overrides stay here, not in the engine. */
export interface BombMissionDefinition extends BombMission {
  twoPlayer?: Partial<Omit<BombMission, 'id' | 'name'>>;
}

const base = {
  blueMax: 12, redCount: 1, yellowCount: 2, redCandidateCount: 1, yellowCandidateCount: 2,
  redCandidateMax: 12, yellowCandidateMax: 12, equipment: true,
};

export const BOMB_BUSTERS_MISSIONS: BombMissionDefinition[] = [
  { ...base, id: 1, name: '훈련 1 · 첫 절단', description: '파란 전선 1~6 각 4개. 개인 더블 탐지기로 기본 절단을 익힙니다.', blueMax: 6, redCount: 0, yellowCount: 0, redCandidateCount: 0, yellowCandidateCount: 0, redCandidateMax: 6, yellowCandidateMax: 6, equipment: false },
  { ...base, id: 2, name: '훈련 2 · 노란 전선', description: '파란 전선 1~8 각 4개와 노란 전선 2개. 노랑은 모두 같은 값입니다.', blueMax: 8, redCount: 0, redCandidateCount: 0, redCandidateMax: 8, yellowCandidateMax: 8, equipment: false },
  { ...base, id: 3, name: '훈련 3 · 빨간 전선과 장비', description: '파란 전선 1~10 각 4개와 빨간 전선 1개. 장비 2·12는 제외합니다.', blueMax: 10, yellowCount: 0, yellowCandidateCount: 0, redCandidateMax: 10, yellowCandidateMax: 10, equipmentExcluded: [2, 12] },
  { ...base, id: 4, name: '훈련 4 · 첫 현장 훈련', description: '파란 전선 48개, 빨강 1개, 노랑 2개. 2인은 노랑 4개를 씁니다.', twoPlayer: { yellowCount: 4, yellowCandidateCount: 4 } },
  { ...base, id: 5, name: '훈련 5 · 노란 후보', description: '빨강 1개와 후보 3개 중 노랑 2개. 2인은 빨강 2개를 씁니다.', yellowCandidateCount: 3, twoPlayer: { redCount: 2, redCandidateCount: 2 } },
  { ...base, id: 6, name: '훈련 6 · 네 개의 노랑', description: '빨강 1개와 노랑 4개. 2인은 빨강 2개를 씁니다.', yellowCount: 4, yellowCandidateCount: 4, twoPlayer: { redCount: 2, redCandidateCount: 2 } },
  { ...base, id: 7, name: '훈련 7 · 빨간 후보', description: '후보 2개 중 빨강 1개. 노랑은 없으며 2인은 빨간 후보가 3개입니다.', redCandidateCount: 2, yellowCount: 0, yellowCandidateCount: 0, twoPlayer: { redCandidateCount: 3 } },
  { ...base, id: 8, name: '훈련 8 · 최종 시험', description: '빨강 1/2개와 노랑 2/3개. 2인은 빨강 1/3개, 노랑 4개로 시험을 봅니다.', redCandidateCount: 2, yellowCandidateCount: 3, twoPlayer: { redCandidateCount: 3, yellowCount: 4, yellowCandidateCount: 4 } },
  { ...base, id: 0, name: '기본 해체 작전 · 자유 연습', description: '기본 규칙을 조합한 자유 연습으로 공식 캠페인 미션은 아닙니다. 파란 전선 48개, 빨강 1개(2인은 2개), 후보 3개 중 노랑 2개와 기본 장비 12종을 사용합니다.', yellowCandidateCount: 3, twoPlayer: { redCount: 2, redCandidateCount: 2 } },
];

// Training, campaign rules and server-driven audio timelines share one lobby catalog.
BOMB_BUSTERS_MISSIONS.splice(8, 0, ...BOMB_CAMPAIGN_DEFINITIONS
  .map(mission => ({ ...mission, description: bombCampaignInstructions(mission) })));

export function resolveBombMission(id: number, playerCount: number): BombMission {
  const definition = BOMB_BUSTERS_MISSIONS.find(mission => mission.id === id);
  if (!definition) throw new Error('지원하지 않는 미션입니다.');
  const { twoPlayer, ...mission } = definition;
  return structuredClone({ ...mission, ...(playerCount === 2 ? twoPlayer : {}) });
}
