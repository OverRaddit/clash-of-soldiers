import React from 'react';
import { RevealedCard, KrakenCardType } from '../../types/kraken.types';

interface RevealedCardsAreaProps {
  revealedCards: RevealedCard[];
  currentRound: number;
}

const getCardEmoji = (type: KrakenCardType): string => {
  switch (type) {
    case 'treasure': return '💎';
    case 'kraken': return '🐙';
    case 'empty': return '📦';
    default: return '❓';
  }
};

const getCardLabel = (type: KrakenCardType): string => {
  switch (type) {
    case 'treasure': return '보물';
    case 'kraken': return '크라켄';
    case 'empty': return '빈상자';
    default: return type;
  }
};

const RevealedCardsArea: React.FC<RevealedCardsAreaProps> = ({
  revealedCards,
  currentRound,
}) => {
  if (revealedCards.length === 0) {
    return (
      <div className="kraken-revealed-area">
        <div className="revealed-header">공개된 카드</div>
        <div className="revealed-empty">아직 공개된 카드가 없습니다.</div>
      </div>
    );
  }

  // Group by round
  const byRound: Record<number, RevealedCard[]> = {};
  for (const card of revealedCards) {
    if (!byRound[card.round]) byRound[card.round] = [];
    byRound[card.round].push(card);
  }

  const rounds = Object.keys(byRound).map(Number).sort((a, b) => a - b);

  return (
    <div className="kraken-revealed-area">
      <div className="revealed-header">
        공개된 카드 ({revealedCards.length}장)
      </div>
      <div className="revealed-rounds-container">
        {rounds.map((round) => (
          <div key={round} className="revealed-round-group">
            <div className="revealed-round-label">라운드 {round}</div>
            <div className="revealed-cards-list">
              {byRound[round].map((card, idx) => (
                <div
                  key={idx}
                  className={`revealed-card-item ${card.cardType}`}
                >
                  <span className="revealed-card-emoji">{getCardEmoji(card.cardType)}</span>
                  <span className="revealed-card-label">{getCardLabel(card.cardType)}</span>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default RevealedCardsArea;
