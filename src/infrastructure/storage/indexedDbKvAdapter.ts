import { StorageError } from '@/domain/errors'
import type { StorageAdapter } from '@/infrastructure/storage/adapter'

const PREFIX = 'cricket-gm-kv:'

export class IndexedDbKvAdapter implements StorageAdapter {
  readonly name = 'indexeddb-kv-emergency'

  async isSupported(): Promise<boolean> {
    return typeof localStorage !== 'undefined'
  }

  async readBytes(key: string): Promise<Uint8Array | null> {
    try {
      const value = localStorage.getItem(PREFIX + key)
      if (!value) {
        return null
      }
      const raw = atob(value)
      const bytes = new Uint8Array(raw.length)
      for (let i = 0; i < raw.length; i += 1) {
        bytes[i] = raw.charCodeAt(i)
      }
      return bytes
    } catch (error) {
      throw new StorageError('Failed reading emergency kv save', error)
    }
  }

  async writeBytes(key: string, bytes: Uint8Array): Promise<void> {
    try {
      let raw = ''
      bytes.forEach((byte) => {
        raw += String.fromCharCode(byte)
      })
      localStorage.setItem(PREFIX + key, btoa(raw))
    } catch (error) {
      throw new StorageError('Failed writing emergency kv save', error)
    }
  }

  async delete(key: string): Promise<void> {
    localStorage.removeItem(PREFIX + key)
  }
}
