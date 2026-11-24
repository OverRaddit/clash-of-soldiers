import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import { HIDE_ANIMAL_EMOJI as ANIMAL_EMOJI, HIDE_ANIMAL_LABEL as ANIMAL_LABEL, HideAction, HideAnimal, HideCard, HideClientState, HideHideoutView } from '../types/hide.types';
import socketService from '../services/socket.service';
import './HideGame.css';

interface HideGameProps {
  room: GameRoom;
  playerId: string;
  state: HideClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const HIDEOUT_EMOJI = ['🌳', '🪨', '⛲', '🌿', '🪵', '🌷', '🕳️'];
const MAX_TOKENS = 2;
// 술래 색: 순서 띠·점·결과표에서 같은 사람은 같은 색
const COLORS = ['blue', 'purple', 'pink', 'lime', 'yellow', 'red'] as const;

function cardLabel(card: HideCard): string { return card === 'empty' ? '빈 은신처' : ANIMAL_LABEL[card]; }
function cardEmoji(card: HideCard): string { return card === 'empty' ? '🍃' : ANIMAL_EMOJI[card]; }

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

const Token: React.FC<{ animal: HideAnimal; size?: 'sm' | 'md' }> = ({ animal, size = 'md' }) => (
  <span className={`hs-tok hs-tok--${size}`} title={ANIMAL_LABEL[animal]} role="img" aria-label={`${ANIMAL_LABEL[animal]} 토큰`}>{ANIMAL_EMOJI[animal]}</span>
);

const HideGame: React.FC<HideGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const narrow = useNarrow();
  const me = state.players.find((p) => p.isMe) ?? null;
  const revealed = state.phase === 'reveal' || state.phase === 'finished';
  const myTurn = !!me && state.currentPlayerId === playerId;
  const myPeekTurn = myTurn && state.phase === 'peek';
  const myClueTurn = myTurn && state.phase === 'clue';
  const canEditBoard = !!me && !revealed && !state.submitted;

  const [peekPicks, setPeekPicks] = useState<number[]>([]);
  const [clueAnimal, setClueAnimal] = useState<HideAnimal | null>(null);
  const [clueTo, setClueTo] = useState<number | null>(null);
  const [editSlot, setEditSlot] = useState<number | null>(null);

  // 차례·단계가 바뀌면 고르던 것을 지운다.
  useEffect(() => { setPeekPicks([]); setClueAnimal(null); setClueTo(null); }, [state.currentPlayerId, state.phase, state.turnPos, state.round]);
  useEffect(() => { if (!canEditBoard) setEditSlot(null); }, [canEditBoard]);
  useEffect(() => { setEditSlot(null); }, [state.round]);
  // 고를 수 있는 단서가 하나뿐이면 미리 골라 둔다.
  useEffect(() => { if (myClueTurn && state.clueAnimals.length === 1) setClueAnimal(state.clueAnimals[0]); }, [myClueTurn, state.clueAnimals]);

  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    state.players.forEach((p, i) => { map[p.id] = COLORS[i % COLORS.length]; });
    return map;
  }, [state.players]);
  const nameOf = (id: string | null | undefined) => state.players.find((p) => p.id === id)?.name ?? id ?? '';
  const send = (action: HideAction) => socketService.hideAction(room.id, playerId, action);
  const board = state.board ?? [];
  const result = state.lastResult;
  const myCorrect = result && me ? result.correct[me.id] : null;
  const catInPlay = state.options.cat;
  // 엿본 순간의 카드. 고양이가 자리를 바꿨다면 은신처 아래 👁 카드는 바뀐 뒤의 자리로 보인다.
  const mySeen = myClueTurn ? state.mySeen ?? [] : [];
  const sawEmpty = mySeen.some((seen) => seen.card === 'empty');
  const sawCat = mySeen.some((seen) => seen.card === 'cat');

  const tokenSpot = (animal: HideAnimal): number | null => state.hideouts.find((h) => h.tokens.includes(animal))?.index ?? null;
  // 단서는 방금 엿본 두 곳 중, 고른 토큰이 이미 놓여 있지 않은 곳에만 놓을 수 있다.
  const isTarget = (h: HideHideoutView) => myClueTurn && !!clueAnimal && h.peeking && h.tokens.length < MAX_TOKENS && !h.tokens.includes(clueAnimal);

  const clickTile = (h: HideHideoutView) => {
    if (myPeekTurn) {
      if (!state.peekable.includes(h.index)) return;
      setPeekPicks((prev) => prev.includes(h.index) ? prev.filter((x) => x !== h.index) : prev.length < 2 ? [...prev, h.index] : [prev[1], h.index]);
    } else if (isTarget(h)) {
      setClueTo(h.index);
    }
  };
  const confirmPeek = () => { if (myPeekTurn && peekPicks.length === 2) send({ type: 'peek', slots: peekPicks }); };
  const confirmClue = () => { if (myClueTurn && clueAnimal && clueTo !== null) send({ type: 'clue', animal: clueAnimal, to: clueTo }); };
  const pickClueAnimal = (animal: HideAnimal) => {
    setClueAnimal(animal);
    // 고른 토큰이 이미 놓여 있는 곳은 목적지가 될 수 없다.
    if (clueTo !== null && state.hideouts[clueTo].tokens.includes(animal)) setClueTo(null);
  };
  const setGuess = (animal: HideAnimal | null) => {
    if (editSlot === null || !canEditBoard) return;
    send({ type: 'set_board', slot: editSlot, animal });
    setEditSlot(null);
  };

  // --- 순서 띠 (스네이크 드래프트) ---
  const renderOrder = () => (
    <ol className="hs-order" aria-label="이번 라운드 턴 순서">
      {state.turnOrder.map((id, i) => {
        const done = i < state.turnPos || state.phase === 'guess' || revealed;
        const now = !done && i === state.turnPos;
        return (
          <li key={i} className={['hs-order__item', done ? 'is-done' : '', now ? 'is-now' : ''].filter(Boolean).join(' ')} aria-current={now ? 'step' : undefined}>
            <span className={`hs-dot hs-c--${colorOf[id]}`} />{nameOf(id)}{id === playerId ? ' (나)' : ''}
          </li>
        );
      })}
      <li className={['hs-order__item hs-order__item--end', state.phase === 'guess' ? 'is-now' : '', revealed ? 'is-done' : ''].filter(Boolean).join(' ')}>최종 추리</li>
    </ol>
  );

  // --- 은신처 ---
  const renderHideout = (h: HideHideoutView) => {
    const pickable = myPeekTurn && state.peekable.includes(h.index);
    const target = isTarget(h);
    const picked = (myPeekTurn && peekPicks.includes(h.index)) || (myClueTurn && clueTo === h.index);
    const clickable = pickable || target;
    const guess = board[h.index] ?? null;
    const shown: HideCard | null = revealed ? h.card : h.known;
    const cls = ['hs-hide', h.locked ? 'hs-hide--locked' : '', h.peeking && !revealed ? 'hs-hide--peeking' : '', clickable ? 'hs-hide--clickable' : '', picked ? 'hs-hide--picked' : '',
      myPeekTurn && !pickable ? 'hs-hide--dim' : '', revealed && myCorrect ? (myCorrect[h.index] ? 'hs-hide--hit' : 'hs-hide--miss') : ''].filter(Boolean).join(' ');
    return (
      <li key={h.index} className={cls}>
        <div className="hs-hide__clues" aria-label={`${h.index + 1}번 은신처의 단서 토큰 ${h.tokens.length}개`}>
          {h.tokens.map((a) => <Token key={a} animal={a} />)}
          {Array.from({ length: MAX_TOKENS - h.tokens.length }, (_, i) => <span key={i} className="hs-tok hs-tok--md hs-tok--slot" aria-hidden="true" />)}
        </div>
        <button type="button" className="hs-hide__tile" onClick={() => clickTile(h)} disabled={!clickable} aria-pressed={clickable ? picked : undefined}
          aria-label={`${h.index + 1}번 ${h.name}${h.locked ? ' (잠김)' : ''}${pickable ? ' 엿보기' : target ? '에 단서 놓기' : ''}`}>
          <span className="hs-hide__no">{h.index + 1}</span>
          <span className="hs-hide__emoji" aria-hidden="true">{HIDEOUT_EMOJI[h.index]}</span>
          <span className="hs-hide__name">{h.name}</span>
          {h.locked && <span className="hs-hide__flag hs-hide__flag--lock">🔒 잠김</span>}
          {h.peeking && !revealed && <span className="hs-hide__flag hs-hide__flag--peek">👀 엿보는 중</span>}
        </button>
        <div className={['hs-hide__card', shown ? 'is-open' : '', shown === 'empty' ? 'is-empty' : ''].filter(Boolean).join(' ')}
          aria-label={shown ? `${revealed ? '정답' : '내가 본 카드'}: ${cardLabel(shown)}` : '뒷면 카드'}>
          {shown ? <><span className="hs-hide__card-emoji" aria-hidden="true">{cardEmoji(shown)}</span><span>{cardLabel(shown)}</span></> : <span className="hs-hide__card-back" aria-hidden="true">?</span>}
          {shown && !revealed && <span className="hs-hide__seen" title={catInPlay ? '내가 봤을 때의 카드 (그 뒤 고양이가 자리를 바꿨을 수 있어요)' : '내가 직접 본 카드'}>👁</span>}
        </div>
        {me && (
          <button type="button" className={['hs-hide__guess', guess ? 'has-token' : '', editSlot === h.index ? 'is-editing' : ''].filter(Boolean).join(' ')}
            onClick={() => setEditSlot(editSlot === h.index ? null : h.index)} disabled={!canEditBoard}
            aria-label={`${h.index + 1}번 내 추리: ${guess ? ANIMAL_LABEL[guess] : '비움'}`}>
            {guess ? <><span aria-hidden="true">{ANIMAL_EMOJI[guess]}</span><span>{ANIMAL_LABEL[guess]}</span></> : <span className="hs-hide__guess-none">비움</span>}
            {revealed && myCorrect && <span className={`hs-mark ${myCorrect[h.index] ? 'hs-mark--hit' : 'hs-mark--miss'}`} aria-label={myCorrect[h.index] ? '적중' : '빗나감'}>{myCorrect[h.index] ? '○' : '✕'}</span>}
          </button>
        )}
      </li>
    );
  };

  // --- 추리 토큰 고르기 (가림막 뒤) ---
  const renderPalette = () => {
    if (editSlot === null || !canEditBoard) return null;
    return (
      <div className="hs-palette" role="group" aria-label={`${editSlot + 1}번 은신처 추리 고르기`}>
        <div className="hs-palette__head">
          <strong>{editSlot + 1}번 {state.hideouts[editSlot].name}</strong>
          <span className="hs-note">여기 숨은 동물을 고르세요. 동물 토큰은 한 칸에만 올릴 수 있어요.</span>
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={() => setEditSlot(null)}>닫기</button>
        </div>
        <div className="hs-palette__list">
          {state.animals.map((a) => {
            const at = board.indexOf(a);
            return (
              <button key={a} type="button" className="hs-pick" aria-pressed={board[editSlot] === a} onClick={() => setGuess(a)}>
                <span className="hs-pick__emoji" aria-hidden="true">{ANIMAL_EMOJI[a]}</span>
                <span>{ANIMAL_LABEL[a]}</span>
                {at >= 0 && at !== editSlot && <small>{at + 1}번에서 옮김</small>}
              </button>
            );
          })}
          <button type="button" className="hs-pick hs-pick--clear" aria-pressed={board[editSlot] === null} onClick={() => setGuess(null)}>
            <span className="hs-pick__emoji" aria-hidden="true">🍃</span><span>비우기</span><small>빈 은신처로 추리</small>
          </button>
        </div>
      </div>
    );
  };

  // --- 대기석 ---
  const renderReserve = () => (
    <div className="hs-reserve" aria-label="단서 토큰 대기석">
      <span className="hs-reserve__label">대기석 <small>{state.reserve.length}/{state.animals.length}</small></span>
      <span className="hs-reserve__list">
        {state.reserve.length ? state.reserve.map((a) => <Token key={a} animal={a} />) : <span className="hs-note">모든 단서 토큰이 은신처 위에 있어요.</span>}
      </span>
    </div>
  );

  // --- 라운드 결과 ---
  const renderResult = () => {
    if (!revealed || !result) return null;
    const emptySlots = result.hideouts.map((card, i) => (card === 'empty' ? i + 1 : 0)).filter(Boolean);
    const swaps = state.history.filter((t) => t.swapped);
    return (
      <section className="hs-card hs-card--act" aria-label={`${result.round}라운드 정답 공개`}>
        <div className="hs-card__title">
          <h2>{result.round}라운드 정답 공개</h2>
          <span className="crux-badge">{emptySlots.length ? `빈 은신처: ${emptySlots.map((n) => `${n}번`).join('·')}` : '빈 은신처 없음 · 동물 7마리'}</span>
        </div>
        <div className="hs-scroll">
          <table className="hs-table hs-table--result">
            <thead>
              <tr><th>술래</th>{state.hideouts.map((h) => <th key={h.index} title={h.name}>{h.index + 1}</th>)}<th>점수</th></tr>
              <tr className="hs-table__answer"><th>정답</th>{result.hideouts.map((card, i) => <td key={i} title={cardLabel(card)}>{cardEmoji(card)}</td>)}<td /></tr>
            </thead>
            <tbody>
              {state.players.map((p) => (
                <tr key={p.id} className={p.isMe ? 'is-me' : ''}>
                  <th><span className={`hs-dot hs-c--${colorOf[p.id]}`} /> {p.name}</th>
                  {result.boards[p.id].map((guess, i) => (
                    <td key={i} className={result.correct[p.id][i] ? 'is-hit' : 'is-miss'} title={`${guess ? ANIMAL_LABEL[guess] : '비움'} — ${result.correct[p.id][i] ? '적중' : '빗나감'}`}>
                      {guess ? ANIMAL_EMOJI[guess] : '·'}
                    </td>
                  ))}
                  <td><b>+{result.scores[p.id]}</b></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="hs-note">초록 칸 = 적중. {result.removed.length ? `치워 둔 ${result.removed.length}장: ${result.removed.map((card) => `${cardEmoji(card)} ${cardLabel(card)}`).join(' · ')}` : '치워 둔 카드는 없었어요.'}</p>
        {catInPlay && (
          <p className="hs-note">🐱 {swaps.length
            ? `고양이가 자리를 바꾼 턴: ${swaps.map((t) => `${nameOf(t.playerId)} (${t.peeked.map((s) => `${s + 1}번`).join('↔')})`).join(' · ')}`
            : '이번 라운드에 고양이는 자리를 바꾸지 않았어요.'}</p>
        )}
        {state.phase === 'reveal' && (
          <div className="hs-card__buttons"><button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'next_round' })}>모두 회수하고 {state.round + 1}라운드로</button></div>
        )}
      </section>
    );
  };

  const renderFinished = () => {
    if (state.phase !== 'finished' || !state.standings) return null;
    const winners = state.standings.filter((s) => s.winner);
    return (
      <section className="hs-card hs-card--act hs-final" aria-label="최종 결과">
        <div className="hs-card__title"><h2>🏆 {winners.map((w) => w.name).join(' · ')} {winners.length > 1 ? '공동 승리' : '승리'}!</h2><span className="crux-badge">{state.totalRounds}라운드 종료</span></div>
        <p className="hs-note">{state.result?.message}</p>
        <div className="hs-scroll">
          <table className="hs-table">
            <thead><tr><th>순위</th><th>술래</th>{Array.from({ length: state.totalRounds }, (_, i) => <th key={i}>{i + 1}R</th>)}<th>누적</th><th></th></tr></thead>
            <tbody>
              {state.standings.map((s) => {
                const p = state.players.find((x) => x.id === s.playerId);
                return (
                  <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                    <td className="rank">{s.rank}</td>
                    <td><span className={`hs-dot hs-c--${colorOf[s.playerId]}`} /> {s.name}</td>
                    {Array.from({ length: state.totalRounds }, (_, i) => <td key={i}>{p?.roundScores[i] ?? 0}</td>)}
                    <td><b>{s.total}</b></td>
                    <td>{s.winner ? <span className="crux-badge crux-badge--green">승리</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="hs-note">동점이면 마지막 라운드 점수가 높은 사람이 이기고, 그것도 같으면 공동 승리예요.</p>
        <div className="hs-card__buttons">
          <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
          {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
        </div>
      </section>
    );
  };

  // --- 술래들 ---
  const renderPlayers = () => (
    <section className="hs-card" aria-label="술래들">
      <h2>술래들 <small>{state.phase === 'finished' ? '최종' : `${state.round}/${state.totalRounds}라운드`}</small></h2>
      <div className="hs-players">
        {state.players.map((p) => (
          <div key={p.id} className={['hs-player', p.id === state.currentPlayerId ? 'hs-player--turn' : '', p.isMe ? 'hs-player--me' : ''].filter(Boolean).join(' ')}>
            <span className={`hs-dot hs-c--${colorOf[p.id]}`} />
            <strong>{p.name}</strong>
            {p.isMe && <span className="crux-badge">나</span>}
            {p.id === state.currentPlayerId && <span className="crux-badge crux-badge--orange">▲ {state.phase === 'peek' ? '엿보는 중' : '단서 놓는 중'}</span>}
            {state.phase === 'guess' && <span className={`crux-badge ${p.submitted ? 'crux-badge--green' : 'crux-badge--outline'}`}>{p.submitted ? '확정' : '추리 중'}</span>}
            <span className="hs-player__turns" aria-label={`이번 라운드 ${p.turnsTaken}/2턴`}>
              {[0, 1].map((i) => <i key={i} className={i < p.turnsTaken ? 'on' : ''} />)}
            </span>
            <span className="hs-player__score">{p.total}</span>
          </div>
        ))}
      </div>
      <p className="hs-note">점 = 이번 라운드에 마친 턴. 숫자 = 누적 점수.</p>
    </section>
  );

  // --- 이번 라운드 단서 기록 ---
  const renderHistory = () => (
    <section className="hs-card" aria-label="이번 라운드 단서 기록">
      <h2>단서 기록 <small>{state.history.length}/{state.turnOrder.length}턴</small></h2>
      {state.history.length === 0 ? <p className="hs-note">아직 놓인 단서가 없어요.</p> : (
        <ol className="hs-history">
          {state.history.map((t, i) => (
            <li key={i}>
              <span className={`hs-dot hs-c--${colorOf[t.playerId]}`} />
              <span><b>{nameOf(t.playerId)}</b> · {t.peeked.map((s) => `${s + 1}번`).join('·')} 엿봄 → {ANIMAL_EMOJI[t.animal]} {ANIMAL_LABEL[t.animal]} 단서를 <b>{t.to + 1}번</b>에 <small>({t.from === null ? '대기석에서' : `${t.from + 1}번에서 옮김`})</small>{t.swapped && <span className="hs-swap" title="고양이가 엿본 두 카드의 자리를 바꿨어요"> 🐱 자리 바꿈</span>}</span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  const rules = (
    <ul className="hs-rules">
      <li>내 턴: <b>토큰 0~1개</b>인 은신처 2곳을 몰래 엿본 뒤, 본 동물 중 하나의 단서 토큰을 <b>방금 엿본 두 곳 중 한 곳</b>에 놓아요. 진짜여도 가짜여도 돼요.</li>
      <li>단서 토큰은 대기석에서 가져오거나 다른 은신처에서 옮길 수 있어요. 한 은신처에 2개까지, 2개면 <b>잠김</b>.</li>
      <li><b>빈 은신처</b>를 봤다면 이 판의 동물 토큰 중 아무거나 놓을 수 있어요.</li>
      {catInPlay && <li><b>🐱 고양이</b>를 엿보면 함께 엿본 카드와 자리가 바뀌어요. 곰이나 부엉이와 함께면 그대로예요. 바뀌었는지는 엿본 사람만 알고, 라운드가 끝나면 공개돼요.</li>}
      <li>이번 판 카드: 동물 {state.deck.animals}장 + 빈 은신처 {state.deck.empty}장. 7장을 숨기고 {state.deck.removed ? `${state.deck.removed}장은 치워 둬요.` : '남는 카드는 없어요.'}</li>
      <li>모두 2턴씩 마치면 추리판을 동시에 공개하고, 맞힌 은신처마다 1점. 빈 은신처는 비워 둬야 적중이에요.</li>
    </ul>
  );

  // --- 하단 도크: 지금 할 일 ---
  const renderDock = () => {
    if (revealed || !me) return null;
    let body: React.ReactNode;
    if (state.phase === 'peek') {
      body = myTurn ? (
        <div className="hs-dock__row">
          <span className="hs-dock__text"><b>① 탐색</b> · 엿볼 은신처 2곳을 누르세요. 잠긴(🔒) 곳은 볼 수 없어요. <b>{peekPicks.length}/2</b>{peekPicks.length ? ` — ${peekPicks.map((s) => `${s + 1}번`).join(', ')}` : ''}</span>
          <button type="button" className="crux-btn crux-btn--primary" disabled={peekPicks.length !== 2} onClick={confirmPeek}>몰래 엿보기</button>
        </div>
      ) : <span className="hs-dock__text">{nameOf(state.currentPlayerId)} 님이 엿볼 은신처를 고르는 중… 기다리는 동안 추리판을 정리해 두세요.</span>;
    } else if (state.phase === 'clue') {
      body = myTurn ? (
        <>
          <div className="hs-dock__row">
            <span className="hs-dock__text hs-dock__text--tight"><b>② 단서</b> · 방금 본 카드:</span>
            {mySeen.map((seen) => <span key={seen.slot} className="hs-saw"><b>{seen.slot + 1}번</b> {cardEmoji(seen.card)} {cardLabel(seen.card)}</span>)}
            {sawEmpty && <span className="crux-badge crux-badge--yellow">빈 은신처 발견 — 아무 토큰이나 가능</span>}
            {sawCat && (state.mySwapped
              ? <span className="crux-badge crux-badge--purple">🐱 고양이가 두 카드의 자리를 바꿨어요 → 지금은 {mySeen.map((seen, i) => `${seen.slot + 1}번 ${cardLabel(mySeen[1 - i].card)}`).join(' · ')}</span>
              : <span className="crux-badge">🐱 곰·부엉이와 함께라 자리를 바꾸지 않았어요</span>)}
          </div>
          <div className="hs-dock__row">
            <div className="hs-clues" role="group" aria-label="놓을 단서 토큰">
              {state.clueAnimals.map((a) => {
                const at = tokenSpot(a);
                return (
                  <button key={a} type="button" className="hs-pick" aria-pressed={clueAnimal === a} onClick={() => pickClueAnimal(a)}>
                    <span className="hs-pick__emoji" aria-hidden="true">{ANIMAL_EMOJI[a]}</span>
                    <span>{ANIMAL_LABEL[a]}</span>
                    <small>{at === null ? '대기석' : `${at + 1}번에서 옮김`}</small>
                  </button>
                );
              })}
            </div>
            <button type="button" className="crux-btn crux-btn--primary hs-dock__go" disabled={!clueAnimal || clueTo === null} onClick={confirmClue}>
              {!clueAnimal ? '놓을 토큰을 고르세요' : clueTo === null ? `${ANIMAL_LABEL[clueAnimal]} — 엿본 두 곳 중 놓을 곳을 누르세요` : `${ANIMAL_LABEL[clueAnimal]} 단서를 ${clueTo + 1}번에 놓기`}
            </button>
          </div>
        </>
      ) : <span className="hs-dock__text">{nameOf(state.currentPlayerId)} 님이 {state.hideouts.filter((h) => h.peeking).map((h) => `${h.index + 1}번`).join('·')} 은신처를 엿보고 단서를 고르는 중…</span>;
    } else {
      const waiting = state.players.filter((p) => !p.submitted);
      body = (
        <div className="hs-dock__row">
          <span className="hs-dock__text">
            <b>최종 추리</b> · {state.submitted ? `확정했어요. 기다리는 중: ${waiting.map((p) => p.name).join(', ')}` : '은신처 아래 ‘내 추리’ 칸을 눌러 7칸을 정하세요. 빈 은신처라고 생각하는 칸은 비워 둡니다.'}
          </span>
          {state.submitted
            ? <button type="button" className="crux-btn crux-btn--secondary" onClick={() => send({ type: 'unsubmit_guess' })}>확정 취소</button>
            : <button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'submit_guess' })}>추리 확정 ({board.filter(Boolean).length}칸 채움)</button>}
        </div>
      );
    }
    return (
      <footer className="hs-dock" aria-label="지금 할 일">
        <div className="hs-dock__inner">
          <div className="hs-dock__head">
            <span className={`hs-dot hs-c--${colorOf[playerId]}`} /><strong>{me.name}</strong>
            {myTurn && <span className="crux-badge crux-badge--orange">▲ 내 차례</span>}
          </div>
          {body}
        </div>
      </footer>
    );
  };

  const phaseBadge = state.phase === 'peek' ? <span className="crux-badge crux-badge--green">탐색</span>
    : state.phase === 'clue' ? <span className="crux-badge crux-badge--orange">단서</span>
      : state.phase === 'guess' ? <span className="crux-badge crux-badge--purple">최종 추리</span>
        : state.phase === 'reveal' ? <span className="crux-badge crux-badge--yellow">정답 공개</span>
          : <span className="crux-badge crux-badge--red">종료</span>;

  return (
    <main className="hs" aria-label="동물들의 숨바꼭질">
      <header className="hs__head">
        <div className="hs__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <span className="crux-badge crux-badge--orange">동물들의 숨바꼭질</span>
          <h1>{room.name || '숲속 숨바꼭질'}</h1>
          <span className="crux-badge crux-badge--code">{state.players.length}인 · {state.round}/{state.totalRounds}라운드</span>
        </div>
        <div className="hs__status">
          {phaseBadge}
          {(state.phase === 'peek' || state.phase === 'clue') && (myTurn
            ? <span className="crux-badge crux-badge--orange">▲ 내 차례</span>
            : <span className="crux-badge">{nameOf(state.currentPlayerId)} 차례</span>)}
          <span className="crux-badge">턴 {Math.min(state.turnPos, state.turnOrder.length)}/{state.turnOrder.length}</span>
        </div>
      </header>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {message}
        </div>
      )}

      <div className="hs__layout">
        <div className="hs__main">
          {renderFinished()}
          {renderResult()}
          <section className="hs-card hs-forest" aria-label="숲속 은신처">
            <div className="hs-forest__head">
              <h2>숲속 은신처 <small>7곳 · 카드 {state.deck.animals + state.deck.empty}장(동물 {state.deck.animals} + 빈 은신처 {state.deck.empty}){state.deck.removed ? ` 중 ${state.deck.removed}장은 치워 둠` : ' 전부 숨김'}{catInPlay ? ' · 🐱 고양이 있음' : ''}</small></h2>
              <span className="hs-note">{revealed ? '모든 카드가 공개됐어요.' : myPeekTurn ? '테두리가 밝은 은신처를 눌러 2곳을 고르세요.' : myClueTurn ? '토큰을 고른 뒤, 방금 엿본 두 곳 중 놓을 곳을 누르세요.' : '위 = 공용 단서 토큰 · 가운데 = 은신처 · 아래 = 카드와 내 추리'}</span>
            </div>
            {renderOrder()}
            {renderReserve()}
            <ol className="hs-hides">{state.hideouts.map(renderHideout)}</ol>
            {me && !revealed && <p className="hs-note hs-forest__foot">🙈 가림막 뒤 — 👁 표시 카드와 ‘내 추리’ 칸은 나만 볼 수 있어요. 엿본 카드는 추리판에 자동으로 메모됩니다.{catInPlay ? ' 👁 는 내가 봤을 때의 카드라, 그 뒤에 고양이가 자리를 바꿨다면 지금은 다를 수 있어요.' : ''}</p>}
            {renderPalette()}
          </section>
        </div>
        <aside className="hs__side">
          {renderPlayers()}
          {renderHistory()}
          {narrow ? (
            <details className="hs-card hs-fold">
              <summary>규칙 · 숲속 일지</summary>
              {rules}
              <ol className="hs-log">{state.log.slice().reverse().slice(0, 20).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}</ol>
            </details>
          ) : (
            <>
              <details className="hs-card hs-fold"><summary>규칙 요약</summary>{rules}</details>
              <section className="hs-card" aria-label="기록">
                <h2>숲속 일지</h2>
                <ol className="hs-log">{state.log.slice().reverse().slice(0, 25).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}</ol>
              </section>
            </>
          )}
        </aside>
      </div>

      {renderDock()}
    </main>
  );
};

export default HideGame;
