import { openDB } from 'idb'
import type { GameState } from '@/domain/types'

const DB_NAME = 'cricket-gm-analytics'
const DB_VERSION = 1
const STORE_NAME = 'season-summaries'

export interface SeasonPlayerDescriptor {
  playerId: string
  teamId: string | null
  role: GameState['players'][number]['role']
  age: number | null
  ratings: {
    batting: number
    bowling: number
    fielding: number
    overall: number
  }
  performance: {
    matches: number
    runs: number
    wickets: number
    strikeRate: number
    economy: number
  }
  potentialOverall: number | null
}

export interface SeasonSummaryRecord {
  id: string
  seed: number
  startedAt: string
  completedAt: string
  players: SeasonPlayerDescriptor[]
}

const average = (values: number[]): number => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)

const toRate = (numerator: number, denominator: number, fallback: number): number => {
  if (denominator <= 0) {
    return fallback
  }
  return Number((numerator / denominator).toFixed(2))
}

export const buildSeasonSummary = (state: GameState): SeasonSummaryRecord => {
  const playerRows: SeasonPlayerDescriptor[] = state.players
    .map((player) => {
      const line = state.stats[player.id]
      const matches = line?.matches ?? 0
      const balls = line?.balls ?? 0
      const overs = line?.overs ?? 0
      const runs = line?.runs ?? 0
      const wickets = line?.wickets ?? 0
      const runsConceded = line?.runsConceded ?? 0

      const batting = player.ratings.batting.overall
      const bowling = player.ratings.bowling.overall
      const fielding = player.ratings.fielding.overall

      return {
        playerId: player.id,
        teamId: player.teamId,
        role: player.role,
        age: player.age ?? null,
        ratings: {
          batting,
          bowling,
          fielding,
          overall: average([batting, bowling, fielding]),
        },
        performance: {
          matches,
          runs,
          wickets,
          strikeRate: toRate(runs * 100, balls, 0),
          economy: toRate(runsConceded, overs, 0),
        },
        potentialOverall: player.development
          ? average([
              player.development.potential.battingOverall,
              player.development.potential.bowlingOverall,
              player.development.potential.fieldingOverall,
            ])
          : null,
      }
    })
    .filter((row) => row.teamId !== null || row.performance.matches > 0)

  return {
    id: `seed-${state.metadata.seed}-${state.metadata.createdAt.slice(0, 10)}`,
    seed: state.metadata.seed,
    startedAt: state.metadata.createdAt,
    completedAt: state.metadata.updatedAt,
    players: playerRows,
  }
}

export class SeasonSummaryStore {
  async isSupported(): Promise<boolean> {
    return typeof indexedDB !== 'undefined'
  }

  private async db() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'id' })
        }
      },
    })
  }

  async write(summary: SeasonSummaryRecord): Promise<void> {
    if (!(await this.isSupported())) {
      return
    }
    const db = await this.db()
    await db.put(STORE_NAME, summary)
  }
}
