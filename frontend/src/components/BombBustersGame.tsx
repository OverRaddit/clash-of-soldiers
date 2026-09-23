import React, { useEffect, useRef, useState } from 'react';
import { GameRoom } from '../types/game.types';
import { BombBustersAction, BombBustersClientState, BombClientPlayer, BombClientWire, BombWireValue } from '../types/bomb-busters.types';
import socketService from '../services/socket.service';
import './BombBustersGame.css';
import BombBustersEquipment from './BombBustersEquipment';
import BombBustersCampaign from './BombBustersCampaign';
import BombBustersValidationBoard from './BombBustersValidationBoard';
import useServerClock from '../hooks/useServerClock';
import useBombFeedback from '../hooks/useBombFeedback';
import { bombSelectionRevision } from '../utils/bomb-selection-revision';

interface Props {
  room: GameRoom;
  playerId: string;
  state: BombBustersClientState;
  message: string;
  messageType: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const valueLabel = (value: BombWireValue | null): string => value === 'yellow' ? '노랑' : value === 'red' ? '빨강' : value === null ? '?' : String(value);
const personalLabel = (id?: number): string => ({ 2: '개인 무전기', 3: '개인 트리플 탐지기', 8: '개인 전체 레이더', 10: '개인 X/Y 광선' }[id ?? 0] || '더블 탐지기');
const valueColor = (value: BombWireValue | null): string => value === 'yellow' ? 'yellow' : value === 'red' ? 'red' : typeof value === 'number' ? 'blue' : 'hidden';
const clueLabel = (wire: BombClientWire): string | null => wire.clue ? wire.clue.kind === 'parity' ? wire.clue.value === 'odd' ? '홀' : '짝' : wire.clue.kind === 'count' ? `×${wire.clue.value}` : wire.clue.kind === 'not' ? `≠${valueLabel(wire.clue.value as BombWireValue)}` : valueLabel(wire.clue.value as BombWireValue) : wire.hint !== null ? valueLabel(wire.hint) : null;
type ActionMode = 'dual' | 'solo' | 'reveal_red';
interface TargetSelection { playerId: string; rackId: string; wireIds: string[] }

const StatusIcon = ({ kind }: { kind: 'bomb' | 'cut' | 'nano' }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" focusable="false">
  {kind === 'bomb' ? <><circle cx="10" cy="14" r="7" /><path d="m15 9 2-2-2-2-2 2M16 5c0-3 4-3 4-1m0-3v1m2 3h1" /></> : kind === 'cut' ? <><circle cx="6" cy="6" r="3" /><circle cx="6" cy="18" r="3" /><path d="m8.2 8.2 12.3 12.3M8.2 15.8 20.5 3.5M14 10l-4 4" /></> : <><circle cx="6" cy="6" r="3" /><circle cx="18" cy="18" r="3" /><path d="M9 6h6a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h6" /></>}
</svg>;

const BombBustersGame: React.FC<Props> = ({ room, playerId, state, message, messageType, onLeaveRoom, onReturnToRoom }) => {
  const selectionRevision = bombSelectionRevision(state);
  const actionPanelRef = useRef<HTMLElement>(null);
  const campaignRef = useRef<HTMLDivElement>(null);
  const [mode, setMode] = useState<ActionMode>('dual');
  const [ownWireId, setOwnWireId] = useState<string | null>(null);
  const [target, setTarget] = useState<TargetSelection | null>(null);
  const [useDetector, setUseDetector] = useState(false);
  const [detectorChoice, setDetectorChoice] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [alternativeWireId, setAlternativeWireId] = useState<string | null>(null);
  const [exchangeChoice, setExchangeChoice] = useState<string | null>(null);
  const [relationEquipmentId, setRelationEquipmentId] = useState<1 | 12 | null>(null);
  const [relationWireIds, setRelationWireIds] = useState<string[]>([]);
  const [campaignControlId, setCampaignControlId] = useState<string | null>(null);
  const [campaignWireIds, setCampaignWireIds] = useState<string[]>([]);
  const [reversedGuess, setReversedGuess] = useState('');
  const clueTime = useServerClock(state.serverNow, !!state.campaign?.flashClues?.length, 250);
  const [connected, setConnected] = useState(!!socketService.getSocket()?.connected);
  const feedback = useBombFeedback(state, room.id, connected);
  const campaignControl = state.campaign?.controls.find((control) => control.id === campaignControlId) ?? null;
  const campaignPending = !!state.campaign?.pendingActorId;
  const isRedValue = (value: BombWireValue | null) => value === 'red' || (value !== null && !!state.campaign?.redValues?.includes(value));
  const mistakesRemaining = Math.max(0, state.maxMistakes - state.mistakes);
  const me = state.players.find((p) => p.id === playerId);
  const myWires = me?.racks.flatMap((rack) => rack.wires) || [];
  const ownWire = myWires.find((wire) => wire.id === ownWireId);
  const alternativeWire = myWires.find((wire) => wire.id === alternativeWireId);
  const remainingMine = myWires.filter((wire) => !wire.cut);
  const hasReversedRemaining = remainingMine.some((wire) => wire.reversed);
  const hideCutCounts = !!(state.campaign?.audio?.hideCutCounts || state.campaign?.audio?.validationTokensRemoved);
  const activePlayer = state.players.find((p) => p.id === state.currentPlayerId);
  const isMyTurn = state.currentPlayerId === playerId && state.phase !== 'finished';
  const detector = state.pendingDetector;
  const isDetectorChooser = detector?.targetPlayerId === playerId;
  const exchange = state.pendingExchange;
  const isExchangeParticipant = !!exchange && [exchange.actorId, exchange.targetPlayerId].includes(playerId);
  const exchangeSubmitted = !!exchange?.selectedPlayerIds.includes(playerId);
  const canAct = isMyTurn && !detector && !exchange && !relationEquipmentId && !campaignPending && !campaignControl && connected && !sending;
  const isSetup = state.phase === 'setup';
  const isFinished = state.phase === 'finished';
  const armedEquipment = state.superDetectorActive || state.tripleDetectorActive || state.stabilizerActive || state.xyRayActive;
  const canUseEquipment = state.phase === 'playing' && !detector && !exchange && !campaignPending && !campaignControl && connected && !sending;
  const totalWires = state.players.flatMap((p) => p.racks.flatMap((rack) => rack.wires));
  const cutTotal = totalWires.filter((wire) => wire.cut).length;
  const targetName = state.players.find((p) => p.id === target?.playerId)?.name;
  const captain = state.players.find((p) => p.id === state.captainId);
  const hasOnlyRed = remainingMine.length > 0 && remainingMine.every((wire) => isRedValue(wire.value) || (wire.reversed && wire.value === null));
  const sameValueMine = ownWire ? remainingMine.filter((wire) => wire.value === ownWire.value) : [];
  const valueTotal = ownWire?.value === 'yellow' ? state.mission.yellowCount : 4;
  const canSolo = !!ownWire && ownWire.value !== null && !hasReversedRemaining && !isRedValue(ownWire.value) && (sameValueMine.length === 2 || sameValueMine.length === 4)
    && (hideCutCounts || sameValueMine.length + (state.cutCounts[String(ownWire.value)] || 0) === valueTotal);

  useEffect(() => {
    setOwnWireId(null);
    setTarget(null);
    setDetectorChoice(null);
    setSending(false);
    setAlternativeWireId(null);
    setExchangeChoice(null);
    setRelationEquipmentId(null);
    setRelationWireIds([]);
    setCampaignControlId(null);
    setCampaignWireIds([]);
    setReversedGuess('');
    if (state.superDetectorActive || state.tripleDetectorActive || state.stabilizerActive || state.xyRayActive) setMode('dual');
  }, [selectionRevision, state.superDetectorActive, state.tripleDetectorActive, state.stabilizerActive, state.xyRayActive]);

  const selectedRelationConsumed = relationEquipmentId !== null && state.equipment.some((equipment) => equipment.id === relationEquipmentId && equipment.used);
  useEffect(() => {
    if (!selectedRelationConsumed) return;
    setRelationEquipmentId(null);
    setRelationWireIds([]);
  }, [selectedRelationConsumed]);

  // Preparing X/Y or a stabilizer must preserve a selected personal detector.
  useEffect(() => { setUseDetector(false); }, [room.id, state.mission.id, state.phase, state.turnNumber, state.currentPlayerId, me?.detectorUsed, me?.personalEquipmentId, state.superDetectorActive, state.tripleDetectorActive]);

  useEffect(() => { setSending(false); }, [state]);

  useEffect(() => {
    const socket = socketService.getSocket();
    const onConnect = () => setConnected(true);
    const onDisconnect = () => { setConnected(false); setSending(false); };
    const onError = () => setSending(false);
    socket?.on('connect', onConnect);
    socket?.on('disconnect', onDisconnect);
    socket?.on('bomb_busters_error', onError);
    return () => {
      socket?.off('connect', onConnect);
      socket?.off('disconnect', onDisconnect);
      socket?.off('bomb_busters_error', onError);
    };
  }, []);

  useEffect(() => {
    if (relationEquipmentId || exchange || detector) actionPanelRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
  }, [relationEquipmentId, exchange, detector]);

  const beginCampaignControl = (id: string | null) => {
    setCampaignControlId(id);
    setCampaignWireIds([]);
    setOwnWireId(null);
    setAlternativeWireId(null);
    setTarget(null);
    setRelationEquipmentId(null);
    setRelationWireIds([]);
    window.requestAnimationFrame(() => campaignRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' }));
  };

  const send = (action: BombBustersAction) => {
    if (!connected || sending) return;
    setSending(true);
    socketService.bombBustersAction(room.id, playerId, action);
  };

  const relationReady = (() => {
    if (!relationEquipmentId || relationWireIds.length !== 2) return false;
    return !!me?.racks.some((rack) => rack.wires.some((wire, index) => {
      const next = rack.wires[index + 1];
      return next && relationWireIds.includes(wire.id) && relationWireIds.includes(next.id)
        && !wire.reversed && !next.reversed && !wire.excluded && !next.excluded && (!wire.cut || !next.cut) && wire.value !== null && next.value !== null
        && (wire.value === next.value) === (relationEquipmentId === 12);
    }));
  })();
  const selectWire = (player: BombClientPlayer, rackId: string, wire: BombClientWire) => {
    if (isFinished || !connected || sending) return;
    if (campaignControl) {
      const selection = campaignControl.wireSelection;
      if (!selection || (wire.cut && !selection.allowCut) || (selection.onlyCut && !wire.cut) || (selection.owner === 'self' && player.id !== playerId) || (selection.owner === 'others' && player.id === playerId)) return;
      setCampaignWireIds(campaignWireIds.includes(wire.id) ? campaignWireIds.filter((id) => id !== wire.id) : campaignWireIds.length < selection.max ? [...campaignWireIds, wire.id] : selection.max === 1 ? [wire.id] : campaignWireIds);
      return;
    }
    if (campaignPending) return;
    if (relationEquipmentId) {
      if (player.id !== playerId) return;
      setRelationWireIds(relationWireIds.includes(wire.id) ? relationWireIds.filter((id) => id !== wire.id) : relationWireIds.length < 2 ? [...relationWireIds, wire.id] : [wire.id]);
      return;
    }
    if (wire.cut) return;
    if (exchange) {
      if (isExchangeParticipant && !exchangeSubmitted && player.id === playerId) setExchangeChoice(wire.id);
      return;
    }
    if (detector) {
      if (isDetectorChooser && detector.eligibleWireIds?.includes(wire.id)) setDetectorChoice(wire.id);
      return;
    }
    if (!isMyTurn) return;
    if (player.id === playerId) {
      if (isSetup && (typeof wire.value !== 'number' || isRedValue(wire.value))) return;
      setReversedGuess('');
      if (state.xyRayActive) {
        if (ownWireId === wire.id) { setOwnWireId(alternativeWireId); setAlternativeWireId(null); }
        else if (alternativeWireId === wire.id) setAlternativeWireId(null);
        else if (!ownWireId) setOwnWireId(wire.id);
        else if (wire.value !== ownWire?.value) setAlternativeWireId(wire.id);
        else setOwnWireId(wire.id);
      } else {
        setOwnWireId(ownWireId === wire.id ? null : wire.id);
        if (wire.value === 'yellow' || wire.value === 'red' || wire.excluded) { setUseDetector(false); setTarget(null); }
      }
    } else if (!isSetup && mode === 'dual') {
      if (target?.playerId === player.id && target.rackId === rackId && target.wireIds.includes(wire.id)) {
        setTarget({ ...target, wireIds: target.wireIds.filter((id) => id !== wire.id) });
      } else if ((useDetector || state.tripleDetectorActive) && target?.playerId === player.id && target.rackId === rackId && target.wireIds.length < (state.tripleDetectorActive ? 3 : 2)) {
        setTarget({ ...target, wireIds: [...target.wireIds, wire.id] });
      } else {
        setTarget({ playerId: player.id, rackId, wireIds: [wire.id] });
      }
    }
  };

  const wireSelectable = (player: BombClientPlayer, wire: BombClientWire) => {
    if (isFinished || !connected || sending || state.campaign?.audio?.removedCutWireIds?.includes(wire.id)) return false;
    if (campaignControl) {
      const selection = campaignControl.wireSelection;
      return !!selection && (!wire.cut || !!selection.allowCut)
        && (!selection.onlyCut || wire.cut)
        && (selection.owner === 'all' || (selection.owner === 'self' ? player.id === playerId : player.id !== playerId))
        && (campaignWireIds.includes(wire.id) || campaignWireIds.length < selection.max || selection.max === 1);
    }
    if (campaignPending) return false;
    if (relationEquipmentId) return player.id === playerId && !wire.reversed && !wire.excluded;
    if (wire.cut) return false;
    if (exchange) return isExchangeParticipant && !exchangeSubmitted && player.id === playerId;
    if (detector) return !!isDetectorChooser && !!detector.eligibleWireIds?.includes(wire.id);
    if (!isMyTurn) return false;
    if (isSetup) return player.id === playerId && typeof wire.value === 'number' && !isRedValue(wire.value);
    if (mode === 'reveal_red') return false;
    return player.id === playerId ? !isRedValue(wire.value) && (!wire.reversed || !armedEquipment) && (!wire.excluded || !(armedEquipment || useDetector)) && (!(state.superDetectorActive || state.tripleDetectorActive || useDetector) || typeof wire.value === 'number') : mode === 'dual' && (!wire.excluded || !(armedEquipment || useDetector));
  };

  const renderPlayer = (player: BombClientPlayer) => {
    const mine = player.id === playerId;
    const active = player.id === state.currentPlayerId && !isFinished;
    return <section key={player.id} className={`bb-player ${mine ? 'bb-player-mine' : ''} ${active ? 'bb-player-active' : ''}`}>
      <div className="bb-player-heading">
        <div className="bb-player-name"><span className="bb-avatar">{state.players.findIndex((p) => p.id === player.id) + 1}</span>
          <h3>{player.name} {mine && <span className="bb-small-tag">나</span>}</h3>
          {player.id === state.captainId && <span className="bb-small-tag">대장</span>}
          {active && <span className="bb-turn-tag">{isSetup ? '단서 배치' : '현재 차례'}</span>}
        </div>
        <span className="bb-player-meta">{isSetup ? player.initialHintPlaced ? '단서 배치 완료' : '단서 배치 전' : `${personalLabel(player.personalEquipmentId)} ${player.detectorUsed ? '사용 완료' : '1회'}`}</span>
      </div>
      <div className="bb-racks">{player.racks.map((rack, rackIndex) => <div key={rack.id} className="bb-rack">
        <div className="bb-rack-label"><span>{player.racks.length > 1 ? `받침대 ${rackIndex + 1}` : '전선 받침대'}</span><span>작은 수 → 큰 수</span></div>
        <div className="bb-wire-row">
          {rack.wires.map((wire, index) => {
            if (state.campaign?.audio?.removedCutWireIds?.includes(wire.id)) return <span key={wire.id} className="bb-wire-empty" aria-label={`${player.name} 받침대 ${rackIndex + 1}, ${index + 1}번 빈자리`}><span>{index + 1}</span></span>;
            const visibleValue = wire.value;
            const flashClue = state.campaign?.flashClues?.find((clue) => clue.wireId === wire.id && clue.expiresAt > clueTime);
            const displayedClue = clueLabel(flashClue ? { ...wire, clue: flashClue.clue } : wire);
            const lastResult = wire.cut && visibleValue !== null && state.lastTurn?.cutWireIds.includes(wire.id) ? 'success'
              : displayedClue !== null && state.lastTurn?.clueWireIds.includes(wire.id) ? 'failure' : null;
            const lastResultLabel = lastResult === 'success' ? '직전 턴 해체 성공' : lastResult === 'failure' ? '직전 턴 실패로 공개된 단서' : '';
            const color = isRedValue(visibleValue) ? 'red' : valueColor(visibleValue);
            const selected = wire.id === ownWireId || wire.id === alternativeWireId || target?.wireIds.includes(wire.id) || detectorChoice === wire.id || exchangeChoice === wire.id || relationWireIds.includes(wire.id) || campaignWireIds.includes(wire.id);
            const relation = state.relationMarkers?.find((marker) => marker.rackId === rack.id && marker.wireIds.includes(wire.id) && marker.wireIds.includes(rack.wires[index + 1]?.id));
            const pointed = detector?.targetWireIds.includes(wire.id);
            return <button key={wire.id} type="button"
              className={`bb-wire bb-wire-${color} ${wire.cut ? 'bb-wire-cut' : ''} ${lastResult ? `bb-wire-last-${lastResult}` : ''} ${feedback?.wireIds.includes(wire.id) ? 'bb-wire-celebrate' : ''} ${selected ? 'bb-wire-selected' : ''} ${pointed ? 'bb-wire-pointed' : ''} ${wire.reversed ? 'bb-wire-reversed' : ''} ${wire.excluded ? 'bb-wire-excluded' : ''}`}
              disabled={!wireSelectable(player, wire)} onClick={() => selectWire(player, rack.id, wire)}
              title={lastResultLabel || undefined}
              aria-label={`${player.name} 받침대 ${rackIndex + 1}, ${index + 1}번 전선: ${wire.cut ? '해체됨 ' : ''}${visibleValue === null ? '비공개' : valueLabel(visibleValue)}${displayedClue !== null ? `, 공개 단서 ${displayedClue}` : ''}${wire.reversed ? ', 역방향 전선' : ''}${wire.excluded ? ', 정렬 제외 전선' : ''}${wire.singleLabel ? ', 받침대에 하나뿐인 값' : ''}${typeof visibleValue === 'number' && isRedValue(visibleValue) ? ', 빨강 취급' : ''}${lastResultLabel ? `, ${lastResultLabel}` : ''}`}
              aria-pressed={!!selected}>
              {feedback?.wireIds.includes(wire.id) && <span key={feedback.key} className="bb-cut-flash" aria-hidden="true" />}
              <span className="bb-wire-index">{index + 1}{lastResult && <span className="bb-wire-last-result" aria-hidden="true">{lastResult === 'success' ? '✓' : '!'}</span>}</span>
              {(wire.reversed || wire.excluded) && <span className="bb-wire-special">{wire.reversed ? '↶' : 'X'}</span>}
              <span className="bb-wire-value">{valueLabel(visibleValue)}</span>
              {visibleValue !== null && typeof visibleValue !== 'number' && wire.sortValue !== null && <span className="bb-sort-value">{wire.sortValue}</span>}
              {wire.cut ? <span className="bb-cut-label">해체</span> : <span className="bb-wire-line" />}
              {displayedClue !== null && <span className={`bb-hint bb-hint-${wire.clue && wire.clue.kind !== 'value' ? 'variant' : valueColor(wire.clue?.kind === 'value' ? wire.clue.value as BombWireValue : wire.hint)}`}>{displayedClue}</span>}
              {wire.singleLabel && <span className="bb-single-label" title="이 값은 해당 받침대에 하나뿐입니다">×1</span>}
              {relation && <span className="bb-relation-marker" aria-label={`다음 전선과 ${relation.relation === 'equal' ? '같은 값' : '다른 값'}`}>{relation.relation === 'equal' ? '=' : '≠'}</span>}
            </button>;
          })}
        </div>
      </div>)}</div>
      {mine && <p className="bb-private-note">{player.racks.some((rack) => rack.wires.some((wire) => wire.reversed)) ? '↶ 역방향 전선은 나에게 숨겨지고 동료에게 보입니다. 역방향 전선의 값을 추론해 선언하세요.' : player.racks.some((rack) => rack.wires.some((wire) => !wire.cut && wire.value === null)) ? '현재 미션 지시에 따라 내 전선이 잠시 가려져 있습니다.' : '내 전선의 값은 나에게만 보입니다.'} 원 안의 단서는 모두에게 공개됩니다.</p>}
      {player.racks.some((rack) => rack.wires.some((wire) => wire.excluded)) && <p className="bb-private-note">X 전선은 숫자 정렬에서 제외되며 장비의 효과를 받지 않습니다.</p>}
    </section>;
  };

  const selectedRack = state.players.find((p) => p.id === target?.playerId)?.racks.find((rack) => rack.id === target?.rackId);
  const targetCount = state.tripleDetectorActive ? Math.min(3, selectedRack?.wires.filter((wire) => !wire.cut && !wire.excluded).length ?? 3) : useDetector ? 2 : 1;
  const dualReady = canAct && !!ownWire && !isRedValue(ownWire.value) && !!target && target.wireIds.length === targetCount
    && (!state.tripleDetectorActive || targetCount >= 2)
    && (!(state.superDetectorActive || state.tripleDetectorActive || useDetector) || typeof ownWire.value === 'number')
    && (!state.xyRayActive || (!!alternativeWire && alternativeWire.value !== ownWire.value && !isRedValue(alternativeWire.value) && (!(useDetector || state.tripleDetectorActive || state.superDetectorActive) || typeof alternativeWire.value === 'number')))
    && (!ownWire.reversed || !!reversedGuess);
  const myIndex = state.players.findIndex((p) => p.id === playerId);
  const orderedPlayers = myIndex < 0 ? state.players : [...state.players.slice(myIndex), ...state.players.slice(0, myIndex)];

  return <main className="bb-game">
    {feedback?.kind === 'failure' && <div key={feedback.key} className={`bb-damage-vignette ${mistakesRemaining <= 1 ? 'bb-damage-critical' : ''}`} aria-hidden="true" />}
    <section className="bb-overview" aria-label="작전 현황">
      <div className="bb-dashboard">
        <div className="bb-mission"><span className="bb-eyebrow">{state.mission.id === 0 ? 'FREE PRACTICE' : `MISSION ${String(state.mission.id).padStart(2, '0')}`}</span><h2>{state.mission.name}</h2></div>
        <div className="bb-stats">
          {state.mission.id === 53 ? <div className="bb-stat bb-stat-nano" role="img" aria-label="기폭 조건: 나노가 12칸에 도달" title="나노가 12칸에 도달하면 폭발 · 현재 위치는 미션 보드에서 확인"><StatusIcon kind="nano" /><strong>12<small>칸</small></strong></div> : <div className={`bb-stat bb-stat-mistakes ${mistakesRemaining <= 1 ? 'bb-stat-danger' : ''}`} role="img" aria-label={`기폭까지 남은 실수 ${mistakesRemaining}회`} title={`폭발까지 남은 실수 ${mistakesRemaining}회`}><StatusIcon kind="bomb" /><strong key={feedback?.livesLost ? feedback.key : 'steady'} className={feedback?.livesLost ? 'bb-life-hit' : ''}>{mistakesRemaining}</strong>{!!feedback?.livesLost && <span key={`loss-${feedback.key}`} className="bb-life-loss" aria-hidden="true">−{feedback.livesLost}</span>}</div>}
          <div className="bb-stat bb-stat-cut" role="img" aria-label={`해체한 전선 ${cutTotal}개, 전체 ${totalWires.length}개`} title={`해체한 전선 ${cutTotal} / ${totalWires.length}`}><StatusIcon kind="cut" /><strong key={feedback?.kind === 'success' ? feedback.key : 'steady'} className={feedback?.kind === 'success' ? 'bb-cut-gain' : ''}>{cutTotal}<small>/{totalWires.length}</small></strong></div>
        </div>
      </div>
      {state.mission.id !== 50 && <BombBustersValidationBoard blueMax={state.mission.blueMax} cutCounts={state.cutCounts}
        yellowMarkers={state.yellowMarkers} redMarkers={state.redMarkers} hideCutCounts={hideCutCounts} />}
    </section>

    <div className="bb-game-scroll" role="region" aria-label="작전 보드" tabIndex={0}>
    <header className="bb-header">
      <div><p className="bb-eyebrow">BOMB BUSTERS · COOPERATIVE MISSION</p><h1>봄버스터즈 <span>해체반 작전실</span></h1><p className="bb-room-name">{room.name} · {state.players.length}인 협력 · 대장 {captain?.name}</p></div>
      <button className="bb-button bb-button-quiet" onClick={onLeaveRoom}>방 나가기</button>
    </header>

    {!connected && <div className="bb-notice bb-notice-error" role="alert">연결이 끊어졌습니다. 다시 연결되면 작전 상태를 복구합니다.</div>}
    {message && <div className={`bb-notice ${messageType === 'error' ? 'bb-notice-error' : ''}`} role={messageType === 'error' ? 'alert' : 'status'}>{message}</div>}

    <div className="bb-mission-context">
      <details className="bb-mission-details"><summary>미션 안내</summary><p>{state.mission.description}</p></details>
      {state.mission.id !== 50 && <>
      {!!state.campaign?.redValues?.length && <p className="bb-marker-red">위험 전선: {state.campaign.redValues.map(valueLabel).join(' · ')}번은 빨강으로 취급합니다.</p>}
      {(state.redMarkers.length > 0 || state.yellowMarkers.length > 0) && <div className="bb-special-markers">
        {state.yellowMarkers.length > 0 && <p><span className="bb-marker-yellow">노란 전선 후보</span> {state.yellowMarkers.join(' · ')} <small>사용 {state.mission.yellowCount}개</small></p>}
        {state.redMarkers.length > 0 && <p><span className="bb-marker-red">빨간 전선 후보</span> {state.redMarkers.join(' · ')} <small>사용 {state.mission.redCount}개 · 절단하면 즉시 폭발</small></p>}
      </div>}
      </>}
    </div>

    {state.mission.id === 50 && (state.redMarkers.length > 0 || state.yellowMarkers.length > 0) && <section className="bb-memory-preview" aria-label="기억할 전선 위치">
      <h2>작전 시작 전에 위치를 기억하세요</h2><p>대장이 기억 확인을 마치면 아래 숫자 위치가 사라집니다. 이후에는 각자 기억한 위치를 동료에게 말할 수 없습니다.</p>
      {state.redMarkers.length > 0 && <p><span className="bb-marker-red">빨간 전선</span>{state.redMarkers.join(' · ')}</p>}
      {state.yellowMarkers.length > 0 && <p><span className="bb-marker-yellow">노란 전선</span>{state.yellowMarkers.join(' · ')}</p>}
    </section>}

    <div className="bb-campaign-anchor" ref={campaignRef}><BombBustersCampaign state={state} playerId={playerId} disabled={!connected || sending || isFinished || !!detector || !!exchange} activeControl={campaignControl} wireIds={campaignWireIds} onControlChange={beginCampaignControl} onAction={send} /></div>

    {(!!state.radarResults?.length || !!state.lastExchange?.length) && <section className="bb-shared-findings" aria-label="공개 장비 결과">
      {!!state.radarResults?.length && <div><h2>전체 레이더 기록</h2><p>장비를 사용한 시점의 보유 여부입니다. 이후 절단·교환으로 현재 상태는 달라질 수 있습니다.</p>
        {state.radarResults.map((result, resultIndex) => <div key={`${result.value}-${resultIndex}`} className="bb-radar-result"><strong>숫자 {result.value}</strong><div>{result.racks.map((rack) => {
          const owner = state.players.find((player) => player.id === rack.playerId);
          const index = owner?.racks.findIndex((item) => item.id === rack.rackId) ?? 0;
          return <span key={rack.rackId} className={rack.present ? 'present' : ''}>{owner?.name}{(owner?.racks.length ?? 0) > 1 ? ` · 받침대 ${index + 1}` : ''} <b>{rack.present ? '있음' : '없음'}</b></span>;
        })}</div></div>)}
      </div>}
      {!!state.lastExchange?.length && <div><h2>최근 전선 교환</h2><ul>{state.lastExchange.map((move) => {
        const from = state.players.find((player) => player.id === move.fromPlayerId);
        const to = state.players.find((player) => player.id === move.toPlayerId);
        const fromRack = (from?.racks.findIndex((rack) => rack.id === move.fromRackId) ?? 0) + 1;
        const toRack = (to?.racks.findIndex((rack) => rack.id === move.toRackId) ?? 0) + 1;
        return <li key={move.wireId}>{from?.name} 받침대 {fromRack} · {move.fromIndex + 1}번 → {to?.name} 받침대 {toRack} · {move.toIndex + 1}번</li>;
      })}</ul><p>교환 완료 시점의 위치이며, 전선의 값은 새 소유자에게만 보입니다.</p></div>}
    </section>}

    {isFinished ? <section className={`bb-result ${state.outcome === 'won' ? 'bb-result-won' : ''}`} role="status">
      <span className="bb-eyebrow">MISSION {state.outcome === 'won' ? 'COMPLETE' : 'FAILED'}</span>
      <h2>{state.outcome === 'won' ? '폭탄 해체 성공!' : '작전 실패'}</h2><p>{state.endReason}</p>
      <p>{state.turnNumber}번째 차례{state.mission.id !== 53 && ` · 기폭까지 남은 실수 ${mistakesRemaining}회`}</p>
      {room.hostId === playerId ? <button className="bb-button bb-button-primary" onClick={onReturnToRoom}>대기실로 돌아가기</button> : <p className="bb-result-wait">방장이 대기실로 돌아가면 새 임무를 시작할 수 있습니다.</p>}
    </section> : <section className="bb-action-panel" aria-label="내 행동" ref={actionPanelRef}>
      <div className="bb-action-heading"><div><span className="bb-eyebrow">{isSetup ? 'BRIEFING' : `TURN ${state.turnNumber}`}</span><h2>{campaignPending ? '미션 선택 진행 중' : campaignControl ? '미션 행동 선택 중' : exchange ? '무전기 · 비공개 전선 교환' : relationEquipmentId ? `${relationEquipmentId === 12 ? '=' : '≠'} 표식 위치 선택` : detector ? detector.kind === 'xy' ? 'X/Y 광선 · 동료의 확인' : '탐지기 · 동료의 선택' : isSetup ? isMyTurn ? '공개할 첫 단서를 골라주세요' : `${activePlayer?.name} 님이 첫 단서를 고르고 있습니다` : isMyTurn ? '내 차례입니다' : `${activePlayer?.name} 님의 차례입니다`}</h2></div><span className={`bb-turn-pill ${isMyTurn ? 'mine' : ''}`}>{isMyTurn ? 'YOUR TURN' : 'TEAM TURN'}</span></div>
      {campaignPending || campaignControl ? <p>위 미션 규칙 패널에서 선택을 진행하세요. {campaignControl?.wireSelection ? '아래 받침대의 전선을 직접 눌러 선택할 수 있습니다.' : '미션 선택이 완료되면 일반 행동을 이어갈 수 있습니다.'}</p> : exchange ? <>
        <p>교환할 전선을 두 사람이 각자 고릅니다. 둘 다 제출하면 전선과 이동 위치가 교환됩니다. 선택한 값은 상대에게 보내지 않습니다.</p>
        <div className="bb-exchange-status">{[exchange.actorId, exchange.targetPlayerId].map((id) => <span key={id} className={exchange.selectedPlayerIds.includes(id) ? 'ready' : ''}>{state.players.find((player) => player.id === id)?.name} · {exchange.selectedPlayerIds.includes(id) ? '선택 완료' : '선택 중'}</span>)}</div>
        {isExchangeParticipant && !exchangeSubmitted && <><p>아래 내 받침대에서 보낼 전선 하나를 골라주세요. 받은 전선은 내가 고른 전선과 같은 받침대에 정렬됩니다.</p><button className="bb-button bb-button-primary" disabled={!exchangeChoice || sending || !connected} onClick={() => exchangeChoice && send({ type: 'exchange_wire', wireId: exchangeChoice })}>교환할 내 전선 확정</button></>}
        {isExchangeParticipant && exchangeSubmitted && <p>내 선택이 제출되었습니다. 동료의 선택을 기다립니다.</p>}
      </> : relationEquipmentId ? <>
        <p>내 받침대에서 서로 붙어 있는 전선 두 개를 고르세요. 값이 <strong>{relationEquipmentId === 12 ? '같아야' : '달라야'}</strong> 하며, 두 전선 중 하나는 이미 해체되어 있어도 됩니다.</p>
        <div className="bb-inline-controls"><button className="bb-button bb-button-primary" disabled={!relationReady || sending || !connected} onClick={() => send({ type: 'equipment', equipmentId: relationEquipmentId, wireIds: relationWireIds })}>선택한 위치에 {relationEquipmentId === 12 ? '=' : '≠'} 표식 놓기</button><button className="bb-button bb-button-quiet" onClick={() => { setRelationEquipmentId(null); setRelationWireIds([]); }}>선택 취소</button></div>
        <p className="bb-selection-summary">전선 {relationWireIds.length}/2개 선택 {relationWireIds.length === 2 && !relationReady ? ' · 같은 받침대의 인접한 전선이며 표식 조건에 맞는지 확인하세요.' : ''}</p>
      </> : detector ? <>
        <p>{state.players.find((p) => p.id === detector.actorId)?.name} 님이 <strong>{detector.kind === 'xy' ? detector.guesses?.map(valueLabel).join(' 또는 ') : valueLabel(detector.guess)}</strong> 전선을 찾습니다. {isDetectorChooser ? '표시된 후보 중 선택 가능한 전선 하나를 골라주세요.' : `${state.players.find((p) => p.id === detector.targetPlayerId)?.name} 님의 선택을 기다립니다.`}</p>
        {isDetectorChooser && <button className="bb-button bb-button-primary" disabled={!detectorChoice || sending || !connected} onClick={() => detectorChoice && send({ type: 'resolve_detector', wireId: detectorChoice })}>선택한 전선 확정</button>}
      </> : isSetup ? <>
        <p>{state.campaign ? <>위 미션 규칙에 따라 내 전선을 골라 시작 단서를 공개하세요. 미션에 따라 정확한 숫자 대신 홀짝·개수·부정 단서가 놓입니다.</> : <>대장부터 차례대로, 내 받침대에서 <strong>파란 전선 1개</strong>를 골라 같은 숫자의 단서를 공개합니다. 전선은 자르지 않습니다.</>}</p>
        {isMyTurn && <button className="bb-button bb-button-primary" disabled={!ownWire || !canAct} onClick={() => ownWire && send({ type: 'hint', wireId: ownWire.id })}>{ownWire ? state.campaign ? '선택한 전선에 단서 놓기' : `${valueLabel(ownWire.value)} 단서 놓기` : '아래에서 내 파란 전선을 선택하세요'}</button>}
      </> : <>
        <div className="bb-action-tabs" aria-label="해체 방법">
          {([{ id: 'dual', label: '협력 해체' }, { id: 'solo', label: '단독 해체' }, { id: 'reveal_red', label: '빨간 전선 공개' }] as { id: ActionMode; label: string }[]).map((item) => <button key={item.id} className={mode === item.id ? 'active' : ''} aria-pressed={mode === item.id} onClick={() => { setMode(item.id); setTarget(null); if (item.id !== 'dual') setUseDetector(false); }} disabled={!canAct || (!!armedEquipment && item.id !== 'dual')}>{item.label}</button>)}
        </div>
        {mode === 'dual' && <>
          {armedEquipment && <p className="bb-armed-note">준비한 장비: {[state.tripleDetectorActive && '트리플 탐지기', state.superDetectorActive && '슈퍼 탐지기', state.stabilizerActive && '안정기', state.xyRayActive && 'X/Y 광선'].filter(Boolean).join(' · ')}. 이번 차례에는 협력 해체를 진행하세요.</p>}
          {armedEquipment && <div className="bb-cancel-equipment"><button className="bb-button bb-button-quiet" disabled={!canAct} onClick={() => { setUseDetector(false); send({ type: 'cancel_equipment' }); }}>준비한 장비 효과 모두 취소</button><small>아직 사용하지 않은 장비는 소모되지 않습니다. 차례는 계속 진행합니다.</small></div>}
          <p>{state.xyRayActive ? <>서로 다른 값을 가진 <strong>내 전선 2개</strong>와 <strong>{state.superDetectorActive ? '동료의 받침대에서 전선 아무거나 1개' : `동료 전선 ${state.tripleDetectorActive ? '3개 (2개만 남았다면 2개)' : useDetector ? '2개' : '1개'}`}</strong>를 고르세요. {state.superDetectorActive ? '그 받침대의 남은 전선 전체에서 두 값 중 하나를 찾습니다.' : '두 값 중 하나와 일치하는 전선 한 쌍을 해체합니다.'} {useDetector || state.tripleDetectorActive || state.superDetectorActive ? '탐지기와 함께 쓸 때는 파란 숫자 두 개를 선언하며, 같은 받침대에서 동료가 하나를 고릅니다.' : '노랑도 선언할 수 있습니다. 더블 탐지기를 함께 사용할 수도 있습니다.'}</> : state.superDetectorActive ? <>내 파란 전선 하나와 <strong>동료의 받침대에서 전선 아무거나 1개</strong>를 선택하세요. 슈퍼 탐지기가 그 받침대의 남은 전선 전체를 탐색합니다.</> : <>내 전선 하나와 같은 값으로 예상되는 <strong>동료 전선 {state.tripleDetectorActive ? '3개 (2개만 남았다면 2개)' : useDetector ? '2개' : '1개'}</strong>를 선택하세요. {useDetector || state.tripleDetectorActive ? '후보는 같은 받침대에서 선택하며, 동료가 하나를 고릅니다.' : '값이 다르면 전선은 그대로 두고 실수가 1회 쌓입니다.'}</>}</p>
          {ownWire?.reversed && <label className="bb-reversed-guess">내 역방향 전선의 예상 값
            <select className="bb-equipment-select" aria-label="내 역방향 전선의 예상 값" value={reversedGuess} disabled={!canAct} onChange={(event) => setReversedGuess(event.target.value)}>
              <option value="">값을 추론해 선택하세요</option>{Array.from({ length: state.mission.blueMax }, (_, index) => index + 1).map((value) => <option key={value} value={value}>{value}</option>)}{state.mission.yellowCount > 0 && <option value="yellow">노랑</option>}
            </select><small>틀린 값으로 자기 역방향 전선을 절단하면 즉시 폭발합니다.</small>
          </label>}
          <div className="bb-dual-controls">{(me?.personalEquipmentId ?? 0) === 0 ? <label className={`bb-detector-control ${me?.detectorUsed ? 'used' : ''}`}><input type="checkbox" checked={useDetector} disabled={!canAct || me?.detectorUsed || ownWire?.value === 'yellow' || state.superDetectorActive || state.tripleDetectorActive || (state.xyRayActive && alternativeWire?.value === 'yellow') || ownWire?.reversed || ownWire?.excluded || (me?.personalEquipmentId ?? 0) !== 0} onChange={(e) => { setUseDetector(e.target.checked); setTarget(null); }} />더블 탐지기 <small>{me?.detectorUsed ? '사용 완료' : state.mission.id === 58 ? '이 미션에서는 매 차례 사용 가능' : '게임당 1회 · 파란 전선만 선언'}</small></label> : <span className="bb-private-note">{personalLabel(me?.personalEquipmentId)}는 아래 장비에서 사용합니다.</span>}
          <button className="bb-button bb-button-primary" disabled={!dualReady} onClick={() => ownWire && target && send({ type: 'dual', ownWireId: ownWire.id, targetPlayerId: target.playerId, targetWireIds: target.wireIds, useDetector, ...(state.xyRayActive && alternativeWireId ? { alternativeWireId } : {}), ...(ownWire.reversed ? { guess: reversedGuess === 'yellow' ? 'yellow' as const : Number(reversedGuess) } : {}) })}>{sending ? '확인 중…' : '협력 해체 실행'}</button></div>
          <p className="bb-selection-summary">{ownWire ? `내 ${ownWire.reversed ? reversedGuess ? valueLabel(reversedGuess === 'yellow' ? 'yellow' : Number(reversedGuess)) : '역방향 ?' : valueLabel(ownWire.value)}${state.xyRayActive ? alternativeWire ? ` / ${valueLabel(alternativeWire.value)}` : ' / 두 번째 값 선택' : ''} 전선` : state.xyRayActive ? '내 전선 2개 선택' : '내 전선 선택'} <span>→</span> {target?.wireIds.length ? `${targetName} 님의 전선 ${target.wireIds.length}개 선택` : '동료 전선 선택'}</p>
        </>}
        {mode === 'solo' && <><p>어떤 값의 남은 전선을 <strong>전부 내가 가지고 있다면</strong>, 그 값의 전선 2개 또는 4개를 한 번에 해체합니다. 아래에서 해당하는 내 전선을 선택하세요.</p>{hasReversedRemaining && <p>내 역방향 전선이 남아 있습니다. 위 미션 패널의 단독 해체에서 전선 위치와 예상 값을 직접 선택하세요.</p>}{hideCutCounts && <p>값별 해체 수를 볼 수 없습니다. 기억한 정보를 바탕으로, 남은 같은 값의 전선을 모두 가지고 있는지 확인한 뒤 해체하세요.</p>}<button className="bb-button bb-button-primary" disabled={!canAct || !canSolo} onClick={() => ownWire?.value !== null && ownWire && send({ type: 'solo', value: ownWire.value })}>{canSolo ? `${valueLabel(ownWire?.value ?? null)} 전선 ${sameValueMine.length}개 해체` : '단독 해체 가능한 내 전선을 선택하세요'}</button></>}
        {mode === 'reveal_red' && <><p>내게 남은 전선이 <strong>모두 빨간색일 때만</strong> 안전하게 전부 공개할 수 있습니다. 빨간 전선을 자르는 행동이 아닙니다. {!!state.campaign?.redValues?.length && <strong> 이번 미션에서는 {state.campaign.redValues.map(valueLabel).join(' · ')}번도 빨강으로 취급합니다.</strong>} {state.mission.id === 13 && <strong> 이 미션에서는 일반 공개 대신 미션 행동의 빨강 세 개 동시 절단을 사용하세요.</strong>} {remainingMine.some((wire) => wire.reversed) && <strong>내 역방향 전선도 모두 빨강이라고 선언합니다. 빨강이 아닌 역방향 전선이 포함되면 즉시 폭발합니다.</strong>}</p><button className="bb-button bb-button-red" disabled={!canAct || !hasOnlyRed || state.mission.id === 13} onClick={() => send({ type: 'reveal_red' })}>남은 빨간 전선 안전 공개</button></>}
      </>}
    </section>}

    <div className="bb-players">{orderedPlayers.filter((player) => player.id !== playerId).map(renderPlayer)}</div>

    <BombBustersEquipment state={state} playerId={playerId} disabled={!canUseEquipment || !!relationEquipmentId} onAction={send} onSelectRelation={(equipmentId) => { setRelationEquipmentId(equipmentId); setRelationWireIds([]); setOwnWireId(null); setTarget(null); }} />

    <div className="bb-bottom-grid"><details className="bb-rules"><summary>플레이 방법과 대화 규칙</summary><p>아래는 기본 규칙입니다. 현재 미션의 특수 규칙이 우선합니다.</p><ol>
      <li>내 전선은 보이고 동료의 전선은 숨겨집니다. 각 받침대는 왼쪽부터 오름차순이며, 해체해도 원래 자리를 유지합니다.</li>
      <li>첫 단서를 놓은 뒤 대장부터 순서대로 행동합니다. 전선이 없는 대원은 자동으로 차례를 건너뜁니다.</li>
      <li>협력 해체: 내 전선과 동료 전선의 값이 같으면 둘 다 해체합니다. 틀리면 실수 1회와 동료 전선의 공개 단서가 남습니다.</li>
      <li>단독 해체: 한 값의 남은 전선 전부를 내가 가진 경우에만 2개 또는 4개를 해체합니다.</li>
      <li>노란 전선은 모두 같은 값으로 취급합니다. 빨간 전선 절단은 즉시 실패입니다. 내게 빨간 전선만 남으면 안전하게 공개할 수 있습니다.</li>
      <li>더블 탐지기는 각자 게임당 1회, 파란 전선을 선언하며 같은 받침대의 2개를 가리킵니다. 일치하는 것이 있으면 동료가 그중 하나를 선택합니다.</li>
      <li>숫자·색깔·위치에 관한 비공개 정보를 말하거나 몸짓으로 암시하지 마세요. 게임이 허용한 선언과 공개 단서로만 추리합니다.</li>
    </ol><p>빨간 전선을 제외한 모든 전선을 해체하면 함께 승리합니다. 기폭 한도에 도달하거나 빨간 전선을 자르면 함께 패배합니다.</p></details>
    <section className="bb-log"><h2>작전 기록</h2><ol aria-live="polite">{state.log.slice(-8).reverse().map((entry, index) => <li key={`${state.log.length - index}-${entry}`}>{entry}</li>)}</ol></section></div>
    </div>
    {me && <footer className="bb-own-dock" aria-label="내 전선 받침대">
      {campaignControl?.wireSelection && <div className="bb-wire-selection-tray"><span>{campaignControl.label} · <strong>{campaignWireIds.length}/{campaignControl.wireSelection.max}개 선택</strong></span><button className="bb-button bb-button-primary" onClick={() => campaignRef.current?.scrollIntoView?.({ behavior: 'smooth', block: 'start' })}>미션 선택 확인하기 ↑</button></div>}
      {renderPlayer(me)}
    </footer>}
  </main>;
};

export default BombBustersGame;
