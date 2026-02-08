import { openDB } from 'idb'
import { StorageError } from '@/domain/errors'
import type { StorageAdapter } from '@/infrastructure/storage/adapter'

const DB_NAME = 'cricket-gm-sqlite'
const STORE_NAME = 'sqlite-bytes'

export class IndexedDbSqliteAdapter implements StorageAdapter {
  readonly name = 'indexeddb-sqlite'

  async isSupported(): Promise<boolean> {
    return typeof indexedDB !== 'undefined'
  }

  private async db() {
    return openDB(DB_NAME, 1, {
      upgrade(db) {
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      },
    })
  }

  async readBytes(key: string): Promise<Uint8Array | null> {
    try {
      const db = await this.db()
      const value = await db.get(STORE_NAME, key)
      if (!value) {
        return null
      }
      return new Uint8Array(value as ArrayBuffer)
    } catch (error) {
      throw new StorageError('Failed reading sqlite bytes from IndexedDB', error)
    }
  }

  async writeBytes(key: string, bytes: Uint8Array): Promise<void> {
    try {
      const db = await this.db()
      await db.put(STORE_NAME, bytes.buffer, key)
    } catch (error) {
      throw new StorageError('Failed writing sqlite bytes to IndexedDB', error)
    }
  }

  async delete(key: string): Promise<void> {
    const db = await this.db()
    await db.delete(STORE_NAME, key)
  }
}
