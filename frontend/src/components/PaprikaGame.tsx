import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import { PaprikaAction, PaprikaClientState, PaprikaTokenKind, PaprikaTokenView } from '../types/paprika.types';
import socketService from '../services/socket.service';
import './PaprikaGame.css';

interface PaprikaGameProps {
  room: GameRoom;
  playerId: string;
  state: PaprikaClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const KIND_LABEL: Record<PaprikaTokenKind, string> = { seed: '씨앗', thief: '도둑' };
const KIND_SHORT: Record<PaprikaTokenKind, string> = { seed: '씨', thief: '도' };
// 농부 색: 토큰 뒷면·점·결과표에서 같은 사람은 같은 색
const COLORS = ['blue', 'purple', 'pink', 'lime', 'yellow', 'green'] as const;
const OUTCOME_LABEL = { festival: '🥇 축제 대성공 — 모두의 승리!', farmer: '🥈 올해의 농부', famine: '☠️ 대흉작 — 모두 패배', none: '올해의 농부 없음' } as const;

const HEX_SIZE = 36;
const SQ3 = Math.sqrt(3);
const DIRS: [number, number][] = [[1, 0], [1, -1], [0, -1], [-1, 0], [-1, 1], [0, 1]];

function hexCenter(q: number, r: number): [number, number] {
  return [HEX_SIZE * SQ3 * (q + r / 2), HEX_SIZE * 1.5 * r];
}
function hexPoints(q: number, r: number): string {
  const [x, y] = hexCenter(q, r);
  return Array.from({ length: 6 }, (_, i) => {
    const a = (Math.PI / 180) * (60 * i - 30);
    return `${(x + HEX_SIZE * Math.cos(a)).toFixed(1)},${(y + HEX_SIZE * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
}
function parseCell(id: string): [number, number] { const [q, r] = id.split(',').map(Number); return [q, r]; }
function neighborIds(id: string): string[] { const [q, r] = parseCell(id); return DIRS.map(([dq, dr]) => `${q + dq},${r + dr}`); }

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

const PaprikaGame: React.FC<PaprikaGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const narrow = useNarrow();
  const myTurn = state.phase === 'planting' && state.currentPlayerId === playerId;
  const revealed = state.phase !== 'planting';
  const [kind, setKind] = useState<PaprikaTokenKind>('seed');
  const [picked, setPicked] = useState<string | null>(null);

  // 차례·라운드가 바뀌면 고른 칸을 지운다 (토큰 종류 선택은 유지).
  useEffect(() => { setPicked(null); }, [state.currentPlayerId, state.round, state.phase]);

  const me = state.players.find((p) => p.isMe) ?? null;
  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    state.players.forEach((p, i) => { map[p.id] = COLORS[i % COLORS.length]; });
    return map;
  }, [state.players]);
  const nameOf = (id: string | null | undefined) => state.players.find((p) => p.id === id)?.name ?? id ?? '';
  const tokenByCell = useMemo(() => new Map(state.board.map((t) => [t.cell, t])), [state.board]);
  const legal = useMemo(() => new Set(state.legalCells), [state.legalCells]);
  const myCells = useMemo(() => new Set(state.board.filter((t) => t.ownerId === playerId).map((t) => t.cell)), [state.board, playerId]);
  const lastHarvest = state.harvests[state.harvests.length - 1];
  const showHarvest = revealed && lastHarvest && lastHarvest.round === state.round;
  const send = (action: PaprikaAction) => socketService.paprikaAction(room.id, playerId, action);

  const place = () => {
    if (!myTurn || !picked || !legal.has(picked)) return;
    send({ type: 'place', cell: picked, kind });
    setPicked(null);
  };

  // --- 농장 SVG ---
  const steals = useMemo(() => {
    if (!showHarvest) return [] as { from: string; to: string }[];
    return state.board.filter((t) => t.stolenBy).map((seed) => {
      // 이 씨앗을 턴 도둑: 인접한 그 주인의 살아남은 도둑 중 먼저 놓인 것
      const thief = neighborIds(seed.cell).map((n) => tokenByCell.get(n)).filter((t): t is PaprikaTokenView => !!t && t.kind === 'thief' && !t.removed && t.ownerId === seed.stolenBy).sort((a, b) => a.order - b.order)[0];
      return thief ? { from: thief.cell, to: seed.cell } : null;
    }).filter((s): s is { from: string; to: string } => !!s);
  }, [showHarvest, state.board, tokenByCell]);

  const renderFarm = () => (
    <svg className="pf-svg" viewBox="-280 -250 560 500" role="img" aria-label={revealed ? '수확 결과' : '육각 농장'}>
      <defs>
        <marker id="pf-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" fill="var(--hold-red)" /></marker>
      </defs>
      {state.cells.map((c) => {
        const occupied = tokenByCell.has(c.id);
        const isLegal = myTurn && legal.has(c.id);
        const blocked = myTurn && !occupied && !isLegal && neighborIds(c.id).some((n) => myCells.has(n));
        const cls = ['pf-hex', isLegal ? 'pf-hex--legal' : '', blocked ? 'pf-hex--blocked' : '', picked === c.id ? 'pf-hex--picked' : '', state.lastPlaced?.cell === c.id && !revealed ? 'pf-hex--recent' : ''].filter(Boolean).join(' ');
        return <polygon key={c.id} points={hexPoints(c.q, c.r)} className={cls} onClick={isLegal ? () => setPicked(c.id) : undefined} role={isLegal ? 'button' : undefined} aria-label={isLegal ? `${c.id} 칸에 놓기` : undefined} />;
      })}
      {steals.map((s, i) => {
        const [x1, y1] = hexCenter(...parseCell(s.from));
        const [x2, y2] = hexCenter(...parseCell(s.to));
        return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} className="pf-steal" />;
      })}
      {state.board.map((t) => {
        const [x, y] = hexCenter(...parseCell(t.cell));
        const label = t.kind ? KIND_SHORT[t.kind] : '?';
        return (
          <g key={t.cell} className={`pf-token${t.removed ? ' pf-token--removed' : ''}`}>
            <title>{nameOf(t.ownerId)}{t.kind ? ` · ${KIND_LABEL[t.kind]}` : ''}{t.removed ? ' · 제거됨' : t.loot ? ` · ${t.loot}개 약탈` : t.stolenBy ? ` · ${nameOf(t.stolenBy)}에게 털림` : t.harvested ? ' · 수확' : ''}</title>
            <circle cx={x} cy={y} r={17} className={`pf-tok pf-fill--${colorOf[t.ownerId]}`} />
            <text x={x} y={y} className="pf-tok-txt">{label}</text>
            {showHarvest && t.kind === 'seed' && <circle cx={x + 13} cy={y - 13} r={8} className={`pf-paprika${t.stolenBy ? ' pf-paprika--gone' : ''}`} />}
            {showHarvest && t.removed && <><line x1={x - 10} y1={y - 10} x2={x + 10} y2={y + 10} className="pf-tok-x" /><line x1={x - 10} y1={y + 10} x2={x + 10} y2={y - 10} className="pf-tok-x" /></>}
            {showHarvest && !!t.loot && <><circle cx={x + 13} cy={y - 13} r={9} className="pf-tok pf-fill--yellow" /><text x={x + 13} y={y - 13} className="pf-tok-mini">{t.loot}</text></>}
          </g>
        );
      })}
    </svg>
  );

  // --- 축제 게이지 ---
  const maxPaprika = state.tokensPerPlayer * state.players.length * state.rounds;
  const renderGoal = (compact = false) => (
    <section className={`pf-card pf-goal${compact ? ' pf-goal--compact' : ''}`} aria-label="축제 목표">
      <div className="pf-goal__head"><h2>축제까지</h2><span className="pf-note">파프리카 누적 <b>{state.total}</b> / {state.festivalGoal}</span></div>
      <div className="pf-goal__bar"><span className="pf-goal__fill" style={{ width: `${Math.min(100, (state.total / maxPaprika) * 100)}%` }} /><span className="pf-goal__mark" style={{ left: `${(state.festivalGoal / maxPaprika) * 100}%` }} /></div>
      {!compact && <div className="pf-goal__labels"><span>0</span><span>{state.total >= state.festivalGoal ? '축제 목표 달성!' : `${state.festivalGoal}개 이상이면 모두 승리`}</span><span>{maxPaprika}</span></div>}
      {!compact && <p className="pf-note">24개 이하면 1등 1명만 승리(4개 이상), 1등이 동점이면 모두 패배.</p>}
    </section>
  );

  // --- 농부들 ---
  const renderFarmers = () => (
    <section className="pf-card" aria-label="농부들">
      <h2>농부들 <small>{state.phase === 'finished' ? '최종' : `${state.round}라운드`}</small></h2>
      <div className="pf-farmers">
        {state.players.map((p) => (
          <div key={p.id} className={['pf-farmer', p.id === state.currentPlayerId ? 'pf-farmer--turn' : '', p.isMe ? 'pf-farmer--me' : ''].filter(Boolean).join(' ')}>
            <span className={`pf-farmer__dot pf-c--${colorOf[p.id]}`} />
            <strong>{p.name}</strong>
            {p.isMe && <span className="crux-badge">나{p.seeds !== null ? ` · 씨앗 ${p.seeds} 도둑 ${p.thieves}` : ''}</span>}
            {!p.isMe && revealed && p.seeds !== null && <span className="crux-badge">씨앗 {p.seeds} 도둑 {p.thieves}</span>}
            {p.id === state.currentPlayerId && <span className="crux-badge crux-badge--orange">▲</span>}
            {p.skipped && state.phase === 'planting' && <span className="crux-badge crux-badge--outline">놓을 칸 없음</span>}
            <span className="pf-farmer__placed" aria-label={`이번 라운드 ${p.placed}/${state.tokensPerPlayer} 놓음`}>
              {Array.from({ length: state.tokensPerPlayer }, (_, i) => <i key={i} className={i < p.placed ? 'on' : ''} />)}
            </span>
            <span className="pf-farmer__score">{p.paprika}</span>
          </div>
        ))}
      </div>
      <p className="pf-note">점 = 이번 라운드에 놓은 토큰. 숫자 = 누적 파프리카.</p>
    </section>
  );

  // --- 수확 요약 / 최종 결과 ---
  const renderHarvest = () => {
    if (!showHarvest) return null;
    const removed = lastHarvest.fates.filter((f) => f.removed).length;
    const rows = state.players.map((p) => {
      const mine = lastHarvest.fates.filter((f) => f.ownerId === p.id);
      const safe = mine.filter((f) => f.kind === 'seed' && f.harvested).length;
      const lost = mine.filter((f) => f.kind === 'seed' && f.stolenBy).length;
      const loot = mine.filter((f) => f.kind === 'thief').reduce((s, f) => s + (f.loot ?? 0), 0);
      const gone = mine.filter((f) => f.kind === 'thief' && f.removed).length;
      return { p, safe, lost, loot, gone, gain: lastHarvest.gains[p.id] ?? 0 };
    });
    return (
      <section className="pf-card pf-card--act" aria-label={`${lastHarvest.round}라운드 수확`}>
        <div className="pf-card__title"><h2>{lastHarvest.round}라운드 수확</h2><span className="crux-badge crux-badge--green">+{lastHarvest.total}</span></div>
        <div className="pf-harvest">
          {rows.map(({ p, safe, lost, loot, gone, gain }) => (
            <div key={p.id} className="pf-harvest__row">
              <span className={`pf-farmer__dot pf-c--${colorOf[p.id]}`} />
              <span>{p.name}{p.isMe ? ' (나)' : ''}</span>
              <span className="pf-harvest__chips">
                {safe > 0 && <span className="pf-chip pf-chip--safe">씨앗 {safe}</span>}
                {loot > 0 && <span className="pf-chip pf-chip--steal">약탈 {loot}</span>}
                {lost > 0 && <span className="pf-chip pf-chip--lost">털림 {lost}</span>}
                {gone > 0 && <span className="pf-chip pf-chip--lost">도둑 제거 {gone}</span>}
              </span>
              <b>+{gain}</b>
            </div>
          ))}
        </div>
        <p className="pf-note">도둑끼리 붙은 {removed}개가 제거됐고, 파프리카 {lastHarvest.total}개가 열렸어요. 빨간 열매 = 수확, 회색 열매 = 털림, 노란 숫자 = 도둑이 챙긴 수.</p>
        {state.phase === 'harvest' && (
          <div className="pf-card__buttons"><button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'next_round' })}>토큰 회수하고 {state.round + 1}라운드로</button></div>
        )}
      </section>
    );
  };

  const renderFinished = () => {
    if (state.phase !== 'finished' || !state.outcome) return null;
    return (
      <section className={`pf-card pf-card--act pf-final pf-final--${state.outcome}`} aria-label="최종 결과">
        <div className="pf-card__title"><h2>{OUTCOME_LABEL[state.outcome]}</h2><span className="crux-badge">총합 {state.total} / {state.festivalGoal}</span></div>
        <p className="pf-note">{state.result?.message}</p>
        <table className="pf-table">
          <thead><tr><th>순위</th><th>농부</th><th>1R</th><th>2R</th><th>파프리카</th><th></th></tr></thead>
          <tbody>
            {(state.standings ?? []).map((s) => {
              const p = state.players.find((x) => x.id === s.playerId);
              return (
                <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                  <td className="rank">{s.rank}</td>
                  <td><span className={`pf-farmer__dot pf-c--${colorOf[s.playerId]}`} /> {s.name}</td>
                  <td>{p?.roundGains[0] ?? 0}</td><td>{p?.roundGains[1] ?? 0}</td>
                  <td><b>{s.paprika}</b></td>
                  <td>{s.winner ? <span className="crux-badge crux-badge--green">승리</span> : null}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div className="pf-card__buttons">
          <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
          {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
        </div>
      </section>
    );
  };

  // --- 파종 도크 ---
  const renderDock = () => {
    if (state.phase !== 'planting' || !me) return null;
    const mySeeds = me.seeds ?? 0;
    const myThieves = me.thieves ?? 0;
    return (
      <footer className="pf-dock" aria-label="토큰 고르기">
        <div className="pf-dock__inner">
          <div className="pf-dock__head">
            <span className={`pf-farmer__dot pf-c--${colorOf[playerId]}`} /><strong>{me.name}</strong>
            {myTurn ? <span className="crux-badge crux-badge--orange">▲ 내 차례 · {me.placed + 1}/{state.tokensPerPlayer}번째</span>
              : <span className="pf-note">{nameOf(state.currentPlayerId)}의 차례를 기다리는 중… ({me.placed}/{state.tokensPerPlayer} 놓음)</span>}
            <span className="pf-note pf-dock__hint">{myTurn ? '① 토큰 종류를 고르고 ② 농장의 점선 칸을 누르세요. 남들은 색만 봅니다.' : ''}</span>
            <span className="crux-badge pf-dock__mine">내 씨앗 {mySeeds} · 도둑 {myThieves}</span>
          </div>
          <div className="pf-pick" role="radiogroup" aria-label="토큰 종류">
            <button type="button" className="pf-pick__btn" aria-pressed={kind === 'seed'} onClick={() => setKind('seed')} disabled={!myTurn}>
              <span className="pf-pick__icon pf-pick__icon--seed" aria-hidden="true">🌱</span>
              <span className="pf-pick__text"><b>씨앗</b><small>수확 때 파프리카 1개. 옆에 살아남은 도둑이 있으면 털려요.</small></span>
            </button>
            <button type="button" className="pf-pick__btn" aria-pressed={kind === 'thief'} onClick={() => setKind('thief')} disabled={!myTurn}>
              <span className="pf-pick__icon pf-pick__icon--thief" aria-hidden="true">🕵️</span>
              <span className="pf-pick__text"><b>도둑</b><small>옆 6칸의 씨앗을 모두 털어요. 다른 도둑과 붙으면 둘 다 제거.</small></span>
            </button>
            <button type="button" className="crux-btn crux-btn--primary pf-pick__go" disabled={!myTurn || !picked} onClick={place}>
              {!myTurn ? '내 차례가 아니에요' : picked ? `고른 칸에 ${KIND_LABEL[kind]} 뒷면으로 놓기` : `${KIND_LABEL[kind]} 선택됨 — 농장에서 칸을 고르세요`}
            </button>
          </div>
        </div>
      </footer>
    );
  };

  const phaseBadge = state.phase === 'planting' ? <span className="crux-badge crux-badge--green">{state.round}라운드 · 파종</span>
    : state.phase === 'harvest' ? <span className="crux-badge crux-badge--yellow">{state.round}라운드 · 수확</span>
      : <span className="crux-badge crux-badge--red">종료</span>;

  return (
    <main className="pf" aria-label="파프리카 대축제">
      <header className="pf__head">
        <div className="pf__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <span className="crux-badge crux-badge--red">파프리카 대축제</span>
          <h1>{room.name || '우정과 배신의 농장'}</h1>
          <span className="crux-badge crux-badge--code">{state.players.length}인 · 1인당 {state.tokensPerPlayer}개</span>
        </div>
        <div className="pf__status">
          {phaseBadge}
          {state.phase === 'planting' && (myTurn
            ? <span className="crux-badge crux-badge--orange">▲ 내 차례 · {(me?.placed ?? 0) + 1}/{state.tokensPerPlayer}번째 토큰</span>
            : <span className="crux-badge">{nameOf(state.currentPlayerId)} 차례</span>)}
          <span className="crux-badge">토큰 {state.board.length}/{state.tokensPerPlayer * state.players.length}</span>
        </div>
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="pf__layout">
        <div className="pf__main">
          {narrow && renderGoal(true)}
          {narrow && myTurn && <div className="crux-banner crux-banner--info pf-turn-banner"><span><strong>내 차례</strong> · 아래에서 토큰을 고르고 농장의 점선 칸을 누르세요. 내 토큰 옆은 못 놓아요.</span></div>}
          {renderFinished()}
          {narrow && renderHarvest()}
          <section className="pf-card pf-farm" aria-label="농장">
            <div className="pf-farm__head">
              <h2>{revealed ? '수확 — 모든 토큰 공개' : '공유 농장'} <small>37칸 · 토큰 {state.board.length}/{state.tokensPerPlayer * state.players.length}</small></h2>
              <span className="pf-note">{revealed ? '빨간 점선 = 도둑이 털어간 씨앗' : myTurn ? '점선 칸 = 내가 놓을 수 있는 칸 (내 토큰 옆은 안 돼요)' : '내 토큰에는 씨/도가 보이고, 남의 토큰은 색만 보여요'}</span>
            </div>
            {renderFarm()}
            <div className="pf-legend">
              {state.players.map((p) => <span key={p.id}><i className={`pf-c--${colorOf[p.id]}`} />{p.name}{p.isMe ? '(나)' : ''}</span>)}
            </div>
          </section>
        </div>
        <aside className="pf__side">
          {!narrow && renderHarvest()}
          {!narrow && renderGoal()}
          {renderFarmers()}
          {narrow ? (
            <details className="pf-card pf-fold">
              <summary>규칙 · 농장 일지</summary>
              <ul className="pf-rules">
                <li>2라운드 끝 총합 <b>{state.festivalGoal}개 이상</b>이면 모두 승리.</li>
                <li>{state.festivalGoal - 1} 이하면 1등 1명만 승리(4개 이상). 1등 동점이면 모두 패배.</li>
                <li>내 토큰 옆에는 내 토큰을 못 놓아요. 도둑끼리 붙으면 둘 다 제거, 살아남은 도둑은 옆 씨앗을 전부 털어요.</li>
              </ul>
              <ol className="pf-log">{state.log.slice().reverse().slice(0, 20).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}</ol>
            </details>
          ) : (
            <section className="pf-card" aria-label="기록">
              <h2>농장 일지</h2>
              <ol className="pf-log">{state.log.slice().reverse().slice(0, 25).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}</ol>
            </section>
          )}
        </aside>
      </div>

      {renderDock()}
    </main>
  );
};

export default PaprikaGame;
