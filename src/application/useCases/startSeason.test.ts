import { createLeague } from '@/application/useCases/createLeague'
import { startSeason } from '@/application/useCases/startSeason'
import { MemoryRepository } from '@/test/memoryRepository'

describe('startSeason', () => {
  it('transitions preseason into regular season', async () => {
    const repo = new MemoryRepository()
    const state = await createLeague(repo, 1616)

    expect(state.phase).toBe('preseason')

    const next = await startSeason(repo)

    expect(next.phase).toBe('regular-season')
    expect(new Date(next.metadata.updatedAt).getTime()).toBeGreaterThanOrEqual(new Date(state.metadata.updatedAt).getTime())
  })

  it('rejects transition when not in preseason', async () => {
    const repo = new MemoryRepository()
    await createLeague(repo, 1717)
    await startSeason(repo)

    await expect(startSeason(repo)).rejects.toThrow('Season can only be started from preseason')
  })
})
