import React, { useEffect, useMemo, useState } from 'react';
import './App.css';
import GameLobby from './components/GameLobby';
import GameRoom from './components/GameRoom';
import Hold, { HOLD_SHAPES, HoldColor } from './components/crux/Hold';
import RopeBar from './components/crux/RopeBar';
import { GameRoom as GameRoomType } from './types/game.types';
import socketService from './services/socket.service';

// A separate identity per tab also allows friends to test a room on one device.
const SESSION_PLAYER = 'board-game-player';
const SESSION_NAME = 'board-game-name';
const SESSION_ROOM = 'private-card-game-room';
const LEGACY_BOMB_ROOM = 'bomb-busters-room';

const ENTRY_GAMES: { id: string; label: string; color: HoldColor }[] = [
  { id: 'toy-battle', label: '토이배틀', color: 'blue' },
  { id: 'no-touch-kraken', label: '노터치크라켄', color: 'green' },
  { id: 'bomb-busters', label: '봄버스터즈', color: 'orange' },
  { id: 'fellowship', label: '반지 원정대', color: 'purple' },
];

const WALL_SPOTS: [number, number][] = [[6, 6], [34, 4], [66, 8], [86, 22], [4, 34], [88, 48], [8, 60], [70, 40], [90, 72], [14, 82], [82, 88]];
const WALL_COLORS: HoldColor[] = ['blue', 'green', 'orange', 'purple', 'pink', 'yellow', 'lime', 'red'];

/** 입장 화면의 벽 구간: 열 때마다 홀드 배치가 달라진다. */
function useWallHolds() {
  return useMemo(() => WALL_SPOTS.map(([x, y], i) => ({
    key: i,
    left: `${x}%`,
    top: `${y}%`,
    shape: HOLD_SHAPES[Math.floor(Math.random() * HOLD_SHAPES.length)].id,
    color: WALL_COLORS[(i * 3 + Math.floor(Math.random() * 3)) % WALL_COLORS.length],
    size: 40 + Math.floor(Math.random() * 28),
    rotate: Math.floor(Math.random() * 40) - 20,
  })), []);
}

function App() {
  const [playerId] = useState(() => {
    const id = sessionStorage.getItem(SESSION_PLAYER) || `player_${Math.random().toString(36).substring(2, 10)}`;
    sessionStorage.setItem(SESSION_PLAYER, id);
    return id;
  });
  const [playerName, setPlayerName] = useState(() => sessionStorage.getItem(SESSION_NAME) || '');
  const [currentRoom, setCurrentRoom] = useState<GameRoomType | null>(null);
  const [isNameSet, setIsNameSet] = useState(() => !!sessionStorage.getItem(SESSION_NAME));
  const [restoring, setRestoring] = useState(() => !!(sessionStorage.getItem(SESSION_ROOM) || sessionStorage.getItem(LEGACY_BOMB_ROOM)) && !!sessionStorage.getItem(SESSION_NAME));
  const [restoreMessage, setRestoreMessage] = useState('');
  const wallHolds = useWallHolds();

  useEffect(() => {
    if (!restoring) return;
    const roomId = sessionStorage.getItem(SESSION_ROOM) || sessionStorage.getItem(LEGACY_BOMB_ROOM);
    if (!roomId) { setRestoring(false); return; }
    const socket = socketService.connect();
    const rejoin = () => socketService.joinRoom(roomId, playerId, playerName);
    const joined = (data: { room: GameRoomType }) => {
      setCurrentRoom(data.room);
      setRestoring(false);
    };
    const failed = (data: { message?: string }) => {
      sessionStorage.removeItem(SESSION_ROOM);
      sessionStorage.removeItem(LEGACY_BOMB_ROOM);
      setRestoreMessage(data.message || '이전 방에 다시 연결하지 못했습니다. 새 방에 참여해주세요.');
      setRestoring(false);
    };
    socket.on('join_room_success', joined);
    socket.on('join_room_error', failed);
    socket.on('connect', rejoin);
    if (socket.connected) rejoin();
    return () => {
      socket.off('join_room_success', joined);
      socket.off('join_room_error', failed);
      socket.off('connect', rejoin);
    };
  }, [restoring, playerId, playerName]);

  // 플레이어 이름 설정
  const handleSetName = () => {
    if (playerName.trim()) {
      sessionStorage.setItem(SESSION_NAME, playerName.trim());
      setPlayerName(playerName.trim());
      setIsNameSet(true);
      // Socket 연결
      socketService.connect();
    }
  };

  // 방 입장
  const handleJoinRoom = (room: GameRoomType) => {
    if (room.gameType === 'bomb-busters' || room.gameType === 'fellowship') sessionStorage.setItem(SESSION_ROOM, room.id);
    else sessionStorage.removeItem(SESSION_ROOM);
    sessionStorage.removeItem(LEGACY_BOMB_ROOM);
    setRestoreMessage('');
    setCurrentRoom(room);
  };

  // 방 나가기
  const handleLeaveRoom = () => {
    sessionStorage.removeItem(SESSION_ROOM);
    sessionStorage.removeItem(LEGACY_BOMB_ROOM);
    setCurrentRoom(null);
  };

  if (restoring) {
    return (
      <div className="crux-app crux-wall">
        <RopeBar playerName={playerName} />
        <main className="crux-entry">
          <section className="crux-panel crux-stack" style={{ maxWidth: 480, textAlign: 'center', alignItems: 'center' }} role="status">
            <img src="/mascot/dambi-silhouette-hoodie.png" alt="" style={{ width: 96, height: 'auto' }} />
            <h1 className="crux-h2">로프 다시 거는 중</h1>
            <p className="crux-lead">이전 루트와 개인 게임 상태를 불러오고 있어요.</p>
            <button className="crux-btn crux-btn--secondary" onClick={() => {
              sessionStorage.removeItem(SESSION_ROOM);
              sessionStorage.removeItem(LEGACY_BOMB_ROOM);
              setRestoring(false);
            }}>클라이밍장으로 이동</button>
          </section>
        </main>
      </div>
    );
  }

  // 플레이어 이름 입력 화면
  if (!isNameSet) {
    return (
      <div className="crux-app crux-wall">
        <RopeBar />
        <main className="crux-entry">
          <section className="crux-panel crux-entry__panel">
            <div className="crux-wallpanel crux-entry__wall" aria-hidden="true">
              {wallHolds.map((h) => (
                <Hold key={h.key} color={h.color} shape={h.shape} size={h.size} rotate={h.rotate} style={{ left: h.left, top: h.top }} />
              ))}
              <img className="crux-entry__mascot" src="/mascot/dambi-cutout.png" alt="" />
            </div>
            <div className="crux-entry__copy">
              <div className="crux-stack" style={{ gap: 12 }}>
                <span className="crux-badge crux-badge--outline" style={{ alignSelf: 'flex-start' }}>▲ 오늘도 벽 앞</span>
                <h1 className="crux-entry__title">한 홀드씩,<br />함께.</h1>
                <p className="crux-lead" style={{ maxWidth: 420 }}>친구들과 보드게임을 하는 작은 클라이밍장이에요. 이름을 쓰고 로프를 걸면 바로 루트에 들어갈 수 있어요.</p>
              </div>
              <form className="crux-entry__form" onSubmit={(e) => { e.preventDefault(); handleSetName(); }}>
                <label className="crux-field">
                  <span className="crux-label">클라이머 이름</span>
                  <input
                    type="text"
                    placeholder="이름을 입력하세요"
                    value={playerName}
                    onChange={(e) => setPlayerName(e.target.value)}
                    className="crux-input"
                    autoFocus
                  />
                  <span className="crux-help">같은 기기에서 탭마다 다른 이름을 쓸 수 있어요.</span>
                </label>
                <div className="crux-row" style={{ gap: 12 }}>
                  <button type="submit" disabled={!playerName.trim()} className="crux-btn crux-btn--primary crux-btn--lg">등반 시작</button>
                  <span className="crux-badge crux-badge--code">{playerId}</span>
                </div>
              </form>
              <div className="crux-entry__routes">
                <span className="crux-help" style={{ fontWeight: 500 }}>오늘 세팅된 루트 · {ENTRY_GAMES.length}개 게임</span>
                <div className="crux-entry__games">
                  {ENTRY_GAMES.map((g) => (
                    <span key={g.id} className="crux-entry__game"><Hold color={g.color} seed={g.id} size={40} />{g.label}</span>
                  ))}
                </div>
              </div>
            </div>
          </section>
        </main>
        <footer className="crux-entry__footer"><span>Crux · 친구들과 하는 보드게임 클라이밍장</span></footer>
      </div>
    );
  }

  return (
    <div className="crux-app crux-wall">
      <RopeBar
        playerName={playerName}
        compact={!!currentRoom && currentRoom.status !== 'waiting'}
        onBrandClick={currentRoom ? undefined : () => window.scrollTo({ top: 0 })}
      />
      {restoreMessage && <div className="crux-restore"><p role="status" className="crux-banner crux-banner--warn">▲ {restoreMessage}</p></div>}
      {currentRoom ? (
        <GameRoom
          room={currentRoom}
          playerId={playerId}
          onLeaveRoom={handleLeaveRoom}
        />
      ) : (
        <GameLobby
          playerId={playerId}
          playerName={playerName}
          onJoinRoom={handleJoinRoom}
        />
      )}
    </div>
  );
}

export default App;
