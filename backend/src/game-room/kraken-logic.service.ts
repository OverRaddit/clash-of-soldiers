import { Injectable } from '@nestjs/common';
import {
  KrakenGameState,
  KrakenPlayer,
  KrakenCard,
  KrakenCardType,
  KrakenRole,
  RevealedCard,
  ChatMessage,
} from './entities/kraken-game-state.entity';

// Role/card distribution table from rulebook
const GAME_CONFIG: Record<number, { explorers: number; skeletons: number; empty: number; treasure: number; kraken: number }> = {
  3: { explorers: 3, skeletons: 2, empty: 11, treasure: 3, kraken: 1 },
  4: { explorers: 3, skeletons: 2, empty: 15, treasure: 4, kraken: 1 },
  5: { explorers: 4, skeletons: 2, empty: 19, treasure: 5, kraken: 1 },
  6: { explorers: 4, skeletons: 2, empty: 23, treasure: 6, kraken: 1 },
  7: { explorers: 5, skeletons: 3, empty: 27, treasure: 7, kraken: 1 },
  8: { explorers: 6, skeletons: 3, empty: 31, treasure: 8, kraken: 1 },
};

interface RevealResult {
  cardType: KrakenCardType;
  gameEnded: boolean;
  message: string;
}

interface WinResult {
  winner: 'explorers' | 'skeletons' | 'all-lose';
  reason: string;
}

@Injectable()
export class KrakenLogicService {

  // --- Game Initialization ---
  initializeGame(playerIds: string[], playerNames: string[]): KrakenGameState {
    const playerCount = playerIds.length;
    const config = GAME_CONFIG[playerCount];
    if (!config) {
      throw new Error(`${playerCount}명은 지원하지 않는 인원입니다. (3~8명)`);
    }

    const state = new KrakenGameState();
    state.totalActionsPerRound = playerCount;

    // 1. Assign roles
    const roles = this.assignRoles(playerCount, config);
    state.allRoles = [...roles.allRoles]; // Keep all roles for game-end reveal

    // 2. Create exploration card deck
    const deck = this.createDeck(config);
    this.shuffle(deck);

    // 3. Distribute 5 cards to each player
    const playerOrder = [...playerIds];
    this.shuffle(playerOrder);
    state.playerOrder = playerOrder;

    for (let i = 0; i < playerCount; i++) {
      const playerId = playerOrder[i];
      const playerName = playerNames[playerIds.indexOf(playerId)];
      const playerCards = deck.splice(0, 5);

      // Record known card types (unordered composition)
      const knownCardTypes = playerCards.map(c => c.type);
      // Sort for display consistency
      knownCardTypes.sort();

      const player: KrakenPlayer = {
        id: playerId,
        name: playerName,
        role: roles.playerRoles[i],
        cards: playerCards,
        knownCardTypes,
      };

      state.players.set(playerId, player);
    }

    // 4. First player gets action marker (random - first in shuffled order)
    state.actionMarkerHolder = playerOrder[0];
    state.gamePhase = 'selecting';
    state.currentRound = 1;
    state.actionsThisRound = 0;

    // System message
    state.chatMessages.push({
      id: this.generateId(),
      playerId: 'system',
      playerName: '시스템',
      text: `게임이 시작되었습니다! ${state.players.get(state.actionMarkerHolder)?.name}님이 첫 번째 액션을 진행합니다.`,
      timestamp: Date.now(),
      isSystem: true,
    });

    return state;
  }

  private assignRoles(playerCount: number, config: { explorers: number; skeletons: number }): { playerRoles: KrakenRole[]; allRoles: KrakenRole[] } {
    // Create role cards (more than player count as per rules)
    const allRoles: KrakenRole[] = [
      ...Array(config.explorers).fill('explorer'),
      ...Array(config.skeletons).fill('skeleton'),
    ];
    this.shuffle(allRoles);

    // Deal one to each player, rest are unknown
    const playerRoles = allRoles.slice(0, playerCount);
    return { playerRoles, allRoles };
  }

  private createDeck(config: { empty: number; treasure: number; kraken: number }): KrakenCard[] {
    const deck: KrakenCard[] = [];

    for (let i = 0; i < config.empty; i++) {
      deck.push({ id: this.generateId(), type: 'empty' });
    }
    for (let i = 0; i < config.treasure; i++) {
      deck.push({ id: this.generateId(), type: 'treasure' });
    }
    for (let i = 0; i < config.kraken; i++) {
      deck.push({ id: this.generateId(), type: 'kraken' });
    }

    return deck;
  }

  // --- Actions ---

  selectCard(state: KrakenGameState, actingPlayerId: string, targetPlayerId: string, cardIndex: number): void {
    if (state.actionMarkerHolder !== actingPlayerId) {
      throw new Error('액션 마커를 가지고 있지 않습니다.');
    }
    if (state.gamePhase !== 'selecting' && state.gamePhase !== 'discussing') {
      throw new Error('현재 카드를 선택할 수 없는 단계입니다.');
    }
    if (actingPlayerId === targetPlayerId) {
      throw new Error('자신의 카드는 선택할 수 없습니다.');
    }

    const targetPlayer = state.players.get(targetPlayerId);
    if (!targetPlayer) {
      throw new Error('대상 플레이어를 찾을 수 없습니다.');
    }
    if (cardIndex < 0 || cardIndex >= targetPlayer.cards.length) {
      throw new Error('잘못된 카드 인덱스입니다.');
    }

    state.selectedCard = { targetPlayerId, cardIndex };
    state.gamePhase = 'discussing';
  }

  changeSelection(state: KrakenGameState, actingPlayerId: string, targetPlayerId: string, cardIndex: number): void {
    // Same validation as selectCard
    this.selectCard(state, actingPlayerId, targetPlayerId, cardIndex);
  }

  confirmReveal(state: KrakenGameState, actingPlayerId: string): RevealResult {
    if (state.actionMarkerHolder !== actingPlayerId) {
      throw new Error('액션 마커를 가지고 있지 않습니다.');
    }
    if (state.gamePhase !== 'discussing') {
      throw new Error('확정할 수 없는 단계입니다.');
    }
    if (!state.selectedCard) {
      throw new Error('선택된 카드가 없습니다.');
    }

    const { targetPlayerId, cardIndex } = state.selectedCard;
    const targetPlayer = state.players.get(targetPlayerId);
    if (!targetPlayer) {
      throw new Error('대상 플레이어를 찾을 수 없습니다.');
    }

    // Reveal the card
    const revealedCard = targetPlayer.cards[cardIndex];
    const cardType = revealedCard.type;

    // Remove card from player's hand
    targetPlayer.cards.splice(cardIndex, 1);

    // Update known card types
    const typeIndex = targetPlayer.knownCardTypes.indexOf(cardType);
    if (typeIndex !== -1) {
      targetPlayer.knownCardTypes.splice(typeIndex, 1);
    }

    // Add to revealed cards (public info)
    const revealedInfo: RevealedCard = {
      cardType,
      revealedBy: actingPlayerId,
      revealedFrom: targetPlayerId,
      round: state.currentRound,
    };
    state.revealedCards.push(revealedInfo);

    state.actionsThisRound++;
    state.selectedCard = undefined;

    // System chat
    const actingPlayer = state.players.get(actingPlayerId);
    const cardTypeName = this.getCardTypeName(cardType);
    state.chatMessages.push({
      id: this.generateId(),
      playerId: 'system',
      playerName: '시스템',
      text: `${actingPlayer?.name}님이 ${targetPlayer.name}님의 카드를 공개했습니다: ${cardTypeName}`,
      timestamp: Date.now(),
      isSystem: true,
    });

    // Check win condition
    const winResult = this.checkWinCondition(state);
    if (winResult) {
      state.gamePhase = 'finished';
      state.winner = winResult.winner;
      state.winReason = winResult.reason;
      return {
        cardType,
        gameEnded: true,
        message: `${cardTypeName} 공개! ${winResult.reason}`,
      };
    }

    // Check if round is over
    if (state.actionsThisRound >= state.totalActionsPerRound) {
      // Round end
      this.endRound(state);
      return {
        cardType,
        gameEnded: false,
        message: `${cardTypeName} 공개! 라운드 ${state.currentRound - 1} 종료. 카드가 재분배되었습니다.`,
      };
    }

    // Move action marker to the target player
    state.actionMarkerHolder = targetPlayerId;
    state.gamePhase = 'selecting';

    return {
      cardType,
      gameEnded: false,
      message: `${cardTypeName} 공개! ${targetPlayer.name}님이 다음 액션을 진행합니다.`,
    };
  }

  // --- Round Management ---

  endRound(state: KrakenGameState): void {
    // Check if it's the 4th round ending
    if (state.currentRound >= 4) {
      const winResult = this.checkWinCondition(state);
      if (winResult) {
        state.gamePhase = 'finished';
        state.winner = winResult.winner;
        state.winReason = winResult.reason;
        return;
      }
      // If no win condition yet but 4 rounds done, skeletons win
      state.gamePhase = 'finished';
      state.winner = 'skeletons';
      state.winReason = '4라운드가 종료되어 스켈레톤이 승리합니다!';
      return;
    }

    // Collect remaining cards from all players
    const remainingCards: KrakenCard[] = [];
    for (const player of state.players.values()) {
      remainingCards.push(...player.cards);
      player.cards = [];
      player.knownCardTypes = [];
    }

    // Shuffle remaining cards
    this.shuffle(remainingCards);

    // Distribute evenly
    const players = Array.from(state.players.values());
    const cardsPerPlayer = Math.floor(remainingCards.length / players.length);
    let extraCards = remainingCards.length % players.length;

    let cardIdx = 0;
    for (const player of players) {
      const count = cardsPerPlayer + (extraCards > 0 ? 1 : 0);
      if (extraCards > 0) extraCards--;
      player.cards = remainingCards.slice(cardIdx, cardIdx + count);
      cardIdx += count;

      // Update known card types (composition only, not positions)
      player.knownCardTypes = player.cards.map(c => c.type).sort();
    }

    // Advance round
    state.currentRound++;
    state.actionsThisRound = 0;
    state.gamePhase = 'selecting';
    // Action marker holder stays the same (current holder starts new round)

    state.chatMessages.push({
      id: this.generateId(),
      playerId: 'system',
      playerName: '시스템',
      text: `라운드 ${state.currentRound}이 시작되었습니다! 카드가 재분배되었습니다. ${state.players.get(state.actionMarkerHolder)?.name}님이 첫 번째 액션을 진행합니다.`,
      timestamp: Date.now(),
      isSystem: true,
    });
  }

  // --- Win Conditions ---

  checkWinCondition(state: KrakenGameState): WinResult | null {
    const playerCount = state.players.size;
    const config = GAME_CONFIG[playerCount];

    // Count revealed treasures and check for kraken
    let revealedTreasures = 0;
    let krakenRevealed = false;

    for (const card of state.revealedCards) {
      if (card.cardType === 'treasure') revealedTreasures++;
      if (card.cardType === 'kraken') krakenRevealed = true;
    }

    // All treasures revealed → Explorers win
    if (revealedTreasures >= config.treasure) {
      return { winner: 'explorers', reason: '보물을 모두 찾았습니다! 탐험대 승리!' };
    }

    // Kraken revealed
    if (krakenRevealed) {
      // Special 3-player rule: if all 3 are explorers, everyone loses
      if (playerCount === 3) {
        const allExplorers = Array.from(state.players.values()).every(p => p.role === 'explorer');
        if (allExplorers) {
          return { winner: 'all-lose', reason: '전원 탐험대인데 크라켄이 공개되어 모두 패배합니다!' };
        }
      }
      return { winner: 'skeletons', reason: '크라켄이 깨어났습니다! 스켈레톤 승리!' };
    }

    // 4th round ended (checked when actionsThisRound >= totalActionsPerRound at round 4)
    if (state.currentRound >= 4 && state.actionsThisRound >= state.totalActionsPerRound) {
      return { winner: 'skeletons', reason: '4라운드가 종료되어 스켈레톤이 승리합니다!' };
    }

    return null;
  }

  // --- Player View (Information Hiding) ---

  getPlayerView(state: KrakenGameState, viewingPlayerId: string): any {
    const viewingPlayer = state.players.get(viewingPlayerId);
    if (!viewingPlayer) {
      throw new Error('플레이어를 찾을 수 없습니다.');
    }

    const isGameFinished = state.gamePhase === 'finished';

    // Build other players' info (card count only)
    const otherPlayers = Array.from(state.players.entries())
      .filter(([id]) => id !== viewingPlayerId)
      .map(([id, player]) => ({
        id: player.id,
        name: player.name,
        cardCount: player.cards.length,
        // Only reveal roles at game end
        ...(isGameFinished ? { role: player.role } : {}),
      }));

    return {
      myRole: viewingPlayer.role,
      myKnownCardTypes: viewingPlayer.knownCardTypes,
      myCardCount: viewingPlayer.cards.length,
      otherPlayers,
      revealedCards: state.revealedCards,
      currentRound: state.currentRound,
      actionsThisRound: state.actionsThisRound,
      totalActionsPerRound: state.totalActionsPerRound,
      actionMarkerHolder: state.actionMarkerHolder,
      gamePhase: state.gamePhase,
      selectedCard: state.selectedCard,
      chatMessages: state.chatMessages,
      winner: state.winner,
      winReason: state.winReason,
      // At game end, reveal all roles
      ...(isGameFinished ? {
        allPlayersWithRoles: Array.from(state.players.entries()).map(([id, p]) => ({
          id: p.id,
          name: p.name,
          role: p.role,
        })),
      } : {}),
    };
  }

  // --- Chat ---

  addChatMessage(state: KrakenGameState, playerId: string, text: string): ChatMessage {
    const player = state.players.get(playerId);
    if (!player) {
      throw new Error('플레이어를 찾을 수 없습니다.');
    }

    const msg: ChatMessage = {
      id: this.generateId(),
      playerId,
      playerName: player.name,
      text,
      timestamp: Date.now(),
      isSystem: false,
    };
    state.chatMessages.push(msg);
    return msg;
  }

  // --- Serialization helper ---

  deserializeState(data: any): KrakenGameState {
    return KrakenGameState.fromJSON(data);
  }

  // --- Utility ---

  private shuffle<T>(array: T[]): void {
    for (let i = array.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [array[i], array[j]] = [array[j], array[i]];
    }
  }

  private generateId(): string {
    return Math.random().toString(36).substring(2, 10);
  }

  private getCardTypeName(type: KrakenCardType): string {
    switch (type) {
      case 'empty': return '빈 상자';
      case 'treasure': return '보물 상자';
      case 'kraken': return '크라켄';
      default: return type;
    }
  }
}
