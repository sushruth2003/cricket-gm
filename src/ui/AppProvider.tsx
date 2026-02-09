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
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    createAppServices().then(setServices).catch((error) => {
      console.error('Failed to create services', error)
    })
  }, [])

  const leaguesQuery = useQuery({
    queryKey: ['league-list'],
    queryFn: async () => {
      if (!services) {
        return []
      }
      return services.listLeagues()
    },
    enabled: Boolean(services),
  })
  const leagues = leaguesQuery.data ?? []
  const resolvedActiveLeagueId = activeLeagueId ?? leagues[0]?.id ?? null

  useEffect(() => {
    if (!services) {
      return
    }
    services
      .getActiveLeagueId()
      .then((leagueId) => setActiveLeagueId(leagueId))
      .catch((error) => {
        console.error('Failed to load active league', error)
      })
  }, [services])

  const stateQuery = useQuery({
    queryKey: [...STATE_QUERY_KEY, resolvedActiveLeagueId],
    queryFn: async () => {
      if (!services) {
        return null
      }
      return services.getState(resolvedActiveLeagueId ?? undefined)
    },
    enabled: Boolean(services && resolvedActiveLeagueId),
  })

  const mutation = useMutation({
    mutationFn: async (action: () => Promise<GameState | null>) => action(),
    onSuccess: (state) => {
      if (state) {
        queryClient.setQueryData([...STATE_QUERY_KEY, resolvedActiveLeagueId], state)
      }
      queryClient.invalidateQueries({ queryKey: ['league-list'] }).catch(() => {})
    },
  })

  if (!services) {
    return <div className="boot">Booting Cricket GM...</div>
  }

  const state = stateQuery.data ?? null

  const value: AppContextValue = {
    services,
    state,
    leagues,
    activeLeagueId: resolvedActiveLeagueId,
    loading: stateQuery.isLoading || leaguesQuery.isLoading,
    saving: mutation.isPending,
    progressText,
    actions: {
      createOrLoadLeague: async () => {
        await mutation.mutateAsync(async () => services.initialize())
        const nextActiveLeagueId = await services.getActiveLeagueId()
        setActiveLeagueId(nextActiveLeagueId)
      },
      createLeague: async (name?: string) => {
        await mutation.mutateAsync(async () => services.createLeague({ name }))
        const nextActiveLeagueId = await services.getActiveLeagueId()
        setActiveLeagueId(nextActiveLeagueId)
      },
      selectLeague: async (leagueId: string) => {
        await mutation.mutateAsync(async () => services.selectLeague(leagueId))
        setActiveLeagueId(leagueId)
      },
      runAuction: async () => {
        await mutation.mutateAsync(async () => services.runAuction(resolvedActiveLeagueId ?? undefined))
      },
      auctionBid: async () => {
        await mutation.mutateAsync(async () => services.auctionBid(resolvedActiveLeagueId ?? undefined))
      },
      auctionPass: async () => {
        await mutation.mutateAsync(async () => services.auctionPass(resolvedActiveLeagueId ?? undefined))
      },
      auctionAuto: async () => {
        await mutation.mutateAsync(async () => services.auctionAuto(resolvedActiveLeagueId ?? undefined))
      },
      startSeason: async () => {
        await mutation.mutateAsync(async () => services.startSeason(resolvedActiveLeagueId ?? undefined))
      },
      simulateMatch: async () => {
        await mutation.mutateAsync(async () => services.simulateOneMatch(resolvedActiveLeagueId ?? undefined))
      },
      simulateSeason: async () => {
        const abortController = new AbortController()
        await mutation.mutateAsync(async () => {
          const next = await services.simulateSeasonWithWorker({
            leagueId: resolvedActiveLeagueId ?? undefined,
            signal: abortController.signal,
            onProgress: (nextState, completed, total) => {
              queryClient.setQueryData([...STATE_QUERY_KEY, resolvedActiveLeagueId], nextState)
              setProgressText(`Simulating season: ${completed}/${total} matches`)
            },
          })
          setProgressText('')
          return next
        })
      },
      updateTeamSetup: async (input) => {
        await mutation.mutateAsync(async () => services.updateUserTeamSetup(input, resolvedActiveLeagueId ?? undefined))
      },
      advanceSeason: async () => {
        await mutation.mutateAsync(async () => services.advanceSeason(resolvedActiveLeagueId ?? undefined))
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
