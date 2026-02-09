import type { AuctionEntry, GameState, Player, Team } from '@/domain/types'

export interface AuctionIndexes {
  playerById: Map<string, Player>
  teamById: Map<string, Team>
  entryByPlayerId: Map<string, AuctionEntry>
  overseasCountByTeamId: Map<string, number>
}

const isOverseas = (player: Player): boolean => player.countryTag !== 'IN'

export const buildAuctionIndexes = (state: GameState): AuctionIndexes => {
  const playerById = new Map(state.players.map((player) => [player.id, player]))
  const teamById = new Map(state.teams.map((team) => [team.id, team]))
  const entryByPlayerId = new Map(state.auction.entries.map((entry) => [entry.playerId, entry]))

  const overseasCountByTeamId = new Map<string, number>()
  for (const team of state.teams) {
    const overseasCount = team.rosterPlayerIds.reduce((count, playerId) => {
      const player = playerById.get(playerId)
      return player && isOverseas(player) ? count + 1 : count
    }, 0)
    overseasCountByTeamId.set(team.id, overseasCount)
  }

  return {
    playerById,
    teamById,
    entryByPlayerId,
    overseasCountByTeamId,
  }
}

export const getOverseasCount = (indexes: AuctionIndexes, teamId: string): number => {
  return indexes.overseasCountByTeamId.get(teamId) ?? 0
}

export const incrementOverseasCountIfNeeded = (indexes: AuctionIndexes, teamId: string, player: Player) => {
  if (!isOverseas(player)) {
    return
  }
  indexes.overseasCountByTeamId.set(teamId, getOverseasCount(indexes, teamId) + 1)
}
