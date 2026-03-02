import React, { useRef, useCallback } from 'react';
import { KrakenOtherPlayer, KrakenGamePhase, KrakenCardType, KrakenRole, CardPing, PingType } from '../../types/kraken.types';

const PING_EMOJI: Record<PingType, string> = {
  treasure: '💎',
  kraken: '🐙',
  avoid: '🚫',
};

const PING_LABEL: Record<PingType, string> = {
  treasure: '보물',
  kraken: '크라켄',
  avoid: '빽',
};

const LONG_PRESS_MS = 500;

interface PlayerCardsAreaProps {
  otherPlayers: KrakenOtherPlayer[];
  actionMarkerHolder: string;
  isMyTurn: boolean;
  gamePhase: KrakenGamePhase;
  selectedCard?: { targetPlayerId: string; cardIndex: number };
  onSelectCard: (targetPlayerId: string, cardIndex: number) => void;
  playerId: string;
  myCardCount: number;
  myRole: KrakenRole;
  myKnownCardTypes: KrakenCardType[];
  playerName: string;
  activePings: CardPing[];
  onPing: (targetPlayerId: string, cardIndex: number, pingType: PingType) => void;
  showPingSelector: { targetPlayerId: string; cardIndex: number } | null;
  onShowPingSelector: (targetPlayerId: string, cardIndex: number) => void;
  getPlayerColor: (playerId: string) => string;
  playerMarks: Record<string, 'explorer' | 'skeleton' | null>;
  onToggleMark: (playerId: string) => void;
}

const getCompositionChips = (types: KrakenCardType[]) => {
  const counts: Record<string, number> = {};
  for (const t of types) {
    counts[t] = (counts[t] || 0) + 1;
  }
  const chips: { type: KrakenCardType; count: number; emoji: string }[] = [];
  if (counts['treasure']) chips.push({ type: 'treasure', count: counts['treasure'], emoji: '💎' });
  if (counts['kraken']) chips.push({ type: 'kraken', count: counts['kraken'], emoji: '🐙' });
  if (counts['empty']) chips.push({ type: 'empty', count: counts['empty'], emoji: '📦' });
  return chips;
};

const PlayerCardsArea: React.FC<PlayerCardsAreaProps> = ({
  otherPlayers,
  actionMarkerHolder,
  isMyTurn,
  gamePhase,
  selectedCard,
  onSelectCard,
  playerId,
  myCardCount,
  myRole,
  myKnownCardTypes,
  playerName,
  activePings,
  onPing,
  showPingSelector,
  onShowPingSelector,
  getPlayerColor,
  playerMarks,
  onToggleMark,
}) => {
  const canSelect = isMyTurn && (gamePhase === 'selecting' || gamePhase === 'discussing');

  // Long press state
  const longPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressFired = useRef(false);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);

  const clearLongPress = useCallback(() => {
    if (longPressTimer.current) {
      clearTimeout(longPressTimer.current);
      longPressTimer.current = null;
    }
  }, []);

  const handleTouchStart = useCallback((e: React.TouchEvent, targetPlayerId: string, cardIndex: number) => {
    longPressFired.current = false;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    longPressTimer.current = setTimeout(() => {
      longPressFired.current = true;
      onShowPingSelector(targetPlayerId, cardIndex);
      // 햅틱 피드백 (지원되는 경우)
      if (navigator.vibrate) navigator.vibrate(30);
    }, LONG_PRESS_MS);
  }, [onShowPingSelector]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = touch.clientY - touchStartPos.current.y;
    // 10px 이상 움직이면 롱프레스 취소
    if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
      clearLongPress();
    }
  }, [clearLongPress]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    touchStartPos.current = null;
  }, [clearLongPress]);

  const handleCardClick = useCallback((e: React.MouseEvent, isSelf: boolean, pid: string, idx: number) => {
    // 롱프레스로 핑 셀렉터를 열었으면 클릭 무시
    if (longPressFired.current) {
      longPressFired.current = false;
      e.preventDefault();
      return;
    }
    if (!isSelf && canSelect) {
      onSelectCard(pid, idx);
    }
  }, [canSelect, onSelectCard]);

  const renderPings = (targetPlayerId: string, cardIndex: number) => {
    const pings = activePings.filter(
      p => p.targetPlayerId === targetPlayerId && p.cardIndex === cardIndex
    );
    if (pings.length === 0) return null;
    return (
      <div className="ping-indicators">
        {pings.map((ping, i) => (
          <div key={i} className="ping-indicator" style={{ borderColor: ping.color, boxShadow: `0 0 6px ${ping.color}44` }}>
            <span className="ping-dot" style={{ backgroundColor: ping.color }} />
            <span className="ping-emoji">{PING_EMOJI[ping.pingType]}</span>
            <span className="ping-name" style={{ color: ping.color }}>{ping.pingerName}</span>
          </div>
        ))}
      </div>
    );
  };

  const renderPingSelector = (targetPlayerId: string, cardIndex: number) => {
    if (!showPingSelector || showPingSelector.targetPlayerId !== targetPlayerId || showPingSelector.cardIndex !== cardIndex) {
      return null;
    }
    return (
      <div className="ping-selector" onClick={e => e.stopPropagation()}>
        <div className="ping-selector-title">핑 보내기</div>
        {(['treasure', 'kraken', 'avoid'] as PingType[]).map(pt => (
          <button key={pt} className={`ping-option ping-option-${pt}`} onClick={() => onPing(targetPlayerId, cardIndex, pt)}>
            <span className="ping-option-emoji">{PING_EMOJI[pt]}</span>
            <span className="ping-option-label">{PING_LABEL[pt]}</span>
          </button>
        ))}
      </div>
    );
  };

  const handleContextMenu = (e: React.MouseEvent, targetPlayerId: string, cardIndex: number) => {
    e.preventDefault();
    e.stopPropagation();
    onShowPingSelector(targetPlayerId, cardIndex);
  };

  const isActionHolder = (pid: string) => pid === actionMarkerHolder;
  const hasPingSelectorOpen = (pid: string, idx: number) =>
    showPingSelector?.targetPlayerId === pid && showPingSelector?.cardIndex === idx;

  const renderPlayerRow = (
    pid: string,
    name: string,
    cardCount: number,
    role: KrakenRole | undefined,
    isSelf: boolean,
    composition?: KrakenCardType[],
  ) => {
    const color = getPlayerColor(pid);
    const isHolder = isActionHolder(pid);

    return (
      <div
        key={pid}
        className={`player-row ${isSelf ? 'player-row--self' : ''} ${isHolder ? 'player-row--active' : ''}`}
        style={{ '--player-color': color } as React.CSSProperties}
      >
        <div className="player-stripe" style={{ backgroundColor: color }} />

        <div className="player-content">
          <div className="player-identity">
            <div className="player-identity-left">
              {isHolder && (
                <span className="action-marker">
                  <span className="action-marker-dot" />
                  차례
                </span>
              )}
              <span className="player-nickname" style={isSelf ? { color } : undefined}>
                {name}
                {isSelf && <span className="player-me-tag">나</span>}
              </span>
              {(isSelf || role) && (
                <span className={`player-role-badge ${isSelf ? myRole : role}`}>
                  {(isSelf ? myRole : role) === 'explorer' ? '⛵ 탐험대' : '🏴‍☠️ 스켈레톤'}
                </span>
              )}
            </div>
            {isSelf && composition && composition.length > 0 && (
              <div className="player-composition">
                {getCompositionChips(composition).map((chip) => (
                  <span key={chip.type} className={`comp-chip comp-chip-${chip.type}`}>
                    {chip.emoji}{chip.count}
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="player-cards-row">
            {Array.from({ length: cardCount }, (_, idx) => {
              const isSelected = !isSelf && selectedCard?.targetPlayerId === pid && selectedCard?.cardIndex === idx;
              const selectorOpen = hasPingSelectorOpen(pid, idx);
              return (
                <div
                  key={idx}
                  className={`card-slot ${isSelected ? 'card-slot--selected' : ''} ${!isSelf && canSelect ? 'card-slot--clickable' : ''} ${isSelf ? 'card-slot--self' : ''} ${selectorOpen ? 'card-slot--selector-open' : ''}`}
                  style={isSelf ? { '--card-accent': color } as React.CSSProperties : undefined}
                  onClick={(e) => handleCardClick(e, isSelf, pid, idx)}
                  onContextMenu={(e) => handleContextMenu(e, pid, idx)}
                  onTouchStart={(e) => handleTouchStart(e, pid, idx)}
                  onTouchMove={handleTouchMove}
                  onTouchEnd={handleTouchEnd}
                >
                  <img src="/kraken/card-back.png" alt="" className="card-slot-img" draggable={false} />
                  {renderPings(pid, idx)}
                  {renderPingSelector(pid, idx)}
                </div>
              );
            })}
            {cardCount === 0 && (
              <span className="no-cards-text">카드 없음</span>
            )}
          </div>
        </div>

        {!isSelf && (
          <button
            className={`player-mark-btn ${playerMarks[pid] || ''}`}
            onClick={(e) => { e.stopPropagation(); onToggleMark(pid); }}
            title="역할 추리 마크"
          >
            {playerMarks[pid] === 'explorer' ? '⛵' : playerMarks[pid] === 'skeleton' ? '💀' : '◯'}
          </button>
        )}
      </div>
    );
  };

  return (
    <div className="kraken-players-area">
      {renderPlayerRow(playerId, playerName, myCardCount, myRole, true, myKnownCardTypes)}
      {otherPlayers.map((player) =>
        renderPlayerRow(player.id, player.name, player.cardCount, player.role, false)
      )}
    </div>
  );
};

export default PlayerCardsArea;
