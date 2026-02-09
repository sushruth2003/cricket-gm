import { skipAuctionToPlayerForUser } from '@/application/useCases/runAuction'
import { createInitialState } from '@/domain/generator'
import { MemoryRepository } from '@/test/memoryRepository'

describe('runAuction use cases', () => {
  it('skips to a pending player and stops on that lot', async () => {
    const repo = new MemoryRepository()
    const initial = createInitialState(1501)
    await repo.save(initial)
    const pendingQueue = initial.auction.entries.filter((entry) => entry.status === 'pending')
    const targetPlayerId = pendingQueue[5]?.playerId
    expect(targetPlayerId).toBeTruthy()

    const next = await skipAuctionToPlayerForUser(repo, targetPlayerId ?? '')

    expect(next.auction.complete).toBe(false)
    expect(next.auction.currentPlayerId).toBe(targetPlayerId)
    expect(next.auction.awaitingUserAction).toBe(true)
  })

  it('rejects skip when target is no longer pending', async () => {
    const repo = new MemoryRepository()
    const initial = createInitialState(1502)
    const targetPlayerId = initial.auction.entries[0]?.playerId ?? ''
    initial.auction.entries[0].status = 'sold'
    await repo.save(initial)
    expect(targetPlayerId).toBeTruthy()

    await expect(skipAuctionToPlayerForUser(repo, targetPlayerId ?? '')).rejects.toThrow(
      'Player is no longer available in the auction queue',
    )
  })
})
