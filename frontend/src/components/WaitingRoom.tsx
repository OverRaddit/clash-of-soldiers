import React from 'react';
import { GameRoom as GameRoomType } from '../types/game.types';
import { BombMissionCatalogEntry } from '../types/bomb-busters.types';
import Hold, { HoldColor } from './crux/Hold';

interface WaitingRoomProps {
  room: GameRoomType;
  playerId: string;
  message: string;
  messageType: 'success' | 'error' | 'info';
  onLeaveRoom: () => void;
  onToggleReady: () => void;
  onStartGame: () => void;
  missionId?: number;
  missions?: BombMissionCatalogEntry[];
  onMissionChange?: (missionId: number) => void;
  onFellowshipChapterChange?: (chapter: number) => void;
}

const GAME_HOLD: Record<string, HoldColor> = { 'toy-battle': 'blue', 'no-touch-kraken': 'green', 'bomb-busters': 'orange', fellowship: 'purple' };

const WaitingRoom: React.FC<WaitingRoomProps> = ({
  room,
  playerId,
  message,
  messageType,
  onLeaveRoom,
  onToggleReady,
  onStartGame,
  missionId = 1,
  missions = [],
  onMissionChange,
  onFellowshipChapterChange,
}) => {
  const currentPlayer = room.players.find((p) => p.id === playerId);
  const isHost = currentPlayer?.isHost || false;
  const isReady = currentPlayer?.isReady || false;
  const selectedMission = missions.find((mission) => mission.id === missionId);
  const minPlayers = room.gameType === 'fellowship' ? 1 : room.gameType === 'no-touch-kraken' ? 3 : selectedMission?.minPlayers ?? 2;
  const maxPlayers = room.gameType === 'bomb-busters' ? selectedMission?.maxPlayers ?? room.maxPlayers : room.maxPlayers;
  const everyoneReady = room.players.every((player) => player.isReady || player.isHost);
  const cannotStart = room.players.length < minPlayers || room.players.length > maxPlayers
    || !everyoneReady
    || (room.gameType === 'bomb-busters' && (!selectedMission || selectedMission.supported === false))
    || (room.gameType === 'fellowship' && !room.fellowshipChapters?.some((chapter) => chapter.number === room.selectedFellowshipChapter));

  const gameTypeLabel = room.gameType === 'fellowship' ? '반지 원정대' : room.gameType === 'bomb-busters' ? '봄버스터즈' : room.gameType === 'no-touch-kraken' ? '노터치크라켄' : '토이배틀';
  const holdColor = GAME_HOLD[room.gameType] || 'orange';
  const fellowshipChapter = room.fellowshipChapters?.find((chapter) => chapter.number === room.selectedFellowshipChapter);
  const hostName = room.players.find((p) => p.isHost)?.name;
  const emptySeats = Math.max(0, room.maxPlayers - room.players.length);

  return (
    <main className="crux-main crux-wait">
      <div className="crux-page-head" style={{ alignItems: 'flex-start' }}>
        <div className="crux-page-head__text" style={{ gap: 8 }}>
          <div className="crux-row">
            <button type="button" className="crux-btn crux-btn--ghost crux-btn--sm" onClick={onLeaveRoom} style={{ paddingLeft: 0 }}>← 클라이밍장</button>
            <span className={`crux-badge crux-badge--${holdColor}`}>{gameTypeLabel}</span>
            <span className="crux-badge crux-badge--code">{room.id.slice(0, 12)}</span>
          </div>
          <h1 className="crux-h1">{room.name}</h1>
          <p className="crux-lead">벨레이 스테이션 · {room.players.length}/{room.maxPlayers}명 모였어요. {minPlayers}명 이상이면 등반을 시작할 수 있어요.</p>
        </div>
        <button type="button" onClick={onLeaveRoom} className="crux-btn crux-btn--danger">로프 풀기 <span style={{ fontWeight: 400, opacity: .85 }}>(방 나가기)</span></button>
      </div>

      {message && (
        <div role="status" className={`crux-banner ${messageType === 'error' ? 'crux-banner--error' : messageType === 'success' ? 'crux-banner--warn' : 'crux-banner--info'}`}>
          {messageType === 'error' ? '✕ ' : messageType === 'success' ? '✓ ' : ''}{message}
        </div>
      )}

      {/* 같은 로프에 */}
      <section className="crux-panel crux-stack" aria-labelledby="crux-climbers-title">
        <div className="crux-section-head">
          <h2 id="crux-climbers-title" className="crux-h2">같은 로프에 <small>{room.players.length} / {room.maxPlayers}</small></h2>
          {!isHost && (
            <button type="button" onClick={onToggleReady} className={`crux-btn crux-btn--sm ${isReady ? 'crux-btn--secondary' : 'crux-btn--primary'}`}>
              {isReady ? '준비 취소' : '준비 완료'}
            </button>
          )}
        </div>
        <div className="crux-wait__rope">
          <div className="crux-rope" role="presentation" />
          <ul className="crux-wait__climbers" style={{ listStyle: 'none', margin: 0, padding: 0 }}>
            {room.players.map((player) => {
              const me = player.id === playerId;
              const ready = player.isReady || player.isHost;
              return (
                <li key={player.id} className={`crux-climber${me ? ' crux-climber--me' : ''}${player.isHost ? ' crux-climber--host' : ''}`}>
                  {me ? <img className="crux-mascot crux-mascot--avatar" src="/mascot/dambi-head.png" alt="" style={{ width: 24, height: 24, border: 0 }} />
                    : <span className="crux-climber__avatar">{player.name.slice(0, 1)}</span>}
                  {player.name}
                  {!player.isHost && <span className={`crux-badge ${ready ? 'crux-badge--green' : 'crux-badge--yellow'}`} style={{ padding: '0 6px' }}>{ready ? '✓ 준비' : '▲ 대기'}</span>}
                </li>
              );
            })}
            {Array.from({ length: emptySeats }, (_, i) => (
              <li key={`empty-${i}`} className="crux-climber crux-climber--empty"><span className="crux-climber__avatar">+</span>빈 자리</li>
            ))}
          </ul>
        </div>
        <p className="crux-help" style={{ margin: 0 }}>벨레이(방장)는 {hostName || '미정'}. 벨레이가 등반을 시작하면 모두 함께 게임 화면으로 이동해요.</p>
      </section>

      <div className="crux-wait__columns">
        {/* 게임 옵션 */}
        <section className="crux-route crux-wait__options" style={{ ['--route-color' as string]: `var(--hold-${holdColor})` }} aria-labelledby="crux-options-title">
          <div className="crux-row" style={{ justifyContent: 'space-between' }}>
            <div className="crux-page-head__text">
              <h2 id="crux-options-title" className="crux-h2">
                {room.gameType === 'bomb-busters' ? '작전 선택' : room.gameType === 'fellowship' ? '원정대의 여정' : '루트 정보'}
              </h2>
              <p className="crux-help">
                {room.gameType === 'bomb-busters' ? '봄버스터즈 캠페인 미션. 벨레이만 바꿀 수 있어요.' : room.gameType === 'fellowship' ? '18개 챕터 중 하나를 골라요. 벨레이만 바꿀 수 있어요.' : '설정할 옵션이 없는 게임이에요. 모두 준비되면 바로 시작해요.'}
              </p>
            </div>
            <Hold color={holdColor} seed={room.gameType} size={48} />
          </div>

          {room.gameType === 'bomb-busters' && (
            <>
              {isHost ? (
                <label className="crux-field">
                  <span className="crux-label">임무 선택</span>
                  <select aria-label="봄버스터즈 임무 선택" className="crux-input" value={missionId} disabled={missions.length === 0} onChange={(e) => onMissionChange?.(Number(e.target.value))}>
                    {missions.length === 0 && <option value={missionId}>미션 목록 불러오는 중…</option>}
                    {missions.map((mission) => <option key={mission.id} value={mission.id} disabled={mission.supported === false}>
                      {mission.id === 0 ? '자유 연습' : `미션 ${mission.id}`} · {mission.name}
                    </option>)}
                  </select>
                </label>
              ) : <p className="crux-mission-note">벨레이가 임무를 선택합니다. 모두 준비하면 작전을 시작할 수 있습니다.</p>}
              {selectedMission && <div className="crux-mission-info" aria-label="선택한 미션 안내">
                <strong>{selectedMission.name}</strong>
                <p>{selectedMission.description}</p>
                <p>현재 {room.players.length}인 구성 · 파랑 1–{selectedMission.blueMax} 각 4개
                  {selectedMission.yellowCount > 0 && ` · 노랑 ${selectedMission.yellowCount}개 / 후보 ${selectedMission.yellowCandidateCount}개`}
                  {selectedMission.redCount > 0 && ` · 빨강 ${selectedMission.redCount}개 / 후보 ${selectedMission.redCandidateCount}개`}
                  {selectedMission.equipment ? ` · 공용 장비 ${selectedMission.equipmentCount ?? room.players.length}개` : ' · 공용 장비 없음'}
                </p>
                {!!selectedMission.rules?.length && <ul>{selectedMission.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>}
              </div>}
              {missionId === 0 && <p className="crux-mission-note">룰북의 기본 규칙으로 구성한 웹 자유 연습입니다. 공식 번호 임무가 아니며, 파란 전선 1–12와 노란·빨간 전선, 공용 장비를 사용합니다.</p>}
              <p className="crux-mission-note">기본 규칙에서는 내 전선만 보이고, 동료의 전선은 작은 수부터 정렬되어 있습니다. 파란 전선에 첫 단서를 놓은 뒤 같은 값의 전선을 함께 잘라보세요. 전선 배치와 단서가 달라지는 미션은 위의 개별 안내를 따릅니다.</p>
              <p className="crux-mission-note">전선의 숫자와 위치를 말하거나 암시하지 마세요. 화면에 공개된 단서와 정해진 행동으로만 정보를 나눕니다. 2–3인 게임은 일부 대원이 받침대 2개를 사용합니다.</p>
            </>
          )}

          {room.gameType === 'fellowship' && (
            <div className="fellowship-waiting-chapter crux-stack" aria-label="반지 원정대 챕터 선택">
              {isHost ? (
                <label className="crux-field">
                  <span className="crux-label">챕터 선택</span>
                  <select
                    aria-label="반지 원정대 챕터 선택"
                    className="crux-input"
                    value={room.selectedFellowshipChapter ?? ''}
                    disabled={!room.fellowshipChapters?.length}
                    onChange={(event) => onFellowshipChapterChange?.(Number(event.target.value))}
                  >
                    {!room.fellowshipChapters?.length && <option value="">챕터 목록 불러오는 중…</option>}
                    {room.fellowshipChapters?.map((chapter) => (
                      <option key={chapter.number} value={chapter.number}>챕터 {chapter.number} · {chapter.title}</option>
                    ))}
                  </select>
                </label>
              ) : <p className="crux-mission-note">벨레이가 챕터를 선택합니다. 준비를 마치면 함께 시작할 수 있습니다.</p>}
              {fellowshipChapter && <div className="crux-mission-info">
                <strong>챕터 {fellowshipChapter.number} · {fellowshipChapter.title}</strong>
                <p>{fellowshipChapter.mode === 'short' ? '한 라운드' : fellowshipChapter.mode === 'long' ? '여러 라운드' : '특별 진행'} · 캐릭터 {fellowshipChapter.characters.length}명</p>
                {!!fellowshipChapter.summary && <p>{fellowshipChapter.summary}</p>}
                <p>필수 캐릭터: {fellowshipChapter.required.length ? fellowshipChapter.required.join(', ') : '없음'}</p>
              </div>}
              <p className="crux-mission-note">라운드마다 비공개 손패로 협력하며 캐릭터별 목표를 달성하세요. 2인 게임에서는 더미 플레이어의 피라미드 패가 추가됩니다.</p>
            </div>
          )}
        </section>

        {/* 벨레이 체크 */}
        <aside className="crux-panel crux-wait__check" aria-labelledby="crux-check-title">
          <h2 id="crux-check-title" className="crux-h2">벨레이 체크</h2>
          <ul className="crux-checklist">
            <li><span className={`crux-badge ${room.players.length >= minPlayers ? 'crux-badge--green' : 'crux-badge--yellow'}`}>{room.players.length >= minPlayers ? '✓' : '▲'}</span><span>최소 인원 {minPlayers}명{room.players.length < minPlayers ? ` — ${minPlayers - room.players.length}명 더 필요` : ''}</span></li>
            <li><span className={`crux-badge ${everyoneReady ? 'crux-badge--green' : 'crux-badge--yellow'}`}>{everyoneReady ? '✓' : '▲'}</span><span>{everyoneReady ? '모두 준비 완료' : '아직 준비 안 된 클라이머가 있어요'}</span></li>
            {room.gameType === 'bomb-busters' && <li><span className={`crux-badge ${selectedMission && selectedMission.supported !== false ? 'crux-badge--green' : 'crux-badge--yellow'}`}>{selectedMission && selectedMission.supported !== false ? '✓' : '▲'}</span><span>{selectedMission ? `작전: ${selectedMission.name}` : '작전 미선택'}</span></li>}
            {room.gameType === 'fellowship' && <li><span className={`crux-badge ${fellowshipChapter ? 'crux-badge--green' : 'crux-badge--yellow'}`}>{fellowshipChapter ? '✓' : '▲'}</span><span>{fellowshipChapter ? `챕터 ${fellowshipChapter.number}` : '챕터 미선택'}</span></li>}
          </ul>
          <div className="crux-wait__mascot">
            <img src="/mascot/dambi-body.png" alt="담비가 손을 들어 인사한다" />
            <p>"로프 묶었어? 초크 묻혔어? 그럼 올라가자."</p>
          </div>
        </aside>
      </div>

      <div className="crux-wait__foot">
        {isHost && room.players.length < minPlayers && (
          <p className="crux-help" style={{ margin: 0 }}>게임을 시작하려면 최소 {minPlayers}명의 플레이어가 필요합니다.</p>
        )}
        {isHost && room.players.length >= minPlayers && !everyoneReady && (
          <p className="crux-help" style={{ margin: 0 }}>모든 플레이어가 준비 상태여야 게임을 시작할 수 있습니다.</p>
        )}
        {isHost && room.players.length >= minPlayers && everyoneReady && (
          <p className="crux-help" style={{ margin: 0 }}>준비됐어요. 벨레이가 시작해요.</p>
        )}
        {!isHost && <p className="crux-help" style={{ margin: 0 }}>{isReady ? '준비 완료. 벨레이가 시작하길 기다려요.' : '준비 완료를 눌러 로프에 묶이세요.'}</p>}
        <button type="button" onClick={onLeaveRoom} className="crux-btn crux-btn--secondary">로프 풀기</button>
        {isHost ? (
          <button type="button" onClick={onStartGame} disabled={cannotStart} className="crux-btn crux-btn--primary crux-btn--lg">등반 시작</button>
        ) : (
          <button type="button" onClick={onToggleReady} className={`crux-btn crux-btn--lg ${isReady ? 'crux-btn--secondary' : 'crux-btn--primary'}`}>{isReady ? '준비 취소' : '준비 완료'}</button>
        )}
      </div>
    </main>
  );
};

export default WaitingRoom;
