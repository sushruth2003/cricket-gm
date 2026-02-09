import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import type { ReactNode } from 'react'
import { describe, expect, it, vi } from 'vitest'
import type { AppServices, LeagueSummary } from '@/application/services'
import { createInitialState } from '@/domain/generator'
import { AppProvider } from '@/ui/AppProvider'
import { getStateQueryKey } from '@/ui/queryKeys'
import { useApp } from '@/ui/useApp'

const buildLeagueSummary = (leagueId: string, name: string, seasonId = 'season-1'): LeagueSummary => ({
  id: leagueId,
  name,
  activeSeasonId: seasonId,
  seasonIds: [seasonId],
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
})

const buildState = (seed: number) => createInitialState(seed)

const renderWithProvider = ({ services }: { services: AppServices }) => {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  })

  const Harness = ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={queryClient}>
      <AppProvider servicesFactory={async () => services}>{children}</AppProvider>
    </QueryClientProvider>
  )

  return { queryClient, ...render(<Harness><ProviderProbe /></Harness>) }
}

const ProviderProbe = () => {
  const { state, leagues, activeLeagueId, actions } = useApp()

  return (
    <section>
      <p data-testid="active-league">{activeLeagueId ?? 'none'}</p>
      <p data-testid="league-count">{String(leagues.length)}</p>
      <p data-testid="seed">{state ? String(state.metadata.seed) : 'none'}</p>
      <button onClick={() => void actions.selectLeague('league-a')}>Switch A</button>
      <button onClick={() => void actions.selectLeague('league-b')}>Switch B</button>
      <button onClick={() => void actions.createLeague({ name: 'League C' })}>Create C</button>
    </section>
  )
}

const buildServices = () => {
  const leagueA = buildState(111)
  const leagueB = buildState(222)
  const leagueC = buildState(333)
  const stateByLeague: Record<string, ReturnType<typeof buildState>> = {
    'league-a': leagueA,
    'league-b': leagueB,
  }

  const leagues: LeagueSummary[] = [buildLeagueSummary('league-a', 'League A'), buildLeagueSummary('league-b', 'League B')]
  let activeLeagueId = 'league-a'

  const services: AppServices = {
    repository: {} as AppServices['repository'],
    getState: vi.fn(async (leagueId?: string) => stateByLeague[leagueId ?? activeLeagueId] ?? null),
    listLeagues: vi.fn(async () => leagues),
    getActiveLeagueId: vi.fn(async () => activeLeagueId),
    createLeague: vi.fn(async () => {
      stateByLeague['league-c'] = leagueC
      leagues.push(buildLeagueSummary('league-c', 'League C'))
      activeLeagueId = 'league-c'
      return { league: buildLeagueSummary('league-c', 'League C'), state: leagueC }
    }),
    selectLeague: vi.fn(async (leagueId: string) => {
      const selected = stateByLeague[leagueId]
      if (!selected) {
        throw new Error('missing league')
      }
      activeLeagueId = leagueId
      return selected
    }),
    initialize: vi.fn(async () => leagueA),
    runAuction: vi.fn(async () => leagueA),
    auctionBid: vi.fn(async () => leagueA),
    auctionPass: vi.fn(async () => leagueA),
    auctionAuto: vi.fn(async () => leagueA),
    updateUserTeamSetup: vi.fn(async () => leagueA),
    simulateOneMatch: vi.fn(async () => leagueA),
    simulateSeasonWithWorker: vi.fn(async () => leagueA),
    exportSave: vi.fn(async () => JSON.stringify(leagueA)),
    importSave: vi.fn(async () => leagueA),
  }

  return { services }
}

describe('AppProvider multi-league state', () => {
  it('isolates state per active league when switching', async () => {
    const { services } = buildServices()
    renderWithProvider({ services })

    await waitFor(() => expect(screen.getByTestId('seed')).toHaveTextContent('111'))

    fireEvent.click(screen.getByText('Switch B'))
    await waitFor(() => expect(screen.getByTestId('seed')).toHaveTextContent('222'))

    fireEvent.click(screen.getByText('Switch A'))
    await waitFor(() => expect(screen.getByTestId('seed')).toHaveTextContent('111'))

    expect(services.selectLeague).toHaveBeenCalledWith('league-b')
    expect(services.selectLeague).toHaveBeenCalledWith('league-a')
  })

  it('keeps separate query cache entries per league key', async () => {
    const { services } = buildServices()
    const { queryClient } = renderWithProvider({ services })

    await waitFor(() => expect(screen.getByTestId('seed')).toHaveTextContent('111'))
    fireEvent.click(screen.getByText('Switch B'))
    await waitFor(() => expect(screen.getByTestId('seed')).toHaveTextContent('222'))

    const cachedA = queryClient.getQueryData<ReturnType<typeof buildState>>(getStateQueryKey('league-a'))
    const cachedB = queryClient.getQueryData<ReturnType<typeof buildState>>(getStateQueryKey('league-b'))

    expect(cachedA?.metadata.seed).toBe(111)
    expect(cachedB?.metadata.seed).toBe(222)
  })

  it('wires create league action and refreshes league list', async () => {
    const { services } = buildServices()
    renderWithProvider({ services })

    await waitFor(() => expect(screen.getByTestId('league-count')).toHaveTextContent('2'))

    fireEvent.click(screen.getByText('Create C'))

    await waitFor(() => expect(screen.getByTestId('active-league')).toHaveTextContent('league-c'))
    await waitFor(() => expect(screen.getByTestId('league-count')).toHaveTextContent('3'))

    expect(services.createLeague).toHaveBeenCalledTimes(1)
  })
})
