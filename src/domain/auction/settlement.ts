import { canTeamBid } from '@/domain/auction/eligibility'
import type { AuctionIndexes } from '@/domain/auction/indexes'
import { incrementOverseasCountIfNeeded } from '@/domain/auction/indexes'
import type { AuctionEntry, AuctionPolicy, AuctionPhase, GameState, Player, Team } from '@/domain/types'

const resolvePhase = (entry: AuctionEntry | undefined): AuctionPhase => {
  if (!entry) {
    return 'complete'
  }
  return entry.phase
}

export const assignPlayerToTeam = (
  indexes: AuctionIndexes,
  player: Player,
  team: Team,
  price: number,
) => {
  if (team.rosterPlayerIds.includes(player.id) || player.teamId) {
    return
  }

  player.teamId = team.id
  team.rosterPlayerIds.push(player.id)
  team.budgetRemaining -= price
  incrementOverseasCountIfNeeded(indexes, team.id, player)

  if (team.playingXi.length < 11) {
    team.playingXi.push(player.id)
  }
  if (!team.wicketkeeperPlayerId && player.role === 'wicketkeeper') {
    team.wicketkeeperPlayerId = player.id
  }
}

export const closeCurrentLot = (state: GameState) => {
  state.auction.currentNominationIndex += 1
  state.auction.currentPlayerId = null
  state.auction.currentBid = 0
  state.auction.currentBidIncrement = 0
  state.auction.currentBidTeamId = null
  state.auction.passedTeamIds = []
  state.auction.awaitingUserAction = false
}

export const markLotUnsold = (state: GameState, entry: AuctionEntry) => {
  entry.status = 'unsold'
  entry.soldToTeamId = null
  entry.finalPrice = 0
  closeCurrentLot(state)
}

export const markLotSold = (state: GameState, entry: AuctionEntry, winner: Team, finalPrice: number) => {
  entry.status = 'sold'
  entry.soldToTeamId = winner.id
  entry.finalPrice = finalPrice
  closeCurrentLot(state)
}

const finalizeWicketkeepers = (state: GameState, indexes: AuctionIndexes) => {
  for (const team of state.teams) {
    const xi = team.playingXi.filter((playerId) => team.rosterPlayerIds.includes(playerId)).slice(0, 11)
    if (xi.length < 11) {
      const bench = team.rosterPlayerIds.filter((playerId) => !xi.includes(playerId))
      xi.push(...bench.slice(0, Math.max(0, 11 - xi.length)))
    }
    team.playingXi = xi

    const wkInXi = xi.find((playerId) => indexes.playerById.get(playerId)?.role === 'wicketkeeper')
    if (wkInXi) {
      team.wicketkeeperPlayerId = wkInXi
      continue
    }

    const squadWk = team.rosterPlayerIds.find((playerId) => indexes.playerById.get(playerId)?.role === 'wicketkeeper') ?? null
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

const enforceMinimumSpend = (state: GameState, policy: AuctionPolicy) => {
  for (const team of state.teams) {
    const spent = state.config.auctionBudget - team.budgetRemaining
    if (spent < policy.minimumSpend) {
      team.budgetRemaining -= policy.minimumSpend - spent
    }
  }
}

const forceFillMinimumSquads = (state: GameState, indexes: AuctionIndexes, policy: AuctionPolicy) => {
  if (!policy.forceFillToMinimumSquad) {
    return
  }

  for (const team of state.teams) {
    while (team.rosterPlayerIds.length < policy.squadMin) {
      const nextEntry = state.auction.entries.find((entry) => {
        if (entry.status !== 'unsold') {
          return false
        }
        const player = indexes.playerById.get(entry.playerId)
        if (!player || player.teamId) {
          return false
        }
        return canTeamBid(state, indexes, team, player, player.basePrice, policy)
      })

      if (!nextEntry) {
        break
      }

      const player = indexes.playerById.get(nextEntry.playerId)
      if (!player) {
        break
      }

      assignPlayerToTeam(indexes, player, team, player.basePrice)
      nextEntry.status = 'sold'
      nextEntry.soldToTeamId = team.id
      nextEntry.finalPrice = player.basePrice
    }
  }
}

const completeAuction = (state: GameState, indexes: AuctionIndexes, policy: AuctionPolicy) => {
  forceFillMinimumSquads(state, indexes, policy)
  finalizeWicketkeepers(state, indexes)
  enforceMinimumSpend(state, policy)

  state.auction.complete = true
  state.auction.phase = 'complete'
  state.auction.currentPlayerId = null
  state.auction.awaitingUserAction = false
  state.phase = 'regular-season'
}

export const openNextLot = (state: GameState, indexes: AuctionIndexes, policy: AuctionPolicy) => {
  while (state.auction.currentNominationIndex < state.auction.entries.length) {
    const nextEntry = state.auction.entries[state.auction.currentNominationIndex]
    const player = indexes.playerById.get(nextEntry.playerId)

    if (!player || player.teamId || nextEntry.status !== 'pending') {
      state.auction.currentNominationIndex += 1
      continue
    }

    state.auction.currentPlayerId = player.id
    state.auction.phase = resolvePhase(nextEntry)
    state.auction.message = `Lot ${state.auction.currentNominationIndex + 1}: ${player.firstName} ${player.lastName}`
    return
  }

  completeAuction(state, indexes, policy)
}
