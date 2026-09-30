import React from 'react';
import { GameRoom as GameRoomType } from '../types/game.types';
import { BombMissionCatalogEntry } from '../types/bomb-busters.types';

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
  const cannotStart = room.players.length < minPlayers || room.players.length > maxPlayers
    || !room.players.every((player) => player.isReady || player.isHost)
    || (room.gameType === 'bomb-busters' && (!selectedMission || selectedMission.supported === false))
    || (room.gameType === 'fellowship' && !room.fellowshipChapters?.some((chapter) => chapter.number === room.selectedFellowshipChapter));

  const gameTypeLabel = room.gameType === 'fellowship' ? '반지 원정대' : room.gameType === 'bomb-busters' ? '봄버스터즈' : room.gameType === 'no-touch-kraken' ? '노터치크라켄' : '토이배틀';
  const fellowshipChapter = room.fellowshipChapters?.find((chapter) => chapter.number === room.selectedFellowshipChapter);

  return (
    <div style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
        }}
      >
        <div>
          <h2>방: {room.name}</h2>
          <span style={{
            display: 'inline-block',
            padding: '4px 10px',
            borderRadius: '12px',
            fontSize: '12px',
            fontWeight: 'bold',
            backgroundColor: room.gameType === 'no-touch-kraken' ? '#e8f5e9' : '#e3f2fd',
            color: room.gameType === 'no-touch-kraken' ? '#2e7d32' : '#1565c0',
            border: `1px solid ${room.gameType === 'no-touch-kraken' ? '#a5d6a7' : '#90caf9'}`,
          }}>
            {gameTypeLabel}
          </span>
        </div>
        <button
          onClick={onLeaveRoom}
          style={{
            padding: '8px 16px',
            backgroundColor: '#dc3545',
            color: 'white',
            border: 'none',
            borderRadius: '3px',
          }}
        >
          방 나가기
        </button>
      </div>

      {message && (
        <div
          style={{
            padding: '10px',
            backgroundColor: messageType === 'error' ? '#f8d7da' : messageType === 'success' ? '#d4edda' : '#d1ecf1',
            color: messageType === 'error' ? '#721c24' : messageType === 'success' ? '#155724' : '#0c5460',
            borderRadius: '3px',
            marginBottom: '15px',
          }}
        >
          {message}
        </div>
      )}

      {room.gameType === 'bomb-busters' && (
        <section style={{ padding: '18px', marginBottom: '20px', background: '#fff8eb', border: '1px solid #f4d39e', borderRadius: '10px', lineHeight: 1.7 }}>
          <h3 style={{ margin: '0 0 8px', color: '#9a4c12' }}>함께 해체하는 협력 작전</h3>
          {isHost ? <label style={{ display: 'block', fontWeight: 600 }}>
            임무 선택
            <select aria-label="봄버스터즈 임무 선택" value={missionId} disabled={missions.length === 0} onChange={(e) => onMissionChange?.(Number(e.target.value))}
              style={{ display: 'block', padding: '10px', marginTop: '6px', width: '100%', fontSize: '14px', borderRadius: '6px', border: '1px solid #d5b683', background: 'white' }}>
              {missions.length === 0 && <option value={missionId}>미션 목록 불러오는 중…</option>}
              {missions.map((mission) => <option key={mission.id} value={mission.id} disabled={mission.supported === false}>
                {mission.id === 0 ? '자유 연습' : `미션 ${mission.id}`} · {mission.name}
              </option>)}
            </select>
          </label> : <p style={{ margin: '6px 0' }}>방장이 임무를 선택합니다. 모두 준비하면 작전을 시작할 수 있습니다.</p>}
          {selectedMission && <div style={{ marginTop: '14px', padding: '12px', background: '#fffdf8', borderRadius: '8px' }} aria-label="선택한 미션 안내">
            <strong>{selectedMission.name}</strong>
            <p style={{ margin: '5px 0', fontSize: '13px' }}>{selectedMission.description}</p>
            <p style={{ margin: '5px 0', fontSize: '13px' }}>현재 {room.players.length}인 구성 · 파랑 1–{selectedMission.blueMax} 각 4개
              {selectedMission.yellowCount > 0 && ` · 노랑 ${selectedMission.yellowCount}개 / 후보 ${selectedMission.yellowCandidateCount}개`}
              {selectedMission.redCount > 0 && ` · 빨강 ${selectedMission.redCount}개 / 후보 ${selectedMission.redCandidateCount}개`}
              {selectedMission.equipment ? ` · 공용 장비 ${selectedMission.equipmentCount ?? room.players.length}개` : ' · 공용 장비 없음'}
            </p>
            {!!selectedMission.rules?.length && <ul style={{ paddingLeft: '20px', margin: '8px 0 0', fontSize: '13px' }}>{selectedMission.rules.map((rule) => <li key={rule}>{rule}</li>)}</ul>}
          </div>}
          {missionId === 0 && <p style={{ fontSize: '13px', color: '#865a30' }}>룰북의 기본 규칙으로 구성한 웹 자유 연습입니다. 공식 번호 임무가 아니며, 파란 전선 1–12와 노란·빨간 전선, 공용 장비를 사용합니다.</p>}
          <p style={{ marginBottom: 0, fontSize: '14px' }}>기본 규칙에서는 내 전선만 보이고, 동료의 전선은 작은 수부터 정렬되어 있습니다. 파란 전선에 첫 단서를 놓은 뒤 같은 값의 전선을 함께 잘라보세요. 전선 배치와 단서가 달라지는 미션은 위의 개별 안내를 따릅니다.</p>
          <p style={{ marginBottom: 0, fontSize: '13px', color: '#865a30' }}>전선의 숫자와 위치를 말하거나 암시하지 마세요. 화면에 공개된 단서와 정해진 행동으로만 정보를 나눕니다. 2–3인 게임은 일부 대원이 받침대 2개를 사용합니다.</p>
        </section>
      )}

      {room.gameType === 'fellowship' && (
        <section className="fellowship-waiting-chapter" aria-label="반지 원정대 챕터 선택" style={{ padding: '18px', marginBottom: '20px', background: '#faf6e9', border: '1px solid #d9c494', borderRadius: '10px', lineHeight: 1.6 }}>
          <h3 style={{ margin: '0 0 8px', color: '#53411d' }}>원정대의 여정</h3>
          {isHost ? (
            <label style={{ display: 'block', fontWeight: 600 }}>
              챕터 선택
              <select
                aria-label="반지 원정대 챕터 선택"
                value={room.selectedFellowshipChapter ?? ''}
                disabled={!room.fellowshipChapters?.length}
                onChange={(event) => onFellowshipChapterChange?.(Number(event.target.value))}
                style={{ display: 'block', padding: '10px', marginTop: '6px', width: '100%', fontSize: '14px', borderRadius: '6px', border: '1px solid #bba66f', background: 'white' }}
              >
                {!room.fellowshipChapters?.length && <option value="">챕터 목록 불러오는 중…</option>}
                {room.fellowshipChapters?.map((chapter) => (
                  <option key={chapter.number} value={chapter.number}>챕터 {chapter.number} · {chapter.title}</option>
                ))}
              </select>
            </label>
          ) : <p style={{ margin: '6px 0' }}>방장이 챕터를 선택합니다. 준비를 마치면 함께 시작할 수 있습니다.</p>}
          {fellowshipChapter && <div style={{ marginTop: '12px', padding: '12px', background: '#fffdf6', borderRadius: '8px' }}>
            <strong>챕터 {fellowshipChapter.number} · {fellowshipChapter.title}</strong>
            <p style={{ margin: '5px 0', fontSize: '13px' }}>{fellowshipChapter.mode === 'short' ? '한 라운드' : fellowshipChapter.mode === 'long' ? '여러 라운드' : '특별 진행'} · 캐릭터 {fellowshipChapter.characters.length}명</p>
            {!!fellowshipChapter.summary && <p style={{ margin: '5px 0', fontSize: '13px' }}>{fellowshipChapter.summary}</p>}
            <p style={{ margin: '5px 0', fontSize: '13px' }}>필수 캐릭터: {fellowshipChapter.required.length ? fellowshipChapter.required.join(', ') : '없음'}</p>
          </div>}
          <p style={{ marginBottom: 0, fontSize: '13px', color: '#67542d' }}>라운드마다 비공개 손패로 협력하며 캐릭터별 목표를 달성하세요. 2인 게임에서는 더미 플레이어의 피라미드 패가 추가됩니다.</p>
        </section>
      )}

      <div
        style={{
          marginBottom: '20px',
          padding: '15px',
          border: '1px solid #ddd',
          borderRadius: '5px',
        }}
      >
        <h3>
          플레이어 목록 ({room.players.length}/{room.maxPlayers})
        </h3>
        {room.players.map((player) => (
          <div
            key={player.id}
            style={{
              padding: '10px',
              margin: '5px 0',
              backgroundColor: '#f8f9fa',
              borderRadius: '3px',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>
              <strong>{player.name}</strong>
              {player.isHost && (
                <span style={{ color: '#007bff', marginLeft: '5px' }}>
                  (방장)
                </span>
              )}
            </span>
            <span
              style={{
                padding: '2px 8px',
                borderRadius: '3px',
                fontSize: '12px',
                backgroundColor:
                  player.isReady || player.isHost ? '#28a745' : '#ffc107',
                color: 'white',
              }}
            >
              {player.isHost ? '방장' : player.isReady ? '준비됨' : '대기중'}
            </span>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: '10px' }}>
        {!isHost && (
          <button
            onClick={onToggleReady}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor: isReady ? '#ffc107' : '#28a745',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor: 'pointer',
            }}
          >
            {isReady ? '준비 취소' : '준비'}
          </button>
        )}

        {isHost && (
          <button
            onClick={onStartGame}
            disabled={cannotStart}
            style={{
              flex: 1,
              padding: '12px',
              backgroundColor:
                cannotStart
                  ? '#6c757d'
                  : '#007bff',
              color: 'white',
              border: 'none',
              borderRadius: '3px',
              cursor:
                cannotStart
                  ? 'not-allowed'
                  : 'pointer',
            }}
          >
            게임 시작
          </button>
        )}
      </div>

      {isHost && room.players.length < minPlayers && (
        <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
          게임을 시작하려면 최소 {minPlayers}명의 플레이어가 필요합니다.
        </p>
      )}

      {isHost &&
        room.players.length >= minPlayers &&
        !room.players.every((p) => p.isReady || p.isHost) && (
          <p style={{ textAlign: 'center', color: '#666', marginTop: '10px' }}>
            모든 플레이어가 준비 상태여야 게임을 시작할 수 있습니다.
          </p>
        )}
    </div>
  );
};

export default WaitingRoom;
