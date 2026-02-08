import { createInitialState } from '@/domain/generator'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'

describe('semantic integrity', () => {
  it('passes for generated initial state', () => {
    const state = createInitialState(99)
    expect(() => assertGameStateSemanticIntegrity(state)).not.toThrow()
  })
})
