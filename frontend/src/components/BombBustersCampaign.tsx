import React, { useEffect, useMemo, useState } from 'react';
import BombBustersBunker from './BombBustersBunker';
import BombBustersAudio from './BombBustersAudio';
import useServerClock from '../hooks/useServerClock';
import { BombBustersAction, BombBustersClientState, BombCampaignControl, BombWireValue } from '../types/bomb-busters.types';

interface Props {
  state: BombBustersClientState;
  playerId: string;
  disabled: boolean;
  activeControl: BombCampaignControl | null;
  wireIds: string[];
  onControlChange: (id: string | null) => void;
  onAction: (action: BombBustersAction) => void;
}
const valueLabel = (value: BombWireValue) => value === 'yellow' ? '노랑' : value === 'red' ? '빨강' : String(value);
const directionLabel = (direction: string) => ({ add: '더하기 (+)', subtract: '빼기 (−)', left: '← 왼쪽', right: '오른쪽 →', cw: '시계 방향 ↻', ccw: '반시계 방향 ↺', clockwise: '시계 방향 ↻', counterclockwise: '반시계 방향 ↺', keep: '현재 방향 유지', reverse: '반대 방향', north: '↑ 북쪽', east: '동쪽 →', south: '↓ 남쪽', west: '← 서쪽', give: '산소 주기', take: '산소 받기', action: '행동 조건' }[direction] || direction);

const BombBustersCampaign: React.FC<Props> = ({ state, playerId, disabled, activeControl, wireIds, onControlChange, onAction }) => {
  const panel = state.campaign;
  const controlSignature = JSON.stringify(activeControl);
  const stableControl = useMemo<BombCampaignControl | null>(() => JSON.parse(controlSignature), [controlSignature]);
  const [value, setValue] = useState('');
  const [cards, setCards] = useState<string[]>([]);
  const [targetPlayer, setTargetPlayer] = useState('');
  const [direction, setDirection] = useState('');
  const [rack, setRack] = useState('');
  const now = useServerClock(state.serverNow, !!panel?.deadlineAt);
  useEffect(() => {
    setValue(stableControl?.values?.length === 1 ? String(stableControl.values[0]) : '');
    setCards(stableControl?.cards?.length === 1 ? [stableControl.cards[0].id] : []);
    setTargetPlayer(stableControl?.playerIds?.length === 1 ? stableControl.playerIds[0] : '');
    setDirection(stableControl?.directions?.length === 1 ? stableControl.directions[0] : '');
    setRack(stableControl?.rackIds?.length === 1 ? stableControl.rackIds[0] : '');
  }, [stableControl]);
  if (!panel) return null;
  const cardMinimum = activeControl?.cardSelection?.min ?? (activeControl?.cards?.length ? 1 : 0);
  const cardMaximum = activeControl?.cardSelection?.max ?? 1;
  const wireMinimum = activeControl?.wireSelection?.min ?? 0;
  const wireMaximum = activeControl?.wireSelection?.max ?? 0;
  const allowedWireCounts = activeControl?.wireSelection?.counts;
  const wireCountLabel = allowedWireCounts?.length ? allowedWireCounts.join('개 또는 ') : wireMinimum === wireMaximum ? wireMinimum : `${wireMinimum}–${wireMaximum}`;
  const ready = !!activeControl && !disabled
    && (!activeControl.values?.length || !!value)
    && (!activeControl.playerIds?.length || !!targetPlayer)
    && (!activeControl.directions?.length || !!direction)
    && (!activeControl.rackIds?.length || !!rack)
    && cards.length >= cardMinimum && cards.length <= cardMaximum
    && wireIds.length >= wireMinimum && wireIds.length <= wireMaximum
    && (!allowedWireCounts?.length || allowedWireCounts.includes(wireIds.length));
  const submit = () => {
    if (!activeControl || !ready) return;
    onAction({ type: 'mission', operation: activeControl.id,
      ...(value ? { value: value === 'red' || value === 'yellow' ? value : Number(value) } : {}),
      ...(cards.length ? { cardId: cards[0], cardIds: cards } : {}),
      ...(targetPlayer ? { targetPlayerId: targetPlayer } : {}),
      ...(activeControl.wireSelection ? { wireIds } : {}),
      ...(direction ? { direction } : {}),
      ...(rack ? { rackId: rack } : {}),
    });
  };
  const seconds = panel.deadlineAt ? Math.max(0, Math.ceil((panel.deadlineAt - now) / 1000)) : 0;
  return <section className="bb-campaign" aria-label="미션 특수 규칙">
    <div className="bb-campaign-heading"><div><span className="bb-eyebrow">MISSION RULES</span><h2>{panel.title}</h2></div>
      {panel.deadlineAt && !panel.audio && <time className={`bb-mission-timer ${seconds <= 60 ? 'urgent' : ''}`} aria-label={`남은 시간 ${Math.floor(seconds / 60)}분 ${seconds % 60}초`}>{Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}</time>}
    </div>
    <p className="bb-campaign-description">{panel.description}</p>
    {!!panel.counters.length && <dl className="bb-campaign-counters">{panel.counters.map((counter) => <div key={counter.label}><dt>{counter.label}</dt><dd>{counter.value}{counter.max !== undefined && <small> / {counter.max}</small>}</dd></div>)}</dl>}
    {!!panel.cards.length && <div className="bb-mission-cards">{panel.cards.map((card) => <article key={card.id} className={card.active ? 'active' : ''}>
      {card.ownerId && <span className="bb-card-owner">{state.players.find((player) => player.id === card.ownerId)?.name}{card.ownerId === playerId && ' · 나'}</span>}
      <strong>{card.label}</strong>{card.description && <p>{card.description}</p>}
    </article>)}</div>}
    {panel.audio && <BombBustersAudio audio={panel.audio} serverNow={state.serverNow} />}
    {(panel.bunker || panel.audio?.bunker) && <BombBustersBunker bunker={panel.bunker ?? { ...panel.audio!.bunker!, map: panel.audio!.bunker!.map[panel.audio!.bunker!.floor] }} availableDirections={panel.controls.filter((control) => control.id === 'audio_move').flatMap((control) => control.directions || [])} />}
    {panel.pendingActorId && <p className="bb-mission-pending" role="status">{panel.pendingActorId === 'any' ? '대원 한 명이 미션 행동을 선택하면 계속 진행합니다.' : panel.pendingActorId === playerId ? '계속하려면 미션 선택을 완료하세요.' : `${state.players.find((player) => player.id === panel.pendingActorId)?.name || '대원'} 님의 미션 선택을 기다립니다.`}</p>}
    {!!panel.controls.length && <div className="bb-mission-controls" aria-label="미션 행동">{panel.controls.map((control) => <button key={control.id} className={`bb-button ${activeControl?.id === control.id ? 'bb-button-primary' : 'bb-button-quiet'}`} disabled={disabled} aria-pressed={activeControl?.id === control.id} onClick={() => onControlChange(activeControl?.id === control.id ? null : control.id)}>{control.label}</button>)}</div>}
    {activeControl && <div className="bb-mission-action" aria-label={`${activeControl.label} 선택`}>
      <h3>{activeControl.label}</h3>{activeControl.description && <p>{activeControl.description}</p>}
      {!!activeControl.values?.length && <fieldset className="bb-choice-field" disabled={disabled}><legend>값 선택</legend><div>{activeControl.values.map((item) => <button key={item} type="button" className={value === String(item) ? 'selected' : ''} aria-pressed={value === String(item)} onClick={() => setValue(String(item))}>{valueLabel(item)}</button>)}</div></fieldset>}
      {!!activeControl.cards?.length && <fieldset className="bb-choice-field" disabled={disabled}><legend>카드 {cardMinimum === cardMaximum ? `${cardMinimum}장` : `${cardMinimum}–${cardMaximum}장`} 선택</legend><div>{activeControl.cards.map((card) => <button key={card.id} type="button" className={cards.includes(card.id) ? 'selected' : ''} aria-pressed={cards.includes(card.id)} disabled={!cards.includes(card.id) && cards.length >= cardMaximum && cardMaximum > 1} onClick={() => setCards(cards.includes(card.id) ? cards.filter((id) => id !== card.id) : cardMaximum === 1 ? [card.id] : [...cards, card.id])}>{card.label}</button>)}</div></fieldset>}
      {!!activeControl.playerIds?.length && <fieldset className="bb-choice-field" disabled={disabled}><legend>대원 선택</legend><div>{activeControl.playerIds.map((id) => <button key={id} type="button" className={targetPlayer === id ? 'selected' : ''} aria-pressed={targetPlayer === id} onClick={() => setTargetPlayer(id)}>{state.players.find((player) => player.id === id)?.name || '대원'}{id === playerId && ' (나)'}</button>)}</div></fieldset>}
      {!!activeControl.directions?.length && <fieldset className="bb-choice-field" disabled={disabled}><legend>{activeControl.directions.some((item) => item === 'add' || item === 'subtract') ? '계산 방법 선택' : '방향 선택'}</legend><div>{activeControl.directions.map((item) => <button key={item} type="button" className={direction === item ? 'selected' : ''} aria-pressed={direction === item} onClick={() => setDirection(item)}>{directionLabel(item)}</button>)}</div></fieldset>}
      {!!activeControl.rackIds?.length && <fieldset className="bb-choice-field" disabled={disabled}><legend>받침대 선택</legend><div>{activeControl.rackIds.map((id) => {
        const owner = state.players.find((player) => player.racks.some((item) => item.id === id));
        const index = owner?.racks.findIndex((item) => item.id === id) ?? 0;
        return <button key={id} type="button" className={rack === id ? 'selected' : ''} aria-pressed={rack === id} onClick={() => setRack(id)}>{owner?.name} · 받침대 {index + 1}</button>;
      })}</div></fieldset>}
      {activeControl.wireSelection && <div className="bb-mission-wire-selection"><p>아래 {activeControl.wireSelection.owner === 'self' ? '내' : activeControl.wireSelection.owner === 'others' ? '동료의' : '전체'} 받침대에서 {activeControl.wireSelection.onlyCut ? '해체된 전선' : '전선'} <strong>{wireCountLabel}개</strong>를 선택하세요.</p><p className="bb-selection-summary">{wireIds.length}/{wireMaximum}개 선택</p>
        {!!wireIds.length && <ul className="bb-selected-wire-list">{wireIds.map((id) => {
          const owner = state.players.find((player) => player.racks.some((item) => item.wires.some((wire) => wire.id === id)));
          const rackIndex = owner?.racks.findIndex((item) => item.wires.some((wire) => wire.id === id)) ?? -1;
          const wireIndex = owner?.racks[rackIndex]?.wires.findIndex((wire) => wire.id === id) ?? -1;
          return <li key={id}>{owner?.name} · 받침대 {rackIndex + 1} · {wireIndex + 1}번</li>;
        })}</ul>}
      </div>}
      <div className="bb-inline-controls"><button className="bb-button bb-button-primary" disabled={!ready} onClick={submit}>{activeControl.label} 확정</button><button className="bb-button bb-button-quiet" disabled={disabled} onClick={() => onControlChange(null)}>선택 취소</button></div>
    </div>}
  </section>;
};

export default BombBustersCampaign;
