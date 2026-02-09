import { IPL_CYCLE_YEARS, IPL_POLICY_BY_YEAR, LEGACY_DEFAULT_POLICY } from '@/domain/policy/iplPolicy'
import type { AuctionPolicy, AuctionPolicyContext, AuctionType, GameState, ResolvedAuctionPolicy } from '@/domain/types'

const FALLBACK_SEASON_YEAR = 2025

const clampToKnownIplYear = (year: number): number => {
  if (IPL_CYCLE_YEARS.includes(year)) {
    return year
  }
  if (year < IPL_CYCLE_YEARS[0]) {
    return IPL_CYCLE_YEARS[0]
  }
  return IPL_CYCLE_YEARS[IPL_CYCLE_YEARS.length - 1]
}

const deriveSeasonYear = (context: AuctionPolicyContext): number => {
  if (typeof context.seasonYear === 'number') {
    return context.seasonYear
  }
  if (typeof context.seasonIndex === 'number') {
    return 2024 + Math.max(1, context.seasonIndex)
  }
  if (typeof context.cycleMarker === 'number') {
    return 2024 + Math.max(1, context.cycleMarker)
  }
  return FALLBACK_SEASON_YEAR
}

const resolveFromLegacy = (): ResolvedAuctionPolicy => ({
  seasonYear: FALLBACK_SEASON_YEAR,
  auctionType: LEGACY_DEFAULT_POLICY.auctionType,
  policy: LEGACY_DEFAULT_POLICY,
})

const resolveFromIplCycle = (context: AuctionPolicyContext): ResolvedAuctionPolicy => {
  const requestedYear = deriveSeasonYear(context)
  const seasonYear = clampToKnownIplYear(requestedYear)
  const policy = IPL_POLICY_BY_YEAR[seasonYear]

  return {
    seasonYear,
    auctionType: policy.auctionType,
    policy,
  }
}

export const resolveAuctionPolicy = (context: AuctionPolicyContext = {}): ResolvedAuctionPolicy => {
  if ((context.policySet ?? 'legacy-default') === 'legacy-default') {
    return resolveFromLegacy()
  }
  return resolveFromIplCycle(context)
}

export const resolveAuctionPolicyForSeason = (context: AuctionPolicyContext = {}): { policy: AuctionPolicy; auctionType: AuctionType } => {
  const resolved = resolveAuctionPolicy(context)
  return {
    policy: resolved.policy,
    auctionType: resolved.auctionType,
  }
}

export const policyContextFromState = (state: Pick<GameState, 'config' | 'metadata'>): AuctionPolicyContext => {
  const parsedYear = new Date(state.metadata.createdAt).getUTCFullYear()
  const seasonYear = Number.isFinite(parsedYear) ? parsedYear : FALLBACK_SEASON_YEAR
  return {
    policySet: state.config.policySet,
    seasonYear,
  }
}
