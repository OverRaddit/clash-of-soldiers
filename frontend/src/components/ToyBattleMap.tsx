import React, { useEffect } from 'react';
import './ToyBattleMap.css';

// Vertex 정보 정의
// interface Vertex {
//   id: string;
//   x: string;
//   y: string;
//   type: number; // 1: base, 2: special, 3: gray
// }
interface Vertex {
  id: string;
  x: number;
  y: number;
  type: number; // 1: base, 2: special, 3: gray
}

// 정점 데이터 (토이배틀_기본맵구조.md 기준)
// const vertices: Vertex[] = [
//   // 플레이어 거점 (type 1)
//   { id: 'X', x: '5%', y: '50%', type: 1 },
//   { id: 'Y', x: '95%', y: '50%', type: 1 },

//   // 회색지대 (type 3)
//   { id: 'X1', x: '15%', y: '15%', type: 3 },
//   { id: 'X2', x: '15%', y: '85%', type: 3 },
//   { id: 'X3', x: '85%', y: '15%', type: 3 },
//   { id: 'X4', x: '85%', y: '85%', type: 3 },
//   { id: 'Y1', x: '30%', y: '30%', type: 3 },
//   { id: 'Y2', x: '30%', y: '70%', type: 3 },
//   { id: 'Y3', x: '70%', y: '30%', type: 3 },
//   { id: 'Y4', x: '70%', y: '70%', type: 3 },
//   { id: 'M1', x: '50%', y: '20%', type: 3 },
//   { id: 'M2', x: '50%', y: '50%', type: 3 },
//   { id: 'M3', x: '50%', y: '80%', type: 3 },

//   // 특수 지대 (type 2)
//   { id: 'S1', x: '25%', y: '10%', type: 2 },
//   { id: 'S2', x: '25%', y: '90%', type: 2 },
//   { id: 'S3', x: '75%', y: '10%', type: 2 },
//   { id: 'S4', x: '75%', y: '90%', type: 2 },
// ];
const vertices: Vertex[] = [
  { id: 'X', x: 60, y: 384, type: 1 },
  { id: 'Y', x: 1040, y: 384, type: 1 },

  // 회색 지대 (원본 이미지 픽셀 좌표 기반)
  { id: 'X1', x: 60, y: 140, type: 3 },
  { id: 'X2', x: 60, y: 640, type: 3 },
  { id: 'X3', x: 1020, y: 120, type: 3 },
  { id: 'X4', x: 1020, y: 620, type: 3 },
  { id: 'Y1', x: 230, y: 300, type: 3 },
  { id: 'Y2', x: 230, y: 480, type: 3 },
  { id: 'Y3', x: 860, y: 290, type: 3 },
  { id: 'Y4', x: 860, y: 480, type: 3 },
  { id: 'M1', x: 545, y: 150, type: 3 },
  { id: 'M2', x: 545, y: 384, type: 3 },
  { id: 'M3', x: 545, y: 610, type: 3 },

  // 특수 지대
  { id: 'S1', x: 320, y: 90, type: 2 },
  { id: 'S2', x: 320, y: 680, type: 2 },
  { id: 'S3', x: 800, y: 90, type: 2 },
  { id: 'S4', x: 800, y: 680, type: 2 },
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

  return (
    <div
      className='toy-battle-map-container'
      style={{ backgroundImage: 'url(/map-background.png)' }}
    >
      <svg
        viewBox='0 0 1090 768' // 원본 맵 비율
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
                    (isGiantSelectionMode && availableTargets.includes(vertex.id)) 
                      ? 'clickable' : ''
                  } ${
                    isGiantSelectionMode && availableTargets.includes(vertex.id)
                      ? 'giant-target-available' : ''
                  }`}
                  onClick={() => onVertexClick && onVertexClick(vertex.id)}
                  style={{
                    cursor:
                      (selectedSoldierIndex !== null && isMyTurn) || 
                      (isGiantSelectionMode && availableTargets.includes(vertex.id))
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
                      fill={topSoldier.playerColor === 'red' ? '#ffe0e0' : '#e0f0ff'}
                      stroke={topSoldier.playerColor === 'red' ? '#c92a2a' : '#1864ab'}
                      strokeWidth='2'
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
                        fill={topSoldier.playerColor === 'red' ? '#c92a2a' : '#1864ab'}
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
                          {topSoldier.type === 8 ? '🃏' : `⚔️${topSoldier.type}`}
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
