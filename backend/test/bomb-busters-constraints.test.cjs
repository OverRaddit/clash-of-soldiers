const test = require('node:test');
const assert = require('node:assert/strict');
const { getConstraintViolation: violation, failureHintSuppressed, failureMistakeCost } = require('../dist/game-room/bomb-busters/campaign-constraints');
const context = (overrides = {}) => ({ value: 4, kind: 'dual', targetWires: [{ isLeftEdge: false, isRightEdge: false, hasClue: false }], usesEquipment: false, ...overrides });

test('A–F constrain blue values and exclude both wire colors', () => {
  const allowed = { A: [2,4,6,8,10,12], B: [1,3,5,7,9,11], C: [1,2,3,4,5,6], D: [7,8,9,10,11,12], E: [4,5,6,7,8,9], F: [1,2,3,10,11,12] };
  for (const [id, numbers] of Object.entries(allowed)) {
    for (const value of [1,2,3,4,5,6,7,8,9,10,11,12,'yellow','red']) {
      assert.equal(violation(id, context({ value })) === null, numbers.includes(value), `${id}: ${value}`);
    }
  }
});
test('G rejects equipment but allows a normal cut', () => {
  assert.equal(violation('G', context()), null);
  assert.ok(violation('G', context({ usesEquipment: true })));
});
test('H blocks either a hinted own wire or a hinted target wire', () => {
  assert.equal(violation('H', context()), null);
  assert.ok(violation('H', context({ ownWireHasClue: true })));
  assert.ok(violation('H', context({ targetWires: [{ isLeftEdge: false, isRightEdge: false, hasClue: true }] })));
});
test('I/J constrain the specified target edge including a single surviving wire', () => {
  assert.ok(violation('I', context({ targetWires: [{ isLeftEdge: false, isRightEdge: true, hasClue: false }] })));
  assert.equal(violation('J', context({ targetWires: [{ isLeftEdge: false, isRightEdge: true, hasClue: false }] })), null);
  for (const id of ['I', 'J']) assert.ok(violation(id, context({ targetWires: [{ isLeftEdge: true, isRightEdge: true, hasClue: false }] })));
  assert.equal(violation('I', context({ kind: 'solo', targetWires: [] })), null);
});
test('K blocks solo while L changes failure cost without blocking the cut', () => {
  assert.equal(violation('K', context()), null);
  assert.ok(violation('K', context({ kind: 'solo' })));
  assert.equal(violation('L', context()), null);
  assert.equal(failureMistakeCost([]), 1);
  assert.equal(failureMistakeCost(['A','H']), 1);
  assert.equal(failureMistakeCost(['L','L']), 2);
});
test('H suppresses hints when held by either participant', () => {
  assert.equal(failureHintSuppressed(['A','L']), false);
  assert.equal(failureHintSuppressed(['H','L']), true);
});
