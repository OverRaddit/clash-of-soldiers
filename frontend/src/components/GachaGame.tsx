import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import { GachaAction, GachaCard, GachaClientState, GachaKind, GachaOffer, GachaPlayerView, GachaTradeItem } from '../types/gacha.types';
import socketService from '../services/socket.service';
import './GachaGame.css';

interface GachaGameProps {
  room: GameRoom;
  playerId: string;
  state: GachaClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

export const KINDS: GachaKind[] = ['A', 'B', 'C', 'D'];
const KIND_NAME: Record<GachaKind, string> = { A: '토끼', B: '고양이', C: '곰', D: '펭귄' };
const KIND_EMOJI: Record<GachaKind, string> = { A: '🐰', B: '🐱', C: '🐻', D: '🐧' };
const PHASE_LABEL: Record<GachaClientState['phase'], string> = {
  setup: '최애·차애 고르기', stocking: '사장님 진열 중', pulling: '가챠 돌리기', trading: '교환 시간', finished: '종료',
};

export function kindLabel(kind: GachaKind): string { return `${kind} ${KIND_NAME[kind]}`; }
function itemLabel(item: GachaTradeItem): string { return item.type === 'coin' ? '코인 1개' : `${kindLabel(item.kind)} 카드`; }
function parseItem(key: string): GachaTradeItem {
  return key === 'coin' ? { type: 'coin' } : { type: 'card', kind: key.slice(5) as GachaKind };
}

function CardFace({ kind, small, selected, badge, onClick, disabled, label }: {
  kind: GachaKind; small?: boolean; selected?: boolean; badge?: string; onClick?: () => void; disabled?: boolean; label?: string;
}) {
  const className = ['gacha-cardface', `gacha-cardface--${kind}`, small ? 'gacha-cardface--small' : '', selected ? 'gacha-cardface--selected' : ''].filter(Boolean).join(' ');
  const body = <><span className="gacha-cardface__emoji">{KIND_EMOJI[kind]}</span><span className="gacha-cardface__name">{kindLabel(kind)}</span>{badge && <span className="gacha-cardface__badge">{badge}</span>}</>;
  if (onClick) return <button type="button" className={className} onClick={onClick} disabled={disabled} aria-pressed={selected} aria-label={label ?? kindLabel(kind)}>{body}</button>;
  return <span className={className} aria-label={label ?? kindLabel(kind)}>{body}</span>;
}

const GachaGame: React.FC<GachaGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const me = state.me;
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const isOwner = !!me?.isOwner;
  const isCustomer = !!me && !isOwner && state.phase !== 'setup';
  const myPullTurn = state.phase === 'pulling' && state.currentPlayerId === playerId;
  const nameOf = (id: string | null | undefined) => state.players.find((p) => p.id === id)?.name ?? id ?? '';
  const send = (action: GachaAction) => socketService.gachaAction(room.id, playerId, action);

  // 세팅: 최애 → 차애 순서로 고른다.
  const [picks, setPicks] = useState<GachaKind[]>([]);
  // 진열: 사장님이 넣을 카드
  const [stockIds, setStockIds] = useState<string[]>([]);
  // 교환 제안 폼
  const [offerTo, setOfferTo] = useState('');
  const [giveKey, setGiveKey] = useState('coin');
  const [wantKey, setWantKey] = useState('card:A');

  useEffect(() => { setStockIds([]); }, [state.round, state.phase]);

  const customers = useMemo(() => state.players.filter((p) => p.id !== state.ownerId), [state.players, state.ownerId]);
  const tradePartners = useMemo(() => customers.filter((p) => !p.isMe), [customers]);
  useEffect(() => {
    if (!tradePartners.some((p) => p.id === offerTo)) setOfferTo(tradePartners[0]?.id ?? '');
  }, [tradePartners, offerTo]);

  const myOutgoing = state.offers.find((o) => o.from === playerId);
  const giveOptions = useMemo(() => {
    if (!me) return [];
    const options: { key: string; label: string }[] = [];
    if (me.coins > 0) options.push({ key: 'coin', label: '코인 1개' });
    for (const kind of KINDS) if (me.kindCounts[kind] > 0) options.push({ key: `card:${kind}`, label: `${kindLabel(kind)} 카드 (${me.kindCounts[kind]}장)` });
    return options;
  }, [me]);
  useEffect(() => {
    if (giveOptions.length && !giveOptions.some((o) => o.key === giveKey)) setGiveKey(giveOptions[0].key);
  }, [giveOptions, giveKey]);

  const submitOffer = () => {
    if (!offerTo) return;
    const give = parseItem(giveKey);
    const want = parseItem(wantKey);
    send({ type: 'offer', to: offerTo, give, want });
  };

  // --- 단계별 패널 ---

  const renderSetup = () => {
    if (!me) return null;
    if (me.favorites) {
      const waiting = state.players.filter((p) => !p.chosen).map((p) => p.name);
      return (
        <section className="gacha-panel" aria-label="최애·차애 선택 완료">
          <h2>최애·차애를 정했어요</h2>
          <div className="gacha-row">
            <CardFace kind={me.favorites.first} badge="최애 3점" />
            <CardFace kind={me.favorites.second} badge="차애 2점" />
          </div>
          <p className="gacha-note">{waiting.length ? `${waiting.join(', ')}이(가) 고르는 중…` : '곧 1라운드가 시작됩니다.'}</p>
        </section>
      );
    }
    const first = picks[0];
    const second = picks[1];
    return (
      <section className="gacha-panel" aria-label="최애·차애 고르기">
        <h2>최애와 차애를 고르세요</h2>
        <p className="gacha-note">첫 번째로 누른 캐릭터가 <b>최애(카드 1장당 3점)</b>, 두 번째가 <b>차애(2점)</b>가 됩니다. 끝까지 비밀이에요.</p>
        <div className="gacha-row">
          {me.setupCards.map((card) => {
            const index = picks.indexOf(card.kind);
            return <CardFace key={card.id} kind={card.kind} selected={index >= 0} badge={index === 0 ? '최애' : index === 1 ? '차애' : undefined}
              label={`${kindLabel(card.kind)} 고르기`}
              onClick={() => setPicks((prev) => prev.includes(card.kind) ? prev.filter((k) => k !== card.kind) : prev.length >= 2 ? prev : [...prev, card.kind])} />;
          })}
        </div>
        <div className="gacha-actions">
          <button type="button" className="crux-btn crux-btn--primary" disabled={!first || !second}
            onClick={() => { if (first && second) send({ type: 'choose', first, second }); }}>
            {first && second ? `최애 ${kindLabel(first)} · 차애 ${kindLabel(second)}로 확정` : '캐릭터 2개를 고르세요'}
          </button>
          <button type="button" className="crux-btn crux-btn--ghost" disabled={!picks.length} onClick={() => setPicks([])}>다시 고르기</button>
        </div>
      </section>
    );
  };

  const renderStocking = () => {
    if (!isOwner || !me) {
      return (
        <section className="gacha-panel" aria-label="진열 대기">
          <h2>{nameOf(state.ownerId)} 사장님이 가챠기계에 카드를 넣는 중</h2>
          <p className="gacha-note">덱에서 {state.drawnCount}장을 가져가 그중 1~{state.drawnCount}장을 고릅니다. 넣지 않은 카드는 덱 맨 아래로 돌아가요.</p>
        </section>
      );
    }
    return (
      <section className="gacha-panel" aria-label="가챠기계 진열">
        <h2>사장님: 가챠기계에 넣을 카드를 고르세요</h2>
        <p className="gacha-note">손님들은 코인 1개를 내고 뒷면 카드를 뽑습니다. 코인은 사장님 몫. 넣지 않은 카드는 덱 맨 아래로 돌아가고, 칸 순서는 섞여서 사장님도 어디에 뭐가 있는지 몰라요.</p>
        <div className="gacha-row">
          {me.drawn.map((card) => (
            <CardFace key={card.id} kind={card.kind} selected={stockIds.includes(card.id)} label={`${kindLabel(card.kind)} 진열`}
              onClick={() => setStockIds((prev) => prev.includes(card.id) ? prev.filter((id) => id !== card.id) : [...prev, card.id])} />
          ))}
        </div>
        <div className="gacha-actions">
          <button type="button" className="crux-btn crux-btn--primary" disabled={stockIds.length === 0}
            onClick={() => send({ type: 'stock', cardIds: stockIds })}>
            {stockIds.length ? `${stockIds.length}장 진열하기` : '1장 이상 고르세요'}
          </button>
          <button type="button" className="crux-btn crux-btn--ghost" onClick={() => setStockIds(me.drawn.map((c) => c.id))}>전부 넣기</button>
        </div>
      </section>
    );
  };

  const renderPulling = () => (
    <section className="gacha-panel gacha-machine" aria-label="가챠기계">
      <h2>🎰 가챠기계 · 뒷면 카드 {state.machineCount}장</h2>
      <p className="gacha-note">
        {myPullTurn ? (me && me.coins > 0 ? '칸 하나를 눌러 코인 1개로 뽑거나, 이번 라운드 뽑기를 마치세요.' : '코인이 없어 뽑을 수 없어요.')
          : isOwner ? '손님들이 가챠를 돌리는 중. 코인은 사장님 몫이에요.'
            : `${nameOf(state.currentPlayerId)}의 차례를 기다리는 중…`}
      </p>
      <div className="gacha-row">
        {Array.from({ length: state.machineCount }, (_, slot) => (
          <button key={slot} type="button" className="gacha-capsule" disabled={!myPullTurn || !me || me.coins <= 0}
            aria-label={`${slot + 1}번 칸 뽑기`} onClick={() => send({ type: 'pull', slot })}>?</button>
        ))}
      </div>
      {myPullTurn && (
        <div className="gacha-actions">
          <button type="button" className="crux-btn crux-btn--secondary" onClick={() => send({ type: 'pass' })}>이번 라운드 뽑기 마치기</button>
        </div>
      )}
    </section>
  );

  const renderOffer = (offer: GachaOffer) => {
    const mineOut = offer.from === playerId;
    const mineIn = offer.to === playerId;
    return (
      <li key={offer.id} className={`gacha-offer${mineIn ? ' gacha-offer--in' : ''}${mineOut ? ' gacha-offer--out' : ''}`}>
        <span><b>{nameOf(offer.from)}</b> → <b>{nameOf(offer.to)}</b>: {itemLabel(offer.give)} 주고 {itemLabel(offer.want)} 받기</span>
        <span className="gacha-offer__actions">
          {mineIn && !isOwner && <button type="button" className="crux-btn crux-btn--primary crux-btn--sm" onClick={() => send({ type: 'accept', offerId: offer.id })}>수락</button>}
          {mineIn && <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={() => send({ type: 'decline', offerId: offer.id })}>거절</button>}
          {mineOut && <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={() => send({ type: 'cancel', offerId: offer.id })}>취소</button>}
        </span>
      </li>
    );
  };

  const renderTrading = () => (
    <section className="gacha-panel" aria-label="교환">
      <h2>교환 시간 · {customers.filter((p) => p.tradeDone).length}/{customers.length}명 마침</h2>
      <p className="gacha-note">
        {isOwner ? '사장님은 이번 라운드 교환에 참여하지 않아요. 손님들이 모두 마치면 다음 라운드로 넘어갑니다.'
          : '카드·코인을 1:1로만 바꿀 수 있어요. 제안은 모두에게 보이고, 상대가 수락하면 바로 성립합니다.'}
      </p>
      {isCustomer && me && !me.tradeDone && (
        <div className="gacha-offer-form">
          <label><span>상대</span>
            <select className="crux-input" value={offerTo} onChange={(e) => setOfferTo(e.target.value)} aria-label="교환 상대">
              {tradePartners.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
          <label><span>내가 줄 것</span>
            <select className="crux-input" value={giveKey} onChange={(e) => setGiveKey(e.target.value)} aria-label="줄 것">
              {giveOptions.map((o) => <option key={o.key} value={o.key}>{o.label}</option>)}
            </select>
          </label>
          <label><span>받고 싶은 것</span>
            <select className="crux-input" value={wantKey} onChange={(e) => setWantKey(e.target.value)} aria-label="받을 것">
              <option value="coin">코인 1개</option>
              {KINDS.map((k) => <option key={k} value={`card:${k}`}>{kindLabel(k)} 카드</option>)}
            </select>
          </label>
          <button type="button" className="crux-btn crux-btn--primary" disabled={!offerTo || !giveOptions.length || !!myOutgoing || giveKey === wantKey}
            onClick={submitOffer}>{myOutgoing ? '제안 대기 중' : '제안하기'}</button>
        </div>
      )}
      <ul className="gacha-offers">
        {state.offers.map(renderOffer)}
        {state.offers.length === 0 && <li className="gacha-note">아직 제안이 없어요.</li>}
      </ul>
      {isCustomer && me && (
        <div className="gacha-actions">
          <button type="button" className="crux-btn crux-btn--secondary" disabled={me.tradeDone} onClick={() => send({ type: 'done' })}>
            {me.tradeDone ? '교환을 마쳤어요' : '교환 마치기'}
          </button>
        </div>
      )}
    </section>
  );

  const renderFinished = () => {
    if (state.phase !== 'finished' || !state.standings) return null;
    return (
      <section className="gacha-panel gacha-finished" aria-label="최종 결과">
        <h2>가게 문 닫음 · {state.standings[0].name} 승리 🏆</h2>
        <table className="gacha-table">
          <thead><tr><th>순위</th><th>손님</th><th>최애</th><th>차애</th><th>코인</th><th>세트</th><th>합계</th><th>모은 카드</th></tr></thead>
          <tbody>
            {state.standings.map((s) => (
              <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                <td className="rank">{s.rank}</td>
                <td>{s.name}</td>
                <td>{KIND_EMOJI[s.favorites.first]} {s.breakdown.first}</td>
                <td>{KIND_EMOJI[s.favorites.second]} {s.breakdown.second}</td>
                <td>{s.breakdown.coins}</td>
                <td>{s.breakdown.setBonus ? `+${s.breakdown.setBonus}` : '–'}</td>
                <td><b>{s.score}</b></td>
                <td>{KINDS.map((k) => `${KIND_EMOJI[k]}${s.kindCounts[k]}`).join(' ')}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <p className="gacha-note">동점이면 사장님을 먼저 한 사람이 이깁니다.</p>
        <div className="gacha-actions">
          {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
          <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
        </div>
      </section>
    );
  };

  const renderPhase = () => {
    switch (state.phase) {
      case 'setup': return renderSetup();
      case 'stocking': return renderStocking();
      case 'pulling': return renderPulling();
      case 'trading': return renderTrading();
      default: return renderFinished();
    }
  };

  // --- 플레이어 ---

  const renderPlayer = (p: GachaPlayerView) => {
    const owner = p.id === state.ownerId && state.phase !== 'setup';
    const turn = p.id === state.currentPlayerId;
    const status = state.phase === 'setup' ? (p.chosen ? '선택 완료' : '고르는 중')
      : state.phase === 'pulling' ? (owner ? '' : p.pullDone ? '뽑기 끝' : turn ? '뽑는 중' : '')
        : state.phase === 'trading' ? (owner ? '' : p.tradeDone ? '교환 끝' : '교환 중') : '';
    return (
      <section key={p.id} className={`gacha-player${p.isMe ? ' gacha-player--me' : ''}${owner ? ' gacha-player--owner' : ''}${turn ? ' gacha-player--turn' : ''}`} aria-label={`${p.name} 현황`}>
        <div className="gacha-player__head">
          <strong>{turn ? '▶ ' : ''}{p.name}{p.isMe ? ' (나)' : ''}</strong>
          {owner && <span className="gacha-chip gacha-chip--owner">사장님</span>}
          <span className="gacha-chip">🪙 {p.coins}</span>
          <span className="gacha-chip">카드 {p.handCount}장</span>
          {status && <span className="gacha-chip gacha-chip--status">{status}</span>}
        </div>
        <div className="gacha-player__pulled">
          <span className="gacha-player__label">이번 라운드 뽑음</span>
          {p.pulled.length ? p.pulled.map((c: GachaCard) => <CardFace key={c.id} kind={c.kind} small />) : <span className="gacha-note">없음</span>}
        </div>
        {p.isMe && me && (
          <div className="gacha-player__hand">
            <span className="gacha-player__label">내 카드</span>
            {KINDS.map((k) => (
              <span key={k} className={`gacha-count gacha-count--${k}${me.favorites?.first === k ? ' gacha-count--first' : me.favorites?.second === k ? ' gacha-count--second' : ''}`}>
                {KIND_EMOJI[k]} {kindLabel(k)} × {me.kindCounts[k]}{me.favorites?.first === k ? ' ♥' : me.favorites?.second === k ? ' ♡' : ''}
              </span>
            ))}
          </div>
        )}
        {state.phase === 'finished' && p.favorites && p.kindCounts && (
          <div className="gacha-player__hand">
            <span className="gacha-player__label">공개</span>
            <span className="gacha-count">최애 {kindLabel(p.favorites.first)} · 차애 {kindLabel(p.favorites.second)}</span>
          </div>
        )}
      </section>
    );
  };

  // 공개된 뽑기 집계: 누가 어떤 캐릭터를 몇 번 뽑았는지 (추리용)
  const pullTable = useMemo(() => state.players.map((p) => ({
    id: p.id, name: p.name,
    counts: KINDS.map((k) => state.pullHistory.filter((r) => r.playerId === p.id && r.kind === k).length),
  })), [state.players, state.pullHistory]);

  return (
    <main className="gacha" aria-label="가챠">
      <header className="gacha__head">
        <div className="gacha__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <h1>가챠</h1>
        </div>
        <div className="gacha__status">
          <span className="gacha-chip gacha-chip--phase">{PHASE_LABEL[state.phase]}</span>
          {state.phase !== 'setup' && <span className="gacha-chip">라운드 {state.round}/{state.totalRounds}</span>}
          {state.ownerId && state.phase !== 'finished' && <span className="gacha-chip">사장님 {nameOf(state.ownerId)}</span>}
          <span className="gacha-chip">덱 {state.deckCount}장</span>
          {me && <span className="gacha-chip gacha-chip--owner">내 코인 {me.coins}</span>}
        </div>
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="gacha__layout">
        <div className="gacha__main">
          {renderPhase()}
          <div className="gacha__players">
            {[...state.players.filter((p) => p.isMe), ...state.players.filter((p) => !p.isMe)].map(renderPlayer)}
          </div>
        </div>
        <aside className="gacha__side">
          <section className="gacha-panel" aria-label="공개된 뽑기 집계">
            <h2>공개된 뽑기</h2>
            <table className="gacha-table gacha-table--compact">
              <thead><tr><th>손님</th>{KINDS.map((k) => <th key={k}>{KIND_EMOJI[k]}</th>)}</tr></thead>
              <tbody>
                {pullTable.map((row) => <tr key={row.id}><td>{row.name}</td>{row.counts.map((n, i) => <td key={i}>{n}</td>)}</tr>)}
              </tbody>
            </table>
            <p className="gacha-note">교환으로 넘어간 카드는 기록에 남지 않아요.</p>
          </section>
          <section className="gacha-panel" aria-label="규칙 요약">
            <h2>규칙 요약</h2>
            <ul className="gacha-rules">
              <li>사장님이 덱에서 4장을 가져와 1~4장을 뒷면으로 진열.</li>
              <li>손님은 차례마다 코인 1개로 1장 뽑기. 기계가 빌 때까지 반복 가능.</li>
              <li>남은 카드는 안 보고 덱 맨 아래로. 뽑은 카드는 손으로.</li>
              <li>교환은 손님끼리 카드·코인 1:1만.</li>
              <li>인원 × 3라운드 뒤 최애 3점 · 차애 2점 · 코인 1점 · 네 캐릭터 2장씩 +5.</li>
            </ul>
          </section>
          <section className="gacha-panel" aria-label="기록">
            <h2>기록</h2>
            <ul className="gacha-log">
              {state.log.slice().reverse().slice(0, 30).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ul>
          </section>
        </aside>
      </div>
    </main>
  );
};

export default GachaGame;
