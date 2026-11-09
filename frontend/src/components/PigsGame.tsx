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

function CardFace({ kind, selected, onClick, small }: { kind: PigsCardKind; selected?: boolean; onClick?: () => void; small?: boolean }) {
  const className = ['pigs-cardface', `pigs-cardface--${kind}`, selected ? 'pigs-cardface--selected' : '', small ? 'pigs-cardface--small' : ''].filter(Boolean).join(' ');
  if (onClick) return <button type="button" className={className} aria-pressed={selected} onClick={onClick}>{CARD_LABEL[kind]}</button>;
  return <span className={className}>{CARD_LABEL[kind]}</span>;
}

const PigsGame: React.FC<PigsGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const me = state.me;
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const myTurn = state.phase === 'playing' && state.currentPlayerId === playerId;
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

  const renderApartment = (owner: PigsPlayerView, apartment: PigsApartmentView, index: number) => {
    const key = targetKey(owner.id, index);
    const selectable = myTurn && !!selected && targetSet.has(key);
    const classes = ['pigs-apt', apartment.completed ? 'pigs-apt--done' : '', selectable ? 'pigs-apt--selectable' : '',
      lastTarget === key ? 'pigs-apt--recent' : ''].filter(Boolean).join(' ');
    const floorsTopDown = apartment.floors.map((f, i) => ({ ...f, level: i + 1 })).reverse();
    const body = (
      <>
        <div className="pigs-apt__roof">
          {apartment.completed ? <span className="pigs-cardface pigs-cardface--garden pigs-cardface--flat">정원</span>
            : <span className="pigs-apt__roof-empty">{apartment.floors.length ? `${apartment.floors.length}층` : ''}</span>}
        </div>
        <div className="pigs-apt__floors">
          {floorsTopDown.map((f) => (
            <div key={f.level} className={`pigs-floor${f.concrete ? '' : ' pigs-floor--open'}${apartment.guard >= f.level ? ' pigs-floor--guarded' : ''}`} title={`${f.level}층`}>
              <span className="pigs-floor__cell pigs-floor__cell--rebar">철근</span>
              {apartment.guard === f.level && <span className="pigs-floor__guard">방범</span>}
              <span className={`pigs-floor__cell ${f.concrete ? 'pigs-floor__cell--concrete' : 'pigs-floor__cell--pending'}`}>{f.concrete ? '콘크리트' : '…'}</span>
            </div>
          ))}
          {apartment.floors.length === 0 && <div className="pigs-floor pigs-floor--none">아직 층이 없어요</div>}
        </div>
        <div className="pigs-apt__lots">
          {Array.from({ length: apartment.lots }, (_, i) => <span key={i} className="pigs-cardface pigs-cardface--lot pigs-cardface--flat">터</span>)}
          {apartment.lots === 0 && <span className="pigs-apt__lots-empty">터 없음</span>}
        </div>
        <div className="pigs-apt__pig">🐷 {index + 1}호 · {apartment.lots}평 × {apartment.completeFloors}층 = <b>{apartment.score}점</b></div>
      </>
    );
    if (selectable) {
      return <button key={index} type="button" className={classes} onClick={() => play(owner, index)} aria-label={`${owner.name}의 ${index + 1}호 아파트에 ${CARD_LABEL[selected!.kind]} 사용`}>{body}</button>;
    }
    return <div key={index} className={classes}>{body}</div>;
  };

  const renderBoard = (p: PigsPlayerView) => (
    <section key={p.id} className={`pigs-board${p.isMe ? ' pigs-board--me' : ''}${p.id === state.currentPlayerId ? ' pigs-board--turn' : ''}`} aria-label={`${p.name}의 아파트`}>
      <div className="pigs-board__head">
        <strong>{p.id === state.currentPlayerId && state.phase === 'playing' ? '▶ ' : ''}{p.name}{p.isMe ? ' (나)' : ''}</strong>
        <span className="pigs-chip">손패 {p.handCount}</span>
        <span className="pigs-chip">완공 {p.apartments.filter((a) => a.completed).length}/3</span>
        <span className="pigs-chip pigs-chip--score">{p.score}점</span>
      </div>
      <div className="pigs-board__apts">
        {p.apartments.map((a, i) => renderApartment(p, a, i))}
      </div>
    </section>
  );

  const renderHand = () => {
    if (!me) return null;
    if (state.phase === 'finished') return null;
    return (
      <section className="pigs-hand" aria-label="내 손패">
        <div className="pigs-hand__head">
          <h2>내 손패</h2>
          <p className="pigs-note">
            {myTurn ? (selected
              ? `${CARD_LABEL[selected.kind]}: ${CARD_HELP[selected.kind]} ${selected.targets.length ? '강조된 아파트를 눌러 사용하세요.' : '지금은 쓸 곳이 없어요. 버리거나 다른 카드를 고르세요.'}`
              : '카드를 고르면 쓸 수 있는 아파트가 강조됩니다. 쓸 카드가 없으면 버릴 수 있어요.')
              : `${nameOf(state.currentPlayerId)}의 차례를 기다리는 중…`}
          </p>
        </div>
        <div className="pigs-hand__cards">
          {me.hand.map((card) => (
            <div key={card.id} className={`pigs-hand__slot${myTurn && card.targets.length === 0 ? ' pigs-hand__slot--dead' : ''}`}>
              <CardFace kind={card.kind} selected={card.id === selectedId} onClick={() => setSelectedId(card.id === selectedId ? null : card.id)} />
              {myTurn && <span className="pigs-hand__hint">{card.targets.length ? `사용 가능 ${card.targets.length}곳` : '쓸 곳 없음'}</span>}
            </div>
          ))}
        </div>
        {myTurn && (
          <div className="pigs-hand__actions">
            <button type="button" className="crux-btn crux-btn--secondary" disabled={!selected}
              onClick={() => { if (selected) { send({ type: 'discard', cardId: selected.id }); setSelectedId(null); } }}>
              {selected ? `${CARD_LABEL[selected.kind]} 버리기` : '버릴 카드를 고르세요'}
            </button>
          </div>
        )}
      </section>
    );
  };

  const renderFinished = () => {
    if (state.phase !== 'finished') return null;
    const top = state.standings?.[0];
    return (
      <section className="pigs-hand pigs-finished" aria-label="최종 결과">
        <h2>공사 종료 · {state.standings?.filter((s) => s.rank === 1).map((s) => s.name).join(', ')} 승리</h2>
        {state.finisherId && <p className="pigs-note">{nameOf(state.finisherId)}이(가) 세 아파트를 모두 완성해 게임이 끝났습니다.</p>}
        <table className="pigs-table">
          <thead><tr><th>순위</th><th>돼지</th><th>점수</th><th>완공</th></tr></thead>
          <tbody>
            {(state.standings ?? []).map((s) => (
              <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                <td className="rank">{s.rank}</td>
                <td>{s.name}{s.finisher ? ' 🏁' : ''}</td>
                <td>{s.score}{top && s.rank === 1 ? ' 🏆' : ''}</td>
                <td>{s.completed}/3</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="pigs-hand__actions">
          {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
          <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
        </div>
      </section>
    );
  };

  return (
    <main className="pigs" aria-label="아기 돼지 삼형제의 아파트 짓기">
      <header className="pigs__head">
        <div className="pigs__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <h1>아기 돼지 삼형제의 아파트 짓기</h1>
        </div>
        <div className="pigs__status">
          <span className="pigs-chip">{state.phase === 'finished' ? '종료' : `${state.turn}번째 턴 · ${nameOf(state.currentPlayerId)} 차례`}</span>
          <span className="pigs-chip">덱 {state.deckCount}장</span>
          <span className="pigs-chip">버림 {state.discardCount}장{state.discardTop ? ` (맨 위 ${CARD_LABEL[state.discardTop]})` : ''}</span>
          {state.reshuffles > 0 && <span className="pigs-chip">덱 재구성 {state.reshuffles}회</span>}
        </div>
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      {renderFinished()}

      <div className="pigs__layout">
        <div className="pigs__boards">
          {ordered.map(renderBoard)}
        </div>
        <aside className="pigs__side">
          <section className="pigs-card" aria-label="규칙 요약">
            <h2>규칙 요약</h2>
            <ul className="pigs-rules">
              <li>내 턴: 1장 뽑고(자동) 1장 사용 또는 버리기.</li>
              <li>터 → 철근 → 콘크리트 순서. 콘크리트가 올라가면 터 추가 불가.</li>
              <li>다이너마이트: 상대 아파트 맨 위층 폭파. 터·정원 아파트·방범 이하 층은 불가.</li>
              <li>정원을 올리면 완공. 세 채를 모두 완공하면 게임 종료.</li>
              <li>점수: 아파트마다 터 × 완성 층 + (3층↑ 1점 / 5층↑ 2점).</li>
            </ul>
          </section>
          <section className="pigs-card" aria-label="기록">
            <h2>기록</h2>
            <ul className="pigs-log">
              {state.log.slice().reverse().slice(0, 25).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ul>
          </section>
        </aside>
      </div>

      {renderHand()}
    </main>
  );
};

export default PigsGame;
