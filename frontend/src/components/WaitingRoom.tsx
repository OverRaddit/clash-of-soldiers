import React from 'react';
import { GameRoom as GameRoomType } from '../types/game.types';

interface WaitingRoomProps {
  room: GameRoomType;
  playerId: string;
  message: string;
  messageType: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
}

const WaitingRoom: React.FC<WaitingRoomProps> = ({
  room,
  playerId,
  message,
  messageType,
  onLeaveRoom,
  onToggleReady,
  onStartGame,
}) => {
  const currentPlayer = room.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const isReady = currentPlayer?.isReady || false;
  const minPlayers = room.gameType === 'no-touch-kraken' ? 3 : 2;

  const gameTypeLabel = room.gameType === 'no-touch-kraken' ? '노터치크라켄' : '토이배틀';

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
        <div>
          <h2>방: {room.name}</h2>
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: room.gameType === 'no-touch-kraken' ? '#e8f5e9' : '#e3f2fd',
            color: room.gameType === 'no-touch-kraken' ? '#2e7d32' : '#1565c0',
            border: `1px solid ${room.gameType === 'no-touch-kraken' ? '#a5d6a7' : '#90caf9'}`,
          }}>
            {gameTypeLabel}
          </span>
        </div>
        <button
          onClick={onLeaveRoom}
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
            onClick={onToggleReady}
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
            onClick={onStartGame}
            disabled={
              room.players.length < minPlayers ||
              !room.players.every((p) => p.isReady || p.isHost)
            }
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor:
                room.players.length < minPlayers ||
                !room.players.every((p) => p.isReady || p.isHost)
                  ? '#6c757d'
                  : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor:
                room.players.length < minPlayers ||
                !room.players.every((p) => p.isReady || p.isHost)
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            게임 시작
          </button>
        )}
      </div>

      {isHost && room.players.length < minPlayers && (
        <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
          게임을 시작하려면 최소 {minPlayers}명의 플레이어가 필요합니다.
        </p>
      )}

      {isHost &&
        room.players.length >= minPlayers &&
        !room.players.every((p) => p.isReady || p.isHost) && (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
            모든 플레이어가 준비 상태여야 게임을 시작할 수 있습니다.
          </p>
        )}
    </div>
  );
};

export default WaitingRoom;
