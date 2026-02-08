export interface StorageAdapter {
  readonly name: string
  isSupported(): Promise<boolean>
  readBytes(key: string): Promise<Uint8Array | null>
  writeBytes(key: string, bytes: Uint8Array): Promise<void>
  delete(key: string): Promise<void>
}
