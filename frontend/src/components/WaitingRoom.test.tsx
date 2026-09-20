import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import WaitingRoom from './WaitingRoom';
import { GameRoom } from '../types/game.types';
import { BombMissionCatalogEntry } from '../types/bomb-busters.types';

const room: GameRoom = {
  id: 'room', name: '훈련 대기실', hostId: 'me', maxPlayers: 5,
  players: [{ id: 'me', name: '나', isHost: true, isReady: true }, { id: 'friend', name: '동료', isHost: false, isReady: true }],
  status: 'waiting', gameType: 'bomb-busters', createdAt: '',
};
const training: BombMissionCatalogEntry = { id: 4, name: '첫 현장 훈련', description: '파랑·노랑·빨강 훈련', blueMax: 12, redCount: 1, yellowCount: 4, redCandidateCount: 1, yellowCandidateCount: 4, equipment: true };
const props = { room, playerId: 'me', message: '', messageType: 'info' as const, onLeaveRoom: jest.fn(), onToggleReady: jest.fn(), onStartGame: jest.fn(), onMissionChange: jest.fn() };
beforeEach(() => jest.clearAllMocks());

test('waits for the server mission catalog before allowing a start', () => {
  render(<WaitingRoom {...props} />);
  expect(screen.getByRole('combobox', { name: '봄버스터즈 임무 선택' })).toBeDisabled();
  expect(screen.getByRole('button', { name: '게임 시작' })).toBeDisabled();
});

test('shows server-resolved two-player setup and sends only the selected mission ID', () => {
  render(<WaitingRoom {...props} missionId={4} missions={[training, { ...training, id: 8, name: '최종 시험' }]} />);
  expect(screen.getByLabelText('선택한 미션 안내')).toHaveTextContent('노랑 4개 / 후보 4개');
  expect(screen.getByRole('button', { name: '게임 시작' })).toBeEnabled();
  fireEvent.change(screen.getByRole('combobox', { name: '봄버스터즈 임무 선택' }), { target: { value: '8' } });
  expect(props.onMissionChange).toHaveBeenCalledWith(8);
});

test('guests see the same selected mission without a selection control', () => {
  render(<WaitingRoom {...props} playerId="friend" missionId={4} missions={[training]} />);
  expect(screen.queryByRole('combobox', { name: '봄버스터즈 임무 선택' })).not.toBeInTheDocument();
  expect(screen.getByLabelText('선택한 미션 안내')).toHaveTextContent('첫 현장 훈련');
});

test('respects mission-specific minimum player count', () => {
  render(<WaitingRoom {...props} missionId={34} missions={[{ ...training, id: 34, minPlayers: 3 }]} />);
  expect(screen.getByRole('button', { name: '게임 시작' })).toBeDisabled();
  expect(screen.getByText('게임을 시작하려면 최소 3명의 플레이어가 필요합니다.')).toBeInTheDocument();
});
