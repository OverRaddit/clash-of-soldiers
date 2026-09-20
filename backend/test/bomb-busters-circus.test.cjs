const test=require('node:test');const assert=require('node:assert/strict');
const {beginCircusEvent,applyCircusCommand,circusControls,afterCircusCut}=require('../dist/game-room/bomb-busters/audio-circus');
function fixture(){
 const s={captainId:'p0',currentPlayerId:'p0',phase:'playing',mistakes:0,maxMistakes:3,log:[],relationMarkers:[],radarResults:[],lastExchange:[],campaign:{turn:null},
 players:[0,1,2].map(i=>({id:`p${i}`,name:`P${i}`,racks:[{id:`r${i}`,wires:[{id:`w${i}a`,value:2,cut:true,hint:2,clue:{kind:'value',value:2}},{id:`w${i}b`,value:i+4,cut:false,hint:null}]}]})),
 audio:{missionId:42,status:'paused',pending:{kind:'ack',actorId:'p0'},notices:[],taDaRequired:false,lastCutActorId:null,lastCutAnnounced:true,removedCutWireIds:[]}};
 const api={endTurn(state){state.currentPlayerId=`p${(Number(state.currentPlayerId.slice(1))+1)%3}`;},finish(state,outcome,reason){state.phase='finished';state.outcome=outcome;state.endReason=reason;}};
 return {s,api};
}
test('circus magician restores a same-value pair privately, clears hints and advances once',()=>{
 const {s,api}=fixture();beginCircusEvent(s,'magician',api);assert.equal(s.audio.pending.kind,'magician');assert.equal(s.audio.hideCutCounts,true);
 assert.equal(circusControls(s,'p1').length,0);assert.equal(circusControls(s,'p0')[0].wireSelection.onlyCut,true);
 assert.throws(()=>applyCircusCommand(s,s.players[1],{type:'mission',operation:'audio_magician',wireIds:['w0a','w1a']},api));
 applyCircusCommand(s,s.players[0],{type:'mission',operation:'audio_magician',wireIds:['w0a','w1a']},api);
 assert.equal(s.players[0].racks[0].wires[0].cut,false);assert.equal(s.players[1].racks[0].wires[0].cut,false);
 assert.equal(s.players[0].racks[0].wires[0].hint,null);assert.equal(s.players[0].racks[0].wires[0].clue,undefined);
 assert.equal(s.currentPlayerId,'p1');assert.deepEqual(s.audio.pending,{kind:'ack',actorId:'p0'});
 assert.ok(!s.log.join(' ').includes('w0a'));assert.ok(!s.log.join(' ').includes('2'));
});
test('knife preserves removed cut tiles for inventory but removes them from future magician choices',()=>{
 const {s,api}=fixture();const before=s.players.flatMap(p=>p.racks.flatMap(r=>r.wires)).length;
 beginCircusEvent(s,'knife',api);assert.deepEqual(s.audio.removedCutWireIds,['w0a']);
 assert.equal(s.players.flatMap(p=>p.racks.flatMap(r=>r.wires)).length,before);
 beginCircusEvent(s,'magician',api);
 assert.throws(()=>applyCircusCommand(s,s.players[0],{type:'mission',operation:'audio_magician',wireIds:['w0a','w1a']},api));
});
test('a magician event without a restorable pair still advances the turn',()=>{
 const {s,api}=fixture();s.players.forEach(p=>p.racks[0].wires.forEach(w=>w.cut=false));
 beginCircusEvent(s,'magician',api);
 assert.equal(s.currentPlayerId,'p1');assert.equal(s.audio.pending.kind,'ack');
});
test('seat rotation skips the current player when the received stand is empty',()=>{
 const {s,api}=fixture();s.players[1].racks[0].wires.forEach(w=>w.cut=true);
 beginCircusEvent(s,'rotate_left',api);
 assert.equal(s.currentPlayerId,'p1');assert.ok(s.players[1].racks[0].wires.some(w=>!w.cut));
 assert.equal(s.audio.pending.kind,'ack');
});
test('circus seat rotation moves whole stands, preserves actor identity, and reverses cleanly',()=>{
 const {s,api}=fixture();s.players[0].racks.push({id:'captain-extra',wires:[]});const racks=s.players.map(p=>p.racks);
 beginCircusEvent(s,'rotate_left',api);assert.equal(s.currentPlayerId,'p0');assert.equal(s.players[0].racks,racks[1]);assert.equal(s.players[2].racks,racks[0]);
 beginCircusEvent(s,'rotate_right',api);assert.deepEqual(s.players.map(p=>p.racks),racks);
});
test('juggling swaps only own different already-cut wires and keeps the current player',()=>{
 const {s,api}=fixture();s.players[0].racks[0].wires[1].cut=true;beginCircusEvent(s,'juggler',api);
 assert.throws(()=>applyCircusCommand(s,s.players[0],{type:'mission',operation:'audio_juggler',wireIds:['w0a','w1a']},api));
 applyCircusCommand(s,s.players[0],{type:'mission',operation:'audio_juggler',wireIds:['w0a','w0b']},api);
 assert.deepEqual(s.players[0].racks[0].wires.map(w=>w.id),['w0b','w0a']);assert.equal(s.currentPlayerId,'p0');
});
test('trampoline acknowledgement proceeds from the current player around the whole table',()=>{
 const {s,api}=fixture();s.currentPlayerId='p1';beginCircusEvent(s,'boing',api);
 for(const id of ['p1','p2','p0']){
  assert.equal(s.audio.pending.actorId,id);applyCircusCommand(s,s.players.find(p=>p.id===id),{type:'mission',operation:'audio_boing'},api);
 }
 assert.equal(s.audio.pending.kind,'ack');assert.equal(s.log.length,3);
});
test('only the last cutter can claim the completion shout and checkpoint penalizes an omission',()=>{
 const {s,api}=fixture();beginCircusEvent(s,'ta_da',api);afterCircusCut(s,'p1');
 assert.throws(()=>applyCircusCommand(s,s.players[0],{type:'mission',operation:'audio_ta_da'},api));
 applyCircusCommand(s,s.players[1],{type:'mission',operation:'audio_ta_da'},api);beginCircusEvent(s,'check_ta_da',api);assert.equal(s.mistakes,0);
 afterCircusCut(s,'p2');beginCircusEvent(s,'check_ta_da',api);assert.equal(s.mistakes,1);
 s.mistakes=2;beginCircusEvent(s,'check_ta_da',api);assert.equal(s.outcome,'lost');
});
