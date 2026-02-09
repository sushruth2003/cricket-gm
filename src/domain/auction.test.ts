import { progressAuction, runAutoAuction } from '@/domain/auction'
import { createInitialState } from '@/domain/generator'
import { createAuctionPlayer, createAuctionTeam, createTwoTeamAuctionState } from '@/test/auctionStateFactory'

describe('auction constraints', () => {
  it('never exceeds team budgets or max squad size', () => {
    const state = createInitialState(88)
    const next = runAutoAuction(state)
    const playerById = new Map(next.players.map((player) => [player.id, player]))

    for (const team of next.teams) {
      expect(team.budgetRemaining).toBeGreaterThanOrEqual(0)
      expect(team.rosterPlayerIds.length).toBeGreaterThanOrEqual(next.config.minSquadSize)
      expect(team.rosterPlayerIds.length).toBeLessThanOrEqual(next.config.maxSquadSize)
      const overseas = team.rosterPlayerIds.filter((playerId) => playerById.get(playerId)?.countryTag !== 'IN').length
      expect(overseas).toBeLessThanOrEqual(8)
      expect(next.config.auctionBudget - team.budgetRemaining).toBeGreaterThanOrEqual(9_000)
    }
  })

  it.each([
    { action: 'bid' as const, expectedStatus: 'sold' as const, expectedOwner: 'user' },
    { action: 'pass' as const, expectedStatus: 'unsold' as const, expectedOwner: null },
    { action: 'auto' as const, expectedStatus: 'sold' as const, expectedOwner: 'user' },
  ])('handles user $action flow for first lot', ({ action, expectedStatus, expectedOwner }) => {
    const state = createTwoTeamAuctionState({
      seed: 901,
      userBudget: 12_000,
      rivalBudget: 0,
      minSquadSize: action === 'pass' ? 0 : 1,
      players: [createAuctionPlayer('lot-1', { basePrice: 40 })],
    })

    const next = progressAuction(state, action)
    const entry = next.auction.entries[0]
    const userTeam = next.teams.find((team) => team.id === next.userTeamId)

    expect(entry.status).toBe(expectedStatus)
    expect(entry.soldToTeamId).toBe(expectedOwner)
    expect(userTeam?.rosterPlayerIds.includes('lot-1')).toBe(expectedOwner === 'user')
  })

  it('marks lot unsold when user cannot bid due to overseas cap', () => {
    const overseasRoster = Array.from({ length: 8 }, (_, index) =>
      createAuctionPlayer(`overseas-${index + 1}`, {
        countryTag: 'AUS',
        teamId: 'user',
      }),
    )
    const lotPlayer = createAuctionPlayer('overseas-lot', {
      countryTag: 'ENG',
      basePrice: 30,
    })

    const userTeam = createAuctionTeam('user', 12_000, {
      rosterPlayerIds: overseasRoster.map((player) => player.id),
      playingXi: overseasRoster.slice(0, 1).map((player) => player.id),
    })

    const rivalTeam = createAuctionTeam('ai-1', 0)

    const state = createTwoTeamAuctionState({
      teams: [userTeam, rivalTeam],
      players: [...overseasRoster, lotPlayer],
      entries: [
        {
          playerId: lotPlayer.id,
          phase: 'capped',
          status: 'pending',
          soldToTeamId: null,
          finalPrice: 0,
        },
      ],
    })

    const next = progressAuction(state, 'bid')
    const entry = next.auction.entries[0]

    expect(entry.status).toBe('unsold')
    expect(entry.soldToTeamId).toBeNull()
    expect(next.teams[0].rosterPlayerIds).not.toContain('overseas-lot')
  })

  it('force-fills unsold players to satisfy minimum squad size at auction completion', () => {
    const player = createAuctionPlayer('min-fill', { basePrice: 30 })
    const state = createTwoTeamAuctionState({
      minSquadSize: 1,
      teams: [createAuctionTeam('user', 12_000)],
      players: [player],
      entries: [
        {
          playerId: player.id,
          phase: 'capped',
          status: 'unsold',
          soldToTeamId: null,
          finalPrice: 0,
        },
      ],
    })

    state.auction.currentNominationIndex = state.auction.entries.length

    const next = progressAuction(state, 'auto')

    expect(next.auction.complete).toBe(true)
    expect(next.phase).toBe('regular-season')
    expect(next.teams[0].rosterPlayerIds).toContain('min-fill')
    expect(next.auction.entries[0]).toMatchObject({ status: 'sold', soldToTeamId: 'user', finalPrice: 30 })
  })

  it('is deterministic for identical seed and identical starting state', () => {
    const initial = createInitialState(777)

    const one = runAutoAuction(initial)
    const two = runAutoAuction(initial)

    expect(one).toEqual(two)
  })
})
