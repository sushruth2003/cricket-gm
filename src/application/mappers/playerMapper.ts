import type { Player } from '@/domain/types'

export interface PlayerView {
  id: string
  name: string
  role: string
  battingOverall: number
  bowlingOverall: number
  teamId: string | null
}

export const toPlayerView = (player: Player): PlayerView => ({
  id: player.id,
  name: `${player.firstName} ${player.lastName}`,
  role: player.role,
  battingOverall: player.ratings.batting.overall,
  bowlingOverall: player.ratings.bowling.overall,
  teamId: player.teamId,
})
