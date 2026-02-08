import { gameSaveSchema } from '@/application/contracts'
import { ValidationError } from '@/domain/errors'
import type { GameRepository } from '@/application/gameRepository'

export const exportSave = async (repository: GameRepository): Promise<string> => {
  const state = await repository.load()
  if (!state) {
    throw new ValidationError('No save exists to export')
  }

  const parsed = gameSaveSchema.safeParse(state)
  if (!parsed.success) {
    throw new ValidationError('Current state is invalid for export', parsed.error.flatten())
  }

  return JSON.stringify(parsed.data)
}
