import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

export class MemoryRepository implements GameRepository {
  private state: GameState | null = null

  async load(): Promise<GameState | null> {
    return this.state ? structuredClone(this.state) : null
  }

  async save(state: GameState): Promise<void> {
    this.state = structuredClone(state)
  }

  async transaction<T>(run: (current: GameState | null) => Promise<{ nextState?: GameState; result: T }>): Promise<T> {
    const snapshot = this.state ? structuredClone(this.state) : null

    try {
      const outcome = await run(this.state ? structuredClone(this.state) : null)
      if (outcome.nextState) {
        this.state = structuredClone(outcome.nextState)
      }
      return outcome.result
    } catch (error) {
      this.state = snapshot
      throw error
    }
  }

  async reset(): Promise<void> {
    this.state = null
  }
}
