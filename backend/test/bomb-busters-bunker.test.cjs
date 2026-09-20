const test = require('node:test');
const assert = require('node:assert/strict');
const { createBombBunker, allowedBunkerMoves, moveBombBunker, performBunkerAction, bunkerStageComplete } = require('../dist/game-room/bomb-busters/campaign-bunker');
const bunker = () => createBombBunker(['A','B','C','D','E']);

test('bunker starts at helicopter and rejects invalid constraint layouts', () => {
  assert.deepEqual(bunker().position,[0,0]);
  assert.throws(() => createBombBunker(['A','A','C','D','E']));
  assert.deepEqual(allowedBunkerMoves(bunker(),1),['east','south']);
  assert.deepEqual(allowedBunkerMoves(bunker(),12),[]);
});
test('walls, outer edges and a closed door are impassable', () => {
  const b=bunker(); b.position=[1,0];
  assert.ok(!allowedBunkerMoves(b,1).includes('east'));
  b.position=[1,2]; b.stage='neutralize_guard';
  assert.ok(!allowedBunkerMoves(b,1).includes('east'));
  b.doorOpen=true; assert.ok(allowedBunkerMoves(b,1).includes('east'));
});
test('striped action requires success and the action value, then waits for next stage', () => {
  const b=bunker(); b.position=[1,2];
  assert.deepEqual(allowedBunkerMoves(b,5),[]);
  assert.throws(() => performBunkerAction(b,1,true));
  assert.equal(performBunkerAction(b,5,false),false); assert.equal(b.doorOpen,false);
  assert.equal(performBunkerAction(b,5,true),true); assert.equal(bunkerStageComplete(b),true);
  assert.deepEqual(allowedBunkerMoves(b,1),[]);
  b.stage='neutralize_guard'; assert.ok(allowedBunkerMoves(b,1).includes('east'));
});
test('stairs preserve north orientation and do not instantly bounce floors', () => {
  const b=bunker(); b.doorOpen=true; b.guardNeutralized=true; b.stage='reach_basement'; b.position=[2,0];
  assert.equal(moveBombBunker(b,1,'east'),0);
  assert.equal(b.floor,'basement'); assert.deepEqual(b.position,[3,0]); assert.equal(bunkerStageComplete(b),true);
  b.stage='disable_laser'; assert.ok(!allowedBunkerMoves(b,2).includes('south'));
});
test('lasers block all three crossings until a yellow action, trap entries add one', () => {
  const b=bunker(); b.floor='basement'; b.stage='disable_laser'; b.position=[2,1];
  assert.ok(!allowedBunkerMoves(b,8).includes('west'));
  b.position=[3,2]; assert.throws(() => performBunkerAction(b,5,true));
  performBunkerAction(b,'yellow',true); b.stage='handcuff_doctor'; b.position=[2,0];
  assert.equal(moveBombBunker(b,8,'west'),1); assert.deepEqual(b.position,[1,0]);
});
