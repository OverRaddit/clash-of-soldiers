import { Injectable } from '@nestjs/common';
import {
  GameState,
  Soldier,
  Player,
  PlayerColor,
} from './entities/game-state.entity';

@Injectable()
export class GameLogicService {
  // 게임 초기화
  initializeGame(playerIds: string[], playerNames: string[]): GameState {
    const gameState = new GameState();

    // 플레이어 순서 랜덤 셔플
    const shuffledPlayerIds = [...playerIds];
    const shuffledPlayerNames = [...playerNames];
    this.shufflePlayers(shuffledPlayerIds, shuffledPlayerNames);

    // 플레이어 색상 할당 (첫 번째 플레이어: red, 두 번째: blue)
    const colors: PlayerColor[] = ['red', 'blue'];

    shuffledPlayerIds.forEach((id, index) => {
      const playerName = shuffledPlayerNames[index];
      const player: Player = {
        id,
        name: playerName,
        color: colors[index],
        isHost: index === 0,
        deck: this.createPlayerDeck(),
        stand: [],
        medals: 0,
        discardPile: [],
      };

      // 초기 받침대 구성 (선공 3개, 후공 4개)
      const initialCards = index === 0 ? 3 : 4;
      for (let i = 0; i < initialCards; i++) {
        if (player.deck.length > 0) {
          const soldier = player.deck.pop()!;
          soldier.playerId = id;
          soldier.playerColor = player.color;
          player.stand.push(soldier);
        }
      }

      gameState.players.set(id, player);
      
      // 각 플레이어의 거점에 더미 병정 배치
      const playerBase = player.color === 'red' ? 'X' : 'Y';
      const baseVertex = gameState.vertices.get(playerBase);
      if (baseVertex) {
        const baseSoldier = {
          type: 0, // 더미 거점 병정
          power: 0, // 어떤 병정으로도 제압 가능
          playerId: id,
          playerColor: player.color
        };
        baseVertex.soldiers.push(baseSoldier);
      }
    });

    gameState.currentTurn = shuffledPlayerIds[0]; // 랜덤 셔플된 첫 번째 플레이어부터 시작
    gameState.gameStatus = 'playing';

    return gameState;
  }

  // 플레이어 덱 생성 (1~8번 각 3장씩, 4장 제외)
  private createPlayerDeck(): Soldier[] {
    const deck: Soldier[] = [];

    // 1~8번 병정 각 3장씩 생성
    for (let type = 1; type <= 8; type++) {
      for (let count = 0; count < 3; count++) {
        deck.push({
          type,
          power: this.getSoldierPower(type),
          playerId: '', // 나중에 할당
          playerColor: 'red', // 나중에 할당
        });
      }
    }

    // 덱 섞기
    this.shuffleArray(deck);

    // 4장 제거
    deck.splice(0, 4);

    return deck;
  }

  // 병정 타입별 힘 수치 반환
  private getSoldierPower(type: number): number {
    const powerMap: Record<number, number> = {
      0: 0, // 거점 (더미)
      1: 1, // 해골이
      2: 2, // 캡틴
      3: 3, // 거인병
      4: 4, // 코코 선장
      5: 5, // XB-42
      6: 6, // 레인보우
      7: 7, // 렉시
      8: 0, // 꽉스 (조커, 힘 무시)
    };
    return powerMap[type] || 0;
  }

  // 배열 섞기
  private shuffleArray<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  // 플레이어 순서 랜덤 셔플 (ID와 이름을 함께 섞기)
  private shufflePlayers(playerIds: string[], playerNames: string[]): void {
    for (let i = playerIds.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      // ID와 이름을 함께 교환
      [playerIds[i], playerIds[j]] = [playerIds[j], playerIds[i]];
      [playerNames[i], playerNames[j]] = [playerNames[j], playerNames[i]];
    }
  }

  // 병정 2개 뽑기
  drawTwoSoldiers(gameState: GameState, playerId: string): boolean {
    const player = gameState.players.get(playerId);
    if (!player) return false;

    // 받침대가 8개 이상이면 불가
    if (player.stand.length >= 8) return false;

    // 7개인 경우 1개만 뽑기
    const drawCount = player.stand.length === 7 ? 1 : 2;

    for (let i = 0; i < drawCount && player.deck.length > 0; i++) {
      const soldier = player.deck.pop()!;
      soldier.playerId = playerId;
      soldier.playerColor = player.color;
      player.stand.push(soldier);
    }

    return true;
  }

  // 병정 배치 가능 여부 확인
  canPlaceSoldier(
    gameState: GameState,
    playerId: string,
    soldierIndex: number,
    targetVertex: string
  ): { canPlace: boolean; reason?: string } {
    const player = gameState.players.get(playerId);
    if (!player)
      return { canPlace: false, reason: '플레이어를 찾을 수 없습니다.' };

    if (soldierIndex < 0 || soldierIndex >= player.stand.length) {
      return { canPlace: false, reason: '잘못된 병정 인덱스입니다.' };
    }

    const soldier = player.stand[soldierIndex];
    const vertex = gameState.vertices.get(targetVertex);
    if (!vertex)
      return { canPlace: false, reason: '존재하지 않는 지점입니다.' };

    const playerBase = player.color === 'red' ? 'X' : 'Y';
    if (targetVertex === playerBase) {
      return { canPlace: false, reason: '자신의 거점에는 배치할 수 없습니다.' };
    }

    // 4번 병정(코코 선장)이 아닌 경우 경로 연결성 확인
    if (soldier.type !== 4) {
      const playerBase = gameState.getPlayerBase(playerId);
      if (!gameState.isPathConnected(playerBase, targetVertex, playerId)) {
        return { canPlace: false, reason: '거점과 연결되지 않은 지점입니다.' };
      }
    }

    // 해당 지점에 병정이 있는 경우 배치 우위 확인
    if (vertex.soldiers.length > 0) {
      const topSoldier = vertex.soldiers[vertex.soldiers.length - 1];

      // 8번 병정(꽉스)은 배치 우위 무시
      if (soldier.type === 8) {
        return { canPlace: true };
      }

      // 상대 병정이고 힘이 약하면 배치 불가
      if (
        topSoldier.playerId !== playerId &&
        soldier.power <= topSoldier.power
      ) {
        return { canPlace: false, reason: '배치 우위가 부족합니다.' };
      }
    }

    return { canPlace: true };
  }

  // 병정 배치
  placeSoldier(
    gameState: GameState,
    playerId: string,
    soldierIndex: number,
    targetVertex: string
  ): {
    success: boolean;
    medalAwarded?: number;
    gameEnded?: boolean;
    reason?: string;
  } {
    const canPlaceResult = this.canPlaceSoldier(
      gameState,
      playerId,
      soldierIndex,
      targetVertex
    );
    if (!canPlaceResult.canPlace) {
      return { success: false, reason: canPlaceResult.reason };
    }

    const player = gameState.players.get(playerId);
    const vertex = gameState.vertices.get(targetVertex);
    if (!player || !vertex) {
      return {
        success: false,
        reason: '플레이어 또는 지점을 찾을 수 없습니다.',
      };
    }

    // 병정을 받침대에서 제거하고 지점에 배치
    const soldier = player.stand.splice(soldierIndex, 1)[0];
    vertex.soldiers.push(soldier);

    // 병정 효과 적용
    this.applySoldierEffect(gameState, playerId, soldier, targetVertex);

    // 승점 확인 및 부여
    const medalAwarded = gameState.checkAndAwardMedals(playerId);

    // 승리 조건 확인
    const winner = gameState.checkWinCondition();
    if (winner) {
      gameState.gameStatus = 'finished';
      gameState.winner = winner;
      return { success: true, medalAwarded, gameEnded: true };
    }

    return { success: true, medalAwarded };
  }

  // 병정 효과 적용
  private applySoldierEffect(
    gameState: GameState,
    playerId: string,
    soldier: Soldier,
    targetVertex: string
  ): void {
    const player = gameState.players.get(playerId);
    if (!player) return;

    switch (soldier.type) {
      case 1: // 해골이: 병정 2개 뽑기
        this.drawTwoSoldiers(gameState, playerId);
        break;

      case 2: // 캡틴: 추가 병정 배치 기회
        this.setCaptainAdditionalPlace(gameState, playerId);
        break;

      case 3: // 거인병: 인접 칸 상대 병정 제거
        this.removeAdjacentEnemySoldier(gameState, playerId, targetVertex);
        break;

      case 5: // XB-42: 상대 받침대에서 무작위 병정 제거
        this.removeRandomEnemyStandSoldier(gameState, playerId);
        break;

      case 6: // 레인보우: 병정 1개 뽑기
        if (player.deck.length > 0 && player.stand.length < 8) {
          const newSoldier = player.deck.pop()!;
          newSoldier.playerId = playerId;
          newSoldier.playerColor = player.color;
          player.stand.push(newSoldier);
        }
        break;
    }
  }

  // 거인병 효과: 인접 칸 상대 병정 제거 (2단계)
  private removeAdjacentEnemySoldier(
    gameState: GameState,
    playerId: string,
    targetVertex: string
  ): void {
    const adjacentVertices = gameState.adjacencyList.get(targetVertex) || [];
    const availableTargets: string[] = [];
    
    // 제거 가능한 인접 정점들 찾기
    for (const vertexId of adjacentVertices) {
      const vertex = gameState.vertices.get(vertexId);
      if (vertex && vertex.soldiers.length > 0) {
        const topSoldier = vertex.soldiers[vertex.soldiers.length - 1];
        if (topSoldier.playerId !== playerId && topSoldier.type !== 0) {
          // 상대 병정이면서 거점(type 0)이 아닌 경우만 제거 가능
          availableTargets.push(vertexId);
        }
      }
    }
    
    // 제거 가능한 대상이 있으면 선택 대기 상태로 설정
    if (availableTargets.length > 0) {
      gameState.setPendingAction({
        type: 'select_giant_target',
        playerId: playerId,
        availableTargets: availableTargets,
        sourceVertex: targetVertex
      });
    }
  }

  // 캡틴 효과: 추가 병정 배치 기회 설정
  private setCaptainAdditionalPlace(gameState: GameState, playerId: string): void {
    gameState.setPendingAction({
      type: 'place_additional_soldier',
      playerId: playerId
    });
  }

  // 거인병 대상 선택 처리
  executeGiantSelection(gameState: GameState, playerId: string, selectedVertex: string): boolean {
    const pendingAction = gameState.pendingAction;
    
    // 유효성 검사
    if (!pendingAction || 
        pendingAction.type !== 'select_giant_target' || 
        pendingAction.playerId !== playerId ||
        !pendingAction.availableTargets.includes(selectedVertex)) {
      return false;
    }
    
    // 선택된 정점의 병정 제거
    const vertex = gameState.vertices.get(selectedVertex);
    if (vertex && vertex.soldiers.length > 0) {
      const removedSoldier = vertex.soldiers.pop()!;
      const enemyPlayer = gameState.players.get(removedSoldier.playerId);
      if (enemyPlayer) {
        enemyPlayer.discardPile.push(removedSoldier);
      }
    }
    
    // 대기 중인 액션 클리어
    gameState.clearPendingAction();
    return true;
  }

  // XB-42 효과: 상대 받침대에서 무작위 병정 제거
  private removeRandomEnemyStandSoldier(
    gameState: GameState,
    playerId: string
  ): void {
    const enemies = Array.from(gameState.players.values()).filter(
      (p) => p.id !== playerId
    );

    for (const enemy of enemies) {
      if (enemy.stand.length > 0) {
        const randomIndex = Math.floor(Math.random() * enemy.stand.length);
        const removedSoldier = enemy.stand.splice(randomIndex, 1)[0];
        enemy.discardPile.push(removedSoldier);
        break; // 한 명의 상대에게서만 제거
      }
    }
  }

  // 턴 변경
  nextTurn(gameState: GameState): void {
    const playerIds = Array.from(gameState.players.keys());
    const currentIndex = playerIds.indexOf(gameState.currentTurn);
    const nextIndex = (currentIndex + 1) % playerIds.length;
    gameState.currentTurn = playerIds[nextIndex];
    gameState.turnCount++;
  }
}
