import React from 'react';

interface RoundEndOverlayProps {
  newRound: number;
  onClose: () => void;
}

const RoundEndOverlay: React.FC<RoundEndOverlayProps> = ({
  newRound,
  onClose,
}) => {
  return (
    <div className="kraken-overlay" onClick={onClose}>
      <div className="kraken-overlay-content round-end" onClick={(e) => e.stopPropagation()}>
        <div className="overlay-icon">🔄</div>
        <h2>라운드 종료!</h2>
        <p>카드가 회수되어 다시 섞이고 재분배되었습니다.</p>
        <p className="round-info">라운드 {newRound} 시작</p>
        <button className="overlay-btn" onClick={onClose}>
          확인
        </button>
      </div>
    </div>
  );
};

export default RoundEndOverlay;
