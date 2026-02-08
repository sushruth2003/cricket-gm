import type { StorageAdapter } from '@/infrastructure/storage/adapter'
import { IndexedDbKvAdapter } from '@/infrastructure/storage/indexedDbKvAdapter'
import { IndexedDbSqliteAdapter } from '@/infrastructure/storage/indexedDbSqliteAdapter'
import { OpfsSqliteAdapter } from '@/infrastructure/storage/opfsSqliteAdapter'

export interface SelectedStorage {
  adapter: StorageAdapter
  fallbackChain: string[]
}

export const selectStorageAdapter = async (): Promise<SelectedStorage> => {
  const candidates: StorageAdapter[] = [new OpfsSqliteAdapter(), new IndexedDbSqliteAdapter(), new IndexedDbKvAdapter()]

  for (const adapter of candidates) {
    if (await adapter.isSupported()) {
      return {
        adapter,
        fallbackChain: candidates.map((candidate) => candidate.name),
      }
    }
  }

  return {
    adapter: new IndexedDbKvAdapter(),
    fallbackChain: candidates.map((candidate) => candidate.name),
  }
}
