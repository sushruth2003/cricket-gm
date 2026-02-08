import type { Player, StatLine } from '@/domain/types'

export interface StatView {
  playerId: string
  playerName: string
  runs: number
  wickets: number
  strikeRate: number
}

export const toStatView = (stats: Record<string, StatLine>, players: Player[]): StatView[] => {
  const playerById = new Map(players.map((player) => [player.id, `${player.firstName} ${player.lastName}`]))

  return Object.values(stats)
    .map((line) => ({
      playerId: line.playerId,
      playerName: playerById.get(line.playerId) ?? line.playerId,
      runs: line.runs,
      wickets: line.wickets,
      strikeRate: line.balls === 0 ? 0 : Number(((line.runs / line.balls) * 100).toFixed(2)),
    }))
    .sort((a, b) => b.runs - a.runs)
}
