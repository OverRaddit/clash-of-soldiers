import React from 'react';
import { act, fireEvent, render, screen } from '@testing-library/react';
import BombBustersGame from './BombBustersGame';
import { BombAudioView, BombBustersClientState } from '../types/bomb-busters.types';
import { GameRoom } from '../types/game.types';
import socketService from '../services/socket.service';

jest.mock('../services/socket.service', () => ({
  __esModule: true,
  default: {
    getSocket: () => ({ connected: true, on: jest.fn(), off: jest.fn() }),
    bombBustersAction: jest.fn(),
  },
}));

const room: GameRoom = {
  id: 'room', name: '협력 작전', hostId: 'me', maxPlayers: 2,
  players: [{ id: 'me', name: '나', isHost: true, isReady: true }, { id: 'friend', name: '동료', isHost: false, isReady: true }],
  status: 'playing', gameType: 'bomb-busters', createdAt: '',
};

const makeState = (overrides: Partial<BombBustersClientState> = {}): BombBustersClientState => ({
  phase: 'playing', mission: { id: 1, name: '첫 훈련', description: '파란 전선 1–6', blueMax: 6, redCount: 0, yellowCount: 0, redCandidateCount: 0, yellowCandidateCount: 0, equipment: false },
  players: [
    { id: 'me', name: '나', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'mine', wires: [
      { id: 'own-a', value: 2, sortValue: 2, cut: false, hint: null },
      { id: 'own-b', value: 2, sortValue: 2, cut: false, hint: null },
    ] }] },
    { id: 'friend', name: '동료', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'theirs', wires: [
      { id: 'other-a', value: null, sortValue: null, cut: false, hint: 3 },
      { id: 'other-b', value: null, sortValue: null, cut: false, hint: null },
    ] }] },
  ],
  captainId: 'me', currentPlayerId: 'me', mistakes: 0, maxMistakes: 2, turnNumber: 1,
  outcome: null, endReason: null, redMarkers: [], yellowMarkers: [], equipment: [],
  stabilizerActive: false, superDetectorActive: false, tripleDetectorActive: false,
  pendingDetector: null, log: [], cutCounts: { '2': 2 }, ...overrides,
});

const show = (state = makeState(), playerId = 'me') => render(<BombBustersGame room={room} playerId={playerId} state={state}
  message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);

beforeEach(() => jest.clearAllMocks());

test('keeps teammate wires hidden while exposing their public clues', () => {
  show();
  expect(screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 3' })).toHaveTextContent('?');
  expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' })).toHaveTextContent('?');
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' })).toHaveTextContent('2');
});

test('requires both own and teammate selections and submits wire IDs', () => {
  show();
  const submit = screen.getByRole('button', { name: '협력 해체 실행' });
  expect(screen.getByLabelText('내 전선 받침대')).toContainElement(submit);
  expect(screen.getByRole('region', { name: '내 행동' })).not.toContainElement(submit);
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', {
    type: 'dual', ownWireId: 'own-a', targetPlayerId: 'friend', targetWireIds: ['other-b'], useDetector: false,
  });
});

test('double detector requires two wires on the same teammate rack', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '더블 탐지기' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 3' }));
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ useDetector: true, targetWireIds: ['other-b', 'other-a'] }));
});

test('dock detector toggles clear selected targets and restore a normal one-wire cut', () => {
  show();
  const detector = screen.getByRole('button', { name: '더블 탐지기' });
  const submit = screen.getByRole('button', { name: '협력 해체 실행' });
  const firstTarget = screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 3' });
  const secondTarget = screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' });
  expect(screen.getByLabelText('내 전선 받침대')).toContainElement(detector);
  expect(screen.getByRole('region', { name: '내 행동' })).not.toContainElement(detector);
  expect(detector).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(firstTarget);
  expect(submit).toBeEnabled();
  fireEvent.click(detector);
  expect(detector).toHaveAttribute('aria-pressed', 'true');
  expect(firstTarget).toHaveAttribute('aria-pressed', 'false');
  expect(submit).toBeDisabled();
  fireEvent.click(firstTarget);
  expect(submit).toBeDisabled();
  fireEvent.click(secondTarget);
  expect(submit).toBeEnabled();
  fireEvent.click(detector);
  expect(detector).toHaveAttribute('aria-pressed', 'false');
  expect(firstTarget).toHaveAttribute('aria-pressed', 'false');
  expect(secondTarget).toHaveAttribute('aria-pressed', 'false');
  expect(submit).toBeDisabled();
  fireEvent.click(secondTarget);
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', {
    type: 'dual', ownWireId: 'own-a', targetPlayerId: 'friend', targetWireIds: ['other-b'], useDetector: false,
  });
});

test('spent detector stays disabled until recharged and activates cooperation from solo mode', () => {
  const state = makeState();
  state.players[0].detectorUsed = true;
  const { rerender } = show(state);
  const detector = screen.getByRole('button', { name: '더블 탐지기' });
  expect(detector).toBeDisabled();
  fireEvent.click(detector);
  expect(detector).toHaveAttribute('aria-pressed', 'false');
  const recharged = { ...state, players: state.players.map((player) => player.id === 'me' ? { ...player, detectorUsed: false } : player) };
  rerender(<BombBustersGame room={room} playerId="me" state={recharged} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(detector).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '단독 해체' }));
  fireEvent.click(detector);
  expect(detector).toHaveAttribute('aria-pressed', 'true');
  expect(screen.getByRole('button', { name: '협력 해체' })).toHaveAttribute('aria-pressed', 'true');
});

test('selecting a teammate wire after solo instructions enables cooperation in the dock', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: '단독 해체' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  expect(screen.getByRole('button', { name: '협력 해체' })).toHaveAttribute('aria-pressed', 'true');
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ type: 'dual', ownWireId: 'own-a', targetWireIds: ['other-b'] }));
});

test('dock solo cannot bypass prepared cooperative equipment', () => {
  show(makeState({ stabilizerActive: true }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  const solo = screen.getByRole('button', { name: '단독 해체 실행' });
  expect(solo).toBeDisabled();
  fireEvent.click(solo);
  expect(socketService.bombBustersAction).not.toHaveBeenCalled();
});

test('setup places a clue without issuing a cut', () => {
  show(makeState({ phase: 'setup' }));
  const submit = screen.getByRole('button', { name: '단서 배치 실행' });
  expect(screen.getByLabelText('내 전선 받침대')).toContainElement(submit);
  expect(screen.getByRole('region', { name: '내 행동' })).not.toContainElement(submit);
  expect(screen.queryByRole('button', { name: '협력 해체 실행' })).not.toBeInTheDocument();
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'hint', wireId: 'own-b' });
  expect(submit).toBeDisabled();
});

test('dock clue button remains visible but disabled during another player setup turn', () => {
  show(makeState({ phase: 'setup', currentPlayerId: 'friend' }));
  const submit = screen.getByRole('button', { name: '단서 배치 실행' });
  expect(screen.getByLabelText('내 전선 받침대')).toContainElement(submit);
  expect(submit).toBeDisabled();
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).not.toHaveBeenCalled();
});

test('detector choice is available only for the target player and eligible wire', () => {
  const state = makeState({ pendingDetector: { actorId: 'friend', targetPlayerId: 'me', targetWireIds: ['own-a', 'own-b'], guess: 2, eligibleWireIds: ['own-b'] } });
  show(state);
  expect(screen.queryByRole('group', { name: '전선 해체' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 전선 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'resolve_detector', wireId: 'own-b' });
});

test('post-it equipment can reveal an own blue clue outside my turn', () => {
  show(makeState({ currentPlayerId: 'friend', equipment: [{ id: 4, name: '포스트잇', description: '내 전선의 단서를 공개합니다.', unlocked: true, used: false }] }));
  fireEvent.change(screen.getByRole('combobox', { name: '포스트잇 단서를 놓을 내 전선' }), { target: { value: 'own-a' } });
  fireEvent.click(screen.getByRole('button', { name: '장비 사용' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ type: 'equipment', equipmentId: 4, wireIds: ['own-a'] }));
});

test('shows the finished mission and disables wire actions', () => {
  show(makeState({ phase: 'finished', outcome: 'won', endReason: '모든 전선을 해체했습니다.' }));
  expect(screen.queryByRole('group', { name: '전선 해체' })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { name: '폭탄 해체 성공!' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '대기실로 돌아가기' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' })).toBeDisabled();
});

test('exchange participants privately select their own uncut wire', () => {
  show(makeState({ currentPlayerId: 'friend', pendingExchange: { actorId: 'friend', targetPlayerId: 'me', selectedPlayerIds: [] } }));
  expect(screen.queryByRole('group', { name: '전선 해체' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '교환할 내 전선 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'exchange_wire', wireId: 'own-b' });
});

test('submitted exchange cannot be changed while waiting for the other player', () => {
  show(makeState({ pendingExchange: { actorId: 'me', targetPlayerId: 'friend', selectedPlayerIds: ['me'], ownSelectedWireId: 'own-a' } }));
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' })).toBeDisabled();
  expect(screen.queryByRole('button', { name: '교환할 내 전선 확정' })).not.toBeInTheDocument();
  expect(screen.getByText('내 선택이 제출되었습니다. 동료의 선택을 기다립니다.')).toBeInTheDocument();
});

test('XY ray declares two owned values and one teammate wire', () => {
  const state = makeState({ xyRayActive: true });
  state.players[0].racks[0].wires[1].value = 'yellow';
  show(state);
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 노랑' }));
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', {
    type: 'dual', ownWireId: 'own-a', alternativeWireId: 'own-b', targetPlayerId: 'friend', targetWireIds: ['other-b'], useDetector: false,
  });
});

test('relation labels finish selecting after the server applies an adjacent pair including a cut wire', () => {
  const state = makeState({ equipment: [
    { id: 12, name: '= 표식', description: '인접 전선의 값이 같습니다.', unlocked: true, used: false },
    { id: 6, name: '되감기', description: '기폭기를 한 칸 되돌립니다.', unlocked: true, used: false },
  ] });
  state.players[0].racks[0].wires[0].cut = true;
  const { rerender } = show(state);
  fireEvent.click(screen.getByRole('button', { name: '표식 위치 고르기' }));
  expect(screen.queryByRole('group', { name: '전선 해체' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 해체됨 2' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 위치에 = 표식 놓기' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'equipment', equipmentId: 12, wireIds: ['own-a', 'own-b'] });
  const committed: BombBustersClientState = {
    ...state,
    equipment: state.equipment.map((equipment) => equipment.id === 12 ? { ...equipment, used: true } : equipment),
    relationMarkers: [{ id: 'equal', playerId: 'me', rackId: 'mine', wireIds: ['own-a', 'own-b'], relation: 'equal' }],
  };
  rerender(<BombBustersGame room={room} playerId="me" state={committed} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.queryByRole('button', { name: '선택한 위치에 = 표식 놓기' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: '선택 취소' })).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: '사용 완료' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '장비 사용' })).toBeEnabled();
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 해체됨 2' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' })).toHaveAttribute('aria-pressed', 'false');
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeEnabled();
});

test('unconsumed relation selections can be retried or cancelled without consuming the equipment', () => {
  const state = makeState({ equipment: [{ id: 12, name: '= 표식', description: '', unlocked: true, used: false }] });
  const { rerender } = show(state);
  fireEvent.click(screen.getByRole('button', { name: '표식 위치 고르기' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '선택한 위치에 = 표식 놓기' }));
  rerender(<BombBustersGame room={room} playerId="me" state={{ ...state }} message="사용 요청을 다시 확인해주세요." messageType="error" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.getByRole('button', { name: '선택한 위치에 = 표식 놓기' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '선택한 위치에 = 표식 놓기' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledTimes(2);
  fireEvent.click(screen.getByRole('button', { name: '선택 취소' }));
  rerender(<BombBustersGame room={room} playerId="me" state={{ ...state }} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.getByRole('button', { name: '표식 위치 고르기' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '표식 위치 고르기' }));
  expect(screen.getByRole('button', { name: '선택한 위치에 = 표식 놓기' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' })).toHaveAttribute('aria-pressed', 'false');
  expect(screen.queryByRole('button', { name: '사용 완료' })).not.toBeInTheDocument();
});

test('teammate equipment and public clue updates preserve ordinary wire selections', () => {
  const state = makeState({ equipment: [{ id: 12, name: '= 표식', description: '', unlocked: true, used: false }] });
  const { rerender } = show(state);
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  const committed: BombBustersClientState = {
    ...state,
    equipment: state.equipment.map((equipment) => ({ ...equipment, used: true })),
    relationMarkers: [{ id: 'equal', playerId: 'friend', rackId: 'theirs', wireIds: ['other-a', 'other-b'], relation: 'equal' }],
    players: state.players.map((player) => player.id === 'friend' ? { ...player, racks: player.racks.map((rack) => ({
      ...rack, wires: rack.wires.map((wire) => wire.id === 'other-b' ? { ...wire, hint: 3 } : wire),
    })) } : player),
  };
  rerender(<BombBustersGame room={room} playerId="me" state={committed} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', {
    type: 'dual', ownWireId: 'own-a', targetPlayerId: 'friend', targetWireIds: ['other-b'], useDetector: false,
  });
});

test('radar reports are public historical presence without locations or counts', () => {
  show(makeState({ radarResults: [{ value: 3, racks: [{ playerId: 'me', rackId: 'mine', present: false }, { playerId: 'friend', rackId: 'theirs', present: true }] }] }));
  expect(screen.getByRole('heading', { name: '전체 레이더 기록' })).toBeInTheDocument();
  expect(screen.getByText('숫자 3')).toBeInTheDocument();
  expect(screen.getByText('있음')).toBeInTheDocument();
  expect(screen.getByText('없음')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' })).toHaveTextContent('?');
});

test('rewinder is usable at the starting dial position in a two-player game', () => {
  show(makeState({ equipment: [{ id: 6, name: '되감기', description: '기폭기를 한 칸 되돌립니다.', unlocked: true, used: false }] }));
  fireEvent.click(screen.getByRole('button', { name: '장비 사용' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ equipmentId: 6 }));
});

test('rewinder is disabled at the safest dial position', () => {
  show(makeState({ mistakes: -3, equipment: [{ id: 6, name: '되감기', description: '기폭기를 한 칸 되돌립니다.', unlocked: true, used: false }] }));
  expect(screen.getByRole('button', { name: '장비 사용' })).toBeDisabled();
  expect(screen.getByLabelText('기폭까지 남은 실수 5회')).toBeInTheDocument();
});

test('coffee may choose the current player and submits that explicit choice', () => {
  show(makeState({ equipment: [{ id: 11, name: '커피잔', description: '다음 대원을 정합니다.', unlocked: true, used: false }] }));
  fireEvent.change(screen.getByRole('combobox', { name: '커피잔으로 다음 차례를 맡길 대원' }), { target: { value: 'me' } });
  fireEvent.click(screen.getByRole('button', { name: '선택한 대원에게 차례 넘기기' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ equipmentId: 11, targetPlayerId: 'me' }));
});

test('prepared equipment can be cancelled without consuming a card', () => {
  show(makeState({ xyRayActive: true }));
  expect(screen.getByText('아직 사용하지 않은 장비는 소모되지 않습니다. 차례는 계속 진행합니다.')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '준비한 장비 효과 모두 취소' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'cancel_equipment' });
});

const campaignPanel = (overrides: Partial<NonNullable<BombBustersClientState['campaign']>> = {}): NonNullable<BombBustersClientState['campaign']> => ({
  title: '특수 작전', description: '현재 작전 규칙을 적용합니다.', counters: [], cards: [], controls: [], ...overrides,
});

test('variant clues reveal parity without showing the hidden exact value', () => {
  const state = makeState();
  state.players[1].racks[0].wires[0].hint = null;
  state.players[1].racks[0].wires[0].clue = { kind: 'parity', value: 'odd' };
  show(state);
  expect(screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 홀' })).toHaveTextContent('?');
  expect(screen.getByText('홀')).toBeInTheDocument();
});

test('owner must declare a guess when cutting a reversed wire', () => {
  const state = makeState();
  state.players[0].racks[0].wires[0] = { ...state.players[0].racks[0].wires[0], reversed: true, value: null, sortValue: null };
  show(state);
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 비공개, 역방향 전선' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeDisabled();
  fireEvent.change(screen.getByRole('combobox', { name: '내 역방향 전선의 예상 값' }), { target: { value: '2' } });
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ type: 'dual', ownWireId: 'own-a', guess: 2 }));
});

test('multi-wire mission selection blocks ordinary cuts and requires the specified count', () => {
  show(makeState({ campaign: campaignPanel({ pendingActorId: 'me', controls: [{ id: 'special_cut', label: '전선 세 개 동시 절단', wireSelection: { owner: 'all', min: 3, max: 3 } }] }) }));
  expect(screen.queryByRole('button', { name: '협력 해체 실행' })).not.toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '전선 세 개 동시 절단' }));
  const submit = screen.getByRole('button', { name: '전선 세 개 동시 절단 확정' });
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 3' }));
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'special_cut', wireIds: ['own-a', 'other-a', 'other-b'] });
});

test('mission card pairs and chosen values use the server-declared control contract', () => {
  show(makeState({ campaign: campaignPanel({ controls: [{ id: 'arithmetic', label: '숫자 카드 계산', values: [2, 5], cards: [{ id: 'a', label: '카드 3' }, { id: 'b', label: '카드 5' }, { id: 'c', label: '카드 7' }], cardSelection: { min: 2, max: 2 } }] }) }));
  fireEvent.click(screen.getByRole('button', { name: '숫자 카드 계산' }));
  fireEvent.click(screen.getByRole('button', { name: '2' }));
  fireEvent.click(screen.getByRole('button', { name: '카드 3' }));
  expect(screen.getByRole('button', { name: '숫자 카드 계산 확정' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '카드 5' }));
  expect(screen.getByRole('button', { name: '카드 7' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '숫자 카드 계산 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'arithmetic', value: 2, cardId: 'a', cardIds: ['a', 'b'] });
});

test('server-provided oxygen signals can be sent without voice or hidden-wire information', () => {
  show(makeState({ currentPlayerId: 'friend', campaign: campaignPanel({ counters: [{ label: '내 산소', value: 4 }], controls: [{ id: 'oxygen_signal', label: '산소 필요 신호' }] }) }));
  fireEvent.click(screen.getByRole('button', { name: '산소 필요 신호' }));
  fireEvent.click(screen.getByRole('button', { name: '산소 필요 신호 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'oxygen_signal' });
});

test('personal radar uses its own charge without consuming a public card', () => {
  const state = makeState();
  state.players[0].personalEquipmentId = 8;
  show(state);
  expect(screen.queryByRole('button', { name: '더블 탐지기' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '개인 전체 레이더로 찾을 숫자' }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: '장비 사용' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ type: 'equipment', equipmentId: 8, personal: true, value: 3 }));
});

test('grappling hook sends a public position and receiving rack without revealing the target value', () => {
  show(makeState({ equipment: [{ id: 18, name: '갈고리', description: '동료 전선 하나를 가져옵니다.', unlocked: true, used: false, unlock: { value: 11, count: 4 } }] }));
  fireEvent.change(screen.getByRole('combobox', { name: '갈고리로 전선을 가져올 동료' }), { target: { value: 'friend' } });
  fireEvent.change(screen.getByRole('combobox', { name: '갈고리로 가져올 전선 위치' }), { target: { value: 'other-b' } });
  fireEvent.click(screen.getByRole('button', { name: '장비 사용' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ equipmentId: 18, targetPlayerId: 'friend', wireIds: ['other-b'], rackId: 'mine' }));
  expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' })).toHaveTextContent('?');
});

test('memory mission omits the completion-token board', () => {
  const state = makeState();
  state.mission.id = 50;
  show(state);
  expect(screen.queryByLabelText('공개 전선 정보')).not.toBeInTheDocument();
  expect(screen.queryByText('검증 토큰')).not.toBeInTheDocument();
});

test('memory clues disappear from their wire when the server expiry passes', () => {
  jest.useFakeTimers();
  let now = 100000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => now);
  try {
    const state = makeState({ campaign: campaignPanel({ flashClues: [{ wireId: 'other-b', clue: { kind: 'value', value: 4 }, expiresAt: now + 3000 }] }) });
    state.mission.id = 50;
    show(state);
    expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개, 공개 단서 4' })).toBeInTheDocument();
    act(() => { now += 3250; jest.advanceTimersByTime(3250); });
    expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개, 공개 단서 4' })).not.toBeInTheDocument();
  } finally {
    clock.mockRestore();
    jest.useRealTimers();
  }
});

test('mission countdown follows server time even when the local clock is far ahead', () => {
  jest.useFakeTimers();
  let localTime = 9000000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => localTime);
  try {
    show(makeState({ serverNow: 100000, campaign: campaignPanel({ deadlineAt: 160000 }) }));
    expect(screen.getByLabelText('남은 시간 1분 0초')).toBeInTheDocument();
    act(() => { localTime += 5000; jest.advanceTimersByTime(5000); });
    expect(screen.getByLabelText('남은 시간 0분 55초')).toBeInTheDocument();
  } finally {
    clock.mockRestore();
    jest.useRealTimers();
  }
});

test('clock snapshots and a new clue do not erase an in-progress dual selection', () => {
  const state = makeState();
  const view = show(state);
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  const updated = JSON.parse(JSON.stringify(state)) as BombBustersClientState;
  updated.serverNow = Date.now();
  updated.players[1].racks[0].wires[0].hint = 4;
  view.rerender(<BombBustersGame room={room} playerId="me" state={updated} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ ownWireId: 'own-a', targetWireIds: ['other-b'] }));
});

test('equivalent mission controls preserve in-progress card choices across snapshots', () => {
  const state = makeState({ campaign: campaignPanel({ controls: [{ id: 'choice', label: '미션 값 선택', values: [2, 3], cards: [{ id: 'A', label: '제약 A' }, { id: 'B', label: '제약 B' }] }] }) });
  const view = show(state);
  fireEvent.click(screen.getByRole('button', { name: '미션 값 선택' }));
  fireEvent.click(screen.getByRole('button', { name: '2' }));
  fireEvent.click(screen.getByRole('button', { name: '제약 A' }));
  const updated = JSON.parse(JSON.stringify(state)) as BombBustersClientState;
  updated.serverNow = Date.now();
  view.rerender(<BombBustersGame room={room} playerId="me" state={updated} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.getByRole('button', { name: '미션 값 선택 확정' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '미션 값 선택 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'choice', value: 2, cardId: 'A', cardIds: ['A'] });
});

test('blue wires treated as red can be safely revealed but not selected for ordinary cuts', () => {
  const state = makeState({ campaign: campaignPanel({ redValues: [2] }) });
  state.mission.id = 11;
  show(state);
  expect(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2, 빨강 취급' })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '빨간 전선 공개' }));
  expect(screen.getByRole('button', { name: '남은 빨간 전선 안전 공개' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '남은 빨간 전선 안전 공개' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'reveal_red' });
});

test('false-hint mission requires a deliberately different Post-It value', () => {
  const state = makeState({ equipment: [{ id: 4, name: '포스트잇', description: '단서를 공개합니다.', unlocked: true, used: false }] });
  state.mission.id = 52;
  show(state);
  fireEvent.change(screen.getByRole('combobox', { name: '포스트잇 단서를 놓을 내 전선' }), { target: { value: 'own-a' } });
  expect(screen.getByRole('button', { name: '장비 사용' })).toBeDisabled();
  expect(screen.queryByRole('option', { name: '≠ 2' })).not.toBeInTheDocument();
  fireEvent.change(screen.getByRole('combobox', { name: '포스트잇으로 공개할 거짓 값' }), { target: { value: '3' } });
  fireEvent.click(screen.getByRole('button', { name: '장비 사용' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ equipmentId: 4, wireIds: ['own-a'], value: 3 }));
});

test('memory mission still shows the initial special-wire preview before markers disappear', () => {
  const state = makeState({ redMarkers: [1.5, 7.5], yellowMarkers: [2.1, 8.1] });
  state.mission.id = 50;
  show(state);
  expect(screen.getByLabelText('기억할 전선 위치')).toHaveTextContent('1.5 · 7.5');
  expect(screen.getByLabelText('기억할 전선 위치')).toHaveTextContent('2.1 · 8.1');
  expect(screen.queryByText('검증 토큰')).not.toBeInTheDocument();
});

const audioView = (overrides: Partial<BombAudioView> = {}): BombAudioView => ({
  title: '서커스 작전', instructions: ['지시를 확인하세요.'], sourceUrl: 'https://pegasusna.com/welcome-bomb-busters',
  stepIndex: 1, stepCount: 4, status: 'running', controls: [], targetNumbers: [], ...overrides,
});

test('circus cut-wire controls do not allow intact wires or removed empty slots', () => {
  const state = makeState({ campaign: campaignPanel({ audio: audioView({ removedCutWireIds: ['other-a'] }), controls: [{ id: 'audio_juggler', label: '저글링 선택', wireSelection: { owner: 'self', min: 1, max: 1, allowCut: true, onlyCut: true } }] }) });
  state.players[0].racks[0].wires[0].cut = true;
  state.players[1].racks[0].wires[0].cut = true;
  show(state);
  fireEvent.click(screen.getByRole('button', { name: '저글링 선택' }));
  expect(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' })).toBeDisabled();
  expect(screen.getByLabelText('동료 받침대 1, 1번 빈자리')).not.toHaveTextContent('3');
  const cutWire = screen.getByRole('button', { name: /나 받침대 1, 1번 전선/ });
  expect(cutWire).toBeEnabled();
  fireEvent.click(cutWire);
  fireEvent.click(screen.getByRole('button', { name: '저글링 선택 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'audio_juggler', wireIds: ['own-a'] });
});

test('hidden cut totals do not display invented zero counts or prevent a remembered solo', () => {
  show(makeState({ cutCounts: {}, redMarkers: [4.5], campaign: campaignPanel({ audio: audioView({ hideCutCounts: true, validationTokensRemoved: true }) }) }));
  expect(screen.queryByText('검증 토큰')).not.toBeInTheDocument();
  expect(screen.queryByTitle('2번 전선 0/4 해체')).not.toBeInTheDocument();
  expect(screen.getByText('빨간 전선 후보')).toBeInTheDocument();
  const submit = screen.getByRole('button', { name: '단독 해체 실행' });
  expect(screen.getByLabelText('내 전선 받침대')).toContainElement(submit);
  expect(submit).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'solo', value: 2 });
});

test('any remaining reversed wire routes solo declarations to explicit mission selection', () => {
  const state = makeState();
  state.players[0].racks[0].wires.push({ id: 'reversed', value: null, sortValue: null, cut: false, hint: null, reversed: true });
  show(state);
  fireEvent.click(screen.getByRole('button', { name: '단독 해체' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  expect(screen.getByRole('button', { name: '단독 해체 실행' })).toBeDisabled();
  expect(screen.getByText(/전선 위치와 예상 값을 직접 선택하세요/)).toBeInTheDocument();
});

test('audio oxygen transfer supports a zero-token pass with translated direction choices', () => {
  show(makeState({ campaign: campaignPanel({ controls: [{ id: 'audio_transfer', label: '산소 주고받기', values: [0, 1], playerIds: ['friend'], directions: ['give', 'take'] }] }) }));
  fireEvent.click(screen.getByRole('button', { name: '산소 주고받기' }));
  fireEvent.click(screen.getByRole('button', { name: '0' }));
  fireEvent.click(screen.getByRole('button', { name: '산소 주기' }));
  fireEvent.click(screen.getByRole('button', { name: '산소 주고받기 확정' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'audio_transfer', value: 0, targetPlayerId: 'friend', direction: 'give' });
});

test('reversed solo accepts two or four selected wires and rejects a group of three', () => {
  const state = makeState({ campaign: campaignPanel({ controls: [{ id: 'reversed_solo', label: '역방향 단독 해체', values: [2], wireSelection: { owner: 'self', min: 2, max: 4, counts: [2, 4] } }] }) });
  state.players[0].racks[0].wires.push(
    { id: 'own-c', value: null, sortValue: null, cut: false, hint: null, reversed: true },
    { id: 'own-d', value: null, sortValue: null, cut: false, hint: null, reversed: true },
  );
  show(state);
  fireEvent.click(screen.getByRole('button', { name: '역방향 단독 해체' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 2' }));
  const confirm = screen.getByRole('button', { name: '역방향 단독 해체 확정' });
  expect(confirm).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 3번 전선: 비공개, 역방향 전선' }));
  expect(confirm).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 4번 전선: 비공개, 역방향 전선' }));
  expect(confirm).toBeEnabled();
  fireEvent.click(confirm);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', { type: 'mission', operation: 'reversed_solo', value: 2, wireIds: ['own-a', 'own-b', 'own-c', 'own-d'] });
});

test('triple detector excludes X wires when only two eligible candidates remain', () => {
  const state = makeState({ tripleDetectorActive: true });
  state.players[1].racks[0].wires.push({ id: 'x-wire', value: null, sortValue: null, cut: false, hint: null, excluded: true });
  show(state);
  expect(screen.getByRole('button', { name: /동료 받침대 1, 3번 전선/ })).toBeDisabled();
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 3' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  expect(screen.getByRole('button', { name: '협력 해체 실행' })).toBeEnabled();
  fireEvent.click(screen.getByRole('button', { name: '협력 해체 실행' }));
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', expect.objectContaining({ targetWireIds: ['other-a', 'other-b'] }));
});


test.each(['double', 'triple', 'super'] as const)('XY ray combines with the %s detector and submits both declared values', (detectorKind) => {
  const state = makeState({ xyRayActive: true, tripleDetectorActive: detectorKind === 'triple', superDetectorActive: detectorKind === 'super' });
  state.players[0].racks[0].wires[1].value = 5;
  show(state);
  if (detectorKind === 'double') fireEvent.click(screen.getByRole('button', { name: '더블 탐지기' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 5' }));
  fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }));
  const submit = screen.getByRole('button', { name: '협력 해체 실행' });
  if (detectorKind !== 'super') {
    expect(submit).toBeDisabled();
    fireEvent.click(screen.getByRole('button', { name: '동료 받침대 1, 1번 전선: 비공개, 공개 단서 3' }));
  }
  expect(submit).toBeEnabled();
  fireEvent.click(submit);
  expect(socketService.bombBustersAction).toHaveBeenCalledWith('room', 'me', {
    type: 'dual', ownWireId: 'own-a', alternativeWireId: 'own-b', targetPlayerId: 'friend',
    targetWireIds: detectorKind === 'super' ? ['other-b'] : ['other-b', 'other-a'], useDetector: detectorKind === 'double',
  });
});

test('XY plus a detector cannot declare a yellow value in either selection order', () => {
  const state = makeState({ xyRayActive: true });
  state.players[0].racks[0].wires[1].value = 'yellow';
  show(state);
  const detector = screen.getByRole('button', { name: '더블 탐지기' });
  const yellow = screen.getByRole('button', { name: '나 받침대 1, 2번 전선: 노랑' });
  fireEvent.click(detector);
  expect(yellow).toBeDisabled();
  fireEvent.click(detector);
  fireEvent.click(screen.getByRole('button', { name: '나 받침대 1, 1번 전선: 2' }));
  fireEvent.click(yellow);
  expect(detector).toBeDisabled();
});


test('preparing XY preserves an already selected personal double detector', () => {
  const state = makeState();
  state.players[0].racks[0].wires[1].value = 5;
  const { rerender } = show(state);
  fireEvent.click(screen.getByRole('button', { name: '더블 탐지기' }));
  rerender(<BombBustersGame room={room} playerId="me" state={{ ...state, xyRayActive: true }} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  expect(screen.getByRole('button', { name: '더블 탐지기' })).toHaveAttribute('aria-pressed', 'true');
});

test('last successful cuts remain highlighted after their animation ends', () => {
  jest.useFakeTimers();
  try {
    const before = makeState();
    const { rerender, container } = show(before);
    const after = makeState({ currentPlayerId: 'friend', turnNumber: 2,
      feedback: { id: 'cut-result', kind: 'success' }, lastTurn: { cutWireIds: ['own-a', 'other-b'], clueWireIds: [] } });
    after.players[0].racks[0].wires[0].cut = true;
    Object.assign(after.players[1].racks[0].wires[1], { cut: true, value: 2 });
    rerender(<BombBustersGame room={room} playerId="me" state={after} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
    expect(container.querySelectorAll('.bb-cut-flash')).toHaveLength(2);
    act(() => { jest.advanceTimersByTime(1300); });
    expect(container.querySelectorAll('.bb-cut-flash')).toHaveLength(0);
    expect(screen.getAllByRole('button', { name: /직전 턴 해체 성공/ })).toHaveLength(2);
    expect(container.querySelectorAll('.bb-wire-last-success')).toHaveLength(2);
    expect(screen.getByRole('button', { name: /나 받침대 1, 1번 전선/ })).toBeDisabled();
  } finally {
    jest.useRealTimers();
  }
});

test.each(['me', 'friend'])('a reloaded snapshot keeps the last public clue highlight for %s without replaying damage', (playerId) => {
  const state = makeState({ lastTurn: { cutWireIds: [], clueWireIds: ['other-a'] }, feedback: { id: 'old-failure', kind: 'failure' } });
  const { container } = show(state, playerId);
  const clueWire = screen.getByRole('button', { name: /동료 받침대 1, 1번 전선: 비공개, 공개 단서 3, 직전 턴 실패로 공개된 단서/ });
  expect(clueWire).toHaveClass('bb-wire-last-failure');
  expect(clueWire.querySelector('.bb-wire-value')).toHaveTextContent('?');
  expect(container.querySelector('.bb-damage-vignette')).toBeNull();
  expect(container.querySelectorAll('.bb-wire-last-failure')).toHaveLength(1);
});

test('last-turn highlights survive equipment updates and are replaced by the next resolved turn', () => {
  const state = makeState({ lastTurn: { cutWireIds: [], clueWireIds: ['other-a'] } });
  const { rerender, container } = show(state);
  const update = (next: BombBustersClientState) => rerender(<BombBustersGame room={room} playerId="me" state={next} message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);
  update({ ...state, serverNow: Date.now(), stabilizerActive: true });
  const clueWire = screen.getByRole('button', { name: /동료 받침대 1, 1번 전선/ });
  fireEvent.click(clueWire);
  expect(clueWire).toHaveClass('bb-wire-last-failure', 'bb-wire-selected');
  const next = makeState({ turnNumber: 2, lastTurn: { cutWireIds: ['own-a'], clueWireIds: [] } });
  next.players[0].racks[0].wires[0].cut = true;
  update(next);
  expect(container.querySelectorAll('.bb-wire-last-failure')).toHaveLength(0);
  expect(container.querySelectorAll('.bb-wire-last-success')).toHaveLength(1);
  update({ ...next, turnNumber: 3, lastTurn: { cutWireIds: [], clueWireIds: [] } });
  expect(container.querySelectorAll('.bb-wire-last-success, .bb-wire-last-failure')).toHaveLength(0);
});

test('expired flash clues lose their failure highlight without exposing a hidden value', () => {
  jest.useFakeTimers();
  try {
    const now = Date.now();
    const state = makeState({ serverNow: now, lastTurn: { cutWireIds: [], clueWireIds: ['other-b'] },
      campaign: campaignPanel({ flashClues: [{ wireId: 'other-b', clue: { kind: 'parity', value: 'odd' }, expiresAt: now + 500 }] }) });
    const { container } = show(state);
    expect(screen.getByRole('button', { name: /공개 단서 홀, 직전 턴 실패로 공개된 단서/ })).toHaveClass('bb-wire-last-failure');
    act(() => { jest.advanceTimersByTime(750); });
    expect(container.querySelectorAll('.bb-wire-last-failure')).toHaveLength(0);
    expect(screen.getByRole('button', { name: '동료 받침대 1, 2번 전선: 비공개' }).querySelector('.bb-wire-value')).toHaveTextContent('?');
  } finally {
    jest.useRealTimers();
  }
});
