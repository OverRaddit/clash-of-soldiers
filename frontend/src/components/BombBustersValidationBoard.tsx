import React from 'react';

interface Props {
  blueMax: number;
  cutCounts: Record<string, number>;
  yellowMarkers: number[];
  redMarkers: number[];
  hideCutCounts: boolean;
}

const BombBustersValidationBoard: React.FC<Props> = ({ blueMax, cutCounts, yellowMarkers, redMarkers, hideCutCounts }) => {
  const hasCandidates = yellowMarkers.length > 0 || redMarkers.length > 0;
  // Candidates are public setup information, independent of anyone's actual wires.
  const maxValue = Math.max(blueMax, ...yellowMarkers.map(Math.ceil), ...redMarkers.map(Math.ceil));
  const columns = { gridTemplateColumns: `repeat(${maxValue}, minmax(0, 1fr))` };

  return <section className="bb-public-board" aria-label="공개 전선 정보">
    {hideCutCounts && <p className="bb-counts-hidden">이 작전에서는 값별 해체 수가 표시되지 않습니다.</p>}
    {(!hideCutCounts || hasCandidates) && <>
      <div className="bb-counts-heading"><h2>{hideCutCounts ? '전선 후보' : '검증 토큰'}</h2><span>{hasCandidates && '? 후보 위치'}{!hideCutCounts && <>{hasCandidates && ' · '}4개 해체하면 <b>✓ 완료</b></>}</span></div>
      <div className="bb-counts-scroll" role="region" aria-label="검증 보드" tabIndex={0}>
        <div className={`bb-validation-track ${hasCandidates ? 'bb-validation-with-candidates' : ''}`}>
          {hasCandidates && <div className="bb-candidate-rail" style={columns} role="list" aria-label="노랑·빨강 전선 후보">
            {Array.from({ length: maxValue - 1 }, (_, index) => index + 1).map((value) => <div key={value} className="bb-candidate-interval" role="presentation">
              {(['yellow', 'red'] as const).map((color) => {
                // Both candidates share one gap, ordered vertically within the card height.
                const candidate = value + (color === 'yellow' ? 0.1 : 0.5);
                const lower = Math.floor(candidate);
                const present = (color === 'yellow' ? yellowMarkers : redMarkers).includes(candidate);
                const label = `${color === 'yellow' ? '노랑' : '빨강'} 전선 후보 ${candidate} (${lower}~${lower + 1} 사이)`;
                return <div key={color} className={`bb-candidate-slot bb-candidate-slot-${color}`}>
                  {present
                    ? <span className={`bb-candidate-marker bb-candidate-${color}`} data-value={candidate} data-color={color} role="listitem" aria-label={label} title={label}><span aria-hidden="true">?</span></span>
                    : <span className={`bb-candidate-hole bb-candidate-${color}`} aria-hidden="true" />}
                </div>;
              })}
            </div>)}
          </div>}
          <div className="bb-counts" style={columns} role="list" aria-label={hideCutCounts ? '전선 정렬 순서' : '숫자별 해체 현황'}>{Array.from({ length: maxValue }, (_, index) => index + 1).map((value) => {
            const showCount = !hideCutCounts && value <= blueMax;
            const count = showCount ? cutCounts[String(value)] || 0 : 0;
            const complete = count === 4;
            const label = showCount ? `${value}번 전선 ${count}/4 해체${complete ? ', 완료' : ''}` : `${value}번 위치`;
            return <div key={value} role="listitem" className={`bb-count ${!showCount ? 'bb-count-reference' : complete ? 'complete' : count > 0 ? 'started' : ''}`} aria-label={label} title={label}>
              <b aria-hidden="true">{value}</b>
              {showCount && <>
                <span className="bb-count-status" aria-hidden="true">{complete ? <><span className="bb-count-check">✓</span><span className="bb-count-complete-label"> 완료</span></> : `${count}/4`}</span>
                <span className="bb-count-track" aria-hidden="true">{Array.from({ length: 4 }, (_, part) => <i key={part} className={part < count ? 'filled' : ''} />)}</span>
              </>}
            </div>;
          })}</div>
        </div>
      </div>
    </>}
  </section>;
};

export default BombBustersValidationBoard;
