import React, { useState, useEffect } from 'react';
import { GameRoom } from '../types/game.types';
import apiService from '../services/api.service';
import socketService from '../services/socket.service';
import './GameLobby.css';

interface GameLobbyProps {
  playerId: string;
  playerName: string;
  onJoinRoom: (room: GameRoom) => void;
}

const GameLobby: React.FC<GameLobbyProps> = ({
  playerId,
  playerName,
  onJoinRoom,
}) => {
  const [rooms, setRooms] = useState<GameRoom[]>([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [newRoomName, setNewRoomName] = useState('');
  const [error, setError] = useState<string | null>(null);

  // 방 목록 로드
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

  // 방 생성
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
        playerId
      );
      if (response.success && response.data) {
        // 소켓이 연결되어 있는지 확인
        const socket = socketService.getSocket();
        if (!socket || !socket.connected) {
          socketService.connect();
        }

        // Socket으로 방에 입장 (방장도 Socket 연결 필요)
        socketService.joinRoom(response.data.id, playerId, playerName);

        // 성공 응답을 기다림
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

  // 방 참여
  const joinRoom = async (roomId: string) => {
    try {
      setError(null);

      // 소켓이 연결되어 있는지 확인
      const socket = socketService.getSocket();
      if (!socket || !socket.connected) {
        socketService.connect();
      }

      // Socket.IO로 방 참여
      socketService.joinRoom(roomId, playerId, playerName);

      // 성공 응답을 기다림
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
    // 소켓 연결
    socketService.connect();

    loadRooms();

    // 5초마다 방 목록 갱신
    const interval = setInterval(loadRooms, 5000);

    return () => {
      clearInterval(interval);
      // 컴포넌트 언마운트 시 소켓 연결 해제
      // socketService.disconnect();
    };
  }, []);

  return (
    <div className="game-lobby">
      <h1>토이배틀 게임 로비</h1>

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

      {/* 에러 메시지 */}
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
            {rooms.map((room) => (
              <div key={room.id} className="room-card">
                <div className="room-info">
                  <h4>{room.name}</h4>
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
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default GameLobby;
