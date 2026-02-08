export interface Prng {
  next(): number
  nextInt(min: number, max: number): number
  pick<T>(items: readonly T[]): T
}

export const createPrng = (seed: number): Prng => {
  let state = seed >>> 0

  const next = () => {
    state = (1664525 * state + 1013904223) >>> 0
    return state / 2 ** 32
  }

  const nextInt = (min: number, max: number) => {
    if (max < min) {
      throw new Error('max must be greater than or equal to min')
    }

    return Math.floor(next() * (max - min + 1)) + min
  }

  const pick = <T>(items: readonly T[]) => {
    if (items.length === 0) {
      throw new Error('cannot pick from empty array')
    }

    return items[nextInt(0, items.length - 1)]
  }

  return { next, nextInt, pick }
}
