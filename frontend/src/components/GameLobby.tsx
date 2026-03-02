import React, { useState, useEffect } from 'react';
import { GameRoom, GameType } from '../types/game.types';
import apiService from '../services/api.service';
import socketService from '../services/socket.service';
import './GameLobby.css';

interface GameLobbyProps {
  playerId: string;
  playerName: string;
  onJoinRoom: (room: GameRoom) => void;
}

const GAME_TYPE_CONFIG: Record<GameType, { label: string; minPlayers: number; maxPlayers: number; color: string; bgColor: string; borderColor: string }> = {
  'toy-battle': {
    label: '토이배틀',
    minPlayers: 2,
    maxPlayers: 2,
    color: '#1565c0',
    bgColor: '#e3f2fd',
    borderColor: '#90caf9',
  },
  'no-touch-kraken': {
    label: '노터치크라켄',
    minPlayers: 3,
    maxPlayers: 8,
    color: '#2e7d32',
    bgColor: '#e8f5e9',
    borderColor: '#a5d6a7',
  },
};

const GameLobby: React.FC<GameLobbyProps> = ({
  playerId,
  playerName,
  onJoinRoom,
}) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [selectedGameType, setSelectedGameType] = useState<GameType>('toy-battle');
  const [maxPlayers, setMaxPlayers] = useState(2);
  const [error, setError] = useState<string | null>(null);

  // 게임 타입 변경 시 maxPlayers 기본값 업데이트
  const handleGameTypeChange = (gameType: GameType) => {
    setSelectedGameType(gameType);
    const config = GAME_TYPE_CONFIG[gameType];
    setMaxPlayers(gameType === 'toy-battle' ? 2 : config.minPlayers);
  };

  const loadRooms = async () => {
    try {
      setLoading(true);
      const response = await apiService.getRooms();
      if (response.success && response.data) {
        setRooms(response.data);
      }
    } catch (error) {
      setError('방 목록을 불러오는데 실패했습니다.');
      console.error('Failed to load rooms:', error);
    } finally {
      setLoading(false);
    }
  };

  const createRoom = async () => {
    if (!newRoomName.trim()) {
      setError('방 이름을 입력해주세요.');
      return;
    }

    try {
      setCreating(true);
      setError(null);

      const response = await apiService.createRoom(
        newRoomName.trim(),
        playerId,
        maxPlayers,
        selectedGameType
      );
      if (response.success && response.data) {
        const socket = socketService.getSocket();
        if (!socket || !socket.connected) {
          socketService.connect();
        }

        socketService.joinRoom(response.data.id, playerId, playerName);

        socketService.onJoinRoomSuccess((data) => {
          onJoinRoom(data.room);
        });

        socketService.onJoinRoomError((data) => {
          setError(data.message || '방 참여에 실패했습니다.');
        });
      } else {
        setError(response.message || '방 생성에 실패했습니다.');
      }
    } catch (error) {
      setError('방 생성에 실패했습니다.');
      console.error('Failed to create room:', error);
    } finally {
      setCreating(false);
    }
  };

  const joinRoom = async (roomId: string) => {
    try {
      setError(null);

      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        socketService.connect();
      }

      socketService.joinRoom(roomId, playerId, playerName);

      socketService.onJoinRoomSuccess((data) => {
        onJoinRoom(data.room);
      });

      socketService.onJoinRoomError((data) => {
        setError(data.message || '방 참여에 실패했습니다.');
      });
    } catch (error) {
      setError('방 참여에 실패했습니다.');
      console.error('Failed to join room:', error);
    }
  };

  useEffect(() => {
    socketService.connect();
    loadRooms();
    const interval = setInterval(loadRooms, 5000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const config = GAME_TYPE_CONFIG[selectedGameType];

  return (
    <div className="game-lobby">
      <h1>게임 로비</h1>

      <div className="player-info">
        <h3>플레이어 정보</h3>
        <p>
          <strong>ID:</strong> {playerId}
        </p>
        <p>
          <strong>이름:</strong> {playerName}
        </p>
      </div>

      {/* 방 생성 */}
      <div className="create-room-section">
        <h3>새 방 만들기</h3>

        {/* 게임 타입 선택 */}
        <div className="game-type-selector">
          {(Object.keys(GAME_TYPE_CONFIG) as GameType[]).map((type) => {
            const typeConfig = GAME_TYPE_CONFIG[type];
            const isSelected = selectedGameType === type;
            return (
              <button
                key={type}
                onClick={() => handleGameTypeChange(type)}
                className={`game-type-btn ${isSelected ? 'selected' : ''}`}
                style={{
                  backgroundColor: isSelected ? typeConfig.bgColor : '#f8f9fa',
                  color: isSelected ? typeConfig.color : '#666',
                  borderColor: isSelected ? typeConfig.borderColor : '#ddd',
                }}
              >
                {typeConfig.label}
              </button>
            );
          })}
        </div>

        {/* 인원 설정 (크라켄만) */}
        {selectedGameType === 'no-touch-kraken' && (
          <div className="max-players-selector">
            <label>인원 설정: </label>
            <select
              value={maxPlayers}
              onChange={(e) => setMaxPlayers(Number(e.target.value))}
              className="max-players-select"
            >
              {Array.from(
                { length: config.maxPlayers - config.minPlayers + 1 },
                (_, i) => config.minPlayers + i
              ).map((n) => (
                <option key={n} value={n}>
                  {n}명
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="create-room-form">
          <input
            type="text"
            placeholder="방 이름을 입력하세요"
            value={newRoomName}
            onChange={(e) => setNewRoomName(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && createRoom()}
            className="room-name-input"
          />
          <button
            onClick={createRoom}
            disabled={creating}
            className="create-room-btn"
          >
            {creating ? '생성 중...' : '방 만들기'}
          </button>
        </div>
      </div>

      {error && (
        <div className="error-message">
          {error}
        </div>
      )}

      {/* 방 목록 */}
      <div className="room-list-section">
        <div className="room-list-header">
          <h3>방 목록</h3>
          <button
            onClick={loadRooms}
            disabled={loading}
            className="refresh-btn"
          >
            {loading ? '로딩 중...' : '새로고침'}
          </button>
        </div>

        {rooms.length === 0 ? (
          <div className="empty-rooms">
            대기 중인 방이 없습니다.
          </div>
        ) : (
          <div className="rooms-grid">
            {rooms.map((room) => {
              const roomTypeConfig = GAME_TYPE_CONFIG[room.gameType] || GAME_TYPE_CONFIG['toy-battle'];
              return (
                <div key={room.id} className="room-card">
                  <div className="room-info">
                    <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '4px' }}>
                      <h4 style={{ margin: 0 }}>{room.name}</h4>
                      <span
                        className="game-type-badge"
                        style={{
                          backgroundColor: roomTypeConfig.bgColor,
                          color: roomTypeConfig.color,
                          border: `1px solid ${roomTypeConfig.borderColor}`,
                        }}
                      >
                        {roomTypeConfig.label}
                      </span>
                    </div>
                    <p className="room-details">
                      플레이어: {room.players.length}/{room.maxPlayers} | 상태:{' '}
                      {room.status === 'waiting'
                        ? '대기 중'
                        : room.status === 'playing'
                        ? '게임 중'
                        : '종료'}{' '}
                      | 방장:{' '}
                      {room.players.find((p) => p.isHost)?.name || '알 수 없음'}
                    </p>
                  </div>

                  <button
                    onClick={() => joinRoom(room.id)}
                    disabled={
                      room.players.length >= room.maxPlayers ||
                      room.status !== 'waiting'
                    }
                    className="join-room-btn"
                  >
                    {room.players.length >= room.maxPlayers
                      ? '가득참'
                      : room.status !== 'waiting'
                      ? '진행중'
                      : '참여'}
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLobby;
