import React from 'react';
import { act, render, screen } from '@testing-library/react';
import BombBustersAudio from './BombBustersAudio';
import { BombAudioView } from '../types/bomb-busters.types';

const briefing: BombAudioView = {
  title: '작전 지시', instructions: ['선택을 마친 뒤 작업을 시작하세요.'], sourceUrl: 'https://pegasusna.com/welcome-bomb-busters',
  stepIndex: 0, stepCount: 4, status: 'ready', controls: [], targetNumbers: [],
};

test('audio missions explain the Korean instruction flow and link the official source', () => {
  render(<BombBustersAudio audio={{ ...briefing, targetNumbers: [3, 7], speechRule: '허용된 신호만 사용하세요.' }} />);
  expect(screen.getByText('안내 1 / 4')).toBeInTheDocument();
  expect(screen.getByText('선택을 마친 뒤 작업을 시작하세요.')).toBeInTheDocument();
  expect(screen.getByText('현재 지정 숫자')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: '공식 원본 음원 참고 ↗' })).toHaveAttribute('href', briefing.sourceUrl);
  expect(screen.getByText('허용된 신호만 사용하세요.')).toBeInTheDocument();
});

test('paused instruction choices keep their remaining working time', () => {
  const { rerender } = render(<BombBustersAudio audio={{ ...briefing, status: 'paused', remainingSeconds: 40 }} serverNow={10000} />);
  expect(screen.getByText('선택하는 동안 시간 정지')).toBeInTheDocument();
  rerender(<BombBustersAudio audio={{ ...briefing, status: 'paused', remainingSeconds: 40 }} serverNow={15000} />);
  expect(screen.getByLabelText('작전 남은 시간 0분 40초')).toBeInTheDocument();
});

test('running audio time advances from the server timestamp', () => {
  jest.useFakeTimers();
  let localTime = 500000;
  const clock = jest.spyOn(Date, 'now').mockImplementation(() => localTime);
  try {
    render(<BombBustersAudio audio={{ ...briefing, status: 'running', deadlineAt: 65000 }} serverNow={10000} />);
    expect(screen.getByLabelText('작전 남은 시간 0분 55초')).toBeInTheDocument();
    act(() => { localTime += 2000; jest.advanceTimersByTime(2000); });
    expect(screen.getByLabelText('작전 남은 시간 0분 53초')).toBeInTheDocument();
  } finally {
    clock.mockRestore();
    jest.useRealTimers();
  }
});
