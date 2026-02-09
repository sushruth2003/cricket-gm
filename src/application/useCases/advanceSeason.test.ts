import { advanceSeason } from '@/application/useCases/advanceSeason'
import { createLeague } from '@/application/useCases/createLeague'
import { runAuction } from '@/application/useCases/runAuction'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import { MemoryRepository } from '@/test/memoryRepository'

const completeSeason = async (seed: number) => {
  const repo = new MemoryRepository()
  let state = await createLeague(repo, seed, {
    policySet: 'ipl-2025-cycle',
    seasonYear: 2025,
  })
  state = await runAuction(repo)
  while (state.phase !== 'complete') {
    state = simulateNextFixture(state).nextState
  }
  await repo.save(state)
  return { repo, state }
}

describe('advanceSeason', () => {
  it('advances a completed league to the next season and preserves active league context', async () => {
    const { repo, state } = await completeSeason(8081)

    const next = await advanceSeason(repo)

    expect(next.phase).toBe('auction')
    expect(new Date(next.metadata.createdAt).getUTCFullYear()).toBe(new Date(state.metadata.createdAt).getUTCFullYear() + 1)
    expect(next.config.policySet).toBe('ipl-2025-cycle')
    expect((await repo.listLeagues())[0]?.seasonCount).toBeGreaterThanOrEqual(2)
  })

  it('rejects advancing when season is not complete', async () => {
    const repo = new MemoryRepository()
    await createLeague(repo, 8082, {
      policySet: 'ipl-2025-cycle',
      seasonYear: 2025,
    })

    await expect(advanceSeason(repo)).rejects.toThrow('Current season must be complete before advancing')
  })
})
