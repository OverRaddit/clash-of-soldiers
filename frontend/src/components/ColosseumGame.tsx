import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import {
  ColoCardValue, ColoGladiator, ColoGrade, ColoMatchRecord, ColoMission, ColoMissionOffer, ColoPhase, ColoRound, ColoSide,
  ColosseumAction, ColosseumClientState,
} from '../types/colosseum.types';
import socketService from '../services/socket.service';
import './ColosseumGame.css';

interface ColosseumGameProps {
  room: GameRoom;
  playerId: string;
  state: ColosseumClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const GRADE_LABEL: Record<ColoGrade, string> = { champion: '챔피언', veteran: '베테랑', rookie: '신참' };
const ROUND_LABEL: Record<ColoRound, string> = { first: '1회전', semi: '준결승', final: '결승' };
const PHASE_LABEL: Record<ColoPhase, string> = { missions: '밀명 고르기', eve: '전야', betting: '내기', dawn: '새벽', settled: '결투 결과', finished: '대회 종료' };
const SIDE_LABEL: Record<ColoSide, string> = { red: '붉은 문', blue: '푸른 문' };
const SIDE_MARK: Record<ColoSide, string> = { red: '☀', blue: '☾' };
const SLOT_SHORT = ['무장 1', '무장 2', '무장 1', '무장 2', '결착', '결착'];
const SLOT_FULL = ['붉은 문 무장 1', '붉은 문 무장 2', '푸른 문 무장 1', '푸른 문 무장 2', '붉은 문 결착', '푸른 문 결착'];
const STATUS_LABEL = { open: '진행 중', done: '달성', failed: '실패' } as const;

function cardText(value: ColoCardValue | null | undefined): string {
  if (value === null || value === undefined) return '?';
  return value === 'whim' ? '변덕' : String(value);
}

function CardFace({ value, option = false, onClick, label }: { value: ColoCardValue; option?: boolean; onClick?: () => void; label?: string }) {
  const className = ['colo-cardface', value === 'whim' ? 'colo-cardface--whim' : '', option ? 'colo-cardface--option' : ''].filter(Boolean).join(' ');
  if (onClick) return <button type="button" className={className} onClick={onClick} aria-label={label}>{cardText(value)}</button>;
  return <span className={className}>{cardText(value)}</span>;
}

/** 등급은 투구 깃털 수로 표시한다: 챔피언 2, 베테랑 1, 신참 0. 깃털 수가 곧 유효타 보너스다. */
function GradeBadge({ gladiator }: { gladiator: ColoGladiator }) {
  return (
    <span className={`colo-grade colo-grade--${gladiator.grade}`} title={`${GRADE_LABEL[gladiator.grade]}: 유효타 +${gladiator.bonus}`}>
      <span className="colo-grade__feathers" aria-hidden="true">
        {Array.from({ length: gladiator.bonus }, (_, i) => <i key={i} />)}
      </span>
      {GRADE_LABEL[gladiator.grade]} +{gladiator.bonus}
    </span>
  );
}

function SideTag({ side, children }: { side: ColoSide; children?: React.ReactNode }) {
  return <span className={`colo-sidetag colo-sidetag--${side}`}><span aria-hidden="true">{SIDE_MARK[side]}</span> {children ?? SIDE_LABEL[side]}</span>;
}

function MissionCard({ mission, selectable, selected, onToggle }: {
  mission: ColoMission | ColoMissionOffer; selectable?: boolean; selected?: boolean; onToggle?: () => void;
}) {
  const status = 'status' in mission ? mission.status : null;
  const progress = 'status' in mission && mission.count !== null
    ? (mission.need !== null ? `${mission.count} / ${mission.need}` : `현재 ${mission.count}번`) : null;
  const body = <>
    <span className="colo-mission__head">
      <strong>{mission.name}</strong>
      <span className="colo-mission__points" title={`달성하면 ${mission.points}점`}>{mission.points}점</span>
    </span>
    <span className="colo-mission__text">{mission.text}</span>
    {status && (
      <span className="colo-mission__foot">
        <span className={`colo-status colo-status--${status}`}>{STATUS_LABEL[status]}</span>
        {progress && <span className="colo-mission__progress">{progress}</span>}
      </span>
    )}
  </>;
  const className = ['colo-mission', status ? `colo-mission--${status}` : '', selected ? 'colo-mission--selected' : ''].filter(Boolean).join(' ');
  if (selectable) return <button type="button" className={`${className} colo-mission--selectable`} aria-pressed={!!selected} onClick={onToggle}>{body}</button>;
  return <div className={className}>{body}</div>;
}

const ColosseumGame: React.FC<ColosseumGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const match = state.match;
  const me = state.me;
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const [mode, setMode] = useState<'peek' | 'swap'>('peek');
  const [pickedSlots, setPickedSlots] = useState<number[]>([]);
  const [betSide, setBetSide] = useState<ColoSide | null>(null);
  const [missionPick, setMissionPick] = useState<string[]>([]);

  const matchIndex = match?.index ?? -1;
  const actionIndex = match?.actionIndex ?? -1;
  // 경기·단계·차례가 바뀌면 이전 차례의 선택을 지운다 (스네이크 순서로 같은 사람이 연속 행동할 때 포함).
  useEffect(() => {
    setPickedSlots([]);
    setMode('peek');
    setBetSide(null);
  }, [matchIndex, state.phase, actionIndex]);

  const gladiatorById = useMemo(() => {
    const map: Record<string, ColoGladiator> = {};
    for (const g of state.gladiators) map[g.id] = g;
    return map;
  }, [state.gladiators]);
  const playerById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of state.players) map[p.id] = p.name;
    return map;
  }, [state.players]);
  const eliminated = useMemo(() => new Set(state.history.map((r) => r.loserId)), [state.history]);
  const notesBySlot = useMemo(() => {
    const map: Record<number, ColoCardValue> = {};
    for (const note of me?.notes ?? []) map[note.slot] = note.value; // 가장 최근 메모가 남는다
    return map;
  }, [me]);

  const send = (action: ColosseumAction) => socketService.colosseumAction(room.id, playerId, action);
  const who = (id: string | null | undefined) => (id ? playerById[id] ?? id : '');
  const gname = (id: string | null | undefined) => {
    const g = id ? gladiatorById[id] : null;
    return g ? `${g.type} ‘${g.nick}’` : '미정';
  };

  const lapPhase = state.phase === 'eve' || state.phase === 'dawn';
  const myTurn = lapPhase && match?.currentActor === playerId && !match.pendingSwap;
  const mySwapOptions = lapPhase && match?.pendingSwap?.playerId === playerId ? match.pendingSwap.options : null;
  const turnPlayerId = lapPhase ? (match?.pendingSwap?.playerId ?? match?.currentActor ?? null) : null;

  const toggleSlot = (slot: number) => {
    if (!myTurn) return;
    setPickedSlots((prev) => {
      if (prev.includes(slot)) return prev.filter((s) => s !== slot);
      return [...prev, slot].slice(-(mode === 'peek' ? 2 : 1));
    });
  };
  const toggleMission = (id: string) => setMissionPick((prev) => (prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id].slice(-2)));

  // --- 대진판 ---

  const renderEntrant = (gladiatorId: string | null) => {
    const g = gladiatorId ? gladiatorById[gladiatorId] : null;
    const live = !!g && !!match && (match.redId === g.id || match.blueId === g.id) && state.phase !== 'finished';
    const classes = ['colo-entrant', live ? 'colo-entrant--live' : '', g && eliminated.has(g.id) ? 'colo-entrant--out' : '',
      g && state.bracket.champion === g.id ? 'colo-entrant--champion' : ''].filter(Boolean).join(' ');
    return (
      <div className={classes}>
        {g ? <>
          <span className="colo-entrant__name"><strong>{g.nick}</strong> <small>{g.type}</small></span>
          <GradeBadge gladiator={g} />
        </> : <span className="colo-entrant__empty">미정</span>}
      </div>
    );
  };

  const renderBracket = () => (
    <section className="colo-panel colo-bracket" aria-label="대진판">
      <h2>대진판</h2>
      {([['1회전', state.bracket.first, 4], ['준결승', state.bracket.semi, 2], ['결승', state.bracket.final, 1]] as [string, (string | null)[], number][]).map(([label, slots, pairs]) => (
        <div key={label} className="colo-bracket__round">
          <span className="colo-bracket__label">{label}</span>
          {Array.from({ length: pairs }, (_, i) => (
            <div key={i} className="colo-bracket__pair">
              {renderEntrant(slots[i * 2])}
              {renderEntrant(slots[i * 2 + 1])}
            </div>
          ))}
        </div>
      ))}
      <div className="colo-bracket__round">
        <span className="colo-bracket__label">우승</span>
        {renderEntrant(state.bracket.champion)}
      </div>
      <p className="colo-note">깃털 수가 곧 유효타 보너스입니다. 등급이 낮은 쪽이 이기면 이변.</p>
    </section>
  );

  // --- 경기장 ---

  const slotTags = (slot: number) => (match?.actionLog ?? []).filter((entry) => entry.slots.includes(slot)).map((entry, i) => (
    <span key={`${entry.step}-${i}`} className={`colo-slot__tag${entry.type === 'swap' ? ' colo-slot__tag--swap' : ''}`}
      title={`${entry.lap === 1 ? '전야' : '새벽'}에 ${who(entry.playerId)}이(가) ${entry.type === 'swap' ? '바꿔치기' : '염탐'}`}>
      {entry.lap === 1 ? '전야' : '새벽'} · {entry.type === 'swap' ? '바꿔치기' : '염탐'} {who(entry.playerId)}
    </span>
  ));

  const renderSlot = (slot: number) => {
    if (!match) return null;
    const revealed = match.hiddenSlots[slot]?.value;
    const noted = notesBySlot[slot];
    const selected = pickedSlots.includes(slot);
    const className = ['colo-slot', slot >= 4 ? 'colo-slot--decider' : '', myTurn ? 'colo-slot--selectable' : '', selected ? 'colo-slot--selected' : ''].filter(Boolean).join(' ');
    const body = <>
      <span className="colo-slot__name">{SLOT_SHORT[slot]}</span>
      {revealed !== null && revealed !== undefined
        ? <span className="colo-slot__value">{cardText(revealed)}</span>
        : noted !== undefined
          ? <><span className="colo-slot__value colo-slot__value--note">{cardText(noted)}</span><span className="colo-slot__hint">내가 본 값</span></>
          : <span className="colo-slot__value colo-slot__value--unknown">?</span>}
      <span className="colo-slot__log">{slotTags(slot)}</span>
    </>;
    if (myTurn) return <button key={slot} type="button" className={className} onClick={() => toggleSlot(slot)} aria-pressed={selected} aria-label={`${SLOT_FULL[slot]} 칸`}>{body}</button>;
    return <div key={slot} className={className}>{body}</div>;
  };

  const renderGate = (side: ColoSide) => {
    if (!match) return null;
    const gladiator = gladiatorById[side === 'red' ? match.redId : match.blueId];
    const result = match.result;
    const detail = result ? result[side] : null;
    const slots = side === 'red' ? [0, 1, 4] : [2, 3, 5];
    const won = result?.winnerSide === side;
    return (
      <div className={`colo-gate colo-gate--${side}${won ? ' colo-gate--winner' : ''}`}>
        <div className="colo-gate__head">
          <SideTag side={side} />
          {detail && !result?.whim && <span className="colo-gate__hits" title="유효타">{detail.hits}</span>}
        </div>
        <div className="colo-gate__who">
          <strong>{gladiator?.nick}</strong> <small>{gladiator?.type}</small>
          {gladiator && <GradeBadge gladiator={gladiator} />}
        </div>
        {detail && !result?.whim && <p className="colo-note">검 {cardText(detail.sword)} − 족쇄 {cardText(detail.shackle)} + 등급 {detail.bonus} = 유효타 {detail.hits}</p>}
        {detail && result?.whim && <p className="colo-note">황제의 변덕 → 유효타를 따지지 않고 결착전</p>}
        {won && <p className="colo-gate__verdict">승리{result?.upset ? ' · 이변' : ''}</p>}
        <div className="colo-slots">{slots.map(renderSlot)}</div>
      </div>
    );
  };

  const renderBets = () => {
    if (!match) return null;
    const settled = !!match.result;
    return (
      <div className="colo-bets" aria-label="내기 현황">
        {match.bets.map((b) => {
          const hit = settled && match.result!.hitters.includes(b.playerId);
          const cls = ['colo-bet', b.side ? `colo-bet--${b.side}` : '', settled ? (hit ? 'colo-bet--hit' : 'colo-bet--miss') : ''].filter(Boolean).join(' ');
          return (
            <span key={b.playerId} className={cls}>
              <span>{who(b.playerId)}{b.playerId === playerId ? ' (나)' : ''}</span>
              <span>
                {b.side ? <><span aria-hidden="true">{SIDE_MARK[b.side]}</span> {SIDE_LABEL[b.side]}</> : b.placed ? '엎어 놓음' : state.phase === 'betting' ? '고르는 중' : '아직'}
                {settled ? (hit ? ' · 적중' : ' · 빗나감') : ''}
              </span>
            </span>
          );
        })}
      </div>
    );
  };

  // --- 행동 패널 ---

  const renderMissionChoice = () => {
    if (!me) return <p className="colo-note">큰손들이 밀명을 고르는 중입니다.</p>;
    const waiting = state.players.filter((p) => !p.missionsChosen).map((p) => p.name).join(', ');
    if (!me.offered) return <p className="colo-note">밀명을 골랐습니다. 기다리는 중: {waiting || '없음'}</p>;
    return (
      <div className="colo-actions">
        <h3>밀명 3장 중 2장을 고르세요</h3>
        <p className="colo-note">고른 밀명은 대회가 끝날 때 공개됩니다. 버린 한 장은 끝까지 아무도 모릅니다. 대진판을 보고 고르세요.</p>
        <div className="colo-missions colo-missions--choice">
          {me.offered.map((mission) => (
            <MissionCard key={mission.id} mission={mission} selectable selected={missionPick.includes(mission.id)} onToggle={() => toggleMission(mission.id)} />
          ))}
        </div>
        <div className="colo-actions__row">
          <button type="button" className="crux-btn crux-btn--primary" disabled={missionPick.length !== 2}
            onClick={() => send({ type: 'choose_missions', keep: missionPick })}>
            이 2장으로 확정 ({missionPick.length}/2)
          </button>
        </div>
      </div>
    );
  };

  const renderLapActions = () => {
    if (!match) return null;
    const lapName = state.phase === 'eve' ? '전야' : '새벽';
    if (mySwapOptions) {
      return (
        <div className="colo-actions">
          <h3>{SLOT_FULL[match.pendingSwap!.slot]} 칸에 남길 카드를 고르세요</h3>
          <p className="colo-note">첫 장이 원래 칸에 있던 카드, 나머지 둘은 병기고에서 꺼낸 카드입니다. 고르지 않은 두 장은 병기고 맨 아래로 갑니다.</p>
          <div className="colo-actions__row">
            {mySwapOptions.map((card, i) => (
              <span key={card.id} className="colo-swap-option">
                <CardFace value={card.value} option onClick={() => send({ type: 'swap_keep', index: i })}
                  label={`${i === 0 ? '원래 카드' : '병기고 카드'} ${cardText(card.value)} 남기기`} />
                <span className="colo-swap-option__caption">{i === 0 ? '원래 카드' : '병기고'}</span>
              </span>
            ))}
          </div>
        </div>
      );
    }
    if (!myTurn) {
      return <p className="colo-note">
        {lapName} — {match.pendingSwap ? `${who(match.pendingSwap.playerId)}이(가) 바꿔치기하는 중입니다.` : `${who(match.currentActor)}의 차례입니다.`}
        {' '}({match.actionIndex + 1}/{match.order.length})
      </p>;
    }
    const need = mode === 'peek' ? 2 : 1;
    return (
      <div className="colo-actions">
        <h3>{lapName}: 내 차례{state.phase === 'dawn' && me?.bet ? <> — 나는 <SideTag side={me.bet} />에 걸었다</> : ''}</h3>
        <div className="colo-actions__row">
          <div className="colo-toggle" role="group" aria-label="행동 선택">
            <button type="button" aria-pressed={mode === 'peek'} onClick={() => { setMode('peek'); setPickedSlots([]); }}>염탐</button>
            <button type="button" aria-pressed={mode === 'swap'} onClick={() => { setMode('swap'); setPickedSlots([]); }}>바꿔치기</button>
          </div>
          <span className="colo-note">
            {mode === 'peek' ? '비공개 카드 2장을 골라 혼자 봅니다.' : '비공개 카드 1장을 집어 병기고 위 2장과 함께 보고, 셋 중 하나를 그 칸에 남깁니다.'}
          </span>
        </div>
        <div className="colo-actions__row">
          <span className="colo-note">경기장에서 칸을 눌러 선택 ({pickedSlots.length}/{need})</span>
          <button type="button" className="crux-btn crux-btn--primary" disabled={pickedSlots.length !== need}
            onClick={() => (mode === 'peek' ? send({ type: 'peek', slots: pickedSlots }) : send({ type: 'swap_start', slot: pickedSlots[0] }))}>
            {mode === 'peek' ? '염탐하기' : '카드 집기'}
          </button>
        </div>
      </div>
    );
  };

  const renderBetActions = () => {
    if (!match) return null;
    const waiting = state.players.filter((p) => !p.hasBet).map((p) => p.name).join(', ');
    if (!me) return <p className="colo-note">내기 중입니다. 기다리는 중: {waiting}</p>;
    if (me.bet) {
      return <p className="colo-note">나는 <SideTag side={me.bet} />에 걸었습니다. 결투가 끝나야 공개됩니다. 기다리는 중: {waiting || '없음'}</p>;
    }
    return (
      <div className="colo-actions">
        <h3>이길 것 같은 문에 내기 패를 엎어 놓으세요</h3>
        <p className="colo-note">모두 동시에 겁니다. 한 번 엎어 놓으면 바꿀 수 없고, 건너뛸 수 없습니다.</p>
        <div className="colo-betpick">
          {(['red', 'blue'] as ColoSide[]).map((side) => (
            <button key={side} type="button" className={`colo-betpick__tile colo-betpick__tile--${side}`} aria-pressed={betSide === side} onClick={() => setBetSide(side)}>
              <span className="colo-betpick__mark" aria-hidden="true">{SIDE_MARK[side]}</span>
              <strong>{SIDE_LABEL[side]}</strong>
              <span>{gname(side === 'red' ? match.redId : match.blueId)}</span>
            </button>
          ))}
        </div>
        <div className="colo-actions__row">
          <button type="button" className="crux-btn crux-btn--primary" disabled={!betSide} onClick={() => betSide && send({ type: 'bet', side: betSide })}>
            {betSide ? `${SIDE_LABEL[betSide]}에 엎어 놓기` : '문을 고르세요'}
          </button>
        </div>
      </div>
    );
  };

  const renderResult = (result: ColoMatchRecord) => (
    <div className="colo-result">
      <div className="colo-result__score">
        {gname(result.redId)} {result.whim ? '–' : result.red.hits} : {result.whim ? '–' : result.blue.hits} {gname(result.blueId)}
      </div>
      <p className="colo-note"><b>{gname(result.winnerId)}</b> 승리{result.upset ? ' · 이변' : ''}{result.decider.length ? ' · 결착전' : ` · 유효타 차 ${result.margin}`}</p>
      {result.decider.length > 0 && (
        <p className="colo-note">결착전: {result.decider.map((r, i) => `${i + 1}합 ${cardText(r.red)}(${r.redScore ?? '–'}) : ${cardText(r.blue)}(${r.blueScore ?? '–'})${r.reshuffled ? ' [병기고 다시 섞음]' : ''}`).join(' → ')}</p>
      )}
      <p className="colo-note">적중: {result.hitters.length ? `${result.hitters.map(who).join(', ')} — 월계관 1개씩` : '없음'}</p>
    </div>
  );

  const renderStandings = () => (
    <table className="colo-table colo-standings">
      <thead><tr><th>순위</th><th>큰손</th><th>월계관</th><th>밀명</th><th>합계</th></tr></thead>
      <tbody>
        {(state.standings ?? []).map((s) => (
          <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
            <td className="colo-standings__rank">{s.rank}</td>
            <td>{s.name}</td>
            <td>{s.laurels}</td>
            <td>
              {s.missions.map((m) => (
                <div key={m.id} className="colo-standings__mission" title={m.text}>
                  <span className={`colo-status colo-status--${m.status}`}>{STATUS_LABEL[m.status]}</span> {m.name} {m.status === 'done' ? `+${m.points}` : `(${m.points}점)`}
                </div>
              ))}
            </td>
            <td className="colo-standings__total">{s.total}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  const renderActionPanel = () => {
    if (state.phase === 'missions') return renderMissionChoice();
    if (state.phase === 'eve' || state.phase === 'dawn') return renderLapActions();
    if (state.phase === 'betting') return renderBetActions();
    if (state.phase === 'settled' && match?.result) {
      return (
        <div className="colo-actions">
          <h3>결투 결과</h3>
          {renderResult(match.result)}
          <div className="colo-actions__row">
            <button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'next_match' })}>다음 경기로</button>
          </div>
        </div>
      );
    }
    if (state.phase === 'finished') {
      return (
        <div className="colo-actions">
          <h3>대회 종료 · {gname(state.bracket.champion)} 우승</h3>
          {match?.result && renderResult(match.result)}
          <p className="colo-note">모든 밀명이 공개되었습니다. 점수는 월계관 + 달성한 밀명 점수입니다.</p>
          {renderStandings()}
          <div className="colo-actions__row">
            {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
            <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
          </div>
        </div>
      );
    }
    return null;
  };

  // --- 대회 기록지 ---

  const renderRecordSheet = () => (
    <section className="colo-panel" aria-label="대회 기록지">
      <h2>대회 기록지</h2>
      {state.history.length === 0 ? <p className="colo-note">아직 끝난 경기가 없습니다. 공개된 내기는 여기에 쌓입니다. 남의 밀명을 추리하는 단서입니다.</p> : (
        <div className="colo-table-wrap">
          <table className="colo-table colo-record">
            <thead>
              <tr>
                <th>경기</th><th>승자</th><th>패자</th><th>차</th><th>비고</th>
                {state.players.map((p) => <th key={p.id} className={p.isMe ? 'is-me' : ''}>{p.name}</th>)}
              </tr>
            </thead>
            <tbody>
              {state.history.map((r) => (
                <tr key={r.matchIndex}>
                  <td>{ROUND_LABEL[r.round]} {r.matchIndex + 1}</td>
                  <td><SideTag side={r.winnerSide}>{gname(r.winnerId)}</SideTag></td>
                  <td>{gname(r.loserId)}</td>
                  <td>{r.decider.length ? '–' : r.margin}</td>
                  <td>{[r.decider.length ? '결착전' : '', r.upset ? '이변' : ''].filter(Boolean).join(' · ') || '–'}</td>
                  {state.players.map((p) => {
                    const side = r.bets[p.id];
                    const hit = r.hitters.includes(p.id);
                    return (
                      <td key={p.id} className={`colo-record__bet colo-record__bet--${side} ${hit ? 'is-hit' : 'is-miss'}`}
                        title={`${p.name}: ${SIDE_LABEL[side]} — ${hit ? '적중' : '빗나감'}`}>
                        <span aria-hidden="true">{SIDE_MARK[side]}</span> {hit ? '적중' : '×'}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );

  return (
    <main className="colo" aria-label="모래 위의 밀약">
      <header className="colo__head">
        <div className="colo__chips">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <h1>모래 위의 밀약</h1>
          {match && <span className="colo-chip">{ROUND_LABEL[match.round]} · {match.index + 1}/{state.totalMatches}경기</span>}
          <span className="colo-chip colo-chip--phase">{PHASE_LABEL[state.phase]}</span>
        </div>
        {me && <div className="colo__chips"><span className="colo-chip colo-chip--laurel" title="내기를 맞힐 때마다 1개, 1개에 1점">월계관 {me.laurels}</span></div>}
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="colo__layout">
        {renderBracket()}

        <div className="colo__column">
          {match ? (
            <section className="colo-panel colo-arena" aria-label="경기장">
              <h2>{ROUND_LABEL[match.round]} · {gname(match.redId)} 대 {gname(match.blueId)}</h2>
              <div className="colo-arena__gates">
                {renderGate('red')}
                {renderGate('blue')}
              </div>
              <div className="colo-open">
                <span className="colo-note">공개 카드 (이 경기에 쓰이지 않음):</span>
                {match.openCards.map((card) => <CardFace key={card.id} value={card.value} />)}
                <span className="colo-note">· 병기고 {match.deckCount}장</span>
              </div>
              {renderBets()}
              <p className="colo-note">전투 카드 25장: 0·1·6·7 각 2장, 2·3·4·5 각 4장, 황제의 변덕 1장. 유효타 = 검(큰 수) − 족쇄(작은 수) + 등급 보너스. 같으면 결착 카드를 비교하며, 결착전에서는 6을 1로, 7을 2로 셉니다.</p>
            </section>
          ) : (
            <section className="colo-panel" aria-label="대회 준비">
              <h2>여덟 검투사의 대진이 짜였습니다</h2>
              <p className="colo-note">모두 밀명을 고르면 첫 경기가 시작됩니다. 한 경기는 전야(염탐·바꿔치기) → 내기 → 새벽(역순으로 한 번 더) → 결투 순서입니다.</p>
            </section>
          )}
          <section className="colo-panel" aria-label="행동">
            {renderActionPanel()}
          </section>
        </div>

        <div className="colo__column">
          {me && me.missions.length > 0 && (
            <section className="colo-panel colo-panel--secret" aria-label="내 밀명">
              <h2>내 밀명 <small>나만 볼 수 있음</small></h2>
              <div className="colo-missions">
                {me.missions.map((mission) => <MissionCard key={mission.id} mission={mission} />)}
              </div>
            </section>
          )}
          <section className="colo-panel" aria-label="큰손들">
            <h2>큰손들</h2>
            <table className="colo-table">
              <thead><tr><th>자리</th><th>이름</th><th>월계관</th><th>상태</th></tr></thead>
              <tbody>
                {state.players.map((p, i) => (
                  <tr key={p.id} className={[p.isMe ? 'is-me' : '', p.id === turnPlayerId ? 'is-turn' : ''].filter(Boolean).join(' ')}>
                    <td>{i + 1}</td>
                    <td>{p.id === turnPlayerId ? '▶ ' : ''}{p.name}{p.isMe ? ' (나)' : ''}</td>
                    <td>{p.laurels}</td>
                    <td>{state.phase === 'missions' ? (p.missionsChosen ? '밀명 확정' : '고르는 중')
                      : state.phase === 'betting' ? (p.hasBet ? '엎어 놓음' : '고르는 중')
                      : p.id === turnPlayerId ? '행동 중' : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="colo-note">자리 순서에서 내 다음 사람이 왼쪽, 앞 사람이 오른쪽입니다.</p>
          </section>
          <section className="colo-panel" aria-label="기록">
            <h2>기록</h2>
            <ul className="colo-log">
              {state.log.slice().reverse().slice(0, 20).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ul>
          </section>
        </div>
      </div>

      {renderRecordSheet()}
    </main>
  );
};

export default ColosseumGame;
