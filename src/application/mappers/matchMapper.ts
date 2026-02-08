import type { MatchResult } from '@/domain/types'

export interface MatchView {
  id: string
  homeTeamId: string
  awayTeamId: string
  played: boolean
  margin: string
  round: number
}

export const toMatchView = (match: MatchResult): MatchView => ({
  id: match.id,
  homeTeamId: match.homeTeamId,
  awayTeamId: match.awayTeamId,
  played: match.played,
  margin: match.margin,
  round: match.round,
})
