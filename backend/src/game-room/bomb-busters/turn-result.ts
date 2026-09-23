import type { BombBustersState } from '../entities/bomb-busters-game-state.entity';

// An action-local journal, never serialized with the game. Recording placement
// rather than comparing clue values also detects an identical clue placed again.
const failureClues = new WeakMap<BombBustersState, Set<string>>();

export function trackBombFailureClues(state: BombBustersState): Set<string> {
  const ids = new Set<string>();
  failureClues.set(state, ids);
  return ids;
}

export function recordBombFailureClue(state: BombBustersState, wireId: string): void {
  failureClues.get(state)?.add(wireId);
}
