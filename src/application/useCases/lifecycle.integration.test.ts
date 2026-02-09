import { createLeague } from '@/application/useCases/createLeague'
import { runAuction } from '@/application/useCases/runAuction'
import { simulateNextFixture } from '@/application/useCases/simulateSeason'
import { ValidationError } from '@/domain/errors'
import { resolveAuctionPolicy } from '@/domain/policy/resolver'
import { MemoryRepository } from '@/test/memoryRepository'

describe('lifecycle integration', () => {
  it('completes a season by repeatedly simulating next fixture dates', async () => {
    const repository = new MemoryRepository()
    let state = await createLeague(repository, 8080)
    state = await runAuction(repository)

    let safetyCounter = 0
    while (state.phase !== 'complete' && safetyCounter < 400) {
      state = simulateNextFixture(state).nextState
      safetyCounter += 1
    }

    expect(safetyCounter).toBeLessThan(400)
    expect(state.phase).toBe('complete')
    expect(state.fixtures.every((fixture) => fixture.played)).toBe(true)
  })

  it('creates next season on a completed source season and switches active season', async () => {
    const repository = new MemoryRepository()
    const initial = await createLeague(repository, 9090)
    await repository.save(initial, 'league-a')

    const nextSeason = await createLeague(new MemoryRepository(), 9091)
    nextSeason.phase = 'auction'

    await repository.createSeason({
      leagueId: 'league-a',
      sourceSeasonId: 'season-1',
      nextSeasonId: 'season-2',
      nextSeasonName: 'Season 2',
      state: nextSeason,
    })

    const snapshot = await repository.getLeagueSnapshot('league-a')
    const active = await repository.load('league-a')

    expect(snapshot?.activeSeasonId).toBe('season-2')
    expect(snapshot?.seasonIds).toEqual(['season-1', 'season-2'])
    expect(active?.phase).toBe('auction')
    expect(active?.metadata.seed).toBe(9091)
  })

  it('fails season creation when no league is loaded', async () => {
    const repository = new MemoryRepository()
    const state = await createLeague(new MemoryRepository(), 9101)

    await expect(
      repository.createSeason({
        sourceSeasonId: 'season-1',
        nextSeasonId: 'season-2',
        nextSeasonName: 'Season 2',
        state,
      }),
    ).rejects.toThrow('No league loaded')
  })

  it('fails season creation on source season mismatch', async () => {
    const repository = new MemoryRepository()
    const base = await createLeague(repository, 9102)

    await expect(
      repository.createSeason({
        sourceSeasonId: 'season-missing',
        nextSeasonId: 'season-2',
        nextSeasonName: 'Season 2',
        state: base,
      }),
    ).rejects.toThrow()
  })

  it('propagates semantic integrity failures from auction use case without persisting state', async () => {
    const repository = new MemoryRepository()
    const state = await createLeague(repository, 9200)

    state.auction.complete = true
    state.teams[0].wicketkeeperPlayerId = 'ghost-player'
    await repository.save(state)

    await expect(runAuction(repository)).rejects.toThrow(ValidationError)

    const after = await repository.load()
    expect(after?.metadata.seed).toBe(9200)
    expect(after?.auction.complete).toBe(true)
  })

  it('resolves representative mini/mega cycle points', () => {
    expect(resolveAuctionPolicy({ policySet: 'ipl-2025-cycle', seasonYear: 2025 }).auctionType).toBe('mega')
    expect(resolveAuctionPolicy({ policySet: 'ipl-2025-cycle', seasonYear: 2026 }).auctionType).toBe('mini')
  })
})
