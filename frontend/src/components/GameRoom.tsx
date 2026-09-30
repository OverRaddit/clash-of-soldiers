import React, { useState, useEffect } from 'react';
import { GameRoom as GameRoomType, GameState } from '../types/game.types';
import { KrakenClientState } from '../types/kraken.types';
import { BombBustersClientState } from '../types/bomb-busters.types';
import { FellowshipClientState } from '../types/fellowship.types';
import socketService from '../services/socket.service';
import './GameRoom.css';
import WaitingRoom from './WaitingRoom';
import ToyBattleGame from './ToyBattleGame';
import KrakenGame from './KrakenGame';
import BombBustersGame from './BombBustersGame';
import FellowshipGame from './FellowshipGame';

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
  const [bombState, setBombState] = useState<BombBustersClientState | null>(
    initialRoom.gameType === 'bomb-busters' ? initialRoom.gameState || null : null
  );
  const [fellowshipState, setFellowshipState] = useState<FellowshipClientState | null>(
    initialRoom.gameType === 'fellowship' ? initialRoom.gameState || null : null
  );
  const missionId = room.selectedMissionId ?? 1;
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
      socketService.startGame(room.id, playerId, room.gameType === 'bomb-busters' ? missionId : undefined);
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
      if (!data.room || data.room.id !== initialRoom.id) return;
      setRoom(data.room);
      if (data.type === 'returned_to_room') {
        setBombState(null);
        setFellowshipState(null);
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
      } else if (data.room.gameType === 'bomb-busters') {
        setBombState(data.gameState);
      } else if (data.room.gameType === 'fellowship') {
        setFellowshipState(data.gameState);
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
      if (data.room?.gameType === 'bomb-busters' || initialRoom.gameType === 'bomb-busters') {
        if (data.room) setRoom(data.room);
        setBombState(data.gameState);
      } else if (data.room?.gameType === 'fellowship' || initialRoom.gameType === 'fellowship') {
        if (data.room) setRoom(data.room);
        setFellowshipState(data.gameState);
      } else if (data.room?.gameType === 'no-touch-kraken' || initialRoom.gameType === 'no-touch-kraken') {
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

    const handleBombStateUpdated = (data: any) => {
      if (data.room?.id !== initialRoom.id) return;
      setRoom(data.room);
      setBombState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType('info');
      }
    };

    const handleFellowshipStateUpdated = (data: any) => {
      if (data.room?.id !== initialRoom.id) return;
      setRoom(data.room);
      setFellowshipState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType(data.type === 'error' ? 'error' : 'info');
      }
    };

    const handleSnapshot = (data: any) => {
      if (data.room?.id !== initialRoom.id) return;
      setRoom(data.room);
      const state = data.gameState || data.room.gameState;
      if (data.room.gameType === 'bomb-busters') {
        setBombState(state || null);
        if (!state && data.room.status !== 'waiting') socketService.getRoomState(initialRoom.id);
      } else if (data.room.gameType === 'fellowship') {
        setFellowshipState(state || null);
        if (!state && data.room.status !== 'waiting') socketService.getRoomState(initialRoom.id);
      } else if (data.room.gameType === 'no-touch-kraken') {
        if (state) setKrakenState(state);
      } else if (state) setGameState(state);
    };

    const handleReconnect = () => {
      if (initialRoom.gameType !== 'bomb-busters' && initialRoom.gameType !== 'fellowship') return;
      const player = initialRoom.players.find((p) => p.id === playerId);
      if (player) socketService.joinRoom(initialRoom.id, playerId, player.name);
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
    socketService.onBombBustersStateUpdated(handleBombStateUpdated);
    socketService.onBombBustersError(handleKrakenError);
    socketService.onFellowshipStateUpdated(handleFellowshipStateUpdated);
    socketService.onFellowshipError(handleKrakenError);
    const activeSocket = socketService.getSocket();
    activeSocket?.on('room_state', handleSnapshot);
    activeSocket?.on('join_room_success', handleSnapshot);
    activeSocket?.on('join_room_error', handleKrakenError);
    activeSocket?.on('connect', handleReconnect);
    activeSocket?.on('start_game_error', handleKrakenError);
    activeSocket?.on('get_room_state_error', handleKrakenError);
    activeSocket?.on('return_to_room_error', handleKrakenError);
    if (initialRoom.status !== 'waiting') socketService.getRoomState(initialRoom.id);

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
        socket.off('bomb_busters_state_updated', handleBombStateUpdated);
        socket.off('bomb_busters_error', handleKrakenError);
        socket.off('fellowship_state_updated', handleFellowshipStateUpdated);
        socket.off('fellowship_error', handleKrakenError);
        socket.off('room_state', handleSnapshot);
        socket.off('join_room_success', handleSnapshot);
        socket.off('join_room_error', handleKrakenError);
        socket.off('connect', handleReconnect);
        socket.off('start_game_error', handleKrakenError);
        socket.off('get_room_state_error', handleKrakenError);
        socket.off('return_to_room_error', handleKrakenError);
      }
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        missionId={missionId}
        onMissionChange={id => socketService.selectBombMission(room.id, playerId, id)}
        missions={room.bombMissions}
        onFellowshipChapterChange={chapter => socketService.selectFellowshipChapter(room.id, playerId, chapter)}
      />
    );
  }

  if (room.gameType === 'bomb-busters' && bombState) {
    return <BombBustersGame room={room} playerId={playerId} state={bombState}
      message={message} messageType={messageType} onLeaveRoom={handleLeaveRoom}
      onReturnToRoom={handleReturnToRoom} />;
  }

  if (room.gameType === 'bomb-busters') {
    return <main className="bomb-loading" role="status">
      <h2>봄버스터즈 작전 정보를 불러오는 중</h2>
      <p>{message || '잠시만 기다려주세요.'}</p>
      <button onClick={() => socketService.getRoomState(room.id)}>다시 불러오기</button>
      <button onClick={handleLeaveRoom}>로비로 이동</button>
    </main>;
  }

  if (room.gameType === 'fellowship' && fellowshipState) {
    return <FellowshipGame room={room} playerId={playerId} state={fellowshipState}
      message={message} messageType={messageType} onLeaveRoom={handleLeaveRoom}
      onReturnToRoom={handleReturnToRoom} />;
  }

  if (room.gameType === 'fellowship') {
    return <main className="bomb-loading" role="status">
      <h2>원정대의 여정을 불러오는 중</h2>
      <p>{message || '잠시만 기다려주세요.'}</p>
      <button onClick={() => socketService.getRoomState(room.id)}>다시 불러오기</button>
      <button onClick={handleLeaveRoom}>로비로 이동</button>
    </main>;
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
