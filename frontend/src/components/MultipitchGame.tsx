import React, { useState } from 'react';
import { GameRoom } from '../types/game.types';
import {
  MultipitchAction,
  MultipitchCard,
  MultipitchClientState,
  MultipitchSuit,
  SeatNumber,
} from '../types/multipitch.types';
import socketService from '../services/socket.service';
import './MultipitchGame.css';

interface MultipitchGameProps {
  room: GameRoom;
  playerId: string;
  state: MultipitchClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

export const SUIT_INFO: Record<MultipitchSuit, { label: string; mark: string; color: string }> = {
  crimp: { label: '크림프', mark: '▬', color: 'red' },
  sloper: { label: '슬로퍼', mark: '◠', color: 'blue' },
  jug: { label: '저그', mark: '◖', color: 'green' },
  crack: { label: '크랙', mark: '⫽', color: 'orange' },
};
const SUITS: MultipitchSuit[] = ['crimp', 'sloper', 'jug', 'crack'];

export function cardLabel(card: MultipitchCard): string {
  return card.kind === 'fall' ? '추락' : `${SUIT_INFO[card.suit].label} ${card.rank}`;
}

function CardFace({ card, compact = false }: { card: MultipitchCard; compact?: boolean }) {
  if (card.kind === 'fall') {
    return <span className={`mp-card mp-card--fall ${compact ? 'is-compact' : ''}`} aria-label="추락 카드">
      <span className="mp-card__rank">!</span>
      <span className="mp-card__suit">추락</span>
    </span>;
  }
  const info = SUIT_INFO[card.suit];
  return <span className={`mp-card mp-card--${card.suit} ${compact ? 'is-compact' : ''}`} aria-label={cardLabel(card)}>
    <span className="mp-card__rank">{card.rank}</span>
    <span className="mp-card__mark" aria-hidden="true">{info.mark}</span>
    <span className="mp-card__suit">{info.label}</span>
  </span>;
}

const MultipitchGame: React.FC<MultipitchGameProps> = ({
  room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom,
}) => {
  const [slackSuit, setSlackSuit] = useState<MultipitchSuit>('crimp');
  const isHost = room.players.find(p => p.id === playerId)?.isHost ?? false;
  const me = state.seats.find(s => s.isMe) ?? null;
  const send = (action: MultipitchAction) => socketService.multipitchAction(room.id, playerId, action);
  const seatName = (seat: SeatNumber) => {
    const found = state.seats.find(s => s.seat === seat);
    return found ? `${seat}번 ${found.name}` : `${seat}번`;
  };
  const isMyTurn = state.phase === 'play' && me !== null && state.turnSeat === me.seat;
  const isMyBonus = state.phase === 'bonus' && me !== null && state.pendingBonusSeat === me.seat;
  const canCall = state.phase === 'play' && state.callsOpen && !!me?.callAvailable;
  const hasFallCard = state.hand.some(c => c.kind === 'fall');
  const inSafeZone = me !== null && !!state.board[me.position]?.safe;
  const onlyFallCards = state.hand.length > 0 && state.hand.every(c => c.kind === 'fall');
  const canFallNow = hasFallCard && (!inSafeZone || onlyFallCards);
  const voidSuits = SUITS.filter(suit => !state.hand.some(c => c.kind === 'hold' && c.suit === suit));
  const cells = state.board.slice().reverse();
  const nextCell = me && me.position < state.board.length - 1 ? state.board[me.position + 1] : null;

  const turnText = state.phase === 'finished'
    ? (state.outcome === 'victory' ? '전원 정상 도착!' : `하산: ${state.outcomeReason}`)
    : state.phase === 'bonus'
      ? `${seatName(state.pendingBonusSeat as SeatNumber)}이(가) 보너스를 고르는 중`
      : `${seatName(state.turnSeat)} 차례` + (state.leadSuit ? ` · 리드 ${SUIT_INFO[state.leadSuit].label}` : ' · 선');

  return (
    <main className="crux-main mp-game">
      <header className="crux-page-head mp-head">
        <div className="crux-page-head__text">
          <div className="crux-row" style={{ gap: 8, flexWrap: 'wrap' }}>
            <span className="crux-badge crux-badge--green">확보!</span>
            <span className="crux-badge">딜 {state.deal}/{state.dealsAllowed}</span>
            <span className="crux-badge">트릭 {Math.min(state.trickInDeal, state.tricksPerDeal)}/{state.tricksPerDeal}</span>
            <span className={`crux-badge ${state.injuries > 0 ? 'crux-badge--red' : ''}`}>부상 {state.injuries}/{state.injuryLimit}</span>
            <span className="crux-badge crux-badge--orange">랙 장비 {state.rack}</span>
          </div>
          <h1 className="crux-h2" style={{ margin: '8px 0 0' }}>인수봉 연습길 · 2피치</h1>
          <p className="crux-help">{turnText}</p>
        </div>
        <div className="crux-row" style={{ gap: 8 }}>
          {state.phase === 'finished' && isHost && <button className="crux-btn crux-btn--primary crux-btn--sm" onClick={onReturnToRoom}>대기실로</button>}
          <button className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>나가기</button>
        </div>
      </header>

      {message && <p role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : 'crux-banner--info'}`}>{message}</p>}

      {state.phase === 'finished' && (
        <section className={`crux-panel mp-outcome ${state.outcome === 'victory' ? 'is-victory' : 'is-defeat'}`} role="status">
          <h2 className="crux-h2">{state.outcome === 'victory' ? '정상 등정 성공' : '하산'}</h2>
          <p>{state.outcomeReason}</p>
        </section>
      )}

      <div className="mp-layout">
        <section className="crux-panel mp-wall" aria-label="루트 보드">
          <h2 className="crux-label">루트 보드</h2>
          <ol className="mp-cells">
            {cells.map(cell => {
              const climbers = state.seats.filter(s => s.position === cell.index);
              const gearCount = state.gearOnWall.filter(g => g === cell.index).length;
              return (
                <li key={cell.index} className={`mp-cell ${cell.safe ? 'is-safe' : ''}`}>
                  <span className="mp-cell__index">{cell.index}</span>
                  <span className="mp-cell__info">
                    <strong>{cell.name}</strong>
                    {cell.difficulty !== undefined && <span className="mp-chip mp-chip--diff">숫자 {cell.difficulty} 이상</span>}
                    {cell.suit && <span className={`mp-chip mp-chip--${cell.suit}`} title={`${SUIT_INFO[cell.suit].label} 무늬로 내면 ${Math.max(0, (cell.difficulty ?? 0) - state.config.suitBonus)} 이상이면 됩니다`}>{SUIT_INFO[cell.suit].mark} {SUIT_INFO[cell.suit].label}면 {Math.max(0, (cell.difficulty ?? 0) - state.config.suitBonus)} 이상</span>}
                    {cell.safe && <span className="mp-chip">안전지대</span>}
                    {gearCount > 0 && <span className="mp-chip mp-chip--gear">장비 ×{gearCount}</span>}
                  </span>
                  <span className="mp-cell__climbers">
                    {climbers.map(s => (
                      <span key={s.seat} className={`mp-climber ${s.isMe ? 'is-me' : ''} ${s.tension ? 'has-tension' : ''}`} title={s.name}>
                        {s.seat}{s.tension ? '⚓' : ''}
                      </span>
                    ))}
                  </span>
                </li>
              );
            })}
          </ol>
        </section>

        <div className="mp-side">
          <section className="crux-panel mp-trick" aria-label="현재 트릭">
            <h2 className="crux-label">현재 트릭 {state.leadSuit ? `· 리드 ${SUIT_INFO[state.leadSuit].label}` : ''}</h2>
            <div className="mp-plays">
              {([1, 2, 3, 4] as SeatNumber[]).map(seat => {
                const play = state.plays.find(p => p.seat === seat);
                return (
                  <div key={seat} className={`mp-play ${state.phase === 'play' && state.turnSeat === seat ? 'is-turn' : ''}`}>
                    <span className="mp-play__seat">{seatName(seat)}</span>
                    {play ? <CardFace card={play.card} compact /> : <span className="mp-card mp-card--empty is-compact">대기</span>}
                  </div>
                );
              })}
            </div>
            {state.lastTrick && state.plays.length === 0 && (
              <div className="mp-last">
                <strong>지난 트릭 {state.lastTrick.trickIndex}</strong>
                <span>{state.lastTrick.winnerSeat ? `${state.lastTrick.winnerSeat}번 승리` : '승자 없음'}</span>
                {state.lastTrick.falls.map(f => (
                  <span key={`f${f.seat}`}>
                    {f.seat}번 추락 → {f.safeZone ? '안전지대, 무효' : f.groundFall ? '그라운드 폴' : f.caught ? `${f.byTension ? '텐션으로' : '빌레이어가'} 잡음` : `놓침, 부상`}
                    {f.to !== f.from ? ` (${f.from}→${f.to})` : ''}
                  </span>
                ))}
                {state.lastTrick.climbs.filter(c => c.climbed).map(c => <span key={`c${c.seat}`}>{c.seat}번 {c.from}→{c.to}칸</span>)}
                {state.lastTrick.climbs.filter(c => !c.climbed && c.reason).map(c => <span key={`n${c.seat}`} className="crux-help">{c.seat}번 못 오름 ({c.reason})</span>)}
                {state.lastTrick.recoveredGear > 0 && <span>장비 {state.lastTrick.recoveredGear}개 회수</span>}
              </div>
            )}
          </section>

          <section className="crux-panel mp-seats" aria-label="등반자 상태">
            <h2 className="crux-label">로프 팀</h2>
            <ul>
              {state.seats.map(s => (
                <li key={s.seat} className={`mp-seat ${s.isMe ? 'is-me' : ''}`}>
                  <span className="mp-seat__title">
                    <strong>{s.seat}번 {s.name}</strong>
                    <span className="crux-help">{s.seat === 1 ? '선등' : s.seat === 4 ? '후미' : '중간'} · 빌레이어 {s.belayer}번 · {s.position}칸</span>
                  </span>
                  <span className="mp-seat__tags">
                    <span className="mp-chip">손패 {s.handCount}</span>
                    <span className={`mp-chip ${s.callAvailable ? 'mp-chip--ok' : ''}`}>콜 {s.callAvailable ? '가능' : '사용'}</span>
                    {s.tension && <span className="mp-chip mp-chip--ok">텐션</span>}
                    {s.revealedCard && <span className={`mp-chip mp-chip--${s.revealedCard.suit}`}>공개: {cardLabel(s.revealedCard)}</span>}
                    {s.declaredVoidSuit && <span className="mp-chip">{SUIT_INFO[s.declaredVoidSuit].label} 없음</span>}
                    {s.declaredFall && <span className="mp-chip mp-chip--fall">추락 {s.declaredFall.count}장, 트릭 {s.declaredFall.trickIndex}</span>}
                  </span>
                </li>
              ))}
            </ul>
          </section>

          <section className="crux-panel mp-log" aria-label="기록">
            <h2 className="crux-label">기록</h2>
            <ul>
              {state.log.slice().reverse().slice(0, 12).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}
            </ul>
          </section>
        </div>
      </div>

      {me && state.phase !== 'finished' && (
        <section className="crux-panel mp-dock" aria-label="내 손패">
          <div className="mp-dock__head">
            <h2 className="crux-label">내 손패 · {me.seat}번 {me.name}</h2>
            {nextCell && <span className="mp-next">
              다음 칸 {nextCell.index} {nextCell.name}: <strong>아무 무늬 {nextCell.difficulty} 이상</strong>
              {nextCell.suit && <> · {SUIT_INFO[nextCell.suit].label}면 <strong>{Math.max(0, (nextCell.difficulty ?? 0) - state.config.suitBonus)} 이상</strong></>}
            </span>}
            <span className="crux-help">{isMyTurn ? (inSafeZone ? '카드를 고르세요. 리드 무늬가 있으면 같은 무늬를. 안전지대에서는 추락 카드를 낼 수 없어요.' : '카드를 고르세요. 리드 무늬가 있으면 같은 무늬를, 추락 카드는 무늬와 상관없이 낼 수 있어요.') : isMyBonus ? '트릭을 이겼어요. 보너스를 고르세요.' : '다른 등반자를 기다리는 중'}</span>
          </div>

          {isMyBonus && (
            <div className="mp-bonus">
              {state.bonusOptions.map(option => (
                <button key={`${option.bonus}-${option.targetSeat ?? ''}`} className={`crux-btn ${option.bonus === 'none' ? 'crux-btn--ghost' : 'crux-btn--secondary'} crux-btn--sm`}
                  onClick={() => send(option.bonus === 'tension'
                    ? { type: 'choose_bonus', bonus: 'tension', targetSeat: option.targetSeat as SeatNumber }
                    : { type: 'choose_bonus', bonus: option.bonus })}>
                  {option.label}
                </button>
              ))}
            </div>
          )}

          <div className="mp-hand">
            {state.hand.map(card => {
              const legal = isMyTurn && state.legalCardIds.includes(card.id);
              return (
                <button key={card.id} className={`mp-hand__card ${legal ? 'is-legal' : ''}`} disabled={!legal}
                  aria-label={`${cardLabel(card)} 내기`} onClick={() => send({ type: 'play_card', cardId: card.id })}>
                  <CardFace card={card} />
                </button>
              );
            })}
            {state.hand.length === 0 && <span className="crux-help">손패가 없습니다.</span>}
          </div>

          <div className="mp-calls">
            <span className="crux-label">등반 콜 {me.callAvailable ? '(토큰 1개)' : '(토큰 사용함)'}</span>
            <div className="crux-row" style={{ gap: 8, flexWrap: 'wrap' }}>
              <button className="crux-btn crux-btn--secondary crux-btn--sm" disabled={!canCall || !state.hand.some(c => c.kind === 'hold')}
                onClick={() => send({ type: 'call', call: 'belay' })}>확보 봐줘! (최고 카드 공개)</button>
              <button className="crux-btn crux-btn--secondary crux-btn--sm" disabled={!canCall || !canFallNow} title={hasFallCard && !canFallNow ? '안전지대에서는 추락 카드를 낼 수 없습니다' : undefined}
                onClick={() => send({ type: 'call', call: 'falling', timing: 'this' })}>떨어진다! 이번 트릭</button>
              <button className="crux-btn crux-btn--secondary crux-btn--sm" disabled={!canCall || !hasFallCard}
                onClick={() => send({ type: 'call', call: 'falling', timing: 'next' })}>떨어진다! 다음 트릭</button>
              <span className="crux-row" style={{ gap: 4 }}>
                <select className="crux-input mp-select" aria-label="없는 무늬" value={voidSuits.includes(slackSuit) ? slackSuit : (voidSuits[0] ?? '')}
                  disabled={!canCall || voidSuits.length === 0} onChange={e => setSlackSuit(e.target.value as MultipitchSuit)}>
                  {voidSuits.length === 0 && <option value="">없는 무늬 없음</option>}
                  {voidSuits.map(suit => <option key={suit} value={suit}>{SUIT_INFO[suit].label}</option>)}
                </select>
                <button className="crux-btn crux-btn--secondary crux-btn--sm" disabled={!canCall || voidSuits.length === 0}
                  onClick={() => send({ type: 'call', call: 'slack', suit: voidSuits.includes(slackSuit) ? slackSuit : voidSuits[0] })}>줄 줘! (없는 무늬)</button>
              </span>
            </div>
            {!state.callsOpen && state.phase === 'play' && <span className="crux-help">콜은 트릭의 첫 카드가 나오기 전에만 외칠 수 있어요.</span>}
          </div>
        </section>
      )}
    </main>
  );
};

export default MultipitchGame;
