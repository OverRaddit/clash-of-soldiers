import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import { PigsAction, PigsApartmentView, PigsCardKind, PigsClientState, PigsHandCard, PigsPlayerView } from '../types/pigs.types';
import socketService from '../services/socket.service';
import './PigsGame.css';

interface PigsGameProps {
  room: GameRoom;
  playerId: string;
  state: PigsClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const CARD_LABEL: Record<PigsCardKind, string> = {
  lot: '터', rebar: '철근', concrete: '콘크리트', dynamite: '다이너마이트', guard: '방범 마감재', garden: '정원',
};
const CARD_HELP: Record<PigsCardKind, string> = {
  lot: '내 아파트의 평수를 1 늘립니다. 콘크리트가 올라간 뒤에는 추가할 수 없어요.',
  rebar: '터가 있는 내 아파트에 새 층의 뼈대를 세웁니다. 위층 콘크리트가 끝난 뒤에만 가능해요.',
  concrete: '철근만 있는 맨 위층을 완성합니다.',
  dynamite: '상대 아파트의 맨 위층을 폭파합니다. 정원이 있거나 방범 마감재가 지키는 층은 안 돼요.',
  guard: '내 아파트의 가장 높은 완성 층에 설치합니다. 그 층 이하는 다이너마이트가 통하지 않아요.',
  garden: '맨 위층이 완성된 내 아파트를 완공합니다. 이후 공격도 증축도 없어요.',
};

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

// 손패 카드: 색 띠 + 종류별 아이콘 모양 (터 = 낮은 판, 철근 = 줄무늬, 콘크리트 = 블록, 다이너마이트 = 막대, 방범 = 원, 정원 = 지붕)
function CardFace({ kind, selected, dead, onClick }: { kind: PigsCardKind; selected?: boolean; dead?: boolean; onClick?: () => void }) {
  const className = ['pigs-card', `pigs-card--${kind}`, selected ? 'pigs-card--selected' : '', dead ? 'pigs-card--dead' : ''].filter(Boolean).join(' ');
  const body = <><span className="pigs-card__icon" aria-hidden="true" /><span className="pigs-card__name">{CARD_LABEL[kind]}</span></>;
  if (onClick) return <button type="button" className={className} aria-pressed={selected} aria-label={`${CARD_LABEL[kind]} 카드`} onClick={onClick}>{body}</button>;
  return <span className={className}>{body}</span>;
}

const PigsGame: React.FC<PigsGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const me = state.me;
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const myTurn = state.phase === 'playing' && state.currentPlayerId === playerId;
  const narrow = useNarrow();
  const [selectedId, setSelectedId] = useState<string | null>(null);

  // 차례가 바뀌거나 손패가 바뀌면 선택을 지운다.
  useEffect(() => { setSelectedId(null); }, [state.turn, state.phase]);

  const selected: PigsHandCard | null = useMemo(
    () => me?.hand.find((c) => c.id === selectedId) ?? null, [me, selectedId]);
  const targetKey = (pid: string, idx: number) => `${pid}:${idx}`;
  const targetSet = useMemo(() => new Set((selected?.targets ?? []).map((t) => targetKey(t.playerId, t.apartmentIndex))), [selected]);

  const nameOf = (id: string | null | undefined) => state.players.find((p) => p.id === id)?.name ?? id ?? '';
  const send = (action: PigsAction) => socketService.pigsAction(room.id, playerId, action);

  const play = (owner: PigsPlayerView, apartmentIndex: number) => {
    if (!selected || !myTurn) return;
    if (!targetSet.has(targetKey(owner.id, apartmentIndex))) return;
    send({ type: 'play', cardId: selected.id, targetPlayerId: owner.id, apartmentIndex });
    setSelectedId(null);
  };

  const ordered = useMemo(() => {
    // 내 보드를 맨 앞에 둔다.
    const mine = state.players.filter((p) => p.isMe);
    const others = state.players.filter((p) => !p.isMe);
    return [...mine, ...others];
  }, [state.players]);

  const lastTarget = state.lastAction?.type === 'play' && state.lastAction.targetPlayerId !== undefined
    ? targetKey(state.lastAction.targetPlayerId, state.lastAction.apartmentIndex ?? -1) : null;

  // --- 아파트 한 채: 지붕(정원) / 층(철근 + 콘크리트) / 터 ---
  const renderApartment = (owner: PigsPlayerView, apartment: PigsApartmentView, index: number) => {
    const key = targetKey(owner.id, index);
    const selectable = myTurn && !!selected && targetSet.has(key);
    const classes = ['pigs-apt', apartment.completed ? 'pigs-apt--done' : '', selectable ? 'pigs-apt--target' : '',
      lastTarget === key ? 'pigs-apt--recent' : ''].filter(Boolean).join(' ');
    const floorsTopDown = apartment.floors.map((f, i) => ({ ...f, level: i + 1 })).reverse();
    const body = (
      <>
        <div className="pigs-apt__stack">
          <div className={`pigs-roof${apartment.completed ? '' : ' pigs-roof--empty'}`}>
            {apartment.completed ? '정원 · 완공' : apartment.floors.length ? `${apartment.floors.length}층` : ''}
          </div>
          {floorsTopDown.map((f) => (
            <div key={f.level} className={`pigs-floor${apartment.guard === f.level ? ' pigs-floor--guard' : ''}${apartment.guard >= f.level ? ' pigs-floor--guarded' : ''}`} title={`${f.level}층${f.concrete ? '' : ' · 콘크리트 전'}${apartment.guard >= f.level ? ' · 방범' : ''}`}>
              <span className="pigs-floor__rebar" />
              <span className={f.concrete ? 'pigs-floor__concrete' : 'pigs-floor__pending'} />
            </div>
          ))}
          <div className="pigs-lots" aria-label={`${apartment.lots}평`}>
            {apartment.lots > 0
              ? Array.from({ length: apartment.lots }, (_, i) => <span key={i} className="pigs-lot" />)
              : <span className="pigs-lot pigs-lot--none" />}
          </div>
        </div>
        <div className="pigs-apt__pig">
          <span className="pigs-pig">{index + 1}</span>{apartment.lots}평 × {apartment.completeFloors}층<b>{apartment.score}점</b>
        </div>
      </>
    );
    if (selectable) {
      return <button key={index} type="button" className={classes} onClick={() => play(owner, index)} aria-label={`${owner.name}의 ${index + 1}호 아파트에 ${CARD_LABEL[selected!.kind]} 사용`}>{body}</button>;
    }
    return <div key={index} className={classes} aria-label={`${owner.name} ${index + 1}호 · ${apartment.lots}평 ${apartment.completeFloors}층${apartment.completed ? ' 완공' : ''}`}>{body}</div>;
  };

  const renderBoard = (p: PigsPlayerView) => {
    const turn = p.id === state.currentPlayerId && state.phase === 'playing';
    return (
      <section key={p.id} className={`pigs-board${p.isMe ? ' pigs-board--me' : ''}${turn ? ' pigs-board--turn' : ''}`} aria-label={`${p.name}의 아파트`}>
        <div className="pigs-board__head">
          <span className={`pigs-avatar${p.isMe ? ' pigs-avatar--me' : ''}`} aria-hidden="true">{p.name.slice(0, 1)}</span>
          <strong>{p.name}</strong>
          {p.isMe && <span className="crux-badge">나</span>}
          {turn && <span className="crux-badge crux-badge--orange">▲ 차례</span>}
          <span className="pigs-board__stats">
            <span className="crux-badge">손패 {p.handCount}</span>
            <span className="crux-badge">완공 {p.apartments.filter((a) => a.completed).length}/3</span>
            <span className="crux-badge crux-badge--green">{p.score}점</span>
          </span>
        </div>
        <div className="pigs-board__apts">
          {p.apartments.map((a, i) => renderApartment(p, a, i))}
        </div>
      </section>
    );
  };

  // --- 행동 안내 (내 차례 / 대기) ---
  const renderAction = () => {
    if (state.phase !== 'playing') return null;
    return (
      <section className={`pigs-card-panel pigs-action${myTurn ? ' pigs-action--mine' : ''}`} aria-label="이번 차례">
        <div className="pigs-action__title">
          <h2>{myTurn ? '내 차례입니다' : `${nameOf(state.currentPlayerId)}의 차례`}</h2>
          {myTurn && <span className="crux-badge crux-badge--orange">YOUR TURN</span>}
        </div>
        {myTurn ? (
          <>
            <p className="pigs-note">카드 1장이 자동으로 뽑혔어요. 아래 손패에서 카드를 고르면 <b>쓸 수 있는 아파트</b>가 주황 점선으로 떠요. 쓸 데가 없으면 버려도 돼요.</p>
            {selected && (
              <div className="crux-banner crux-banner--info pigs-action__banner">
                <span><b>{CARD_LABEL[selected.kind]}</b> 선택 중 — {CARD_HELP[selected.kind]} {selected.targets.length ? `쓸 수 있는 곳 ${selected.targets.length}.` : '지금은 쓸 곳이 없어요. 버리거나 다른 카드를 고르세요.'}</span>
              </div>
            )}
          </>
        ) : <p className="pigs-note">{nameOf(state.currentPlayerId)}이(가) 카드를 고르고 있어요. 내 손패는 아래에서 미리 볼 수 있어요.</p>}
      </section>
    );
  };

  const rules = (
    <>
      <div className="pigs-order" aria-label="공사 순서">
        <span className="pigs-order__step pigs-order__step--lot">터</span>→<span className="pigs-order__step pigs-order__step--rebar">철근</span>→<span className="pigs-order__step pigs-order__step--concrete">콘크리트</span>→<span className="pigs-order__step pigs-order__step--garden">정원</span>
      </div>
      <ul className="pigs-rules">
        <li>내 턴: 1장 뽑고(자동) 1장 사용 또는 버리기.</li>
        <li>콘크리트가 올라가면 터는 더 못 넣어요.</li>
        <li><b className="pigs-text--red">다이너마이트</b>는 상대 맨 위층 폭파. 터·정원 아파트·방범 이하 층은 안전.</li>
        <li>정원을 올리면 완공. 세 채를 모두 완공하면 게임 종료.</li>
        <li>점수 = 터 × 완성 층 (+3층↑ 1점, 5층↑ 2점).</li>
      </ul>
    </>
  );

  const renderHand = () => {
    if (!me || state.phase === 'finished') return null;
    return (
      <footer className="pigs-dock" aria-label="내 손패">
        <div className="pigs-dock__inner">
          <div className="pigs-dock__head">
            <span className="pigs-avatar pigs-avatar--me" aria-hidden="true">{nameOf(playerId).slice(0, 1)}</span>
            <strong>{nameOf(playerId)}</strong>
            <span className="crux-badge">손패 {me.hand.length}장</span>
            {myTurn
              ? <span className="crux-badge crux-badge--orange">▲ 내 차례</span>
              : <span className="pigs-note">{nameOf(state.currentPlayerId)}의 차례를 기다리는 중…</span>}
            {myTurn && <span className="pigs-note pigs-dock__hint">카드 → 아파트 순서로 눌러요</span>}
            {myTurn && (
              <button type="button" className="crux-btn crux-btn--secondary crux-btn--sm pigs-dock__discard" disabled={!selected}
                onClick={() => { if (selected) { send({ type: 'discard', cardId: selected.id }); setSelectedId(null); } }}>
                {selected ? `${CARD_LABEL[selected.kind]} 버리기` : '버릴 카드를 고르세요'}
              </button>
            )}
          </div>
          <div className="pigs-hand">
            {me.hand.map((card) => {
              const dead = myTurn && card.targets.length === 0;
              return (
                <div key={card.id} className={`pigs-slot${myTurn && card.targets.length ? ' pigs-slot--ok' : ''}`}>
                  <CardFace kind={card.kind} selected={card.id === selectedId} dead={dead} onClick={() => setSelectedId(card.id === selectedId ? null : card.id)} />
                  <span>{myTurn ? (card.targets.length ? `사용 가능 ${card.targets.length}곳` : '쓸 곳 없음') : ' '}</span>
                </div>
              );
            })}
          </div>
        </div>
      </footer>
    );
  };

  const renderFinished = () => {
    if (state.phase !== 'finished') return null;
    return (
      <section className="pigs-card-panel pigs-action pigs-action--mine" aria-label="최종 결과">
        <div className="pigs-action__title">
          <h2>공사 종료 · {state.standings?.filter((s) => s.rank === 1).map((s) => s.name).join(', ')} 승리</h2>
          <span className="crux-badge crux-badge--green">완공</span>
        </div>
        {state.finisherId && <p className="pigs-note">{nameOf(state.finisherId)}이(가) 세 아파트를 모두 완성해 게임이 끝났습니다.</p>}
        <table className="pigs-table">
          <thead><tr><th>순위</th><th>돼지</th><th>점수</th><th>완공</th></tr></thead>
          <tbody>
            {(state.standings ?? []).map((s) => (
              <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                <td className="rank">{s.rank}</td>
                <td>{s.name}{s.finisher ? <span className="crux-badge crux-badge--pink">마무리</span> : null}</td>
                <td>{s.score}</td>
                <td>{s.completed}/3</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pigs-action__buttons">
          <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
          {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
        </div>
      </section>
    );
  };

  return (
    <main className="pigs" aria-label="아기 돼지 삼형제의 아파트 짓기">
      <header className="pigs__head">
        <div className="pigs__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <span className="crux-badge crux-badge--pink">아기 돼지 삼형제</span>
          <h1>{room.name || '아파트 짓기'}</h1>
          <span className="crux-badge crux-badge--code">{state.players.length}인</span>
        </div>
        <div className="pigs__status">
          <span className={`crux-badge${myTurn ? ' crux-badge--orange' : ''}`}>
            {state.phase === 'finished' ? '종료' : `${myTurn ? '▲ 내 차례' : `${nameOf(state.currentPlayerId)} 차례`} · ${state.turn}턴`}
          </span>
          <span className="crux-badge">덱 <strong>{state.deckCount}</strong></span>
          <span className="crux-badge">버림 <strong>{state.discardCount}</strong>{state.discardTop ? ` · 맨 위 ${CARD_LABEL[state.discardTop]}` : ''}</span>
          {state.reshuffles > 0 && <span className="crux-badge crux-badge--outline">재구성 {state.reshuffles}회</span>}
          <span className="crux-badge crux-badge--outline">먼저 3채 완공하면 종료</span>
        </div>
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="pigs__layout">
        <div className="pigs__boards">
          {renderFinished()}
          {narrow && renderAction()}
          {ordered.map(renderBoard)}
        </div>
        <aside className="pigs__side">
          {!narrow && renderAction()}
          {narrow ? (
            <details className="pigs-card-panel pigs-fold">
              <summary>공사 순서 · 규칙</summary>
              {rules}
            </details>
          ) : (
            <section className="pigs-card-panel" aria-label="규칙 요약">
              <h2>공사 순서</h2>
              {rules}
            </section>
          )}
          <section className="pigs-card-panel" aria-label="기록">
            <h2>공사 일지</h2>
            <ol className="pigs-log">
              {state.log.slice().reverse().slice(0, 25).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ol>
          </section>
        </aside>
      </div>

      {renderHand()}
    </main>
  );
};

export default PigsGame;
