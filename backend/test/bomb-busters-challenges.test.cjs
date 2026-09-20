const test=require('node:test');
const assert=require('node:assert/strict');
const {evaluateBombChallenges}=require('../dist/game-room/bomb-busters/campaign-challenges');
const state=(...racks)=>({players:[{racks:racks.map(values=>({wires:values.map(v=>typeof v==='object'?v:{value:Math.abs(v),cut:v<0})}))}]});
const turn=(value,overrides={})=>({actorId:'p',kind:'dual',success:true,value,completedNumbers:[],...overrides});
const has=(s,h,id,numbers)=>evaluateBombChallenges(s,h,numbers).includes(id);

test('challenge2 counts four successful consecutive player turns, including recurring players',()=>{
 const h=[2,4,6,8].map((n,i)=>turn(n,{actorId:`p${i%2}`}));
 assert.ok(has(state([2]),h,2));assert.ok(!has(state([2]),h.slice(1),2));
 assert.ok(!has(state([2]),[...h,turn(10,{success:false})],2));
 assert.ok(!has(state([2]),[...h,turn(null,{kind:'pass'})],2));
});
test('challenge3 counts adjacent surviving pairs, without requiring matching numbers',()=>{
 assert.ok(has(state([1,2,-3,4,5]),[],3));
 assert.ok(!has(state([1,2,3,4]),[],3));
 assert.ok(!has(state([-1,-2]),[],3));
 assert.ok(!has(state([1,2,-3,4]),[],3));
});
test('challenge4 uses first three completed values, not their completion order afterward',()=>{
 assert.ok(has(state([1]),[turn(6,{completedNumbers:[1,5,12]})],4));
 assert.ok(!has(state([1]),[turn(6,{completedNumbers:[1,2,3,6,12]})],4));
});
test('challenge5 requires consecutive solo turns and is interrupted by reveals',()=>{
 assert.ok(has(state([1]),[turn(2,{kind:'solo'}),turn(4,{kind:'solo'})],5));
 assert.ok(!has(state([1]),[turn(2,{kind:'solo'}),turn('red',{kind:'reveal_red'})],5));
});
test('challenge6 counts isolated endpoint wires while a surviving pair is not isolated',()=>{
 assert.ok(has(state([1,-2,3,-4,5,-6,7,-8,9]),[],6));
 assert.ok(!has(state([1,2,-3,4,-5,6,-7,8,-9,10]),[],6));
});
test('challenge7 needs three ascending or descending successful turns',()=>{
 assert.ok(has(state([1]),[8,9,10].map(n=>turn(n)),7));assert.ok(has(state([1]),[5,4,3].map(n=>turn(n)),7));
 assert.ok(!has(state([1]),[5,4,5].map(n=>turn(n)),7));
 assert.ok(!has(state([1]),[turn(3),turn(4,{success:false}),turn(5)],7));
});
test('challenge8 requires the first two completions to be the drawn values',()=>{
 assert.ok(has(state([1]),[turn(6,{completedNumbers:[9,3]})],8,[3,9]));
 assert.ok(!has(state([1]),[turn(6,{completedNumbers:[2,3,9]})],8,[3,9]));
});
test('challenge9 ignores colored wires but requires at least six odd blue survivors',()=>{
 assert.ok(has(state([1,1,3,5,7,9,{value:'red',cut:false}]),[],9));
 assert.ok(!has(state([1,1,3,5,7,{value:'red',cut:false}]),[],9));
 assert.ok(!has(state([1,1,3,5,7,8]),[],9));
});
test('challenge10 counts cut tiles without losing the original two endpoints',()=>{
 assert.ok(has(state([1,-2,-3,-4,-5,-6,-7,-8,9]),[],10));
 assert.ok(!has(state([-1,-2,-3,-4,-5,-6,-7,8,9]),[],10));
});
