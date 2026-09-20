import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./services/api.service', () => ({ __esModule: true, default: {} }));

test('requires a player name before entering the game lobby', () => {
  sessionStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: '보드게임 플랫폼' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '게임 시작' })).toBeDisabled();
});
