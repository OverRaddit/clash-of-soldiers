import React, { useState, useEffect } from 'react';
import { GameRoom as GameRoomType, GameState } from '../types/game.types';
import { KrakenClientState } from '../types/kraken.types';
import socketService from '../services/socket.service';
import './GameRoom.css';
import WaitingRoom from './WaitingRoom';
import ToyBattleGame from './ToyBattleGame';
import KrakenGame from './KrakenGame';

interface GameRoomProps {
  room: GameRoomType;
  playerId: string;
  onLeaveRoom: () => void;
}

const GameRoom: React.FC<GameRoomProps> = ({
  room: initialRoom,
  playerId,
  onLeaveRoom,
}) => {
  const [room, setRoom] = useState<GameRoomType>(initialRoom);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [krakenState, setKrakenState] = useState<KrakenClientState | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [gameWinner, setGameWinner] = useState<string | null>(null);
  const [krakenWinner, setKrakenWinner] = useState<string | null>(null);
  const [krakenWinReason, setKrakenWinReason] = useState<string | null>(null);

  const handleLeaveRoom = () => {
    socketService.leaveRoom(room.id, playerId);
    onLeaveRoom();
  };

  const handleReturnToRoom = () => {
    socketService.returnToRoom(room.id, playerId);
  };

  const handleToggleReady = () => {
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (!currentPlayer?.isHost) {
      socketService.toggleReady(room.id, playerId);
    }
  };

  const handleStartGame = () => {
    const currentPlayer = room.players.find((p) => p.id === playerId);
    if (currentPlayer?.isHost) {
      socketService.startGame(room.id, playerId);
    }
  };

  // Toy Battle handlers
  const handleDrawSoldiers = () => {
    if (gameState?.currentTurn === playerId) {
      socketService.drawSoldiers(room.id, playerId);
    }
  };

  const handlePlaceSoldier = (targetVertex: string, soldierIndex: number) => {
    if (gameState?.currentTurn === playerId ||
        (gameState?.pendingAction?.type === 'place_additional_soldier' && gameState.pendingAction.playerId === playerId)) {
      socketService.placeSoldier(room.id, playerId, soldierIndex, targetVertex);
    }
  };

  const handleGiantTargetSelection = (selectedVertex: string) => {
    if (gameState?.pendingAction?.type === 'select_giant_target') {
      socketService.selectGiantTarget(room.id, playerId, selectedVertex);
    }
  };

  useEffect(() => {
    const handleRoomUpdated = (data: any) => {
      setRoom(data.room);
      if (data.type === 'returned_to_room') {
        setKrakenState(null);
        setGameEnded(false);
        setKrakenWinner(null);
        setKrakenWinReason(null);
        setGameState(null);
        setGameWinner(null);
      }
      if (data.message) {
        setMessage(data.message);
        setMessageType('info');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleGameStarted = (data: any) => {
      setRoom(data.room);
      if (data.room.gameType === 'no-touch-kraken') {
        setKrakenState(data.gameState);
      } else {
        setGameState(data.gameState);
      }
      setMessage(data.message);
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    };

    const handleGameUpdated = (data: any) => {
      setGameState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleGameEnded = (data: any) => {
      if (data.room?.gameType === 'no-touch-kraken' || krakenState) {
        setKrakenState(data.gameState);
        setGameEnded(true);
        setKrakenWinner(data.winner);
        setKrakenWinReason(data.winReason);
      } else {
        setGameState(data.gameState);
        setGameEnded(true);
        setGameWinner(data.winner);
      }
      setMessage(data.message);
      setMessageType('info');
    };

    const handlePlaceSoldierError = (data: any) => {
      if (data.message) {
        setMessage(data.message);
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleDrawSoldiersError = (data: any) => {
      if (data.message) {
        setMessage(data.message);
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleGiantSelectionRequired = (data: any) => {
      setGameState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType('info');
        setTimeout(() => setMessage(''), 5000);
      }
    };

    const handleSelectGiantTargetError = (data: any) => {
      if (data.message) {
        setMessage(data.message);
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    // Kraken-specific listeners
    const handleKrakenStateUpdated = (data: any) => {
      setRoom(data.room);
      setKrakenState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType('info');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleKrakenError = (data: any) => {
      if (data.message) {
        setMessage(data.message);
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    socketService.onRoomUpdated(handleRoomUpdated);
    socketService.onGameStarted(handleGameStarted);
    socketService.onGameUpdated(handleGameUpdated);
    socketService.onGameEnded(handleGameEnded);
    socketService.onPlaceSoldierError(handlePlaceSoldierError);
    socketService.onDrawSoldiersError(handleDrawSoldiersError);
    socketService.onGiantSelectionRequired(handleGiantSelectionRequired);
    socketService.onSelectGiantTargetError(handleSelectGiantTargetError);
    socketService.onKrakenStateUpdated(handleKrakenStateUpdated);
    socketService.onKrakenError(handleKrakenError);

    return () => {
      const socket = socketService.getSocket();
      if (socket) {
        socket.off('room_updated', handleRoomUpdated);
        socket.off('game_started', handleGameStarted);
        socket.off('game_updated', handleGameUpdated);
        socket.off('game_ended', handleGameEnded);
        socket.off('place_soldier_error', handlePlaceSoldierError);
        socket.off('draw_soldiers_error', handleDrawSoldiersError);
        socket.off('giant_selection_required', handleGiantSelectionRequired);
        socket.off('select_giant_target_error', handleSelectGiantTargetError);
        socket.off('kraken_state_updated', handleKrakenStateUpdated);
        socket.off('kraken_error', handleKrakenError);
      }
    };
  }, []);

  // Waiting room
  if (room.status === 'waiting') {
    return (
      <WaitingRoom
        room={room}
        playerId={playerId}
        message={message}
        messageType={messageType}
        onLeaveRoom={handleLeaveRoom}
        onToggleReady={handleToggleReady}
        onStartGame={handleStartGame}
      />
    );
  }

  // Kraken game
  if (room.status === 'playing' && room.gameType === 'no-touch-kraken' && krakenState) {
    return (
      <KrakenGame
        room={room}
        playerId={playerId}
        krakenState={krakenState}
        message={message}
        messageType={messageType}
        gameEnded={gameEnded}
        winner={krakenWinner}
        winReason={krakenWinReason}
        onLeaveRoom={handleLeaveRoom}
        onReturnToRoom={handleReturnToRoom}
        onCloseGameEnd={() => {
          setGameEnded(false);
          setKrakenWinner(null);
          setKrakenWinReason(null);
        }}
      />
    );
  }

  // Toy Battle game
  if (room.status === 'playing' && gameState) {
    return (
      <ToyBattleGame
        room={room}
        playerId={playerId}
        gameState={gameState}
        message={message}
        messageType={messageType}
        gameEnded={gameEnded}
        gameWinner={gameWinner}
        onLeaveRoom={handleLeaveRoom}
        onDrawSoldiers={handleDrawSoldiers}
        onPlaceSoldier={handlePlaceSoldier}
        onGiantTargetSelection={handleGiantTargetSelection}
        onCloseGameEnd={() => {
          setGameEnded(false);
          setGameWinner(null);
        }}
      />
    );
  }

  // Fallback: waiting
  return (
    <WaitingRoom
      room={room}
      playerId={playerId}
      message={message}
      messageType={messageType}
      onLeaveRoom={handleLeaveRoom}
      onToggleReady={handleToggleReady}
      onStartGame={handleStartGame}
    />
  );
};

export default GameRoom;
