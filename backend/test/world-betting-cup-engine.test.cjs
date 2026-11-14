const test = require('node:test');
const assert = require('node:assert/strict');
const { initializeWbcGame, applyWbcAction, betConstraints } = require('../dist/game-room/world-betting-cup/engine');

const IDS = ['p1', 'p2', 'p3'];

// 선배팅과 정보 탐색을 모두 마쳐 배팅 단계에 들어간 상태를 만든다.
function reachBetting(seed = 7) {
  let state = initializeWbcGame(IDS, ['준우', '담비', '민지'], seed);
  for (const id of IDS) state = applyWbcAction(state, id, { type: 'prebet', countryId: state.bracket.quarter[0] });
  assert.equal(state.phase, 'info');
  while (state.phase === 'info') {
    const actor = state.match.actionOrder[state.match.actionIndex];
    state = applyWbcAction(state, actor, { type: 'peek', slots: [0, 1] });
  }
  assert.equal(state.phase, 'betting');
  return state;
}

function bet(state, playerId, normal, fix = 0, win = 0) {
  return applyWbcAction(state, playerId, { type: 'bet', countryId: state.match.homeId, normal, fix, win });
}

test('첫 배팅은 1개부터 경기 상한까지 자유롭다', () => {
  const state = reachBetting();
  const [first] = state.match.betOrder;
  const c = betConstraints(state, state.players.find(p => p.id === first));
  assert.deepEqual(c, { required: 0, cap: 3, allInAllowed: false, canRaise: true });
  assert.throws(() => bet(state, first, 4), /최대 3개/);
  assert.equal(bet(state, first, 3).match.maxUnits, 3);
});

test('뒷사람은 최고 배팅 이상을 내야 하며 더 내면 레이즈가 된다', () => {
  let state = reachBetting();
  const [first, second, third] = state.match.betOrder;
  state = bet(state, first, 1);
  assert.throws(() => bet(state, second, 0, 0, 0), /최소 1개/);
  // 레이즈
  state = bet(state, second, 2);
  assert.equal(state.match.maxUnits, 2);
  assert.match(state.log.at(-1), /레이즈/);
  // 레이즈 뒤에는 그 수 이상만 가능
  assert.throws(() => bet(state, third, 1), /2개 이상/);
  const c = betConstraints(state, state.players.find(p => p.id === third));
  assert.equal(c.required, 2);
  assert.equal(c.canRaise, true);
  state = bet(state, third, 1, 1); // 일반 1 + 조작 1 = 2개 콜
  assert.equal(state.phase, 'settled');
});

test('상한에 도달하면 더 올릴 수 없고 콜만 가능하다', () => {
  let state = reachBetting();
  const [first, second] = state.match.betOrder;
  state = bet(state, first, 3);
  const c = betConstraints(state, state.players.find(p => p.id === second));
  assert.equal(c.canRaise, false);
  assert.throws(() => bet(state, second, 2, 1, 1), /최대 3개/);
  state = bet(state, second, 3);
  assert.equal(state.match.maxUnits, 3);
});

test('일반 토큰이 모자라면 전부 걸어 올인할 수 있다', () => {
  let state = reachBetting();
  const [first, second] = state.match.betOrder;
  state = bet(state, first, 3);
  // 두 번째 사람의 일반 토큰을 1개로 줄여 올인 상황을 만든다.
  state.players.find(p => p.id === second).tokens = 1;
  const me = state.players.find(p => p.id === second);
  assert.equal(betConstraints(state, me).allInAllowed, true);
  assert.throws(() => bet(state, second, 0, 1), /3개 이상/); // 일반을 다 걸지 않으면 올인이 아니다
  state = bet(state, second, 1, 1);
  assert.match(state.log.at(-1), /올인/);
  assert.equal(state.match.maxUnits, 3); // 올인은 최고 배팅을 낮추지 않는다
});
