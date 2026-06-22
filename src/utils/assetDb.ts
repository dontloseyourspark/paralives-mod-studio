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

// Reads a file as a data URL without any re-encoding or resizing.
// Used for item texture maps where exact byte preservation matters —
// lossy WebP re-encode destroys channel data the game depends on
// (normal vectors, ColorZone primaries, GrayMask 50%-gray pivot, etc.).
function readFileAsDataUrl(file: File | Blob): Promise<string> {
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

  // ── saveFile ──────────────────────────────────────────────────────────────
  // For display images only: thumbnails, covers, catalog images.
  // Compresses to 1024×1024 WebP before storing — DO NOT use for texture maps.
  // For texture maps use saveFileRaw below.
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
        return
      } catch {
        console.warn(`[assetDb] IndexedDB threw an Internal Error. Executing fallback protocol...`)
      }

      // ATTEMPT 2: The Bulletproof LocalStorage Fallback
      try {
        localStorage.setItem(`asset_fallback_${key}`, base64String)
      } catch (lsError) {
        console.error(`[assetDb] LocalStorage fallback failed (Quota Exceeded?):`, lsError)
      }

    } catch (error) {
      console.error(`[assetDb] Total save failure for ${key}:`, error)
    }
  },

  // ── saveFileRaw ───────────────────────────────────────────────────────────
  // For item texture maps: DetailMap, ColorZoneMap, DecalMap, DirtyOverlay.
  // Stores the original bytes via FileReader — no canvas re-encode, no resize,
  // no lossy compression. Uses the same IDB + localStorage fallback path as
  // saveFile so getAllFiles() / hydrateCacheFromDisk() picks them up on boot.
  //
  // Key format: item_tex_{itemGuid}_{slotName}
  // e.g. item_tex_2751226219996142798_DetailMap
  //
  // NOTE: localStorage fallback will QuotaExceededError for full-res textures
  // (typically >5MB). IDB is the primary store. Users on a broken-IDB profile
  // may need to re-upload textures after refresh — acceptable for v1.
  async saveFileRaw(key: string, file: File | Blob): Promise<void> {
    try {
      const dataUrl = await readFileAsDataUrl(file)

      // ATTEMPT 1: IndexedDB (same store as saveFile)
      try {
        const db = await openDb()
        await new Promise<void>((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, 'readwrite')
          tx.oncomplete = () => { db.close(); resolve() }
          tx.onerror = () => { db.close(); reject(tx.error) }
          tx.onabort = () => { db.close(); reject(tx.error) }
          tx.objectStore(STORE_NAME).put(dataUrl, key)
        })
        return
      } catch {
        console.warn(`[assetDb] IndexedDB write failed for ${key} (raw). Trying localStorage fallback...`)
      }

      // ATTEMPT 2: localStorage fallback — will likely fail for large textures
      try {
        localStorage.setItem(`asset_fallback_${key}`, dataUrl)
      } catch (lsError) {
        console.warn(`[assetDb] localStorage fallback failed for ${key} (likely too large):`, lsError)
      }

    } catch (error) {
      console.error(`[assetDb] Total save failure for ${key} (raw):`, error)
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

  // Returns all keys currently stored in IndexedDB + localStorage fallback
  async listKeys(): Promise<string[]> {
    const keys: string[] = []

    // localStorage fallback keys
    for (let i = 0; i < localStorage.length; i++) {
      const lsKey = localStorage.key(i)
      if (lsKey && lsKey.startsWith('asset_fallback_')) {
        keys.push(lsKey.replace('asset_fallback_', ''))
      }
    }

    // IndexedDB keys
    try {
      const db = await openDb()
      await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, 'readonly')
        const req = tx.objectStore(STORE_NAME).getAllKeys()
        req.onsuccess = () => {
          db.close()
          for (const k of req.result) {
            if (!keys.includes(k as string)) keys.push(k as string)
          }
          resolve()
        }
        tx.onerror = () => { db.close(); reject(tx.error) }
      })
    } catch (error) {
      console.warn(`[assetDb] listKeys IndexedDB read failed.`, error)
    }

    return keys
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
            localStorage.removeItem(lsKey)
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