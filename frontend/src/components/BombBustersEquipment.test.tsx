import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import BombBustersEquipment from './BombBustersEquipment';
import { BombBustersClientState } from '../types/bomb-busters.types';

const makeState = (overrides: Partial<BombBustersClientState> = {}): BombBustersClientState => ({
  phase: 'playing', mission: { id: 8, name: '장비 훈련', description: '', blueMax: 12, redCount: 1, yellowCount: 2, redCandidateCount: 1, yellowCandidateCount: 2, equipment: true },
  players: [
    { id: 'me', name: '나', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'mine', wires: [
      { id: 'own-2', value: 2, sortValue: 2, cut: false, hint: null },
      { id: 'own-3', value: 3, sortValue: 3, cut: false, hint: null },
    ] }] },
    { id: 'friend', name: '동료', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'theirs', wires: [
      { id: 'other-a', value: null, sortValue: null, cut: false, hint: null },
      { id: 'other-b', value: null, sortValue: null, cut: false, hint: null },
    ] }] },
  ],
  captainId: 'me', currentPlayerId: 'me', mistakes: 0, maxMistakes: 2, turnNumber: 1,
  outcome: null, endReason: null, redMarkers: [], yellowMarkers: [],
  equipment: [
    { id: 3, name: '트리플 탐지기', description: '같은 받침대의 세 전선 탐지', unlocked: true, used: false },
    { id: 5, name: '슈퍼 탐지기', description: '받침대 전체 탐지', unlocked: true, used: false },
    { id: 9, name: '안정기', description: '폭발 방지', unlocked: true, used: false },
    { id: 10, name: 'X/Y 광선', description: '서로 다른 두 값 선언', unlocked: true, used: false },
  ],
  stabilizerActive: false, superDetectorActive: false, tripleDetectorActive: false, xyRayActive: false,
  preparedEquipment: [], pendingDetector: null, log: [], cutCounts: {}, ...overrides,
});

const card = (name: string) => within(screen.getByText(name, { exact: true }).closest('article')!);
const prepare = (name: string) => card(name).getByRole('button', { name: '이번 차례에 장비 준비' });
const show = (state = makeState(), onAction = jest.fn()) => ({
  onAction,
  ...render(<BombBustersEquipment state={state} playerId="me" disabled={false} onAction={onAction} onSelectRelation={jest.fn()} />),
});

test('X/Y can be followed by a triple or super detector and stabilizer', () => {
  const { onAction } = show(makeState({ xyRayActive: true, preparedEquipment: [{ equipmentId: 10, playerId: 'me', personal: false }] }));
  expect(prepare('트리플 탐지기')).toBeEnabled();
  expect(prepare('슈퍼 탐지기')).toBeEnabled();
  expect(prepare('안정기')).toBeEnabled();
  expect(card('X/Y 광선').getByRole('button', { name: '준비됨' })).toBeDisabled();
  fireEvent.click(prepare('트리플 탐지기'));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'equipment', equipmentId: 3 }));
});

test.each(['tripleDetectorActive', 'superDetectorActive'] as const)('X/Y can follow %s while additional detectors remain unavailable', (flag) => {
  const { onAction } = show(makeState({ [flag]: true }));
  expect(prepare('트리플 탐지기')).toBeDisabled();
  expect(prepare('슈퍼 탐지기')).toBeDisabled();
  expect(prepare('X/Y 광선')).toBeEnabled();
  expect(prepare('안정기')).toBeEnabled();
  fireEvent.click(prepare('X/Y 광선'));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'equipment', equipmentId: 10 }));
});

test('preparing marks only the chosen public or personal source and cancelling leaves both charges available', () => {
  const state = makeState({ tripleDetectorActive: true, preparedEquipment: [{ equipmentId: 3, playerId: 'me', personal: true }] });
  state.players[0].personalEquipmentId = 3;
  const { rerender, onAction } = show(state);
  expect(card('개인 트리플 탐지기').getByRole('button', { name: '준비됨' })).toBeDisabled();
  expect(card('개인 트리플 탐지기').queryByText('사용 완료')).not.toBeInTheDocument();
  expect(card('트리플 탐지기').getByText('사용 가능')).toBeInTheDocument();
  expect(card('트리플 탐지기').queryByText('준비됨')).not.toBeInTheDocument();
  expect(prepare('트리플 탐지기')).toBeDisabled();
  const cancelled = { ...state, tripleDetectorActive: false, preparedEquipment: [] };
  rerender(<BombBustersEquipment state={cancelled} playerId="me" disabled={false} onAction={onAction} onSelectRelation={jest.fn()} />);
  expect(prepare('개인 트리플 탐지기')).toBeEnabled();
  expect(prepare('트리플 탐지기')).toBeEnabled();
  fireEvent.click(prepare('개인 트리플 탐지기'));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'equipment', equipmentId: 3, personal: true }));
});

test('a public reservation does not mark the matching personal equipment as prepared', () => {
  const state = makeState({ xyRayActive: true, preparedEquipment: [{ equipmentId: 10, playerId: 'me', personal: false }] });
  state.players[0].personalEquipmentId = 10;
  show(state);
  expect(card('X/Y 광선').getByRole('button', { name: '준비됨' })).toBeDisabled();
  expect(card('개인 X/Y 광선').getByText('사용 가능')).toBeInTheDocument();
  expect(card('개인 X/Y 광선').queryByText('준비됨')).not.toBeInTheDocument();
  expect(prepare('개인 X/Y 광선')).toBeDisabled();
});

test('an executed preparation is shown as used when the committed state consumes its charge', () => {
  const state = makeState({ xyRayActive: true, preparedEquipment: [{ equipmentId: 10, playerId: 'me', personal: false }] });
  const { rerender, onAction } = show(state);
  expect(card('X/Y 광선').getByText('이번 협력 해체에 사용할 준비가 되었습니다. 아직 소모되지 않았습니다.')).toBeInTheDocument();
  const committed = { ...state, preparedEquipment: [], equipment: state.equipment.map((item) => item.id === 10 ? { ...item, used: true } : item) };
  rerender(<BombBustersEquipment state={committed} playerId="me" disabled={true} onAction={onAction} onSelectRelation={jest.fn()} />);
  expect(card('X/Y 광선').getByText('사용 완료')).toBeInTheDocument();
  expect(card('X/Y 광선').queryByText(/아직 소모되지/)).not.toBeInTheDocument();
  expect(prepare('X/Y 광선')).toBeDisabled();
});

test('X/Y alone can use a yellow value, but adding a detector requires two blue values', () => {
  const state = makeState();
  state.players[0].racks[0].wires[1].value = 'yellow';
  const { rerender, onAction } = show(state);
  expect(prepare('X/Y 광선')).toBeEnabled();
  rerender(<BombBustersEquipment state={{ ...state, tripleDetectorActive: true }} playerId="me" disabled={false} onAction={onAction} onSelectRelation={jest.fn()} />);
  expect(prepare('X/Y 광선')).toBeDisabled();
  expect(card('X/Y 광선').getByText('탐지기와 함께 쓰려면 서로 다른 파란 전선 두 종류가 필요합니다.')).toBeInTheDocument();
  rerender(<BombBustersEquipment state={{ ...state, xyRayActive: true }} playerId="me" disabled={false} onAction={onAction} onSelectRelation={jest.fn()} />);
  expect(prepare('트리플 탐지기')).toBeDisabled();
  expect(prepare('슈퍼 탐지기')).toBeDisabled();
  expect(prepare('안정기')).toBeEnabled();
});

test('a triple detector needs two eligible targets after X wires are excluded', () => {
  const state = makeState({ xyRayActive: true });
  state.players[1].racks[0].wires[0].excluded = true;
  show(state);
  expect(prepare('트리플 탐지기')).toBeDisabled();
  expect(prepare('슈퍼 탐지기')).toBeEnabled();
});

test('an armed combination still permits instant off-turn equipment', () => {
  const state = makeState({ currentPlayerId: 'friend', xyRayActive: true, tripleDetectorActive: true });
  state.equipment.push({ id: 8, name: '전체 레이더', description: '보유 여부 공개', unlocked: true, used: false });
  const { onAction } = show(state);
  fireEvent.change(card('전체 레이더').getByRole('combobox', { name: '전체 레이더로 찾을 숫자' }), { target: { value: '2' } });
  fireEvent.click(card('전체 레이더').getByRole('button', { name: '장비 사용' }));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'equipment', equipmentId: 8, value: 2 }));
  expect(prepare('안정기')).toBeDisabled();
});

test('mission 66 laser action permits stabilizer preparation with only red wires of my own', () => {
  const state = makeState();
  state.mission.id = 66;
  state.players[0].racks[0].wires.forEach((wire) => { wire.value = 'red'; });
  const { rerender, onAction } = show(state);
  expect(prepare('안정기')).toBeDisabled();
  const laser = { id: 'audio_laser', label: '레이저 해제', wireSelection: { owner: 'all' as const, min: 2, max: 2 } };
  state.campaign = {
    title: '벙커', description: '', counters: [], cards: [], controls: [laser],
    audio: { title: '레이저 해제', instructions: [], sourceUrl: '', stepIndex: 3, stepCount: 7, status: 'running', controls: [laser], targetNumbers: [] },
  };
  rerender(<BombBustersEquipment state={{ ...state }} playerId="me" disabled={false} onAction={onAction} onSelectRelation={jest.fn()} />);
  expect(prepare('안정기')).toBeEnabled();
  expect(prepare('트리플 탐지기')).toBeDisabled();
  fireEvent.click(prepare('안정기'));
  expect(onAction).toHaveBeenCalledWith(expect.objectContaining({ type: 'equipment', equipmentId: 9 }));
});
