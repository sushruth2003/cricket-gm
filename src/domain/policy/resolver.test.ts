import { resolveAuctionPolicy, resolveAuctionPolicyForSeason } from '@/domain/policy/resolver'

describe('auction policy resolver', () => {
  it('returns legacy mega policy by default', () => {
    const resolved = resolveAuctionPolicy()

    expect(resolved.auctionType).toBe('mega')
    expect(resolved.policy.key).toBe('legacy-default')
    expect(resolved.seasonYear).toBe(2025)
  })

  it.each([
    { seasonYear: 2025, expectedType: 'mega' as const },
    { seasonYear: 2026, expectedType: 'mini' as const },
    { seasonYear: 2027, expectedType: 'mini' as const },
  ])('resolves IPL cycle auction type for $seasonYear', ({ seasonYear, expectedType }) => {
    const resolved = resolveAuctionPolicy({ policySet: 'ipl-2025-cycle', seasonYear })

    expect(resolved.seasonYear).toBe(seasonYear)
    expect(resolved.auctionType).toBe(expectedType)
    expect(resolveAuctionPolicyForSeason({ policySet: 'ipl-2025-cycle', seasonYear }).auctionType).toBe(expectedType)
  })

  it('clamps out-of-range cycle years to supported bounds', () => {
    const low = resolveAuctionPolicy({ policySet: 'ipl-2025-cycle', seasonYear: 2019 })
    const high = resolveAuctionPolicy({ policySet: 'ipl-2025-cycle', seasonYear: 2032 })

    expect(low.seasonYear).toBe(2025)
    expect(high.seasonYear).toBe(2027)
  })
})
