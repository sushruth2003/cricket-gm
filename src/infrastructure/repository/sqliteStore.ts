import initSqlJs from 'sql.js'
import type { Database } from 'sql.js'
import { StorageError } from '@/domain/errors'
import type { StorageAdapter } from '@/infrastructure/storage/adapter'

const DB_KEY = 'game-db'

export class SqliteStore {
  private db: Database | null = null

  constructor(private readonly adapter: StorageAdapter) {}

  private async ensureDb(): Promise<Database> {
    if (this.db) {
      return this.db
    }

    const SQL = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    })

    const bytes = await this.adapter.readBytes(DB_KEY)
    const db = bytes ? new SQL.Database(bytes) : new SQL.Database()
    db.run('CREATE TABLE IF NOT EXISTS saves (id TEXT PRIMARY KEY, payload TEXT NOT NULL)')
    this.db = db
    return db
  }

  async readState(id: string): Promise<string | null> {
    const db = await this.ensureDb()
    const result = db.exec('SELECT payload FROM saves WHERE id = ?', [id])
    if (result.length === 0 || result[0].values.length === 0) {
      return null
    }

    return String(result[0].values[0][0])
  }

  async writeState(id: string, payload: string): Promise<void> {
    try {
      const db = await this.ensureDb()
      db.run('INSERT OR REPLACE INTO saves(id, payload) VALUES (?, ?)', [id, payload])
      const bytes = db.export()
      await this.adapter.writeBytes(DB_KEY, bytes)
    } catch (error) {
      throw new StorageError('Failed to write game state', error)
    }
  }

  async clearState(id: string): Promise<void> {
    const db = await this.ensureDb()
    db.run('DELETE FROM saves WHERE id = ?', [id])
    const bytes = db.export()
    await this.adapter.writeBytes(DB_KEY, bytes)
  }
}
