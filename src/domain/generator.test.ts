import { createInitialState, generateYoungPlayers } from '@/domain/generator'

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
})
