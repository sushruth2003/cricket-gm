import type { AuctionPolicy, AuctionType } from '@/domain/types'

const legacyDefaultPolicy: AuctionPolicy = {
  key: 'legacy-default',
  auctionType: 'mega',
  purse: 12_000,
  squadMin: 18,
  squadMax: 25,
  overseasCap: 8,
  minimumSpend: 9_000,
  minimumPlayerBase: 30,
  retentionLimit: 0,
  retentionEnabled: false,
  rtmEnabled: false,
  rtmReboundEnabled: false,
  forceFillToMinimumSquad: true,
  bidIncrementBands: [
    { minBid: 0, increment: 5 },
    { minBid: 100, increment: 20 },
    { minBid: 200, increment: 25 },
    { minBid: 500, increment: 50 },
  ],
  phaseIncrementFloor: {
    marquee: 0,
    capped: 0,
    uncapped: 0,
    'accelerated-1': 20,
    'accelerated-2': 50,
  },
}

const iplPolicyByYear: Record<number, AuctionPolicy> = {
  2025: {
    ...legacyDefaultPolicy,
    key: 'ipl-2025-mega',
    auctionType: 'mega',
    retentionLimit: 6,
    retentionEnabled: true,
    rtmEnabled: false,
    rtmReboundEnabled: false,
  },
  2026: {
    ...legacyDefaultPolicy,
    key: 'ipl-2026-mini',
    auctionType: 'mini',
    retentionLimit: 6,
    retentionEnabled: false,
    rtmEnabled: true,
    rtmReboundEnabled: true,
  },
  2027: {
    ...legacyDefaultPolicy,
    key: 'ipl-2027-mini',
    auctionType: 'mini',
    retentionLimit: 6,
    retentionEnabled: false,
    rtmEnabled: true,
    rtmReboundEnabled: true,
  },
}

const iplCycleYears = Object.keys(iplPolicyByYear)
  .map((value) => Number(value))
  .sort((a, b) => a - b)

export const LEGACY_DEFAULT_POLICY = legacyDefaultPolicy
export const IPL_POLICY_BY_YEAR = iplPolicyByYear
export const IPL_CYCLE_YEARS = iplCycleYears

export const resolveIplAuctionType = (seasonYear: number): AuctionType => {
  return (iplPolicyByYear[seasonYear] ?? iplPolicyByYear[2025]).auctionType
}
