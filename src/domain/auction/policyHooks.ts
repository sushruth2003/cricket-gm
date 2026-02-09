import type {
  AuctionPhase,
  AuctionPolicy,
  AuctionRetentionState,
  AuctionRtmDecision,
  Player,
  ResolvedAuctionPolicy,
  Team,
} from '@/domain/types'

const pickBaseIncrement = (currentBid: number, policy: AuctionPolicy): number => {
  const sorted = [...policy.bidIncrementBands].sort((a, b) => a.minBid - b.minBid)
  let selected = sorted[0]?.increment ?? 1
  for (const band of sorted) {
    if (currentBid >= band.minBid) {
      selected = band.increment
      continue
    }
    break
  }
  return selected
}

export const getBidIncrement = (currentBid: number, phase: AuctionPhase, policy: AuctionPolicy): number => {
  if (phase === 'complete') {
    return 0
  }
  const baseIncrement = pickBaseIncrement(currentBid, policy)
  const floor = policy.phaseIncrementFloor[phase]
  return Math.max(baseIncrement, floor)
}

export const getAuctionOpeningMessage = (resolved: ResolvedAuctionPolicy): string => {
  if (!resolved.policy.retentionEnabled && !resolved.policy.rtmEnabled) {
    return `Free-for-all opening auction (${resolved.seasonYear} ${resolved.auctionType}): no RTM or retention rights.`
  }

  if (resolved.policy.retentionEnabled) {
    return `${resolved.seasonYear} ${resolved.auctionType} auction: retention rights enabled (max ${resolved.policy.retentionLimit}).`
  }

  return `${resolved.seasonYear} ${resolved.auctionType} auction: RTM enabled${resolved.policy.rtmReboundEnabled ? ' with rebound' : ''}.`
}

export const createRetentionState = (resolved: ResolvedAuctionPolicy): AuctionRetentionState => {
  if (!resolved.policy.retentionEnabled) {
    return {
      enabled: false,
      maxRetentions: 0,
      phase: 'not-applicable',
    }
  }

  return {
    enabled: true,
    maxRetentions: resolved.policy.retentionLimit,
    phase: 'pending',
  }
}

export const createRtmDecision = (
  resolved: ResolvedAuctionPolicy,
  winner: Team,
  finalBid: number,
  incumbentTeamId: string | null,
): AuctionRtmDecision => {
  if (!resolved.policy.rtmEnabled) {
    return {
      enabled: false,
      allowRebound: false,
      phase: 'disabled',
      incumbentTeamId,
      winningTeamId: winner.id,
      finalBid,
    }
  }

  if (!incumbentTeamId || incumbentTeamId === winner.id) {
    return {
      enabled: true,
      allowRebound: resolved.policy.rtmReboundEnabled,
      phase: 'completed',
      incumbentTeamId,
      winningTeamId: winner.id,
      finalBid,
    }
  }

  return {
    enabled: true,
    allowRebound: resolved.policy.rtmReboundEnabled,
    phase: 'available',
    incumbentTeamId,
    winningTeamId: winner.id,
    finalBid,
  }
}

export const inferIncumbentTeamId = (player: Player): string | null => {
  return player.teamId
}
