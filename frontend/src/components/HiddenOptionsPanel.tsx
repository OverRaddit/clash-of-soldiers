import React, { useEffect, useState } from 'react';
import {
  HIDDEN_ANIMAL_EMOJI, HIDDEN_ANIMAL_LABEL, HIDDEN_DEFAULT_OPTIONS, HIDDEN_LEVEL_NAMES, HIDDEN_SPECIALS, HIDDEN_SPECIAL_EFFECT,
  HiddenOptions, HiddenSpecial, hiddenAnimalCount, hiddenHideoutCount, hiddenNormalsFor,
} from '../types/hidden.types';
import './HiddenGame.css';

interface HiddenOptionsPanelProps {
  options?: HiddenOptions;
  playerCount: number;
  isHost: boolean;
  onChange?: (options: HiddenOptions) => void;
}

const LEVEL_HINTS = ['특수 동물 없음', '오소리', '특수 2종', '특수 3종', '특수 4종 모두'];

/** 대기실의 난이도 설정. 방장만 바꿀 수 있고, 나머지는 현재 구성을 본다. */
const HiddenOptionsPanel: React.FC<HiddenOptionsPanelProps> = ({ options = HIDDEN_DEFAULT_OPTIONS, playerCount, isHost, onChange }) => {
  const { level, random } = options;
  const choosable = level === 2 || level === 3;
  // 직접 고르는 중인 특수 동물. 정확히 level 종이 됐을 때만 서버로 보낸다.
  const [picks, setPicks] = useState<HiddenSpecial[]>(options.specials);
  const specialsKey = options.specials.join(',');
  useEffect(() => { setPicks(options.specials); }, [specialsKey, level, random]); // eslint-disable-line react-hooks/exhaustive-deps

  const count = Math.min(6, Math.max(3, playerCount));
  const hideouts = hiddenHideoutCount(count);
  const normals = hiddenNormalsFor(count, level);
  const animalCards = Math.min(hiddenAnimalCount(count), normals.length + level);
  const removed = animalCards + 1 - hideouts;
  const shownSpecials: HiddenSpecial[] = level === 0 ? [] : random ? [...HIDDEN_SPECIALS] : options.specials;

  const setLevel = (next: number) => { if (next !== level) onChange?.({ level: next, random: false, specials: HIDDEN_SPECIALS.slice(0, next) }); };
  const setRandom = (next: boolean) => { if (next !== random) onChange?.({ level, random: next, specials: next ? [] : HIDDEN_SPECIALS.slice(0, level) }); };
  const toggle = (special: HiddenSpecial) => {
    const next = picks.includes(special) ? picks.filter((s) => s !== special) : [...picks, special];
    setPicks(next);
    if (next.length === level) onChange?.({ level, random: false, specials: HIDDEN_SPECIALS.filter((s) => next.includes(s)) });
  };

  return (
    <div className="ha-opt" aria-label="난이도 설정">
      {isHost ? (
        <>
          <div className="ha-opt__presets" role="group" aria-label="난이도">
            {HIDDEN_LEVEL_NAMES.map((name, lv) => (
              <button key={lv} type="button" className="ha-opt__preset" aria-pressed={lv === level} onClick={() => setLevel(lv)}>
                <strong>Lv.{lv} {name}</strong><small>{LEVEL_HINTS[lv]}</small>
              </button>
            ))}
          </div>
          {choosable && (
            <div className="ha-opt__fields">
              <label className="ha-opt__check">
                <input type="checkbox" checked={random} onChange={(event) => setRandom(event.target.checked)} />
                <span>🎲 비공개 무작위 {level}종</span>
              </label>
              {!random && (
                <div className="ha-opt__specials" role="group" aria-label={`특수 동물 ${level}종 고르기`}>
                  {HIDDEN_SPECIALS.map((special) => (
                    <label key={special} className="ha-opt__check">
                      <input type="checkbox" checked={picks.includes(special)} onChange={() => toggle(special)} />
                      <span>{HIDDEN_ANIMAL_EMOJI[special]} {HIDDEN_ANIMAL_LABEL[special]}</span>
                    </label>
                  ))}
                  {picks.length !== level && <span className="crux-badge crux-badge--yellow">{picks.length < level ? `${level - picks.length}종 더 고르세요` : `${picks.length - level}종을 빼 주세요`}</span>}
                </div>
              )}
            </div>
          )}
        </>
      ) : <p className="crux-mission-note">벨레이가 난이도를 정합니다. 난이도가 바뀌면 준비가 풀리니 확인하고 다시 준비해 주세요.</p>}

      <div className="crux-mission-info">
        <strong>Lv.{level} {HIDDEN_LEVEL_NAMES[level]} · {count}명 기준 은신처 {hideouts}곳</strong>
        <p>카드 {animalCards + 1}장(동물 {animalCards} + 빈 은신처 1)을 섞어 {hideouts}곳에 한 장씩 숨기고, 남은 <b>{removed}장</b>은 아무도 보지 못한 채 치워요. 은신처는 3명 6곳 · 4~5명 7곳 · 6명 8곳이에요.</p>
        <p className="ha-opt__animals" aria-label="이 판의 동물">
          {normals.map((animal) => <span key={animal}>{HIDDEN_ANIMAL_EMOJI[animal]} {HIDDEN_ANIMAL_LABEL[animal]}</span>)}
          {random
            ? <span><b>＋ 특수 {level}종 (비공개)</b></span>
            : options.specials.map((animal) => <span key={animal}><b>{HIDDEN_ANIMAL_EMOJI[animal]} {HIDDEN_ANIMAL_LABEL[animal]}</b></span>)}
        </p>
        {level === 0
          ? <p>특수 동물이 없는 판이에요. 거짓 단서의 핑계는 <b>빈 은신처</b>뿐입니다 — 빈 은신처를 본 사람은 아무 토큰이나 놓을 수 있어요.</p>
          : (
            <ul className="ha-opt__effects">
              {random && <li>아래 네 종 중 <b>{level}종</b>이 라운드마다 새로 뽑혀 들어가요. 무엇이 들었는지는 정답 공개 때 알 수 있어요.</li>}
              {shownSpecials.map((special) => <li key={special}><b>{HIDDEN_ANIMAL_EMOJI[special]} {HIDDEN_ANIMAL_LABEL[special]}</b> — {HIDDEN_SPECIAL_EFFECT[special]}</li>)}
            </ul>
          )}
      </div>
    </div>
  );
};

export default HiddenOptionsPanel;
