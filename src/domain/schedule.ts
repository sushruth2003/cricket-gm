import type { MatchResult, Team } from '@/domain/types'

export const generateRoundRobinFixtures = (teams: Team[]): MatchResult[] => {
  const fixtures: MatchResult[] = []
  let round = 1

  for (let i = 0; i < teams.length; i += 1) {
    for (let j = i + 1; j < teams.length; j += 1) {
      fixtures.push({
        id: `match-${round}`,
        homeTeamId: teams[i].id,
        awayTeamId: teams[j].id,
        venue: `${teams[i].city} Oval`,
        round,
        played: false,
        winnerTeamId: null,
        margin: '',
        innings: null,
      })
      round += 1
    }
  }

  return fixtures
}
