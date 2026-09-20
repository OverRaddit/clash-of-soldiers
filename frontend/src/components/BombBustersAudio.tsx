import React from 'react';
import { BombAudioView } from '../types/bomb-busters.types';
import useServerClock from '../hooks/useServerClock';

interface Props { audio: BombAudioView; serverNow?: number; }
const statusLabels: Record<BombAudioView['status'], string> = { ready: '시작 대기', running: '작전 시간 진행 중', paused: '선택하는 동안 시간 정지', complete: '안내 완료' };

/** The Korean instruction schedule is driven by the server; the source MP3 is reference only. */
const BombBustersAudio: React.FC<Props> = ({ audio, serverNow }) => {
  const now = useServerClock(serverNow, audio.status === 'running' && !!audio.deadlineAt);
  const remaining = audio.status === 'running' && audio.deadlineAt
    ? Math.max(0, Math.ceil((audio.deadlineAt - now) / 1000))
    : audio.remainingSeconds;
  const seconds = remaining === undefined ? undefined : Math.max(0, Math.ceil(remaining));
  const step = Math.min(audio.stepCount, audio.stepIndex + 1);
  return <section className={`bb-audio bb-audio-${audio.status}`} aria-label="음성 미션 진행 안내">
    <div className="bb-audio-heading"><div><span className="bb-eyebrow">MISSION BRIEFING</span><h3>{audio.title}</h3></div>
      {seconds !== undefined && audio.status !== 'complete' && <time className={`bb-mission-timer ${seconds <= 30 && audio.status === 'running' ? 'urgent' : ''}`} aria-label={`작전 남은 시간 ${Math.floor(seconds / 60)}분 ${seconds % 60}초`}>{Math.floor(seconds / 60)}:{String(Math.max(0, Math.ceil(seconds)) % 60).padStart(2, '0')}</time>}
    </div>
    <div className="bb-audio-progress"><span className="bb-audio-status">{statusLabels[audio.status]}</span><span>안내 {step} / {audio.stepCount}</span></div>
    <progress value={step} max={audio.stepCount || 1} aria-label="음성 미션 안내 순서" />
    <ol className="bb-audio-instructions" aria-live="polite">{audio.instructions.map((instruction, index) => <li key={`${audio.stepIndex}-${index}`}>{instruction}</li>)}</ol>
    {!!audio.targetNumbers.length && <div className="bb-audio-targets"><span>현재 지정 숫자</span>{audio.targetNumbers.map((value) => <strong key={value}>{value}</strong>)}</div>}
    {audio.speechRule && <p className="bb-audio-speech"><strong>대화 규칙</strong>{audio.speechRule}</p>}
    <div className="bb-audio-footer"><p>화면의 한국어 지시와 미션 행동 버튼으로 진행합니다. 남은 시간과 사건은 모든 대원에게 함께 적용됩니다. 원본 음원은 참고용입니다.</p><a href={audio.sourceUrl} target="_blank" rel="noreferrer">공식 원본 음원 참고 ↗</a></div>
  </section>;
};
export default BombBustersAudio;
