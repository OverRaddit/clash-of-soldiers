export type PlayerColor = 'red' | 'blue';
export type VertexType = 1 | 2 | 3; // 1: base, 2: special, 3: gray

export interface Soldier {
  type: number; // 1-8 (병정 번호)
  power: number; // 힘 수치
  playerId: string;
  playerColor: PlayerColor;
}

export interface Vertex {
  id: string;
  type: VertexType;
  soldiers: Soldier[]; // 스택 구조 (맨 뒤가 최상단)
}

export interface Player {
  id: string;
  name: string;
  color: PlayerColor;
  isHost: boolean;
  deck: Soldier[]; // 공급처
  stand: Soldier[]; // 받침대 (최대 8개)
  medals: number; // 훈장 점수
  discardPile: Soldier[]; // 버림 더미
}

export interface PendingAction {
  type: 'select_giant_target' | 'place_additional_soldier';
  playerId: string;
  availableTargets?: string[]; // 거인병용: 제거 가능한 정점들
  sourceVertex?: string; // 거인병이 배치된 정점
}

export interface MedalZone {
  vertices: string[]; // 해당 지역의 정점들
  points: number; // 획득 점수
  claimed: boolean; // 이미 누군가 획득했는지
  claimedBy?: string; // 누가 획득했는지
}

export class GameState {
  // 맵 구조
  vertices: Map<string, Vertex> = new Map();
  adjacencyList: Map<string, string[]> = new Map();

  // 게임 상태
  players: Map<string, Player> = new Map();
  currentTurn: string; // 현재 턴 플레이어 ID
  turnCount: number = 0;
  gameStatus: 'waiting' | 'playing' | 'finished' = 'waiting';
  winner?: string;

  // 스냅샷 시스템
  turnStartSnapshot?: any; // 턴 시작 시점의 상태

  // 대기 중인 액션
  pendingAction?: PendingAction;

  // 승점 시스템
  medalZones: MedalZone[] = [
    {
      vertices: ['X', 'X1', 'X2', 'Y1', 'Y2', 'M2'],
      points: 3,
      claimed: false,
    },
    {
      vertices: ['Y', 'X3', 'X4', 'Y3', 'Y4', 'M2'],
      points: 3,
      claimed: false,
    },
    { vertices: ['M1', 'M2', 'Y1', 'Y3'], points: 2, claimed: false },
    { vertices: ['M2', 'M3', 'Y2', 'Y4'], points: 2, claimed: false },
    { vertices: ['Y1', 'S1', 'M1'], points: 1, claimed: false },
    { vertices: ['Y2', 'S2', 'M3'], points: 1, claimed: false },
    { vertices: ['Y3', 'S3', 'M1'], points: 1, claimed: false },
    { vertices: ['Y4', 'S4', 'M3'], points: 1, claimed: false },
  ];

  constructor() {
    this.initializeMap();
  }

  private initializeMap(): void {
    // 정점 초기화
    const vertexData = [
      { id: 'X', type: 1 as VertexType },
      { id: 'Y', type: 1 as VertexType },
      { id: 'S1', type: 2 as VertexType },
      { id: 'S2', type: 2 as VertexType },
      { id: 'S3', type: 2 as VertexType },
      { id: 'S4', type: 2 as VertexType },
      { id: 'X1', type: 3 as VertexType },
      { id: 'X2', type: 3 as VertexType },
      { id: 'X3', type: 3 as VertexType },
      { id: 'X4', type: 3 as VertexType },
      { id: 'Y1', type: 3 as VertexType },
      { id: 'Y2', type: 3 as VertexType },
      { id: 'Y3', type: 3 as VertexType },
      { id: 'Y4', type: 3 as VertexType },
      { id: 'M1', type: 3 as VertexType },
      { id: 'M2', type: 3 as VertexType },
      { id: 'M3', type: 3 as VertexType },
    ];

    vertexData.forEach((v) => {
      this.vertices.set(v.id, { ...v, soldiers: [] });
      this.adjacencyList.set(v.id, []);
    });

    // 연결 관계 초기화
    const edges: [string, string][] = [
      ['X', 'X1'],
      ['X', 'X2'],
      ['X1', 'Y1'],
      ['X2', 'Y2'],
      ['Y1', 'M1'],
      ['Y2', 'M2'],
      ['Y1', 'S1'],
      ['Y2', 'M3'],
      ['Y1', 'M2'],
      ['Y2', 'S2'],
      ['S1', 'M1'],
      ['S2', 'M3'],
      ['Y', 'X3'],
      ['Y', 'X4'],
      ['X3', 'Y3'],
      ['X4', 'Y4'],
      ['Y3', 'M1'],
      ['Y4', 'M2'],
      ['Y3', 'S3'],
      ['Y4', 'M3'],
      ['Y3', 'M2'],
      ['Y4', 'S4'],
      ['S3', 'M1'],
      ['S4', 'M3'],
    ];

    edges.forEach(([a, b]) => {
      this.adjacencyList.get(a)?.push(b);
      this.adjacencyList.get(b)?.push(a);
    });
  }

  // 경로 연결성 확인 (BFS) -> 인접한 노드이면서 노드맨위의 병정이 플레이어의 것인지 확인
  isPathConnected(from: string, to: string, playerId: string): boolean {
    if (from === to) return true;

    const visited = new Set<string>();
    const queue = [from];
    visited.add(from);

    while (queue.length > 0) {
      const current = queue.shift()!;
      const neighbors = this.adjacencyList.get(current) || [];

      for (const neighbor of neighbors) {
        if (neighbor === to) return true;

        if (!visited.has(neighbor)) {
          const vertex = this.vertices.get(neighbor);
          // 해당지점에 병정이 있고, 그 병정이 아군이라면 bfs 계속 진행
          if (
            vertex &&
            vertex.soldiers.length > 0 &&
            vertex.soldiers[vertex.soldiers.length - 1].playerId === playerId
          ) {
            visited.add(neighbor);
            queue.push(neighbor);
          }
        }
      }
    }

    return false;
  }

  // 지점 점령자 확인
  getVertexOwner(vertexId: string): string | null {
    const vertex = this.vertices.get(vertexId);
    if (!vertex || vertex.soldiers.length === 0) return null;
    return vertex.soldiers[vertex.soldiers.length - 1].playerId;
  }

  // 플레이어 거점 확인
  getPlayerBase(playerId: string): string {
    const player = this.players.get(playerId);
    return player?.color === 'red' ? 'X' : 'Y';
  }

  // 승점 확인 및 부여
  checkAndAwardMedals(playerId: string): number {
    let totalAwarded = 0;

    for (const zone of this.medalZones) {
      if (zone.claimed) continue;

      // 해당 지역의 모든 정점을 플레이어가 점령했는지 확인
      const allOwnedByPlayer = zone.vertices.every(
        (vertexId) => this.getVertexOwner(vertexId) === playerId
      );

      if (allOwnedByPlayer) {
        zone.claimed = true;
        zone.claimedBy = playerId;
        const player = this.players.get(playerId);
        if (player) {
          player.medals += zone.points;
          totalAwarded += zone.points;
        }
      }
    }

    return totalAwarded;
  }

  // 승리 조건 확인
  checkWinCondition(): string | null {
    for (const [playerId, player] of this.players) {
      // 7점 달성
      if (player.medals >= 7) {
        return playerId;
      }

      // 상대 거점 점령
      const opponentBase = player.color === 'red' ? 'Y' : 'X';
      if (this.getVertexOwner(opponentBase) === playerId) {
        return playerId;
      }
    }

    return null;
  }

  // 턴 시작 스냅샷 생성
  createTurnSnapshot(): void {
    this.turnStartSnapshot = this.toJSON();
  }

  // 스냅샷에서 복원
  restoreFromSnapshot(): void {
    if (this.turnStartSnapshot) {
      const restored = GameState.fromJSON(this.turnStartSnapshot);
      Object.assign(this, restored);
    }
  }

  // 대기 중인 액션 설정
  setPendingAction(action: PendingAction): void {
    this.pendingAction = action;
  }

  // 대기 중인 액션 클리어
  clearPendingAction(): void {
    this.pendingAction = undefined;
  }

  // 게임 상태 JSON 직렬화
  toJSON() {
    return {
      vertices: Array.from(this.vertices.entries()),
      players: Array.from(this.players.entries()),
      currentTurn: this.currentTurn,
      turnCount: this.turnCount,
      gameStatus: this.gameStatus,
      winner: this.winner,
      medalZones: this.medalZones,
      turnStartSnapshot: this.turnStartSnapshot,
      pendingAction: this.pendingAction,
    };
  }

  // JSON에서 GameState 객체로 복원
  static fromJSON(jsonData: any): GameState {
    const gameState = new GameState();

    // Map 객체들을 복원
    gameState.vertices = new Map(jsonData.vertices || []);
    gameState.players = new Map(jsonData.players || []);

    // 기본 속성들 복원
    gameState.currentTurn = jsonData.currentTurn;
    gameState.turnCount = jsonData.turnCount || 0;
    gameState.gameStatus = jsonData.gameStatus || 'waiting';
    gameState.winner = jsonData.winner;
    gameState.medalZones = jsonData.medalZones || [];
    gameState.turnStartSnapshot = jsonData.turnStartSnapshot;
    gameState.pendingAction = jsonData.pendingAction;

    return gameState;
  }
}
