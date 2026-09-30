import React, { useEffect, useState } from 'react';
import './App.css';
import GameLobby from './components/GameLobby';
import GameRoom from './components/GameRoom';
import { GameRoom as GameRoomType } from './types/game.types';
import socketService from './services/socket.service';

// A separate identity per tab also allows friends to test a room on one device.
const SESSION_PLAYER = 'board-game-player';
const SESSION_NAME = 'board-game-name';
const SESSION_ROOM = 'private-card-game-room';
const LEGACY_BOMB_ROOM = 'bomb-busters-room';

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

  // useEffect(() => {
  //   // 페이지 새로고침/종료 시 정리
  //   const handleBeforeUnload = () => {
  //     if (currentRoom) {
  //       socketService.leaveRoom(currentRoom.id, playerId);
  //     }
  //     socketService.disconnect();
  //   };

  //   window.addEventListener('beforeunload', handleBeforeUnload);

  //   return () => {
  //     window.removeEventListener('beforeunload', handleBeforeUnload);
  //     if (currentRoom) {
  //       socketService.leaveRoom(currentRoom.id, playerId);
  //     }
  //     socketService.disconnect();
  //   };
  // }, [currentRoom, playerId]);

  if (restoring) {
    return <main className="main-screen"><div className="main-screen-container">
      <h1>게임에 다시 연결 중</h1>
      <p>이전 방과 개인 게임 상태를 불러오고 있습니다.</p>
      <button className="start-game-btn" onClick={() => {
        sessionStorage.removeItem(SESSION_ROOM);
        sessionStorage.removeItem(LEGACY_BOMB_ROOM);
        setRestoring(false);
      }}>로비로 이동</button>
    </div></main>;
  }

  // 플레이어 이름 입력 화면
  if (!isNameSet) {
    return (
      <div className="main-screen">
        <div className="main-screen-container">
          <h1>보드게임 플랫폼</h1>
          <p className="main-screen-description">
            게임에 참여하기 위해 플레이어 이름을 입력해주세요.
          </p>
          <div className="name-input-section">
            <input
              type="text"
              placeholder="플레이어 이름"
              value={playerName}
              onChange={(e) => setPlayerName(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSetName()}
              className="name-input"
            />
            <button
              onClick={handleSetName}
              disabled={!playerName.trim()}
              className="start-game-btn"
            >
              게임 시작
            </button>
          </div>
          <p className="player-id-display">
            플레이어 ID: {playerId}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="App">
      {restoreMessage && <p role="status" style={{ margin: 0, padding: '12px 20px', background: '#fff3cd' }}>{restoreMessage}</p>}
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
