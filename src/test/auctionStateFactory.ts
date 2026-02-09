import type { AuctionEntry, GameState, Player, Team } from '@/domain/types'

const makePlayer = (
  id: string,
  overrides: Partial<Player> = {},
): Player => ({
  id,
  firstName: `Player${id}`,
  lastName: 'Test',
  countryTag: 'IN',
  capped: true,
  role: 'batter',
  basePrice: 30,
  lastSeasonStats: {
    matches: 0,
    runs: 0,
    wickets: 0,
    strikeRate: 0,
    economy: 0,
  },
  ratings: {
    batting: {
      overall: 60,
      traits: {
        timing: 60,
        power: 60,
        placement: 60,
        runningBetweenWickets: 60,
        composure: 60,
      },
    },
    bowling: {
      style: 'pace',
      overall: 45,
      traits: {
        accuracy: 45,
        movement: 45,
        variations: 45,
        control: 45,
        deathExecution: 45,
      },
    },
    fielding: {
      overall: 55,
      traits: {
        catching: 55,
        groundFielding: 55,
        throwing: 55,
        wicketkeeping: 40,
      },
    },
    temperament: 60,
    fitness: 60,
  },
  teamId: null,
  ...overrides,
})

const makeTeam = (id: string, budgetRemaining: number, overrides: Partial<Team> = {}): Team => ({
  id,
  city: id,
  name: id,
  shortName: id.toUpperCase(),
  color: '#0b1f3a',
  budgetRemaining,
  rosterPlayerIds: [],
  playingXi: [],
  wicketkeeperPlayerId: null,
  bowlingPreset: 'balanced',
  points: 0,
  wins: 0,
  losses: 0,
  ties: 0,
  netRunRate: 0,
  ...overrides,
})

export interface TwoTeamAuctionStateOptions {
  seed?: number
  userBudget?: number
  rivalBudget?: number
  minSquadSize?: number
  maxSquadSize?: number
  players?: Player[]
  entries?: AuctionEntry[]
  teams?: Team[]
}

export const createTwoTeamAuctionState = (options: TwoTeamAuctionStateOptions = {}): GameState => {
  const players = options.players ?? [makePlayer('p-1')]
  const entries =
    options.entries ??
    players.map((player) => ({
      playerId: player.id,
      phase: 'capped',
      status: 'pending',
      soldToTeamId: null,
      finalPrice: 0,
    }))

  const teams =
    options.teams ?? [makeTeam('user', options.userBudget ?? 12_000), makeTeam('ai-1', options.rivalBudget ?? 12_000)]

  return {
    metadata: {
      schemaVersion: 2,
      engineVersion: 'test',
      seed: options.seed ?? 123,
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    },
    config: {
      teamCount: teams.length,
      format: 'T20',
      auctionBudget: 12_000,
      minSquadSize: options.minSquadSize ?? 1,
      maxSquadSize: options.maxSquadSize ?? 25,
      seasonSeed: options.seed ?? 123,
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
      phase: 'capped',
      currentPlayerId: null,
      currentBidTeamId: null,
      currentBid: 0,
      currentBidIncrement: 0,
      passedTeamIds: [],
      awaitingUserAction: false,
      message: '',
      allowRtm: false,
      entries,
      complete: false,
    },
    fixtures: [],
    stats: {},
  }
}

export const createAuctionPlayer = makePlayer
export const createAuctionTeam = makeTeam
