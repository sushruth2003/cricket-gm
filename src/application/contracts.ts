import { z } from 'zod'

const battingRatingSchema = z.object({
  overall: z.number().int().min(1).max(99),
  traits: z.object({
    timing: z.number().int().min(1).max(99),
    power: z.number().int().min(1).max(99),
    placement: z.number().int().min(1).max(99),
    runningBetweenWickets: z.number().int().min(1).max(99),
    composure: z.number().int().min(1).max(99),
  }),
})

const bowlingRatingSchema = z.object({
  style: z.enum(['pace', 'spin']),
  overall: z.number().int().min(1).max(99),
  traits: z.object({
    accuracy: z.number().int().min(1).max(99),
    movement: z.number().int().min(1).max(99),
    variations: z.number().int().min(1).max(99),
    control: z.number().int().min(1).max(99),
    deathExecution: z.number().int().min(1).max(99),
  }),
})

const fieldingRatingSchema = z.object({
  overall: z.number().int().min(1).max(99),
  traits: z.object({
    catching: z.number().int().min(1).max(99),
    groundFielding: z.number().int().min(1).max(99),
    throwing: z.number().int().min(1).max(99),
    wicketkeeping: z.number().int().min(1).max(99),
  }),
})

const playerSchema = z.object({
  id: z.string(),
  firstName: z.string(),
  lastName: z.string(),
  countryTag: z.string(),
  capped: z.boolean(),
  role: z.enum(['batter', 'bowler', 'wicketkeeper', 'allrounder']),
  age: z.number().int().min(16).max(50).optional(),
  basePrice: z.number().int().min(1),
  lastSeasonStats: z.object({
    matches: z.number().int().min(0),
    runs: z.number().int().min(0),
    wickets: z.number().int().min(0),
    strikeRate: z.number().min(0),
    economy: z.number().min(0),
  }),
  ratings: z.object({
    batting: battingRatingSchema,
    bowling: bowlingRatingSchema,
    fielding: fieldingRatingSchema,
    temperament: z.number().int().min(1).max(99),
    fitness: z.number().int().min(1).max(99),
  }),
  development: z
    .object({
      isProspect: z.boolean(),
      potential: z.object({
        battingOverall: z.number().int().min(1).max(99),
        bowlingOverall: z.number().int().min(1).max(99),
        fieldingOverall: z.number().int().min(1).max(99),
        temperament: z.number().int().min(1).max(99),
        fitness: z.number().int().min(1).max(99),
      }),
      firstClassProjection: z.object({
        runs: z.number().int().min(0),
        wickets: z.number().int().min(0),
        strikeRate: z.number().min(0),
        economy: z.number().min(0),
      }),
    })
    .optional(),
  teamId: z.string().nullable(),
})

const teamSchema = z.object({
  id: z.string(),
  city: z.string(),
  name: z.string(),
  shortName: z.string(),
  color: z.string(),
  budgetRemaining: z.number().int().min(0),
  rosterPlayerIds: z.array(z.string()),
  playingXi: z.array(z.string()),
  wicketkeeperPlayerId: z.string().nullable(),
  bowlingPreset: z.enum(['balanced', 'aggressive', 'defensive']),
  points: z.number().int(),
  wins: z.number().int(),
  losses: z.number().int(),
  ties: z.number().int(),
  netRunRate: z.number(),
})

const inningsSchema = z.object({
  battingTeamId: z.string(),
  bowlingTeamId: z.string(),
  wicketkeeperPlayerId: z.string().nullable(),
  runs: z.number().int().min(0),
  wickets: z.number().int().min(0).max(10),
  overs: z.number().min(0).max(20),
  batting: z.array(
    z.object({
      playerId: z.string(),
      runs: z.number().int().min(0),
      balls: z.number().int().min(0),
      fours: z.number().int().min(0),
      sixes: z.number().int().min(0),
      out: z.boolean(),
      dismissalKind: z.enum(['caught', 'bowled', 'caught-and-bowled', 'lbw', 'run-out']).nullable().default(null),
      dismissedByPlayerId: z.string().nullable().default(null),
      assistedByPlayerId: z.string().nullable().default(null),
    }),
  ),
  bowling: z.array(
    z.object({
      playerId: z.string(),
      overs: z.number().min(0).max(4),
      runsConceded: z.number().int().min(0),
      wickets: z.number().int().min(0),
    }),
  ),
})

const matchSchema = z.object({
  id: z.string(),
  homeTeamId: z.string(),
  awayTeamId: z.string(),
  venue: z.string(),
  round: z.number().int().min(1),
  scheduledAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  played: z.boolean(),
  winnerTeamId: z.string().nullable(),
  margin: z.string(),
  innings: z.tuple([inningsSchema, inningsSchema]).nullable(),
})

const metadataSchema = z.object({
  schemaVersion: z.number().int().min(1),
  engineVersion: z.string(),
  seed: z.number().int(),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const gameStateSchema = z.object({
  metadata: metadataSchema,
  config: z.object({
    teamCount: z.number().int().min(2).max(20),
    format: z.literal('T20'),
    policySet: z.enum(['legacy-default', 'ipl-2025-cycle']),
    auctionBudget: z.number().int().min(1),
    minSquadSize: z.number().int().min(11),
    maxSquadSize: z.number().int().min(11),
    seasonSeed: z.number().int(),
  }),
  simulation: z.object({
    deterministicCore: z.boolean(),
    liveViewNarrationMode: z.literal('non_authoritative'),
  }),
  phase: z.enum(['auction', 'preseason', 'regular-season', 'playoffs', 'complete']),
  userTeamId: z.string(),
  teams: z.array(teamSchema),
  players: z.array(playerSchema),
  auction: z.object({
    currentNominationIndex: z.number().int().min(0),
    phase: z.enum(['marquee', 'capped', 'uncapped', 'accelerated-1', 'accelerated-2', 'complete']),
    currentPlayerId: z.string().nullable(),
    currentBidTeamId: z.string().nullable(),
    currentBid: z.number().int().min(0),
    currentBidIncrement: z.number().int().min(0),
    passedTeamIds: z.array(z.string()),
    awaitingUserAction: z.boolean(),
    message: z.string(),
    allowRtm: z.boolean(),
    entries: z.array(
      z.object({
        playerId: z.string(),
        phase: z.enum(['marquee', 'capped', 'uncapped', 'accelerated-1', 'accelerated-2', 'complete']),
        status: z.enum(['pending', 'sold', 'unsold']),
        soldToTeamId: z.string().nullable(),
        finalPrice: z.number().int().min(0),
      }),
    ),
    complete: z.boolean(),
  }),
  fixtures: z.array(matchSchema),
  stats: z.record(
    z.string(),
    z.object({
      playerId: z.string(),
      matches: z.number().int().min(0),
      runs: z.number().int().min(0),
      balls: z.number().int().min(0),
      wickets: z.number().int().min(0),
      overs: z.number().min(0),
      runsConceded: z.number().int().min(0),
    }),
  ),
})

const seasonSaveSchema = z.object({
  id: z.string(),
  name: z.string(),
  state: gameStateSchema,
  createdAt: z.string(),
  updatedAt: z.string(),
})

const leagueSaveSchema = z.object({
  id: z.string(),
  name: z.string(),
  activeSeasonId: z.string(),
  seasons: z.record(z.string(), seasonSaveSchema),
  createdAt: z.string(),
  updatedAt: z.string(),
})

export const gameSaveRootV3Schema = z.object({
  metadata: z.object({
    schemaVersion: z.literal(3),
    engineVersion: z.string(),
    seed: z.number().int(),
    createdAt: z.string(),
    updatedAt: z.string(),
  }),
  activeLeagueId: z.string(),
  leagues: z.record(z.string(), leagueSaveSchema),
})

export const gameSaveSchema = gameStateSchema

export type GameSave = z.infer<typeof gameStateSchema>
export type GameSaveV2 = z.infer<typeof gameStateSchema>
export type GameSaveV3 = z.infer<typeof gameSaveRootV3Schema>
export type GameSaveV1 = z.infer<typeof gameStateSchema>
