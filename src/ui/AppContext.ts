import { createContext } from 'react'
import type { AppServices } from '@/application/services'
import type { toAuctionView } from '@/application/mappers/auctionMapper'
import type { toMatchView } from '@/application/mappers/matchMapper'
import type { toPlayerView } from '@/application/mappers/playerMapper'
import type { toStatView } from '@/application/mappers/statsMapper'
import type { toTeamView } from '@/application/mappers/teamMapper'
import type { LeagueSummary } from '@/application/services'
import type { GameState } from '@/domain/types'

export interface AppContextValue {
  services: AppServices
  leagues: LeagueSummary[]
  activeLeagueId: string | null
  state: GameState | null
  loading: boolean
  switchingLeague: boolean
  saving: boolean
  progressText: string
  errorMessage: string | null
  actions: {
    createOrLoadLeague: () => Promise<void>
    createLeague: (input?: { id?: string; name?: string; seed?: number }) => Promise<void>
    selectLeague: (leagueId: string) => Promise<void>
    loadLeagues: () => Promise<void>
    runAuction: () => Promise<void>
    auctionBid: () => Promise<void>
    auctionPass: () => Promise<void>
    auctionAuto: () => Promise<void>
    simulateMatch: () => Promise<void>
    simulateSeason: () => Promise<void>
    advanceSeason?: () => Promise<void>
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
