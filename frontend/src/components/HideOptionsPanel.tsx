import React from 'react';
import {
  HIDE_ANIMAL_EMOJI, HIDE_ANIMAL_LABEL, HIDE_DEFAULT_OPTIONS, HIDE_HIDEOUT_COUNT, HIDE_OPTION_LIMITS,
  HideOptions, hideAnimalsInPlay, hideMaxAnimalCount,
} from '../types/hide.types';
import './HideGame.css';

interface HideOptionsPanelProps {
  options?: HideOptions;
  isHost: boolean;
  onChange?: (options: HideOptions) => void;
}

const PRESETS: { label: string; hint: string; options: HideOptions }[] = [
  { label: '기본', hint: '고양이 · 동물 9 · 빈 은신처 1', options: { cat: true, animalCount: 9, emptyCount: 1 } },
  { label: '고양이 없이', hint: '동물 9 · 빈 은신처 1', options: { cat: false, animalCount: 9, emptyCount: 1 } },
  { label: '빈 은신처 둘', hint: '고양이 없이 · 동물 8 · 빈 은신처 2', options: { cat: false, animalCount: 8, emptyCount: 2 } },
];

const same = (a: HideOptions, b: HideOptions) => a.cat === b.cat && a.animalCount === b.animalCount && a.emptyCount === b.emptyCount;
const range = (from: number, to: number) => Array.from({ length: Math.max(0, to - from + 1) }, (_, i) => from + i);

/** 대기실의 카드 구성 설정. 방장만 바꿀 수 있고, 나머지는 현재 구성을 본다. */
const HideOptionsPanel: React.FC<HideOptionsPanelProps> = ({ options = HIDE_DEFAULT_OPTIONS, isHost, onChange }) => {
  const animals = hideAnimalsInPlay(options);
  const total = options.animalCount + options.emptyCount;
  const removed = total - HIDE_HIDEOUT_COUNT;
  const change = (patch: Partial<HideOptions>) => {
    const next = { ...options, ...patch };
    // 고양이를 빼면 일반 동물은 9종뿐이다
    next.animalCount = Math.min(next.animalCount, hideMaxAnimalCount(next.cat));
    if (next.animalCount + next.emptyCount < HIDE_HIDEOUT_COUNT) return;
    if (!same(next, options)) onChange?.(next);
  };

  return (
    <div className="hs-opt" aria-label="카드 구성">
      {isHost ? (
        <>
          <div className="hs-opt__presets" role="group" aria-label="추천 구성">
            {PRESETS.map((preset) => (
              <button key={preset.label} type="button" className="hs-opt__preset" aria-pressed={same(preset.options, options)} onClick={() => change(preset.options)}>
                <strong>{preset.label}</strong><small>{preset.hint}</small>
              </button>
            ))}
          </div>
          <div className="hs-opt__fields">
            <label className="hs-opt__check">
              <input type="checkbox" checked={options.cat} onChange={(event) => change({ cat: event.target.checked })} />
              <span>🐱 고양이 포함</span>
            </label>
            <label className="crux-field">
              <span className="crux-label">동물 카드{options.cat ? ' (고양이 포함)' : ''}</span>
              <select className="crux-input" aria-label="동물 카드 수" value={options.animalCount} onChange={(event) => change({ animalCount: Number(event.target.value) })}>
                {range(HIDE_OPTION_LIMITS.minAnimals, hideMaxAnimalCount(options.cat)).map((n) => (
                  <option key={n} value={n} disabled={n + options.emptyCount < HIDE_HIDEOUT_COUNT}>{n}장</option>
                ))}
              </select>
            </label>
            <label className="crux-field">
              <span className="crux-label">빈 은신처 카드</span>
              <select className="crux-input" aria-label="빈 은신처 카드 수" value={options.emptyCount} onChange={(event) => change({ emptyCount: Number(event.target.value) })}>
                {range(0, HIDE_OPTION_LIMITS.maxEmpty).map((n) => (
                  <option key={n} value={n} disabled={options.animalCount + n < HIDE_HIDEOUT_COUNT}>{n}장</option>
                ))}
              </select>
            </label>
          </div>
        </>
      ) : <p className="crux-mission-note">벨레이가 카드 구성을 정합니다. 구성이 바뀌면 준비가 풀리니 확인하고 다시 준비해 주세요.</p>}

      <div className="crux-mission-info">
        <strong>카드 {total}장 = 동물 {options.animalCount} + 빈 은신처 {options.emptyCount}</strong>
        <p>
          은신처 {HIDE_HIDEOUT_COUNT}곳에 한 장씩 숨기고, {removed > 0 ? <>남은 <b>{removed}장</b>은 아무도 보지 못한 채 치워요.</> : <b>남는 카드 없이 전부 숨겨요.</b>}
          {' '}{options.emptyCount === 0 ? '빈 은신처는 없어요.' : `빈 은신처는 최대 ${Math.min(options.emptyCount, HIDE_HIDEOUT_COUNT)}곳까지 나올 수 있어요.`}
        </p>
        <p className="hs-opt__animals" aria-label="이 판의 동물">
          {animals.map((animal) => <span key={animal} title={HIDE_ANIMAL_LABEL[animal]}>{HIDE_ANIMAL_EMOJI[animal]} {HIDE_ANIMAL_LABEL[animal]}</span>)}
        </p>
        <p>
          {options.cat
            ? <><b>🐱 고양이</b>를 엿보면 함께 엿본 카드와 자리가 바뀌어요. 곰이나 부엉이와 함께 엿봤다면 바뀌지 않아요. 바뀌었는지는 엿본 사람만 알아요.</>
            : '고양이가 없는 판이라 카드 자리는 라운드 내내 바뀌지 않아요.'}
        </p>
      </div>
    </div>
  );
};

export default HideOptionsPanel;
