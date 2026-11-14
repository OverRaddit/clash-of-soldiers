import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import {
  WbcAction, WbcCardValue, WbcClientState, WbcCountry, WbcMatchResult, WbcPhase, WbcRound, WbcTier,
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

const TIER_SHORT: Record<WbcTier, string> = { seed: 'S', strong: 'A', weak: 'W' };
const TIER_LABEL: Record<WbcTier, string> = { seed: '시드 +2', strong: '강팀 +1', weak: '약팀 +0' };
const ROUND_LABEL: Record<WbcRound, string> = { quarter: '8강', semi: '4강', final: '결승' };
const PHASE_LABEL: Record<WbcPhase, string> = { prebet: '선배팅', info: '정보 탐색', betting: '배팅', settled: '정산', finished: '종료' };
const SLOT_SHORT = ['점수 A', '점수 B', '점수 A', '점수 B', '승부차기', '승부차기'];
// 승부사 색: 대진표의 선배팅 점, 배팅 목록, 플레이어 목록에서 같은 사람은 같은 색으로 보인다.
const PLAYER_COLORS = ['var(--hold-blue)', 'var(--hold-green)', 'var(--hold-orange)', 'var(--hold-purple)', 'var(--hold-pink)', 'var(--hold-lime)'];

function cardText(value: WbcCardValue | null | undefined): string {
  if (value === null || value === undefined) return '?';
  return value === 'draw' ? '무승부' : String(value);
}

function useNarrow(maxWidth = 760): boolean {
  const query = `(max-width: ${maxWidth}px)`;
  const [narrow, setNarrow] = useState(() => typeof window !== 'undefined' && typeof window.matchMedia === 'function' ? window.matchMedia(query).matches : false);
  useEffect(() => {
    if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return undefined;
    const media = window.matchMedia(query);
    const update = () => setNarrow(media.matches);
    update();
    if (typeof media.addEventListener === 'function') { media.addEventListener('change', update); return () => media.removeEventListener('change', update); }
    media.addListener(update);
    return () => media.removeListener(update);
  }, [query]);
  return narrow;
}

function CardFace({ value, back = false, option = false, onClick }: { value?: WbcCardValue | null; back?: boolean; option?: boolean; onClick?: () => void }) {
  const className = ['wbc-cardface', back ? 'wbc-cardface--back' : '', value === 'draw' ? 'wbc-cardface--draw' : '', option ? 'wbc-cardface--option' : ''].filter(Boolean).join(' ');
  if (onClick) return <button type="button" className={className} onClick={onClick}>{back ? '■' : cardText(value)}</button>;
  return <span className={className}>{back ? '■' : cardText(value)}</span>;
}

function TierBadge({ tier, long = false }: { tier: WbcTier; long?: boolean }) {
  return <span className={`wbc-tier wbc-tier--${tier}`} title={TIER_LABEL[tier]}>{long ? TIER_LABEL[tier] : TIER_SHORT[tier]}</span>;
}

// 접을 수 있는 묶음: 모바일에서는 <details>, PC에서는 그대로 펼쳐 보인다.
function Fold({ narrow, title, children, defaultOpen = false }: { narrow: boolean; title: string; children: React.ReactNode; defaultOpen?: boolean }) {
  if (!narrow) return <>{children}</>;
  return (
    <details className="wbc-fold" open={defaultOpen || undefined}>
      <summary>{title}</summary>
      {children}
    </details>
  );
}

const WbcGame: React.FC<WbcGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const match = state.match;
  const me = state.me;
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const narrow = useNarrow();
  const [infoMode, setInfoMode] = useState<'peek' | 'fix'>('peek');
  const [pickedSlots, setPickedSlots] = useState<number[]>([]);
  const [betCountry, setBetCountry] = useState<string | null>(null);
  const [betNormal, setBetNormal] = useState(1);
  const [betFix, setBetFix] = useState(0);
  const [betWin, setBetWin] = useState(0);

  const matchIndex = match?.index ?? -1;
  const actionIndex = match?.actionIndex ?? -1;
  const betIndex = match?.betIndex ?? -1;
  const required = me?.betConstraints?.required ?? 0;
  const myTokens = me?.tokens ?? 1;
  // 경기·단계·차례가 바뀌면 이전 차례의 선택을 지운다 (스네이크 순서로 같은 사람이 연속 행동할 때 포함).
  // 배팅 차례가 오면 일반 토큰 개수를 현재 최고 배팅(콜)에 맞춰 시작한다.
  useEffect(() => {
    setPickedSlots([]);
    setInfoMode('peek');
    setBetCountry(null);
    setBetNormal(Math.max(1, Math.min(required || 1, myTokens)));
    setBetFix(0);
    setBetWin(0);
  }, [matchIndex, state.phase, actionIndex, betIndex, required, myTokens]);

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
  const colorById = useMemo(() => {
    const map: Record<string, string> = {};
    state.players.forEach((p, i) => { map[p.id] = PLAYER_COLORS[i % PLAYER_COLORS.length]; });
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
  const mark = (id: string, title?: string) => <span className="wbc-mark" style={{ '--mark': colorById[id] } as React.CSSProperties} title={title ?? who(id)} />;

  const myInfoTurn = state.phase === 'info' && match?.currentActor === playerId && !match.pendingFix;
  const myPendingFix = state.phase === 'info' && match?.pendingFix?.playerId === playerId && match.pendingFix.options;
  const myBetTurn = state.phase === 'betting' && match?.currentBettor === playerId;
  const turnPlayerId = state.phase === 'info' ? (match?.pendingFix?.playerId ?? match?.currentActor) : state.phase === 'betting' ? match?.currentBettor : null;
  const myTurn = turnPlayerId === playerId || (state.phase === 'prebet' && !me?.prebet) || state.phase === 'settled';
  const matchNumber = match ? (match.round === 'quarter' ? match.index + 1 : match.round === 'semi' ? match.index - 3 : 1) : 0;

  const toggleSlot = (slot: number) => {
    if (!myInfoTurn) return;
    setPickedSlots((prev) => {
      if (prev.includes(slot)) return prev.filter((s) => s !== slot);
      const limit = infoMode === 'peek' ? 2 : 1;
      return [...prev, slot].slice(-limit);
    });
  };

  const prebetMarks = (countryId: string) => state.players.filter((p) => p.prebet === countryId);

  // --- 대진표 ---
  const renderTeam = (countryId: string | null) => {
    const country = countryId ? countryById[countryId] : null;
    const live = !!countryId && !!match && (match.homeId === countryId || match.awayId === countryId) && state.phase !== 'finished';
    const classes = ['wbc-team', live ? 'wbc-team--live' : '', countryId && eliminated.has(countryId) ? 'wbc-team--out' : '',
      countryId && state.bracket.champion === countryId ? 'wbc-team--champion' : ''].filter(Boolean).join(' ');
    return (
      <div className={classes}>
        {country ? <>
          <TierBadge tier={country.tier} />
          <span className="wbc-team__name">{country.name}</span>
          <span className="wbc-marks">{prebetMarks(country.id).map((p) => <React.Fragment key={p.id}>{mark(p.id, `${p.name} 선배팅`)}</React.Fragment>)}</span>
        </> : <span className="wbc-team__empty">—</span>}
      </div>
    );
  };

  const renderBracket = () => (
    <section className="wbc-card" aria-label="토너먼트 대진표">
      <h2>대진표 <small>8강 → 결승</small></h2>
      <div className="wbc-bracket">
        <div className="wbc-bracket__round">
          <span className="wbc-bracket__label">8강</span>
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className={`wbc-bracket__pair${match && state.phase !== 'finished' && match.round === 'quarter' && match.index === i ? ' wbc-bracket__pair--now' : ''}`}>
              {renderTeam(state.bracket.quarter[i * 2])}
              {renderTeam(state.bracket.quarter[i * 2 + 1])}
            </div>
          ))}
        </div>
        <div className="wbc-bracket__later">
        <div className="wbc-bracket__round">
          <span className="wbc-bracket__label">4강</span>
          {[0, 1].map((i) => (
            <div key={i} className={`wbc-bracket__pair${match && state.phase !== 'finished' && match.round === 'semi' && match.index - 4 === i ? ' wbc-bracket__pair--now' : ''}`}>
              {renderTeam(state.bracket.semi[i * 2])}
              {renderTeam(state.bracket.semi[i * 2 + 1])}
            </div>
          ))}
        </div>
        <div className="wbc-bracket__round">
          <span className="wbc-bracket__label">결승</span>
          <div className={`wbc-bracket__pair${match && state.phase !== 'finished' && match.round === 'final' ? ' wbc-bracket__pair--now' : ''}`}>
            {renderTeam(state.bracket.final[0])}
            {renderTeam(state.bracket.final[1])}
          </div>
          <span className="wbc-bracket__label">우승</span>
          {renderTeam(state.bracket.champion)}
        </div>
        </div>
      </div>
      <p className="wbc-note">점은 각 승부사의 우승 선배팅. 우승 +5 · 준우승 +2 · 4강 +1.</p>
    </section>
  );

  // --- 경기판 ---
  const slotTags = (slot: number) => (match?.actionLog ?? []).filter((entry) => entry.slots.includes(slot)).map((entry, i) => (
    <span key={`${entry.step}-${i}`} className={`wbc-slot__tag${entry.type === 'fix' ? ' wbc-slot__tag--fix' : ''}`}>
      {who(entry.playerId)} {entry.type === 'fix' ? '조작' : '봄'}
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
      {revealed !== null && revealed !== undefined
        ? <span className={`wbc-slot__card wbc-slot__card--open${revealed === 'draw' ? ' wbc-slot__card--draw' : ''}`}>{cardText(revealed)}</span>
        : noted !== undefined
          ? <span className={`wbc-slot__card wbc-slot__card--note${noted === 'draw' ? ' wbc-slot__card--draw' : ''}`} title="내가 본 값">{cardText(noted)}</span>
          : <span className="wbc-slot__card">?</span>}
      <span className="wbc-slot__name">{SLOT_SHORT[slot]}</span>
      <span className="wbc-slot__log">{slotTags(slot)}</span>
    </>;
    if (selectable) {
      return <button key={slot} type="button" className={className} onClick={() => toggleSlot(slot)} aria-pressed={selected} aria-label={`${SLOT_SHORT[slot]} 카드 선택`}>{body}</button>;
    }
    return <div key={slot} className={className}>{body}</div>;
  };

  const renderBets = (countryId: string) => {
    if (!match) return null;
    const result = match.result;
    const bets = match.bets.filter((b) => !b.die && b.countryId === countryId);
    if (!bets.length) return <p className="wbc-note wbc-bets__empty">아직 배팅 없음</p>;
    return (
      <div className="wbc-bets" aria-label={`${name(countryId)} 패배에 건 배팅`}>
        {bets.map((b) => {
          const revealedBet = result?.bets.find((r) => r.playerId === b.playerId);
          const cls = ['wbc-bet', revealedBet?.forfeited ? 'wbc-bet--forfeit' : revealedBet?.won ? 'wbc-bet--won' : revealedBet ? 'wbc-bet--lost' : ''].filter(Boolean).join(' ');
          const parts = b.revealed
            ? [b.normal ? `일반 ${b.normal}` : '', b.fix ? `조작 ${b.fix}` : '', b.win ? `승리 ${b.win}` : ''].filter(Boolean).join(' · ')
            : `뒷면 ${b.units}개`;
          return (
            <div key={b.playerId} className={cls}>
              {mark(b.playerId)}
              <strong>{who(b.playerId)}{b.playerId === playerId ? ' (나)' : ''}</strong>
              <span className="wbc-bet__units" aria-hidden="true">{Array.from({ length: Math.min(b.units, 4) }, (_, i) => <i key={i} className={b.revealed ? '' : 'hidden'} />)}</span>
              <span className="wbc-bet__text">{parts}{revealedBet?.forfeited ? ' · 몰수' : revealedBet?.won ? ' · 적중' : revealedBet ? ' · 실패' : ''}</span>
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
    const picking = myBetTurn && betCountry === countryId;
    return (
      <div className={['wbc-side', result?.winnerId === countryId ? 'wbc-side--winner' : '', result && result.winnerId !== countryId ? 'wbc-side--loser' : '', picking ? 'wbc-side--bet' : ''].filter(Boolean).join(' ')}>
        <div className="wbc-side__head">
          <TierBadge tier={country?.tier ?? 'weak'} />
          <strong>{country?.name}</strong>
          <span className="crux-badge wbc-side__bonus">+{country?.bonus ?? 0}</span>
          {detail && <span className="wbc-side__score">{detail.goals}</span>}
        </div>
        {detail && !result?.forcedDraw && (
          <p className="wbc-note">유효슈팅 {cardText(detail.shots)} + 보너스 {detail.bonus} − 선방 {cardText(detail.saves)} − 조작 {detail.fix} = <b>{detail.goals}</b></p>
        )}
        {detail && result?.forcedDraw && <p className="wbc-note">무조건 무승부 → 승부차기</p>}
        <div className="wbc-slots">{slots.map(renderSlot)}</div>
        <h3>{country?.name} 패배에 건 배팅{fixCount ? <span className="crux-badge crux-badge--red">조작 {fixCount}</span> : null}</h3>
        {renderBets(countryId)}
      </div>
    );
  };

  // --- 행동 ---
  const renderInfoActions = () => {
    if (!match) return null;
    if (myPendingFix && match.pendingFix?.options) {
      return (
        <div className="wbc-actions">
          <div className="wbc-actions__title"><h3>{SLOT_SHORT[match.pendingFix.slot]} 칸에 남길 카드를 고르세요</h3><span className="crux-badge crux-badge--orange">YOUR TURN</span></div>
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
      return (
        <div className="wbc-actions">
          <div className="wbc-actions__title"><h3>정보 탐색</h3><span className="crux-badge">{match.actionIndex + 1}/{match.actionOrder.length}</span></div>
          <p className="wbc-note">{match.pendingFix ? `${who(match.pendingFix.playerId)}이(가) 승부 조작 중입니다.` : `${who(match.currentActor ?? '')}의 차례입니다.`} 내가 본 카드는 경기판에 파란 숫자로 남아요.</p>
        </div>
      );
    }
    const need = infoMode === 'peek' ? 2 : 1;
    return (
      <div className="wbc-actions">
        <div className="wbc-actions__title"><h3>정보 탐색 · 내 차례</h3><span className="crux-badge crux-badge--orange">YOUR TURN</span></div>
        <div className="wbc-actions__row">
          <div className="wbc-toggle" role="radiogroup" aria-label="행동 선택">
            <button type="button" aria-pressed={infoMode === 'peek'} onClick={() => { setInfoMode('peek'); setPickedSlots([]); }}>내부 정보 수집</button>
            <button type="button" aria-pressed={infoMode === 'fix'} onClick={() => { setInfoMode('fix'); setPickedSlots([]); }}>승부 조작</button>
          </div>
        </div>
        <p className="wbc-note">
          {infoMode === 'peek' ? '경기판에서 비공개 카드 2장을 골라 혼자 확인합니다.' : '경기판에서 비공개 카드 1장을 고르면 더미에서 2장을 더 뽑아 셋 중 하나를 남깁니다.'}
          {' '}선택 <b>{pickedSlots.length}/{need}</b>
        </p>
        <div className="wbc-actions__row wbc-actions__row--end">
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
      return (
        <div className="wbc-actions">
          <div className="wbc-actions__title"><h3>배팅</h3><span className="crux-badge">{match.betIndex + 1}/{match.betOrder.length}</span></div>
          <p className="wbc-note">{who(match.currentBettor ?? '')}의 배팅 차례입니다.{match.maxUnits ? ` 현재 최고 배팅 ${match.maxUnits}개.` : ''}</p>
        </div>
      );
    }
    const c = me.betConstraints ?? { required: 0, cap: match.betCap, allInAllowed: false, canRaise: true };
    const units = betNormal + betFix + betWin;
    const mixed = betWin > 0 && (betNormal > 0 || betFix > 0);
    const allIn = c.required > 0 && c.allInAllowed && betNormal === me.tokens && units < c.required;
    const raise = c.required > 0 && units > c.required;
    const amountOk = units >= 1 && units <= c.cap && (c.required === 0 || units >= c.required || allIn);
    const verb = allIn ? '올인' : raise ? '레이즈' : c.required > 0 ? '콜' : '배팅';
    const stepper = (label: string, value: number, set: (v: number) => void, max: number, cls: string) => (
      <span className={`wbc-stepper wbc-stepper--${cls}`}>
        <button type="button" onClick={() => set(Math.max(0, value - 1))} disabled={value <= 0} aria-label={`${label} 줄이기`}>−</button>
        <span><i className="wbc-mark" />{label} <output>{value}</output></span>
        <button type="button" onClick={() => set(Math.min(max, value + 1))} disabled={value >= max} aria-label={`${label} 늘리기`}>+</button>
      </span>
    );
    return (
      <div className="wbc-actions">
        <div className="wbc-actions__title"><h3>질 것 같은 나라에 배팅</h3><span className="crux-badge crux-badge--orange">YOUR TURN</span></div>
        <div className="wbc-country-pick" role="radiogroup" aria-label="패배 예상 국가">
          {[match.homeId, match.awayId].map((id) => (
            <button key={id} type="button" className={betCountry === id ? 'crux-btn crux-btn--primary' : 'crux-btn crux-btn--secondary'} aria-pressed={betCountry === id} onClick={() => setBetCountry(id)}>
              <TierBadge tier={countryById[id]?.tier ?? 'weak'} /> {name(id)}이(가) 진다
            </button>
          ))}
        </div>
        <div className="wbc-actions__row">
          {stepper('일반', betNormal, setBetNormal, Math.min(me.tokens, c.cap), 'normal')}
          {stepper('조작', betFix, setBetFix, Math.min(me.fixTokens, c.cap), 'fix')}
          {stepper('승리', betWin, setBetWin, Math.min(me.winTokens, c.cap), 'win')}
          <span className={`crux-badge${amountOk ? '' : ' crux-badge--red'}`}>합계 {units} / 최대 {c.cap}</span>
        </div>
        {c.required > 0
          ? <p className="wbc-note">현재 최고 배팅 <b>{c.required}개</b>. 같은 수를 내면 콜, {c.canRaise === false ? '상한에 닿아 더 올릴 수는 없어요.' : `더 내면 레이즈예요 (최대 ${c.cap}개).`}{c.allInAllowed ? ' 일반 토큰이 모자라면 전부 걸어 올인할 수 있어요.' : ''}</p>
          : <p className="wbc-note">첫 배팅이에요. 1~{c.cap}개를 내면 뒷사람은 그 수 이상을 내야 해요.</p>}
        <p className="wbc-note wbc-note--long">조작 토큰은 그 나라 득점을 1 깎고 정산 후 돌려받아요. 승리 토큰은 그 나라의 <b>승리</b>(상대 패배)에 건 것으로 치고, 다른 토큰과 섞어 내면 전부 몰수돼요.</p>
        {mixed && <p className="wbc-warn">승리 배팅 토큰을 다른 토큰과 섞어 내면 공개 시 전부 몰수됩니다.</p>}
        <div className="wbc-actions__row wbc-actions__row--end">
          <button type="button" className="crux-btn crux-btn--secondary" onClick={() => send({ type: 'die' })}>{narrow ? '다이' : '다이 (이번 경기 포기)'}</button>
          <button type="button" className="crux-btn crux-btn--primary" disabled={!betCountry || !amountOk}
            onClick={() => betCountry && send({ type: 'bet', countryId: betCountry, normal: betNormal, fix: betFix, win: betWin })}>
            {betCountry ? `${name(betCountry)} 패배에 ${units}개 ${verb}` : `${verb} ${units}개 — 나라를 고르세요`}
          </button>
        </div>
      </div>
    );
  };

  const renderResult = (result: WbcMatchResult) => (
    <div className="wbc-result">
      <div className="wbc-result__score">
        {name(result.homeId)} <b>{result.home.goals}</b> : <b>{result.away.goals}</b> {name(result.awayId)}
        {result.shootout.length > 0 && <span className="wbc-note"> (승부차기 {result.shootout.at(-1)?.homeScore ?? '?'} : {result.shootout.at(-1)?.awayScore ?? '?'})</span>}
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
          <div className="wbc-actions__title"><h3>우승팀 선배팅</h3>{!done && <span className="crux-badge crux-badge--orange">YOUR TURN</span>}</div>
          {done ? <p className="wbc-note">{name(done)}에 선배팅했습니다. 기다리는 중: {state.players.filter((p) => !p.prebet).map((p) => p.name).join(', ') || '없음'}</p>
            : <>
              <p className="wbc-note">일반 토큰 1개를 걸어 우승 후보를 고르세요. 우승 5개 · 준우승 2개 · 4강 1개를 마지막에 받습니다.</p>
              <div className="wbc-country-pick wbc-country-pick--grid">
                {state.bracket.quarter.map((id) => (
                  <button key={id} type="button" className="crux-btn crux-btn--secondary" onClick={() => send({ type: 'prebet', countryId: id })}>
                    <TierBadge tier={countryById[id]?.tier ?? 'weak'} /> {name(id)}
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
          <div className="wbc-actions__title"><h3>경기 결과</h3><span className="crux-badge crux-badge--green">정산 완료</span></div>
          {renderResult(match.result)}
          <div className="wbc-actions__row wbc-actions__row--end">
            <button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'next_match' })}>다음 경기로</button>
          </div>
        </div>
      );
    }
    if (state.phase === 'finished') {
      return (
        <div className="wbc-actions">
          <div className="wbc-actions__title"><h3>최종 결과 · {name(state.bracket.champion)} 우승</h3></div>
          {match?.result && renderResult(match.result)}
          <table className="wbc-standings">
            <thead><tr><th>순위</th><th>승부사</th><th>토큰</th><th>선배팅</th></tr></thead>
            <tbody>
              {(state.standings ?? []).map((s) => (
                <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                  <td className="rank">{s.rank}</td>
                  <td>{mark(s.playerId)} {s.name}</td>
                  <td>{s.tokens}</td>
                  <td>{name(s.prebet)} · {s.prebetResult}{s.prebetReward ? ` (+${s.prebetReward})` : ''}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="wbc-actions__row wbc-actions__row--end">
            <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
            {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
          </div>
        </div>
      );
    }
    return null;
  };

  const phases: WbcPhase[] = ['info', 'betting', 'settled'];
  const phaseIndex = phases.indexOf(state.phase);

  return (
    <main className="wbc" aria-label="월드 배팅 컵">
      <header className="wbc__head">
        <div className="wbc__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <span className="crux-badge crux-badge--yellow">월드 배팅 컵</span>
          <h1>{match ? `${name(match.homeId)} vs ${name(match.awayId)}` : '8강 대진 완성'}</h1>
          {match && <span className="crux-badge crux-badge--code">{ROUND_LABEL[match.round]}{match.round !== 'final' ? ` ${matchNumber}경기` : ''} · {match.index + 1}/7</span>}
        </div>
        {me && (
          <div className="wbc__wallet" aria-label="내 토큰">
            <span className="wbc-note">내 토큰</span>
            <span className="wbc-chip wbc-chip--normal"><i />일반 {me.tokens}</span>
            <span className="wbc-chip wbc-chip--fix"><i />조작 {me.fixTokens}</span>
            <span className="wbc-chip wbc-chip--win"><i />승리 {me.winTokens}</span>
            <span className="crux-badge">은행 {state.bank}</span>
          </div>
        )}
        <div className="wbc__steps" aria-label="진행 단계">
          {state.phase === 'prebet' || state.phase === 'finished'
            ? <span className="crux-badge crux-badge--orange">▲ {PHASE_LABEL[state.phase]}</span>
            : phases.map((p, i) => (
              <React.Fragment key={p}>
                {i > 0 && <span className="wbc-note">→</span>}
                <span className={`crux-badge ${i < phaseIndex ? 'crux-badge--green' : i === phaseIndex ? 'crux-badge--orange' : 'crux-badge--outline'}`}>
                  {i < phaseIndex ? '✓ ' : i === phaseIndex ? '▲ ' : ''}{PHASE_LABEL[p]}
                </span>
              </React.Fragment>
            ))}
          {turnPlayerId && <span className={`wbc-note wbc__turn${myTurn ? ' wbc__turn--me' : ''}`}>{mark(turnPlayerId)} {turnPlayerId === playerId ? '내 차례' : `${who(turnPlayerId)} 차례`}</span>}
        </div>
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="wbc__layout">
        <div className="wbc__main">
          {match ? (
            <section className="wbc-card" aria-label="현재 경기">
              <div className="wbc-board">
                {renderSide('home')}
                <div className="wbc-vs">
                  <span className="wbc-vs__label">VS</span>
                  <span className="wbc-note">공개 카드</span>
                  <div className="wbc-open">{match.openCards.map((card) => <CardFace key={card.id} value={card.value} />)}</div>
                  <span className="wbc-note">더미 {match.deckCount}</span>
                </div>
                {renderSide('away')}
              </div>
              <p className="wbc-note wbc-rule">득점 = 높은 카드 + 팀 보너스 − 낮은 카드 − 그 나라 위 조작 토큰 (0 미만 없음). 승부차기는 6→1, 7→2. 카드 25장: 0·1·6·7 각 2장, 2·3·4·5 각 4장, 무조건 무승부 1장.</p>
            </section>
          ) : (
            <section className="wbc-card" aria-label="대진 완성">
              <h2>8강 대진 완성</h2>
              <p className="wbc-note">모든 플레이어가 선배팅을 마치면 첫 경기가 시작됩니다.</p>
            </section>
          )}
          <section className={`wbc-card wbc-card--act${myTurn ? ' wbc-card--my-turn' : ''}`} aria-label="행동">
            {renderActionPanel()}
          </section>
        </div>

        <aside className="wbc__side">
          <Fold narrow={narrow} title="대진표 · 승부사들">
            {renderBracket()}
            <section className="wbc-card" aria-label="승부사들">
              <h2>승부사들</h2>
              <div className="wbc-players">
                {state.players.map((p) => (
                  <div key={p.id} className={['wbc-player', p.isMe ? 'wbc-player--me' : '', p.id === turnPlayerId ? 'wbc-player--turn' : ''].filter(Boolean).join(' ')}>
                    {mark(p.id)}
                    <strong>{p.name}{p.isMe ? ' (나)' : ''}</strong>
                    {p.id === turnPlayerId && <span className="crux-badge crux-badge--orange">차례</span>}
                    <span className="wbc-player__tokens">
                      <span className="wbc-chip wbc-chip--normal"><i />{p.tokens}</span>
                      <span className="wbc-chip wbc-chip--fix"><i />{p.fixTokens}</span>
                      <span className="wbc-chip wbc-chip--win"><i />{p.winTokens}</span>
                    </span>
                    <span className="wbc-note wbc-player__prebet">{p.prebet ? `선배팅 ${name(p.prebet)}` : '선배팅 전'}</span>
                  </div>
                ))}
              </div>
            </section>
          </Fold>
          <section className="wbc-card" aria-label="기록">
            <h2>기록</h2>
            {state.history.length > 0 && (
              <ul className="wbc-history">
                {state.history.slice().reverse().map((h) => (
                  <li key={h.matchIndex}><span className="crux-badge crux-badge--code">{ROUND_LABEL[h.round]}</span> {name(h.homeId)} {h.homeGoals}:{h.awayGoals} {name(h.awayId)}{h.shootoutRounds ? ' (승부차기)' : ''} → <b>{name(h.winnerId)}</b> · 적중 {h.winners.length ? h.winners.map(who).join(', ') : '없음'}</li>
                ))}
              </ul>
            )}
            <ol className="wbc-log">
              {state.log.slice().reverse().slice(0, 20).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ol>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default WbcGame;
