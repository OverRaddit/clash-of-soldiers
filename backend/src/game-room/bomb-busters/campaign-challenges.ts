import { BombBustersState, BombWireValue } from '../entities/bomb-busters-game-state.entity';

/** One entry per resolved player turn; four-wire solo cuts remain a single turn. */
export interface BombChallengeTurn {
  actorId: string;
  kind: 'dual' | 'solo' | 'special' | 'pass' | 'reveal_red' | 'equipment';
  success: boolean;
  value: BombWireValue | null;
  completedNumbers: number[];
}

/** Return satisfied challenge IDs, without consuming cards or moving the detonator. */
export function evaluateBombChallenges(
  state: Pick<BombBustersState, 'players'>,
  history: readonly BombChallengeTurn[],
  challengeNumbers: readonly number[] = [],
): number[] {
  const achieved: number[] = [];
  const racks = state.players.flatMap(player => player.racks);
  const tail = (count: number) => history.slice(-count);
  const cut = (turn: BombChallengeTurn) => turn.success && ['dual', 'solo', 'special'].includes(turn.kind);
  // Repeated actors are possible in two/three-player games: these count consecutive turns,
  // not distinct player identities and not individual wires within a solo cut.
  const lastFour = tail(4);
  if (lastFour.length === 4 && lastFour.every(turn => cut(turn) && typeof turn.value === 'number' && turn.value % 2 === 0)) achieved.push(2);
  if (racks.some(rack => {
    const runs: number[] = [];
    let run = 0;
    for (const wire of rack.wires) {
      if (!wire.cut) run++;
      else if (run) { runs.push(run); run = 0; }
    }
    if (run) runs.push(run);
    return runs.length > 0 && runs.every(length => length === 2);
  })) achieved.push(3);
  const completed = history.flatMap(turn => turn.completedNumbers);
  if (completed.length >= 3 && completed.slice(0, 3).reduce((sum, number) => sum + number, 0) === 18) achieved.push(4);
  const lastTwo = tail(2);
  if (lastTwo.length === 2 && lastTwo.every(turn => cut(turn) && turn.kind === 'solo')) achieved.push(5);
  if (racks.some(rack => rack.wires.filter((wire, index, all) => !wire.cut
    && (index === 0 || all[index - 1].cut)
    && (index === all.length - 1 || all[index + 1].cut)).length >= 5)) achieved.push(6);
  const lastThree = tail(3);
  if (lastThree.length === 3 && lastThree.every(turn => cut(turn) && typeof turn.value === 'number')) {
    const values = lastThree.map(turn => turn.value as number);
    const difference = values[1] - values[0];
    if (Math.abs(difference) === 1 && values[2] - values[1] === difference) achieved.push(7);
  }
  if (challengeNumbers.length === 2 && completed.length >= 2
    && new Set(completed.slice(0, 2)).size === 2
    && completed.slice(0, 2).every(value => challengeNumbers.includes(value))) achieved.push(8);
  if (racks.some(rack => {
    const blue = rack.wires.filter(wire => !wire.cut && typeof wire.value === 'number');
    return blue.length >= 6 && blue.every(wire => (wire.value as number) % 2 === 1);
  })) achieved.push(9);
  if (racks.some(rack => rack.wires.length >= 9 && !rack.wires[0].cut && !rack.wires[rack.wires.length - 1].cut
    && rack.wires.filter(wire => wire.cut).length >= 7)) achieved.push(10);
  return achieved;
}
