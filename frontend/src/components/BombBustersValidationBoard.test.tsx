import React from 'react';
import { render, screen, within } from '@testing-library/react';
import BombBustersValidationBoard from './BombBustersValidationBoard';
import BombBustersGame from './BombBustersGame';
import { BombBustersClientState } from '../types/bomb-busters.types';
import { GameRoom } from '../types/game.types';

jest.mock('../services/socket.service', () => ({
  __esModule: true,
  default: {
    getSocket: () => ({ connected: true, on: jest.fn(), off: jest.fn() }),
    bombBustersAction: jest.fn(),
  },
}));

const boardProps = {
  blueMax: 12, cutCounts: {}, yellowMarkers: [4.1, 8.1], redMarkers: [4.5, 10.5], hideCutCounts: false,
};
const candidates = () => within(screen.getByRole('list', { name: '노랑·빨강 전선 후보' }));
const candidateLabels = () => candidates().getAllByRole('listitem').map((item) => item.getAttribute('aria-label'));

test('public candidates remain uncertain after nearby numbers and special colors have been cut', () => {
  const { rerender } = render(<BombBustersValidationBoard {...boardProps} />);
  const labels = candidateLabels();
  expect(labels).toHaveLength(4);
  rerender(<BombBustersValidationBoard {...boardProps} cutCounts={{ '4': 4, '5': 4, '8': 4, '9': 4, yellow: 2, red: 1 }} />);
  expect(candidateLabels()).toEqual(labels);
  for (const candidate of candidates().getAllByRole('listitem')) expect(candidate).toHaveTextContent(/^\?$/);
  expect(candidates().queryByRole('listitem', { name: /노랑 전선 후보 5\.1/ })).not.toBeInTheDocument();
});

test('yellow and red candidates can coexist in the same number interval', () => {
  render(<BombBustersValidationBoard {...boardProps} yellowMarkers={[4.1]} redMarkers={[4.5]} />);
  expect(candidates().getAllByRole('listitem')).toHaveLength(2);
  expect(candidates().getByRole('listitem', { name: '노랑 전선 후보 4.1 (4~5 사이)' })).toHaveTextContent('?');
  expect(candidates().getByRole('listitem', { name: '빨강 전선 후보 4.5 (4~5 사이)' })).toHaveTextContent('?');
});

test('hidden cut counts retain public candidates without leaking progress through text or accessible labels', () => {
  const { container } = render(<BombBustersValidationBoard {...boardProps} hideCutCounts cutCounts={{ '1': 1, '2': 2, '3': 3, '4': 4, yellow: 2, red: 1 }} />);
  expect(candidates().getAllByRole('listitem')).toHaveLength(4);
  expect(screen.getByRole('heading', { name: '전선 후보' })).toBeInTheDocument();
  expect(screen.queryByRole('heading', { name: '검증 토큰' })).not.toBeInTheDocument();
  expect(screen.queryByRole('list', { name: '숫자별 해체 현황' })).not.toBeInTheDocument();
  expect(screen.getByRole('list', { name: '전선 정렬 순서' })).toBeInTheDocument();
  expect(screen.getByRole('listitem', { name: '4번 위치' })).toBeInTheDocument();
  expect(container).not.toHaveTextContent(/\d\/4|✓|완료/);
  expect(container.querySelector('[aria-label*="/4"], [title*="해체"]')).toBeNull();
  for (const candidate of candidates().getAllByRole('listitem')) expect(candidate).toHaveTextContent(/^\?$/);
});

test('the game passes all public candidates through regardless of actual wires in my hand', () => {
  const room: GameRoom = {
    id: 'room', name: '후보 검증', hostId: 'me', maxPlayers: 2,
    players: [{ id: 'me', name: '나', isHost: true, isReady: true }, { id: 'other', name: '동료', isHost: false, isReady: true }],
    status: 'playing', gameType: 'bomb-busters', createdAt: '',
  };
  const state: BombBustersClientState = {
    phase: 'playing', mission: { id: 8, name: '작전', description: '', blueMax: 12, yellowCount: 2, redCount: 1, yellowCandidateCount: 3, redCandidateCount: 2, equipment: false },
    players: [
      { id: 'me', name: '나', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'mine', wires: [
        { id: 'own-yellow', value: 'yellow', sortValue: 4.1, cut: false, hint: null },
        { id: 'own-red', value: 'red', sortValue: 4.5, cut: false, hint: null },
      ] }] },
      { id: 'other', name: '동료', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'theirs', wires: [
        { id: 'other-a', value: null, sortValue: null, cut: false, hint: null },
        { id: 'other-b', value: null, sortValue: null, cut: false, hint: null },
      ] }] },
    ],
    captainId: 'me', currentPlayerId: 'me', mistakes: 0, maxMistakes: 2, turnNumber: 1,
    outcome: null, endReason: null, redMarkers: [4.5, 10.5], yellowMarkers: [4.1, 8.1, 11.1],
    equipment: [], stabilizerActive: false, superDetectorActive: false, tripleDetectorActive: false,
    pendingDetector: null, log: [], cutCounts: {},
  };
  const props = { room, playerId: 'me', message: '', messageType: 'info' as const, onLeaveRoom: jest.fn(), onReturnToRoom: jest.fn() };
  const { rerender } = render(<BombBustersGame {...props} state={state} />);
  const labels = candidateLabels();
  expect(labels).toHaveLength(5);
  expect(candidates().getByRole('listitem', { name: '빨강 전선 후보 10.5 (10~11 사이)' })).toHaveTextContent('?');
  const afterCut = JSON.parse(JSON.stringify(state)) as BombBustersClientState;
  afterCut.players[0].racks[0].wires[0].cut = true;
  afterCut.cutCounts = { yellow: 2 };
  rerender(<BombBustersGame {...props} state={afterCut} />);
  expect(candidateLabels()).toEqual(labels);
  for (const candidate of candidates().getAllByRole('listitem')) expect(candidate).toHaveTextContent(/^\?$/);
});
