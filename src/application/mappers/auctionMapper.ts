import type { AuctionState, Player, Team } from '@/domain/types'

export interface AuctionEntryView {
  playerId: string
  playerName: string
  phase: string
  status: string
  basePrice: number
  lastSeasonMatches: number
  lastSeasonRuns: number
  lastSeasonWickets: number
  lastSeasonStrikeRate: number
  lastSeasonEconomy: number
  soldToTeam: string | null
  finalPrice: number
}

export const toAuctionView = (auction: AuctionState, players: Player[], teams: Team[]): AuctionEntryView[] => {
  const playerById = new Map(players.map((player) => [player.id, player]))
  const teamById = new Map(teams.map((team) => [team.id, team]))

  return auction.entries.map((entry) => {
    const player = playerById.get(entry.playerId)
    return {
      playerId: entry.playerId,
      playerName: player ? `${player.firstName} ${player.lastName}` : entry.playerId,
      phase: entry.phase,
      status: entry.status,
      basePrice: player?.basePrice ?? 0,
      lastSeasonMatches: player?.lastSeasonStats.matches ?? 0,
      lastSeasonRuns: player?.lastSeasonStats.runs ?? 0,
      lastSeasonWickets: player?.lastSeasonStats.wickets ?? 0,
      lastSeasonStrikeRate: player?.lastSeasonStats.strikeRate ?? 0,
      lastSeasonEconomy: player?.lastSeasonStats.economy ?? 0,
      soldToTeam: entry.soldToTeamId ? teamById.get(entry.soldToTeamId)?.name ?? entry.soldToTeamId : null,
      finalPrice: entry.finalPrice,
    }
  })
}
