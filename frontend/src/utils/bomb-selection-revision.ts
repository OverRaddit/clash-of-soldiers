import { BombBustersClientState } from '../types/bomb-busters.types';

/** Clock updates and public clue annotations must not clear a player's in-progress selection. */
export const bombSelectionRevision = (state: BombBustersClientState): string => JSON.stringify({
  mission: state.mission.id,
  phase: state.phase,
  turn: state.turnNumber,
  currentPlayer: state.currentPlayerId,
  racks: state.players.map((player) => [player.id, player.racks.map((rack) => [rack.id, rack.wires.map((wire) => [wire.id, wire.cut, wire.value, wire.reversed, wire.excluded])])]),
  detector: state.pendingDetector,
  exchange: state.pendingExchange && [state.pendingExchange.actorId, state.pendingExchange.targetPlayerId, state.pendingExchange.ownSelectedWireId],
  armed: [state.superDetectorActive, state.tripleDetectorActive, state.stabilizerActive, state.xyRayActive],
  missionPending: state.campaign?.pendingActorId,
  missionControls: state.campaign?.controls,
  audio: state.campaign?.audio && [state.campaign.audio.stepIndex, state.campaign.audio.status, state.campaign.audio.removedCutWireIds],
});
