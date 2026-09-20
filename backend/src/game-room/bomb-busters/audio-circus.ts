import type { BombBustersState, BombPlayer, BombWire } from '../entities/bomb-busters-game-state.entity';
import type { BombAudioState } from './audio-state';
import type { BombCampaignApi } from './campaign-runtime';
import type { BombMissionCommand, BombMissionControl } from './campaign-state';

type State = BombBustersState & { audio?: BombAudioState };
const wires = (p: BombPlayer) => p.racks.flatMap(r => r.wires);
const all = (s: State) => s.players.flatMap(wires);
const availableCut = (s: State, w: BombWire) => w.cut && !s.audio.removedCutWireIds?.includes(w.id);
const acknowledge = (s: State) => { s.audio.pending = { kind: 'ack', actorId: s.captainId }; };
const actor = (s: State) => s.players.find(p => p.id === s.currentPlayerId);

function cleanRelations(s: State) {
  s.relationMarkers = s.relationMarkers.filter(marker => {
    const rack = s.players.flatMap(p => p.racks).find(r => r.id === marker.rackId);
    const indices = marker.wireIds.map(id => rack?.wires.findIndex(w => w.id === id) ?? -1);
    return indices.every(i => i >= 0) && Math.abs(indices[0]-indices[1]) === 1;
  });
}

/** Timed event effects are separate from the shared clock and instruction acknowledgement. */
export function beginCircusEvent(s: State, kind: string, api: BombCampaignApi): void {
  if (s.audio?.missionId !== 42) return;
  const a=s.audio;
  if (kind==='magician') {
    a.hideCutCounts=true;
    const candidates=all(s).filter(w=>availableCut(s,w));
    if (candidates.some(w=>candidates.filter(other=>other.value===w.value).length>=2)) a.pending={kind:'magician',actorId:s.currentPlayerId};
    else {
      a.notices.push('복구할 같은 값의 절단 전선 한 쌍이 없어 마술을 건너뜁니다.');
      if(s.campaign)s.campaign.turn=null;
      a.pending=null;api.endTurn(s);acknowledge(s);
    }
  } else if (kind==='juggler') {
    const candidates=wires(actor(s)).filter(w=>availableCut(s,w));
    if(new Set(candidates.map(w=>w.value)).size>=2) a.pending={kind:'juggler',actorId:s.currentPlayerId};
    else a.notices.push('서로 다른 값의 절단 전선 두 개가 없어 저글링을 건너뜁니다.');
  } else if (kind==='rotate_left'||kind==='rotate_right') {
    const racks=s.players.map(p=>p.racks);const offset=kind==='rotate_left'?1:s.players.length-1;
    s.players.forEach((p,i)=>{p.racks=racks[(i+offset)%s.players.length];});
    // Markers move with the stand. Character cards and the acting identity stay with people.
    s.relationMarkers.forEach(marker=>{marker.playerId=s.players.find(p=>p.racks.some(r=>r.id===marker.rackId)).id;});
    s.radarResults=[];s.lastExchange=[];
    s.log.push(kind==='rotate_left'?'모두 왼쪽 자리의 받침대로 이동했습니다.':'모두 오른쪽 자리의 받침대로 이동했습니다.');
    if(wires(actor(s)).every(w=>w.cut)) {
      if(s.campaign)s.campaign.turn=null;
      a.pending=null;api.endTurn(s);acknowledge(s);
    }
  } else if(kind==='knife') {
    a.removedCutWireIds=[...new Set([...(a.removedCutWireIds??[]),...wires(actor(s)).filter(w=>w.cut).map(w=>w.id)])];
    s.log.push(`${actor(s).name}님의 절단 전선을 받침대에서 치웠습니다.`);
  } else if(kind==='ta_da') {
    a.taDaRequired=true;a.lastCutAnnounced=true;
  } else if(kind==='remove_validation') {
    a.validationTokensRemoved=true;a.hideCutCounts=true;
  } else if(kind==='check_ta_da') {
    if(a.lastCutActorId&&!a.lastCutAnnounced){s.mistakes++;s.log.push('직전 절단의 완료 구호가 없어 기폭기가 한 칸 전진했습니다.');}
    if(s.mistakes>=s.maxMistakes)api.finish(s,'lost','구호 점검으로 기폭기가 끝에 도달했습니다.');
  } else if(kind==='boing') {
    const index=s.players.findIndex(p=>p.id===s.currentPlayerId);
    const queue=[...s.players.slice(index),...s.players.slice(0,index)].map(p=>p.id);
    a.pending={kind:'boing',actorId:queue.shift(),queue};
  }
}

export function applyCircusCommand(s: State, p: BombPlayer, command: BombMissionCommand, api: BombCampaignApi): boolean {
  if(s.audio?.missionId!==42)return false;
  const a=s.audio;const operation=command.operation;
  if(operation==='audio_ta_da') {
    if(!a.taDaRequired||a.lastCutActorId!==p.id||a.lastCutAnnounced)throw new Error('마지막 절단을 한 대원만 완료 구호를 보낼 수 있습니다.');
    a.lastCutAnnounced=true;s.log.push(`${p.name}: 해체 완료!`);return true;
  }
  if(!['audio_magician','audio_juggler','audio_boing'].includes(operation))return false;
  const pending=a.pending;const expected=operation.replace('audio_','');
  if(!pending||pending.kind!==expected||pending.actorId!==p.id)throw new Error('지명된 대원만 서커스 행동을 할 수 있습니다.');
  if(operation==='audio_boing') {
    s.log.push(`${p.name}: 통통!`);
    if(pending.queue?.length)pending.actorId=pending.queue.shift();else acknowledge(s);
    return true;
  }
  const ids=command.wireIds;
  if(!Array.isArray(ids)||ids.length!==2||new Set(ids).size!==2)throw new Error('서로 다른 절단 전선 두 개를 선택하세요.');
  const selected=ids.map(id=>all(s).find(w=>w.id===id));
  if(selected.some(w=>!w||!availableCut(s,w)))throw new Error('아직 받침대에 놓인 절단 전선만 선택할 수 있습니다.');
  if(operation==='audio_magician') {
    if(selected[0].value!==selected[1].value)throw new Error('같은 값의 전선 한 쌍을 선택하세요.');
    selected.forEach(w=>{w.cut=false;w.hint=null;delete w.clue;delete w.singleLabel;});
    s.log.push(`${p.name}님이 마술로 전선 한 쌍을 비공개 복구했습니다.`);
    if(s.campaign)s.campaign.turn=null;
    // Resolve the forced turn change before replacing the event prompt with an acknowledgement.
    a.pending=null;api.endTurn(s);acknowledge(s);
  } else {
    if(selected.some(w=>!wires(p).includes(w))||selected[0].value===selected[1].value)throw new Error('자신의 서로 다른 값인 절단 전선 두 개를 선택하세요.');
    const slots=selected.map(w=>{const rack=p.racks.find(r=>r.wires.includes(w));return {rack,index:rack.wires.indexOf(w)};});
    slots[0].rack.wires[slots[0].index]=selected[1];slots[1].rack.wires[slots[1].index]=selected[0];
    cleanRelations(s);s.log.push(`${p.name}님이 절단 전선 두 개의 위치를 바꿨습니다.`);acknowledge(s);
  }
  return true;
}

export function circusControls(s: State, viewerId?: string): BombMissionControl[] {
  if(s.audio?.missionId!==42||!s.players.some(p=>p.id===viewerId))return [];
  const a=s.audio;const result:BombMissionControl[]=[];const pending=a.pending;
  if(a.taDaRequired&&a.lastCutActorId===viewerId&&!a.lastCutAnnounced)result.push({id:'audio_ta_da',label:'완료 구호 보내기'});
  if(pending?.actorId!==viewerId)return result;
  if(pending.kind==='boing')result.push({id:'audio_boing',label:'트램펄린 구호 보내기'});
  if(pending.kind==='magician'||pending.kind==='juggler')result.push({
    id:`audio_${pending.kind}`,label:pending.kind==='magician'?'같은 값 한 쌍 복구':'내 절단 전선 두 개 위치 교환',
    wireSelection:{owner:pending.kind==='magician'?'all':'self',min:2,max:2,allowCut:true,onlyCut:true} as BombMissionControl['wireSelection'],
  });
  return result;
}

/** Invoke only after a successful cut, not after a pass, equipment use or a failed guess. */
export function afterCircusCut(s: State, actorId: string): void {
  if(s.audio?.missionId!==42||!s.audio.taDaRequired)return;
  s.audio.lastCutActorId=actorId;s.audio.lastCutAnnounced=false;
}
