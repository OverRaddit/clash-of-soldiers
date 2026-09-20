import React, { useId } from 'react';
import { BombBunkerView } from '../types/bomb-busters.types';

interface Props { bunker: BombBunkerView; availableDirections: string[]; }
const cellLabels: Record<string, string> = { helicopter: '헬리콥터', key: '열쇠', guard: '경비', stairs: '계단', trap: '함정', laserLever: '레이저 장치', doctorNope: '닥터 노프' };
const constraintLabels: Record<string, string> = { A: '짝수', B: '홀수', C: '1–6', D: '7–12', E: '4–9' };
const stageLabels: Record<string, string> = { open_door: '열쇠로 문 열기', neutralize_guard: '경비 무력화', reach_basement: '지하로 이동', disable_laser: '레이저 해제', handcuff_doctor: '닥터 노프 체포', finish_defusal: '남은 전선 해체' };
const directionLabels: Record<string, string> = { north: '↑ 북쪽', east: '동쪽 →', south: '↓ 남쪽', west: '← 서쪽' };
const deltas: Record<string, [number, number]> = { north: [0, -1], east: [1, 0], south: [0, 1], west: [-1, 0] };
const cellSize = 80;
const originX = 40;
const originY = 38;
const samePoint = (a: number[], b: number[]) => a[0] === b[0] && a[1] === b[1];
const coordinateLabel = (position: number[]) => `${String.fromCharCode(65 + position[0])}${position[1] + 1}`;

const BombBustersBunker: React.FC<Props> = ({ bunker, availableDirections }) => {
  const uniqueId = useId();
  const stripeId = `${uniqueId}-stripes`;
  const titleId = `${uniqueId}-title`;
  const floorLabel = bunker.floor === 'ground' ? '지상' : '지하';
  const gateOpen = bunker.floor === 'ground' ? bunker.doorOpen : bunker.laserDisabled;
  const currentCell = bunker.map.cells.find((cell) => samePoint(cell.at, bunker.position));
  const edgeLine = (edge: [[number, number], [number, number]], key: string, gate = false) => {
    const [from, to] = edge;
    const vertical = from[0] !== to[0];
    const x = originX + (vertical ? Math.max(from[0], to[0]) : from[0]) * cellSize;
    const y = originY + (vertical ? from[1] : Math.max(from[1], to[1])) * cellSize;
    return <line key={key} x1={x} y1={y} x2={x + (vertical ? 0 : cellSize)} y2={y + (vertical ? cellSize : 0)} className={gate ? gateOpen ? 'bb-bunker-gate open' : 'bb-bunker-gate' : 'bb-bunker-wall'} />;
  };
  return <section className="bb-bunker" aria-label="벙커 지도">
    <div className="bb-bunker-heading"><h3>벙커 · {floorLabel}</h3><span>목표: {stageLabels[bunker.stage] || bunker.stage}</span></div>
    <div className="bb-bunker-layout">
      <div>
        <svg viewBox="0 0 400 310" role="img" aria-labelledby={titleId} className="bb-bunker-map">
          <title id={titleId}>{floorLabel} 벙커 지도. 현재 위치 {coordinateLabel(bunker.position)}{currentCell ? `, ${cellLabels[currentCell.type] || currentCell.type}` : ''}. 북쪽이 위입니다.</title>
          <defs><pattern id={stripeId} patternUnits="userSpaceOnUse" width="9" height="9" patternTransform="rotate(45)"><rect width="9" height="9" fill="#fff8de" /><rect width="3" height="9" fill="#eddc9b" /></pattern></defs>
          <text x="200" y="15" className="bb-bunker-north">↑ N</text>
          {Array.from({ length: 4 }, (_, column) => <text key={`col-${column}`} x={originX + column * cellSize + cellSize / 2} y={originY - 10} className="bb-bunker-coordinate">{String.fromCharCode(65 + column)}</text>)}
          {Array.from({ length: 3 }, (_, row) => <text key={`row-${row}`} x={originX - 14} y={originY + row * cellSize + cellSize / 2} className="bb-bunker-coordinate">{row + 1}</text>)}
          {Array.from({ length: 12 }, (_, index) => {
            const point: [number, number] = [index % 4, Math.floor(index / 4)];
            const cell = bunker.map.cells.find((item) => samePoint(item.at, point));
            const current = samePoint(point, bunker.position);
            const next = availableDirections.some((direction) => deltas[direction] && samePoint(point, [bunker.position[0] + deltas[direction][0], bunker.position[1] + deltas[direction][1]]));
            const x = originX + point[0] * cellSize;
            const y = originY + point[1] * cellSize;
            return <g key={index}>
              <rect x={x} y={y} width={cellSize} height={cellSize} fill={cell?.striped ? `url(#${stripeId})` : current ? '#e7f1f9' : next ? '#eaf7f1' : '#f8fafc'} stroke="#d3dee8" strokeWidth="1" />
              {cell?.type === 'trap' && <path d={`M ${x + 40} ${y + 18} L ${x + 27} ${y + 41} L ${x + 53} ${y + 41} Z`} fill="#c46b61" />}
              {cell && <text x={x + 40} y={y + 65} className={`bb-bunker-cell-label ${cell.type === 'trap' ? 'trap' : ''}`}>{cellLabels[cell.type] || cell.type}</text>}
              {next && !current && <circle cx={x + 40} cy={y + 31} r="5" fill="#80ac99" />}
              {current && <g aria-label="팀 위치"><circle cx={x + 40} cy={y + 31} r="18" fill="#d87329" stroke="#fff" strokeWidth="3" /><text x={x + 40} y={y + 36} className="bb-bunker-team">팀</text></g>}
            </g>;
          })}
          <rect x={originX} y={originY} width={cellSize * 4} height={cellSize * 3} rx="2" fill="none" stroke="#728699" strokeWidth="2" />
          {bunker.map.walls.map((edge, index) => edgeLine(edge, `wall-${index}`))}
          {bunker.map.gates.map((edge, index) => edgeLine(edge, `gate-${index}`, true))}
        </svg>
        <p className="bb-bunker-location">현재 <strong>{floorLabel} {coordinateLabel(bunker.position)}</strong> · {currentCell ? cellLabels[currentCell.type] || currentCell.type : '복도'}</p>
        <div className="bb-bunker-legend"><span><i className="wall" />벽</span><span><i className="gate" />{bunker.floor === 'ground' ? '문' : '레이저'} {gateOpen ? '개방' : '차단'}</span><span><i className="striped" />행동 칸</span></div>
      </div>
      <div className="bb-bunker-instructions">
        <h4>방향별 절단 조건</h4>
        <div className="bb-bunker-constraints">{(['north', 'east', 'south', 'west'] as const).map((direction) => <div key={direction} className={availableDirections.includes(direction) ? 'available' : ''}><span>{directionLabels[direction]}</span><strong>{bunker.constraints[direction]} · {constraintLabels[bunker.constraints[direction]] || bunker.constraints[direction]}</strong></div>)}</div>
        <p className="bb-bunker-action-rule">행동 조건 <strong>{bunker.stage === 'disable_laser' ? '노랑' : `${bunker.constraints.action} · ${constraintLabels[bunker.constraints.action] || bunker.constraints.action}`}</strong></p>
        <p>전선을 자른 뒤 허용된 방향으로 이동합니다. 줄무늬 목표 칸에서는 조건에 맞는 절단 성공으로 행동합니다. 이동 방향은 미션 행동에서 선택하세요.</p>
        <ul className="bb-bunker-objectives">{[[bunker.doorOpen, '문 열기'], [bunker.guardNeutralized, '경비 무력화'], [bunker.laserDisabled, '레이저 해제'], [bunker.doctorHandcuffed, '박사 체포']].map(([done, label]) => <li key={String(label)} className={done ? 'complete' : ''}>{done ? '✓' : '○'} {label}</li>)}</ul>
      </div>
    </div>
  </section>;
};
export default BombBustersBunker;
