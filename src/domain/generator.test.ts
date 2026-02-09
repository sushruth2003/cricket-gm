import { createInitialState, createSeededInitialStateWithOptions, generateYoungPlayers } from '@/domain/generator'

describe('player generation', () => {
  it('maintains a healthy role distribution with pure bowlers present', () => {
    for (const seed of [11, 77, 105, 999, 2026]) {
      const state = createInitialState(seed)
      const total = state.players.length
      const bowlers = state.players.filter((player) => player.role === 'bowler').length
      const allrounders = state.players.filter((player) => player.role === 'allrounder').length
      const wicketkeepers = state.players.filter((player) => player.role === 'wicketkeeper').length

      expect(bowlers / total).toBeGreaterThanOrEqual(0.2)
      expect(allrounders / total).toBeLessThanOrEqual(0.35)
      expect(wicketkeepers / total).toBeGreaterThanOrEqual(0.06)
    }
  })

  it('keeps elite two-way allrounders uncommon', () => {
    const state = createInitialState(42)
    const allrounders = state.players.filter((player) => player.role === 'allrounder')
    const eliteTwoWay = allrounders.filter(
      (player) => player.ratings.batting.overall >= 88 && player.ratings.bowling.overall >= 84,
    )

    expect(eliteTwoWay.length).toBeLessThanOrEqual(Math.ceil(allrounders.length * 0.12))
  })

  it('generates youth prospects with meaningful upside', () => {
    const state = createInitialState(51)
    const prospects = state.players.filter((player) => player.development?.isProspect)

    expect(prospects.length).toBeGreaterThanOrEqual(state.config.teamCount * 2)
    expect(prospects.every((player) => (player.age ?? 0) <= 21)).toBe(true)
    expect(
      prospects.every((player) => {
        const potential = player.development?.potential
        if (!potential) {
          return false
        }
        return (
          potential.battingOverall >= player.ratings.batting.overall &&
          potential.bowlingOverall >= player.ratings.bowling.overall &&
          potential.fieldingOverall >= player.ratings.fielding.overall
        )
      }),
    ).toBe(true)

    const youthPool = generateYoungPlayers(state.config)
    expect(youthPool.length).toBe(prospects.length)
  })

  it('creates seeded opening season with assigned squads and preseason phase', () => {
    const state = createSeededInitialStateWithOptions(7007, {
      seasonStartIso: '2025-01-01T00:00:00.000Z',
      policyContext: {
        policySet: 'ipl-2025-cycle',
        seasonYear: 2025,
      },
    })

    expect(state.phase).toBe('preseason')
    expect(state.auction.complete).toBe(true)
    expect(state.fixtures.length).toBeGreaterThan(0)
    expect(state.teams.every((team) => team.rosterPlayerIds.length === state.config.maxSquadSize)).toBe(true)
    expect(state.teams.every((team) => team.playingXi.length === 11)).toBe(true)

    const assignedPlayers = state.players.filter((player) => player.teamId !== null)
    expect(assignedPlayers.length).toBe(state.players.length)
    expect(state.teams.every((team) => team.budgetRemaining >= 0 && team.budgetRemaining < state.config.auctionBudget)).toBe(true)
  })
})
