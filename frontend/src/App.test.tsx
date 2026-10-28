import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

jest.mock('./services/api.service', () => ({ __esModule: true, default: {} }));

test('requires a player name before entering the game lobby', () => {
  sessionStorage.clear();
  render(<App />);
  expect(screen.getByRole('heading', { name: '한 홀드씩, 함께.' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: '등반 시작' })).toBeDisabled();
});
