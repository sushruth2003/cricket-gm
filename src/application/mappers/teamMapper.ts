import type { Team } from '@/domain/types'

export interface TeamView {
  id: string
  name: string
  shortName: string
  points: number
  wins: number
  losses: number
  budgetRemaining: number
}

export const toTeamView = (team: Team): TeamView => ({
  id: team.id,
  name: team.name,
  shortName: team.shortName,
  points: team.points,
  wins: team.wins,
  losses: team.losses,
  budgetRemaining: team.budgetRemaining,
})
