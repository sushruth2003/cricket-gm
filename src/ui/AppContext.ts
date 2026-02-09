import { createContext } from 'react'
import type { AppServices } from '@/application/services'
import type { toAuctionView } from '@/application/mappers/auctionMapper'
import type { toMatchView } from '@/application/mappers/matchMapper'
import type { toPlayerView } from '@/application/mappers/playerMapper'
import type { toStatView } from '@/application/mappers/statsMapper'
import type { toTeamView } from '@/application/mappers/teamMapper'
import type { GameState } from '@/domain/types'
import type { LeagueSummary } from '@/application/gameRepository'

export interface AppContextValue {
  services: AppServices
  state: GameState | null
  leagues: LeagueSummary[]
  activeLeagueId: string | null
  loading: boolean
  saving: boolean
  progressText: string
  actions: {
    createOrLoadLeague: () => Promise<void>
    createLeague: (name?: string) => Promise<void>
    selectLeague: (leagueId: string) => Promise<void>
    runAuction: () => Promise<void>
    auctionBid: () => Promise<void>
    auctionPass: () => Promise<void>
    auctionAuto: () => Promise<void>
    startSeason: () => Promise<void>
    simulateMatch: () => Promise<void>
    simulateSeason: () => Promise<void>
    advanceSeason: () => Promise<void>
    updateTeamSetup: (input: {
      playingXi: string[]
      wicketkeeperPlayerId: string
      bowlingPreset: 'balanced' | 'aggressive' | 'defensive'
    }) => Promise<void>
    exportSave: () => Promise<string>
    importSave: (raw: string) => Promise<void>
  }
  views: {
    teams: ReturnType<typeof toTeamView>[]
    players: ReturnType<typeof toPlayerView>[]
    matches: ReturnType<typeof toMatchView>[]
    auctionEntries: ReturnType<typeof toAuctionView>
    stats: ReturnType<typeof toStatView>
  }
}

export const AppContext = createContext<AppContextValue | null>(null)
