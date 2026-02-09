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

    expect(loaded?.fixtures.filter((match) => match.played)).toHaveLength(15)
  })

  it('rolls back state on import schema failure', async () => {
    const repo = new MemoryRepository()
    const existing = await createLeague(repo, 3001)

    await expect(importSave(repo, '{"bad":true}')).rejects.toThrow()

    const after = await repo.load()
    expect(after?.metadata.seed).toBe(existing.metadata.seed)
  })

  it('simulates all matches on the next scheduled date', async () => {
    const repo = new MemoryRepository()
    let state = await createLeague(repo, 2027)
    state = await runAuction(repo)

    const result = simulateNextFixture(state)
    const played = result.nextState.fixtures.filter((fixture) => fixture.played)
    const firstDate = played[0]?.scheduledAt

    expect(firstDate).toBeTruthy()
    expect(played).toHaveLength(state.teams.length / 2)
    expect(played.every((fixture) => fixture.scheduledAt === firstDate)).toBe(true)
  })
})
