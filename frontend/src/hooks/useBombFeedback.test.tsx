import { act, cleanup, renderHook } from '@testing-library/react';
import { BombBustersClientState } from '../types/bomb-busters.types';
import useBombFeedback, { BOMB_FEEDBACK_DURATION } from './useBombFeedback';

const makeState = (overrides: Partial<BombBustersClientState> = {}): BombBustersClientState => ({
  phase: 'playing',
  mission: { id: 8, name: '작전', description: '', blueMax: 12, redCount: 1, yellowCount: 2, redCandidateCount: 1, yellowCandidateCount: 2, equipment: true },
  players: [
    { id: 'me', name: '나', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'mine', wires: [
      { id: 'own-a', value: 2, sortValue: 2, cut: false, hint: null },
      { id: 'own-b', value: 3, sortValue: 3, cut: true, hint: null },
    ] }] },
    { id: 'other', name: '동료', initialHintPlaced: true, detectorUsed: false, racks: [{ id: 'theirs', wires: [
      { id: 'other-a', value: null, sortValue: null, cut: false, hint: null },
      { id: 'other-b', value: null, sortValue: null, cut: false, hint: null },
    ] }] },
  ],
  captainId: 'me', currentPlayerId: 'me', mistakes: 0, maxMistakes: 4, turnNumber: 1,
  outcome: null, endReason: null, redMarkers: [], yellowMarkers: [], equipment: [],
  stabilizerActive: false, superDetectorActive: false, tripleDetectorActive: false,
  pendingDetector: null, log: [], cutCounts: { '3': 1 }, ...overrides,
});

const copy = (state: BombBustersClientState): BombBustersClientState => JSON.parse(JSON.stringify(state));
const advance = (milliseconds: number) => act(() => { jest.advanceTimersByTime(milliseconds); });
const setup = (state = makeState(), connected = true) => renderHook(
  (props: { state: BombBustersClientState; roomId: string; connected: boolean }) => useBombFeedback(props.state, props.roomId, props.connected),
  { initialProps: { state, roomId: 'room', connected } },
);

beforeEach(() => jest.useFakeTimers());
afterEach(() => { cleanup(); jest.useRealTimers(); });

test.each(['success', 'failure'] as const)('mounting with an existing %s result and duplicate server snapshots does not animate', (kind) => {
  const state = makeState({ feedback: { id: 'historical', kind }, mistakes: 1 });
  const { result, rerender } = setup(state);
  expect(result.current).toBeNull();
  rerender({ state: { ...copy(state), serverNow: 10000 }, roomId: 'room', connected: true });
  expect(result.current).toBeNull();
  advance(BOMB_FEEDBACK_DURATION);
  expect(result.current).toBeNull();
});

test('failure reports the number of lives lost and expires after 1200ms despite duplicate ticks', () => {
  const { result, rerender } = setup();
  const failed = makeState({ mistakes: 2, feedback: { id: 'failure-1', kind: 'failure' } });
  rerender({ state: failed, roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'failure', livesLost: 2, wireIds: [] });
  const key = result.current!.key;
  advance(500);
  rerender({ state: { ...copy(failed), serverNow: 20000 }, roomId: 'room', connected: true });
  expect(result.current?.key).toBe(key);
  advance(BOMB_FEEDBACK_DURATION - 501);
  expect(result.current?.key).toBe(key);
  advance(1);
  expect(result.current).toBeNull();
  rerender({ state: { ...copy(failed), serverNow: 21000 }, roomId: 'room', connected: true });
  expect(result.current).toBeNull();
});

test('a second rapid failure gets a new key and its own full duration', () => {
  const { result, rerender } = setup();
  rerender({ state: makeState({ mistakes: 1, feedback: { id: 'failure-1', kind: 'failure' } }), roomId: 'room', connected: true });
  const firstKey = result.current!.key;
  advance(800);
  rerender({ state: makeState({ mistakes: 2, feedback: { id: 'failure-2', kind: 'failure' } }), roomId: 'room', connected: true });
  const secondKey = result.current!.key;
  expect(secondKey).not.toBe(firstKey);
  expect(result.current?.livesLost).toBe(1);
  advance(400);
  expect(result.current?.key).toBe(secondKey);
  advance(BOMB_FEEDBACK_DURATION - 401);
  expect(result.current?.key).toBe(secondKey);
  advance(1);
  expect(result.current).toBeNull();
});

test('reconnect ignores the connect render with old state and the first fresh snapshot, then plays the next action', () => {
  const { result, rerender } = setup();
  const oldState = makeState({ mistakes: 1, feedback: { id: 'failure-1', kind: 'failure' } });
  rerender({ state: oldState, roomId: 'room', connected: true });
  expect(result.current?.kind).toBe('failure');
  rerender({ state: oldState, roomId: 'room', connected: false });
  expect(result.current).toBeNull();
  rerender({ state: oldState, roomId: 'room', connected: true });
  expect(result.current).toBeNull();
  const recovered = makeState({ mistakes: 2, feedback: { id: 'missed-while-offline', kind: 'failure' } });
  rerender({ state: recovered, roomId: 'room', connected: true });
  expect(result.current).toBeNull();
  rerender({ state: makeState({ mistakes: 3, feedback: { id: 'live-after-reconnect', kind: 'failure' } }), roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'failure', livesLost: 1 });
  advance(BOMB_FEEDBACK_DURATION);
  expect(result.current).toBeNull();
});

test('successful cuts are identified by wire ID even when rack positions change', () => {
  const initial = makeState();
  const { result, rerender } = setup(initial);
  const success = copy(initial);
  success.feedback = { id: 'success-1', kind: 'success' };
  success.players[0].racks[0].wires.reverse();
  for (const player of success.players) for (const rack of player.racks) for (const wire of rack.wires) {
    if (['own-a', 'other-a'].includes(wire.id)) wire.cut = true;
  }
  rerender({ state: success, roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'success', livesLost: 0 });
  expect([...result.current!.wireIds].sort()).toEqual(['other-a', 'own-a']);
  expect(result.current?.wireIds).not.toContain('own-b');
});

test('moving already cut wires or privately restoring them does not imitate a successful cut', () => {
  const initial = makeState({ feedback: { id: 'previous-cut', kind: 'success' } });
  initial.mission.id = 42;
  const { result, rerender } = setup(initial);
  const moved = copy(initial);
  const movedWire = moved.players[0].racks[0].wires.pop()!;
  moved.players[1].racks[0].wires.unshift(movedWire);
  rerender({ state: moved, roomId: 'room', connected: true });
  expect(result.current).toBeNull();
  const restored = copy(moved);
  restored.players[1].racks[0].wires[0].cut = false;
  restored.players[1].racks[0].wires[0].value = null;
  restored.players[1].racks[0].wires[0].sortValue = null;
  restored.turnNumber += 1;
  rerender({ state: restored, roomId: 'room', connected: true });
  expect(result.current).toBeNull();
});

test('a loss without explicit feedback animates once and duplicate finished snapshots do not cancel it', () => {
  const { result, rerender } = setup();
  const ended = makeState({ phase: 'finished', outcome: 'lost', endReason: '빨간 전선을 절단했습니다.' });
  ended.players[1].racks[0].wires[0].cut = true;
  rerender({ state: ended, roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'failure', livesLost: 0, wireIds: [] });
  const key = result.current!.key;
  advance(400);
  rerender({ state: { ...copy(ended), serverNow: 30000 }, roomId: 'room', connected: true });
  expect(result.current?.key).toBe(key);
  advance(BOMB_FEEDBACK_DURATION - 401);
  expect(result.current?.key).toBe(key);
  advance(1);
  expect(result.current).toBeNull();
});

test('stabilizer-protected failure animates even when no lives are lost', () => {
  const { result, rerender } = setup(makeState({ stabilizerActive: true }));
  rerender({ state: makeState({ feedback: { id: 'protected-failure', kind: 'failure' } }), roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'failure', livesLost: 0, wireIds: [] });
});

test('nano mission failure uses explicit feedback with no ordinary lives loss', () => {
  const initial = makeState();
  initial.mission.id = 53;
  const { result, rerender } = setup(initial);
  const failed = copy(initial);
  failed.feedback = { id: 'nano-failure', kind: 'failure' };
  rerender({ state: failed, roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'failure', livesLost: 0, wireIds: [] });
});

test('a penalty accompanying a successful cut takes precedence over success highlighting', () => {
  const { result, rerender } = setup();
  const danger = makeState({ mistakes: 1, feedback: { id: 'success-with-penalty', kind: 'success' } });
  danger.players[0].racks[0].wires[0].cut = true;
  rerender({ state: danger, roomId: 'room', connected: true });
  expect(result.current).toMatchObject({ kind: 'failure', livesLost: 1, wireIds: [] });
});

test('changing rooms stops the previous effect and establishes a fresh baseline', () => {
  const { result, rerender } = setup();
  const failed = makeState({ mistakes: 1, feedback: { id: 'old-room-failure', kind: 'failure' } });
  rerender({ state: failed, roomId: 'room', connected: true });
  expect(result.current?.kind).toBe('failure');
  rerender({ state: copy(failed), roomId: 'another-room', connected: true });
  expect(result.current).toBeNull();
  advance(BOMB_FEEDBACK_DURATION);
  expect(result.current).toBeNull();
});
