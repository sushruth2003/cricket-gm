import { createInitialState } from '@/domain/generator'
import { generateRoundRobinFixtures } from '@/domain/schedule'

describe('schedule generation', () => {
  it('creates n*(n-1)/2 fixtures', () => {
    const state = createInitialState(77)
    const fixtures = generateRoundRobinFixtures(state.teams)

    expect(fixtures).toHaveLength((state.teams.length * (state.teams.length - 1)) / 2)
  })
})
