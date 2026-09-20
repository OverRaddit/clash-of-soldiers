import { useEffect, useRef, useState } from 'react';
import { BombBustersClientState } from '../types/bomb-busters.types';

export const BOMB_FEEDBACK_DURATION = 1200;

export interface BombVisualFeedback {
  key: number;
  kind: 'success' | 'failure';
  livesLost: number;
  wireIds: string[];
}

const snapshot = (state: BombBustersClientState, roomId: string) => ({
  roomId,
  missionId: state.mission.id,
  phase: state.phase,
  outcome: state.outcome,
  feedbackId: state.feedback?.id,
  lives: Math.max(0, state.maxMistakes - state.mistakes),
  wires: new Map(state.players.flatMap(player => player.racks.flatMap(rack => rack.wires.map(wire => [wire.id, wire.cut] as const)))),
});

/** Animate committed results once; mounting or reconnecting only establishes a baseline. */
export default function useBombFeedback(state: BombBustersClientState, roomId: string, connected: boolean) {
  const previous = useRef(snapshot(state, roomId));
  const sequence = useRef(0);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const reconnectSnapshot = useRef<BombBustersClientState | null>(connected ? null : state);
  const [feedback, setFeedback] = useState<BombVisualFeedback | null>(null);

  useEffect(() => {
    const current = snapshot(state, roomId);
    const before = previous.current;
    previous.current = current;
    const reset = () => {
      if (timer.current !== null) clearTimeout(timer.current);
      timer.current = null;
      setFeedback(null);
    };
    if (!connected) {
      reconnectSnapshot.current = state;
      reset();
      return;
    }
    if (reconnectSnapshot.current) {
      // The connect event can render with the old state before room_state arrives.
      if (state !== reconnectSnapshot.current) reconnectSnapshot.current = null;
      reset();
      return;
    }
    if (before.roomId !== roomId || before.missionId !== current.missionId || before.phase === 'setup' || current.phase === 'setup'
      || (before.phase === 'finished' && current.phase !== 'finished')
      || !Array.from(current.wires.keys()).some(id => before.wires.has(id))) {
      reset();
      return;
    }

    const newResult = state.feedback && state.feedback.id !== before.feedbackId ? state.feedback.kind : null;
    const livesLost = state.mission.id === 53 ? 0 : Math.max(0, before.lives - current.lives);
    const failed = newResult === 'failure' || livesLost > 0 || (state.outcome === 'lost' && before.outcome !== 'lost');
    if (!failed && newResult !== 'success') return;

    const wireIds = failed ? [] : Array.from(current.wires).filter(([id, cut]) => cut && before.wires.get(id) === false).map(([id]) => id);
    if (timer.current !== null) clearTimeout(timer.current);
    setFeedback({ key: ++sequence.current, kind: failed ? 'failure' : 'success', livesLost, wireIds });
    timer.current = setTimeout(() => { setFeedback(null); timer.current = null; }, BOMB_FEEDBACK_DURATION);
  }, [state, roomId, connected]);

  useEffect(() => () => { if (timer.current !== null) clearTimeout(timer.current); }, []);
  return feedback;
}
