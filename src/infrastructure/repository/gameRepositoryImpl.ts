import { gameSaveSchema } from '@/application/contracts'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'
import type { SqliteStore } from '@/infrastructure/repository/sqliteStore'

const SAVE_ID = 'primary'
const ENGINE_VERSION = '0.2.0'

const clamp = (value: number, min = 1, max = 99): number => Math.max(min, Math.min(max, value))

const asNumber = (value: unknown, fallback: number): number => (typeof value === 'number' && Number.isFinite(value) ? value : fallback)
const asInteger = (value: unknown, fallback: number): number => Math.trunc(asNumber(value, fallback))
const asString = (value: unknown, fallback: string): string => (typeof value === 'string' && value.length > 0 ? value : fallback)
const asNullableString = (value: unknown): string | null => (typeof value === 'string' ? value : null)
const asBoolean = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback)
const asIsoDateString = (value: unknown, fallback: string): string => {
  if (typeof value !== 'string') {
    return fallback
  }
  const parsed = Date.parse(value)
  return Number.isFinite(parsed) ? new Date(parsed).toISOString() : fallback
}

const normalizeRole = (value: unknown): 'batter' | 'bowler' | 'wicketkeeper' | 'allrounder' | null => {
  if (value === 'batter' || value === 'bowler' || value === 'wicketkeeper' || value === 'allrounder') {
    return value
  }
  if (value === 'bat') {
    return 'batter'
  }
  if (value === 'all') {
    return 'allrounder'
  }
  if (value === 'wk') {
    return 'wicketkeeper'
  }
  if (value === 'pace' || value === 'spin') {
    return 'bowler'
  }
  return null
}

const normalizeBowlingStyle = (value: unknown): 'pace' | 'spin' | null => {
  if (value === 'pace' || value === 'spin') {
    return value
  }
  return null
}

const repairLegacySave = (raw: unknown): unknown => {
  const root =
    raw &&
    typeof raw === 'object' &&
    'state' in (raw as Record<string, unknown>) &&
    (raw as Record<string, unknown>).state &&
    typeof (raw as Record<string, unknown>).state === 'object'
      ? ((raw as Record<string, unknown>).state as unknown)
      : raw

  if (!root || typeof root !== 'object') {
    return root
  }

  const mutable = structuredClone(root) as Record<string, unknown>
  const nowIso = new Date().toISOString()

  const playersInput = Array.isArray(mutable.players) ? mutable.players : []
  const normalizedPlayers = playersInput.map((candidate, index) => {
    const player = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {}
    const ratings = player.ratings && typeof player.ratings === 'object' ? (player.ratings as Record<string, unknown>) : {}
    const battingRatings = ratings.batting && typeof ratings.batting === 'object' ? (ratings.batting as Record<string, unknown>) : {}
    const bowlingRatings = ratings.bowling && typeof ratings.bowling === 'object' ? (ratings.bowling as Record<string, unknown>) : {}
    const fieldingRatings = ratings.fielding && typeof ratings.fielding === 'object' ? (ratings.fielding as Record<string, unknown>) : {}
    const battingTraits =
      battingRatings.traits && typeof battingRatings.traits === 'object'
        ? (battingRatings.traits as Record<string, unknown>)
        : {}
    const bowlingTraits =
      bowlingRatings.traits && typeof bowlingRatings.traits === 'object'
        ? (bowlingRatings.traits as Record<string, unknown>)
        : {}
    const fieldingTraits =
      fieldingRatings.traits && typeof fieldingRatings.traits === 'object'
        ? (fieldingRatings.traits as Record<string, unknown>)
        : {}

    const battingLegacy = asNumber(battingRatings.overall, asNumber(ratings.batting, asNumber(player.overall, 50)))
    const paceLegacy = asNumber(bowlingTraits.movement, asNumber(ratings.paceBowling, 45))
    const spinLegacy = asNumber(bowlingTraits.variations, asNumber(ratings.spinBowling, 45))
    const fieldingLegacy = asNumber(fieldingRatings.overall, asNumber(ratings.fielding, 50))
    const keepingLegacy = asNumber(fieldingTraits.wicketkeeping, asNumber(ratings.wicketKeeping, 40))
    const temperamentLegacy = asNumber(ratings.temperament, 50)
    const fitnessLegacy = asNumber(ratings.fitness, 50)
    const rolesLegacy = Array.isArray(player.roles) ? player.roles.filter((value): value is string => typeof value === 'string') : []
    const legacyRoleFromArray =
      rolesLegacy
        .map((value) => normalizeRole(value))
        .find((value): value is 'batter' | 'bowler' | 'wicketkeeper' | 'allrounder' => value !== null) ?? null
    const inferredRole =
      normalizeRole(player.role) ??
      legacyRoleFromArray ??
      (keepingLegacy >= 70
        ? 'wicketkeeper'
        : battingLegacy >= 62 && Math.max(paceLegacy, spinLegacy) >= 58
          ? 'allrounder'
          : Math.max(paceLegacy, spinLegacy) >= 60
            ? 'bowler'
            : 'batter')
    const inferredStyle = normalizeBowlingStyle(bowlingRatings.style) ?? (paceLegacy >= spinLegacy ? 'pace' : 'spin')

    return {
      id: asString(player.id, `player-${index + 1}`),
      firstName: asString(player.firstName, 'Player'),
      lastName: asString(player.lastName, String(index + 1)),
      countryTag: asString(player.countryTag, 'IN'),
      role: inferredRole,
      basePrice: Math.max(1, asInteger(player.basePrice, 10)),
      ratings: {
        batting: {
          overall: clamp(asNumber(battingRatings.overall, battingLegacy)),
          traits: {
            timing: clamp(asNumber(battingTraits.timing, battingLegacy + 2)),
            power: clamp(asNumber(battingTraits.power, battingLegacy - 1)),
            placement: clamp(asNumber(battingTraits.placement, battingLegacy + 1)),
            runningBetweenWickets: clamp(asNumber(battingTraits.runningBetweenWickets, battingLegacy - 2)),
            composure: clamp(asNumber(battingTraits.composure, temperamentLegacy)),
          },
        },
        bowling: {
          style: inferredStyle,
          overall: clamp(asNumber(bowlingRatings.overall, Math.max(paceLegacy, spinLegacy))),
          traits: {
            accuracy: clamp(asNumber(bowlingTraits.accuracy, (paceLegacy + spinLegacy) / 2)),
            movement: clamp(asNumber(bowlingTraits.movement, paceLegacy)),
            variations: clamp(asNumber(bowlingTraits.variations, spinLegacy)),
            control: clamp(asNumber(bowlingTraits.control, (paceLegacy + spinLegacy) / 2 - 1)),
            deathExecution: clamp(asNumber(bowlingTraits.deathExecution, Math.max(paceLegacy, spinLegacy) - 2)),
          },
        },
        fielding: {
          overall: clamp(asNumber(fieldingRatings.overall, fieldingLegacy)),
          traits: {
            catching: clamp(asNumber(fieldingTraits.catching, fieldingLegacy + 1)),
            groundFielding: clamp(asNumber(fieldingTraits.groundFielding, fieldingLegacy)),
            throwing: clamp(asNumber(fieldingTraits.throwing, fieldingLegacy - 1)),
            wicketkeeping: clamp(asNumber(fieldingTraits.wicketkeeping, keepingLegacy)),
          },
        },
        temperament: clamp(temperamentLegacy),
        fitness: clamp(fitnessLegacy),
      },
      teamId: asNullableString(player.teamId),
    }
  })
  mutable.players = normalizedPlayers
  const roleByPlayerId = new Map(normalizedPlayers.map((player) => [player.id, player.role]))

  const teamsInput = Array.isArray(mutable.teams) ? mutable.teams : []
  const normalizedTeams = teamsInput.map((candidate, index) => {
    const team = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {}
    const rosterPlayerIds = Array.isArray(team.rosterPlayerIds)
      ? team.rosterPlayerIds.filter((value): value is string => typeof value === 'string')
      : []
    const playingXi = Array.isArray(team.playingXi)
      ? team.playingXi.filter((value): value is string => typeof value === 'string')
      : rosterPlayerIds.slice(0, 11)
    const wicketkeeperPlayerIdRaw =
      asNullableString(team.wicketkeeperPlayerId) ??
      playingXi.find((playerId) => roleByPlayerId.get(playerId) === 'wicketkeeper') ??
      null
    const wicketkeeperPlayerId =
      wicketkeeperPlayerIdRaw && playingXi.includes(wicketkeeperPlayerIdRaw) ? wicketkeeperPlayerIdRaw : null
    const bowlingPreset =
      team.bowlingPreset === 'balanced' || team.bowlingPreset === 'aggressive' || team.bowlingPreset === 'defensive'
        ? team.bowlingPreset
        : 'balanced'
    const city = asString(team.city, `Team ${index + 1}`)
    const name = asString(team.name, city)

    return {
      id: asString(team.id, `team-${index + 1}`),
      city,
      name,
      shortName: asString(team.shortName, city.slice(0, 3).toUpperCase()),
      color: asString(team.color, '#0b1f3a'),
      budgetRemaining: Math.max(0, asInteger(team.budgetRemaining, 0)),
      rosterPlayerIds,
      playingXi: playingXi.slice(0, 11),
      wicketkeeperPlayerId,
      bowlingPreset,
      points: asInteger(team.points, 0),
      wins: asInteger(team.wins, 0),
      losses: asInteger(team.losses, 0),
      ties: asInteger(team.ties, 0),
      netRunRate: asNumber(team.netRunRate, 0),
    }
  })
  mutable.teams = normalizedTeams

  const metadata = mutable.metadata && typeof mutable.metadata === 'object' ? (mutable.metadata as Record<string, unknown>) : {}
  const config = mutable.config && typeof mutable.config === 'object' ? (mutable.config as Record<string, unknown>) : {}
  const simulation =
    mutable.simulation && typeof mutable.simulation === 'object' ? (mutable.simulation as Record<string, unknown>) : {}

  const defaultSeed = asInteger(metadata.seed, asInteger(config.seasonSeed, Date.now() % 1_000_000_000))
  const defaultTeamCount = Math.max(2, Math.min(20, normalizedTeams.length || 10))

  mutable.metadata = {
    schemaVersion: 2,
    engineVersion: asString(metadata.engineVersion, ENGINE_VERSION),
    seed: defaultSeed,
    createdAt: asIsoDateString(metadata.createdAt, nowIso),
    updatedAt: asIsoDateString(metadata.updatedAt, nowIso),
  }

  mutable.config = {
    teamCount: Math.max(2, Math.min(20, asInteger(config.teamCount, defaultTeamCount))),
    format: 'T20',
    auctionBudget: Math.max(1, asInteger(config.auctionBudget, 1_500)),
    minSquadSize: Math.max(11, asInteger(config.minSquadSize, 20)),
    maxSquadSize: Math.max(11, asInteger(config.maxSquadSize, 25)),
    seasonSeed: asInteger(config.seasonSeed, defaultSeed),
  }

  mutable.simulation = {
    deterministicCore: asBoolean(simulation.deterministicCore, true),
    liveViewNarrationMode: 'non_authoritative',
  }

  mutable.phase =
    mutable.phase === 'auction' ||
    mutable.phase === 'regular-season' ||
    mutable.phase === 'playoffs' ||
    mutable.phase === 'complete'
      ? mutable.phase
      : 'auction'

  const userTeamId = asString(mutable.userTeamId, normalizedTeams[0]?.id ?? 'team-1')
  mutable.userTeamId = normalizedTeams.some((team) => team.id === userTeamId)
    ? userTeamId
    : (normalizedTeams[0]?.id ?? 'team-1')

  const fixturesInput = Array.isArray(mutable.fixtures) ? mutable.fixtures : []
  mutable.fixtures = fixturesInput.map((candidate, index) => {
    const fixture = candidate && typeof candidate === 'object' ? (candidate as Record<string, unknown>) : {}
    const inningsValue = Array.isArray(fixture.innings) && fixture.innings.length === 2 ? fixture.innings : null
    const innings =
      inningsValue === null
        ? null
        : inningsValue.map((inningsCandidate) => {
            const inningsRecord =
              inningsCandidate && typeof inningsCandidate === 'object' ? (inningsCandidate as Record<string, unknown>) : {}
            const battingLines = Array.isArray(inningsRecord.batting) ? inningsRecord.batting : []
            const bowlingLines = Array.isArray(inningsRecord.bowling) ? inningsRecord.bowling : []

            return {
              battingTeamId: asString(inningsRecord.battingTeamId, asString(fixture.homeTeamId, 'team-1')),
              bowlingTeamId: asString(inningsRecord.bowlingTeamId, asString(fixture.awayTeamId, 'team-2')),
              wicketkeeperPlayerId: asNullableString(inningsRecord.wicketkeeperPlayerId),
              runs: Math.max(0, asInteger(inningsRecord.runs, 0)),
              wickets: Math.max(0, Math.min(10, asInteger(inningsRecord.wickets, 0))),
              overs: Math.max(0, Math.min(20, asNumber(inningsRecord.overs, 0))),
              batting: battingLines.map((lineCandidate) => {
                const line = lineCandidate && typeof lineCandidate === 'object' ? (lineCandidate as Record<string, unknown>) : {}
                return {
                  playerId: asString(line.playerId, ''),
                  runs: Math.max(0, asInteger(line.runs, 0)),
                  balls: Math.max(0, asInteger(line.balls, 0)),
                  fours: Math.max(0, asInteger(line.fours, 0)),
                  sixes: Math.max(0, asInteger(line.sixes, 0)),
                  out: asBoolean(line.out, false),
                }
              }),
              bowling: bowlingLines.map((lineCandidate) => {
                const line = lineCandidate && typeof lineCandidate === 'object' ? (lineCandidate as Record<string, unknown>) : {}
                return {
                  playerId: asString(line.playerId, ''),
                  overs: Math.max(0, Math.min(4, asNumber(line.overs, 0))),
                  runsConceded: Math.max(0, asInteger(line.runsConceded, 0)),
                  wickets: Math.max(0, asInteger(line.wickets, 0)),
                }
              }),
            }
          })

    return {
      id: asString(fixture.id, `match-${index + 1}`),
      homeTeamId: asString(fixture.homeTeamId, normalizedTeams[0]?.id ?? 'team-1'),
      awayTeamId: asString(fixture.awayTeamId, normalizedTeams[1]?.id ?? normalizedTeams[0]?.id ?? 'team-1'),
      venue: asString(fixture.venue, 'Unknown'),
      round: Math.max(1, asInteger(fixture.round, 1)),
      played: asBoolean(fixture.played, false),
      winnerTeamId: asNullableString(fixture.winnerTeamId),
      margin: asString(fixture.margin, ''),
      innings: innings ? ([innings[0], innings[1]] as const) : null,
    }
  })

  const auction = mutable.auction && typeof mutable.auction === 'object' ? (mutable.auction as Record<string, unknown>) : {}
  const auctionEntries = Array.isArray(auction.entries) ? auction.entries : []
  const fallbackEntries = normalizedPlayers.map((player) => ({ playerId: player.id, soldToTeamId: null, finalPrice: 0 }))
  mutable.auction = {
    currentNominationIndex: Math.max(0, asInteger(auction.currentNominationIndex, 0)),
    entries:
      auctionEntries.length > 0
        ? auctionEntries.map((entryCandidate) => {
            const entry = entryCandidate && typeof entryCandidate === 'object' ? (entryCandidate as Record<string, unknown>) : {}
            return {
              playerId: asString(entry.playerId, ''),
              soldToTeamId: asNullableString(entry.soldToTeamId),
              finalPrice: Math.max(0, asInteger(entry.finalPrice, 0)),
            }
          })
        : fallbackEntries,
    complete: asBoolean(auction.complete, false),
  }

  const statsInput = mutable.stats && typeof mutable.stats === 'object' ? (mutable.stats as Record<string, unknown>) : {}
  const stats: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(statsInput)) {
    const line = value && typeof value === 'object' ? (value as Record<string, unknown>) : {}
    stats[key] = {
      playerId: asString(line.playerId, key),
      matches: Math.max(0, asInteger(line.matches, 0)),
      runs: Math.max(0, asInteger(line.runs, 0)),
      balls: Math.max(0, asInteger(line.balls, 0)),
      wickets: Math.max(0, asInteger(line.wickets, 0)),
      overs: Math.max(0, asNumber(line.overs, 0)),
      runsConceded: Math.max(0, asInteger(line.runsConceded, 0)),
    }
  }
  mutable.stats = stats

  return mutable
}

export class GameRepositoryImpl implements GameRepository {
  constructor(private readonly store: SqliteStore) {}

  private async quarantineCorruptPayload(payload: string): Promise<void> {
    const backupId = `${SAVE_ID}-corrupt-${Date.now()}`
    try {
      await this.store.writeState(backupId, payload)
    } catch (error) {
      console.warn('[storage] failed to backup corrupt save payload', error)
    }
    await this.store.clearState(SAVE_ID)
  }

  async load(): Promise<GameState | null> {
    const payload = await this.store.readState(SAVE_ID)
    if (!payload) {
      return null
    }

    let data: unknown
    try {
      data = JSON.parse(payload)
    } catch (error) {
      console.warn('[storage] dropping invalid JSON save payload', error)
      await this.quarantineCorruptPayload(payload)
      return null
    }
    if (typeof data === 'string') {
      try {
        data = JSON.parse(data)
      } catch {
        // Continue with original parsed value and let schema validation decide.
      }
    }

    const parsed = gameSaveSchema.safeParse(data)
    if (!parsed.success) {
      const repaired = repairLegacySave(data)
      const repairedParsed = gameSaveSchema.safeParse(repaired)
      if (!repairedParsed.success) {
        console.warn('[storage] dropping unrecoverable save payload', repairedParsed.error.issues)
        await this.quarantineCorruptPayload(payload)
        return null
      }
      await this.store.writeState(SAVE_ID, JSON.stringify(repairedParsed.data))
      return repairedParsed.data
    }

    return parsed.data
  }

  async save(state: GameState): Promise<void> {
    await this.store.writeState(SAVE_ID, JSON.stringify(state))
  }

  async transaction<T>(run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>): Promise<T> {
    const current = await this.load()
    const snapshot = current ? JSON.stringify(current) : null

    try {
      const outcome = await run(current ? structuredClone(current) : null)
      if (outcome.nextState) {
        await this.save(outcome.nextState)
      }
      return outcome.result
    } catch (error) {
      if (snapshot) {
        await this.store.writeState(SAVE_ID, snapshot)
      }
      throw error
    }
  }

  async reset(): Promise<void> {
    await this.store.clearState(SAVE_ID)
  }
}
