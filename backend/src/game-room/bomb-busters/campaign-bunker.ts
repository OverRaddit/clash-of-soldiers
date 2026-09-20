import { BombWireValue } from '../entities/bomb-busters-game-state.entity';
import { BOMB_CONSTRAINTS } from './rule-cards';

export type BombBunkerDirection = 'north' | 'east' | 'south' | 'west';
export type BombBunkerConstraint = 'A' | 'B' | 'C' | 'D' | 'E';
export type BombBunkerFloor = 'ground' | 'basement';
export type BombBunkerStage = 'open_door' | 'neutralize_guard' | 'reach_basement' | 'disable_laser' | 'handcuff_doctor' | 'finish_defusal';
export type BombBunkerPoint = [number, number];
export interface BombBunkerState {
  floor: BombBunkerFloor;
  position: BombBunkerPoint;
  constraints: Record<BombBunkerDirection | 'action', BombBunkerConstraint>;
  stage: BombBunkerStage;
  doorOpen: boolean;
  guardNeutralized: boolean;
  laserDisabled: boolean;
  doctorHandcuffed: boolean;
}
interface BunkerCell { at: BombBunkerPoint; type: string; striped?: boolean; }
type Edge = [BombBunkerPoint, BombBunkerPoint];

/** North-up transcription independently checked against both original Bunker cards. */
export const BOMB_BUNKER_MAP: Record<BombBunkerFloor, { cells: BunkerCell[]; walls: Edge[]; gates: Edge[] }> = {
  ground: {
    cells: [{ at: [0,0], type: 'helicopter' }, { at: [1,2], type: 'key', striped: true }, { at: [3,1], type: 'guard', striped: true }, { at: [3,0], type: 'stairs' }],
    walls: [[[1,0],[2,0]], [[1,1],[2,1]], [[3,0],[3,1]]],
    gates: [[[1,2],[2,2]]],
  },
  basement: {
    cells: [{ at: [3,0], type: 'stairs' }, { at: [3,1], type: 'trap' }, { at: [3,2], type: 'laserLever', striped: true }, { at: [1,0], type: 'trap' }, { at: [1,2], type: 'trap' }, { at: [0,0], type: 'doctorNope', striped: true }],
    walls: [[[3,0],[3,1]]],
    gates: [[[1,0],[2,0]], [[1,1],[2,1]], [[1,2],[2,2]]],
  },
};
const deltas: Record<BombBunkerDirection, BombBunkerPoint> = { north: [0,-1], east: [1,0], south: [0,1], west: [-1,0] };
const same = (a: BombBunkerPoint, b: BombBunkerPoint) => a[0] === b[0] && a[1] === b[1];
const crosses = (from: BombBunkerPoint, to: BombBunkerPoint, edges: Edge[]) => edges.some(([a,b]) => (same(from,a) && same(to,b)) || (same(from,b) && same(to,a)));
export const bunkerConstraintAllows = (id: BombBunkerConstraint, value: BombWireValue): boolean => typeof value === 'number' && BOMB_CONSTRAINTS.find(c => c.id === id).allowedBlueValues.includes(value);

export function createBombBunker(shuffledCards: BombBunkerConstraint[]): BombBunkerState {
  if (shuffledCards.length !== 5 || new Set(shuffledCards).size !== 5 || shuffledCards.some(id => !['A','B','C','D','E'].includes(id))) throw new Error('벙커에는 서로 다른 제약 A–E가 필요합니다.');
  const [north,east,south,west,action] = shuffledCards;
  return { floor: 'ground', position: [0,0], constraints: { north,east,south,west,action }, stage: 'open_door', doorOpen: false, guardNeutralized: false, laserDisabled: false, doctorHandcuffed: false };
}

export function bunkerAtStageAction(b: BombBunkerState): boolean {
  return (b.stage === 'open_door' && b.floor === 'ground' && same(b.position,[1,2]) && !b.doorOpen)
    || (b.stage === 'neutralize_guard' && b.floor === 'ground' && same(b.position,[3,1]) && !b.guardNeutralized)
    || (b.stage === 'disable_laser' && b.floor === 'basement' && same(b.position,[3,2]) && !b.laserDisabled)
    || (b.stage === 'handcuff_doctor' && b.floor === 'basement' && same(b.position,[0,0]) && !b.doctorHandcuffed);
}

export function bunkerStageComplete(b: BombBunkerState): boolean {
  switch (b.stage) {
    case 'open_door': return b.doorOpen;
    case 'neutralize_guard': return b.guardNeutralized;
    case 'reach_basement': return b.floor === 'basement';
    case 'disable_laser': return b.laserDisabled;
    case 'handcuff_doctor': return b.doctorHandcuffed;
    default: return false;
  }
}

/** Call for success and failure alike. A blocked eligible direction permits staying only if all are blocked. */
export function allowedBunkerMoves(b: BombBunkerState, value: BombWireValue): BombBunkerDirection[] {
  if (b.stage === 'finish_defusal' || bunkerStageComplete(b) || bunkerAtStageAction(b)) return [];
  const map = BOMB_BUNKER_MAP[b.floor];
  return (Object.keys(deltas) as BombBunkerDirection[]).filter(direction => {
    if (!bunkerConstraintAllows(b.constraints[direction], value)) return false;
    const delta = deltas[direction];
    const next: BombBunkerPoint = [b.position[0]+delta[0], b.position[1]+delta[1]];
    if (next[0] < 0 || next[0] > 3 || next[1] < 0 || next[1] > 2 || crosses(b.position,next,map.walls)) return false;
    const gateOpen = b.floor === 'ground' ? b.doorOpen : b.laserDisabled;
    return gateOpen || !crosses(b.position,next,map.gates);
  });
}

/** Returns the trap penalty. Moving onto a stair changes floors exactly once. */
export function moveBombBunker(b: BombBunkerState, value: BombWireValue, direction: BombBunkerDirection): number {
  if (!allowedBunkerMoves(b,value).includes(direction)) throw new Error('그 방향으로 이동할 수 없습니다.');
  const delta = deltas[direction]; b.position = [b.position[0]+delta[0],b.position[1]+delta[1]];
  const cell = BOMB_BUNKER_MAP[b.floor].cells.find(c => same(c.at,b.position));
  if (cell?.type === 'stairs') b.floor = b.floor === 'ground' ? 'basement' : 'ground';
  return cell?.type === 'trap' ? 1 : 0;
}

export function performBunkerAction(b: BombBunkerState, value: BombWireValue, success: boolean): boolean {
  if (!bunkerAtStageAction(b)) throw new Error('현재 목표 행동 칸이 아닙니다.');
  if (b.stage === 'disable_laser' ? value !== 'yellow' : !bunkerConstraintAllows(b.constraints.action,value)) throw new Error('행동 제약에 맞는 전선을 절단하세요.');
  if (!success) return false;
  if (b.stage === 'open_door') b.doorOpen = true;
  else if (b.stage === 'neutralize_guard') b.guardNeutralized = true;
  else if (b.stage === 'disable_laser') b.laserDisabled = true;
  else if (b.stage === 'handcuff_doctor') b.doctorHandcuffed = true;
  return true;
}
