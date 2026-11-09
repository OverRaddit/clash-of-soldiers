import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import {
  WbcAction, WbcCardValue, WbcClientState, WbcCountry, WbcMatchResult, WbcRound, WbcTier,
} from '../types/wbc.types';
import socketService from '../services/socket.service';
import './WbcGame.css';

interface WbcGameProps {
  room: GameRoom;
  playerId: string;
  state: WbcClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const TIER_LABEL: Record<WbcTier, string> = { seed: '시드 +2', strong: '강팀 +1', weak: '약팀 +0' };
const ROUND_LABEL: Record<WbcRound, string> = { quarter: '8강', semi: '4강', final: '결승' };
const SLOT_SHORT = ['점수 1', '점수 2', '점수 1', '점수 2', '승부차기', '승부차기'];

function cardText(value: WbcCardValue | null | undefined): string {
  if (value === null || value === undefined) return '?';
  return value === 'draw' ? '무승부' : String(value);
}

function CardFace({ value, back = false, option = false, onClick }: { value?: WbcCardValue | null; back?: boolean; option?: boolean; onClick?: () => void }) {
  const className = ['wbc-cardface', back ? 'wbc-cardface--back' : '', value === 'draw' ? 'wbc-cardface--draw' : '', option ? 'wbc-cardface--option' : ''].filter(Boolean).join(' ');
  if (onClick) return <button type="button" className={className} onClick={onClick}>{back ? '■' : cardText(value)}</button>;
  return <span className={className}>{back ? '■' : cardText(value)}</span>;
}

function TierBadge({ tier }: { tier: WbcTier }) {
  return <span className={`wbc-tier wbc-tier--${tier}`}>{TIER_LABEL[tier]}</span>;
}

const WbcGame: React.FC<WbcGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const match = state.match;
  const me = state.me;
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const [infoMode, setInfoMode] = useState<'peek' | 'fix'>('peek');
  const [pickedSlots, setPickedSlots] = useState<number[]>([]);
  const [betCountry, setBetCountry] = useState<string | null>(null);
  const [betNormal, setBetNormal] = useState(1);
  const [betFix, setBetFix] = useState(0);
  const [betWin, setBetWin] = useState(0);

  const matchIndex = match?.index ?? -1;
  const actionIndex = match?.actionIndex ?? -1;
  const betIndex = match?.betIndex ?? -1;
  // 경기·단계·차례가 바뀌면 이전 차례의 선택을 지운다 (스네이크 순서로 같은 사람이 연속 행동할 때 포함).
  useEffect(() => {
    setPickedSlots([]);
    setInfoMode('peek');
    setBetCountry(null);
    setBetNormal(1);
    setBetFix(0);
    setBetWin(0);
  }, [matchIndex, state.phase, actionIndex, betIndex]);

  const countryById = useMemo(() => {
    const map: Record<string, WbcCountry> = {};
    for (const c of state.countries) map[c.id] = c;
    return map;
  }, [state.countries]);
  const playerById = useMemo(() => {
    const map: Record<string, string> = {};
    for (const p of state.players) map[p.id] = p.name;
    return map;
  }, [state.players]);
  const eliminated = useMemo(() => {
    const set = new Set<string>();
    for (const h of state.history) set.add(h.winnerId === h.homeId ? h.awayId : h.homeId);
    return set;
  }, [state.history]);
  const notesBySlot = useMemo(() => {
    const map: Record<number, WbcCardValue> = {};
    for (const note of me?.notes ?? []) map[note.slot] = note.value; // 가장 최근 메모가 남는다
    return map;
  }, [me]);

  const send = (action: WbcAction) => socketService.wbcAction(room.id, playerId, action);
  const name = (id: string | null | undefined) => (id ? countryById[id]?.name ?? id : '미정');
  const who = (id: string) => playerById[id] ?? id;

  const myInfoTurn = state.phase === 'info' && match?.currentActor === playerId && !match.pendingFix;
  const myPendingFix = state.phase === 'info' && match?.pendingFix?.playerId === playerId && match.pendingFix.options;
  const myBetTurn = state.phase === 'betting' && match?.currentBettor === playerId;

  const toggleSlot = (slot: number) => {
    if (!myInfoTurn) return;
    setPickedSlots((prev) => {
      if (prev.includes(slot)) return prev.filter((s) => s !== slot);
      const limit = infoMode === 'peek' ? 2 : 1;
      return [...prev, slot].slice(-limit);
    });
  };

  const prebetMarks = (countryId: string) => state.players.filter((p) => p.prebet === countryId);

  const renderTeam = (countryId: string | null, extraClass = '') => {
    const country = countryId ? countryById[countryId] : null;
    const live = !!countryId && !!match && (match.homeId === countryId || match.awayId === countryId) && state.phase !== 'finished';
    const classes = ['wbc-team', live ? 'wbc-team--live' : '', countryId && eliminated.has(countryId) ? 'wbc-team--out' : '',
      countryId && state.bracket.champion === countryId ? 'wbc-team--champion' : '', extraClass].filter(Boolean).join(' ');
    return (
      <div className={classes}>
        {country ? <>
          <span className="wbc-team__name">{country.name}</span>
          <TierBadge tier={country.tier} />
          <span className="wbc-marks" title={prebetMarks(country.id).map((p) => p.name).join(', ')}>
            {prebetMarks(country.id).map((p) => <span key={p.id} className={`wbc-mark${p.isMe ? ' wbc-mark--me' : ''}`}>{p.name.slice(0, 1)}</span>)}
          </span>
        </> : <span className="wbc-team__empty">미정</span>}
      </div>
    );
  };

  const renderBracket = () => (
    <section className="wbc-card wbc-bracket" aria-label="토너먼트 대진표">
      <h2>대진표</h2>
      <div className="wbc-bracket__round">
        <span className="wbc-bracket__label">8강</span>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="wbc-bracket__pair">
            {renderTeam(state.bracket.quarter[i * 2])}
            {renderTeam(state.bracket.quarter[i * 2 + 1])}
          </div>
        ))}
      </div>
      <div className="wbc-bracket__round">
        <span className="wbc-bracket__label">4강</span>
        {[0, 1].map((i) => (
          <div key={i} className="wbc-bracket__pair">
            {renderTeam(state.bracket.semi[i * 2])}
            {renderTeam(state.bracket.semi[i * 2 + 1])}
          </div>
        ))}
      </div>
      <div className="wbc-bracket__round">
        <span className="wbc-bracket__label">결승</span>
        <div className="wbc-bracket__pair">
          {renderTeam(state.bracket.final[0])}
          {renderTeam(state.bracket.final[1])}
        </div>
      </div>
      <div className="wbc-bracket__round">
        <span className="wbc-bracket__label">우승</span>
        {renderTeam(state.bracket.champion)}
      </div>
      <p className="wbc-note">동그라미는 각 플레이어의 우승 선배팅. 빨간 동그라미가 나.</p>
    </section>
  );

  const slotTags = (slot: number) => (match?.actionLog ?? []).filter((entry) => entry.slots.includes(slot)).map((entry, i) => (
    <span key={`${entry.step}-${i}`} className={`wbc-slot__tag${entry.type === 'fix' ? ' wbc-slot__tag--fix' : ''}`}>
      {entry.type === 'fix' ? '조작' : '확인'} {who(entry.playerId)}
    </span>
  ));

  const renderSlot = (slot: number) => {
    if (!match) return null;
    const revealed = match.hiddenSlots[slot]?.value;
    const noted = notesBySlot[slot];
    const selectable = myInfoTurn;
    const selected = pickedSlots.includes(slot);
    const className = ['wbc-slot', slot >= 4 ? 'wbc-slot--pk' : '', selectable ? 'wbc-slot--selectable' : '', selected ? 'wbc-slot--selected' : ''].filter(Boolean).join(' ');
    const body = <>
      <span className="wbc-slot__name">{SLOT_SHORT[slot]}</span>
      {revealed !== null && revealed !== undefined
        ? <span className="wbc-slot__value wbc-slot__value--revealed">{cardText(revealed)}</span>
        : noted !== undefined
          ? <><span className="wbc-slot__value wbc-slot__value--note">{cardText(noted)}</span><span className="wbc-slot__hint">내가 본 값</span></>
          : <span className="wbc-slot__value">?</span>}
      <span className="wbc-slot__log">{slotTags(slot)}</span>
    </>;
    if (selectable) {
      return <button key={slot} type="button" className={className} onClick={() => toggleSlot(slot)} aria-pressed={selected}>{body}</button>;
    }
    return <div key={slot} className={className}>{body}</div>;
  };

  const renderBets = (countryId: string) => {
    if (!match) return null;
    const result = match.result;
    const bets = match.bets.filter((b) => !b.die && b.countryId === countryId);
    if (!bets.length) return <p className="wbc-note">아직 배팅 없음</p>;
    return (
      <div className="wbc-bets">
        {bets.map((b) => {
          const revealedBet = result?.bets.find((r) => r.playerId === b.playerId);
          const cls = ['wbc-bet', revealedBet?.forfeited ? 'wbc-bet--forfeit' : revealedBet?.won ? 'wbc-bet--won' : revealedBet ? 'wbc-bet--lost' : ''].filter(Boolean).join(' ');
          const parts = b.revealed
            ? [b.normal ? `일반 ${b.normal}` : '', b.fix ? `조작 ${b.fix}` : '', b.win ? `승리 ${b.win}` : ''].filter(Boolean).join(' · ')
            : `뒷면 ${b.units}개`;
          return (
            <div key={b.playerId} className={cls}>
              <span>{who(b.playerId)}{b.playerId === playerId ? ' (나)' : ''}</span>
              <span>{parts}{revealedBet?.forfeited ? ' · 몰수' : revealedBet?.won ? ' · 적중' : revealedBet ? ' · 실패' : ''}</span>
            </div>
          );
        })}
      </div>
    );
  };

  const renderSide = (side: 'home' | 'away') => {
    if (!match) return null;
    const countryId = side === 'home' ? match.homeId : match.awayId;
    const country = countryById[countryId];
    const result = match.result;
    const detail = result ? result[side] : null;
    const slots = side === 'home' ? [0, 1, 4] : [2, 3, 5];
    const fixCount = match.bets.filter((b) => b.revealed && b.countryId === countryId).reduce((sum, b) => sum + (b.fix ?? 0), 0);
    return (
      <div className={`wbc-side${result?.winnerId === countryId ? ' wbc-side--winner' : ''}`}>
        <div className="wbc-side__head">
          <div><strong>{country?.name}</strong> <TierBadge tier={country?.tier ?? 'weak'} /></div>
          {detail && <span className="wbc-side__score">{detail.goals}</span>}
        </div>
        {detail && !result?.forcedDraw && (
          <p className="wbc-note">유효슈팅 {cardText(detail.shots)} + 보너스 {detail.bonus} − 선방 {cardText(detail.saves)} − 조작 {detail.fix} = {detail.goals}</p>
        )}
        {detail && result?.forcedDraw && <p className="wbc-note">무조건 무승부 → 승부차기</p>}
        <div className="wbc-slots">
          {slots.map(renderSlot)}
        </div>
        <h3>배팅 ({country?.name} 패배에){fixCount ? ` · 조작 ${fixCount}` : ''}</h3>
        {renderBets(countryId)}
      </div>
    );
  };

  const renderInfoActions = () => {
    if (!match) return null;
    if (myPendingFix && match.pendingFix?.options) {
      return (
        <div className="wbc-actions">
          <h3>{SLOT_SHORT[match.pendingFix.slot]} 칸에 남길 카드를 고르세요</h3>
          <p className="wbc-note">첫 장이 원래 칸에 있던 카드, 나머지 둘은 더미에서 뽑은 카드입니다. 고르지 않은 두 장은 더미 맨 아래로 갑니다.</p>
          <div className="wbc-actions__row">
            {match.pendingFix.options.map((card, i) => (
              <CardFace key={card.id} value={card.value} option onClick={() => send({ type: 'fix_keep', index: i })} />
            ))}
          </div>
        </div>
      );
    }
    if (!myInfoTurn) {
      return <p className="wbc-note">
        {match.pendingFix ? `${who(match.pendingFix.playerId)}이(가) 승부 조작 중입니다.` : `${who(match.currentActor ?? '')}의 정보 탐색 차례입니다.`}
        {' '}({match.actionIndex + 1}/{match.actionOrder.length})
      </p>;
    }
    const need = infoMode === 'peek' ? 2 : 1;
    return (
      <div className="wbc-actions">
        <div className="wbc-actions__row">
          <div className="wbc-toggle" role="radiogroup" aria-label="행동 선택">
            <button type="button" aria-pressed={infoMode === 'peek'} onClick={() => { setInfoMode('peek'); setPickedSlots([]); }}>내부 정보 수집</button>
            <button type="button" aria-pressed={infoMode === 'fix'} onClick={() => { setInfoMode('fix'); setPickedSlots([]); }}>승부 조작</button>
          </div>
          <span className="wbc-note">
            {infoMode === 'peek' ? '비공개 카드 2장을 골라 혼자 확인합니다.' : '비공개 카드 1장을 고르면 더미에서 2장을 더 뽑아 셋 중 하나를 남깁니다.'}
          </span>
        </div>
        <div className="wbc-actions__row">
          <span className="wbc-note">위 경기판에서 카드 칸을 눌러 선택 ({pickedSlots.length}/{need})</span>
          <button type="button" className="crux-btn crux-btn--primary" disabled={pickedSlots.length !== need}
            onClick={() => infoMode === 'peek' ? send({ type: 'peek', slots: pickedSlots }) : send({ type: 'fix_start', slot: pickedSlots[0] })}>
            {infoMode === 'peek' ? '카드 확인' : '조작 시작'}
          </button>
        </div>
      </div>
    );
  };

  const renderBetActions = () => {
    if (!match || !me) return null;
    if (!myBetTurn) {
      return <p className="wbc-note">{who(match.currentBettor ?? '')}의 배팅 차례입니다. ({match.betIndex + 1}/{match.betOrder.length})</p>;
    }
    const c = me.betConstraints ?? { required: 0, cap: match.betCap, allInAllowed: false };
    const units = betNormal + betFix + betWin;
    const mixed = betWin > 0 && (betNormal > 0 || betFix > 0);
    const allIn = c.required > 0 && c.allInAllowed && betNormal === me.tokens && units <= c.required;
    const amountOk = units >= 1 && units <= c.cap && (c.required === 0 ? true : units === c.required || allIn);
    const stepper = (label: string, value: number, set: (v: number) => void, max: number, cls: string) => (
      <span className={`wbc-stepper wbc__chip--${cls}`}>
        {label}
        <button type="button" onClick={() => set(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`${label} 줄이기`}>−</button>
        <output>{value}</output>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} 늘리기`}>+</button>
      </span>
    );
    return (
      <div className="wbc-actions">
        <h3>질 것 같은 나라에 배팅</h3>
        <div className="wbc-country-pick">
          {[match.homeId, match.awayId].map((id) => (
            <button key={id} type="button" aria-pressed={betCountry === id} onClick={() => setBetCountry(id)}>
              <strong>{name(id)} 패배</strong>
              <TierBadge tier={countryById[id]?.tier ?? 'weak'} />
            </button>
          ))}
        </div>
        <div className="wbc-actions__row">
          {stepper('일반', betNormal, setBetNormal, Math.min(me.tokens, c.cap), 'normal')}
          {stepper('조작', betFix, setBetFix, Math.min(me.fixTokens, c.cap), 'fix')}
          {stepper('승리', betWin, setBetWin, Math.min(me.winTokens, c.cap), 'win')}
          <span className="wbc-note">합계 {units}개 / 최대 {c.cap}개</span>
        </div>
        {c.required > 0 && <p className="wbc-note">현재 최고 배팅은 {c.required}개입니다. 같은 수를 내야 참여할 수 있어요.{c.allInAllowed ? ' 일반 토큰이 모자라면 전부 걸어 올인할 수 있어요.' : ''}</p>}
        <p className="wbc-note">승리 배팅 토큰은 그 나라의 <b>승리</b>(상대 패배)에 건 것으로 칩니다. 조작 토큰은 그 나라의 점수를 1씩 깎습니다.</p>
        {mixed && <p className="wbc-warn">승리 배팅 토큰을 다른 토큰과 섞어 내면 공개 시 전부 몰수됩니다.</p>}
        <div className="wbc-actions__row">
          <button type="button" className="crux-btn crux-btn--primary" disabled={!betCountry || !amountOk}
            onClick={() => betCountry && send({ type: 'bet', countryId: betCountry, normal: betNormal, fix: betFix, win: betWin })}>
            배팅 {units}개{allIn ? ' (올인)' : ''}
          </button>
          <button type="button" className="crux-btn crux-btn--secondary" onClick={() => send({ type: 'die' })}>다이 (참여 안 함)</button>
        </div>
      </div>
    );
  };

  const renderResult = (result: WbcMatchResult) => (
    <div className="wbc-result">
      <div className="wbc-result__score">
        {name(result.homeId)} {result.home.goals} : {result.away.goals} {name(result.awayId)}
        {result.shootout.length > 0 && <span> (승부차기 {result.shootout.at(-1)?.homeScore ?? '?'} : {result.shootout.at(-1)?.awayScore ?? '?'})</span>}
      </div>
      <p className="wbc-note"><b>{name(result.winnerId)}</b> 승리{result.upset ? ' · 역배' : ''}</p>
      {result.shootout.length > 0 && (
        <p className="wbc-note">승부차기: {result.shootout.map((r, i) => `${i + 1}차 ${cardText(r.home)}(${r.homeScore ?? '-'}) : ${cardText(r.away)}(${r.awayScore ?? '-'})${r.reshuffled ? ' [더미 재섞음]' : ''}`).join(' → ')}</p>
      )}
      <table>
        <tbody>
          <tr><th>판돈</th><td>{result.pot}개</td></tr>
          <tr><th>적중</th><td>{result.winners.length ? `${result.winners.map(who).join(', ')} · ${result.payoutEach}개씩` : '없음 (판돈은 공용 더미로)'}</td></tr>
          {result.bonuses.map((b, i) => <tr key={i}><th>보너스</th><td>{who(b.playerId)} +{b.amount} ({b.reason})</td></tr>)}
        </tbody>
      </table>
    </div>
  );

  const renderActionPanel = () => {
    if (state.phase === 'prebet') {
      const done = me?.prebet;
      return (
        <div className="wbc-actions">
          <h3>우승팀 선배팅</h3>
          {done ? <p className="wbc-note">{name(done)}에 선배팅했습니다. 다른 플레이어를 기다리는 중: {state.players.filter((p) => !p.prebet).map((p) => p.name).join(', ') || '없음'}</p>
            : <>
              <p className="wbc-note">일반 토큰 1개를 걸어 우승 후보를 고르세요. 우승 5개 · 준우승 2개 · 4강 1개를 마지막에 받습니다.</p>
              <div className="wbc-country-pick">
                {state.bracket.quarter.map((id) => (
                  <button key={id} type="button" onClick={() => send({ type: 'prebet', countryId: id })}>
                    <strong>{name(id)}</strong>
                    <TierBadge tier={countryById[id]?.tier ?? 'weak'} />
                  </button>
                ))}
              </div>
            </>}
        </div>
      );
    }
    if (state.phase === 'info') return renderInfoActions();
    if (state.phase === 'betting') return renderBetActions();
    if (state.phase === 'settled' && match?.result) {
      return (
        <div className="wbc-actions">
          <h3>경기 결과</h3>
          {renderResult(match.result)}
          <div className="wbc-actions__row">
            <button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'next_match' })}>다음 경기로</button>
          </div>
        </div>
      );
    }
    if (state.phase === 'finished') {
      return (
        <div className="wbc-actions">
          <h3>최종 결과 · {name(state.bracket.champion)} 우승</h3>
          {match?.result && renderResult(match.result)}
          <table className="wbc-players wbc-standings">
            <thead><tr><th>순위</th><th>승부사</th><th>토큰</th><th>선배팅</th></tr></thead>
            <tbody>
              {(state.standings ?? []).map((s) => (
                <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                  <td className="rank">{s.rank}</td>
                  <td>{s.name}</td>
                  <td>{s.tokens}</td>
                  <td>{name(s.prebet)} · {s.prebetResult}{s.prebetReward ? ` (+${s.prebetReward})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="wbc-actions__row">
            {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
            <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
          </div>
        </div>
      );
    }
    return null;
  };

  const turnPlayerId = state.phase === 'info' ? (match?.pendingFix?.playerId ?? match?.currentActor) : state.phase === 'betting' ? match?.currentBettor : null;
  const matchNumber = match ? (match.round === 'quarter' ? match.index + 1 : match.round === 'semi' ? match.index - 3 : 1) : 0;

  return (
    <main className="wbc" aria-label="월드 배팅 컵">
      <header className="wbc__head">
        <div className="wbc__wallet">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <h1>월드 배팅 컵</h1>
          {match && <span className="wbc__chip">{ROUND_LABEL[match.round]} {match.round !== 'final' ? `${matchNumber}경기` : ''} · {match.index + 1}/7</span>}
          <span className="wbc__chip">단계: {state.phase === 'prebet' ? '선배팅' : state.phase === 'info' ? '정보 탐색' : state.phase === 'betting' ? '배팅' : state.phase === 'settled' ? '정산' : '종료'}</span>
        </div>
        {me && (
          <div className="wbc__wallet" aria-label="내 토큰">
            <span className="wbc__chip wbc__chip--normal">일반 {me.tokens}</span>
            <span className="wbc__chip wbc__chip--fix">조작 {me.fixTokens}</span>
            <span className="wbc__chip wbc__chip--win">승리 {me.winTokens}</span>
            <span className="wbc__chip">공용 더미 {state.bank}</span>
          </div>
        )}
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="wbc__layout">
        {renderBracket()}

        <div className="crux-stack" style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {match ? (
            <section className="wbc-card" aria-label="현재 경기">
              <h2>{ROUND_LABEL[match.round]} · {name(match.homeId)} 대 {name(match.awayId)}</h2>
              <div className="wbc-board">
                {renderSide('home')}
                {renderSide('away')}
              </div>
              <div className="wbc-open">
                <span className="wbc-note">공개 카드:</span>
                {match.openCards.map((card) => <CardFace key={card.id} value={card.value} />)}
                <span className="wbc-note">· 더미 {match.deckCount}장</span>
              </div>
              <p className="wbc-note">스코어 카드 25장: 0·1·6·7 각 2장, 2·3·4·5 각 4장, 무조건 무승부 1장. 득점 = 높은 카드 + 팀 보너스 − 낮은 카드 − 조작 토큰 (0 미만 없음). 승부차기에서 6은 1, 7은 2로 계산.</p>
            </section>
          ) : (
            <section className="wbc-card" aria-label="대진 완성">
              <h2>8강 대진 완성</h2>
              <p className="wbc-note">모든 플레이어가 선배팅을 마치면 첫 경기가 시작됩니다.</p>
            </section>
          )}
          <section className="wbc-card" aria-label="행동">
            {renderActionPanel()}
          </section>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <section className="wbc-card" aria-label="승부사들">
            <h2>승부사들</h2>
            <table className="wbc-players">
              <thead><tr><th>이름</th><th>일반</th><th>조작</th><th>승리</th><th>선배팅</th></tr></thead>
              <tbody>
                {state.players.map((p) => (
                  <tr key={p.id} className={[p.isMe ? 'is-me' : '', p.id === turnPlayerId ? 'is-turn' : ''].filter(Boolean).join(' ')}>
                    <td>{p.id === turnPlayerId ? '▶ ' : ''}{p.name}</td>
                    <td>{p.tokens}</td>
                    <td>{p.fixTokens}</td>
                    <td>{p.winTokens}</td>
                    <td>{p.prebet ? name(p.prebet) : '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {state.history.length > 0 && <>
              <h3>지난 경기</h3>
              <ul className="wbc-log">
                {state.history.slice().reverse().map((h) => (
                  <li key={h.matchIndex}>{ROUND_LABEL[h.round]} {name(h.homeId)} {h.homeGoals}:{h.awayGoals} {name(h.awayId)}{h.shootoutRounds ? ' (승부차기)' : ''} → {name(h.winnerId)} · 적중 {h.winners.length ? h.winners.map(who).join(', ') : '없음'}</li>
                ))}
              </ul>
            </>}
          </section>
          <section className="wbc-card" aria-label="기록">
            <h2>기록</h2>
            <ul className="wbc-log">
              {state.log.slice().reverse().slice(0, 20).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ul>
          </section>
        </div>
      </div>
    </main>
  );
};

export default WbcGame;
