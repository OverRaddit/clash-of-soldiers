import React, { useState, useEffect, useCallback, useRef } from 'react';
import { GameRoom as GameRoomType } from '../types/game.types';
import { KrakenClientState, KrakenCardType, ChatMessage, CardPing, PingType, PLAYER_COLORS, PlayerClaim } from '../types/kraken.types';
import socketService from '../services/socket.service';
import PlayerCardsArea from './kraken/PlayerCardsArea';
import RevealedCardsArea from './kraken/RevealedCardsArea';
import ChatPanel from './kraken/ChatPanel';
import CardRevealAnimation from './kraken/CardRevealAnimation';
import RoundEndOverlay from './kraken/RoundEndOverlay';
import GameEndOverlay from './kraken/GameEndOverlay';
import './KrakenGame.css';

interface KrakenGameProps {
  room: GameRoomType;
  playerId: string;
  krakenState: KrakenClientState;
  message: string;
  messageType: 'success' | 'error' | 'info';
  gameEnded: boolean;
  winner: string | null;
  winReason: string | null;
  onLeaveRoom: () => void;
  onReturnToRoom: () => void;
  onCloseGameEnd: () => void;
}

const KrakenGame: React.FC<KrakenGameProps> = ({
  room,
  playerId,
  krakenState,
  message,
  messageType,
  gameEnded,
  winner,
  winReason,
  onLeaveRoom,
  onReturnToRoom,
  onCloseGameEnd,
}) => {
  const [revealAnimation, setRevealAnimation] = useState<KrakenCardType | null>(null);
  const [showRoundEnd, setShowRoundEnd] = useState(false);
  const [pendingRoundEnd, setPendingRoundEnd] = useState(false);
  const [pendingGameEnd, setPendingGameEnd] = useState(false);
  const [lastRound, setLastRound] = useState(krakenState.currentRound);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>(krakenState.chatMessages || []);
  const [activePings, setActivePings] = useState<CardPing[]>([]);
  const [showPingSelector, setShowPingSelector] = useState<{ targetPlayerId: string; cardIndex: number } | null>(null);
  const pingTimersRef = useRef<Map<string, NodeJS.Timeout>>(new Map());
  const [playerMarks, setPlayerMarks] = useState<Record<string, 'explorer' | 'skeleton' | null>>({});

  const isMyTurn = krakenState.actionMarkerHolder === playerId;
  const hasSelection = !!krakenState.selectedCard;
  const isHost = room.hostId === playerId;

  // Player color mapping
  const getPlayerColor = useCallback((pid: string): string => {
    const idx = room.players.findIndex(p => p.id === pid);
    return PLAYER_COLORS[idx >= 0 ? idx % PLAYER_COLORS.length : 0];
  }, [room.players]);

  // Step 6: Trigger card reveal animation from lastRevealedCard
  useEffect(() => {
    if (krakenState.lastRevealedCard) {
      setRevealAnimation(krakenState.lastRevealedCard.cardType);
    }
  }, [krakenState.lastRevealedCard]);

  // Step 7: Track round changes - buffer if animation is playing
  useEffect(() => {
    if (krakenState.currentRound > lastRound && krakenState.gamePhase !== 'finished') {
      if (revealAnimation) {
        setPendingRoundEnd(true);
      } else {
        setShowRoundEnd(true);
      }
      setLastRound(krakenState.currentRound);
    }
  }, [krakenState.currentRound, lastRound, krakenState.gamePhase, revealAnimation]);

  // Sync chat messages from state
  useEffect(() => {
    setChatMessages(krakenState.chatMessages || []);
  }, [krakenState.chatMessages]);

  // Listen for individual chat messages
  useEffect(() => {
    const handleChatMessage = (msg: ChatMessage) => {
      setChatMessages((prev) => {
        if (prev.find((m) => m.id === msg.id)) return prev;
        return [...prev, msg];
      });
    };

    socketService.onKrakenChatMessage(handleChatMessage);
    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('kraken_chat_message', handleChatMessage);
      }
    };
  }, []);

  // Step 9: Listen for ping events
  useEffect(() => {
    const handlePing = (ping: CardPing) => {
      setActivePings(prev => [...prev, ping]);
      const key = `${ping.pingerId}-${ping.targetPlayerId}-${ping.cardIndex}-${ping.timestamp}`;
      const timer = setTimeout(() => {
        setActivePings(prev => prev.filter(p =>
          !(p.pingerId === ping.pingerId && p.targetPlayerId === ping.targetPlayerId &&
            p.cardIndex === ping.cardIndex && p.timestamp === ping.timestamp)
        ));
        pingTimersRef.current.delete(key);
      }, 10000);
      pingTimersRef.current.set(key, timer);
    };

    socketService.onKrakenPing(handlePing);
    const timersRef = pingTimersRef.current;
    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('kraken_ping', handlePing);
      }
      timersRef.forEach(timer => clearTimeout(timer));
      timersRef.clear();
    };
  }, []);


  // Close ping selector on document click (defer to avoid immediate close from contextmenu)
  useEffect(() => {
    if (!showPingSelector) return;
    const handleClick = () => setShowPingSelector(null);
    const timer = setTimeout(() => {
      document.addEventListener('click', handleClick);
      document.addEventListener('contextmenu', handleClick);
    }, 0);
    return () => {
      clearTimeout(timer);
      document.removeEventListener('click', handleClick);
      document.removeEventListener('contextmenu', handleClick);
    };
  }, [showPingSelector]);

  const handleSelectCard = useCallback((targetPlayerId: string, cardIndex: number) => {
    if (krakenState.selectedCard) {
      socketService.krakenChangeSelection(room.id, playerId, targetPlayerId, cardIndex);
    } else {
      socketService.krakenSelectCard(room.id, playerId, targetPlayerId, cardIndex);
    }
  }, [room.id, playerId, krakenState.selectedCard]);

  const handleConfirmReveal = useCallback(() => {
    socketService.krakenConfirmReveal(room.id, playerId);
  }, [room.id, playerId]);

  const handleSendChat = useCallback((text: string) => {
    socketService.krakenChat(room.id, playerId, text);
  }, [room.id, playerId]);

  const handlePing = useCallback((targetPlayerId: string, cardIndex: number, pingType: PingType) => {
    const color = getPlayerColor(playerId);
    socketService.krakenPing(room.id, playerId, targetPlayerId, cardIndex, pingType, color);
    setShowPingSelector(null);
  }, [room.id, playerId, getPlayerColor]);

  const handleSetClaim = useCallback((claim: PlayerClaim) => {
    socketService.krakenSetClaim(room.id, playerId, claim);
  }, [room.id, playerId]);

  const handleShowPingSelector = useCallback((targetPlayerId: string, cardIndex: number) => {
    setShowPingSelector({ targetPlayerId, cardIndex });
  }, []);

  const handleToggleMark = useCallback((pid: string) => {
    setPlayerMarks(prev => {
      const current = prev[pid] || null;
      let next: 'explorer' | 'skeleton' | null;
      if (current === null) next = 'explorer';
      else if (current === 'explorer') next = 'skeleton';
      else next = null;
      return { ...prev, [pid]: next };
    });
  }, []);

  // Step 7: Handle animation complete - flush pending overlays
  const handleRevealAnimationComplete = useCallback(() => {
    setRevealAnimation(null);
    if (pendingRoundEnd) {
      setPendingRoundEnd(false);
      setShowRoundEnd(true);
    }
    if (pendingGameEnd) {
      setPendingGameEnd(false);
    }
  }, [pendingRoundEnd, pendingGameEnd]);

  const phaseLabel = (() => {
    switch (krakenState.gamePhase) {
      case 'selecting': return '카드 선택 중';
      case 'discussing': return '토론 중';
      case 'revealing': return '카드 공개 중';
      case 'round-end': return '라운드 종료';
      case 'finished': return '게임 종료';
      default: return '';
    }
  })();

  // Find my name
  const myName = room.players.find(p => p.id === playerId)?.name || playerId;

  return (
    <div className="kraken-game">
      {/* Header */}
      <div className="kraken-header">
        <div className="kraken-header-left">
          <h2 className="kraken-title">노터치크라켄</h2>
          <span className="kraken-room-name">{room.name}</span>
        </div>
        <button onClick={onLeaveRoom} className="leave-room-btn">
          나가기
        </button>
      </div>

      {/* Status Bar */}
      <div className="kraken-status-bar">
        <span className="status-item">라운드 {krakenState.currentRound}/4</span>
        <span className="status-divider">|</span>
        <span className="status-item">액션 {krakenState.actionsThisRound}/{krakenState.totalActionsPerRound}</span>
        <span className="status-divider">|</span>
        <span className="status-item phase">{phaseLabel}</span>
      </div>

      {/* Main Game Area */}
      <div className="kraken-main-layout">
        {/* All Players' Cards (including self) */}
        <PlayerCardsArea
          otherPlayers={krakenState.otherPlayers}
          actionMarkerHolder={krakenState.actionMarkerHolder}
          isMyTurn={isMyTurn}
          gamePhase={krakenState.gamePhase}
          selectedCard={krakenState.selectedCard}
          onSelectCard={handleSelectCard}
          playerId={playerId}
          myCardCount={krakenState.myCardCount}
          myRole={krakenState.myRole}
          myKnownCardTypes={krakenState.myKnownCardTypes}
          playerName={myName}
          activePings={activePings}
          onPing={handlePing}
          showPingSelector={showPingSelector}
          onShowPingSelector={handleShowPingSelector}
          getPlayerColor={getPlayerColor}
          playerMarks={playerMarks}
          onToggleMark={handleToggleMark}
          myClaim={krakenState.myClaim}
          onSetClaim={handleSetClaim}
        />

        {/* Confirm Button */}
        {isMyTurn && krakenState.gamePhase === 'discussing' && hasSelection && (
          <div className="kraken-confirm-section">
            <button
              className="kraken-confirm-btn"
              onClick={handleConfirmReveal}
            >
              확정 (카드 공개)
            </button>
          </div>
        )}

        {/* Revealed Cards */}
        <RevealedCardsArea
          revealedCards={krakenState.revealedCards}
          currentRound={krakenState.currentRound}
        />

        {/* Chat Panel */}
        <ChatPanel
          messages={chatMessages}
          onSendMessage={handleSendChat}
          playerId={playerId}
        />

        {/* Message */}
        {message && (
          <div className={`game-message ${messageType}`}>
            {message}
          </div>
        )}
      </div>

      {/* Card Reveal Animation */}
      {revealAnimation && (
        <CardRevealAnimation
          cardType={revealAnimation}
          onComplete={handleRevealAnimationComplete}
        />
      )}

      {/* Round End Overlay */}
      {showRoundEnd && (
        <RoundEndOverlay
          newRound={krakenState.currentRound}
          onClose={() => setShowRoundEnd(false)}
        />
      )}

      {/* Game End Overlay - delay if animation is playing */}
      {gameEnded && !revealAnimation && (
        <GameEndOverlay
          winner={winner as any}
          winReason={winReason}
          myRole={krakenState.myRole}
          allPlayersWithRoles={krakenState.allPlayersWithRoles}
          isHost={isHost}
          onClose={onCloseGameEnd}
          onReturnToRoom={onReturnToRoom}
        />
      )}
    </div>
  );
};

export default KrakenGame;
