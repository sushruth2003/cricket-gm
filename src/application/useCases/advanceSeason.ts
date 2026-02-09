import { ValidationError } from '@/domain/errors'
import { getAuctionOpeningMessage } from '@/domain/auction/policyHooks'
import { orderPlayersForAuction, createInitialStateWithOptions, generateYoungPlayers } from '@/domain/generator'
import { resolveAuctionPolicy } from '@/domain/policy/resolver'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState, Player } from '@/domain/types'

const PLAYER_RELEASES_PER_TEAM = 4

const playerOverall = (player: Player): number =>
  Math.round((player.ratings.batting.overall + player.ratings.bowling.overall + player.ratings.fielding.overall) / 3)

const parseSeasonNumber = (seasonId: string): number => {
  const match = seasonId.match(/season-(\d+)/)
  if (!match) {
    return 1
  }
  const value = Number.parseInt(match[1], 10)
  return Number.isFinite(value) ? value : 1
}

const nextSeasonIdentity = (activeSeasonId: string, seasonYear: number): { seasonId: string; seasonName: string } => {
  const seasonNumber = parseSeasonNumber(activeSeasonId) + 1
  return {
    seasonId: `season-${seasonNumber}`,
    seasonName: `Season ${seasonNumber} (${seasonYear})`,
  }
}

const applyMiniAuctionCarryover = (state: GameState, purse: number): GameState => {
  const next = structuredClone(state)
  const playersById = new Map(next.players.map((player) => [player.id, player]))

  for (const player of next.players) {
    const line = state.stats[player.id]
    player.lastSeasonStats = {
      matches: line?.matches ?? 0,
      runs: line?.runs ?? 0,
      wickets: line?.wickets ?? 0,
      strikeRate: line && line.balls > 0 ? Number(((line.runs * 100) / line.balls).toFixed(2)) : 0,
      economy: line && line.overs > 0 ? Number((line.runsConceded / line.overs).toFixed(2)) : 0,
    }
    if (typeof player.age === 'number') {
      player.age = Math.min(50, player.age + 1)
    }
  }

  for (const team of next.teams) {
    const roster = team.rosterPlayerIds
      .map((playerId) => playersById.get(playerId))
      .filter((player): player is Player => Boolean(player))
      .sort((a, b) => playerOverall(b) - playerOverall(a))

    const retainCount = Math.max(next.config.minSquadSize, roster.length - PLAYER_RELEASES_PER_TEAM)
    const retained = roster.slice(0, retainCount)
    const released = roster.slice(retainCount)

    for (const player of released) {
      player.teamId = null
    }

    team.rosterPlayerIds = retained.map((player) => player.id)
    team.playingXi = team.rosterPlayerIds.slice(0, 11)
    team.wicketkeeperPlayerId =
      team.playingXi.find((playerId) => playersById.get(playerId)?.role === 'wicketkeeper') ?? (team.playingXi[0] ?? null)
    team.points = 0
    team.wins = 0
    team.losses = 0
    team.ties = 0
    team.netRunRate = 0

    const retainedCost = retained.reduce((sum, player) => sum + player.basePrice, 0)
    team.budgetRemaining = Math.max(0, purse - retainedCost)
  }

  const youngPool = generateYoungPlayers(next.config)
  const existingIds = new Set(next.players.map((player) => player.id))
  for (const youngPlayer of youngPool) {
    if (existingIds.has(youngPlayer.id)) {
      continue
    }
    next.players.push({ ...youngPlayer, teamId: null })
    existingIds.add(youngPlayer.id)
  }

  const entries = orderPlayersForAuction(next.players.filter((player) => player.teamId === null))
  const firstPlayerId = entries[0]?.playerId ?? null
  const firstBidIncrement = next.players.find((player) => player.id === firstPlayerId)?.basePrice ?? 0

  next.auction = {
    currentNominationIndex: 0,
    phase: entries[0]?.phase ?? 'complete',
    currentPlayerId: firstPlayerId,
    currentBidTeamId: null,
    currentBid: 0,
    currentBidIncrement: firstBidIncrement,
    passedTeamIds: [],
    awaitingUserAction: true,
    message: '',
    allowRtm: false,
    entries: entries.map((entry) => ({
      playerId: entry.playerId,
      phase: entry.phase,
      status: 'pending',
      soldToTeamId: null,
      finalPrice: 0,
    })),
    complete: false,
  }
  next.fixtures = []
  next.stats = {}
  next.phase = 'auction'
  return next
}

export const advanceSeason = async (repository: GameRepository, leagueId?: string): Promise<GameState> => {
  const targetLeagueId = leagueId ?? (await repository.getActiveLeagueId())
  if (!targetLeagueId) {
    throw new ValidationError('No league loaded')
  }

  const current = await repository.load(targetLeagueId)
  if (!current) {
    throw new ValidationError('No league loaded')
  }
  if (current.phase !== 'complete') {
    throw new ValidationError('Current season must be complete before advancing')
  }

  const activeLeague = (await repository.listLeagues()).find((league) => league.id === targetLeagueId)
  if (!activeLeague) {
    throw new ValidationError('Active league metadata not found')
  }

  const currentSeasonYear = new Date(current.metadata.createdAt).getUTCFullYear()
  const nextSeasonYear = Number.isFinite(currentSeasonYear) ? currentSeasonYear + 1 : new Date().getUTCFullYear() + 1
  const policySet = current.config.policySet
  const resolvedPolicy = resolveAuctionPolicy({
    policySet,
    seasonYear: nextSeasonYear,
  })
  const seasonStartIso = `${nextSeasonYear}-01-01T00:00:00.000Z`
  const nextSeed = (current.metadata.seed + 10_007) % 1_000_000_000

  const next =
    resolvedPolicy.auctionType === 'mini'
      ? applyMiniAuctionCarryover(
          {
            ...structuredClone(current),
            config: {
              ...current.config,
              policySet,
              auctionBudget: resolvedPolicy.policy.purse,
              minSquadSize: resolvedPolicy.policy.squadMin,
              maxSquadSize: resolvedPolicy.policy.squadMax,
              seasonSeed: nextSeed,
            },
          },
          resolvedPolicy.policy.purse,
        )
      : createInitialStateWithOptions(nextSeed, {
          seasonStartIso,
          policyContext: {
            policySet,
            seasonYear: nextSeasonYear,
          },
        })

  if (resolvedPolicy.auctionType === 'mini') {
    next.auction.message = getAuctionOpeningMessage(resolvedPolicy)
    next.auction.allowRtm = resolvedPolicy.policy.rtmEnabled
    next.metadata.seed = nextSeed
    next.metadata.createdAt = seasonStartIso
    next.metadata.updatedAt = seasonStartIso
    next.config.seasonSeed = nextSeed
    next.config.auctionBudget = resolvedPolicy.policy.purse
    next.config.minSquadSize = resolvedPolicy.policy.squadMin
    next.config.maxSquadSize = resolvedPolicy.policy.squadMax
  }

  const sameTeam = next.teams.find((team) => team.shortName === current.teams.find((candidate) => candidate.id === current.userTeamId)?.shortName)
  if (sameTeam) {
    next.userTeamId = sameTeam.id
  }

  const { seasonId, seasonName } = nextSeasonIdentity(activeLeague.activeSeasonId, nextSeasonYear)
  await repository.createSeason(targetLeagueId, seasonId, seasonName, next)
  return next
}
