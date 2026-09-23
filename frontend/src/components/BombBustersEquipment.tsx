import React, { useEffect, useState } from 'react';
import { bombSelectionRevision } from '../utils/bomb-selection-revision';
import { BombBustersAction, BombBustersClientState, BombEquipment } from '../types/bomb-busters.types';

interface Props {
  state: BombBustersClientState;
  playerId: string;
  disabled: boolean;
  onAction: (action: BombBustersAction) => void;
  onSelectRelation: (equipmentId: 1 | 12) => void;
}

/** Forms only expose the viewer's own values and public equipment information. */
const BombBustersEquipment: React.FC<Props> = ({ state, playerId, disabled, onAction, onSelectRelation }) => {
  const selectionRevision = bombSelectionRevision(state);
  const [postItWire, setPostItWire] = useState('');
  const [falsePostItValue, setFalsePostItValue] = useState('');
  const [batteryTargets, setBatteryTargets] = useState<string[]>([]);
  const [exchangeTarget, setExchangeTarget] = useState('');
  const [coffeeTarget, setCoffeeTarget] = useState('');
  const [radarValue, setRadarValue] = useState('');
  const [singleWire, setSingleWire] = useState('');
  const [fastPassValue, setFastPassValue] = useState('');
  const [grabPlayer, setGrabPlayer] = useState('');
  const [grabWire, setGrabWire] = useState('');
  const [receivingRack, setReceivingRack] = useState('');
  useEffect(() => {
    setPostItWire('');
    setFalsePostItValue('');
    setBatteryTargets([]);
    setExchangeTarget('');
    setCoffeeTarget('');
    setRadarValue('');
    setSingleWire('');
    setFastPassValue('');
    setGrabPlayer('');
    setGrabWire('');
    setReceivingRack('');
  }, [selectionRevision]);
  const me = state.players.find((player) => player.id === playerId);
  const ownRemaining = me?.racks.flatMap((rack) => rack.wires).filter((wire) => !wire.cut && !wire.reversed && !wire.excluded) || [];
  const ownValues = new Set(ownRemaining.map((wire) => wire.value).filter((value) => value !== null && value !== 'red' && !state.campaign?.redValues?.includes(value)));
  const ownBlueValues = new Set(Array.from(ownValues).filter((value) => typeof value === 'number'));
  const postItSelected = ownRemaining.find((wire) => wire.id === postItWire);
  const isMyTurn = state.currentPlayerId === playerId;
  const detectorArmed = state.superDetectorActive || state.tripleDetectorActive;
  const anyoneArmed = detectorArmed || state.xyRayActive || state.stabilizerActive;
  const coffeeTargets = state.players.filter((player) => player.racks.some((rack) => rack.wires.some((wire) => !wire.cut)));
  const possibleTargets = state.players.filter((player) => player.id !== playerId && player.racks.some((rack) => rack.wires.some((wire) => !wire.cut)));
  const hasRelationPair = (equal: boolean) => me?.racks.some((rack) => rack.wires.some((wire, index) => {
    const next = rack.wires[index + 1];
    return next && !wire.reversed && !next.reversed && !wire.excluded && !next.excluded && (!wire.cut || !next.cut) && wire.value !== null && next.value !== null && (wire.value === next.value) === equal;
  }));
  const personalNames: Record<number, [string, string]> = {
    2: ['개인 무전기', '동료 한 명과 전선을 하나씩 비공개로 교환합니다.'],
    3: ['개인 트리플 탐지기', '내 차례에 동료 받침대의 전선 세 개를 탐지합니다.'],
    8: ['개인 전체 레이더', '선택한 숫자를 각 받침대가 가지고 있는지 공개합니다.'],
    10: ['개인 X/Y 광선', '내가 가진 두 가지 값으로 동료의 전선 한 개를 추측합니다.'],
  };
  const personalId = me?.personalEquipmentId;
  const equipmentCards: (BombEquipment & { personal?: boolean })[] = personalId && personalNames[personalId]
    ? [{ id: personalId, name: personalNames[personalId][0], description: personalNames[personalId][1], unlocked: true, used: me!.detectorUsed, personal: true }, ...state.equipment]
    : state.equipment;
  const postItMayCut = [24, 40].includes(state.mission.id);
  const grabTarget = state.players.find((player) => player.id === grabPlayer);
  if (!equipmentCards.length) return null;
  return <section className="bb-equipment" aria-label="공용 장비">
    <h2>{personalId ? '개인·공용 장비' : '공용 장비'}</h2>
    <p>개인 장비는 나만 사용합니다. 공용 장비의 잠금 해제 조건은 각 카드에 표시됩니다. 추가 장비의 ‘자동’ 효과는 조건을 충족하면 즉시 처리됩니다.</p>
    {equipmentCards.some((equipment) => [3, 5, 9, 10].includes(equipment.id) && !equipment.used) && <p>협력 해체용 장비는 준비만 해두면 소모되지 않습니다. 협력 해체를 실행할 때 사용되며, 실행 전에는 위 행동 패널에서 준비를 모두 취소할 수 있습니다.</p>}
    <div className="bb-equipment-grid">{equipmentCards.map((equipment) => {
      const isPrepared = !!state.preparedEquipment?.some((prepared) => prepared.equipmentId === equipment.id
        && prepared.personal === !!equipment.personal && (!equipment.personal || prepared.playerId === playerId));
      const isDualPreparation = [3, 5, 9, 10].includes(equipment.id);
      const roleRestriction = state.captainId === playerId && !equipment.personal && [17, 28].includes(state.mission.id)
        ? '이번 미션의 대장은 공용 장비를 직접 사용할 수 없습니다.'
        : state.captainId === playerId && state.mission.id === 14 && equipment.id === 9
          ? '신입은 이번 미션에서 안정기를 사용할 수 없습니다.' : null;
      const available = !disabled && equipment.unlocked && !equipment.used && !isPrepared && !roleRestriction;
      const needsOwnTurn = [3, 5, 9, 10, 11, 16].includes(equipment.id);
      const canPrepareLaserStabilizer = equipment.id === 9 && !!state.campaign?.audio?.controls.some((control) => control.id === 'audio_laser');
      const hasPreparationTarget = state.players.some((player) => player.id !== playerId && player.racks.some((rack) => rack.wires.filter((wire) => !wire.cut && !wire.excluded).length >= (equipment.id === 3 ? 2 : 1)));
      const hasPreparationValues = equipment.id === 10 ? (detectorArmed ? ownBlueValues.size : ownValues.size) >= 2
        : [3, 5].includes(equipment.id) ? ownBlueValues.size >= (state.xyRayActive ? 2 : 1)
          : ownValues.size > 0;
      const ready = available && ![13, 15, 17].includes(equipment.id) && (!needsOwnTurn || isMyTurn)
        && (!isDualPreparation || canPrepareLaserStabilizer || (hasPreparationValues && hasPreparationTarget))
        && (![3, 5].includes(equipment.id) || !detectorArmed)
        && (equipment.id !== 10 || !state.xyRayActive)
        && (equipment.id !== 9 || !state.stabilizerActive)
        && (equipment.id !== 1 || hasRelationPair(false))
        && (equipment.id !== 12 || hasRelationPair(true))
        && (equipment.id !== 2 || (!!exchangeTarget && ownRemaining.length > 0))
        && (equipment.id !== 4 || (!!postItWire && (state.mission.id !== 52 || (!!falsePostItValue && Number(falsePostItValue) !== postItSelected?.value))))
        && (equipment.id !== 6 || state.mistakes > state.maxMistakes - 5)
        && (equipment.id !== 7 || batteryTargets.length > 0)
        && (equipment.id !== 8 || !!radarValue)
        && (equipment.id !== 11 || (!!coffeeTarget && !anyoneArmed))
        && (equipment.id !== 14 || !!singleWire)
        && (equipment.id !== 16 || (!!fastPassValue && !anyoneArmed))
        && (equipment.id !== 18 || (!!grabPlayer && !!grabWire && ((me?.racks.length ?? 0) === 1 || !!receivingRack)));
      const activate = () => {
        if (equipment.id === 1 || equipment.id === 12) {
          onSelectRelation(equipment.id);
          return;
        }
        onAction({ type: 'equipment', equipmentId: equipment.id, ...(equipment.personal ? { personal: true } : {}),
          wireIds: equipment.id === 4 ? [postItWire] : equipment.id === 14 ? [singleWire] : equipment.id === 18 ? [grabWire] : undefined,
          targetPlayerIds: equipment.id === 7 ? batteryTargets : undefined,
          targetPlayerId: equipment.id === 2 ? exchangeTarget : equipment.id === 11 ? coffeeTarget : equipment.id === 18 ? grabPlayer : undefined,
          value: equipment.id === 4 && state.mission.id === 52 ? Number(falsePostItValue) : equipment.id === 8 ? Number(radarValue) : equipment.id === 16 ? fastPassValue === 'yellow' ? 'yellow' : Number(fastPassValue) : undefined,
          rackId: equipment.id === 18 ? receivingRack || me?.racks[0]?.id : undefined,
        });
      };
      return <article className={`bb-equipment-card ${equipment.used ? 'used' : ''}`} key={`${equipment.personal ? 'personal-' : ''}${equipment.id}`}>
        <div><span className="bb-equipment-id">{equipment.personal ? '나' : equipment.unlock?.value === 'yellow' ? '노랑' : equipment.unlock ? `${equipment.unlock.value}${equipment.unlock.count === 4 ? '×4' : ''}` : equipment.id}</span><strong>{equipment.name}</strong><span className="bb-small-tag">{equipment.used ? '사용 완료' : isPrepared ? '준비됨' : equipment.unlocked ? '사용 가능' : '잠금'}</span></div>
        <p>{equipment.description}</p>
        {isPrepared && <p className="bb-equipment-help">이번 협력 해체에 사용할 준비가 되었습니다. 아직 소모되지 않았습니다.</p>}
        {!equipment.used && equipment.id === 10 && <p className="bb-equipment-help">더블·트리플·슈퍼 탐지기 중 하나와 함께 사용할 수 있습니다. 탐지기와 함께 쓰는 두 값은 모두 파란 숫자여야 합니다.</p>}
        {!equipment.used && [3, 5].includes(equipment.id) && <p className="bb-equipment-help">X/Y 광선·안정기와 함께 사용할 수 있습니다. 다른 탐지기와는 함께 사용하지 않습니다.</p>}
        {roleRestriction && <p className="bb-equipment-help">{roleRestriction}</p>}
        {!equipment.personal && equipment.unlock && <p className="bb-equipment-unlock">잠금 해제: {equipment.unlock.value === 'yellow' ? '노란' : `${equipment.unlock.value}번`} 전선 {equipment.unlock.count}개 해체</p>}
        {[13, 15, 17].includes(equipment.id) && <p className="bb-equipment-help">잠금 해제 즉시 자동으로 실행되는 장비입니다.</p>}
        {!equipment.used && equipment.id === 2 && <label className="bb-equipment-field">전선을 교환할 동료
          <select className="bb-equipment-select" aria-label={`${equipment.personal ? '개인 ' : ''}무전기로 전선을 교환할 동료`} value={exchangeTarget} disabled={!available || ownRemaining.length === 0} onChange={(event) => setExchangeTarget(event.target.value)}>
            <option value="">동료 선택</option>{possibleTargets.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select><small>두 사람이 각자 전선을 비공개로 고릅니다.</small>
        </label>}
        {!equipment.used && equipment.id === 4 && <select className="bb-equipment-select" aria-label="포스트잇 단서를 놓을 내 전선" value={postItWire} disabled={!available} onChange={(event) => { setPostItWire(event.target.value); setFalsePostItValue(''); }}>
          <option value="">단서를 놓을 내 파란 전선 선택</option>{me?.racks.flatMap((rack, rackIndex) => rack.wires.map((wire, index) => (!wire.cut || postItMayCut) && !wire.reversed && !wire.excluded && wire.hint === null && !wire.clue && typeof wire.value === 'number' && !state.campaign?.redValues?.includes(wire.value) ? <option key={wire.id} value={wire.id}>받침대 {rackIndex + 1} · {index + 1}번째 · 숫자 {wire.value}</option> : null))}
        </select>}
        {!equipment.used && equipment.id === 4 && state.mission.id === 52 && <label className="bb-equipment-field">이 전선과 다른 값의 거짓 단서
          <select className="bb-equipment-select" aria-label="포스트잇으로 공개할 거짓 값" value={falsePostItValue} disabled={!available || !postItWire} onChange={(event) => setFalsePostItValue(event.target.value)}><option value="">실제 값과 다른 숫자 선택</option>{Array.from({ length: state.mission.blueMax }, (_, index) => index + 1).filter((value) => value !== postItSelected?.value).map((value) => <option key={value} value={value}>≠ {value}</option>)}</select>
        </label>}
        {!equipment.used && equipment.id === 7 && <fieldset className="bb-battery-targets" disabled={!available}><legend>충전할 대원 1–2명</legend>
          {state.players.filter((player) => player.detectorUsed).map((player) => <label key={player.id}><input type="checkbox" checked={batteryTargets.includes(player.id)} disabled={!batteryTargets.includes(player.id) && batteryTargets.length >= 2} onChange={(event) => setBatteryTargets(event.target.checked ? [...batteryTargets, player.id] : batteryTargets.filter((id) => id !== player.id))} />{player.name}</label>)}
          {!state.players.some((player) => player.detectorUsed) && <small>아직 개인 장비를 사용한 대원이 없습니다.</small>}
        </fieldset>}
        {!equipment.used && equipment.id === 8 && <label className="bb-equipment-field">모든 받침대에서 찾을 숫자
          <select className="bb-equipment-select" aria-label={`${equipment.personal ? '개인 ' : ''}전체 레이더로 찾을 숫자`} value={radarValue} disabled={!available} onChange={(event) => setRadarValue(event.target.value)}>
            <option value="">숫자 선택</option>{Array.from({ length: state.mission.blueMax }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}
          </select><small>개수와 위치는 공개되지 않습니다.</small>
        </label>}
        {!equipment.used && equipment.id === 11 && <label className="bb-equipment-field">다음 차례를 맡길 대원
          <select className="bb-equipment-select" aria-label="커피잔으로 다음 차례를 맡길 대원" value={coffeeTarget} disabled={!available || !isMyTurn || !!anyoneArmed} onChange={(event) => setCoffeeTarget(event.target.value)}>
            <option value="">다음 대원 선택</option>{coffeeTargets.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}
          </select><small>그 대원부터 원래 순서대로 진행합니다.</small>
        </label>}
        {!equipment.used && equipment.id === 14 && <label className="bb-equipment-field">받침대에 그 값이 하나뿐인 내 전선
          <select className="bb-equipment-select" aria-label="단일 전선 표식을 놓을 전선" value={singleWire} disabled={!available} onChange={(event) => setSingleWire(event.target.value)}><option value="">전선 선택</option>
            {me?.racks.flatMap((rack, rackIndex) => rack.wires.map((wire, index) => typeof wire.value === 'number' && !wire.cut && !wire.reversed && !wire.excluded && rack.wires.filter((other) => other.value === wire.value).length === 1 ? <option key={wire.id} value={wire.id}>받침대 {rackIndex + 1} · {index + 1}번째 · 숫자 {wire.value}</option> : null))}
          </select>
        </label>}
        {!equipment.used && equipment.id === 16 && <label className="bb-equipment-field">내 전선 두 개를 해체할 값
          <select className="bb-equipment-select" aria-label="패스트패스로 해체할 값" value={fastPassValue} disabled={!available || !isMyTurn} onChange={(event) => setFastPassValue(event.target.value)}><option value="">값 선택</option>
            {Array.from(ownValues).filter((value) => ownRemaining.filter((wire) => wire.value === value).length >= 2).map((value) => <option key={String(value)} value={String(value)}>{value === 'yellow' ? '노랑' : value}</option>)}
          </select><small>동료에게 같은 값이 남아 있어도 사용할 수 있습니다.</small>
        </label>}
        {!equipment.used && equipment.id === 18 && <div className="bb-grappling-fields">
          <label className="bb-equipment-field">전선을 가져올 동료<select className="bb-equipment-select" aria-label="갈고리로 전선을 가져올 동료" value={grabPlayer} disabled={!available} onChange={(event) => { setGrabPlayer(event.target.value); setGrabWire(''); }}><option value="">동료 선택</option>{possibleTargets.map((player) => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
          <label className="bb-equipment-field">가져올 전선 위치<select className="bb-equipment-select" aria-label="갈고리로 가져올 전선 위치" value={grabWire} disabled={!available || !grabPlayer} onChange={(event) => setGrabWire(event.target.value)}><option value="">전선 위치 선택</option>{grabTarget?.racks.flatMap((rack, rackIndex) => rack.wires.map((wire, index) => !wire.cut && !wire.excluded && !wire.reversed ? <option key={wire.id} value={wire.id}>받침대 {rackIndex + 1} · {index + 1}번째</option> : null))}</select></label>
          {(me?.racks.length ?? 0) > 1 && <label className="bb-equipment-field">받을 내 받침대<select className="bb-equipment-select" aria-label="갈고리 전선을 받을 내 받침대" value={receivingRack} disabled={!available} onChange={(event) => setReceivingRack(event.target.value)}><option value="">받침대 선택</option>{me?.racks.map((rack, index) => <option key={rack.id} value={rack.id}>내 받침대 {index + 1}</option>)}</select></label>}
        </div>}
        {!equipment.used && equipment.id === 10 && !hasPreparationValues && <p className="bb-equipment-help">{detectorArmed ? '탐지기와 함께 쓰려면 서로 다른 파란 전선 두 종류가 필요합니다.' : '서로 다른 값의 전선 두 종류가 필요합니다.'}</p>}
        {!equipment.used && [3, 5].includes(equipment.id) && state.xyRayActive && ownBlueValues.size < 2 && <p className="bb-equipment-help">X/Y 광선과 함께 쓰려면 서로 다른 파란 전선 두 종류가 필요합니다.</p>}
        {!equipment.used && [1, 12].includes(equipment.id) && <p className="bb-equipment-help">내 받침대에서 인접한 전선 두 개를 선택합니다.</p>}
        <button className="bb-button bb-button-quiet" disabled={!ready} onClick={activate}>{isPrepared ? '준비됨' : [13, 15, 17].includes(equipment.id) ? '자동 효과' : [1, 12].includes(equipment.id) ? '표식 위치 고르기' : equipment.id === 2 ? '비공개 교환 시작' : equipment.id === 11 ? '선택한 대원에게 차례 넘기기' : equipment.id === 16 ? '선택한 값의 전선 2개 해체' : needsOwnTurn ? '이번 차례에 장비 준비' : '장비 사용'}</button>
      </article>;
    })}</div>
  </section>;
};

export default BombBustersEquipment;
