import React, { useState, useEffect, useRef, useCallback } from 'react';
import { KrakenCardType } from '../../types/kraken.types';

interface CardRevealAnimationProps {
  cardType: KrakenCardType;
  onComplete: () => void;
}

const getCardLabel = (type: KrakenCardType): string => {
  switch (type) {
    case 'treasure': return '보물 상자!';
    case 'kraken': return '크라켄!';
    case 'empty': return '빈 상자';
    default: return type;
  }
};

const SFX_MAP: Partial<Record<KrakenCardType, string>> = {
  empty: '/kraken/sfx/empty-open.mp3',
  treasure: '/kraken/sfx/treasure-open.wav',
};

const CardRevealAnimation: React.FC<CardRevealAnimationProps> = ({
  cardType,
  onComplete,
}) => {
  const [isFlipped, setIsFlipped] = useState(false);
  const completedRef = useRef(false);

  const handleComplete = useCallback(() => {
    if (completedRef.current) return;
    completedRef.current = true;
    onComplete();
  }, [onComplete]);

  useEffect(() => {
    const flipTimer = setTimeout(() => setIsFlipped(true), 300);

    // Play SFX after flip (300ms flip start + 300ms for mid-flip)
    const sfxTimer = setTimeout(() => {
      const sfxSrc = SFX_MAP[cardType];
      if (sfxSrc) {
        new Audio(sfxSrc).play().catch(() => {});
      }
    }, 600);

    const completeTimer = setTimeout(handleComplete, 2500);

    return () => {
      clearTimeout(flipTimer);
      clearTimeout(sfxTimer);
      clearTimeout(completeTimer);
    };
  }, [cardType, handleComplete]);

  return (
    <div className="card-reveal-overlay" onClick={handleComplete}>
      <div className={`card-reveal-container ${isFlipped ? 'flipped' : ''}`}>
        <div className="card-reveal-inner">
          <div className="card-reveal-front">
            <img src="/kraken/card-back.png" alt="" className="card-reveal-img" />
          </div>
          <div className={`card-reveal-back ${cardType}`}>
            <img src={`/kraken/card-${cardType}.png`} alt="" className="card-reveal-img" />
            <span className="card-reveal-label">{getCardLabel(cardType)}</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CardRevealAnimation;
