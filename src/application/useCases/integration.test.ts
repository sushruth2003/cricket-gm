import { createLeague } from '@/application/useCases/createLeague'
import { importSave } from '@/application/useCases/importSave'
import { runAuction } from '@/application/useCases/runAuction'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import { MemoryRepository } from '@/test/memoryRepository'

describe('application integration flow', () => {
  it('runs preseason to first 3 fixtures', async () => {
    const repo = new MemoryRepository()
    let state = await createLeague(repo, 2026)
    state = await runAuction(repo)

    expect(state.phase).toBe('regular-season')
    expect(state.fixtures.length).toBeGreaterThan(0)

    for (let i = 0; i < 3; i += 1) {
      const simulated = simulateNextFixture(state)
      state = simulated.nextState
    }

    await repo.save(state)
    const loaded = await repo.load()

    expect(loaded?.fixtures.filter((match) => match.played)).toHaveLength(3)
  })

  it('rolls back state on import schema failure', async () => {
    const repo = new MemoryRepository()
    const existing = await createLeague(repo, 3001)

    await expect(importSave(repo, '{"bad":true}')).rejects.toThrow()

    const after = await repo.load()
    expect(after?.metadata.seed).toBe(existing.metadata.seed)
  })
})
