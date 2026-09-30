import React, { useEffect, useMemo, useState } from 'react';
import { GameRoom } from '../types/game.types';
import {
  FellowshipAction,
  FellowshipCard,
  FellowshipClientState,
} from '../types/fellowship.types';
import socketService from '../services/socket.service';
import './FellowshipGame.css';

interface FellowshipGameProps {
  room: GameRoom;
  playerId: string;
  state: FellowshipClientState;
  message?: string;
  messageType?: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
}

const SUITS: Record<string, { label: string; mark: string }> = {
  hills: { label: '언덕', mark: '△' },
  mountains: { label: '산', mark: '▲' },
  shadows: { label: '그림자', mark: '◐' },
  forests: { label: '숲', mark: '♣' },
  rings: { label: '반지', mark: '◎' },
  rivers: { label: '강', mark: '≋' },
};

const GIFT_NAMES: Record<string, string> = {
  broken_sword: '부러진 검', horn_of_gondor: '곤도르의 뿔', mithril_shirt: '미스릴 셔츠', sting: '스팅', glamdring: '글람드링',
};

const CURSE_NAMES: Record<string, string> = {
  black_breath: '검은 숨결', morgul_knife: '모르굴 칼', wraith: '망령', unseen: '보이지 않는 자', terror: '공포',
};

const EVENT_NAMES: Record<string, string> = {
  doors_of_durin: '두린의 문', balins_tomb: '발린의 무덤', long_dark: '긴 어둠', bridge_of_khazad_dum: '카자드둠의 다리',
};

function translateSuitWords(value: string) {
  return value.replace(/\b(hills|mountains|shadows|forests|rings|rivers)\b/g, (word) => SUITS[word]?.label || word);
}

function suitDetails(card: FellowshipCard) {
  const key = (card.suit || '').toLowerCase();
  return SUITS[key] || { label: card.suit || '특수', mark: '✦' };
}

function cardLabel(card: FellowshipCard) {
  if (card.faceDown) return '뒷면 카드';
  const suit = suitDetails(card);
  return (card.name || `${suit.label} ${card.rank ?? '?'}`) + (card.covered ? ' · 덮인 카드' : '');
}

function CardFace({ card, compact = false }: { card: FellowshipCard; compact?: boolean }) {
  const suit = suitDetails(card);
  const suitClass = (card.suit || 'hidden').toLowerCase();
  return <span className={`fellowship-card-face fellowship-suit-${suitClass} ${card.faceDown ? 'fellowship-card-back' : ''} ${card.covered ? 'fellowship-card-covered' : ''} ${compact ? 'compact' : ''}`} aria-label={cardLabel(card)}>
    {card.faceDown ? <span className="fellowship-card-back-mark" aria-hidden="true">✧</span> : <>
      <span className="fellowship-card-rank">{card.rank ?? '✦'}</span>
      <span className="fellowship-card-sigil" aria-hidden="true">{suit.mark}</span>
      <span className="fellowship-card-suit">{suit.label}</span>
    </>}
  </span>;
}

const phaseLabel: Record<FellowshipClientState['phase'], string> = {
  event_selection: '사건 선택',
  character_selection: '캐릭터 선택',
  setup: '준비 행동',
  play: '트릭 진행',
  round_end: '라운드 결과',
  chapter_complete: '챕터 완료',
};

const FellowshipGame: React.FC<FellowshipGameProps> = ({
  room, playerId, state, message, messageType = 'info', onLeaveRoom, onReturnToRoom,
}) => {
  const [ringChoiceCard, setRingChoiceCard] = useState<FellowshipCard | null>(null);
  const [selectedSetupCard, setSelectedSetupCard] = useState<string>('');
  const [selectedCardsBySeat, setSelectedCardsBySeat] = useState<Record<string, string>>({});
  const send = (action: FellowshipAction) => socketService.fellowshipAction(room.id, playerId, action);

  const pending = state.pendingAction;
  const isActionPhase = ['event_selection', 'character_selection', 'setup', 'play'].includes(state.phase);
  const actingSeatId = pending?.seatId || pending?.playerId || state.currentTurn;
  const currentSeat = state.players.find((player) => player.id === actingSeatId);
  const currentName = currentSeat?.characterName || currentSeat?.name || '다음 플레이어';
  const mySeats = state.players.filter((player) => (player.controllerId || player.id) === playerId);
  const canAct = !!currentSeat && (currentSeat.controllerId || currentSeat.id) === playerId;
  const canResolvePending = !!pending && state.players.some((player) => player.id === (pending.seatId || pending.playerId) && (player.controllerId || player.id) === playerId);
  const handsBySeat = state.handsBySeat && Object.keys(state.handsBySeat).length
    ? state.handsBySeat
    : { [mySeats[0]?.id || playerId]: state.hand || [] };
  const visibleHands = Object.entries(handsBySeat).filter(([seatId, cards]) => cards.length > 0 || mySeats.some((player) => player.id === seatId));
  const totalCards = visibleHands.reduce((sum, [, cards]) => sum + cards.length, 0);
  const legalCards = useMemo(() => new Set(state.legalCardsBySeat?.[state.currentTurn || ''] || state.legalCards || []), [state.legalCardsBySeat, state.currentTurn, state.legalCards]);
  const ownCharacters = new Set(state.players.map((player) => player.characterId).filter(Boolean));
  const result = state.result;
  const isHost = room.hostId === playerId;
  const canPassLead = state.canPassLead === true || (state.phase === 'play' && !pending && canAct && !state.trick?.length
    && state.currentTurn === state.currentLeader && currentSeat?.characterId === 'bilbo_baggins');
  const tuckedCards = Object.entries(state.tuckedBySeat || {}).filter(([seatId, card]) => !!card && mySeats.some((player) => player.id === seatId));

  const playCard = (card: FellowshipCard) => {
    if (!canAct || !legalCards.has(card.id)) return;
    if ((card.suit || '').toLowerCase() === 'rings' && card.rank === 1) {
      setRingChoiceCard(card);
      return;
    }
    send({ type: 'play_card', cardId: card.id });
  };

  const performChoice = (choiceId: string, actionType?: string, trump?: boolean) => {
    const type = actionType || pending?.type;
    if (type === 'choose_event') send({ type: 'choose_event', eventId: choiceId });
    else if (type === 'choose_group') send({ type: 'choose_group', groupId: choiceId });
    else send({
      type: 'setup_choice', choiceId,
      ...(selectedSetupCard ? { cardId: selectedSetupCard } : {}),
      ...(trump !== undefined ? { trump } : {}),
      ...(Object.keys(selectedCardsBySeat).length ? { cardsBySeat: selectedCardsBySeat } : {}),
    });
    setSelectedSetupCard('');
    setSelectedCardsBySeat({});
  };

  const setupOptions = pending?.options || pending?.choices || [];
  const setupNeedsCard = !!pending && ['exchange_start', 'exchange_return', 'donate', 'tuck_card', 'precommit_last_card', 'preplay_first_card'].includes(pending.type);
  const setupNeedsMultipleCards = !!pending && ['simultaneous_exchange', 'donate_right', 'long_dark_return'].includes(pending.type);
  const setupSeatId = pending?.seatId || pending?.playerId || '';
  const setupCards = (handsBySeat[setupSeatId] || []).filter((card) => !card.faceDown && (!state.offerableCardsBySeat?.[setupSeatId] || state.offerableCardsBySeat[setupSeatId].includes(card.id)));
  const targetSeatIds = pending?.targetSeatIds || [];
  const simultaneousReady = targetSeatIds.length > 0
    && targetSeatIds.every((seatId) => selectedCardsBySeat[seatId])
    && new Set(Object.values(selectedCardsBySeat)).size === targetSeatIds.length;
  const chapter = state.chapter;
  const chapterMode = chapter.mode || room.fellowshipChapters?.find((item) => item.number === chapter.number)?.mode;
  const objectiveByCharacter = new Map((state.availableCharacters || []).map((character) => [character.id, character.objective]));

  useEffect(() => {
    if (ringChoiceCard && (state.phase !== 'play' || !canAct || !legalCards.has(ringChoiceCard.id))) setRingChoiceCard(null);
  }, [ringChoiceCard, state.phase, canAct, legalCards]);

  useEffect(() => {
    setSelectedSetupCard('');
    setSelectedCardsBySeat({});
  }, [pending?.type, pending?.seatId, pending?.prompt]);

  return <main className="fellowship-game">
    <header className="fellowship-header">
      <div className="fellowship-header-title">
        <div className="fellowship-eyebrow">THE FELLOWSHIP OF THE RING · TRICK-TAKING</div>
        <h1>반지 원정대</h1>
        <p>챕터 {chapter.number} · {chapter.titleKo || chapter.title}</p>
      </div>
      <div className="fellowship-header-actions">
        <span className="fellowship-phase-chip">{phaseLabel[state.phase]}</span>
        <button type="button" className="fellowship-leave" onClick={onLeaveRoom}>방 나가기</button>
      </div>
    </header>

    <div className="fellowship-journey" aria-label="챕터 진행도">
      <span>여정</span>
      <div className="fellowship-journey-track" role="progressbar" aria-valuemin={1} aria-valuemax={18} aria-valuenow={chapter.number}>
        <span style={{ width: `${Math.min(100, Math.max(0, chapter.number / 18 * 100))}%` }} />
      </div>
      <strong>{chapter.number} / 18</strong>
    </div>

    {(message || state.message) && <div className={`fellowship-notice ${messageType}`} role="status">{message || state.message}</div>}

    <section className="fellowship-chapter-intro" aria-label="현재 챕터">
      <div>
        <span className="fellowship-small-label">현재 목표</span>
        <h2>{chapter.titleKo || chapter.title}</h2>
        <p>{chapter.summary || chapter.victory || (chapterMode === 'short' ? '이번 라운드의 목표를 모두 달성하세요.' : '각 캐릭터의 목표를 달성하며 챕터를 이어가세요.')}</p>
      </div>
      <div className="fellowship-chapter-stats">
        <span>라운드 <strong>{state.round ?? 1}</strong></span>
        <span>인원 <strong>{room.players.length}</strong></span>
        <span>반지 문양 <strong>{state.ringTokenActive ? '활성' : '잠김'}</strong></span>
        {chapterMode !== 'short' && <span>달성 캐릭터 <strong>{state.completedCharacters?.length || 0}명</strong></span>}
      </div>
    </section>

    {!!(state.announcements?.length || state.currentEvent) && <div className="fellowship-public-notes" aria-label="공개된 정보">
      {state.currentEvent && <span>현재 사건: <strong>{EVENT_NAMES[state.currentEvent] || state.currentEvent}</strong></span>}
      {state.announcements?.map((announcement, index) => <span key={`${index}-${announcement}`}>{translateSuitWords(announcement)}</span>)}
    </div>}

    <div className="fellowship-layout">
      <section className="fellowship-table" aria-label="트릭 테이블">
        <div className="fellowship-section-heading">
          <div><span className="fellowship-small-label">TABLE</span><h2>테이블</h2></div>
          {isActionPhase && currentSeat && <span className="fellowship-turn-badge">{canAct ? '내가 조종' : '다른 플레이어 차례'}</span>}
        </div>

        {isActionPhase && currentSeat && <div className={`fellowship-turn-banner ${canAct ? 'is-mine' : ''}`} role="status" aria-live="polite">
          <span className="fellowship-turn-banner-label">현재 차례</span>
          <strong>{currentName}</strong>
          <span className="fellowship-turn-banner-detail">{pending?.prompt || (canAct ? '손패에서 낼 카드를 선택하세요.' : '카드 선택을 기다리고 있습니다.')}</span>
        </div>}

        <div className="fellowship-players" aria-label="플레이어 상태">
          {state.players.map((player) => {
            const isTurn = isActionPhase && player.id === actingSeatId;
            const isMe = (player.controllerId || player.id) === playerId;
            const objectiveStatus = player.objectiveStatus || (player.objectiveComplete ? 'complete' : 'pending');
            const objectiveStatusLabel = objectiveStatus === 'complete' ? '달성' : objectiveStatus === 'failed' ? '실패'
              : state.phase === 'round_end' || state.phase === 'chapter_complete' ? '미판정' : '진행 중';
            return <article key={player.id} aria-current={isTurn ? 'step' : undefined} className={`fellowship-player ${isTurn ? 'is-turn' : ''} ${isMe ? 'is-mine' : ''}`}>
              <div className="fellowship-player-name">
                <span className="fellowship-player-avatar" aria-hidden="true">{(player.characterName || player.name).charAt(0)}</span>
                <div><strong>{player.characterName || '캐릭터 선택 중'}</strong><small>{player.name}{isMe ? ' · 내가 조종' : ''}</small></div>
              </div>
              {isTurn && <span className="fellowship-player-turn">▶ 현재 차례</span>}
              <div className="fellowship-player-counts"><span>손패 {player.handCount}</span><span>승리 {player.wonTricks}회</span></div>
              {player.characterId && <span className={`fellowship-objective-status is-${objectiveStatus}`}>목표 {objectiveStatusLabel}</span>}
              {(player.goal || player.objective || (player.characterId && objectiveByCharacter.get(player.characterId))) && <p className="fellowship-player-objective">{player.goal || player.objective || objectiveByCharacter.get(player.characterId!)}</p>}
              {player.threatChoice !== undefined && <span className="fellowship-player-detail">위협값 {Array.isArray(player.threatChoice) ? player.threatChoice.join(', ') : player.threatChoice}</span>}
              {!!player.curses?.length && <span className="fellowship-player-detail">저주: {player.curses.map((curse) => CURSE_NAMES[curse] || curse).join(', ')}</span>}
              {!!player.gifts?.length && <span className="fellowship-player-detail">선물: {player.gifts.map((gift) => GIFT_NAMES[gift] || gift).join(', ')}</span>}
              {!!player.faceUpHand?.length && <div className="fellowship-public-cards" aria-label={`${player.name}의 공개 카드`}>
                {player.faceUpHand.map((card) => <CardFace key={card.id} card={card} compact />)}
              </div>}
            </article>;
          })}
        </div>

        <div className="fellowship-trick-area">
          <div className="fellowship-trick-heading"><span>현재 트릭</span><small>{state.trick?.length || 0} / {state.players.length}장</small></div>
          {state.trick?.length ? <div className="fellowship-trick-cards">
            {state.trick.map((play, index) => <div key={`${play.seatId || play.playerId}-${index}`} className="fellowship-trick-play">
              <CardFace card={play.card} />
              <span>{state.players.find((player) => player.id === (play.seatId || play.playerId))?.characterName || state.players.find((player) => player.id === (play.seatId || play.playerId))?.name || '플레이어'}{play.trump ? ' · 트럼프' : ''}</span>
            </div>)}
          </div> : <div className="fellowship-empty-trick">첫 카드를 기다리고 있습니다</div>}
        </div>

        {!!(state.eventCard || state.balrogCards?.length) && <div className="fellowship-event-cards" aria-label="공개된 사건 카드">
          {state.eventCard && <div><strong>사건 카드</strong><CardFace card={state.eventCard} compact /></div>}
          {!!state.balrogCards?.length && <div><strong>발로그 카드</strong><span>{state.balrogCards.map((card) => <CardFace key={card.id} card={card} compact />)}</span></div>}
        </div>}

        {!!state.lostCards?.length && <div className="fellowship-lost-area"><strong>분실 카드</strong><div>{state.lostCards.map((card) => <CardFace key={card.id} card={card} compact />)}</div></div>}
        {!!state.history?.length && <div className="fellowship-history" aria-label="직전 트릭 결과">
          <strong>직전 트릭</strong>
          <span>{state.players.find((player) => player.id === state.history![state.history!.length - 1].winnerSeatId)?.characterName || '승자'} 승리</span>
          <div>{state.history[state.history.length - 1].plays.map((play, index) => <CardFace key={`${play.seatId || index}-${index}`} card={play.card} compact />)}</div>
        </div>}
      </section>

      <aside className="fellowship-sidebar">
        {state.phase === 'character_selection' && <section className="fellowship-panel" aria-label="캐릭터 선택">
          <span className="fellowship-small-label">CHOOSE YOUR ROLE</span>
          <h2>캐릭터 선택</h2>
          <p>{canAct ? `${currentName}의 캐릭터를 골라주세요.` : `${currentName}의 선택을 기다리고 있습니다.`}</p>
          <div className="fellowship-character-list">
            {(state.availableCharacters || []).map((character) => <button key={character.id} type="button" className="fellowship-character-choice"
              disabled={!canAct || ownCharacters.has(character.id) || !!character.selectedBy}
              onClick={() => send({ type: 'select_character', characterId: character.id })}>
              <span className="fellowship-character-name">{character.nameKo || character.name}{character.required && <em>필수</em>}</span>
              <span className="fellowship-character-objective">{character.objective}</span>
              {character.setup && <span className="fellowship-character-setup">준비: {Array.isArray(character.setup) ? character.setup.join(' · ') : character.setup}</span>}
            </button>)}
          </div>
        </section>}

        {(state.phase === 'setup' || state.phase === 'event_selection') && <section className="fellowship-panel" aria-label={state.phase === 'event_selection' ? '사건 선택' : '준비 행동'}>
          <span className="fellowship-small-label">BEFORE THE FIRST TRICK</span>
          <h2>{state.phase === 'event_selection' ? '사건 선택' : '준비 행동'}</h2>
          <p>{pending?.prompt || `${currentName}의 준비 행동을 기다리고 있습니다.`}</p>
          {canResolvePending && <>
            {pending?.type === 'choose_event' && <p className="fellowship-action-help">이번 라운드에 적용할 사건을 고르세요.</p>}
            {pending?.type === 'choose_group' && <p className="fellowship-action-help">이번 라운드에 사용할 캐릭터 그룹을 고르세요.</p>}
            {pending?.type === 'choose_solo_exchanger' && <p className="fellowship-action-help">1인 플레이에서는 이번 라운드에 교환 행동을 사용할 캐릭터 한 명을 고릅니다. 선택한 캐릭터의 교환이 여러 번이면 모두 수행하고, 다른 캐릭터의 교환 외 준비 행동도 그대로 진행합니다.</p>}
            {pending?.type === 'exchange_start' && <p className="fellowship-action-help">{currentName}의 카드를 받은 상대가 자신의 손패에서 한 장을 돌려줍니다. 교환 상대는 아래에서 고르세요.</p>}
            {pending?.type === 'exchange_return' && <p className="fellowship-action-help">{currentName}이 받은 카드를 포함해 자신의 손패에서 돌려줄 카드 한 장을 고르세요.</p>}
            {setupNeedsCard && <>
              <label className="fellowship-field">{pending?.type === 'exchange_return' ? '돌려줄 카드' : pending?.type === 'precommit_last_card' ? '마지막 트릭에 낼 카드' : pending?.type === 'preplay_first_card' ? '첫 트릭에 낼 카드' : pending?.type === 'tuck_card' ? '접어둘 카드' : '보낼 카드'}
                <select value={selectedSetupCard} onChange={(event) => setSelectedSetupCard(event.target.value)}>
                  <option value="">카드를 선택하세요</option>
                  {setupCards.map((card) => <option key={card.id} value={card.id}>{cardLabel(card)}</option>)}
                </select>
              </label>
            </>}
            {setupNeedsMultipleCards && targetSeatIds.map((targetSeatId) => {
              const target = state.players.find((player) => player.id === targetSeatId);
              return <label className="fellowship-field" key={targetSeatId}>{target?.characterName || target?.name || '플레이어'}에게 보낼 카드
                <select value={selectedCardsBySeat[targetSeatId] || ''} onChange={(event) => setSelectedCardsBySeat((current) => ({ ...current, [targetSeatId]: event.target.value }))}>
                  <option value="">카드를 선택하세요</option>
                  {setupCards.map((card) => <option key={card.id} value={card.id} disabled={Object.entries(selectedCardsBySeat).some(([otherSeat, cardId]) => otherSeat !== targetSeatId && cardId === card.id)}>{cardLabel(card)}</option>)}
                </select>
              </label>;
            })}
            <div className="fellowship-option-list">
              {setupOptions.map((option) => {
                const target = state.players.find((player) => player.id === option.id);
                const label = target?.characterName ? `${target.characterName} · ${target.name}` : option.label;
                return <button type="button" key={option.id} disabled={setupNeedsCard && !selectedSetupCard} onClick={() => performChoice(option.id)}>{label}</button>;
              })}
              {setupNeedsCard && !setupOptions.length && pending?.type === 'preplay_first_card' && selectedSetupCard === 'rings-1'
                ? <>
                  <button type="button" onClick={() => performChoice('', undefined, false)}>반지 1을 일반 카드로 내기</button>
                  <button type="button" onClick={() => performChoice('', undefined, true)}>반지 1을 트럼프로 내기</button>
                </>
                : setupNeedsCard && !setupOptions.length && <button type="button" disabled={!selectedSetupCard} onClick={() => performChoice('')}>선택한 카드 확정</button>}
              {setupNeedsMultipleCards && <button type="button" disabled={!simultaneousReady} onClick={() => performChoice('')}>카드 전달 확정</button>}
            </div>
          </>}
        </section>}

        {(state.phase === 'round_end' || state.phase === 'chapter_complete') && <section className={`fellowship-panel fellowship-result ${result?.success === false ? 'failure' : 'success'}`} aria-label="라운드 결과">
          <span className="fellowship-small-label">{state.phase === 'chapter_complete' ? 'JOURNEY CONTINUES' : 'ROUND COMPLETE'}</span>
          <h2>{result?.title || (state.phase === 'chapter_complete' ? '챕터 완료!' : result?.success === false ? '라운드 실패' : '라운드 성공')}</h2>
          <p>{result?.message || result?.reason || (state.phase === 'chapter_complete' ? '원정대가 다음 이야기를 향해 나아갑니다.' : '결과를 확인하고 다음 라운드를 준비하세요.')}</p>
          {!!result?.objectives?.length && <ul className="fellowship-result-objectives">{result.objectives.map((objective) => <li key={objective.playerId}>
            <span>{objective.success ? '✓' : '✕'} {objective.characterName || state.players.find((player) => player.id === objective.playerId)?.characterName || '캐릭터'}</span>
            {objective.detail && <small>{objective.detail}</small>}
          </li>)}</ul>}
          {!!result?.failedSeatIds?.length && <p>목표 미달성: {result.failedSeatIds.map((seatId) => state.players.find((player) => player.id === seatId)?.characterName || seatId).join(', ')}</p>}
          {state.phase === 'round_end'
            ? <button type="button" className="fellowship-primary" onClick={() => send({ type: 'next_round' })}>{result?.success === false ? '라운드 다시 시도' : '다음 라운드'}</button>
            : isHost ? <button type="button" className="fellowship-primary" onClick={onReturnToRoom}>다음 챕터 선택</button>
              : <p>방장이 다음 챕터를 선택할 때까지 기다려주세요.</p>}
        </section>}

        {state.phase === 'play' && pending?.type === 'gift_save' && <section className="fellowship-panel fellowship-gift-choice" aria-label="선물 카드 사용">
          <span className="fellowship-small-label">GIFT CARD</span>
          <h2>미스릴 셔츠</h2>
          <p>{pending.prompt}</p>
          {canResolvePending ? <div className="fellowship-option-list">
            <button type="button" onClick={() => send({ type: 'use_gift', giftId: 'mithril_shirt', accept: true })}>사용하여 목표 구하기</button>
            <button type="button" onClick={() => send({ type: 'use_gift', giftId: 'mithril_shirt', accept: false })}>사용하지 않음</button>
          </div> : <p>선물 카드 보유자의 결정을 기다리고 있습니다.</p>}
        </section>}

        {state.phase === 'play' && (canPassLead || tuckedCards.length > 0) && <section className="fellowship-panel" aria-label="캐릭터 특수 행동">
          <span className="fellowship-small-label">CHARACTER ABILITY</span>
          <h2>특수 행동</h2>
          {canPassLead && <>
            <p>빌보 배긴스는 카드 대신 다른 캐릭터에게 트릭의 선을 넘길 수 있습니다.</p>
            <div className="fellowship-option-list">{state.players.filter((player) => player.id !== currentSeat?.id && player.handCount > 0).map((player) =>
              <button type="button" key={player.id} onClick={() => send({ type: 'pass_lead', targetSeatId: player.id })}>{player.characterName || player.name}에게 선 넘기기</button>
            )}</div>
          </>}
          {!!tuckedCards.length && !state.trick?.length && <>
            <p>보관한 카드는 트릭이 시작되기 전에 손으로 되돌릴 수 있습니다.</p>
            {tuckedCards.map(([seatId, card]) => <div className="fellowship-tucked-card" key={seatId}>
              <CardFace card={card!} compact />
              <button type="button" onClick={() => send({ type: 'untuck' })}>{state.players.find((player) => player.id === seatId)?.characterName || '캐릭터'}의 카드 꺼내기</button>
            </div>)}
          </>}
        </section>}

        {state.phase === 'play' && <section className="fellowship-panel fellowship-rule-note">
          <span className="fellowship-small-label">TRICK-TAKING</span><h2>진행 안내</h2>
          <p>앞선 카드와 같은 문양이 손에 있다면 그 문양을 내야 합니다. 반지 문양은 활성화되거나 반지 카드만 남았을 때 선도할 수 있습니다.</p>
          <p>반지 1을 낼 때 트럼프 사용 여부를 선택합니다.</p>
        </section>}
      </aside>
    </div>

    {(state.phase === 'play' || state.phase === 'setup' || state.phase === 'character_selection' || state.phase === 'event_selection') && <section className="fellowship-hand-section" aria-label="볼 수 있는 카드">
      <div className="fellowship-section-heading">
        <div><span className="fellowship-small-label">VISIBLE CARDS</span><h2>내 손패와 공개 카드</h2></div>
        <span className="fellowship-hand-count">{totalCards}장</span>
      </div>
      {visibleHands.length ? visibleHands.map(([seatId, cards]) => {
        const owner = state.players.find((player) => player.id === seatId);
        return <div key={seatId} className="fellowship-hand-group">
          <h3>{owner?.characterName || owner?.name || '카드'} · {owner?.id === '__pyramid__' ? '공개 피라미드' : (owner?.controllerId || owner?.id) === playerId ? '내 손패' : '공개 손패'}</h3>
          <div className="fellowship-hand-cards">
            {cards.length ? cards.map((card) => <button type="button" key={card.id} className="fellowship-hand-card"
              disabled={state.phase !== 'play' || seatId !== state.currentTurn || !canAct || !legalCards.has(card.id)}
              onClick={() => playCard(card)} title={cardLabel(card)}>
              <CardFace card={card} />
            </button>) : <span className="fellowship-empty-hand">카드가 없습니다</span>}
          </div>
        </div>;
      }) : <p className="fellowship-empty-hand">현재 공개할 수 있는 손패가 없습니다.</p>}
    </section>}

    {ringChoiceCard && <div className="fellowship-modal-backdrop" role="presentation">
      <div className="fellowship-modal" role="dialog" aria-modal="true" aria-labelledby="fellowship-trump-title">
        <div className="fellowship-modal-card"><CardFace card={ringChoiceCard} /></div>
        <h2 id="fellowship-trump-title">반지 1을 어떻게 낼까요?</h2>
        <p>트럼프로 내면 이번 트릭에서 다른 문양 카드보다 우선합니다.</p>
        <div className="fellowship-modal-actions">
          <button type="button" onClick={() => { send({ type: 'play_card', cardId: ringChoiceCard.id, trump: false }); setRingChoiceCard(null); }}>일반 카드로 내기</button>
          <button type="button" className="fellowship-primary" onClick={() => { send({ type: 'play_card', cardId: ringChoiceCard.id, trump: true }); setRingChoiceCard(null); }}>트럼프로 내기</button>
        </div>
        <button type="button" className="fellowship-modal-cancel" onClick={() => setRingChoiceCard(null)}>취소</button>
      </div>
    </div>}
  </main>;
};

export default FellowshipGame;
