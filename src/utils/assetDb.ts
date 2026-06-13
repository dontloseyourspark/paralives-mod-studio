// src/utils/assetDb.ts

// By changing the DB_NAME, we force Chrome to abandon the corrupted 
// LevelDB file on your hard drive and create a fresh, clean one.
const DB_NAME    = 'paralives-studio-assets-v5' 
const DB_VERSION = 1          
const STORE_NAME = 'binary-files'

let dbPromise: Promise<IDBDatabase> | null = null

function getDb(): Promise<IDBDatabase> {
  if (!dbPromise) {
    dbPromise = new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
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

// Helper: Safely convert to Base64 to avoid Chrome Blob DOM Garbage Collection bugs
function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

// Helper: Convert Base64 back to a usable Blob for the compiler
function base64ToBlob(dataUrl: string): Blob {
  const parts = dataUrl.split(',')
  const mime = parts[0].match(/:(.*?);/)?.[1] || 'application/octet-stream'
  const bstr = atob(parts[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

export const assetDb = {
  async saveFile(key: string, file: File | Blob): Promise<void> {
    try {
      const base64String = await fileToBase64(file)
      const db = await getDb()

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror   = () => reject(tx.error)
        tx.onabort   = () => reject(tx.error)
        tx.objectStore(STORE_NAME).put(base64String, key)
      })
    } catch (error) {
      // FAIL GRACEFULLY: If the hard drive strictly blocks IDB writes (corruption/incognito),
      // we catch the error so it doesn't crash React. The image still lives in Zustand's 
      // RAM cache for the session, meaning the UI keeps working!
      console.warn(`[assetDb] Could not write to disk, falling back to memory cache. Error:`, error)
    }
  },

  async getFile(key: string): Promise<Blob | null> {
    try {
      const db = await getDb()
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx  = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(key)
        
        req.onsuccess = () => {
          const val = req.result
          if (typeof val === 'string' && val.startsWith('data:')) {
            resolve(base64ToBlob(val))
          } else if (val instanceof Blob) {
            resolve(val) // Legacy fallback
          } else if (val && val.buffer) {
            resolve(new Blob([val.buffer], { type: val.type || '' })) // V2 fallback
          } else {
            resolve(null)
          }
        }
        req.onerror = () => reject(req.error)
      })
    } catch (error) {
      console.warn(`[assetDb] Disk read failed for key ${key}:`, error)
      return null
    }
  },

  async getAllFiles(): Promise<Record<string, Blob>> {
    try {
      const db = await getDb()
      return await new Promise<Record<string, Blob>>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const records: Record<string, Blob> = {}
        const req = tx.objectStore(STORE_NAME).openCursor()

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const val = cursor.value
            if (typeof val === 'string' && val.startsWith('data:')) {
              records[cursor.key as string] = base64ToBlob(val)
            } else if (val instanceof Blob) {
              records[cursor.key as string] = val
            } else if (val && val.buffer) {
              records[cursor.key as string] = new Blob([val.buffer], { type: val.type || '' })
            }
            cursor.continue()
          } else {
            resolve(records)
          }
        }
        req.onerror = () => reject(req.error)
        tx.onabort  = () => reject(tx.error)
      })
    } catch (error) {
      console.warn(`[assetDb] Could not bulk read files from disk:`, error)
      return {}
    }
  },

  async deleteFile(key: string): Promise<void> {
    try {
      const db = await getDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror    = () => reject(tx.error)
        tx.onabort    = () => reject(tx.error)
        tx.objectStore(STORE_NAME).delete(key)
      })
    } catch (error) {
      console.warn(`[assetDb] Disk delete failed for key ${key}:`, error)
    }
  },

  async clearAll(): Promise<void> {
    try {
      const db = await getDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => resolve()
        tx.onerror    = () => reject(tx.error)
        tx.onabort    = () => reject(tx.error)
        tx.objectStore(STORE_NAME).clear()
      })
    } catch (error) {
      console.warn(`[assetDb] Disk clear failed:`, error)
    }
  },
}