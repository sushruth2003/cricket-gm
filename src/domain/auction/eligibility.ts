import type { AuctionPolicy, GameState, Player, Team } from '@/domain/types'
import type { AuctionIndexes } from '@/domain/auction/indexes'
import { getOverseasCount } from '@/domain/auction/indexes'

export const isOverseasPlayer = (player: Player): boolean => player.countryTag !== 'IN'

export const reservedForMinimumSquad = (team: Team, currentBid: number, policy: AuctionPolicy): number => {
  const rosterAfterWin = team.rosterPlayerIds.length + 1
  const remainingSlotsToMin = Math.max(0, policy.squadMin - rosterAfterWin)
  return remainingSlotsToMin * policy.minimumPlayerBase + currentBid
}

export const canTeamBid = (
  state: GameState,
  indexes: AuctionIndexes,
  team: Team,
  player: Player,
  bid: number,
  policy: AuctionPolicy,
): boolean => {
  if (team.rosterPlayerIds.length >= policy.squadMax) {
    return false
  }

  if (isOverseasPlayer(player) && getOverseasCount(indexes, team.id) >= policy.overseasCap) {
    return false
  }

  const reserve = reservedForMinimumSquad(team, bid, policy)
  if (team.budgetRemaining < reserve) {
    return false
  }

  const spentAfterBid = state.config.auctionBudget - (team.budgetRemaining - bid)
  if (policy.minimumSpend > 0 && spentAfterBid > state.config.auctionBudget) {
    return false
  }

  return true
}
