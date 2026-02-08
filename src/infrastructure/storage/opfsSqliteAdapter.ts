import { StorageError } from '@/domain/errors'
import type { StorageAdapter } from '@/infrastructure/storage/adapter'

const FILE_NAME = 'cricket-gm.sqlite'

export class OpfsSqliteAdapter implements StorageAdapter {
  readonly name = 'opfs-sqlite'

  async isSupported(): Promise<boolean> {
    return typeof navigator !== 'undefined' && !!navigator.storage?.getDirectory
  }

  private async getFileHandle(): Promise<FileSystemFileHandle> {
    if (!navigator.storage?.getDirectory) {
      throw new StorageError('OPFS is not supported in this browser')
    }

    const root = await navigator.storage.getDirectory()
    return root.getFileHandle(FILE_NAME, { create: true })
  }

  async readBytes(key: string): Promise<Uint8Array | null> {
    void key
    try {
      const handle = await this.getFileHandle()
      const file = await handle.getFile()
      const buffer = await file.arrayBuffer()
      if (buffer.byteLength === 0) {
        return null
      }
      return new Uint8Array(buffer)
    } catch {
      return null
    }
  }

  async writeBytes(key: string, bytes: Uint8Array): Promise<void> {
    void key
    try {
      const handle = await this.getFileHandle()
      const writable = await handle.createWritable()
      const buffer = new ArrayBuffer(bytes.byteLength)
      new Uint8Array(buffer).set(bytes)
      await writable.write(buffer)
      await writable.close()
    } catch (error) {
      throw new StorageError('Failed to persist sqlite bytes to OPFS', error)
    }
  }

  async delete(key: string): Promise<void> {
    void key
    try {
      if (!navigator.storage?.getDirectory) {
        return
      }
      const root = await navigator.storage.getDirectory()
      await root.removeEntry(FILE_NAME)
    } catch {
      // Best effort cleanup.
    }
  }
}
