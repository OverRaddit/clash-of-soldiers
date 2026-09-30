import React from 'react';
import { fireEvent, render, screen, within } from '@testing-library/react';
import FellowshipGame from './FellowshipGame';
import { GameRoom } from '../types/game.types';
import { FellowshipClientState } from '../types/fellowship.types';
import socketService from '../services/socket.service';

jest.mock('../services/socket.service', () => ({
  __esModule: true,
  default: { fellowshipAction: jest.fn() },
}));

const room: GameRoom = {
  id: 'journey', name: '원정대', hostId: 'me', maxPlayers: 4,
  players: [{ id: 'me', name: '나', isHost: true, isReady: true }],
  status: 'playing', gameType: 'fellowship', createdAt: '',
};

const state = (overrides: Partial<FellowshipClientState> = {}): FellowshipClientState => ({
  phase: 'character_selection', chapter: { number: 1, title: '뜻밖의 파티' }, round: 1,
  players: [
    { id: 'me#1', controllerId: 'me', name: '좌석 1', handCount: 2, wonTricks: 0 },
    { id: 'me#2', controllerId: 'me', name: '좌석 2', handCount: 2, wonTricks: 0 },
  ],
  hand: [],
  handsBySeat: {
    'me#1': [{ id: 'rings-1', suit: 'rings', rank: 1 }, { id: 'hills-2', suit: 'hills', rank: 2 }],
    'me#2': [{ id: 'forests-3', suit: 'forests', rank: 3 }, { id: 'shadows-4', suit: 'shadows', rank: 4 }],
  },
  availableCharacters: [{ id: 'frodo', name: '프로도', objective: '반지 획득' }],
  pendingAction: { type: 'select_character', seatId: 'me#2', prompt: '좌석 2: 캐릭터를 선택하세요.' },
  ...overrides,
});

const show = (view = state()) => render(<FellowshipGame room={room} playerId="me" state={view}
  message="" messageType="info" onLeaveRoom={jest.fn()} onReturnToRoom={jest.fn()} />);

beforeEach(() => jest.clearAllMocks());

test('selects a character for the currently controlled solo seat', () => {
  show();
  fireEvent.click(screen.getByRole('button', { name: /프로도/ }));
  expect(socketService.fellowshipAction).toHaveBeenCalledWith('journey', 'me', { type: 'select_character', characterId: 'frodo' });
});

test('submits both card and target for an exchange setup action', () => {
  show(state({ phase: 'setup', pendingAction: { type: 'exchange_start', seatId: 'me#1', prompt: '카드를 교환하세요.', options: [{ id: 'me#2', label: '좌석 2' }] } }));
  fireEvent.change(screen.getByRole('combobox', { name: '보낼 카드' }), { target: { value: 'hills-2' } });
  fireEvent.click(screen.getByRole('button', { name: '좌석 2' }));
  expect(socketService.fellowshipAction).toHaveBeenCalledWith('journey', 'me', { type: 'setup_choice', choiceId: 'me#2', cardId: 'hills-2' });
});

test('solo exchange shows character names and permits a non-Frodo returner', () => {
  show(state({
    phase: 'setup',
    players: [
      { id: 'me#1', controllerId: 'me', name: '좌석 1', characterId: 'frodo', characterName: '프로도', handCount: 1, wonTricks: 0 },
      { id: 'me#2', controllerId: 'me', name: '좌석 2', characterId: 'sam', characterName: '샘', handCount: 1, wonTricks: 0 },
      { id: 'me#3', controllerId: 'me', name: '좌석 3', characterId: 'merry', characterName: '메리', handCount: 1, wonTricks: 0 },
    ],
    handsBySeat: {
      'me#1': [{ id: 'rings-1', suit: 'rings', rank: 1 }],
      'me#2': [{ id: 'hills-2', suit: 'hills', rank: 2 }],
      'me#3': [{ id: 'forests-3', suit: 'forests', rank: 3 }],
    },
    pendingAction: { type: 'exchange_start', seatId: 'me#2', prompt: '샘의 교환입니다.', options: [
      { id: 'me#1', label: '좌석 1' }, { id: 'me#3', label: '좌석 3' },
    ] },
  }));
  fireEvent.change(screen.getByRole('combobox', { name: '보낼 카드' }), { target: { value: 'hills-2' } });
  fireEvent.click(screen.getByRole('button', { name: '메리 · 좌석 3' }));
  expect(socketService.fellowshipAction).toHaveBeenCalledWith('journey', 'me', {
    type: 'setup_choice', choiceId: 'me#3', cardId: 'hills-2',
  });
});

test('offers the ring trump decision only for a legal one ring play', () => {
  show(state({ phase: 'play', pendingAction: null, currentTurn: 'me#1', currentLeader: 'me#1', legalCardsBySeat: { 'me#1': ['rings-1'] } }));
  fireEvent.click(screen.getByTitle('반지 1'));
  expect(screen.getByRole('dialog')).toBeInTheDocument();
  fireEvent.click(screen.getByRole('button', { name: '트럼프로 내기' }));
  expect(socketService.fellowshipAction).toHaveBeenCalledWith('journey', 'me', { type: 'play_card', cardId: 'rings-1', trump: true });
});

test('Radagast can choose trump for a preplayed One Ring', () => {
  show(state({ phase: 'setup', pendingAction: { type: 'preplay_first_card', seatId: 'me#1', prompt: '첫 트릭 카드를 고르세요.' } }));
  fireEvent.change(screen.getByRole('combobox', { name: '첫 트릭에 낼 카드' }), { target: { value: 'rings-1' } });
  fireEvent.click(screen.getByRole('button', { name: '반지 1을 트럼프로 내기' }));
  expect(socketService.fellowshipAction).toHaveBeenCalledWith('journey', 'me', {
    type: 'setup_choice', choiceId: '', cardId: 'rings-1', trump: true,
  });
});

test('hides a covered pyramid card identity in the rendered hand', () => {
  show(state({
    phase: 'play', pendingAction: null, currentTurn: '__pyramid__',
    players: [{ id: '__pyramid__', controllerId: 'me', name: '피라미드', isDummy: true, handCount: 2, wonTricks: 0 }],
    handsBySeat: { __pyramid__: [{ id: 'hidden-0-0', faceDown: true, row: 0, col: 0 }, { id: 'mountains-8', suit: 'mountains', rank: 8 }] },
    legalCardsBySeat: { __pyramid__: ['mountains-8'] },
  }));
  expect(screen.getByLabelText('뒷면 카드')).toBeInTheDocument();
  expect(screen.getByTitle('산 8')).toBeEnabled();
  expect(screen.getByTitle('뒷면 카드')).toBeDisabled();
});

test('clearly marks the active character and each objective status at the table', () => {
  show(state({
    phase: 'play', pendingAction: null, currentTurn: 'me#2', currentLeader: 'me#1',
    players: [
      { id: 'me#1', controllerId: 'me', name: '좌석 1', characterId: 'frodo', characterName: '프로도', handCount: 2, wonTricks: 1, objectiveStatus: 'complete', goal: '반지 카드를 획득합니다.' },
      { id: 'me#2', controllerId: 'me', name: '좌석 2', characterId: 'merry', characterName: '메리', handCount: 2, wonTricks: 0, objectiveStatus: 'pending', goal: '트릭을 승리합니다.' },
    ],
  }));
  expect(screen.getByRole('status')).toHaveTextContent('메리');
  const players = screen.getByLabelText('플레이어 상태');
  expect(within(players).getByText('메리').closest('article')).toHaveAttribute('aria-current', 'step');
  expect(within(players).getByText('메리').closest('article')).toHaveTextContent('목표 진행 중');
  expect(within(players).getByText('프로도').closest('article')).toHaveTextContent('목표 달성');
});

test('shows the pending setup actor instead of the next trick player', () => {
  show(state({
    phase: 'setup', currentTurn: 'me#1',
    pendingAction: { type: 'choose_threat', seatId: 'me#2', prompt: '위협값을 고르세요.', options: [{ id: '2', label: '2' }] },
  }));
  expect(screen.getByRole('status')).toHaveTextContent('좌석 2');
  expect(document.querySelector('article[aria-current="step"]')).toHaveTextContent('좌석 2');
});
