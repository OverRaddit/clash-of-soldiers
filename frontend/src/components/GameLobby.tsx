import React, { useState, useEffect } from 'react';
import { GameRoom, GameType } from '../types/game.types';
import apiService from '../services/api.service';
import socketService from '../services/socket.service';
import Hold, { HoldColor } from './crux/Hold';
import './GameLobby.css';

interface GameLobbyProps {
  playerId: string;
  playerName: string;
  onJoinRoom: (room: GameRoom) => void;
}

const GAME_TYPE_CONFIG: Record<GameType, { label: string; minPlayers: number; maxPlayers: number; hold: HoldColor; meta: string; description: string }> = {
  'toy-battle': { label: '토이배틀', minPlayers: 2, maxPlayers: 2, hold: 'blue', meta: '2인 · 전략', description: ' — 맵 위에서 병정을 움직여 상대 본진을 점령하는 2인 전략 게임.' },
  'no-touch-kraken': { label: '노터치크라켄', minPlayers: 3, maxPlayers: 8, hold: 'green', meta: '3–8인 · 블러핑', description: ' — 크라켄 카드를 피해 가며 서로를 속이는 카드 게임.' },
  'bomb-busters': { label: '봄버스터즈', minPlayers: 2, maxPlayers: 5, hold: 'orange', meta: '2–5인 · 협력 추리', description: ' — 내 전선과 동료의 단서를 연결해 폭탄을 해체하는 협력 추리 게임.' },
  fellowship: { label: '반지 원정대', minPlayers: 1, maxPlayers: 4, hold: 'purple', meta: '1–4인 · 협력 트릭테이킹', description: ' — 각자 캐릭터의 목표를 함께 달성하며 18개 챕터를 여행하는 협력 트릭테이킹.' },
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
        if (response.sessionToken) {
          sessionStorage.setItem(`game-resume:${response.data.id}:${playerId}`, response.sessionToken);
        }
        const socket = socketService.getSocket();
        if (!socket || !socket.connected) {
          socketService.connect();
        }

        socketService.joinRoom(response.data.id, playerId, playerName);
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

  useEffect(() => {
    const socket = socketService.connect();
    const handleJoined = (data: { room: GameRoom }) => onJoinRoom(data.room);
    const handleJoinError = (data: { message?: string }) => setError(data.message || '방 참여에 실패했습니다.');
    socket.on('join_room_success', handleJoined);
    socket.on('join_room_error', handleJoinError);
    return () => {
      socket.off('join_room_success', handleJoined);
      socket.off('join_room_error', handleJoinError);
    };
  }, [onJoinRoom]);

  const config = GAME_TYPE_CONFIG[selectedGameType];
  const statusBadge = (room: GameRoom) => {
    if (room.players.length >= room.maxPlayers) return <span className="crux-badge crux-badge--red">✕ 마감</span>;
    if (room.status === 'playing') return <span className="crux-badge crux-badge--yellow">▲ 등반 중</span>;
    if (room.status !== 'waiting') return <span className="crux-badge">종료</span>;
    return <span className="crux-badge crux-badge--outline">대기 중</span>;
  };

  return (
    <main className="crux-main crux-lobby">
      <div className="crux-page-head">
        <div className="crux-page-head__text">
          <h1 className="crux-h1">클라이밍장</h1>
          <p className="crux-lead">열린 루트에 클립인하거나, 새 루트를 세팅해 친구를 불러오세요.</p>
        </div>
        <div className="crux-row">
          <span className="crux-badge crux-badge--code">{playerId}</span>
          <span className="crux-badge">클라이머 {playerName}</span>
        </div>
      </div>

      <div className="crux-lobby__columns">
        {/* 새 루트 세팅 */}
        <section className="crux-panel crux-lobby__setup" aria-labelledby="crux-setup-title">
          <div className="crux-page-head__text">
            <h2 id="crux-setup-title" className="crux-h2">새 루트 세팅</h2>
            <p className="crux-help">홀드를 하나 고르면 그 게임의 방이 열려요.</p>
          </div>

          <div className="crux-lobby__games" role="radiogroup" aria-label="게임 선택">
            {(Object.keys(GAME_TYPE_CONFIG) as GameType[]).map((type) => {
              const typeConfig = GAME_TYPE_CONFIG[type];
              const isSelected = selectedGameType === type;
              return (
                <button
                  key={type}
                  type="button"
                  onClick={() => handleGameTypeChange(type)}
                  className="crux-holdcard crux-holdcard--compact"
                  aria-pressed={isSelected}
                >
                  <Hold color={typeConfig.hold} seed={type} size={48} />
                  <span>
                    <h3 className="crux-holdcard__title">{typeConfig.label}</h3>
                    <p className="crux-holdcard__meta">{typeConfig.meta}</p>
                  </span>
                </button>
              );
            })}
          </div>

          <div className="crux-banner crux-banner--info" style={{ fontSize: 13, lineHeight: '18px' }}>
            <Hold color={config.hold} seed={selectedGameType} size={28} style={{ flex: 'none' }} />
            <span><strong>{config.label}</strong>{config.description}</span>
          </div>

          <div className="crux-lobby__form">
            <label className="crux-field" style={{ flex: '2 1 200px' }}>
              <span className="crux-label">루트 이름</span>
              <input
                type="text"
                placeholder="예: 목요일 저녁 해체반"
                value={newRoomName}
                onChange={(e) => setNewRoomName(e.target.value)}
                onKeyPress={(e) => e.key === 'Enter' && createRoom()}
                className="crux-input"
              />
            </label>
            <label className="crux-field" style={{ flex: '1 1 120px' }}>
              <span className="crux-label">최대 인원</span>
              <select
                value={maxPlayers}
                onChange={(e) => setMaxPlayers(Number(e.target.value))}
                className="crux-input"
                disabled={selectedGameType === 'toy-battle'}
              >
                {Array.from(
                  { length: config.maxPlayers - config.minPlayers + 1 },
                  (_, i) => config.minPlayers + i
                ).map((n) => (
                  <option key={n} value={n}>{n}명</option>
                ))}
              </select>
            </label>
          </div>

          {error && <div className="crux-banner crux-banner--error" role="alert">✕ {error}</div>}

          <div className="crux-lobby__actions">
            <span className="crux-help">방을 만들면 바로 벨레이 스테이션으로 이동해요.</span>
            <button onClick={createRoom} disabled={creating} className="crux-btn crux-btn--primary crux-btn--lg">
              {creating ? '세팅 중…' : '루트 세팅'}
            </button>
          </div>
        </section>

        {/* 열린 루트 */}
        <section className="crux-lobby__open" aria-labelledby="crux-open-title">
          <div className="crux-section-head">
            <h2 id="crux-open-title" className="crux-h2">열린 루트 <small>{rooms.length}</small></h2>
            <div className="crux-row">
              <span className="crux-help">5초마다 새로고침</span>
              <button onClick={loadRooms} disabled={loading} className="crux-btn crux-btn--secondary crux-btn--sm">
                {loading ? '불러오는 중…' : '새로고침'}
              </button>
            </div>
          </div>
          <div className="crux-rope crux-rope--thin" role="presentation" />

          <div className="crux-lobby__routes">
            {rooms.map((room) => {
              const roomTypeConfig = GAME_TYPE_CONFIG[room.gameType] || GAME_TYPE_CONFIG['toy-battle'];
              const host = room.players.find((p) => p.isHost);
              const others = room.players.length - 1;
              const full = room.players.length >= room.maxPlayers;
              return (
                <article key={room.id} className="crux-route" style={{ ['--route-color' as string]: `var(--hold-${roomTypeConfig.hold})` }}>
                  <div className="crux-route__head">
                    <h3 className="crux-route__name">{room.name}</h3>
                    <span className={`crux-badge crux-badge--${roomTypeConfig.hold}`}>{roomTypeConfig.label}</span>
                  </div>
                  <div className="crux-route__meta">
                    <span className="crux-badge">{room.players.length}/{room.maxPlayers}인</span>
                    {statusBadge(room)}
                    <span className="crux-badge crux-badge--code">{room.id.slice(0, 12)}</span>
                  </div>
                  <div className="crux-route__foot">
                    <span className={`crux-climber${host ? ' crux-climber--host' : ''}`}>
                      <span className="crux-climber__avatar">{(host?.name || '?').slice(0, 1)}</span>
                      {host?.name || '알 수 없음'}{others > 0 ? ` 외 ${others}명` : ''}
                    </span>
                    <button
                      onClick={() => joinRoom(room.id)}
                      disabled={full || room.status !== 'waiting'}
                      className={`crux-btn crux-btn--sm ${full || room.status !== 'waiting' ? 'crux-btn--secondary' : 'crux-btn--primary'}`}
                    >
                      {full ? '마감' : room.status !== 'waiting' ? '등반 중' : '클립인'}
                    </button>
                  </div>
                </article>
              );
            })}
            {rooms.length === 0 && (
              <div className="crux-empty">
                <img src="/mascot/dambi-peek.png" alt="" />
                <span className="crux-help">빈 벽이에요. 새 루트를 세팅해 보세요.</span>
              </div>
            )}
          </div>
        </section>
      </div>
    </main>
  );
};

export default GameLobby;
