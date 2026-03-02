import React from 'react';
import { KrakenRole, KrakenCardType } from '../../types/kraken.types';

interface MyCardsAreaProps {
  myRole: KrakenRole;
  myKnownCardTypes: KrakenCardType[];
  myCardCount: number;
  isActionHolder: boolean;
}

const getCardTypeLabel = (type: KrakenCardType): string => {
  switch (type) {
    case 'empty': return '빈상자';
    case 'treasure': return '보물';
    case 'kraken': return '크라켄';
    default: return type;
  }
};

const getCardTypeEmoji = (type: KrakenCardType): string => {
  switch (type) {
    case 'empty': return '📦';
    case 'treasure': return '💎';
    case 'kraken': return '🐙';
    default: return '❓';
  }
};

const MyCardsArea: React.FC<MyCardsAreaProps> = ({
  myRole,
  myKnownCardTypes,
  myCardCount,
  isActionHolder,
}) => {
  // Count card types
  const typeCounts: Record<string, number> = {};
  for (const t of myKnownCardTypes) {
    typeCounts[t] = (typeCounts[t] || 0) + 1;
  }

  return (
    <div className="kraken-my-area">
      <div className="my-info-row">
        <div className={`role-badge ${myRole}`}>
          {myRole === 'explorer' ? '⛵ 탐험대' : '🏴‍☠️ 스켈레톤'}
        </div>
        {isActionHolder && (
          <div className="action-holder-badge">🎯 내 차례</div>
        )}
      </div>

      <div className="my-card-composition">
        <span className="composition-label">내 카드 구성: </span>
        {Object.entries(typeCounts).map(([type, count]) => (
          <span key={type} className={`composition-item ${type}`}>
            {getCardTypeEmoji(type as KrakenCardType)}{getCardTypeLabel(type as KrakenCardType)} {count}
          </span>
        ))}
      </div>

      <div className="my-cards-display">
        {Array.from({ length: myCardCount }, (_, idx) => (
          <div key={idx} className="kraken-my-card">
            <span className="card-back-icon">?</span>
          </div>
        ))}
        {myCardCount === 0 && (
          <span className="no-cards-text">남은 카드 없음</span>
        )}
      </div>
    </div>
  );
};

export default MyCardsArea;
