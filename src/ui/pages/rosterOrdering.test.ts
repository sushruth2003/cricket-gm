import { describe, expect, it } from 'vitest'
import type { Player } from '@/domain/types'
import {
  autosortDraftOrder,
  buildCompositeAutoLineup,
  buildInitialDraftOrder,
  movePlayerInOrder,
  resolveActiveWicketkeeper,
  STARTING_XI_SIZE,
} from '@/ui/pages/rosterOrdering'

const makePlayer = (id: string, overrides?: Partial<Player>): Player => ({
  id,
  firstName: `First${id}`,
  lastName: `Last${id}`,
  countryTag: 'IN',
  capped: true,
  role: 'batter',
  basePrice: 1000000,
  lastSeasonStats: {
    matches: 14,
    runs: 280,
    wickets: 4,
    strikeRate: 130,
    economy: 7.2,
  },
  ratings: {
    batting: { overall: 50, traits: { timing: 50, power: 50, placement: 50, runningBetweenWickets: 50, composure: 50 } },
    bowling: { overall: 50, style: 'pace', traits: { accuracy: 50, movement: 50, variations: 50, control: 50, deathExecution: 50 } },
    fielding: { overall: 50, traits: { catching: 50, groundFielding: 50, throwing: 50, wicketkeeping: 50 } },
    temperament: 50,
    fitness: 50,
  },
  teamId: 'team-1',
  ...overrides,
})

describe('rosterOrdering', () => {
  it('builds stable initial order from XI and bench', () => {
    const players = [makePlayer('p1'), makePlayer('p2'), makePlayer('p3'), makePlayer('p4')]
    const order = buildInitialDraftOrder(players, ['p3', 'p1'])
    expect(order).toEqual(['p3', 'p1', 'p2', 'p4'])
  })

  it('moves players to requested index', () => {
    const next = movePlayerInOrder(['p1', 'p2', 'p3', 'p4'], 'p4', 1)
    expect(next).toEqual(['p1', 'p4', 'p2', 'p3'])
  })

  it('autosorts globally and top 11 become starters', () => {
    const players = Array.from({ length: 13 }).map((_, index) =>
      makePlayer(`p${index + 1}`, {
        ratings: {
          batting: { overall: 30 + index, traits: { timing: 50, power: 50, placement: 50, runningBetweenWickets: 50, composure: 50 } },
          bowling: { overall: 50, style: 'pace', traits: { accuracy: 50, movement: 50, variations: 50, control: 50, deathExecution: 50 } },
          fielding: { overall: 50, traits: { catching: 50, groundFielding: 50, throwing: 50, wicketkeeping: 50 } },
          temperament: 50,
          fitness: 50,
        },
      }),
    )
    const order = autosortDraftOrder(players, 'bat', 'desc')
    expect(order[0]).toBe('p13')
    expect(order[STARTING_XI_SIZE - 1]).toBe('p3')
    expect(order[STARTING_XI_SIZE]).toBe('p2')
  })

  it('falls back wicketkeeper to first starter when selected is benched', () => {
    const selection = ['p1', 'p2', 'p3']
    const wk = resolveActiveWicketkeeper(selection, 'p9', 'p8')
    expect(wk).toBe('p1')
  })

  it('builds composite XI with keeper and bowling depth', () => {
    const players = Array.from({ length: 15 }).map((_, index) =>
      makePlayer(`p${index + 1}`, {
        role: index < 4 ? 'batter' : index < 9 ? 'bowler' : index < 12 ? 'allrounder' : 'wicketkeeper',
        ratings: {
          batting: { overall: 44 + index, traits: { timing: 50, power: 50, placement: 50, runningBetweenWickets: 50, composure: 50 } },
          bowling: { overall: index < 4 ? 35 : 58 + index, style: 'pace', traits: { accuracy: 50, movement: 50, variations: 50, control: 50, deathExecution: 50 } },
          fielding: {
            overall: 52,
            traits: { catching: 50, groundFielding: 50, throwing: 50, wicketkeeping: index >= 12 ? 75 : 30 },
          },
          temperament: 50,
          fitness: 50,
        },
      }),
    )
    const next = buildCompositeAutoLineup(players)
    const xi = next.draftOrder.slice(0, STARTING_XI_SIZE)
    const keeperId = next.wicketkeeperPlayerId

    expect(xi).toHaveLength(STARTING_XI_SIZE)
    expect(keeperId).not.toBeNull()
    expect(xi.includes(keeperId ?? '')).toBe(true)

    const byId = new Map(players.map((player) => [player.id, player]))
    const bowlingOptions = xi
      .filter((playerId) => playerId !== keeperId)
      .map((playerId) => byId.get(playerId))
      .filter((player): player is Player => Boolean(player))
      .filter((player) => player.role === 'bowler' || player.role === 'allrounder' || player.ratings.bowling.overall >= 64).length
    expect(bowlingOptions).toBeGreaterThanOrEqual(5)
  })

  it('avoids assigning strongest bowler as keeper when alternate keeper exists', () => {
    const specialistBowlingKeeper = makePlayer('wk-bowler', {
      role: 'wicketkeeper',
      ratings: {
        batting: { overall: 58, traits: { timing: 50, power: 50, placement: 50, runningBetweenWickets: 50, composure: 50 } },
        bowling: { overall: 90, style: 'pace', traits: { accuracy: 50, movement: 50, variations: 50, control: 50, deathExecution: 50 } },
        fielding: { overall: 78, traits: { catching: 50, groundFielding: 50, throwing: 50, wicketkeeping: 85 } },
        temperament: 60,
        fitness: 62,
      },
    })
    const pureKeeper = makePlayer('wk-pure', {
      role: 'wicketkeeper',
      ratings: {
        batting: { overall: 54, traits: { timing: 50, power: 50, placement: 50, runningBetweenWickets: 50, composure: 50 } },
        bowling: { overall: 38, style: 'pace', traits: { accuracy: 50, movement: 50, variations: 50, control: 50, deathExecution: 50 } },
        fielding: { overall: 80, traits: { catching: 50, groundFielding: 50, throwing: 50, wicketkeeping: 93 } },
        temperament: 61,
        fitness: 64,
      },
    })
    const support = Array.from({ length: 12 }).map((_, index) =>
      makePlayer(`p${index}`, {
        role: index < 6 ? 'bowler' : 'allrounder',
        ratings: {
          batting: { overall: 45 + index, traits: { timing: 50, power: 50, placement: 50, runningBetweenWickets: 50, composure: 50 } },
          bowling: { overall: 70 - index, style: 'pace', traits: { accuracy: 50, movement: 50, variations: 50, control: 50, deathExecution: 50 } },
          fielding: { overall: 56, traits: { catching: 50, groundFielding: 50, throwing: 50, wicketkeeping: 25 } },
          temperament: 50,
          fitness: 50,
        },
      }),
    )

    const next = buildCompositeAutoLineup([specialistBowlingKeeper, pureKeeper, ...support])
    expect(next.wicketkeeperPlayerId).toBe('wk-pure')
  })
})
