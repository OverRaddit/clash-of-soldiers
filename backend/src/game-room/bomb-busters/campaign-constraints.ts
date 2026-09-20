import { BombWireValue } from '../entities/bomb-busters-game-state.entity';
import { BOMB_CONSTRAINTS, BombConstraintId } from './rule-cards';

export interface BombConstraintContext {
  value: BombWireValue;
  kind: 'dual' | 'solo';
  /** Actual wires to cut, not every candidate offered by a detector. */
  targetWires: { isLeftEdge: boolean; isRightEdge: boolean; hasClue: boolean }[];
  usesEquipment: boolean;
  ownWireHasClue?: boolean;
}

/** A participant's constraint applies before any wire or equipment is consumed. */
export function getConstraintViolation(id: BombConstraintId, context: BombConstraintContext): string | null {
  const definition = BOMB_CONSTRAINTS.find(card => card.id === id);
  if (!definition) return '알 수 없는 제약 카드입니다.';
  if (definition.allowedBlueValues && (typeof context.value !== 'number' || !definition.allowedBlueValues.includes(context.value))) return definition.description;
  if (definition.equipmentForbidden && context.usesEquipment) return definition.description;
  if (definition.hintedWiresForbidden && (context.ownWireHasClue || context.targetWires.some(wire => wire.hasClue))) return definition.description;
  if (definition.forbiddenTargetEdge === 'left' && context.targetWires.some(wire => wire.isLeftEdge)) return definition.description;
  if (definition.forbiddenTargetEdge === 'right' && context.targetWires.some(wire => wire.isRightEdge)) return definition.description;
  if (definition.soloForbidden && context.kind === 'solo') return definition.description;
  return null;
}

/** Include constraints held by both participants in the failed cut. */
export function failureHintSuppressed(ids: readonly BombConstraintId[]): boolean {
  return ids.some(id => BOMB_CONSTRAINTS.find(card => card.id === id)?.suppressFailureHint);
}

/** L changes the acting player's mistake cost; it is not multiplied by duplicates. */
export function failureMistakeCost(actorIds: readonly BombConstraintId[]): number {
  return Math.max(1, ...actorIds.map(id => BOMB_CONSTRAINTS.find(card => card.id === id)?.mistakeIncrement ?? 1));
}
