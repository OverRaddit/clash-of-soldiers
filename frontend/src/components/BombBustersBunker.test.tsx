import React from 'react';
import { render, screen } from '@testing-library/react';
import BombBustersBunker from './BombBustersBunker';
import { BombBunkerView } from '../types/bomb-busters.types';

const bunker: BombBunkerView = {
  floor: 'ground', position: [1, 2], stage: 'open_door',
  constraints: { north: 'A', east: 'B', south: 'C', west: 'D', action: 'E' },
  doorOpen: false, guardNeutralized: false, laserDisabled: false, doctorHandcuffed: false,
  map: {
    cells: [{ at: [0, 0], type: 'helicopter' }, { at: [1, 2], type: 'key', striped: true }],
    walls: [[[1, 0], [2, 0]], [[3, 0], [3, 1]]],
    gates: [[[1, 2], [2, 2]]],
  },
};

test('bunker projects the public north-up map and current team location', () => {
  const { container } = render(<BombBustersBunker bunker={bunker} availableDirections={['north']} />);
  expect(screen.getByRole('img', { name: '지상 벙커 지도. 현재 위치 B3, 열쇠. 북쪽이 위입니다.' })).toBeInTheDocument();
  expect(screen.getByText('목표: 열쇠로 문 열기')).toBeInTheDocument();
  expect(screen.getByText('A · 짝수')).toBeInTheDocument();
  const walls = container.querySelectorAll('.bb-bunker-wall');
  expect(walls[0]).toHaveAttribute('x1', '200');
  expect(walls[0]).toHaveAttribute('x2', '200');
  expect(walls[1]).toHaveAttribute('y1', '118');
  expect(walls[1]).toHaveAttribute('y2', '118');
});

test('basement laser gate and action change with server state', () => {
  const { container } = render(<BombBustersBunker bunker={{ ...bunker, floor: 'basement', stage: 'disable_laser', laserDisabled: true }} availableDirections={[]} />);
  expect(screen.getByText('레이저 개방')).toBeInTheDocument();
  expect(screen.getByText('노랑')).toBeInTheDocument();
  expect(container.querySelector('.bb-bunker-gate.open')).toBeInTheDocument();
});
