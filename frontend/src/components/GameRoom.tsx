import React, { useState, useEffect } from 'react';
import { GameRoom as GameRoomType, GameState } from '../types/game.types';
import socketService from '../services/socket.service';
import './GameRoom.css';
import ToyBattleMap from './ToyBattleMap';

interface GameRoomProps {
  room: GameRoomType;
  playerId: string;
  onLeaveRoom: () => void;
}

const MEDALS_TO_WIN = 7; // 승리에 필요한 메달 수

const GameRoom: React.FC<GameRoomProps> = ({
  room: initialRoom,
  playerId,
  onLeaveRoom,
}) => {
  const [room, setRoom] = useState<GameRoomType>(initialRoom);
  const [gameState, setGameState] = useState<GameState | null>(null);
  const [message, setMessage] = useState<string>('');
  const [messageType, setMessageType] = useState<'success' | 'error' | 'info'>('info');
  const [selectedSoldierIndex, setSelectedSoldierIndex] = useState<
    number | null
  >(null);
  const [selectedSoldierForInfo, setSelectedSoldierForInfo] = useState<
    number | null
  >(null);
  const [gameEnded, setGameEnded] = useState<boolean>(false);
  const [gameWinner, setGameWinner] = useState<string | null>(null);

  const currentPlayer = room.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const isReady = currentPlayer?.isReady || false;

  // 방 나가기
  const handleLeaveRoom = () => {
    socketService.leaveRoom(room.id, playerId);
    onLeaveRoom();
  };

  // 준비 상태 토글
  const handleToggleReady = () => {
    if (!isHost) {
      socketService.toggleReady(room.id, playerId);
    }
  };

  // 게임 시작
  const handleStartGame = () => {
    if (isHost) {
      socketService.startGame(room.id, playerId);
    }
  };

  // 병정 뽑기
  const handleDrawSoldiers = () => {
    if (gameState?.currentTurn === playerId) {
      socketService.drawSoldiers(room.id, playerId);
    }
  };

  // 병정 배치
  const handlePlaceSoldier = (targetVertex: string) => {
    if (gameState?.currentTurn === playerId && selectedSoldierIndex !== null) {
      socketService.placeSoldier(
        room.id,
        playerId,
        selectedSoldierIndex,
        targetVertex
      );
      setSelectedSoldierIndex(null);
    }
  };

  // 병정 이름 가져오기
  const getSoldierName = (type: number): string => {
    const names: Record<number, string> = {
      0: '거점',
      1: '해골이',
      2: '캡틴',
      3: '거인병',
      4: '코코 선장',
      5: 'XB-42',
      6: '레인보우',
      7: '렉시',
      8: '꽉스',
    };
    return names[type] || `병정 ${type}`;
  };

  // 병정 효과 설명 가져오기
  const getSoldierEffect = (type: number): string => {
    const effects: Record<number, string> = {
      0: '거점 병정입니다. 특별한 효과는 없습니다.',
      1: '즉시 병정 2개를 공급처에서 뽑아 받침대에 놓습니다. 단, 받침대의 병정 수가 8개를 초과할 수 없습니다.',
      2: '병정을 한 개 더 배치할 수 있는 기회를 줍니다. 추가로 배치한 병정의 효과도 즉시 발동됩니다.',
      3: '배치 시, 인접한 칸 중 하나에 있는 상대 병정을 제거할 수 있습니다 (맨 위 병정만 가능).',
      4: '본부와 연결되지 않은 거점에도 병정을 배치할 수 있습니다. 단, 상대 본부에는 불가합니다.',
      5: '배치 시, 상대 받침대에서 무작위 병정 1개를 제거(버림 더미로 이동)합니다.',
      6: '병정 1개를 공급처에서 뽑아 받침대에 추가합니다. 받침대 최대 수(8개)를 초과할 수 없습니다.',
      7: '효과는 없지만 힘이 매우 강력합니다. 배치 우위에 유리합니다.',
      8: '조커병정으로, 배치 우위를 무시합니다. 번호(힘)에 상관없이 배치할 수 있지만 다른 병정들도 꽉스위에 배치할 수 있습니다.',
    };
    return effects[type] || `병정 ${type}번의 효과입니다.`;
  };

  // 정점 소유자 확인
  const getVertexOwner = (vertexId: string): string | null => {
    if (!gameState) return null;

    const vertexData = gameState.vertices.find(([id]) => id === vertexId);
    if (!vertexData) return null;

    const vertex = vertexData[1];
    if (vertex.soldiers.length === 0) return null;

    return vertex.soldiers[vertex.soldiers.length - 1].playerId;
  };

  // 거인병 대상 선택
  const handleGiantTargetSelection = (selectedVertex: string) => {
    if (gameState?.pendingAction?.type === 'select_giant_target') {
      socketService.selectGiantTarget(room.id, playerId, selectedVertex);
    }
  };

  // 정점 클릭 핸들러
  const handleVertexClick = (vertexId: string) => {
    if (room.status === 'playing') {
      // 거인병 선택 모드인지 확인
      if (gameState?.pendingAction?.type === 'select_giant_target' && 
          gameState.pendingAction.playerId === playerId) {
        handleGiantTargetSelection(vertexId);
      } else if (selectedSoldierIndex !== null) {
        // 일반 배치 또는 캡틴 추가 배치
        handlePlaceSoldier(vertexId);
      }
    }
  };

  useEffect(() => {
    // Socket 이벤트 리스너 등록
    const handleRoomUpdated = (data: any) => {
      setRoom(data.room);
      if (data.message) {
        setMessage(data.message);
        setMessageType('info');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleGameStarted = (data: any) => {
      setRoom(data.room);
      setGameState(data.gameState);
      setMessage(data.message);
      setMessageType('success');
      setTimeout(() => setMessage(''), 3000);
    };

    const handleGameUpdated = (data: any) => {
      console.log('GameRoom: game_updated 이벤트 수신:', data);
      setGameState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType('success');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleGameEnded = (data: any) => {
      setGameState(data.gameState);
      setGameEnded(true);
      setGameWinner(data.winner);
      setMessage(data.message);
      setMessageType('info');
      // 5초 후 게임 종료 오버레이 자동 제거
      setTimeout(() => {
        setGameEnded(false);
        setGameWinner(null);
      }, 5000);
    };

    const handlePlaceSoldierError = (data: any) => {
      console.log('GameRoom: place_soldier_error 이벤트 수신:', data);
      if (data.message) {
        setMessage(data.message);
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleDrawSoldiersError = (data: any) => {
      console.log('GameRoom: draw_soldiers_error 이벤트 수신:', data);
      if (data.message) {
        setMessage(data.message);
        setMessageType('error');
        setTimeout(() => setMessage(''), 3000);
      }
    };

    const handleGiantSelectionRequired = (data: any) => {
      console.log('GameRoom: giant_selection_required 이벤트 수신:', data);
      setGameState(data.gameState);
      if (data.message) {
        setMessage(data.message);
        setMessageType('info');
        setTimeout(() => setMessage(''), 5000);
      }
    };

    const handleSelectGiantTargetError = (data: any) => {
      console.log('GameRoom: select_giant_target_error 이벤트 수신:', data);
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

    return () => {
      // 특정 이벤트 리스너만 제거
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
      }
    };
  }, []);

  // 게임 진행 중일 때
  if (room.status === 'playing' && gameState) {
    const currentGamePlayer = gameState.players.find(
      ([id]) => id === playerId
    )?.[1];
    const isMyTurn = gameState.currentTurn === playerId;
    const isGiantSelectionMode = gameState.pendingAction?.type === 'select_giant_target' && 
                                 gameState.pendingAction.playerId === playerId;
    const isCaptainAdditionalMode = gameState.pendingAction?.type === 'place_additional_soldier' &&
                                    gameState.pendingAction.playerId === playerId;
    // 캡틴 추가 배치 모드에서도 일반 배치처럼 작동
    const canPlaceSoldier = isMyTurn || isCaptainAdditionalMode;

    return (
      <div className="game-room">
        <div className="game-room-header">
          <h2>토이배틀 - {room.name}</h2>
          <button onClick={handleLeaveRoom} className="leave-room-btn">
            방 나가기
          </button>
        </div>

        {message && (
          <div className={`game-message ${messageType}`}>
            {message}
          </div>
        )}

        <div className="mobile-game-layout">
          {/* 상단: 상대방 정보 및 승점 지역 */}
          <div className="top-info-panel">
            <div className="opponent-info">
              {gameState.players
                .filter(([id]) => id !== playerId)
                .map(([id, player]) => (
                  <div key={id} className="opponent-summary">
                    <div className="opponent-name" style={{ 
                      color: player.color === 'red' ? '#c92a2a' : '#1864ab' 
                    }}>
                      {player.name}
                    </div>
                    <div className="opponent-stats">
                      🏅{player.medals} | 받침대:{player.stand.length} | 덱:{player.deck.length}
                    </div>
                  </div>
                ))}
            </div>
            
            <div className="medal-zones-compact">
              {gameState.medalZones.map((zone, index) => (
                <div
                  key={index}
                  className={`medal-zone-item ${zone.claimed ? 'claimed' : ''}`}
                >
                  {zone.points}점
                  {zone.claimed && <span className="claimed-indicator">✓</span>}
                </div>
              ))}
            </div>
          </div>

          {/* 중앙: 게임 보드 */}
          <div className="game-board-panel">
            <ToyBattleMap
              gameState={gameState}
              selectedSoldierIndex={selectedSoldierIndex}
              onVertexClick={handleVertexClick}
              getSoldierName={getSoldierName}
              getVertexOwner={getVertexOwner}
              isMyTurn={canPlaceSoldier}
              isGiantSelectionMode={isGiantSelectionMode}
              availableTargets={gameState.pendingAction?.availableTargets || []}
            />
          </div>

          {/* 하단: 내 정보 및 받침대 */}
          <div className="bottom-player-panel">
            <div className="player-info-mobile">
              <div className="player-name-mobile">
                {canPlaceSoldier && <span className="turn-flag">🚩</span>}
                <span 
                  style={{ color: currentGamePlayer?.color === 'red' ? '#c92a2a' : '#1864ab' }}
                >
                  {currentGamePlayer?.name}
                </span>
                <span className="medals-mobile">🏅 {currentGamePlayer?.medals}/{MEDALS_TO_WIN}</span>
              </div>
              
              <div className="deck-info-mobile">
                덱: {currentGamePlayer?.deck.length}장
              </div>
              
              {isMyTurn && !isCaptainAdditionalMode && (
                <button onClick={handleDrawSoldiers} className="draw-btn-mobile">
                  병정 뽑기
                </button>
              )}
            </div>

            <div className="player-hand-mobile">
              {Array.from({ length: 8 }, (_, index) => {
                const soldier = currentGamePlayer?.stand[index];
                const isEmpty = !soldier;
                
                return (
                  <div
                    key={index}
                    onClick={() => {
                      if (!isEmpty) {
                        if (canPlaceSoldier) {
                          setSelectedSoldierIndex(index);
                        }
                        setSelectedSoldierForInfo(index);
                      }
                    }}
                    className={`soldier-card-mobile ${
                      isEmpty ? 'empty-slot' : 
                      selectedSoldierIndex === index ? 'selected' : ''
                    } ${!canPlaceSoldier || isEmpty ? 'disabled' : ''}`}
                  >
                    {isEmpty ? (
                      <div className="empty-slot-content">
                        <div className="empty-slot-icon">□</div>
                      </div>
                    ) : (
                      <div style={{ position: 'relative', width: '100%', height: '100%' }}>
                        <img 
                          src={`/soldiers/${soldier.type}.png`} 
                          alt={getSoldierName(soldier.type)}
                          style={{
                            width: '100%',
                            height: '100%',
                            objectFit: 'cover',
                            borderRadius: '4px'
                          }}
                        />
                        <div style={{
                          position: 'absolute',
                          top: '-3px',
                          left: '-3px',
                          width: '24px',
                          height: '18px',
                          backgroundColor: '#2f3542',
                          color: '#fff',
                          borderRadius: '9px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          border: '1px solid #fff',
                          boxShadow: '0 1px 2px rgba(0,0,0,0.3)'
                        }}>
                          {soldier.type === 8 ? '🃏' : `⚔️${soldier.type}`}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 병정 효과 설명 섹션 */}
            <div className="soldier-info-panel">
              {selectedSoldierForInfo !== null && currentGamePlayer?.stand[selectedSoldierForInfo] ? (
                <div className="soldier-description">
                  <div className="soldier-title">
                    <span className="soldier-icon">
                      {currentGamePlayer.stand[selectedSoldierForInfo].type === 8 ? '🃏' : `⚔️${currentGamePlayer.stand[selectedSoldierForInfo].type}`}
                    </span>
                    <span className="soldier-name">
                      {getSoldierName(currentGamePlayer.stand[selectedSoldierForInfo].type)}
                    </span>
                  </div>
                  <div className="soldier-effect">
                    {getSoldierEffect(currentGamePlayer.stand[selectedSoldierForInfo].type)}
                  </div>
                </div>
              ) : (
                <div className="soldier-placeholder">
                  카드를 클릭하면 병정의 효과를 확인할 수 있습니다.
                </div>
              )}
            </div>
          </div>
        </div>
        
        {/* 게임 종료 오버레이 */}
        {gameEnded && (
          <div className="game-end-overlay">
            <div className="confetti-container">
              {/* 폭죽 효과 */}
              {Array.from({ length: 20 }, (_, i) => (
                <div key={i} className={`confetti confetti-${i % 5}`}></div>
              ))}
            </div>
            <div className="game-end-content">
              <div className="game-end-icon">
                {gameWinner === playerId ? '🏆' : '😢'}
              </div>
              <h1 className="game-end-title">
                {gameWinner === playerId ? '승리!' : '패배'}
              </h1>
              <p className="game-end-message">
                {gameWinner === playerId 
                  ? '축하합니다! 게임에서 승리했습니다!' 
                  : '아쉽게도 게임에서 패배했습니다.'}
              </p>
              <div className="game-end-winner">
                승자: {gameState?.players.find(([id]) => id === gameWinner)?.[1]?.name}
              </div>
              <button 
                className="game-end-close-btn"
                onClick={() => {
                  setGameEnded(false);
                  setGameWinner(null);
                }}
              >
                확인
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  // 대기실
  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <h2>방: {room.name}</h2>
        <button
          onClick={handleLeaveRoom}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
          }}
        >
          방 나가기
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '10px',
            backgroundColor: messageType === 'error' ? '#f8d7da' : messageType === 'success' ? '#d4edda' : '#d1ecf1',
            color: messageType === 'error' ? '#721c24' : messageType === 'success' ? '#155724' : '#0c5460',
            borderRadius: '3px',
            marginBottom: '15px',
          }}
        >
          {message}
        </div>
      )}

      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '5px',
        }}
      >
        <h3>
          플레이어 목록 ({room.players.length}/{room.maxPlayers})
        </h3>
        {room.players.map((player) => (
          <div
            key={player.id}
            style={{
              padding: '10px',
              margin: '5px 0',
              backgroundColor: '#f8f9fa',
              borderRadius: '3px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              <strong>{player.name}</strong>
              {player.isHost && (
                <span style={{ color: '#007bff', marginLeft: '5px' }}>
                  (방장)
                </span>
              )}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                backgroundColor:
                  player.isReady || player.isHost ? '#28a745' : '#ffc107',
                color: 'white',
              }}
            >
              {player.isHost ? '방장' : player.isReady ? '준비됨' : '대기중'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {!isHost && (
          <button
            onClick={handleToggleReady}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: isReady ? '#ffc107' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {isReady ? '준비 취소' : '준비'}
          </button>
        )}

        {isHost && (
          <button
            onClick={handleStartGame}
            disabled={
              room.players.length < 2 ||
              !room.players.every((p) => p.isReady || p.isHost)
            }
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor:
                room.players.length < 2 ||
                !room.players.every((p) => p.isReady || p.isHost)
                  ? '#6c757d'
                  : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor:
                room.players.length < 2 ||
                !room.players.every((p) => p.isReady || p.isHost)
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            게임 시작
          </button>
        )}
      </div>

      {isHost && room.players.length < 2 && (
        <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
          게임을 시작하려면 최소 2명의 플레이어가 필요합니다.
        </p>
      )}

      {isHost &&
        room.players.length >= 2 &&
        !room.players.every((p) => p.isReady || p.isHost) && (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
            모든 플레이어가 준비 상태여야 게임을 시작할 수 있습니다.
          </p>
        )}
    </div>
  );
};

export default GameRoom;
