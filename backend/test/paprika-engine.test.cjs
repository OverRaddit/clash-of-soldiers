const test = require('node:test');
const assert = require('node:assert/strict');
const {
  initializePaprikaGame, applyPaprikaAction, legalCells, neighborsOf, resolveHarvest, getPaprikaPlayerView,
  TOKENS_BY_PLAYERS, FESTIVAL_GOAL,
} = require('../dist/game-room/paprika/engine');

const ids = n => Array.from({ length: n }, (_, i) => `p${i + 1}`);
const names = n => Array.from({ length: n }, (_, i) => `농부${i + 1}`);
const current = state => state.players[state.turnIndex].id;

/** 현재 차례 플레이어가 첫 번째 합법 칸에 토큰을 놓는다 */
function placeAny(state, kind = 'seed') {
  const pid = current(state);
  return applyPaprikaAction(state, pid, { type: 'place', cell: legalCells(state, pid)[0], kind });
}

test('초기화: 인원별 토큰 수와 37칸 육각 농장', () => {
  const state = initializePaprikaGame(ids(4), names(4), 1);
  assert.equal(state.cells.length, 37);
  assert.equal(state.tokensPerPlayer, TOKENS_BY_PLAYERS[4]);
  assert.throws(() => initializePaprikaGame(ids(2), names(2), 1), /3~6명/);
  for (const n of [3, 4, 5, 6]) assert.ok(TOKENS_BY_PLAYERS[n] * n * 2 >= FESTIVAL_GOAL, `${n}명도 축제가 가능해야 한다`);
});

test('거리두기: 내 토큰 옆에는 내 토큰을 놓을 수 없고, 남의 토큰 옆은 된다', () => {
  let state = initializePaprikaGame(ids(3), names(3), 2);
  const first = current(state);
  state = applyPaprikaAction(state, first, { type: 'place', cell: '0,0', kind: 'seed' });
  const second = current(state);
  assert.notEqual(second, first);
  // 남은 두 사람은 중앙 옆에 놓을 수 있다
  assert.ok(legalCells(state, second).includes('1,0'));
  state = applyPaprikaAction(state, second, { type: 'place', cell: '1,0', kind: 'thief' });
  state = placeAny(state);
  // 다시 첫 사람: 중앙 옆 6칸은 모두 금지
  assert.equal(current(state), first);
  for (const n of neighborsOf('0,0')) assert.ok(!legalCells(state, first).includes(n));
  assert.throws(() => applyPaprikaAction(state, first, { type: 'place', cell: '0,-1', kind: 'seed' }), /거리두기/);
  assert.throws(() => applyPaprikaAction(state, first, { type: 'place', cell: '1,0', kind: 'seed' }), /이미 토큰/);
  assert.throws(() => applyPaprikaAction(state, second, { type: 'place', cell: '2,0', kind: 'seed' }), /내 차례가 아닙니다/);
});

test('비공개: 남의 토큰 종류는 파종 중에 보이지 않고 수확 때 공개된다', () => {
  let state = initializePaprikaGame(ids(3), names(3), 3);
  const first = current(state);
  state = applyPaprikaAction(state, first, { type: 'place', cell: '0,0', kind: 'thief' });
  const other = state.players.find(p => p.id !== first && p.id !== current(state)).id; // 차례도 아닌 제3자
  const mine = getPaprikaPlayerView(state, first).board[0];
  const theirs = getPaprikaPlayerView(state, other).board[0];
  assert.equal(mine.kind, 'thief');
  assert.equal(theirs.kind, null);
  assert.equal(theirs.ownerId, first); // 색(주인)은 보인다
  assert.equal(getPaprikaPlayerView(state, other).legalCells.length, 0);
  assert.ok(getPaprikaPlayerView(state, current(state)).legalCells.length > 0);
});

test('수확 계산: 도둑 상쇄, 약탈, 안전 수확, 같은 씨앗은 먼저 놓인 도둑이 가져간다', () => {
  const state = initializePaprikaGame(ids(3), names(3), 4);
  // 손으로 판을 짠다: p1 씨앗(0,0), p2 도둑(1,0) 인접, p3 도둑(-1,0) 인접 — 두 도둑은 서로 떨어져 있다
  state.board = [
    { cell: '0,0', ownerId: 'p1', kind: 'seed', order: 1 },
    { cell: '1,0', ownerId: 'p2', kind: 'thief', order: 2 },
    { cell: '-1,0', ownerId: 'p3', kind: 'thief', order: 3 },
    { cell: '0,3', ownerId: 'p1', kind: 'seed', order: 4 },        // 아무도 못 터는 씨앗
    { cell: '2,-2', ownerId: 'p2', kind: 'thief', order: 5 },      // 아래 도둑과 인접 → 둘 다 제거
    { cell: '2,-3', ownerId: 'p3', kind: 'thief', order: 6 },
    { cell: '3,-3', ownerId: 'p1', kind: 'seed', order: 7 },       // 제거된 도둑 옆이라 안전
  ];
  const h = resolveHarvest(state);
  const fate = cell => h.fates.find(f => f.cell === cell);
  assert.equal(fate('2,-2').removed, true);
  assert.equal(fate('2,-3').removed, true);
  assert.equal(fate('0,0').stolenBy, 'p2');          // order 2가 order 3보다 먼저
  assert.equal(fate('1,0').loot, 1);
  assert.equal(fate('-1,0').loot, 0);
  assert.equal(fate('0,3').harvested, true);
  assert.equal(fate('3,-3').harvested, true);
  assert.deepEqual(h.gains, { p1: 2, p2: 1, p3: 0 });
  assert.equal(h.total, 3);
});

test('두 라운드를 끝까지 진행하면 결과가 나오고, 라운드 사이에 판이 비워진다', () => {
  let state = initializePaprikaGame(ids(3), names(3), 5);
  while (state.phase === 'planting') state = placeAny(state, 'seed');
  assert.equal(state.phase, 'harvest');
  assert.equal(state.board.length, 15);
  assert.equal(state.harvests.length, 1);
  const firstRoundStarter = state.roundStartIndex;
  assert.throws(() => placeAny(state), /파종 단계가 아닙니다/);
  state = applyPaprikaAction(state, 'p1', { type: 'next_round' });
  assert.equal(state.phase, 'planting');
  assert.equal(state.round, 2);
  assert.equal(state.board.length, 0);
  assert.equal(state.roundStartIndex, (firstRoundStarter + 1) % 3);
  while (state.phase === 'planting') state = placeAny(state, 'seed');
  assert.equal(state.phase, 'finished');
  // 전부 씨앗이면 30개 → 축제
  assert.equal(state.total, 30);
  assert.equal(state.outcome, 'festival');
  assert.ok(state.standings.every(s => s.winner));
});

test('승패 판정: 올해의 농부 / 대흉작 / 승자 없음', () => {
  const finish = (paprika) => {
    let state = initializePaprikaGame(ids(3), names(3), 6);
    state.round = 2;
    state.players.forEach((p, i) => { p.paprika = paprika[i]; });
    // 아무도 토큰을 놓지 못하는 상황을 만들어 즉시 수확 → 종료
    state.players.forEach(p => { p.placed = state.tokensPerPlayer; });
    state.players[0].placed -= 1;
    const pid = state.players[state.turnIndex].id;
    state.players.forEach(p => { if (p.id !== pid) p.placed = state.tokensPerPlayer; });
    state.players.find(p => p.id === pid).placed = state.tokensPerPlayer - 1;
    return applyPaprikaAction(state, pid, { type: 'place', cell: '0,0', kind: 'thief' });
  };
  let s = finish([9, 4, 2]);
  assert.equal(s.outcome, 'farmer');
  assert.deepEqual(s.standings.filter(x => x.winner).map(x => x.playerId), ['p1']);
  s = finish([7, 7, 2]);
  assert.equal(s.outcome, 'famine');
  assert.equal(s.standings.filter(x => x.winner).length, 0);
  s = finish([3, 2, 1]);
  assert.equal(s.outcome, 'none');
  assert.equal(s.standings[0].rank, 1);
});
