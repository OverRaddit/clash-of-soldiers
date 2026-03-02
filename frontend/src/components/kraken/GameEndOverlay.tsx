import React from 'react';
import { KrakenPlayerWithRole } from '../../types/kraken.types';

interface GameEndOverlayProps {
  winner: 'explorers' | 'skeletons' | 'all-lose' | null;
  winReason: string | null;
  myRole: string;
  allPlayersWithRoles?: KrakenPlayerWithRole[];
  isHost: boolean;
  onClose: () => void;
  onReturnToRoom: () => void;
}

const GameEndOverlay: React.FC<GameEndOverlayProps> = ({
  winner,
  winReason,
  myRole,
  allPlayersWithRoles,
  isHost,
  onClose,
  onReturnToRoom,
}) => {
  const didIWin =
    winner === 'all-lose'
      ? false
      : (winner === 'explorers' && myRole === 'explorer') ||
        (winner === 'skeletons' && myRole === 'skeleton');

  const winnerLabel =
    winner === 'explorers'
      ? '탐험대 승리!'
      : winner === 'skeletons'
      ? '스켈레톤 승리!'
      : '전원 패배!';

  return (
    <div className="kraken-overlay game-end-bg">
      <div className="confetti-container">
        {didIWin && Array.from({ length: 20 }, (_, i) => (
          <div key={i} className={`confetti confetti-${i % 5}`}></div>
        ))}
      </div>
      <div className="kraken-overlay-content game-end" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-icon">
          {winner === 'all-lose' ? '💀' : didIWin ? '🏆' : '😢'}
        </div>
        <h1 className="game-end-title-kraken">
          {didIWin ? '승리!' : '패배'}
        </h1>
        <h2 className="game-end-winner-team">{winnerLabel}</h2>
        <p className="game-end-reason">{winReason}</p>

        {allPlayersWithRoles && (
          <div className="role-reveal-section">
            <h3>역할 공개</h3>
            <div className="role-reveal-list">
              {allPlayersWithRoles.map((p) => (
                <div key={p.id} className={`role-reveal-item ${p.role}`}>
                  <span className="role-reveal-name">{p.name}</span>
                  <span className={`role-badge ${p.role}`}>
                    {p.role === 'explorer' ? '⛵ 탐험대' : '🏴‍☠️ 스켈레톤'}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="game-end-actions">
          {isHost ? (
            <button className="overlay-btn primary" onClick={onReturnToRoom}>
              방으로 돌아가기
            </button>
          ) : (
            <p className="waiting-host-text">방장이 다음 게임을 시작할 때까지 기다려주세요</p>
          )}
          <button className="overlay-btn" onClick={onClose}>
            확인
          </button>
        </div>
      </div>
    </div>
  );
};

export default GameEndOverlay;
