const test = require('node:test');
const assert = require('node:assert/strict');
const { BombBustersLogicService, BOMB_BUSTERS_EQUIPMENT } = require('../dist/game-room/bomb-busters-logic.service');
const engine = new BombBustersLogicService();
const wires = p => p.racks.flatMap(r => r.wires);
const config = {
  1: [6,0,0,0,0], 2: [8,0,0,2,2], 3: [10,1,1,0,0],
  4: [12,1,1,2,2], 5: [12,1,1,2,3], 6: [12,1,1,4,4],
  7: [12,1,2,0,0], 8: [12,1,2,2,3],
};
const two = { 4:[12,1,1,4,4],5:[12,2,2,2,3],6:[12,2,2,4,4],7:[12,1,3,0,0],8:[12,1,3,4,4] };
for (let missionId=1;missionId<=8;missionId++) test(`training ${missionId} official setup at every player count`,()=>{
 for(let count=2;count<=5;count++) for(let repeat=0;repeat<12;repeat++) {
  const ids=Array.from({length:count},(_,i)=>`p${i}`);
  const s=engine.initializeGame(ids,ids,missionId,ids[0]);
  const [blue,red,redCandidates,yellow,yellowCandidates]=(count===2&&two[missionId])||config[missionId];
  const all=s.players.flatMap(wires);
  assert.equal(s.captainId,ids[0]);
  assert.equal(all.length,4*blue+red+yellow);
  for(let value=1;value<=blue;value++) assert.equal(all.filter(w=>w.value===value).length,4);
  assert.equal(all.filter(w=>w.value==='red').length,red);
  assert.equal(all.filter(w=>w.value==='yellow').length,yellow);
  assert.equal(s.redMarkers.length,redCandidates); assert.equal(s.yellowMarkers.length,yellowCandidates);
  assert.ok(s.redMarkers.every(v=>v>=1.5&&v<blue)); assert.ok(s.yellowMarkers.every(v=>v>=1.1&&v<blue));
  assert.ok(all.filter(w=>w.value==='red').every(w=>s.redMarkers.includes(w.sortValue)));
  assert.ok(all.filter(w=>w.value==='yellow').every(w=>s.yellowMarkers.includes(w.sortValue)));
  assert.equal(s.equipment.length,missionId<3?0:count);
  if(missionId===3) assert.ok(s.equipment.every(e=>![2,12].includes(e.id)));
  assert.ok(s.equipment.every(e=>!e.unlocked&&!e.used));
  for(const p of s.players) for(const r of p.racks) assert.deepEqual(r.wires.map(w=>w.sortValue),r.wires.map(w=>w.sortValue).sort((a,b)=>a-b));
 }
});
function fixture(layout=[[2,3],[2,4]], gear=[]) {
 const ids=layout.map((_,i)=>`p${i}`); const s=engine.initializeGame(ids,ids,4,ids[0]);
 s.players.forEach((p,i)=>{p.initialHintPlaced=true;p.racks=[{id:`r${i}`,wires:layout[i].map((v,j)=>({id:`w${i}-${j}`,value:v,sortValue:typeof v==='number'?v:v==='red'?6.5:6.1,cut:false,hint:null}))}];});
 Object.assign(s,{phase:'playing',equipment:gear.map(id=>({...structuredClone(BOMB_BUSTERS_EQUIPMENT.find(e=>e.id===id)),unlocked:true,used:false})),log:[]});
 return s;
}
const act=(s,a,p='p0')=>engine.applyAction(s,p,a);
const use=(s,id,extra={},p='p0')=>act(s,{type:'equipment',equipmentId:id,...extra},p);
const reject=(s,a,p='p0')=>{const before=structuredClone(s);assert.throws(()=>act(s,a,p));assert.deepEqual(s,before);};
const find=(s,id)=>s.players.flatMap(wires).find(w=>w.id===id);

test('public DTO is an allowlist even when server-only fields are added',()=>{
 const s=fixture(); s.futureSecret='NEVER-SEND'; s.players[0].futureSecret='NEVER-SEND'; s.mission.futureSecret='NEVER-SEND';
 assert.ok(!JSON.stringify(engine.getPlayerView(s,'p0')).includes('NEVER-SEND'));
 assert.ok(!JSON.stringify(engine.getPlayerView(s)).includes('NEVER-SEND'));
});
test('walkie exchange hides selections, preserves clue, inserts into originating rack and keeps turn',()=>{
 const s=fixture([[2,6],[4,8],[1,12]],[2]); find(s,'w0-0').hint=2;
 s.players[0].racks.push({id:'r0-b',wires:[{id:'extra',value:11,sortValue:11,cut:false,hint:null}]});
 use(s,2,{targetPlayerId:'p1'});
 act(s,{type:'exchange_wire',wireId:'w0-0'});
 const publicPending=engine.getPlayerView(s,'p1').pendingExchange;
 assert.equal(publicPending.ownSelectedWireId,undefined);assert.equal(publicPending.selections,undefined);
 assert.equal(engine.getPlayerView(s,'p0').pendingExchange.ownSelectedWireId,'w0-0');
 reject(s,{type:'exchange_wire',wireId:'w2-0'},'p2');
 reject(s,{type:'exchange_wire',wireId:'w0-1'});
 act(s,{type:'exchange_wire',wireId:'w1-0'},'p1');
 assert.equal(s.pendingExchange,null);assert.equal(s.currentPlayerId,'p0');assert.equal(s.turnNumber,1);
 assert.deepEqual(s.players[0].racks[0].wires.map(w=>w.value),[4,6]);
 assert.deepEqual(s.players[0].racks[1].wires.map(w=>w.value),[11]);
 assert.equal(find(s,'w0-0').hint,2);
 assert.equal(engine.getPlayerView(s,'p2').players[1].racks[0].wires[0].value,null);
 assert.equal(s.lastExchange.length,2);
});
test('equality labels use actual adjacency, colors compare as colors and do not expose values',()=>{
 const s=fixture([['yellow','yellow',3],[2,4]],[12]);
 use(s,12,{wireIds:['w0-0','w0-1']});
 assert.equal(s.relationMarkers[0].relation,'equal');
 assert.ok(engine.getPlayerView(s,'p1').players[0].racks[0].wires.every(w=>w.value===null));
 const invalid=fixture([[2,2,3],[2,4]],[1]);reject(invalid,{type:'equipment',equipmentId:1,wireIds:['w0-0','w0-1']});
 reject(invalid,{type:'equipment',equipmentId:1,wireIds:['w0-0','w0-2']});
 find(invalid,'w0-1').cut=true;use(invalid,1,{wireIds:['w0-1','w0-2']});
 assert.equal(invalid.relationMarkers[0].relation,'different');
});
test('rewinder can move before starting position but never beyond five safe spaces',()=>{
 const s=fixture(undefined,[6]);use(s,6);assert.equal(s.mistakes,-1);assert.equal(s.maxMistakes-s.mistakes,3);
 const edge=fixture(undefined,[6]);edge.mistakes=edge.maxMistakes-5;
 reject(edge,{type:'equipment',equipmentId:6});
});
test('radar reveals one boolean per rack and never treats colored sorting values as blue',()=>{
 const s=fixture([[2,2],['yellow','red']],[8]);
 s.players[0].racks.push({id:'r0-b',wires:[{id:'extra',value:4,sortValue:4,cut:false,hint:null}]});
 use(s,8,{value:2},'p1');assert.deepEqual(s.radarResults[0].racks.map(x=>x.present),[true,false,false]);
 assert.equal(s.currentPlayerId,'p0');assert.equal(s.turnNumber,1);
});
test('X/Y accepts yellow and cuts the matching own alternative without leaking own positions',()=>{
 const s=fixture([[2,'yellow',5],['yellow',3]],[10]);use(s,10);
 act(s,{type:'dual',ownWireId:'w0-0',alternativeWireId:'w0-1',targetPlayerId:'p1',targetWireIds:['w1-0']});
 assert.ok(s.pendingDetector);assert.equal(s.pendingDetector.kind,'xy');
 const view=engine.getPlayerView(s,'p1');assert.deepEqual(view.pendingDetector.guesses,[2,'yellow']);
 assert.equal(view.pendingDetector.ownWireId,undefined);assert.equal(view.pendingDetector.alternativeWireId,undefined);
 act(s,{type:'resolve_detector',wireId:'w1-0'},'p1');
 assert.equal(find(s,'w0-1').cut,true);assert.equal(find(s,'w0-0').cut,false);assert.equal(find(s,'w1-0').cut,true);
 assert.equal(s.currentPlayerId,'p1');assert.equal(s.xyRayActive,false);
});
test('X/Y rejects forged alternative and still explodes on a red target',()=>{
 const s=fixture([[2,5],['red',3]],[10]);use(s,10);
 reject(s,{type:'dual',ownWireId:'w0-0',alternativeWireId:'w1-1',targetPlayerId:'p1',targetWireIds:['w1-0']});
 act(s,{type:'dual',ownWireId:'w0-0',alternativeWireId:'w0-1',targetPlayerId:'p1',targetWireIds:['w1-0']});
 act(s,{type:'resolve_detector',wireId:'w1-0'},'p1');assert.equal(s.outcome,'lost');
});
test('coffee chooses next player and normal clockwise order resumes from them',()=>{
 const s=fixture([[2,3],[2,4],[3,4]],[11]);use(s,11,{targetPlayerId:'p2'});
 assert.equal(s.currentPlayerId,'p2');assert.equal(s.turnNumber,2);
 act(s,{type:'dual',ownWireId:'w2-0',targetPlayerId:'p0',targetWireIds:['w0-1']},'p2');
 assert.equal(s.currentPlayerId,'p0');assert.equal(s.turnNumber,3);
});
test('cancel prepared equipment keeps it available and consumes no turn',()=>{
 const s=fixture([[2,3],[2,4]],[10]);use(s,10);
 act(s,{type:'cancel_equipment'});assert.equal(s.xyRayActive,false);assert.equal(s.equipment[0].used,false);assert.equal(s.turnNumber,1);
});
