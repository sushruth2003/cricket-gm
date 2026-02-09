import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useState } from 'react'
import { toAuctionView } from '@/application/mappers/auctionMapper'
import { toMatchView } from '@/application/mappers/matchMapper'
import { toPlayerView } from '@/application/mappers/playerMapper'
import { toStatView } from '@/application/mappers/statsMapper'
import { toTeamView } from '@/application/mappers/teamMapper'
import { createAppServices, type AppServices } from '@/application/services'
import type { GameState } from '@/domain/types'
import { AppContext, type AppContextValue } from '@/ui/AppContext'

const STATE_QUERY_KEY = ['game-state']

export const AppProvider = ({ children }: { children: React.ReactNode }) => {
  const [services, setServices] = useState<AppServices | null>(null)
  const [progressText, setProgressText] = useState('')
  const queryClient = useQueryClient()

  useEffect(() => {
    createAppServices().then(setServices).catch((error) => {
      console.error('Failed to create services', error)
    })
  }, [])

  const stateQuery = useQuery({
    queryKey: STATE_QUERY_KEY,
    queryFn: async () => {
      if (!services) {
        return null
      }
      return services.getState()
    },
    enabled: Boolean(services),
  })

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<GameState | null>) => action(),
    onSuccess: (state) => {
      if (state) {
        queryClient.setQueryData(STATE_QUERY_KEY, state)
      }
    },
  })

  if (!services) {
    return <div className="boot">Booting Cricket GM...</div>
  }

  const state = stateQuery.data ?? null

  const value: AppContextValue = {
    services,
    state,
    loading: stateQuery.isLoading,
    saving: mutation.isPending,
    progressText,
    actions: {
      createOrLoadLeague: async () => {
        await mutation.mutateAsync(async () => services.initialize())
      },
      runAuction: async () => {
        await mutation.mutateAsync(async () => services.runAuction())
      },
      auctionBid: async () => {
        await mutation.mutateAsync(async () => services.auctionBid())
      },
      auctionPass: async () => {
        await mutation.mutateAsync(async () => services.auctionPass())
      },
      auctionAuto: async () => {
        await mutation.mutateAsync(async () => services.auctionAuto())
      },
      simulateMatch: async () => {
        await mutation.mutateAsync(async () => services.simulateOneMatch())
      },
      simulateSeason: async () => {
        const abortController = new AbortController()
        await mutation.mutateAsync(async () => {
          const next = await services.simulateSeasonWithWorker({
            signal: abortController.signal,
            onProgress: (nextState, completed, total) => {
              queryClient.setQueryData(STATE_QUERY_KEY, nextState)
              setProgressText(`Simulating season: ${completed}/${total} matches`)
            },
          })
          setProgressText('')
          return next
        })
      },
      updateTeamSetup: async (input) => {
        await mutation.mutateAsync(async () => services.updateUserTeamSetup(input))
      },
      exportSave: async () => services.exportSave(),
      importSave: async (raw) => {
        await mutation.mutateAsync(async () => services.importSave(raw))
      },
    },
    views: {
      teams: state ? state.teams.map(toTeamView).sort((a, b) => b.points - a.points || b.wins - a.wins) : [],
      players: state ? state.players.map(toPlayerView) : [],
      matches: state ? state.fixtures.map(toMatchView) : [],
      auctionEntries: state ? toAuctionView(state.auction, state.players, state.teams) : [],
      stats: state ? toStatView(state.stats, state.players) : [],
    },
  }

  return <AppContext.Provider value={value}>{children}</AppContext.Provider>
}
