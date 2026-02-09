import { createPrng } from '@/domain/prng'
import type { AuctionEntry, AuctionPhase, GameState, Player, Team } from '@/domain/types'

const MAX_OVERSEAS_PLAYERS = 8
const MIN_SPEND = 9_000
const MIN_PLAYER_BASE = 30

export type UserAuctionAction = 'bid' | 'pass' | 'auto'

const playerOverall = (player: Player) =>
  Math.round((player.ratings.batting.overall + player.ratings.bowling.overall + player.ratings.fielding.overall) / 3)

const isOverseas = (player: Player) => player.countryTag !== 'IN'

const getBidIncrement = (currentBid: number, phase: AuctionPhase): number => {
  let increment = 5
  if (currentBid >= 500) {
    increment = 50
  } else if (currentBid >= 200) {
    increment = 25
  } else if (currentBid >= 100) {
    increment = 20
  }

  if (phase === 'accelerated-1') {
    return Math.max(increment, 20)
  }
  if (phase === 'accelerated-2') {
    return Math.max(increment, 50)
  }
  return increment
}

const getTeamOverseasCount = (state: GameState, team: Team): number => {
  const rosterIds = new Set(team.rosterPlayerIds)
  return state.players.filter((player) => rosterIds.has(player.id) && isOverseas(player)).length
}

const reservedForMinimumSquad = (team: Team, currentBid: number, minSquadSize: number) => {
  const rosterAfterWin = team.rosterPlayerIds.length + 1
  const remainingSlotsToMin = Math.max(0, minSquadSize - rosterAfterWin)
  return remainingSlotsToMin * MIN_PLAYER_BASE + currentBid
}

const canTeamBid = (state: GameState, team: Team, player: Player, bid: number): boolean => {
  if (team.rosterPlayerIds.length >= 25) {
    return false
  }

  if (isOverseas(player) && getTeamOverseasCount(state, team) >= MAX_OVERSEAS_PLAYERS) {
    return false
  }

  const reserve = reservedForMinimumSquad(team, bid, state.config.minSquadSize)
  if (team.budgetRemaining < reserve) {
    return false
  }

  return true
}

const entryByPlayerId = (entries: AuctionEntry[], playerId: string) => entries.find((entry) => entry.playerId === playerId)

const resolvePhase = (entry: AuctionEntry | undefined): AuctionPhase => {
  if (!entry) {
    return 'complete'
  }
  if (entry.phase === 'accelerated-1' || entry.phase === 'accelerated-2') {
    return entry.phase
  }
  return entry.phase
}

const assignPlayerToTeam = (player: Player, team: Team, price: number) => {
  if (team.rosterPlayerIds.includes(player.id) || player.teamId) {
    return
  }
  player.teamId = team.id
  team.rosterPlayerIds.push(player.id)
  team.budgetRemaining -= price

  if (team.playingXi.length < 11) {
    team.playingXi.push(player.id)
  }
  if (!team.wicketkeeperPlayerId && player.role === 'wicketkeeper') {
    team.wicketkeeperPlayerId = player.id
  }
}

const finalizeWicketkeepers = (state: GameState) => {
  const playerById = new Map(state.players.map((player) => [player.id, player]))

  for (const team of state.teams) {
    const xi = team.playingXi.filter((playerId) => team.rosterPlayerIds.includes(playerId)).slice(0, 11)
    if (xi.length < 11) {
      const bench = team.rosterPlayerIds.filter((playerId) => !xi.includes(playerId))
      xi.push(...bench.slice(0, Math.max(0, 11 - xi.length)))
    }
    team.playingXi = xi

    const wkInXi = xi.find((playerId) => playerById.get(playerId)?.role === 'wicketkeeper')
    if (wkInXi) {
      team.wicketkeeperPlayerId = wkInXi
      continue
    }

    const squadWk = team.rosterPlayerIds.find((playerId) => playerById.get(playerId)?.role === 'wicketkeeper') ?? null
    if (squadWk && !xi.includes(squadWk)) {
      if (xi.length < 11) {
        xi.push(squadWk)
      } else if (xi.length > 0) {
        xi[xi.length - 1] = squadWk
      }
      team.playingXi = xi
      team.wicketkeeperPlayerId = squadWk
      continue
    }

    team.wicketkeeperPlayerId = xi[0] ?? null
  }
}

const enforceMinimumSpend = (state: GameState) => {
  for (const team of state.teams) {
    const spent = state.config.auctionBudget - team.budgetRemaining
    if (spent < MIN_SPEND) {
      team.budgetRemaining -= MIN_SPEND - spent
    }
  }
}

const forceFillMinimumSquads = (state: GameState) => {
  for (const team of state.teams) {
    while (team.rosterPlayerIds.length < state.config.minSquadSize) {
      const nextEntry = state.auction.entries.find((entry) => {
        if (entry.status !== 'unsold') {
          return false
        }
        const player = state.players.find((candidate) => candidate.id === entry.playerId)
        if (!player || player.teamId) {
          return false
        }
        return canTeamBid(state, team, player, player.basePrice)
      })

      if (!nextEntry) {
        break
      }

      const player = state.players.find((candidate) => candidate.id === nextEntry.playerId)
      if (!player) {
        break
      }

      assignPlayerToTeam(player, team, player.basePrice)
      nextEntry.status = 'sold'
      nextEntry.soldToTeamId = team.id
      nextEntry.finalPrice = player.basePrice
    }
  }
}

const closeCurrentLot = (state: GameState, sold: boolean) => {
  const currentPlayerId = state.auction.currentPlayerId
  if (!currentPlayerId) {
    return
  }
  const entry = entryByPlayerId(state.auction.entries, currentPlayerId)
  if (!entry) {
    return
  }

  if (!sold) {
    entry.status = 'unsold'
    entry.soldToTeamId = null
    entry.finalPrice = 0
  }

  state.auction.currentNominationIndex += 1
  state.auction.currentPlayerId = null
  state.auction.currentBid = 0
  state.auction.currentBidIncrement = 0
  state.auction.currentBidTeamId = null
  state.auction.passedTeamIds = []
  state.auction.awaitingUserAction = false
}

const openNextLot = (state: GameState) => {
  while (state.auction.currentNominationIndex < state.auction.entries.length) {
    const nextEntry = state.auction.entries[state.auction.currentNominationIndex]
    const player = state.players.find((candidate) => candidate.id === nextEntry.playerId)
    if (!player || player.teamId || nextEntry.status !== 'pending') {
      state.auction.currentNominationIndex += 1
      continue
    }

    state.auction.currentPlayerId = player.id
    state.auction.phase = resolvePhase(nextEntry)
    state.auction.message = `Lot ${state.auction.currentNominationIndex + 1}: ${player.firstName} ${player.lastName}`
    return
  }

  forceFillMinimumSquads(state)
  finalizeWicketkeepers(state)
  enforceMinimumSpend(state)

  state.auction.complete = true
  state.auction.phase = 'complete'
  state.auction.currentPlayerId = null
  state.auction.awaitingUserAction = false
  state.phase = 'regular-season'
}

const teamIntentValue = (team: Team, player: Player, state: GameState) => {
  const needFactor = team.rosterPlayerIds.length < 18 ? 160 : team.rosterPlayerIds.length < 22 ? 75 : 25
  const balanceBoost =
    player.role === 'wicketkeeper' && !team.rosterPlayerIds.some((playerId) => state.players.find((p) => p.id === playerId)?.role === 'wicketkeeper')
      ? 60
      : 0
  return player.basePrice + playerOverall(player) * 2 + needFactor + balanceBoost
}

const chooseAiBidder = (state: GameState, player: Player, nextBid: number): Team | null => {
  const seed =
    state.metadata.seed +
    state.auction.currentNominationIndex * 97 +
    state.auction.currentBid * 13 +
    state.auction.passedTeamIds.length * 7
  const prng = createPrng(seed)

  const candidates = state.teams
    .filter((team) => team.id !== state.userTeamId)
    .filter((team) => team.id !== state.auction.currentBidTeamId)
    .filter((team) => !state.auction.passedTeamIds.includes(team.id))
    .filter((team) => canTeamBid(state, team, player, nextBid))
    .map((team) => {
      const value = teamIntentValue(team, player, state) + prng.nextInt(0, 35)
      return { team, value }
    })
    .filter(({ value }) => value >= nextBid)
    .sort((a, b) => b.value - a.value)

  return candidates[0]?.team ?? null
}

const applyBid = (state: GameState, teamId: string, bid: number) => {
  state.auction.currentBid = bid
  state.auction.currentBidTeamId = teamId
  state.auction.message = `${teamId} bids ${bid}L`
}

const userCanBid = (state: GameState, player: Player, nextBid: number) => {
  const userTeam = state.teams.find((team) => team.id === state.userTeamId)
  if (!userTeam) {
    return false
  }
  if (state.auction.currentBidTeamId === userTeam.id) {
    return false
  }
  if (state.auction.passedTeamIds.includes(userTeam.id)) {
    return false
  }
  return canTeamBid(state, userTeam, player, nextBid)
}

const settleLotIfDone = (state: GameState, player: Player, nextBid: number): boolean => {
  const userActive = userCanBid(state, player, nextBid)
  const aiBidder = chooseAiBidder(state, player, nextBid)

  if (userActive || aiBidder) {
    return false
  }

  if (!state.auction.currentBidTeamId) {
    state.auction.message = `${player.firstName} ${player.lastName} goes unsold`
    closeCurrentLot(state, false)
    return true
  }

  const winner = state.teams.find((team) => team.id === state.auction.currentBidTeamId)
  const entry = entryByPlayerId(state.auction.entries, player.id)
  if (!winner || !entry) {
    closeCurrentLot(state, false)
    return true
  }

  assignPlayerToTeam(player, winner, state.auction.currentBid)
  entry.status = 'sold'
  entry.soldToTeamId = winner.id
  entry.finalPrice = state.auction.currentBid
  state.auction.message = `${player.firstName} ${player.lastName} sold to ${winner.shortName} for ${state.auction.currentBid}L`

  closeCurrentLot(state, true)
  return true
}

export const progressAuction = (state: GameState, userAction?: UserAuctionAction): GameState => {
  const nextState: GameState = structuredClone(state)
  const autoMode = userAction === 'auto'

  if (nextState.phase !== 'auction' || nextState.auction.complete) {
    return nextState
  }

  let pendingAction = userAction

  while (!nextState.auction.complete) {
    if (!nextState.auction.currentPlayerId) {
      openNextLot(nextState)
      if (nextState.auction.complete) {
        return nextState
      }
    }

    const player = nextState.players.find((candidate) => candidate.id === nextState.auction.currentPlayerId)
    if (!player) {
      closeCurrentLot(nextState, false)
      continue
    }

    const nextBid =
      nextState.auction.currentBid === 0
        ? player.basePrice
        : nextState.auction.currentBid + getBidIncrement(nextState.auction.currentBid, nextState.auction.phase)
    nextState.auction.currentBidIncrement =
      nextState.auction.currentBid === 0 ? player.basePrice : getBidIncrement(nextState.auction.currentBid, nextState.auction.phase)

    if (pendingAction === 'pass') {
      if (!nextState.auction.passedTeamIds.includes(nextState.userTeamId)) {
        nextState.auction.passedTeamIds.push(nextState.userTeamId)
      }
      pendingAction = undefined
    } else if (pendingAction === 'bid') {
      if (userCanBid(nextState, player, nextBid)) {
        applyBid(nextState, nextState.userTeamId, nextBid)
      }
      pendingAction = undefined
    }

    const settledImmediately = settleLotIfDone(nextState, player, nextBid)
    if (settledImmediately) {
      continue
    }

    const canUserAct = userCanBid(nextState, player, nextBid)
    if (canUserAct) {
      if (autoMode) {
        const userTeam = nextState.teams.find((team) => team.id === nextState.userTeamId)
        if (!userTeam) {
          nextState.auction.passedTeamIds.push(nextState.userTeamId)
          continue
        }
        const autoValue = teamIntentValue(userTeam, player, nextState)
        if (autoValue >= nextBid) {
          applyBid(nextState, nextState.userTeamId, nextBid)
        } else if (!nextState.auction.passedTeamIds.includes(nextState.userTeamId)) {
          nextState.auction.passedTeamIds.push(nextState.userTeamId)
        }
        const resolvedAfterAutoUser = settleLotIfDone(nextState, player, nextBid)
        if (resolvedAfterAutoUser) {
          continue
        }
      } else {
      nextState.auction.awaitingUserAction = true
      nextState.auction.message = `${player.firstName} ${player.lastName}: your move at ${nextBid}L`
      return nextState
      }
    }

    const aiTeam = chooseAiBidder(nextState, player, nextBid)
    if (!aiTeam) {
      settleLotIfDone(nextState, player, nextBid)
      continue
    }

    applyBid(nextState, aiTeam.id, nextBid)

    const resolvedAfterAi = settleLotIfDone(nextState, player, nextBid)
    if (resolvedAfterAi) {
      continue
    }
  }

  return nextState
}

export const runAutoAuction = (state: GameState): GameState => {
  return progressAuction(state, 'auto')
}
