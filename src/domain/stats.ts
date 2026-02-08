import type { GameState, MatchResult, StatLine } from '@/domain/types'

const emptyLine = (playerId: string): StatLine => ({
  playerId,
  matches: 0,
  runs: 0,
  balls: 0,
  wickets: 0,
  overs: 0,
  runsConceded: 0,
})

const ensureLine = (stats: Record<string, StatLine>, playerId: string): StatLine => {
  if (!stats[playerId]) {
    stats[playerId] = emptyLine(playerId)
  }

  return stats[playerId]
}

export const applyMatchToStats = (state: GameState, match: MatchResult): void => {
  if (!match.innings) {
    return
  }

  for (const innings of match.innings) {
    for (const battingLine of innings.batting) {
      const line = ensureLine(state.stats, battingLine.playerId)
      line.matches += 1
      line.runs += battingLine.runs
      line.balls += battingLine.balls
    }

    for (const bowlingLine of innings.bowling) {
      const line = ensureLine(state.stats, bowlingLine.playerId)
      line.overs += bowlingLine.overs
      line.wickets += bowlingLine.wickets
      line.runsConceded += bowlingLine.runsConceded
    }
  }
}

export const rebuildStats = (state: GameState): Record<string, StatLine> => {
  const nextStats: Record<string, StatLine> = {}

  for (const match of state.fixtures) {
    if (!match.played || !match.innings) {
      continue
    }

    for (const innings of match.innings) {
      for (const battingLine of innings.batting) {
        const line = ensureLine(nextStats, battingLine.playerId)
        line.matches += 1
        line.runs += battingLine.runs
        line.balls += battingLine.balls
      }

      for (const bowlingLine of innings.bowling) {
        const line = ensureLine(nextStats, bowlingLine.playerId)
        line.overs += bowlingLine.overs
        line.wickets += bowlingLine.wickets
        line.runsConceded += bowlingLine.runsConceded
      }
    }
  }

  return nextStats
}
