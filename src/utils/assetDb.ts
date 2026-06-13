// src/utils/assetDb.ts

const DB_NAME    = 'paralives-studio-assets-v7' // Bumped to v7 to bypass localhost corruption
const STORE_NAME = 'binary-files'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1)

    request.onupgradeneeded = (e) => {
      const db = (e.target as IDBOpenDBRequest).result
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME)
      }
    }

    request.onsuccess = () => resolve(request.result)
    request.onerror = () => reject(request.error)
  })
}

function fileToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

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
      const db = await openDb()

      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        
        tx.oncomplete = () => { db.close(); resolve() }
        
        // CRITICAL: Close the database even if it fails to prevent locking!
        tx.onerror = () => { db.close(); reject(tx.error) }
        tx.onabort = () => { db.close(); reject(tx.error) }
        
        tx.objectStore(STORE_NAME).put(base64String, key)
      })
      
      console.log(`[assetDb] Successfully saved ${key} to disk.`)
    } catch (error) {
      console.error(`[assetDb] Disk save failed for ${key}:`, error)
    }
  },

  async getFile(key: string): Promise<Blob | null> {
    try {
      const db = await openDb()
      return await new Promise<Blob | null>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).get(key)
        
        req.onsuccess = () => {
          db.close() 
          const val = req.result
          if (typeof val === 'string' && val.startsWith('data:')) {
            resolve(base64ToBlob(val))
          } else {
            resolve(null)
          }
        }
        
        tx.onerror = () => { db.close(); reject(tx.error) }
      })
    } catch (error) {
      console.warn(`[assetDb] Disk read failed for key ${key}:`, error)
      return null
    }
  },

  async getAllFiles(): Promise<Record<string, Blob>> {
    try {
      const db = await openDb()
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
            }
            cursor.continue()
          } else {
            db.close() 
            resolve(records)
          }
        }
        
        tx.onerror = () => { db.close(); reject(tx.error) }
      })
    } catch (error) {
      console.error(`[assetDb] Could not bulk read files from disk:`, error)
      return {}
    }
  },

  async deleteFile(key: string): Promise<void> {
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
        tx.onabort = () => { db.close(); reject(tx.error) }
        tx.objectStore(STORE_NAME).delete(key)
      })
    } catch (error) {
      console.warn(`[assetDb] Disk delete failed for key ${key}:`, error)
    }
  },

  async clearAll(): Promise<void> {
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readwrite')
        tx.oncomplete = () => { db.close(); resolve() }
        tx.onerror = () => { db.close(); reject(tx.error) }
        tx.onabort = () => { db.close(); reject(tx.error) }
        tx.objectStore(STORE_NAME).clear()
      })
    } catch (error) {
      console.warn(`[assetDb] Disk clear failed:`, error)
    }
  },
}