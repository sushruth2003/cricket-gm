import {
  progressAuction,
  progressAuctionWithPolicyContext,
  runAutoAuction,
  runAutoAuctionWithPolicyContext,
  type UserAuctionAction,
} from '@/domain/auction'
import { createInitialState } from '@/domain/generator'
import { resolveAuctionPolicy } from '@/domain/policy/resolver'
import type { GameState, Player, Team } from '@/domain/types'

const makeTeam = (id: string, budgetRemaining: number, rosterPlayerIds: string[] = []): Team => ({
  id,
  city: id,
  name: id,
  shortName: id.toUpperCase(),
  color: '#111111',
  budgetRemaining,
  rosterPlayerIds,
  playingXi: [],
  wicketkeeperPlayerId: null,
  bowlingPreset: 'balanced',
  points: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  netRunRate: 0,
})

const makePlayer = (id: string, basePrice: number, countryTag = 'IN', role: Player['role'] = 'batter'): Player => ({
  id,
  firstName: id,
  lastName: 'P',
  countryTag,
  capped: true,
  role,
  basePrice,
  lastSeasonStats: {
    matches: 10,
    runs: 100,
    wickets: 5,
    strikeRate: 130,
    economy: 7,
  },
  ratings: {
    batting: {
      overall: 70,
      traits: {
        timing: 70,
        power: 70,
        placement: 70,
        runningBetweenWickets: 70,
        composure: 70,
      },
    },
    bowling: {
      overall: 45,
      style: 'pace',
      traits: {
        accuracy: 45,
        movement: 45,
        variations: 45,
        control: 45,
        deathExecution: 45,
      },
    },
    fielding: {
      overall: 60,
      traits: {
        catching: 60,
        groundFielding: 60,
        throwing: 60,
        wicketkeeping: 50,
      },
    },
    temperament: 60,
    fitness: 60,
  },
  teamId: null,
})

const makeState = (players: Player[], teams: Team[]): GameState => ({
  metadata: {
    schemaVersion: 2,
    engineVersion: '0.2.0',
    seed: 42,
    createdAt: '2025-01-01T00:00:00.000Z',
    updatedAt: '2025-01-01T00:00:00.000Z',
  },
  config: {
    teamCount: teams.length,
    format: 'T20',
    policySet: 'legacy-default',
    auctionBudget: 12_000,
    minSquadSize: 2,
    maxSquadSize: 25,
    seasonSeed: 42,
  },
  simulation: {
    deterministicCore: true,
    liveViewNarrationMode: 'non_authoritative',
  },
  phase: 'auction',
  userTeamId: teams[0].id,
  teams,
  players,
  auction: {
    currentNominationIndex: 0,
    phase: 'marquee',
    currentPlayerId: players[0]?.id ?? null,
    currentBidTeamId: null,
    currentBid: 0,
    currentBidIncrement: players[0]?.basePrice ?? 0,
    passedTeamIds: [],
    awaitingUserAction: true,
    message: 'start',
    allowRtm: false,
    entries: players.map((player) => ({
      playerId: player.id,
      phase: 'marquee',
      status: 'pending',
      soldToTeamId: null,
      finalPrice: 0,
    })),
    complete: false,
  },
  fixtures: [],
  stats: {},
})

describe('auction state machine scenarios', () => {
  it.each([
    {
      action: 'bid' as UserAuctionAction,
      expectedStatus: 'sold',
      expectedOwner: 'team-1',
    },
    {
      action: 'auto' as UserAuctionAction,
      expectedStatus: 'sold',
      expectedOwner: 'team-1',
    },
  ])('handles user action $action path', ({ action, expectedStatus, expectedOwner }) => {
    const player = makePlayer('player-1', 30)
    const state = makeState([player], [makeTeam('team-1', 12_000), makeTeam('team-2', 20)])

    const next = progressAuction(state, action)
    const entry = next.auction.entries[0]

    expect(entry.status).toBe(expectedStatus)
    expect(entry.soldToTeamId).toBe(expectedOwner)
  })

  it('marks lot unsold when no team can bid', () => {
    const player = makePlayer('player-1', 100)
    const state = makeState([player], [makeTeam('team-1', 20), makeTeam('team-2', 20)])

    const next = progressAuction(state, 'pass')

    expect(next.auction.entries[0].status).toBe('unsold')
    expect(next.auction.entries[0].soldToTeamId).toBeNull()
  })

  it('auto mode prioritizes missing wicketkeeper role', () => {
    const wicketkeeper = makePlayer('wk-1', 30, 'IN', 'wicketkeeper')
    wicketkeeper.ratings = {
      ...wicketkeeper.ratings,
      batting: { ...wicketkeeper.ratings.batting, overall: 66 },
      bowling: { ...wicketkeeper.ratings.bowling, overall: 32 },
      fielding: { ...wicketkeeper.ratings.fielding, traits: { ...wicketkeeper.ratings.fielding.traits, wicketkeeping: 92 } },
    }
    const userTeam = makeTeam('team-1', 12_000)
    const aiTeam = makeTeam('team-2', 100)
    const state = makeState([wicketkeeper], [userTeam, aiTeam])

    const next = progressAuction(state, 'auto')
    expect(next.auction.entries[0].status).toBe('sold')
    expect(next.auction.entries[0].soldToTeamId).toBe('team-1')
  })

  it('auto mode passes when bid exceeds value ceiling', () => {
    const expensiveBatter = makePlayer('star-1', 3_000, 'IN', 'batter')
    expensiveBatter.ratings = {
      ...expensiveBatter.ratings,
      batting: { ...expensiveBatter.ratings.batting, overall: 52 },
      bowling: { ...expensiveBatter.ratings.bowling, overall: 28 },
      fielding: { ...expensiveBatter.ratings.fielding, overall: 45 },
      fitness: 44,
      temperament: 43,
    }
    expensiveBatter.lastSeasonStats = {
      matches: 8,
      runs: 92,
      wickets: 0,
      strikeRate: 108,
      economy: 12.4,
    }
    const userTeam = makeTeam('team-1', 3_500)
    const aiTeam = makeTeam('team-2', 2_900)
    const state = makeState([expensiveBatter], [userTeam, aiTeam])

    const next = progressAuction(state, 'auto')
    expect(next.auction.entries[0].status).toBe('unsold')
    expect(next.auction.entries[0].soldToTeamId).toBeNull()
  })

  it('rejects user overseas bid when cap is reached', () => {
    const cap = resolveAuctionPolicy().policy.overseasCap
    const overseasRoster = Array.from({ length: cap }, (_, index) => makePlayer(`ov-${index + 1}`, 30, 'AUS'))
    const target = makePlayer('target-overseas', 30, 'ENG')
    const allPlayers = [...overseasRoster, target]

    const userTeam = makeTeam('team-1', 12_000, overseasRoster.map((player) => player.id))
    const aiTeam = makeTeam('team-2', 20)
    for (const player of overseasRoster) {
      player.teamId = userTeam.id
    }

    const state = makeState(allPlayers, [userTeam, aiTeam])
    state.auction.entries = [{ playerId: target.id, phase: 'marquee', status: 'pending', soldToTeamId: null, finalPrice: 0 }]
    state.auction.currentPlayerId = target.id

    const next = progressAuction(state, 'bid')

    expect(next.auction.entries[0].status).toBe('unsold')
    expect(next.players.find((player) => player.id === target.id)?.teamId).toBeNull()
  })

  it('rejects bid when reserve for minimum squad would be violated', () => {
    const p1 = makePlayer('player-1', 500)
    const state = makeState([p1], [makeTeam('team-1', 520), makeTeam('team-2', 20)])

    const next = progressAuction(state, 'bid')

    expect(next.auction.entries[0].status).toBe('unsold')
    expect(next.auction.entries[0].soldToTeamId).toBeNull()
  })

  it('force-fills minimum squads using unsold pool', () => {
    const p1 = makePlayer('player-1', 30)
    const p2 = makePlayer('player-2', 30)
    const teams = [makeTeam('team-1', 12_000, [p1.id]), makeTeam('team-2', 12_000, [p2.id])]
    p1.teamId = 'team-1'
    p2.teamId = 'team-2'

    const pool1 = makePlayer('pool-1', 30)
    const pool2 = makePlayer('pool-2', 30)
    const state = makeState([p1, p2, pool1, pool2], teams)
    state.auction.currentPlayerId = null
    state.auction.currentNominationIndex = state.auction.entries.length
    state.auction.entries = [
      { playerId: pool1.id, phase: 'accelerated-2', status: 'unsold', soldToTeamId: null, finalPrice: 0 },
      { playerId: pool2.id, phase: 'accelerated-2', status: 'unsold', soldToTeamId: null, finalPrice: 0 },
    ]

    const next = progressAuction(state)

    expect(next.auction.complete).toBe(true)
    expect(next.auction.entries.some((entry) => entry.status === 'sold')).toBe(true)
    expect(next.teams.some((team) => team.rosterPlayerIds.length > 1)).toBe(true)
  })
})

describe('auction determinism and regression', () => {
  it('same seed + same state yields deterministic outcome', () => {
    const state = createInitialState(111)
    const nextA = runAutoAuction(state)
    const nextB = runAutoAuction(state)

    expect(nextA).toEqual(nextB)
  })

  it('legacy policy context preserves default behavior', () => {
    const state = createInitialState(88)
    const expected = runAutoAuction(state)
    const actual = runAutoAuctionWithPolicyContext(state, { policySet: 'legacy-default' })

    expect(actual).toEqual(expected)
  })

  it('keeps public progress facade compatible', () => {
    const state = createInitialState(19)
    const expected = progressAuction(state, 'auto')
    const actual = progressAuctionWithPolicyContext(state, 'auto', { policySet: 'legacy-default' })

    expect(actual).toEqual(expected)
  })
})
