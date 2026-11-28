import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import {
  HIDDEN_ANIMAL_EMOJI as ANIMAL_EMOJI, HIDDEN_ANIMAL_LABEL as ANIMAL_LABEL, HIDDEN_LEVEL_NAMES, HIDDEN_SPECIALS, HIDDEN_SPECIAL_EFFECT,
  HiddenAction, HiddenAnimal, HiddenCard, HiddenClientState, HiddenHideoutView, HiddenSpecial,
} from '../types/hidden.types';
import socketService from '../services/socket.service';
import './HiddenGame.css';

interface HiddenGameProps {
  room: GameRoom;
  playerId: string;
  state: HiddenClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const HIDEOUT_EMOJI = ['🌳', '🪨', '🏞️', '🌿', '⛰️', '🌷', '🕳️', '🌊'];
const MAX_TOKENS = 2;
// 술래 색: 순서 띠·점·결과표에서 같은 사람은 같은 색
const COLORS = ['blue', 'purple', 'pink', 'lime', 'yellow', 'red'] as const;

function cardLabel(card: HiddenCard): string { return card === 'empty' ? '빈 은신처' : ANIMAL_LABEL[card]; }
function cardEmoji(card: HiddenCard): string { return card === 'empty' ? '🍃' : ANIMAL_EMOJI[card]; }

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

/** 단서 토큰. 13종이라 그림만으로는 헷갈려서 이름을 아래에 붙인다. */
const Token: React.FC<{ animal: HiddenAnimal; latest?: boolean }> = ({ animal, latest }) => (
  <span className={`ha-tokbox${latest ? ' ha-tokbox--latest' : ''}`} title={latest ? `${ANIMAL_LABEL[animal]} — 가장 최근에 놓인 단서` : ANIMAL_LABEL[animal]}>
    <span className="ha-tok ha-tok--md" role="img" aria-label={`${ANIMAL_LABEL[animal]} 토큰${latest ? ' (최신 단서)' : ''}`}>{ANIMAL_EMOJI[animal]}</span>
    <small aria-hidden="true">{ANIMAL_LABEL[animal]}</small>
  </span>
);

const HiddenGame: React.FC<HiddenGameProps> = ({ room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom }) => {
  const isHost = room.players.find((p) => p.id === playerId)?.isHost ?? false;
  const narrow = useNarrow();
  const me = state.players.find((p) => p.isMe) ?? null;
  const revealed = state.phase === 'reveal' || state.phase === 'finished';
  const myTurn = !!me && state.currentPlayerId === playerId;
  const myPeekTurn = myTurn && state.phase === 'peek';
  const myClueTurn = myTurn && state.phase === 'clue';
  const canEditBoard = !!me && !revealed && !state.submitted;
  const slotCount = state.hideouts.length;

  const [peekPicks, setPeekPicks] = useState<number[]>([]);
  const [clueAnimal, setClueAnimal] = useState<HiddenAnimal | null>(null);
  const [clueTo, setClueTo] = useState<number | null>(null);
  const [editSlot, setEditSlot] = useState<number | null>(null);

  const clue = myClueTurn ? state.clue : null;
  const clueChoices = useMemo(() => clue?.animals ?? [], [clue]);

  // 차례·단계가 바뀌면 고르던 것을 지운다.
  useEffect(() => { setPeekPicks([]); setClueAnimal(null); setClueTo(null); }, [state.currentPlayerId, state.phase, state.turnPos, state.round]);
  useEffect(() => { if (!canEditBoard) setEditSlot(null); }, [canEditBoard]);
  useEffect(() => { setEditSlot(null); }, [state.round]);
  // 고를 수 있는 단서가 하나뿐이면 미리 골라 둔다.
  useEffect(() => { if (myClueTurn && clueChoices.length === 1) setClueAnimal(clueChoices[0]); }, [myClueTurn, clueChoices]);

  const colorOf = useMemo(() => {
    const map: Record<string, string> = {};
    state.players.forEach((p, i) => { map[p.id] = COLORS[i % COLORS.length]; });
    return map;
  }, [state.players]);
  const nameOf = (id: string | null | undefined) => state.players.find((p) => p.id === id)?.name ?? id ?? '';
  const send = (action: HiddenAction) => socketService.hiddenAction(room.id, playerId, action);
  const board = state.board ?? [];
  const result = state.lastResult;
  const myCorrect = result && me ? result.correct[me.id] : null;
  const mySeen = myClueTurn ? state.mySeen ?? [] : [];
  const seenCards = mySeen.map((seen) => seen.card);
  const eyeSlots = state.hideouts.filter((h) => h.eye).map((h) => h.index);
  const eyeText = eyeSlots.map((s) => `${s + 1}번`).join('·');
  const level = state.options.level;
  const specialsText = level === 0 ? '특수 동물 없음'
    : state.deck.specials ? state.deck.specials.map((s) => ANIMAL_LABEL[s]).join('·')
      : `특수 동물 ${level}종 비공개`;

  const tokenSpot = (animal: HiddenAnimal): number | null => state.hideouts.find((h) => h.tokens.includes(animal))?.index ?? null;
  // 단서는 눈 토큰이 놓인(방금 엿본) 두 곳 중, 고른 토큰이 이미 놓여 있지 않은 곳에만 놓을 수 있다.
  const isTarget = (h: HiddenHideoutView) => myClueTurn && !!clueAnimal && h.eye && h.tokens.length < MAX_TOKENS && !h.tokens.includes(clueAnimal);

  const clickTile = (h: HiddenHideoutView) => {
    if (myPeekTurn) {
      if (!state.peekable.includes(h.index)) return;
      setPeekPicks((prev) => prev.includes(h.index) ? prev.filter((x) => x !== h.index) : prev.length < 2 ? [...prev, h.index] : [prev[1], h.index]);
    } else if (isTarget(h)) {
      setClueTo(h.index);
    }
  };
  const confirmPeek = () => { if (myPeekTurn && peekPicks.length === 2) send({ type: 'peek', slots: peekPicks }); };
  const confirmClue = () => { if (myClueTurn && clueAnimal && clueTo !== null) send({ type: 'clue', animal: clueAnimal, to: clueTo }); };
  const pickClueAnimal = (animal: HiddenAnimal) => {
    setClueAnimal(animal);
    // 고른 토큰이 이미 놓여 있는 곳은 목적지가 될 수 없다.
    if (clueTo !== null && state.hideouts[clueTo].tokens.includes(animal)) setClueTo(null);
  };
  const setGuess = (animal: HiddenAnimal | null) => {
    if (editSlot === null || !canEditBoard) return;
    send({ type: 'set_board', slot: editSlot, animal });
    setEditSlot(null);
  };

  // --- 순서 띠 (스네이크 드래프트) ---
  const renderOrder = () => (
    <ol className="ha-order" aria-label="이번 라운드 턴 순서">
      {state.turnOrder.map((id, i) => {
        const done = i < state.turnPos || state.phase === 'guess' || revealed;
        const now = !done && i === state.turnPos;
        return (
          <li key={i} className={['ha-order__item', done ? 'is-done' : '', now ? 'is-now' : ''].filter(Boolean).join(' ')} aria-current={now ? 'step' : undefined}>
            <span className={`ha-dot ha-c--${colorOf[id]}`} />{nameOf(id)}{id === playerId ? ' (나)' : ''}
          </li>
        );
      })}
      <li className={['ha-order__item ha-order__item--end', state.phase === 'guess' ? 'is-now' : '', revealed ? 'is-done' : ''].filter(Boolean).join(' ')}>최종 추리</li>
    </ol>
  );

  // --- 은신처 ---
  const renderHideout = (h: HiddenHideoutView) => {
    const pickable = myPeekTurn && state.peekable.includes(h.index);
    const target = isTarget(h);
    const picked = (myPeekTurn && peekPicks.includes(h.index)) || (myClueTurn && clueTo === h.index);
    const clickable = pickable || target;
    const guess = board[h.index] ?? null;
    const shown: HiddenCard | null = revealed ? h.card : h.known;
    const cls = ['ha-hide', h.locked ? 'ha-hide--locked' : '', h.eye ? (state.eyesNow ? 'ha-hide--peeking' : 'ha-hide--eyed') : '', clickable ? 'ha-hide--clickable' : '', picked ? 'ha-hide--picked' : '',
      myPeekTurn && !pickable ? 'ha-hide--dim' : '', revealed && myCorrect ? (myCorrect[h.index] ? 'ha-hide--hit' : 'ha-hide--miss') : ''].filter(Boolean).join(' ');
    return (
      <li key={h.index} className={cls}>
        <div className="ha-hide__clues" aria-label={`${h.index + 1}번 은신처의 단서 토큰 ${h.tokens.length}개`}>
          {h.tokens.map((a) => <Token key={a} animal={a} latest={state.lastClue?.animal === a && state.lastClue.to === h.index} />)}
          {Array.from({ length: MAX_TOKENS - h.tokens.length }, (_, i) => <span key={i} className="ha-tokbox" aria-hidden="true"><span className="ha-tok ha-tok--md ha-tok--slot" /><small>&nbsp;</small></span>)}
        </div>
        <button type="button" className="ha-hide__tile" onClick={() => clickTile(h)} disabled={!clickable} aria-pressed={clickable ? picked : undefined}
          aria-label={`${h.index + 1}번 ${h.name}${h.locked ? ' (잠김)' : ''}${h.eye ? ' (눈 토큰)' : ''}${pickable ? ' 엿보기' : target ? '에 단서 놓기' : ''}`}>
          <span className="ha-hide__no">{h.index + 1}</span>
          <span className="ha-hide__emoji" aria-hidden="true">{HIDEOUT_EMOJI[h.index]}</span>
          <span className="ha-hide__name">{h.name}</span>
          {h.locked && <span className="ha-hide__flag ha-hide__flag--lock">🔒 잠김</span>}
          {h.eye && <span className={`ha-hide__flag ${state.eyesNow ? 'ha-hide__flag--peek' : 'ha-hide__flag--eyed'}`}>👀 {state.eyesNow ? '엿보는 중' : '직전에 엿봄'}</span>}
        </button>
        <div className={['ha-hide__card', shown ? 'is-open' : '', shown === 'empty' ? 'is-empty' : ''].filter(Boolean).join(' ')}
          aria-label={shown ? `${revealed ? '정답' : '내가 본 카드'}: ${cardLabel(shown)}` : '뒷면 카드'}>
          {shown ? <><span className="ha-hide__card-emoji" aria-hidden="true">{cardEmoji(shown)}</span><span>{cardLabel(shown)}</span></> : <span className="ha-hide__card-back" aria-hidden="true">?</span>}
          {shown && !revealed && <span className="ha-hide__seen" title="내가 직접 본 카드">👁</span>}
        </div>
        {me && (
          <button type="button" className={['ha-hide__guess', guess ? 'has-token' : '', editSlot === h.index ? 'is-editing' : ''].filter(Boolean).join(' ')}
            onClick={() => setEditSlot(editSlot === h.index ? null : h.index)} disabled={!canEditBoard}
            aria-label={`${h.index + 1}번 내 추리: ${guess ? ANIMAL_LABEL[guess] : '비움'}`}>
            {guess ? <><span aria-hidden="true">{ANIMAL_EMOJI[guess]}</span><span>{ANIMAL_LABEL[guess]}</span></> : <span className="ha-hide__guess-none">비움</span>}
            {revealed && myCorrect && <span className={`ha-mark ${myCorrect[h.index] ? 'ha-mark--hit' : 'ha-mark--miss'}`} aria-label={myCorrect[h.index] ? '적중' : '빗나감'}>{myCorrect[h.index] ? '○' : '✕'}</span>}
          </button>
        )}
      </li>
    );
  };

  // --- 추리 토큰 고르기 (가림막 뒤) ---
  const renderPalette = () => {
    if (editSlot === null || !canEditBoard) return null;
    return (
      <div className="ha-palette" role="group" aria-label={`${editSlot + 1}번 은신처 추리 고르기`}>
        <div className="ha-palette__head">
          <strong>{editSlot + 1}번 {state.hideouts[editSlot].name}</strong>
          <span className="ha-note">여기 숨은 동물을 고르세요. 동물 토큰은 한 칸에만 올릴 수 있어요.</span>
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={() => setEditSlot(null)}>닫기</button>
        </div>
        <div className="ha-palette__list">
          {state.animals.map((a) => {
            const at = board.indexOf(a);
            return (
              <button key={a} type="button" className="ha-pick" aria-pressed={board[editSlot] === a} onClick={() => setGuess(a)}>
                <span className="ha-pick__emoji" aria-hidden="true">{ANIMAL_EMOJI[a]}</span>
                <span>{ANIMAL_LABEL[a]}</span>
                {at >= 0 && at !== editSlot && <small>{at + 1}번에서 옮김</small>}
              </button>
            );
          })}
          <button type="button" className="ha-pick ha-pick--clear" aria-pressed={board[editSlot] === null} onClick={() => setGuess(null)}>
            <span className="ha-pick__emoji" aria-hidden="true">🍃</span><span>비우기</span><small>빈 은신처로 추리</small>
          </button>
        </div>
      </div>
    );
  };

  // --- 대기석과 직전 턴 ---
  const renderReserve = () => (
    <div className="ha-reserve" aria-label="단서 토큰 대기석">
      <span className="ha-reserve__label">대기석 <small>{state.reserve.length}/{state.animals.length}</small></span>
      <span className="ha-reserve__list">
        {state.reserve.length ? state.reserve.map((a) => <Token key={a} animal={a} />) : <span className="ha-note">모든 단서 토큰이 은신처 위에 있어요.</span>}
      </span>
    </div>
  );
  const renderLastTurn = () => {
    if (revealed || !state.lastClue) return null;
    const last = state.history[state.history.length - 1];
    if (!last) return null;
    return (
      <p className="ha-last" aria-label="직전 턴">
        <span className={`ha-dot ha-c--${colorOf[last.playerId]}`} />
        <span>직전 턴 · <b>{nameOf(last.playerId)}</b> 님이 {last.peeked.map((s) => `${s + 1}번`).join('·')}을 엿보고 {ANIMAL_EMOJI[last.animal]} <b>{ANIMAL_LABEL[last.animal]}</b> 단서를 <b>{last.to + 1}번</b>에 놓았어요.</span>
      </p>
    );
  };

  // --- 라운드 결과 ---
  const renderResult = () => {
    if (!revealed || !result) return null;
    const emptySlot = result.hideouts.indexOf('empty');
    const trick = result.hideouts.map((card, i) => ((card === 'monkey' && i === 0) || (card === 'snake' && i === 3) ? `${i + 1}번 ${cardLabel(card)}` : '')).filter(Boolean);
    return (
      <section className="ha-card ha-card--act" aria-label={`${result.round}라운드 정답 공개`}>
        <div className="ha-card__title">
          <h2>{result.round}라운드 정답 공개</h2>
          <span className="crux-badge">{emptySlot >= 0 ? `빈 은신처: ${emptySlot + 1}번` : `빈 은신처 없음 · 동물 ${slotCount}마리`}</span>
        </div>
        <div className="ha-scroll">
          <table className="ha-table ha-table--result">
            <thead>
              <tr><th>술래</th>{state.hideouts.map((h) => <th key={h.index} title={h.name}>{h.index + 1}</th>)}<th>점수</th></tr>
              <tr className="ha-table__answer"><th>정답</th>{result.hideouts.map((card, i) => <td key={i} title={cardLabel(card)}>{cardEmoji(card)}</td>)}<td /></tr>
            </thead>
            <tbody>
              {state.players.map((p) => (
                <tr key={p.id} className={p.isMe ? 'is-me' : ''}>
                  <th><span className={`ha-dot ha-c--${colorOf[p.id]}`} /> {p.name}</th>
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
        <p className="ha-note">초록 칸 = 적중. 치워 둔 {result.removed.length}장: {result.removed.map((card) => `${cardEmoji(card)} ${cardLabel(card)}`).join(' · ')}</p>
        {level > 0 && <p className="ha-note">이번 라운드의 특수 동물: {result.specials.map((s) => `${ANIMAL_EMOJI[s]} ${ANIMAL_LABEL[s]}`).join(' · ')}{trick.length ? ` — ${trick.join(', ')}는 엿본 사람에게 빈 은신처와 같은 효과였어요.` : ''}</p>}
        {state.phase === 'reveal' && (
          <div className="ha-card__buttons"><button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'next_round' })}>모두 회수하고 {state.round + 1}라운드로</button></div>
        )}
      </section>
    );
  };

  const renderFinished = () => {
    if (state.phase !== 'finished' || !state.standings) return null;
    const winners = state.standings.filter((s) => s.winner);
    return (
      <section className="ha-card ha-card--act ha-final" aria-label="최종 결과">
        <div className="ha-card__title"><h2>🏆 {winners.map((w) => w.name).join(' · ')} {winners.length > 1 ? '공동 승리' : '승리'}!</h2><span className="crux-badge">{state.totalRounds}라운드 종료</span></div>
        <p className="ha-note">{state.result?.message}</p>
        <div className="ha-scroll">
          <table className="ha-table">
            <thead><tr><th>순위</th><th>술래</th>{Array.from({ length: state.totalRounds }, (_, i) => <th key={i}>{i + 1}R</th>)}<th>누적</th><th></th></tr></thead>
            <tbody>
              {state.standings.map((s) => {
                const p = state.players.find((x) => x.id === s.playerId);
                return (
                  <tr key={s.playerId} className={s.playerId === playerId ? 'is-me' : ''}>
                    <td className="rank">{s.rank}</td>
                    <td><span className={`ha-dot ha-c--${colorOf[s.playerId]}`} /> {s.name}</td>
                    {Array.from({ length: state.totalRounds }, (_, i) => <td key={i}>{p?.roundScores[i] ?? 0}</td>)}
                    <td><b>{s.total}</b></td>
                    <td>{s.winner ? <span className="crux-badge crux-badge--green">승리</span> : null}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <p className="ha-note">동점이면 마지막 라운드 점수가 높은 사람이 이기고, 그것도 같으면 공동 승리예요.</p>
        <div className="ha-card__buttons">
          <button type="button" className="crux-btn crux-btn--secondary" onClick={onLeaveRoom}>로비로 나가기</button>
          {isHost && <button type="button" className="crux-btn crux-btn--primary" onClick={onReturnToRoom}>방으로 돌아가기</button>}
        </div>
      </section>
    );
  };

  // --- 술래들 ---
  const renderPlayers = () => (
    <section className="ha-card" aria-label="술래들">
      <h2>술래들 <small>{state.phase === 'finished' ? '최종' : `${state.round}/${state.totalRounds}라운드`}</small></h2>
      <div className="ha-players">
        {state.players.map((p) => (
          <div key={p.id} className={['ha-player', p.id === state.currentPlayerId ? 'ha-player--turn' : '', p.isMe ? 'ha-player--me' : ''].filter(Boolean).join(' ')}>
            <span className={`ha-dot ha-c--${colorOf[p.id]}`} />
            <strong>{p.name}</strong>
            {p.isMe && <span className="crux-badge">나</span>}
            {p.id === state.currentPlayerId && <span className="crux-badge crux-badge--orange">▲ {state.phase === 'peek' ? '엿보는 중' : '단서 놓는 중'}</span>}
            {state.phase === 'guess' && <span className={`crux-badge ${p.submitted ? 'crux-badge--green' : 'crux-badge--outline'}`}>{p.submitted ? '확정' : '추리 중'}</span>}
            <span className="ha-player__turns" aria-label={`이번 라운드 ${p.turnsTaken}/2턴`}>
              {[0, 1].map((i) => <i key={i} className={i < p.turnsTaken ? 'on' : ''} />)}
            </span>
            <span className="ha-player__score">{p.total}</span>
          </div>
        ))}
      </div>
      <p className="ha-note">점 = 이번 라운드에 마친 턴. 숫자 = 누적 점수.</p>
    </section>
  );

  // --- 이번 라운드 단서 기록 ---
  const renderHistory = () => (
    <section className="ha-card" aria-label="이번 라운드 단서 기록">
      <h2>단서 기록 <small>{state.history.length}/{state.turnOrder.length}턴</small></h2>
      {state.history.length === 0 ? <p className="ha-note">아직 놓인 단서가 없어요.</p> : (
        <ol className="ha-history">
          {state.history.map((t, i) => (
            <li key={i}>
              <span className={`ha-dot ha-c--${colorOf[t.playerId]}`} />
              <span><b>{nameOf(t.playerId)}</b> · {t.peeked.map((s) => `${s + 1}번`).join('·')} 엿봄 → {ANIMAL_EMOJI[t.animal]} {ANIMAL_LABEL[t.animal]} 단서를 <b>{t.to + 1}번</b>에 <small>({t.from === null ? '대기석에서' : `${t.from + 1}번에서 옮김`})</small></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );

  // 무작위 모드에서는 어떤 특수 동물이 들었는지 모르므로 네 종의 효과를 모두 안내한다.
  const ruleSpecials: HiddenSpecial[] = level === 0 ? [] : state.deck.specials ?? [...HIDDEN_SPECIALS];
  const rules = (
    <ul className="ha-rules">
      <li>내 턴: <b>토큰 0~1개</b>인 은신처 2곳을 몰래 엿본 뒤(눈 토큰 👀이 놓여요), 본 동물 중 하나의 단서 토큰을 <b>눈 토큰이 놓인 두 곳 중 한 곳</b>에 놓아요. 진짜여도 가짜여도 돼요.</li>
      <li>단서 토큰은 대기석에서 가져오거나 다른 은신처에서 옮길 수 있어요. 한 은신처에 2개까지, 2개면 <b>잠김</b>.</li>
      <li><b>빈 은신처</b>를 봤다면 아무 동물 토큰이나 놓을 수 있어요.</li>
      {ruleSpecials.map((s) => <li key={s}><b>{ANIMAL_EMOJI[s]} {ANIMAL_LABEL[s]}</b> — {HIDDEN_SPECIAL_EFFECT[s]}</li>)}
      {state.options.random && <li>이 판은 <b>비공개 무작위</b>: 위 네 종 중 {level}종이 라운드마다 새로 뽑혀 들어가요.</li>}
      <li>모두 2턴씩 마치면 추리판을 동시에 공개하고, 맞힌 은신처마다 1점. 빈 은신처는 비워 둬야 적중이고, 나무의 원숭이·덤불의 뱀은 그 동물 토큰을 올려야 적중이에요.</li>
    </ul>
  );

  // --- 하단 도크: 지금 할 일 ---
  const renderDock = () => {
    if (revealed || !me) return null;
    let body: React.ReactNode;
    if (state.phase === 'peek') {
      body = myTurn ? (
        <div className="ha-dock__row">
          <span className="ha-dock__text"><b>① 탐색</b> · 엿볼 은신처 2곳을 누르세요. 잠긴(🔒) 곳은 볼 수 없어요. <b>{peekPicks.length}/2</b>{peekPicks.length ? ` — ${peekPicks.map((s) => `${s + 1}번`).join(', ')}` : ''}</span>
          <button type="button" className="crux-btn crux-btn--primary" disabled={peekPicks.length !== 2} onClick={confirmPeek}>몰래 엿보기</button>
        </div>
      ) : <span className="ha-dock__text">{nameOf(state.currentPlayerId)} 님이 엿볼 은신처를 고르는 중… 기다리는 동안 추리판을 정리해 두세요.</span>;
    } else if (state.phase === 'clue') {
      body = myTurn && clue ? (
        <>
          <div className="ha-dock__row">
            <span className="ha-dock__text ha-dock__text--tight"><b>② 단서</b> · 방금 본 카드:</span>
            {mySeen.map((seen) => <span key={seen.slot} className="ha-saw"><b>{seen.slot + 1}번</b> {cardEmoji(seen.card)} {cardLabel(seen.card)}</span>)}
            {clue.any.includes('empty') && <span className="crux-badge crux-badge--yellow">빈 은신처 발견 — 아무 토큰이나 가능</span>}
            {clue.any.includes('monkey') && <span className="crux-badge crux-badge--yellow">🐒 나무 위의 원숭이 — 빈 은신처처럼 아무 토큰이나 가능</span>}
            {clue.any.includes('snake') && <span className="crux-badge crux-badge--yellow">🐍 덤불 속의 뱀 — 빈 은신처처럼 아무 토큰이나 가능</span>}
            {clue.disguise && <span className="crux-badge crux-badge--purple">🦡 오소리 — 너구리 토큰으로 위장 가능</span>}
            {seenCards.includes('parrot') && (clue.copy
              ? <span className="crux-badge crux-badge--purple">🦜 앵무새 — 직전 단서({ANIMAL_LABEL[clue.copy]}) 따라 놓기 가능</span>
              : <span className="crux-badge">🦜 앵무새 — 따라 할 직전 단서가 없어요</span>)}
          </div>
          <div className="ha-dock__row">
            <div className="ha-clues" role="group" aria-label="놓을 단서 토큰">
              {clueChoices.map((a) => {
                const at = tokenSpot(a);
                const tag = !seenCards.includes(a) && clue.copy === a ? '따라 하기' : !seenCards.includes(a) && clue.disguise && a === 'raccoon' ? '위장' : '';
                return (
                  <button key={a} type="button" className="ha-pick" aria-pressed={clueAnimal === a} onClick={() => pickClueAnimal(a)}>
                    <span className="ha-pick__emoji" aria-hidden="true">{ANIMAL_EMOJI[a]}</span>
                    <span>{ANIMAL_LABEL[a]}</span>
                    <small>{tag ? `${tag} · ` : ''}{at === null ? '대기석' : `${at + 1}번에서 옮김`}</small>
                  </button>
                );
              })}
            </div>
            <button type="button" className="crux-btn crux-btn--primary ha-dock__go" disabled={!clueAnimal || clueTo === null} onClick={confirmClue}>
              {!clueAnimal ? '놓을 토큰을 고르세요' : clueTo === null ? `${ANIMAL_LABEL[clueAnimal]} — 눈 토큰이 놓인 두 곳 중 하나를 누르세요` : `${ANIMAL_LABEL[clueAnimal]} 단서를 ${clueTo + 1}번에 놓기`}
            </button>
          </div>
        </>
      ) : <span className="ha-dock__text">{nameOf(state.currentPlayerId)} 님이 {eyeText} 은신처를 엿보고 단서를 고르는 중…</span>;
    } else {
      const waiting = state.players.filter((p) => !p.submitted);
      body = (
        <div className="ha-dock__row">
          <span className="ha-dock__text">
            <b>최종 추리</b> · {state.submitted ? `확정했어요. 기다리는 중: ${waiting.map((p) => p.name).join(', ')}` : `은신처 아래 ‘내 추리’ 칸을 눌러 ${slotCount}칸을 정하세요. 빈 은신처라고 생각하는 칸은 비워 둡니다.`}
          </span>
          {state.submitted
            ? <button type="button" className="crux-btn crux-btn--secondary" onClick={() => send({ type: 'unsubmit_guess' })}>확정 취소</button>
            : <button type="button" className="crux-btn crux-btn--primary" onClick={() => send({ type: 'submit_guess' })}>추리 확정 ({board.filter(Boolean).length}칸 채움)</button>}
        </div>
      );
    }
    return (
      <footer className="ha-dock" aria-label="지금 할 일">
        <div className="ha-dock__inner">
          <div className="ha-dock__head">
            <span className={`ha-dot ha-c--${colorOf[playerId]}`} /><strong>{me.name}</strong>
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
    <main className="ha" aria-label="숨은 동물 찾기">
      <header className="ha__head">
        <div className="ha__title">
          <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom}>← 나가기</button>
          <span className="crux-badge crux-badge--green">숨은 동물 찾기</span>
          <h1>{room.name || '숲속 숨바꼭질'}</h1>
          <span className="crux-badge crux-badge--code">{state.players.length}인 · {state.round}/{state.totalRounds}라운드</span>
          <span className="crux-badge" title={specialsText}>Lv.{level} {HIDDEN_LEVEL_NAMES[level]}</span>
        </div>
        <div className="ha__status">
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

      <div className="ha__layout">
        <div className="ha__main">
          {renderFinished()}
          {renderResult()}
          <section className="ha-card ha-forest" aria-label="숲속 은신처">
            <div className="ha-forest__head">
              <h2>숲속 은신처 <small>{slotCount}곳 · 카드 {state.deck.animals + 1}장(동물 {state.deck.animals} + 빈 은신처 1) 중 {state.deck.removed}장은 치워 둠 · {specialsText}</small></h2>
              <span className="ha-note">{revealed ? '모든 카드가 공개됐어요.' : myPeekTurn ? '테두리가 밝은 은신처를 눌러 2곳을 고르세요.' : myClueTurn ? '토큰을 고른 뒤, 눈 토큰(👀)이 놓인 두 곳 중 놓을 곳을 누르세요.' : '위 = 공용 단서 토큰 · 가운데 = 은신처 · 아래 = 카드와 내 추리'}</span>
            </div>
            {renderOrder()}
            {renderReserve()}
            {renderLastTurn()}
            <ol className="ha-hides" style={{ ['--ha-cols' as string]: slotCount }}>{state.hideouts.map(renderHideout)}</ol>
            {me && !revealed && <p className="ha-note ha-forest__foot">🙈 가림막 뒤 — 👁 표시 카드와 ‘내 추리’ 칸은 나만 볼 수 있어요. 엿본 카드는 추리판에 자동으로 메모됩니다. 👀 = 눈 토큰(가장 최근에 엿본 2곳), 테두리가 굵은 토큰 = 가장 최근에 놓인 단서.</p>}
            {renderPalette()}
          </section>
        </div>
        <aside className="ha__side">
          {renderPlayers()}
          {renderHistory()}
          {narrow ? (
            <details className="ha-card ha-fold">
              <summary>규칙 · 숲속 일지</summary>
              {rules}
              <ol className="ha-log">{state.log.slice().reverse().slice(0, 20).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}</ol>
            </details>
          ) : (
            <>
              <details className="ha-card ha-fold"><summary>규칙 요약</summary>{rules}</details>
              <section className="ha-card" aria-label="기록">
                <h2>숲속 일지</h2>
                <ol className="ha-log">{state.log.slice().reverse().slice(0, 25).map((line, i) => <li key={`${state.log.length - i}`}>{line}</li>)}</ol>
              </section>
            </>
          )}
        </aside>
      </div>

      {renderDock()}
    </main>
  );
};

export default HiddenGame;
