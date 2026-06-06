// src/utils/assetDb.ts

const DB_NAME = 'paralives-studio-assets'
const DB_VERSION = 1
const STORE_NAME = 'binary-files'

/**
 * Core structural initializer for the browser's native IndexedDB sandbox instance.
 */
function initDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION)

    request.onupgradeneeded = (event) => {
      const db = (event.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = (event) => {
      resolve((event.target as IDBOpenDBRequest).result)
    }

    request.onerror = (event) => {
      reject((event.target as IDBOpenDBRequest).error)
    }
  })
}

export const assetDb = {
  /**
   * Commits a raw browser File or Blob payload directly into long-term local storage.
   */
  async saveFile(key: string, file: File | Blob): Promise<void> {
    const db = await initDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.put(file, key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Resolves a raw binary File/Blob record back into RAM by its lookup key.
   */
  async getFile(key: string): Promise<File | Blob | null> {
    const db = await initDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.get(key)

      request.onsuccess = () => resolve(request.result || null)
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Pulls the complete database manifest down in a single batch pass during application boot.
   */
  async getAllFiles(): Promise<Record<string, File | Blob>> {
    const db = await initDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readonly')
      const store = transaction.objectStore(STORE_NAME)
      
      const records: Record<string, File | Blob> = {}
      
      // Use an IDB Cursor loop to cleanly stream elements out of the engine
      const request = store.openCursor()

      request.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          records[cursor.key as string] = cursor.value
          cursor.continue()
        } else {
          resolve(records)
        }
      }

      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Drops a specific asset out of the database workspace.
   */
  async deleteFile(key: string): Promise<void> {
    const db = await initDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.delete(key)

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  },

  /**
   * Flushes the entire database clean.
   */
  async clearAll(): Promise<void> {
    const db = await initDb()
    return new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, 'readwrite')
      const store = transaction.objectStore(STORE_NAME)
      const request = store.clear()

      request.onsuccess = () => resolve()
      request.onerror = () => reject(request.error)
    })
  }
}