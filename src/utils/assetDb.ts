// src/utils/assetDb.ts

const DB_NAME    = 'paralives-studio-assets-v8'
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

// Intercepts the image, crops it perfectly to the center, scales it to 1024x1024, 
// and converts it to a tiny WebP string so it never blows up the LocalStorage quota.
function compressImageToBase64(file: File | Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()

    img.onload = () => {
      URL.revokeObjectURL(url)
      const canvas = document.createElement('canvas')
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.readAsDataURL(file)
        return
      }

      const TARGET_SIZE = 1024
      canvas.width = TARGET_SIZE
      canvas.height = TARGET_SIZE

      const minDim = Math.min(img.width, img.height)
      const startX = (img.width - minDim) / 2
      const startY = (img.height - minDim) / 2

      ctx.drawImage(
        img, 
        startX, startY, minDim, minDim, 
        0, 0, TARGET_SIZE, TARGET_SIZE
      )

      resolve(canvas.toDataURL('image/webp', 0.8))
    }

    img.onerror = () => reject(new Error('Failed to load image for compression.'))
    img.src = url
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
      const base64String = await compressImageToBase64(file)

      // ATTEMPT 1: The Standard IndexedDB Engine
      try {
        const db = await openDb()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
          tx.onabort = () => { db.close(); reject(tx.error) }
          tx.objectStore(STORE_NAME).put(base64String, key)
        })
        console.log(`[assetDb] Successfully saved ${key} to IndexedDB.`)
        return 
      } catch {
        console.warn(`[assetDb] IndexedDB threw an Internal Error. Executing fallback protocol...`)
      }

      // ATTEMPT 2: The Bulletproof LocalStorage Fallback
      try {
        localStorage.setItem(`asset_fallback_${key}`, base64String)
        console.log(`[assetDb] Successfully saved compressed ${key} to LocalStorage fallback.`)
      } catch (lsError) {
        console.error(`[assetDb] LocalStorage fallback failed (Quota Exceeded?):`, lsError)
      }

    } catch (error) {
      console.error(`[assetDb] Total save failure for ${key}:`, error)
    }
  },

  async getFile(key: string): Promise<Blob | null> {
    const fallbackData = localStorage.getItem(`asset_fallback_${key}`)
    if (fallbackData) {
      return base64ToBlob(fallbackData)
    }

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
    const records: Record<string, Blob> = {}

    // 1. Gather all LocalStorage fallback images (Crash-Proof Self-Healing)
    for (let i = 0; i < localStorage.length; i++) {
      const lsKey = localStorage.key(i)
      if (lsKey && lsKey.startsWith('asset_fallback_')) {
        const originalKey = lsKey.replace('asset_fallback_', '')
        const data = localStorage.getItem(lsKey)
        
        if (data && data.startsWith('data:')) {
          try {
            records[originalKey] = base64ToBlob(data)
          } catch (decodeError) {
            console.error(`[assetDb] Corrupted file found and deleted: ${lsKey}`, decodeError)
            localStorage.removeItem(lsKey) // Self-healing purge
          }
        }
      }
    }

    // 2. Gather IndexedDB images safely
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).openCursor()

        req.onsuccess = (event) => {
          const cursor = (event.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const val = cursor.value
            if (typeof val === 'string' && val.startsWith('data:') && !records[cursor.key as string]) {
              records[cursor.key as string] = base64ToBlob(val)
            }
            cursor.continue()
          } else {
            db.close()
            resolve()
          }
        }
        tx.onerror = () => { db.close(); reject(tx.error) }
      })
    } catch (error) {
      console.warn(`[assetDb] IndexedDB bulk read failed.`, error)
    }

    return records
  },

  async deleteFile(key: string): Promise<void> {
    localStorage.removeItem(`asset_fallback_${key}`)
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
    const keysToRemove: string[] = []
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i)
      if (key && key.startsWith('asset_fallback_')) keysToRemove.push(key)
    }
    keysToRemove.forEach(k => localStorage.removeItem(k))

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