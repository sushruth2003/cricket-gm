import { createPrng } from '@/domain/prng'
import type {
  AuctionPhase,
  BattingTrait,
  BowlingStyle,
  BowlingTrait,
  FieldingTrait,
  GameState,
  LeagueConfig,
  Player,
  PlayerLastSeasonStats,
  PlayerRatings,
  PlayerRole,
  SkillRating,
  Team,
} from '@/domain/types'

const denyList = new Set([
  'Mumbai Indians',
  'Chennai Super Kings',
  'Royal Challengers Bangalore',
  'Kolkata Knight Riders',
  'Sunrisers Hyderabad',
  'Rajasthan Royals',
  'Delhi Capitals',
  'Punjab Kings',
  'Lucknow Super Giants',
  'Gujarat Titans',
])

const cityPool = ['Navapur', 'Suryanagar', 'Rajkotta', 'Vindhara', 'Malpura', 'Kaveri', 'Kalinga', 'Panchal', 'Narmad', 'Ujjira']
const brandPool = ['Strikers', 'Falcons', 'Chargers', 'Gladiators', 'Mariners', 'Rangers', 'Cyclones', 'Comets', 'Titans', 'Warhawks']
const countryTags = [
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'IN',
  'BD',
  'SL',
  'AFG',
  'AUS',
  'NZ',
  'ENG',
  'SA',
  'WI',
]
const firstNames = [
  'Aariv',
  'Kabir',
  'Ishaan',
  'Arjun',
  'Sam',
  'Noah',
  'Liam',
  'Owen',
  'Finn',
  'Theo',
  'Ethan',
  'Jacob',
  'Mason',
  'Aiden',
  'Rayan',
  'Tariq',
  'Kane',
  'Tristan',
  'Marco',
  'Keon',
]
const lastNames = [
  'Madan',
  'Rawat',
  'Bisht',
  'Perera',
  'Rahman',
  'Khan',
  'Patel',
  'Sharma',
  'Clarke',
  'Turner',
  'Miller',
  'Smith',
  'Brown',
  'Taylor',
  'OConnell',
  'van Dyk',
  'Samuels',
  'Ndlovu',
  'Fletcher',
  'Reid',
]
const colors = ['#0b1f3a', '#9d1d20', '#1f6f8b', '#f4a300', '#2f5233', '#702963', '#4b6cb7', '#7b241c', '#2e4053', '#0e6655']
const basePriceTiers = [200, 150, 125, 100, 75, 50, 40, 30]
const roleWeights: Array<{ role: PlayerRole; weight: number }> = [
  { role: 'batter', weight: 0.34 },
  { role: 'bowler', weight: 0.31 },
  { role: 'allrounder', weight: 0.25 },
  { role: 'wicketkeeper', weight: 0.1 },
]

const clamp = (value: number, min = 20, max = 99) => Math.max(min, Math.min(max, value))

const average = (values: number[]) => Math.round(values.reduce((sum, value) => sum + value, 0) / values.length)

const makeSkillRating = <TTrait extends string>(
  base: number,
  traitOffsets: Record<TTrait, number>,
): SkillRating<TTrait> => {
  const traits = {} as Record<TTrait, number>
  let total = 0

  for (const [trait, offset] of Object.entries(traitOffsets) as Array<[TTrait, number]>) {
    const traitValue = clamp(base + offset)
    traits[trait] = traitValue
    total += traitValue
  }

  return {
    overall: Math.round(total / Object.keys(traitOffsets).length),
    traits,
  }
}

const pickRoleArchetype = (roll: number): PlayerRole => {
  let cumulative = 0
  for (const { role, weight } of roleWeights) {
    cumulative += weight
    if (roll <= cumulative) {
      return role
    }
  }
  return 'batter'
}

const shiftSkill = <TTrait extends string>(
  skill: SkillRating<TTrait>,
  delta: number,
  capMin = 20,
  capMax = 99,
): SkillRating<TTrait> => {
  const nextTraits = {} as Record<TTrait, number>

  for (const [trait, traitValue] of Object.entries(skill.traits) as Array<[TTrait, number]>) {
    nextTraits[trait] = clamp(traitValue + delta, capMin, capMax)
  }

  return {
    traits: nextTraits,
    overall: average(Object.values(nextTraits)),
  }
}

const tuneRatingsForRole = (ratings: PlayerRatings, role: PlayerRole): PlayerRatings => {
  const tuned: PlayerRatings = structuredClone(ratings)

  if (role === 'batter') {
    tuned.batting = shiftSkill(tuned.batting, 6, 35, 99)
    tuned.bowling = {
      ...shiftSkill(tuned.bowling, -12, 20, 75),
      style: tuned.bowling.style,
    }
    tuned.fielding = shiftSkill(tuned.fielding, 1)
    return tuned
  }

  if (role === 'bowler') {
    tuned.batting = shiftSkill(tuned.batting, -11, 20, 76)
    tuned.bowling = {
      ...shiftSkill(tuned.bowling, 8, 42, 99),
      style: tuned.bowling.style,
    }
    tuned.fielding = shiftSkill(tuned.fielding, 1)
    return tuned
  }

  if (role === 'wicketkeeper') {
    tuned.batting = shiftSkill(tuned.batting, -1, 32, 89)
    tuned.bowling = {
      ...shiftSkill(tuned.bowling, -16, 20, 70),
      style: tuned.bowling.style,
    }
    tuned.fielding = shiftSkill(tuned.fielding, 4, 35, 99)
    tuned.fielding.traits.wicketkeeping = clamp(tuned.fielding.traits.wicketkeeping + 22, 70, 99)
    tuned.fielding.overall = average(Object.values(tuned.fielding.traits))
    return tuned
  }

  tuned.batting = shiftSkill(tuned.batting, 1, 45, 90)
  tuned.bowling = {
    ...shiftSkill(tuned.bowling, 1, 45, 88),
    style: tuned.bowling.style,
  }
  tuned.fielding = shiftSkill(tuned.fielding, 2, 35, 90)
  return tuned
}

const makeRatings = (seedValue: number, style: BowlingStyle): PlayerRatings => {
  const batting = makeSkillRating<BattingTrait>(seedValue + 6, {
    timing: 8,
    power: 4,
    placement: 5,
    runningBetweenWickets: 2,
    composure: 3,
  })

  const bowlingBias = style === 'pace' ? 4 : 2
  const bowling = makeSkillRating<BowlingTrait>(seedValue - 5 + bowlingBias, {
    accuracy: 6,
    movement: style === 'pace' ? 7 : 3,
    variations: style === 'spin' ? 7 : 4,
    control: 5,
    deathExecution: 2,
  })

  const fielding = makeSkillRating<FieldingTrait>(seedValue - 2, {
    catching: 5,
    groundFielding: 4,
    throwing: 3,
    wicketkeeping: -4,
  })

  return {
    batting,
    bowling: {
      ...bowling,
      style,
    },
    fielding,
    temperament: clamp(seedValue + 1),
    fitness: clamp(seedValue + 5),
  }
}

const makeLastSeasonStats = (prng: ReturnType<typeof createPrng>, role: PlayerRole, ratings: PlayerRatings): PlayerLastSeasonStats => {
  const matches = prng.nextInt(6, 16)
  const battingSkill = ratings.batting.overall
  const bowlingSkill = ratings.bowling.overall

  const runsBase = Math.max(0, Math.round(((battingSkill - 35) * matches * (role === 'bowler' ? 0.45 : 0.95)) / 2))
  const wicketsBase = Math.max(0, Math.round(((bowlingSkill - 35) * matches * (role === 'batter' ? 0.35 : 0.95)) / 18))

  return {
    matches,
    runs: runsBase + prng.nextInt(0, 90),
    wickets: wicketsBase + prng.nextInt(0, role === 'bowler' ? 5 : 3),
    strikeRate: clamp(90 + (battingSkill - 40) * 1.1 + prng.nextInt(-12, 18), 70, 220),
    economy: Math.max(4, Math.min(12, Number((9.2 - (bowlingSkill - 45) * 0.04 + prng.nextInt(-8, 8) / 10).toFixed(1)))),
  }
}

const regressProspectRatings = (ratings: PlayerRatings, prng: ReturnType<typeof createPrng>): PlayerRatings => {
  const battingPenalty = prng.nextInt(6, 14)
  const bowlingPenalty = prng.nextInt(6, 14)
  const fieldingPenalty = prng.nextInt(4, 11)

  return {
    batting: shiftSkill(ratings.batting, -battingPenalty, 30, 90),
    bowling: {
      ...shiftSkill(ratings.bowling, -bowlingPenalty, 30, 90),
      style: ratings.bowling.style,
    },
    fielding: shiftSkill(ratings.fielding, -fieldingPenalty, 30, 90),
    temperament: clamp(ratings.temperament - prng.nextInt(4, 12), 30, 95),
    fitness: clamp(ratings.fitness - prng.nextInt(0, 6), 35, 95),
  }
}

const projectPotential = (ratings: PlayerRatings, prng: ReturnType<typeof createPrng>) => ({
  battingOverall: clamp(ratings.batting.overall + prng.nextInt(8, 20), 35, 99),
  bowlingOverall: clamp(ratings.bowling.overall + prng.nextInt(8, 20), 35, 99),
  fieldingOverall: clamp(ratings.fielding.overall + prng.nextInt(7, 16), 35, 99),
  temperament: clamp(ratings.temperament + prng.nextInt(5, 14), 35, 99),
  fitness: clamp(ratings.fitness + prng.nextInt(4, 10), 40, 99),
})

const projectFirstClassNumbers = (
  role: PlayerRole,
  potential: {
    battingOverall: number
    bowlingOverall: number
    fieldingOverall: number
    temperament: number
    fitness: number
  },
) => {
  const battingFactor = role === 'bowler' ? 0.55 : role === 'allrounder' ? 0.88 : 1
  const bowlingFactor = role === 'batter' ? 0.45 : role === 'allrounder' ? 0.88 : 1
  const runs = Math.max(120, Math.round((potential.battingOverall - 30) * 9 * battingFactor))
  const wickets = Math.max(6, Math.round(((potential.bowlingOverall - 30) * bowlingFactor) / 2.1))
  return {
    runs,
    wickets,
    strikeRate: clamp(96 + (potential.battingOverall - 45) * 1.05, 75, 185),
    economy: Math.max(4, Math.min(8.8, Number((8.6 - (potential.bowlingOverall - 50) * 0.028).toFixed(1)))),
  }
}

const calculateProspectCount = (poolSize: number, teamCount: number): number => {
  const target = Math.max(teamCount * 2, Math.round(poolSize * 0.08))
  return Math.max(6, Math.min(target, Math.floor(poolSize * 0.2)))
}

const softenEliteAllrounders = (role: PlayerRole, ratings: PlayerRatings, prng: ReturnType<typeof createPrng>): PlayerRatings => {
  if (role !== 'allrounder') {
    return ratings
  }
  if (ratings.batting.overall < 88 || ratings.bowling.overall < 84 || prng.next() > 0.7) {
    return ratings
  }
  return {
    ...ratings,
    batting: shiftSkill(ratings.batting, -prng.nextInt(3, 7), 45, 96),
    bowling: {
      ...shiftSkill(ratings.bowling, -prng.nextInt(3, 7), 45, 95),
      style: ratings.bowling.style,
    },
  }
}

export const generateTeams = (config: LeagueConfig): Team[] => {
  const prng = createPrng(config.seasonSeed)
  const used = new Set<string>()

  return Array.from({ length: config.teamCount }, (_, index) => {
    let name = ''
    while (!name || used.has(name) || denyList.has(name)) {
      const city = cityPool[index % cityPool.length]
      const brand = brandPool[prng.nextInt(0, brandPool.length - 1)]
      name = `${city} ${brand}`
    }

    used.add(name)
    const [city, brand] = name.split(' ')

    return {
      id: `team-${index + 1}`,
      city,
      name,
      shortName: `${city.slice(0, 3).toUpperCase()}${brand.slice(0, 1).toUpperCase()}`,
      color: colors[index % colors.length],
      budgetRemaining: config.auctionBudget,
      rosterPlayerIds: [],
      playingXi: [],
      wicketkeeperPlayerId: null,
      bowlingPreset: 'balanced',
      points: 0,
      wins: 0,
      losses: 0,
      ties: 0,
      netRunRate: 0,
    }
  })
}

export const generatePlayers = (config: LeagueConfig): Player[] => {
  const prng = createPrng(config.seasonSeed + 101)
  const poolSize = config.teamCount * config.maxSquadSize
  const prospectCount = calculateProspectCount(poolSize, config.teamCount)
  const firstProspectIndex = poolSize - prospectCount

  return Array.from({ length: poolSize }, (_, index) => {
    const base = prng.nextInt(35, 88)
    const bowlingStyle: BowlingStyle = prng.next() > 0.5 ? 'pace' : 'spin'
    const targetRole = pickRoleArchetype(prng.next())
    const tunedRatings = softenEliteAllrounders(targetRole, tuneRatingsForRole(makeRatings(base, bowlingStyle), targetRole), prng)
    const role = targetRole

    const countryTag = prng.pick(countryTags)
    const isIndian = countryTag === 'IN'
    const isProspect = index >= firstProspectIndex
    const ratings = isProspect ? regressProspectRatings(tunedRatings, prng) : tunedRatings
    const capped = isProspect ? false : !isIndian || prng.next() > 0.45
    const potential = isProspect ? projectPotential(ratings, prng) : null

    return {
      id: `player-${index + 1}`,
      firstName: prng.pick(firstNames),
      lastName: prng.pick(lastNames),
      countryTag,
      capped,
      role,
      age: isProspect ? prng.nextInt(18, 21) : prng.nextInt(23, 35),
      basePrice: isProspect ? prng.nextInt(20, 40) : prng.pick(basePriceTiers),
      lastSeasonStats: makeLastSeasonStats(prng, role, ratings),
      ratings,
      development:
        isProspect && potential
          ? {
              isProspect: true,
              potential,
              firstClassProjection: projectFirstClassNumbers(role, potential),
            }
          : undefined,
      teamId: null,
    }
  })
}

export const generateYoungPlayers = (config: LeagueConfig): Player[] => {
  return generatePlayers(config).filter((player) => player.development?.isProspect)
}

const playerOverall = (player: Player) =>
  Math.round((player.ratings.batting.overall + player.ratings.bowling.overall + player.ratings.fielding.overall) / 3)

const orderPlayersForAuction = (players: Player[]): Array<{ playerId: string; phase: AuctionPhase }> => {
  const byOverall = [...players].sort((a, b) => playerOverall(b) - playerOverall(a))
  const marquee = new Set(byOverall.slice(0, Math.min(16, byOverall.length)).map((player) => player.id))

  const withRoleWeight = (list: Player[], role: Player['role'], bowlingStyle?: BowlingStyle) =>
    list
      .filter((player) => player.role === role)
      .filter((player) => !bowlingStyle || player.ratings.bowling.style === bowlingStyle)
      .sort((a, b) => playerOverall(b) - playerOverall(a))

  const remaining = players.filter((player) => !marquee.has(player.id))
  const capped = remaining.filter((player) => player.capped)
  const uncapped = remaining.filter((player) => !player.capped && player.countryTag === 'IN')

  const ordered = [
    ...byOverall.filter((player) => marquee.has(player.id)).map((player) => ({ player, phase: 'marquee' as const })),
    ...withRoleWeight(capped, 'batter').map((player) => ({ player, phase: 'capped' as const })),
    ...withRoleWeight(capped, 'allrounder').map((player) => ({ player, phase: 'capped' as const })),
    ...withRoleWeight(capped, 'wicketkeeper').map((player) => ({ player, phase: 'capped' as const })),
    ...withRoleWeight(capped, 'bowler', 'pace').map((player) => ({ player, phase: 'capped' as const })),
    ...withRoleWeight(capped, 'bowler', 'spin').map((player) => ({ player, phase: 'capped' as const })),
    ...withRoleWeight(uncapped, 'batter').map((player) => ({ player, phase: 'uncapped' as const })),
    ...withRoleWeight(uncapped, 'allrounder').map((player) => ({ player, phase: 'uncapped' as const })),
    ...withRoleWeight(uncapped, 'wicketkeeper').map((player) => ({ player, phase: 'uncapped' as const })),
    ...withRoleWeight(uncapped, 'bowler', 'pace').map((player) => ({ player, phase: 'uncapped' as const })),
    ...withRoleWeight(uncapped, 'bowler', 'spin').map((player) => ({ player, phase: 'uncapped' as const })),
  ]

  return ordered.map((item, index) => {
    if (index >= 75) {
      return { playerId: item.player.id, phase: index >= 150 ? 'accelerated-2' : 'accelerated-1' }
    }
    return { playerId: item.player.id, phase: item.phase }
  })
}

export const createInitialState = (seed: number): GameState => {
  const config: LeagueConfig = {
    teamCount: 10,
    format: 'T20',
    auctionBudget: 12_000,
    minSquadSize: 18,
    maxSquadSize: 25,
    seasonSeed: seed,
  }

  const teams = generateTeams(config)
  const players = generatePlayers(config)
  const entries = orderPlayersForAuction(players)
  const firstPlayerId = entries[0]?.playerId ?? null
  const firstPlayerBase = players.find((player) => player.id === firstPlayerId)?.basePrice ?? 0

  return {
    metadata: {
      schemaVersion: 2,
      engineVersion: '0.2.0',
      seed,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    },
    config,
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
      phase: entries[0]?.phase ?? 'complete',
      currentPlayerId: firstPlayerId,
      currentBidTeamId: null,
      currentBid: 0,
      currentBidIncrement: firstPlayerBase,
      passedTeamIds: [],
      awaitingUserAction: true,
      message: 'Free-for-all opening auction (Season 1): no RTM or retention rights.',
      allowRtm: false,
      entries: entries.map((entry) => ({
        playerId: entry.playerId,
        phase: entry.phase,
        status: 'pending',
        soldToTeamId: null,
        finalPrice: 0,
      })),
      complete: false,
    },
    fixtures: [],
    stats: {},
  }
}
