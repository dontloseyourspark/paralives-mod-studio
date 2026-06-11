/**
 * modBundleExporter.ts
 * Takes ModFileEntry[] from the generator and produces a downloadable .zip.
 * Uses fflate for zip creation — install with: npm install fflate
 * Falls back to a manual approach if fflate isn't available.
 */

import type { ModFileEntry } from './surfaceModGenerator'
import type { SurfaceMod } from '../types/surfaceModTypes'
import { filenameStem } from './surfaceModGenerator'
import { assetDb } from '../utils/assetDb'

async function loadFflate() {
  try {
    return await import('fflate')
  } catch {
    return null
  }
}

function textToBytes(text: string): Uint8Array {
  return new TextEncoder().encode(text)
}

function triggerDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob)
  const a   = document.createElement('a')
  a.href     = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1500)
}

/**
 * Export a surface mod as a downloadable .zip file.
 * Resolves binary texture assets from IndexedDB before zipping.
 *
 * @param workshopThumbnailKey  Optional cache key for the workshop thumbnail
 *                              PNG (1020×1020 recommended). When provided,
 *                              included in the zip as
 *                              {stem}_{modGuid}_mod.thumbnail — the file the
 *                              Steam Workshop uses as the mod cover image.
 */
export async function exportSurfaceModAsZip(
  mod: SurfaceMod,
  entries: ModFileEntry[],
  workshopThumbnailKey?: string | null,
): Promise<void> {
  const fflate = await loadFflate()

  const stem   = filenameStem(mod.internalName)
  const folder = `${stem}_${mod.modGuid}.mod`

  // Resolve all binary assets from IndexedDB
  const resolvedEntries: { path: string; data: Uint8Array }[] = []

  for (const entry of entries) {
    if (entry.isPlaceholder) continue

    if (entry.text !== undefined) {
      resolvedEntries.push({ path: entry.path, data: textToBytes(entry.text) })
    } else if (entry.cacheKey) {
      const blob = await assetDb.getFile(entry.cacheKey)
      if (blob) {
        const buf = await blob.arrayBuffer()
        resolvedEntries.push({ path: entry.path, data: new Uint8Array(buf) })
      }
    }
  }

  // Workshop thumbnail — included as {stem}_{modGuid}_mod.thumbnail
  if (workshopThumbnailKey) {
    const thumbnailBlob = await assetDb.getFile(workshopThumbnailKey)
    if (thumbnailBlob) {
      const buf = await thumbnailBlob.arrayBuffer()
      resolvedEntries.push({
        path: `${folder}/${stem}_${mod.modGuid}_mod.thumbnail`,
        data: new Uint8Array(buf),
      })
    }
  }

  const zipName = `${stem}_${mod.modGuid}.mod.zip`

  if (fflate) {
    const zipData: Record<string, Uint8Array> = {}
    for (const { path, data } of resolvedEntries) {
      zipData[path] = data
    }
    const compressed = fflate.zipSync(zipData, { level: 6 })
    triggerDownload(new Blob([compressed], { type: 'application/zip' }), zipName)
  } else {
    const blob = buildUncompressedZip(resolvedEntries)
    triggerDownload(blob, zipName)
  }
}

// ─── Manual uncompressed ZIP builder ─────────────────────────────────────────

function crc32(data: Uint8Array): number {
  let crc = 0xFFFFFFFF
  for (const byte of data) {
    crc ^= byte
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xEDB88320 : 0)
    }
  }
  return (crc ^ 0xFFFFFFFF) >>> 0
}

function u16le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff])
}

function u32le(n: number): Uint8Array {
  return new Uint8Array([n & 0xff, (n >> 8) & 0xff, (n >> 16) & 0xff, (n >> 24) & 0xff])
}

function concat(...arrays: Uint8Array[]): Uint8Array {
  const total = arrays.reduce((s, a) => s + a.length, 0)
  const out   = new Uint8Array(total)
  let offset  = 0
  for (const a of arrays) { out.set(a, offset); offset += a.length }
  return out
}

function buildUncompressedZip(entries: { path: string; data: Uint8Array }[]): Blob {
  const enc   = new TextEncoder()
  const locals: Uint8Array[] = []
  const centrals: Uint8Array[] = []
  let offset = 0

  for (const { path, data } of entries) {
    const name = enc.encode(path)
    const crc  = crc32(data)
    const size = data.length

    const local = concat(
      new Uint8Array([0x50, 0x4B, 0x03, 0x04]),
      u16le(20), u16le(0), u16le(0),
      u16le(0), u16le(0),
      u32le(crc), u32le(size), u32le(size),
      u16le(name.length), u16le(0),
      name, data,
    )
    locals.push(local)

    const central = concat(
      new Uint8Array([0x50, 0x4B, 0x01, 0x02]),
      u16le(20), u16le(20),
      u16le(0), u16le(0), u16le(0),
      u16le(0), u16le(0),
      u32le(crc), u32le(size), u32le(size),
      u16le(name.length), u16le(0), u16le(0), u16le(0), u16le(0),
      u32le(0), u32le(offset),
      name,
    )
    centrals.push(central)
    offset += local.length
  }

  const centralData   = concat(...centrals)
  const eocd = concat(
    new Uint8Array([0x50, 0x4B, 0x05, 0x06]),
    u16le(0), u16le(0),
    u16le(entries.length), u16le(entries.length),
    u32le(centralData.length), u32le(offset),
    u16le(0),
  )

  return new Blob([...locals, centralData, eocd], { type: 'application/zip' })
}
