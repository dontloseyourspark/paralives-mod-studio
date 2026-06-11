// src/utils/assetDb.ts

const DB_NAME    = 'paralives-studio-assets'
const DB_VERSION = 2          // v2: stores {buffer,type} objects — ArrayBuffer is always structured-clone safe
const STORE_NAME = 'binary-files'

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        // Drop and recreate on every upgrade — guarantees a clean schema and
        // removes any corrupted records left by failed v1 writes.
        if (db.objectStoreNames.contains(STORE_NAME)) {
          db.deleteObjectStore(STORE_NAME)
        }
        db.createObjectStore(STORE_NAME)
      }

      request.onsuccess = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        db.onclose = () => { dbPromise = null }
        db.onversionchange = () => { db.close(); dbPromise = null }
        resolve(db)
      }

      request.onerror = (event) => {
        dbPromise = null
        reject((event.target as IDBOpenDBRequest).error)
      }
    })
  }
  return dbPromise
}

// Normalise a stored value (v1 Blob or v2 {buffer,type}) back to a Blob.
function toBlob(val: unknown): Blob | null {
  if (!val) return null
  if (val instanceof Blob) return val   // v1 legacy record
  const v = val as { buffer?: ArrayBuffer; type?: string }
  if (v.buffer instanceof ArrayBuffer) return new Blob([v.buffer], { type: v.type ?? '' })
  return null
}

export const assetDb = {
  async saveFile(key: string, file: File | Blob): Promise<void> {
    // Read all bytes into memory BEFORE opening the IDB transaction.
    // Storing an ArrayBuffer (not a Blob) avoids Chrome's structured-clone
    // failures — Blob storage can raise UnknownError when the blob's internal
    // reference becomes stale or when the DB connection state is unexpected.
    const buffer = await file.arrayBuffer()

    const db = await getDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror   = () => reject(tx.error)
      tx.onabort   = () => reject(tx.error)
      tx.objectStore(STORE_NAME).put({ buffer, type: file.type }, key)
    })
  },

  async getFile(key: string): Promise<Blob | null> {
    const db = await getDb()
    return new Promise<Blob | null>((resolve, reject) => {
      const tx  = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(key)
      req.onsuccess = () => resolve(toBlob(req.result))
      req.onerror   = () => reject(req.error)
    })
  },

  async getAllFiles(): Promise<Record<string, Blob>> {
    const db = await getDb()
    return new Promise<Record<string, Blob>>((resolve, reject) => {
      const tx      = db.transaction(STORE_NAME, 'readonly')
      const records: Record<string, Blob> = {}
      const req     = tx.objectStore(STORE_NAME).openCursor()

      req.onsuccess = (event) => {
        const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
        if (cursor) {
          const blob = toBlob(cursor.value)
          if (blob) records[cursor.key as string] = blob
          cursor.continue()
        } else {
          resolve(records)
        }
      }

      req.onerror = () => reject(req.error)
      tx.onabort  = () => reject(tx.error)
    })
  },

  async deleteFile(key: string): Promise<void> {
    const db = await getDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
      tx.onabort    = () => reject(tx.error)
      tx.objectStore(STORE_NAME).delete(key)
    })
  },

  async clearAll(): Promise<void> {
    const db = await getDb()
    return new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      tx.oncomplete = () => resolve()
      tx.onerror    = () => reject(tx.error)
      tx.onabort    = () => reject(tx.error)
      tx.objectStore(STORE_NAME).clear()
    })
  },
}
