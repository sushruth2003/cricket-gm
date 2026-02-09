import { createRetentionStateForContext, createRtmDecisionForContext, resolveAuctionPolicyForContext } from '@/domain/auction'
import type { Team } from '@/domain/types'

const winner: Team = {
  id: 'team-1',
  city: 'A',
  name: 'A',
  shortName: 'A',
  color: '#111111',
  budgetRemaining: 1000,
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

describe('auction policy resolver', () => {
  it('returns legacy defaults when no context is provided', () => {
    const resolved = resolveAuctionPolicyForContext()

    expect(resolved.auctionType).toBe('mega')
    expect(resolved.policy.overseasCap).toBe(8)
    expect(resolved.policy.minimumSpend).toBe(9_000)
    expect(resolved.policy.rtmEnabled).toBe(false)
  })

  it('resolves IPL 2025-2027 cycle as data-driven mega/mini policies', () => {
    const mega2025 = resolveAuctionPolicyForContext({ policySet: 'ipl-2025-cycle', seasonYear: 2025 })
    const mini2026 = resolveAuctionPolicyForContext({ policySet: 'ipl-2025-cycle', seasonYear: 2026 })
    const mini2027 = resolveAuctionPolicyForContext({ policySet: 'ipl-2025-cycle', seasonYear: 2027 })

    expect(mega2025.auctionType).toBe('mega')
    expect(mega2025.policy.retentionEnabled).toBe(true)
    expect(mega2025.policy.rtmEnabled).toBe(false)

    expect(mini2026.auctionType).toBe('mini')
    expect(mini2026.policy.retentionEnabled).toBe(false)
    expect(mini2026.policy.rtmEnabled).toBe(true)
    expect(mini2026.policy.rtmReboundEnabled).toBe(true)

    expect(mini2027.auctionType).toBe('mini')
    expect(mini2027.policy.rtmEnabled).toBe(true)
  })

  it('supports season index context', () => {
    const resolved = resolveAuctionPolicyForContext({ policySet: 'ipl-2025-cycle', seasonIndex: 2 })

    expect(resolved.auctionType).toBe('mini')
  })

  it('exposes typed no-op retention and RTM primitives for legacy policy', () => {
    const retention = createRetentionStateForContext({ policySet: 'legacy-default' })
    const rtm = createRtmDecisionForContext(winner, 75, 'team-2', { policySet: 'legacy-default' })

    expect(retention.phase).toBe('not-applicable')
    expect(rtm.phase).toBe('disabled')
  })

  it('marks RTM branch as available for mini-auction policy contexts', () => {
    const rtm = createRtmDecisionForContext(winner, 75, 'team-2', { policySet: 'ipl-2025-cycle', seasonYear: 2026 })

    expect(rtm.enabled).toBe(true)
    expect(rtm.phase).toBe('available')
    expect(rtm.allowRebound).toBe(true)
  })
})
