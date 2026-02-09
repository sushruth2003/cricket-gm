import { createInitialState } from '@/domain/generator'
import { generateRoundRobinFixtures } from '@/domain/schedule'

describe('schedule generation', () => {
  it('creates n*(n-1) fixtures for home-and-away round robin', () => {
    const state = createInitialState(77)
    const fixtures = generateRoundRobinFixtures(state.teams)

    expect(fixtures).toHaveLength(state.teams.length * (state.teams.length - 1))
  })

  it('balances the first round so each team appears once', () => {
    const state = createInitialState(77)
    const fixtures = generateRoundRobinFixtures(state.teams)
    const firstRound = fixtures.filter((fixture) => fixture.round === 1)

    expect(firstRound).toHaveLength(state.teams.length / 2)

    const appearances = new Map<string, number>()
    for (const fixture of firstRound) {
      appearances.set(fixture.homeTeamId, (appearances.get(fixture.homeTeamId) ?? 0) + 1)
      appearances.set(fixture.awayTeamId, (appearances.get(fixture.awayTeamId) ?? 0) + 1)
    }

    for (const team of state.teams) {
      expect(appearances.get(team.id)).toBe(1)
    }
  })

  it('assigns the same date to a round and advances rounds every 3 days', () => {
    const state = createInitialState(77)
    const fixtures = generateRoundRobinFixtures(state.teams, '2026-01-01T00:00:00.000Z')
    const roundOneDates = new Set(fixtures.filter((fixture) => fixture.round === 1).map((fixture) => fixture.scheduledAt))
    const roundTwoDates = new Set(fixtures.filter((fixture) => fixture.round === 2).map((fixture) => fixture.scheduledAt))

    expect(roundOneDates.size).toBe(1)
    expect(roundTwoDates.size).toBe(1)
    expect([...roundOneDates][0]).toBe('2026-01-01')
    expect([...roundTwoDates][0]).toBe('2026-01-04')
  })

  it('creates exactly one home and one away game for every team pair', () => {
    const state = createInitialState(77)
    const fixtures = generateRoundRobinFixtures(state.teams)
    const pairCounts = new Map<string, { forward: number; reverse: number }>()

    for (const fixture of fixtures) {
      const key = `${fixture.homeTeamId}|${fixture.awayTeamId}`
      const reverseKey = `${fixture.awayTeamId}|${fixture.homeTeamId}`
      const existing =
        pairCounts.get(key) ??
        pairCounts.get(reverseKey) ?? {
          forward: 0,
          reverse: 0,
        }

      if (pairCounts.has(reverseKey)) {
        existing.reverse += 1
        pairCounts.set(reverseKey, existing)
      } else {
        existing.forward += 1
        pairCounts.set(key, existing)
      }
    }

    for (const counts of pairCounts.values()) {
      expect(counts.forward).toBe(1)
      expect(counts.reverse).toBe(1)
    }
  })
})
