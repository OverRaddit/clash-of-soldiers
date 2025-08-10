import React, { useEffect } from 'react';
import './ToyBattleMap.css';

// Vertex 정보 정의
interface Vertex {
  id: string;
  x: number;
  y: number;
  type: number; // 1: base, 2: special, 3: gray
}

// 정점 데이터 (토이배틀_기본맵구조.md 기준)
const vertices: Vertex[] = [
  // 90도 반시계방향 회전: new_x = 768 - old_y, new_y = old_x
  { id: 'X', x: 384, y: 60, type: 1 },
  { id: 'Y', x: 384, y: 1040, type: 1 },

  // 회색 지대 (90도 반시계방향 회전된 좌표)
  { id: 'X1', x: 628, y: 60, type: 3 },
  { id: 'X2', x: 128, y: 60, type: 3 },
  { id: 'X3', x: 648, y: 1020, type: 3 },
  { id: 'X4', x: 148, y: 1020, type: 3 },
  { id: 'Y1', x: 468, y: 230, type: 3 },
  { id: 'Y2', x: 288, y: 230, type: 3 },
  { id: 'Y3', x: 478, y: 860, type: 3 },
  { id: 'Y4', x: 288, y: 860, type: 3 },
  { id: 'M1', x: 618, y: 545, type: 3 },
  { id: 'M2', x: 384, y: 545, type: 3 },
  { id: 'M3', x: 158, y: 545, type: 3 },

  // 특수 지대
  { id: 'S1', x: 678, y: 320, type: 2 },
  { id: 'S2', x: 88, y: 320, type: 2 },
  { id: 'S3', x: 678, y: 800, type: 2 },
  { id: 'S4', x: 88, y: 800, type: 2 },
];

// 연결선 데이터 (토이배틀_기본맵구조.md 기준)
const edges: [string, string][] = [
  // 원본 절반
  ['X', 'X1'],
  ['X', 'X2'],
  ['X1', 'Y1'],
  ['X2', 'Y2'],
  ['Y1', 'M1'],
  ['Y2', 'M2'],
  ['Y1', 'S1'],
  ['Y2', 'M3'],
  ['Y1', 'M2'],
  ['Y2', 'S2'],
  ['S1', 'M1'],
  ['S2', 'M3'],

  // 대칭 절반
  ['Y', 'X3'],
  ['Y', 'X4'],
  ['X3', 'Y3'],
  ['X4', 'Y4'],
  ['Y3', 'M1'],
  ['Y4', 'M2'],
  ['Y3', 'S3'],
  ['Y4', 'M3'],
  ['Y3', 'M2'],
  ['Y4', 'S4'],
  ['S3', 'M1'],
  ['S4', 'M3'],
];

interface ToyBattleMapProps {
  gameState?: any;
  selectedSoldierIndex?: number | null;
  onVertexClick?: (vertexId: string) => void;
  getSoldierName?: (type: number) => string;
  getVertexOwner?: (vertexId: string) => string | null;
  isMyTurn?: boolean;
  isGiantSelectionMode?: boolean;
  availableTargets?: string[];
}

export default function ToyBattleMap({
  gameState,
  selectedSoldierIndex,
  onVertexClick,
  getSoldierName,
  getVertexOwner,
  isMyTurn = false,
  isGiantSelectionMode = false,
  availableTargets = [],
}: ToyBattleMapProps) {
  // 게임 상태 변경 시 디버깅 로그
  useEffect(() => {
    if (gameState) {
      console.log('ToyBattleMap: gameState 업데이트됨:', gameState);
    }
  }, [gameState]);
  // 정점 색상 결정
  const getVertexColor = (
    vertex: Vertex,
    gameVertex?: any,
    owner?: string | null
  ) => {
    // 거인병 선택 모드에서 선택 가능한 대상인지 확인
    if (isGiantSelectionMode && availableTargets.includes(vertex.id)) {
      return '#2ed573'; // 초록색으로 강조
    }

    if (vertex.type === 1) {
      // 플레이어 거점
      if (vertex.id === 'X') return '#ff6b6b'; // 빨간 거점
      if (vertex.id === 'Y') return '#4dabf7'; // 파란 거점
    }

    if (vertex.type === 2) {
      // 특수 지대
      return '#ffd43b';
    }

    // 회색지대 - 점령 상태에 따라 색상 변경
    if (owner) {
      return owner === 'red' ? '#ff8787' : '#74c0fc';
    }

    return '#adb5bd'; // 기본 회색
  };

  // 연결선 그리기를 위한 좌표 계산
  const getVertexPosition = (vertexId: string) => {
    const vertex = vertices.find((v) => v.id === vertexId);
    if (!vertex) return { x: 0, y: 0 };
    return { x: vertex.x, y: vertex.y }; // 픽셀 값 그대로 사용
  };

  // 마지막 배치 여부 확인
  const isLastPlacement = (vertexId: string) => {
    if (!gameState?.lastPlacements || gameState.lastPlacements.length === 0) {
      return false;
    }
    return gameState.lastPlacements.some((placement: any) => placement.vertexId === vertexId);
  };

  return (
    <div
      className='toy-battle-map-container'
      style={{ backgroundImage: 'url(/map-background.png)' }}
    >
      <svg
        viewBox='0 0 768 1090' // 90도 반시계방향 회전된 맵 비율
        className='toy-battle-map'
        preserveAspectRatio='xMidYMid meet'
      >
        {/* 연결선 그리기 */}
        <g className='edges'>
          {edges.map(([from, to], index) => {
            const fromPos = getVertexPosition(from);
            const toPos = getVertexPosition(to);

            return (
              <line
                key={`${from}-${to}-${index}`}
                x1={fromPos.x}
                y1={fromPos.y}
                x2={toPos.x}
                y2={toPos.y}
                stroke='#333'
                strokeWidth='3'
                strokeDasharray='5,5'
              />
            );
          })}
        </g>

        {/* 정점 그리기 */}
        <g className='vertices'>
          {vertices.map((vertex) => {
            const gameVertex = gameState?.vertices.find(
              ([id]: [string, any]) => id === vertex.id
            )?.[1];
            const owner = getVertexOwner ? getVertexOwner(vertex.id) : null;
            const topSoldier =
              gameVertex?.soldiers?.[gameVertex.soldiers.length - 1];
            const vertexColor = getVertexColor(vertex, gameVertex, owner);
            const isLastPlaced = isLastPlacement(vertex.id);

            return (
              <g key={vertex.id}>
                {/* 정점 원 */}
                <circle
                  cx={vertex.x}
                  cy={vertex.y}
                  r='35'
                  fill={vertexColor}
                  stroke='#333'
                  strokeWidth='0.3'
                  className={`vertex ${
                    (selectedSoldierIndex !== null && isMyTurn) ||
                    (isGiantSelectionMode &&
                      availableTargets.includes(vertex.id))
                      ? 'clickable'
                      : ''
                  } ${
                    isGiantSelectionMode && availableTargets.includes(vertex.id)
                      ? 'giant-target-available'
                      : ''
                  } ${
                    isLastPlaced && topSoldier
                      ? 'last-placement'
                      : ''
                  }`}
                  onClick={() => onVertexClick && onVertexClick(vertex.id)}
                  style={{
                    cursor:
                      (selectedSoldierIndex !== null && isMyTurn) ||
                      (isGiantSelectionMode &&
                        availableTargets.includes(vertex.id))
                        ? 'pointer'
                        : 'default',
                  }}
                />

                {/* 정점 ID 텍스트 */}
                <text
                  x={vertex.x}
                  y={vertex.y + 5}
                  textAnchor='middle'
                  fontSize='20'
                  fontWeight='bold'
                  fill='#000'
                  className='vertex-label'
                  style={{ pointerEvents: 'none' }}
                >
                  {vertex.id}
                </text>

                {/* 병정 정보 */}
                {topSoldier && (
                  <g>
                    {/* 병정이 있는 vertex 표시용 배경 원 */}
                    <circle
                      cx={vertex.x}
                      cy={vertex.y}
                      r='40'
                      fill={
                        topSoldier.playerColor === 'red' ? '#ffe0e0' : '#e0f0ff'
                      }
                      stroke={
                        topSoldier.playerColor === 'red' ? '#c92a2a' : '#1864ab'
                      }
                      strokeWidth='8'
                      opacity='0.6'
                      style={{ pointerEvents: 'none' }}
                    />

                    {/* 병정 이미지 */}
                    {topSoldier.type > 0 && (
                      <g>
                        <defs>
                          <clipPath id={`clip-${vertex.id}`}>
                            <circle cx={vertex.x} cy={vertex.y} r='38' />
                          </clipPath>
                        </defs>
                        <image
                          x={vertex.x - 45}
                          y={vertex.y - 45}
                          width='90'
                          height='90'
                          href={`/soldiers/${topSoldier.type}.png`}
                          clipPath={`url(#clip-${vertex.id})`}
                          style={{ pointerEvents: 'none' }}
                        />
                      </g>
                    )}

                    {/* 거점(type 0)인 경우 텍스트 표시 */}
                    {topSoldier.type === 0 && (
                      <text
                        x={vertex.x}
                        y={vertex.y + 5}
                        textAnchor='middle'
                        fontSize='14'
                        fontWeight='bold'
                        fill={
                          topSoldier.playerColor === 'red'
                            ? '#c92a2a'
                            : '#1864ab'
                        }
                        className='soldier-info'
                      >
                        거점
                      </text>
                    )}

                    {/* 병정 번호/힘 스탯 정보 */}
                    {topSoldier.type > 0 && (
                      <g>
                        <ellipse
                          cx={vertex.x - 30}
                          cy={vertex.y - 30}
                          rx='20'
                          ry='16'
                          fill='#2f3542'
                          stroke='#fff'
                          strokeWidth='2'
                        />
                        <text
                          x={vertex.x - 30}
                          y={vertex.y - 24}
                          textAnchor='middle'
                          fontSize='14'
                          fontWeight='bold'
                          fill='#fff'
                          className='power-stat'
                        >
                          {topSoldier.type === 8
                            ? '🃏'
                            : `⚔️${topSoldier.type}`}
                        </text>
                      </g>
                    )}

                    {/* 스택 개수 정보 */}
                    {gameVertex.soldiers.length > 1 && (
                      <g>
                        <circle
                          cx={vertex.x + 30}
                          cy={vertex.y - 30}
                          r='16'
                          fill='#ff4757'
                          stroke='#fff'
                          strokeWidth='2'
                        />
                        <text
                          x={vertex.x + 30}
                          y={vertex.y - 24}
                          textAnchor='middle'
                          fontSize='18'
                          fontWeight='bold'
                          fill='#fff'
                          className='stack-count'
                        >
                          {gameVertex.soldiers.length}
                        </text>
                      </g>
                    )}

                    {/* 마지막 배치 효과 링 */}
                    {isLastPlaced && (
                      <circle
                        cx={vertex.x}
                        cy={vertex.y}
                        r='50'
                        className='last-placement-ring'
                      />
                    )}
                  </g>
                )}
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
