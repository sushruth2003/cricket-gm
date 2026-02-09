import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useEffect, useMemo, useState } from 'react'
import { toAuctionView } from '@/application/mappers/auctionMapper'
import { toMatchView } from '@/application/mappers/matchMapper'
import { toPlayerView } from '@/application/mappers/playerMapper'
import { toStatView } from '@/application/mappers/statsMapper'
import { toTeamView } from '@/application/mappers/teamMapper'
import { createAppServices, type AppServices, type LeagueSummary } from '@/application/services'
import type { GameState } from '@/domain/types'
import { AppContext, type AppContextValue } from '@/ui/AppContext'
import { getStateQueryKey, LEAGUE_LIST_QUERY_KEY } from '@/ui/queryKeys'

const FALLBACK_LEAGUE_ID = 'league-primary'

const getErrorMessage = (context: string, error: unknown): string => {
  if (error instanceof Error && error.message) {
    return `${context}: ${error.message}`
  }
  return `${context}: unexpected error`
}

const buildFallbackLeague = (state: GameState, leagueId: string): LeagueSummary => ({
  id: leagueId,
  name: 'League 1',
  activeSeasonId: 'season-1',
  seasonIds: ['season-1'],
  createdAt: state.metadata.createdAt,
  updatedAt: state.metadata.updatedAt,
})

export const AppProvider = ({
  children,
  servicesFactory = createAppServices,
}: {
  children: React.ReactNode
  servicesFactory?: () => Promise<AppServices>
}) => {
  const [services, setServices] = useState<AppServices | null>(null)
  const [activeLeagueId, setActiveLeagueId] = useState<string | null>(null)
  const [switchingLeagueId, setSwitchingLeagueId] = useState<string | null>(null)
  const [progressText, setProgressText] = useState('')
  const [errorMessage, setErrorMessage] = useState<string | null>(null)
  const queryClient = useQueryClient()

  useEffect(() => {
    servicesFactory()
      .then(setServices)
      .catch((error) => {
        setErrorMessage(getErrorMessage('Failed to create services', error))
        console.error('Failed to create services', error)
      })
  }, [servicesFactory])

  useEffect(() => {
    if (!services) {
      return
    }
    let cancelled = false

    const bootstrapActiveLeague = async () => {
      try {
        const nextActive = (await services.getActiveLeagueId?.()) ?? FALLBACK_LEAGUE_ID
        if (!cancelled) {
          setActiveLeagueId(nextActive)
        }
      } catch (error) {
        if (!cancelled) {
          setActiveLeagueId(FALLBACK_LEAGUE_ID)
          setErrorMessage(getErrorMessage('Failed to resolve active league', error))
        }
      }
    }

    void bootstrapActiveLeague()

    return () => {
      cancelled = true
    }
  }, [services])

  const leaguesQuery = useQuery({
    queryKey: LEAGUE_LIST_QUERY_KEY,
    queryFn: async () => {
      if (!services) {
        return [] as LeagueSummary[]
      }
      if (services.listLeagues) {
        return services.listLeagues()
      }
      const state = await services.getState()
      if (!state) {
        return [] as LeagueSummary[]
      }
      return [buildFallbackLeague(state, activeLeagueId ?? FALLBACK_LEAGUE_ID)]
    },
    enabled: Boolean(services),
  })

  const leagues = useMemo(() => leaguesQuery.data ?? [], [leaguesQuery.data])

  const resolvedActiveLeagueId = useMemo(() => {
    if (leagues.length === 0) {
      return null
    }
    if (!activeLeagueId) {
      return leagues[0].id
    }
    return leagues.some((league) => league.id === activeLeagueId) ? activeLeagueId : leagues[0].id
  }, [activeLeagueId, leagues])

  const derivedContextError = useMemo(() => {
    if (errorMessage) {
      return errorMessage
    }
    if (!activeLeagueId || leagues.length === 0) {
      return null
    }
    const activeLeagueExists = leagues.some((league) => league.id === activeLeagueId)
    if (activeLeagueExists) {
      return null
    }
    return `Active league "${activeLeagueId}" is unavailable. Showing "${leagues[0].name}".`
  }, [activeLeagueId, errorMessage, leagues])

  const stateQuery = useQuery({
    queryKey: getStateQueryKey(resolvedActiveLeagueId),
    queryFn: async () => {
      if (!services || !resolvedActiveLeagueId) {
        return null
      }
      if (services.selectLeague) {
        await services.selectLeague(resolvedActiveLeagueId)
      }
      return services.getState(resolvedActiveLeagueId)
    },
    enabled: Boolean(services && resolvedActiveLeagueId),
  })

  const mutation = useMutation({
    mutationFn: async (action: { run: () => Promise<GameState | null>; leagueId: string | null }) => action.run(),
    onSuccess: (state, variables) => {
      if (state) {
        queryClient.setQueryData(getStateQueryKey(variables.leagueId), state)
      }
    },
  })

  const runStateMutation = async ({
    run,
    leagueId = resolvedActiveLeagueId,
    failureContext,
  }: {
    run: () => Promise<GameState | null>
    leagueId?: string | null
    failureContext: string
  }) => {
    setErrorMessage(null)
    try {
      return await mutation.mutateAsync({ run, leagueId: leagueId ?? null })
    } catch (error) {
      setErrorMessage(getErrorMessage(failureContext, error))
      return null
    }
  }

  const actions: AppContextValue['actions'] = {
    createOrLoadLeague: async () => {
      if (!services) {
        return
      }
      if (leagues.length === 0) {
        await actions.createLeague()
        return
      }
      if (resolvedActiveLeagueId && services.selectLeague) {
        await actions.selectLeague(resolvedActiveLeagueId)
        return
      }
      await runStateMutation({
        run: async () => services.initialize(),
        failureContext: 'Unable to initialize league',
      })
    },
    createLeague: async (input) => {
      if (!services) {
        return
      }

      if (!services.createLeague) {
        const nextState = await runStateMutation({
          run: async () => services.initialize(input?.seed),
          leagueId: resolvedActiveLeagueId ?? FALLBACK_LEAGUE_ID,
          failureContext: 'Unable to create league',
        })
        if (nextState && !resolvedActiveLeagueId) {
          setActiveLeagueId(FALLBACK_LEAGUE_ID)
        }
        await queryClient.invalidateQueries({ queryKey: LEAGUE_LIST_QUERY_KEY })
        return
      }

      setErrorMessage(null)
      try {
        const created = await services.createLeague(input)
        setActiveLeagueId(created.league.id)
        queryClient.setQueryData(getStateQueryKey(created.league.id), created.state)
        await queryClient.invalidateQueries({ queryKey: LEAGUE_LIST_QUERY_KEY })
      } catch (error) {
        setErrorMessage(getErrorMessage('Unable to create league', error))
      }
    },
    selectLeague: async (leagueId: string) => {
      if (!services) {
        return
      }
      if (leagueId === resolvedActiveLeagueId) {
        return
      }
      if (!services.selectLeague) {
        setErrorMessage('League switching is not supported by current services.')
        return
      }

      setSwitchingLeagueId(leagueId)
      const nextState = await runStateMutation({
        run: async () => services.selectLeague!(leagueId),
        leagueId,
        failureContext: `Unable to switch to league ${leagueId}`,
      })

      if (nextState) {
        setActiveLeagueId(leagueId)
      }
      setSwitchingLeagueId(null)
    },
    loadLeagues: async () => {
      setErrorMessage(null)
      try {
        await leaguesQuery.refetch()
      } catch (error) {
        setErrorMessage(getErrorMessage('Unable to load leagues', error))
      }
    },
    runAuction: async () => {
      if (!services) {
        return
      }
      await runStateMutation({
        run: async () => services.runAuction(),
        failureContext: 'Unable to run auction',
      })
    },
    auctionBid: async () => {
      if (!services) {
        return
      }
      await runStateMutation({
        run: async () => services.auctionBid(),
        failureContext: 'Unable to place auction bid',
      })
    },
    auctionPass: async () => {
      if (!services) {
        return
      }
      await runStateMutation({
        run: async () => services.auctionPass(),
        failureContext: 'Unable to pass auction bid',
      })
    },
    auctionAuto: async () => {
      if (!services) {
        return
      }
      await runStateMutation({
        run: async () => services.auctionAuto(),
        failureContext: 'Unable to auto-progress auction',
      })
    },
    simulateMatch: async () => {
      if (!services) {
        return
      }
      await runStateMutation({
        run: async () => services.simulateOneMatch(),
        failureContext: 'Unable to simulate next match',
      })
    },
    simulateSeason: async () => {
      if (!services || !resolvedActiveLeagueId) {
        return
      }

      const abortController = new AbortController()
      const targetLeagueId = resolvedActiveLeagueId
      const nextState = await runStateMutation({
        leagueId: targetLeagueId,
        failureContext: 'Unable to simulate season',
        run: async () => {
          const next = await services.simulateSeasonWithWorker({
            signal: abortController.signal,
            onProgress: (progressState, completed, total) => {
              queryClient.setQueryData(getStateQueryKey(targetLeagueId), progressState)
              setProgressText(`Simulating season: ${completed}/${total} matches`)
            },
          })
          return next
        },
      })

      if (nextState) {
        setProgressText('')
      }
    },
    updateTeamSetup: async (input) => {
      if (!services) {
        return
      }
      await runStateMutation({
        run: async () => services.updateUserTeamSetup(input),
        failureContext: 'Unable to update team setup',
      })
    },
    exportSave: async () => {
      if (!services) {
        return ''
      }
      return services.exportSave()
    },
    importSave: async (raw) => {
      if (!services) {
        return
      }
      const imported = await runStateMutation({
        run: async () => services.importSave(raw),
        failureContext: 'Unable to import save',
      })
      if (imported) {
        await queryClient.invalidateQueries({ queryKey: LEAGUE_LIST_QUERY_KEY })
      }
    },
  }

  if (!services) {
    return <div className="boot">Booting Cricket GM...</div>
  }

  const state = stateQuery.data ?? null

  const value: AppContextValue = {
    services,
    leagues,
    activeLeagueId: resolvedActiveLeagueId,
    state,
    loading: stateQuery.isLoading || leaguesQuery.isLoading,
    switchingLeague: switchingLeagueId !== null,
    saving: mutation.isPending,
    progressText,
    errorMessage: derivedContextError,
    actions,
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
