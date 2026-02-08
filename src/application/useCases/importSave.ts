import { gameSaveSchema } from '@/application/contracts'
import { ImportError } from '@/domain/errors'
import { assertGameStateSemanticIntegrity } from '@/domain/invariants'
import type { GameRepository } from '@/application/gameRepository'
import type { GameState } from '@/domain/types'

const MAX_IMPORT_BYTES = 5 * 1024 * 1024

export const importSave = async (repository: GameRepository, raw: string): Promise<GameState> => {
  if (raw.length > MAX_IMPORT_BYTES) {
    throw new ImportError('Import rejected: file exceeds 5 MB cap')
  }

  return repository.transaction(async () => {
    let parsedJson: unknown
    try {
      parsedJson = JSON.parse(raw)
    } catch (error) {
      throw new ImportError('Import rejected: invalid JSON', error)
    }

    const parsedSave = gameSaveSchema.safeParse(parsedJson)
    if (!parsedSave.success) {
      throw new ImportError('Import rejected: schema validation failed', parsedSave.error.flatten())
    }

    try {
      assertGameStateSemanticIntegrity(parsedSave.data)
    } catch (error) {
      throw new ImportError('Import rejected: semantic validation failed', error)
    }

    const nextState = parsedSave.data
    nextState.metadata.updatedAt = new Date().toISOString()

    return {
      nextState,
      result: nextState,
    }
  })
}
