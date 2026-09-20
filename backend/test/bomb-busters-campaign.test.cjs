const test=require('node:test');
const assert=require('node:assert/strict');
const {BombBustersLogicService,BOMB_BUSTERS_MISSIONS,BOMB_BUSTERS_EQUIPMENT}=require('../dist/game-room/bomb-busters-logic.service');
const {BOMB_CAMPAIGN_DEFINITIONS}=require('../dist/game-room/bomb-busters/campaign-definitions');
const engine=new BombBustersLogicService();
const wires=p=>p.racks.flatMap(r=>r.wires);
const all=s=>s.players.flatMap(wires);
const act=(s,a,p='p0')=>engine.applyAction(s,p,a);
const reject=(s,a,p='p0')=>{const copy=structuredClone(s);assert.throws(()=>act(s,a,p));assert.deepEqual(s,copy);};
const command=(s,operation,extra={},p='p0')=>act(s,{type:'mission',operation,...extra},p);
const dual=(s,own,target,p='p0')=>act(s,{type:'dual',ownWireId:own,targetPlayerId:target.split('-')[0].replace('w','p'),targetWireIds:[target]},p);
function fixture(id,layout=[[2,3,8],[2,4,9],[3,4,10]],gear=[]) {
 const ids=layout.map((_,i)=>`p${i}`);const s=engine.initializeGame(ids,ids,id,'p0');
 s.players.forEach((p,i)=>{p.initialHintPlaced=true;p.personalEquipmentId=0;p.detectorUsed=false;p.racks=[{id:`r${i}`,wires:layout[i].map((value,j)=>({id:`w${i}-${j}`,value,sortValue:typeof value==='number'?value:value==='red'?5.5:5.1,cut:false,hint:null}))}];});
 Object.assign(s,{phase:'playing',currentPlayerId:'p0',mistakes:0,equipment:gear.map(n=>({...structuredClone(BOMB_BUSTERS_EQUIPMENT.find(e=>e.id===n)),unlocked:true,used:false})),log:[]});
 Object.assign(s.campaign,{pending:null,setupTasks:[],turn:null,history:[],pendingAfterTurn:false,personalChoicesComplete:true,requiredValue:null});
 return s;
}

test('campaign registry contains every non-audio mission',()=>{
 for(let id=9;id<=66;id++) if(![19,30,42,54,66].includes(id)) assert.ok(BOMB_BUSTERS_MISSIONS.some(m=>m.id===id),`mission ${id} must be playable`);
});
test('every non-audio mission preserves inventory, privacy and minimum players',()=>{
 const audio=[19,30,42,54,66];
 for(let id=9;id<=66;id++) {
  if(audio.includes(id))continue;
  const definition=BOMB_CAMPAIGN_DEFINITIONS.find(d=>d.id===id);
  for(let count=2;count<=5;count++) {
   const ids=Array.from({length:count},(_,i)=>`p${i}`);
   if(count<definition.minPlayers){assert.throws(()=>engine.initializeGame(ids,ids,id));continue;}
   const s=engine.initializeGame(ids,ids,id,'p0');const inventory=[...all(s),...(s.campaign.nano?.reserve??[])];
   assert.equal(new Set(inventory.map(w=>w.id)).size,inventory.length,`duplicate wire ${id}/${count}`);
   for(let value=1;value<=12;value++)assert.equal(inventory.filter(w=>w.value===value).length,4,`${id}/${count} blue ${value}`);
   assert.equal(inventory.filter(w=>w.value==='red').length,s.mission.redCount,`${id}/${count} red`);
   assert.equal(inventory.filter(w=>w.value==='yellow').length,s.mission.yellowCount,`${id}/${count} yellow`);
   s.campaign.futureSecret='PRIVATE-CAMPAIGN';
   for(const viewer of [...ids,undefined]){
    const view=engine.getPlayerView(s,viewer);const json=JSON.stringify(view);
    assert.ok(!json.includes('PRIVATE-CAMPAIGN'));
    for(const forbidden of ['numberDeck','constraintDeck','equipmentDeck','secretRoleId','setupTasks','predictionOwnerId'])assert.equal(view.campaign?.[forbidden],undefined,`${id}: ${forbidden}`);
    for(const p of view.players)for(const w of wires(p)){
     const raw=all(s).find(x=>x.id===w.id);const visible=raw.cut||(viewer&&(raw.reversed?p.id!==viewer:p.id===viewer));
     assert.equal(w.value,visible?raw.value:null,`${id}/${viewer}/${w.id} visibility`);
    }
   }
  }
 }
});

test('all non-audio setups can be completed using only the acting player public controls',()=>{
 for(let id=9;id<=66;id++) {
  if([19,30,42,54,66].includes(id))continue;
  const definition=BOMB_CAMPAIGN_DEFINITIONS.find(d=>d.id===id);
  for(let count=definition.minPlayers;count<=5;count++) {
   const ids=Array.from({length:count},(_,i)=>`p${i}`);const s=engine.initializeGame(ids,ids,id,'p0');
   for(let step=0;s.phase==='setup'&&step<50;step++) {
    const views=ids.map(p=>engine.getPlayerView(s,p));
    const pendingActor=views[0].campaign?.pendingActorId;
    const actor=pendingActor&&pendingActor!=='any'?pendingActor:s.currentPlayerId;
    const view=views[ids.indexOf(actor)];const own=view.players.find(p=>p.id===actor);
    const control=view.campaign?.controls?.[0];
    if(control) {
     const action={type:'mission',operation:control.id};
     if(control.cards?.length)action.cardId=control.cards[0].id;
     if(control.directions?.length)action.direction=control.directions[0];
     if(control.id==='false_hint'){
      const wire=wires(own).find(w=>typeof w.value==='number'&&!w.clue&&!w.excluded&&!w.reversed);
      assert.ok(wire,`${id}/${count} false hint available`);action.wireIds=[wire.id];action.value=wire.value===1?2:1;
     } else if(control.id==='absent_hint') {
      const rack=own.racks.find(r=>r.id===control.rackIds[0]);action.rackId=rack.id;const key=own.racks.length===1?actor:rack.id;const used=(view.campaign?.cards||[]).filter(c=>c.id.startsWith(`absent-${key}-`)).map(c=>c.label.split(' ')[0]);action.value=[1,2,3,4,5,6,7,8,9,10,11,12,'yellow'].find(value=>!rack.wires.some(w=>w.value===value)&&!used.includes(value==='yellow'?'노랑':String(value)));
     }
     try{act(s,action,actor);}catch(error){throw new Error(`setup ${id}/${count} ${control.id}: ${error.message}`);}
    } else {
     const wire=wires(own).find(w=>typeof w.value==='number'&&!w.excluded&&!w.reversed&&w.value!==s.campaign.targetValue);
     assert.ok(wire,`${id}/${count} initial hint available`);
     try{act(s,{type:'hint',wireId:wire.id},actor);}catch(error){throw new Error(`setup ${id}/${count} hint: ${error.message}`);}
    }
   }
   assert.equal(s.phase,'playing',`setup did not finish ${id}/${count}`);
  }
 }
});

test('sequence 9 rejects a later card until the first pair is cut',()=>{
 const s=fixture(9,[[2,3,8],[2,3,9],[4,10]]);s.campaign.numbers=[2,3,4];
 reject(s,{type:'dual',ownWireId:'w0-1',targetPlayerId:'p1',targetWireIds:['w1-1']});
 dual(s,'w0-0','w1-0');assert.deepEqual(s.campaign.numbers,[3,4]);
});
test('sequence 16 requires all four copies before advancing',()=>{
 const s=fixture(16,[[2,3],[2,3],[2,2,4]]);s.campaign.numbers=[2,3,4];
 dual(s,'w0-0','w1-0');assert.deepEqual(s.campaign.numbers,[2,3,4]);
});
test('mission 11 treats the target number as an explosive red wire',()=>{
 const s=fixture(11,[[2,8],[3,9],[4,10]]);s.campaign.targetValue=3;
 dual(s,'w0-0','w1-0');assert.equal(s.outcome,'lost');
});
test('mission 11 cannot solo-cut or label the number treated as red',()=>{
 const s=fixture(11,[[3,3,8],[2,9],[4,10]],[4]);s.campaign.targetValue=3;
 reject(s,{type:'solo',value:3});
 reject(s,{type:'equipment',equipmentId:4,wireIds:['w0-0']});
 assert.equal(s.players[0].racks[0].wires[0].cut,false);
});
test('parity failure publishes odd/even only, without a numeric hint',()=>{
 const s=fixture(21,[[2,8],[3,9],[4,10]]);dual(s,'w0-0','w1-0');
 const wire=all(s).find(w=>w.id==='w1-0');assert.deepEqual(wire.clue,{kind:'parity',value:'odd'});assert.equal(wire.hint,null);
 const visible=engine.getPlayerView(s,'p0').players[1].racks[0].wires[0];assert.equal(visible.value,null);assert.equal(visible.hint,null);
 assert.ok(!s.log.some(line=>line.includes('3 정보')));
});
test('multiplicity clue counts already cut copies in the same rack',()=>{
 const s=fixture(24,[[2,8],[3,3,9],[4,10]]);s.players[1].racks[0].wires[1].cut=true;
 dual(s,'w0-0','w1-0');assert.deepEqual(all(s).find(w=>w.id==='w1-0').clue,{kind:'count',value:2});
});
test('mission 35 keeps X wires locked until all yellow wires are cut',()=>{
 const s=fixture(35,[[2,8],[2,9],[4,10,'yellow','yellow','yellow','yellow']]);s.players[0].racks[0].wires[0].excluded=true;
 reject(s,{type:'dual',ownWireId:'w0-0',targetPlayerId:'p1',targetWireIds:['w1-0']});
 all(s).filter(w=>w.value==='yellow').forEach(w=>w.cut=true);dual(s,'w0-0','w1-0');assert.ok(all(s).find(w=>w.id==='w0-0').cut);
});
test('global constraints reject illegal cuts without changing state',()=>{
 const s=fixture(32,[[3,8],[3,9],[4,10]]);s.campaign.globalConstraint='A';
 reject(s,{type:'dual',ownWireId:'w0-0',targetPlayerId:'p1',targetWireIds:['w1-0']});
 s.campaign.globalConstraint='B';dual(s,'w0-0','w1-0');assert.ok(all(s).find(w=>w.id==='w0-0').cut);
});
test('H suppresses a failed hint and L doubles the acting player mistake cost',()=>{
 const s=fixture(32,[[2,8],[3,9],[4,10]]);s.campaign.globalConstraint='H';dual(s,'w0-0','w1-0');
 assert.equal(all(s).find(w=>w.id==='w1-0').hint,null);assert.equal(all(s).find(w=>w.id==='w1-0').clue,undefined);
 const l=fixture(32,[[2,8],[3,9],[4,10]]);l.campaign.globalConstraint='L';dual(l,'w0-0','w1-0');assert.equal(l.mistakes,2);
});
test('mission 44 pays bands from shared oxygen and rejects an unfunded cut',()=>{
 const s=fixture(44,[[5,8],[5,9],[4,10]]);s.campaign.oxygenPool=1;
 reject(s,{type:'dual',ownWireId:'w0-0',targetPlayerId:'p1',targetWireIds:['w1-0']});
 s.campaign.oxygenPool=4;dual(s,'w0-0','w1-0');assert.equal(s.campaign.oxygenPool,2);assert.equal(s.campaign.oxygen.p0,2);
});
test('mission 53 replaces ordinary failure dial movement with nano movement',()=>{
 const s=fixture(53,[[2,8],[3,9],[4,10]]);s.campaign.nano.position=4;dual(s,'w0-0','w1-0');
 assert.equal(s.campaign.nano.position,6);assert.equal(s.mistakes,0);
 const edge=fixture(53,[[2,8],[3,9],[4,10]]);edge.campaign.nano.position=10;dual(edge,'w0-0','w1-0');assert.equal(edge.outcome,'lost');
});

test('secret role 34 reveals only each recipient own role and constraint',()=>{
 const s=fixture(34);s.campaign.secretRoleId='p1';s.campaign.secretRevealed=false;s.campaign.constraints={p0:'A',p1:'B',p2:'C'};
 for(const id of ['p0','p1','p2',undefined]){
  const view=engine.getPlayerView(s,id).campaign;
  const roles=view.cards.filter(c=>c.id==='secret-role');assert.equal(roles.length,id?1:0);
  if(id)assert.equal(roles[0].label.includes('약한 고리'),id==='p1');
  const constraints=view.cards.filter(c=>c.id.startsWith('constraint-'));assert.equal(constraints.length,id?1:0);
  assert.ok(constraints.every(c=>c.ownerId===id));
 }
});
test('hidden prediction 29 never sends another player card values or the chosen prediction',()=>{
 const s=fixture(29);s.campaign.playerNumbers={p0:[1,2],p1:[5,8],p2:[9,12]};s.campaign.prediction=5;s.campaign.predictionOwnerId='p1';
 for(const id of ['p0','p1','p2',undefined]){
  const view=engine.getPlayerView(s,id).campaign;
  assert.equal(view.prediction,undefined);assert.equal(view.predictionOwnerId,undefined);
  assert.ok(view.cards.filter(c=>c.id.includes('-number-')).every(c=>c.ownerId===id));
 }
});
test('mission 43 reserve stays private and must be taken before the turn advances',()=>{
 const s=fixture(43,[[2,8],[2,9],[4,10]]);s.campaign.nano={position:2,direction:1,reserve:[{id:'PRIVATE-NANO',value:12,sortValue:12,cut:false,hint:null}]};
 dual(s,'w0-0','w1-0');assert.equal(s.campaign.pending.operation,'take_nano_wire');assert.equal(s.currentPlayerId,'p0');
 assert.ok(!JSON.stringify(engine.getPlayerView(s,'p1')).includes('PRIVATE-NANO'));
 command(s,'take_nano_wire',{rackId:'r0'});assert.equal(s.campaign.nano.reserve.length,0);assert.equal(s.currentPlayerId,'p1');
 assert.equal(all(s).find(w=>w.id==='PRIVATE-NANO').value,12);
 const targetView=engine.getPlayerView(s,'p1').players[0].racks[0].wires.find(w=>w.id==='PRIVATE-NANO');assert.equal(targetView.value,null);
});
test('mission 49 transfers exact oxygen to one teammate before any cut, once per turn',()=>{
 const s=fixture(49,[[2,8],[2,9],[4,10]]);s.campaign.oxygen={p0:4,p1:4,p2:4};
 reject(s,{type:'dual',ownWireId:'w0-0',targetPlayerId:'p1',targetWireIds:['w1-0']});
 command(s,'pay_oxygen',{value:2,targetPlayerId:'p2'});assert.deepEqual(s.campaign.oxygen,{p0:2,p1:4,p2:6});
 reject(s,{type:'mission',operation:'pay_oxygen',value:2,targetPlayerId:'p2'});
 dual(s,'w0-0','w1-0');assert.equal(s.campaign.oxygen.p0,2);
});
test('I/J must allow passing when every other rack has only its forbidden edge and no solo exists',()=>{
 const s=fixture(32,[[2],[3],[4]]);s.campaign.globalConstraint='I';
 command(s,'pass');assert.equal(s.currentPlayerId,'p1');assert.equal(s.mistakes,0);
});
test('a chosen personal radar is once per player and cannot impersonate another personal device',()=>{
 const s=fixture(55);s.players[0].personalEquipmentId=8;
 reject(s,{type:'equipment',equipmentId:3,personal:true});
 act(s,{type:'equipment',equipmentId:8,personal:true,value:2});assert.equal(s.players[0].detectorUsed,true);
 assert.equal(s.equipment.length,0);assert.equal(s.radarResults.at(-1).value,2);
 reject(s,{type:'equipment',equipmentId:8,personal:true,value:3});
});
test('single-wire label includes already cut duplicates but only examines its own rack',()=>{
 const s=fixture(55,[[2,2,8],[3,9],[4,10]],[14]);s.players[0].racks[0].wires[1].cut=true;
 reject(s,{type:'equipment',equipmentId:14,wireIds:['w0-0']});
 act(s,{type:'equipment',equipmentId:14,wireIds:['w0-2']});assert.equal(all(s).find(w=>w.id==='w0-2').singleLabel,true);
 const view=engine.getPlayerView(s,'p1').players[0].racks[0].wires[2];assert.equal(view.value,null);assert.equal(view.singleLabel,true);
});
test('fast pass cuts a private pair even when the same number remains with teammates',()=>{
 const s=fixture(55,[[2,2,8],[2,9],[2,10]],[16]);s.campaign.challenges=[];
 act(s,{type:'equipment',equipmentId:16,value:2,wireIds:['w0-0','w0-1']});
 assert.ok(s.players[0].racks[0].wires.slice(0,2).every(w=>w.cut));assert.ok(!s.players[1].racks[0].wires[0].cut);assert.equal(s.currentPlayerId,'p1');
});
test('grappling hook moves a hidden wire with visible positions and no turn cost',()=>{
 const s=fixture(55,[[2,8],[3,9],[4,10]],[18]);
 act(s,{type:'equipment',equipmentId:18,targetPlayerId:'p1',wireIds:['w1-0']});
 assert.deepEqual(s.players[0].racks[0].wires.map(w=>w.value),[2,3,8]);assert.equal(s.currentPlayerId,'p0');
 const outside=engine.getPlayerView(s,'p2');assert.equal(outside.players[0].racks[0].wires[1].value,null);assert.equal(outside.lastExchange[0].wireId,'w1-0');
});

test('captain failure is fatal while another player pays a normal mistake',()=>{
 const s=fixture(14,[[2,8],[3,9],[4,10]]);dual(s,'w0-0','w1-0');assert.equal(s.outcome,'lost');
 const other=fixture(14,[[2,8],[3,9],[4,10]]);other.currentPlayerId='p1';dual(other,'w1-0','w0-0','p1');assert.equal(other.outcome,null);assert.equal(other.mistakes,1);
});
test('reverse wires hide from their owner and wrong own declaration explodes immediately',()=>{
 const s=fixture(56,[[2,8],[3,9],[4,10]]);s.players[0].racks[0].wires[0].reversed=true;
 assert.equal(engine.getPlayerView(s,'p0').players[0].racks[0].wires[0].value,null);
 assert.equal(engine.getPlayerView(s,'p1').players[0].racks[0].wires[0].value,2);
 assert.equal(engine.getPlayerView(s).players[0].racks[0].wires[0].value,null);
 act(s,{type:'dual',ownWireId:'w0-0',guess:3,targetPlayerId:'p1',targetWireIds:['w1-0']});assert.equal(s.outcome,'lost');
});
test('ordinary solo cannot reveal a reversed own value through different error responses',()=>{
 const s=fixture(56,[[2,2,8],[3,9],[4,10]]);s.players[0].racks[0].wires[0].reversed=true;
 const before=structuredClone(s);const messages=new Set();
 for(const value of [...Array.from({length:12},(_,i)=>i+1),'yellow']){
  assert.throws(()=>act(s,{type:'solo',value}),error=>{messages.add(error.message);return true;});
  assert.deepEqual(s,before);
 }
 assert.equal(messages.size,1);
});
test('X wires are ignored by super detector even when their number matches',()=>{
 const s=fixture(20,[[2,8],[2,3],[4,10]],[5]);s.players[1].racks[0].wires[0].excluded=true;
 act(s,{type:'equipment',equipmentId:5});dual(s,'w0-0','w1-1');
 assert.deepEqual(s.pendingDetector.eligibleWireIds,['w1-1']);assert.equal(s.pendingDetector.success,false);
 act(s,{type:'resolve_detector',wireId:'w1-1'},'p1');assert.equal(s.mistakes,1);assert.equal(all(s).find(w=>w.id==='w1-0').cut,false);
});
test('detector with I may use the interior candidate while excluding the prohibited right edge',()=>{
 const s=fixture(32,[[2,8],[2,2],[4,10]]);s.campaign.globalConstraint='I';
 act(s,{type:'dual',ownWireId:'w0-0',targetPlayerId:'p1',targetWireIds:['w1-0','w1-1'],useDetector:true});
 assert.deepEqual(s.pendingDetector.eligibleWireIds,['w1-0']);
 reject(s,{type:'resolve_detector',wireId:'w1-1'},'p1');act(s,{type:'resolve_detector',wireId:'w1-0'},'p1');
 assert.equal(all(s).find(w=>w.id==='w1-1').cut,false);
});
test('X/Y cannot resolve an alternative value that violates the active constraint',()=>{
 const s=fixture(32,[[2,3,8],[3,9],[4,10]],[10]);s.campaign.globalConstraint='A';
 act(s,{type:'equipment',equipmentId:10});
 const action={type:'dual',ownWireId:'w0-0',alternativeWireId:'w0-1',targetPlayerId:'p1',targetWireIds:['w1-0']};
 try {
  act(s,action);
  if(s.pendingDetector) {
   try{act(s,{type:'resolve_detector',wireId:'w1-0'},'p1');}catch{}
  }
 } catch {}
 assert.equal(all(s).find(w=>w.id==='w0-1').cut,false);assert.equal(all(s).find(w=>w.id==='w1-0').cut,false);
});
