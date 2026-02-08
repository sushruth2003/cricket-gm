import { createPrng } from '@/domain/prng'

describe('prng determinism', () => {
  it('replays same sequence from same seed', () => {
    const a = createPrng(12345)
    const b = createPrng(12345)

    const fromA = Array.from({ length: 12 }, () => a.nextInt(0, 1000))
    const fromB = Array.from({ length: 12 }, () => b.nextInt(0, 1000))

    expect(fromA).toEqual(fromB)
  })
})
