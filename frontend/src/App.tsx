import React, { useState, useEffect } from 'react';
import './App.css';
import GameLobby from './components/GameLobby';
import GameRoom from './components/GameRoom';
import { GameRoom as GameRoomType } from './types/game.types';
import socketService from './services/socket.service';

function App() {
  const [playerId] = useState(
    () => `player_${Math.random().toString(36).substring(2, 8)}`
  );
  const [playerName, setPlayerName] = useState('');
  const [currentRoom, setCurrentRoom] = useState<GameRoomType | null>(null);
  const [isNameSet, setIsNameSet] = useState(false);

  // 플레이어 이름 설정
  const handleSetName = () => {
    if (playerName.trim()) {
      setIsNameSet(true);
      // Socket 연결
      socketService.connect();
    }
  };

  // 방 입장
  const handleJoinRoom = (room: GameRoomType) => {
    setCurrentRoom(room);
  };

  // 방 나가기
  const handleLeaveRoom = () => {
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

  // 플레이어 이름 입력 화면
  if (!isNameSet) {
    return (
      <div className="main-screen">
        <div className="main-screen-container">
          <h1>토이배틀</h1>
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
