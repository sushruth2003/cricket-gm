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

const clamp = (value: number, min = 20, max = 99) => Math.max(min, Math.min(max, value))

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

const deriveRole = (ratings: PlayerRatings): PlayerRole => {
  const batting = ratings.batting.overall
  const bowling = ratings.bowling.overall
  const keeping = ratings.fielding.traits.wicketkeeping

  if (batting >= 65 && bowling >= 60) {
    return 'allrounder'
  }
  if (bowling >= 62) {
    return 'bowler'
  }
  if (keeping >= 78 && batting >= 50 && bowling <= 70) {
    return 'wicketkeeper'
  }
  return 'batter'
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

  return Array.from({ length: poolSize }, (_, index) => {
    const base = prng.nextInt(35, 88)
    const bowlingStyle: BowlingStyle = prng.next() > 0.5 ? 'pace' : 'spin'
    const ratings = makeRatings(base, bowlingStyle)
    const role = deriveRole(ratings)

    // Slight role bias to make auction and lineups feel coherent.
    if (role === 'bowler') {
      ratings.bowling.overall = clamp(ratings.bowling.overall + 4)
    }
    if (role === 'batter') {
      ratings.batting.overall = clamp(ratings.batting.overall + 4)
    }
    if (role === 'wicketkeeper') {
      ratings.bowling.overall = clamp(ratings.bowling.overall - 10)
      ratings.fielding.traits.wicketkeeping = clamp(ratings.fielding.traits.wicketkeeping + 10)
      ratings.fielding.overall = clamp(
        Math.round(
          (ratings.fielding.traits.catching +
            ratings.fielding.traits.groundFielding +
            ratings.fielding.traits.throwing +
            ratings.fielding.traits.wicketkeeping) /
            4,
        ),
      )
    }

    const countryTag = prng.pick(countryTags)
    const isIndian = countryTag === 'IN'
    const capped = !isIndian || prng.next() > 0.45

    return {
      id: `player-${index + 1}`,
      firstName: prng.pick(firstNames),
      lastName: prng.pick(lastNames),
      countryTag,
      capped,
      role,
      basePrice: prng.pick(basePriceTiers),
      ratings,
      teamId: null,
    }
  })
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
