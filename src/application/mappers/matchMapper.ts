import type { MatchResult } from '@/domain/types'

export interface MatchView {
  id: string
  homeTeamId: string
  awayTeamId: string
  scheduledAt?: string
  played: boolean
  margin: string
  round: number
}

export const toMatchView = (match: MatchResult): MatchView => ({
  id: match.id,
  homeTeamId: match.homeTeamId,
  awayTeamId: match.awayTeamId,
  scheduledAt: match.scheduledAt,
  played: match.played,
  margin: match.margin,
  round: match.round,
})
