import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { createInitialState } from '@/domain/generator'
import { AppContext, type AppContextValue } from '@/ui/AppContext'
import { DashboardPage } from '@/ui/pages/DashboardPage'

const buildBaseContext = (overrides: Partial<AppContextValue> = {}): AppContextValue => {
  const state = createInitialState(100)

  return {
    services: {} as AppContextValue['services'],
    leagues: [],
    activeLeagueId: null,
    state: null,
    loading: false,
    switchingLeague: false,
    saving: false,
    progressText: '',
    errorMessage: null,
    actions: {
      createOrLoadLeague: vi.fn(async () => undefined),
      createLeague: vi.fn(async () => undefined),
      selectLeague: vi.fn(async () => undefined),
      loadLeagues: vi.fn(async () => undefined),
      runAuction: vi.fn(async () => undefined),
      auctionBid: vi.fn(async () => undefined),
      auctionPass: vi.fn(async () => undefined),
      auctionAuto: vi.fn(async () => undefined),
      simulateMatch: vi.fn(async () => undefined),
      simulateSeason: vi.fn(async () => undefined),
      updateTeamSetup: vi.fn(async () => undefined),
      exportSave: vi.fn(async () => ''),
      importSave: vi.fn(async () => undefined),
    },
    views: {
      teams: state.teams.map((team) => ({
        id: team.id,
        name: team.name,
        shortName: team.shortName,
        points: team.points,
        wins: team.wins,
        losses: team.losses,
        budgetRemaining: team.budgetRemaining,
      })),
      players: [],
      matches: [],
      auctionEntries: [],
      stats: [],
    },
    ...overrides,
  }
}

const renderWithContext = (value: AppContextValue) =>
  render(
    <AppContext.Provider value={value}>
      <DashboardPage />
    </AppContext.Provider>,
  )

describe('DashboardPage league visibility and controls', () => {
  it('renders no-league empty state', () => {
    const value = buildBaseContext({ leagues: [], activeLeagueId: null, state: null })
    renderWithContext(value)

    expect(screen.getByText('No leagues yet. Create a league to begin.')).toBeInTheDocument()
    expect(screen.getByText('Select or create a league to view season details.')).toBeInTheDocument()
  })

  it('renders one league with season metadata', () => {
    const state = createInitialState(321)
    const value = buildBaseContext({
      leagues: [
        {
          id: 'league-1',
          name: 'League 1',
          activeSeasonId: 'season-1',
          seasonIds: ['season-1'],
          createdAt: state.metadata.createdAt,
          updatedAt: state.metadata.updatedAt,
        },
      ],
      activeLeagueId: 'league-1',
      state,
    })

    renderWithContext(value)

    expect(screen.getByText(/Active League:/)).toHaveTextContent('League 1')
    expect(screen.getByText('Season: Season 1')).toBeInTheDocument()
    expect(screen.getByText(`Phase: ${state.phase}`)).toBeInTheDocument()
  })

  it('renders multiple leagues in switch control and wires actions', async () => {
    const createLeague = vi.fn(async () => undefined)
    const selectLeague = vi.fn(async () => undefined)
    const loadLeagues = vi.fn(async () => undefined)
    const state = createInitialState(456)

    const value = buildBaseContext({
      leagues: [
        {
          id: 'league-1',
          name: 'League 1',
          activeSeasonId: 'season-1',
          seasonIds: ['season-1'],
          createdAt: state.metadata.createdAt,
          updatedAt: state.metadata.updatedAt,
        },
        {
          id: 'league-2',
          name: 'League 2',
          activeSeasonId: 'season-3',
          seasonIds: ['season-1', 'season-2', 'season-3'],
          createdAt: state.metadata.createdAt,
          updatedAt: state.metadata.updatedAt,
        },
      ],
      activeLeagueId: 'league-1',
      state,
      actions: {
        ...buildBaseContext().actions,
        createOrLoadLeague: vi.fn(async () => undefined),
        createLeague,
        selectLeague,
        loadLeagues,
      },
    })

    renderWithContext(value)

    const select = screen.getByLabelText('Switch League')
    expect(select).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'League 1' })).toBeInTheDocument()
    expect(screen.getByRole('option', { name: 'League 2' })).toBeInTheDocument()

    fireEvent.change(select, { target: { value: 'league-2' } })
    fireEvent.change(screen.getByLabelText('New league name'), { target: { value: 'League X' } })
    await act(async () => {
      fireEvent.click(screen.getByText('Create League'))
      fireEvent.click(screen.getByText('Refresh Leagues'))
    })

    expect(selectLeague).toHaveBeenCalledWith('league-2')
    expect(createLeague).toHaveBeenCalledWith({ name: 'League X' })
    expect(loadLeagues).toHaveBeenCalledTimes(1)
  })
})
