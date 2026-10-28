import React from 'react';
import Hold from './Hold';

interface RopeBarProps {
  playerName?: string;
  /** 바 오른쪽 끝 슬롯(방 이름, 나가기 버튼 등) */
  right?: React.ReactNode;
  onBrandClick?: () => void;
  compact?: boolean;
}

/** 모든 화면 맨 위의 바. 털색 바탕에 브랜드·플레이어 칩, 아래로 로프가 지나간다. */
const RopeBar: React.FC<RopeBarProps> = ({ playerName, right, onBrandClick, compact = false }) => (
  <header className={`crux-ropebar${compact ? ' crux-ropebar--compact' : ''}`}>
    <div className="crux-ropebar__row crux-ropebar__row--app">
      <a
        className="crux-ropebar__brand"
        href="/"
        onClick={(e) => { if (onBrandClick) { e.preventDefault(); onBrandClick(); } }}
      >
        <Hold color="orange" shape="sloper" size={compact ? 26 : 32} />
        Crux
      </a>
      <span className="crux-ropebar__spacer" />
      {right}
      {playerName && (
        <span className="crux-climber crux-climber--me crux-climber--avatar">
          <img className="crux-mascot crux-mascot--avatar" src="/mascot/dambi-head.png" alt="" />
          {playerName}
        </span>
      )}
    </div>
    <div className="crux-rope" role="presentation" />
  </header>
);

export default RopeBar;
