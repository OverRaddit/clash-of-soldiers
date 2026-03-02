import React, { useState } from 'react';
import { GameRoom as GameRoomType, GameState } from '../types/game.types';
import ToyBattleMap from './ToyBattleMap';

interface ToyBattleGameProps {
  room: GameRoomType;
  playerId: string;
  gameState: GameState;
  message: string;
  messageType: 'success' | 'error' | 'info';
  gameEnded: boolean;
  gameWinner: string | null;
  onLeaveRoom: () => void;
  onDrawSoldiers: () => void;
  onPlaceSoldier: (targetVertex: string, soldierIndex: number) => void;
  onGiantTargetSelection: (selectedVertex: string) => void;
  onCloseGameEnd: () => void;
}

const MEDALS_TO_WIN = 7;

const ToyBattleGame: React.FC<ToyBattleGameProps> = ({
  room,
  playerId,
  gameState,
  message,
  messageType,
  gameEnded,
  gameWinner,
  onLeaveRoom,
  onDrawSoldiers,
  onPlaceSoldier,
  onGiantTargetSelection,
  onCloseGameEnd,
}) => {
  const [selectedSoldierIndex, setSelectedSoldierIndex] = useState<number | null>(null);
  const [selectedSoldierForInfo, setSelectedSoldierForInfo] = useState<number | null>(null);

  const currentGamePlayer = gameState.players.find(
    ([id]) => id === playerId
  )?.[1];
  const isMyTurn = gameState.currentTurn === playerId;
  const isGiantSelectionMode = gameState.pendingAction?.type === 'select_giant_target' &&
                               gameState.pendingAction.playerId === playerId;
  const isCaptainAdditionalMode = gameState.pendingAction?.type === 'place_additional_soldier' &&
                                  gameState.pendingAction.playerId === playerId;
  const canPlaceSoldier = isMyTurn || isCaptainAdditionalMode;

  const getSoldierName = (type: number): string => {
    const names: Record<number, string> = {
      0: '거점', 1: '해골이', 2: '캡틴', 3: '거인병',
      4: '코코 선장', 5: 'XB-42', 6: '레인보우', 7: '렉시', 8: '꽉스',
    };
    return names[type] || `병정 ${type}`;
  };

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

  const getVertexOwner = (vertexId: string): string | null => {
    const vertexData = gameState.vertices.find(([id]) => id === vertexId);
    if (!vertexData) return null;
    const vertex = vertexData[1];
    if (vertex.soldiers.length === 0) return null;
    return vertex.soldiers[vertex.soldiers.length - 1].playerId;
  };

  const handleVertexClick = (vertexId: string) => {
    if (isGiantSelectionMode) {
      onGiantTargetSelection(vertexId);
    } else if (selectedSoldierIndex !== null) {
      onPlaceSoldier(vertexId, selectedSoldierIndex);
      setSelectedSoldierIndex(null);
    }
  };

  return (
    <div className="game-room">
      <div className="game-room-header">
        <h2>토이배틀 - {room.name}</h2>
        <button onClick={onLeaveRoom} className="leave-room-btn">
          방 나가기
        </button>
      </div>

      {message && (
        <div className={`game-message ${messageType}`}>
          {message}
        </div>
      )}

      <div className="mobile-game-layout">
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
              <button onClick={onDrawSoldiers} className="draw-btn-mobile">
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

      {gameEnded && (
        <div className="game-end-overlay">
          <div className="confetti-container">
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
              onClick={onCloseGameEnd}
            >
              확인
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ToyBattleGame;
