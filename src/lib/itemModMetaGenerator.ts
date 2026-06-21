// src/lib/itemModMetaGenerator.ts
//
// Pure function for generating the .mod.meta manifest file.
//
// Format reference (from CLAUDE.md "Workshop-ready .mod.meta fields"):
//   GUID:{modGuid}
//   Type:401
//   UpdatedToGameVersion:17287
//   ModName:{project.name}
//   Enabled:False
//   IsSystemMod:False
//   CreationTime:0
//   LastEditTime:0
//   LastUploadTime:0
//   IsFromWorkshop:False
//   PublishedFileId:0
//   CreatorId:{project.author}
//   WorkshopDescription:{project.description}
//
// Line endings: CRLF (\r\n) — confirmed from real .mod.meta files.
// Encoding: UTF-8, no BOM.
//
// Timestamps use .NET ticks (ticks = unixMs * 10000 + 621355968000000000).
// We always emit 0 for all time fields — the game backfills them on first load,
// and generating real tick values would make the output non-deterministic.

import type { ModProject } from '../types/types'

const CRLF = '\r\n'

/**
 * Derive a stable 19-digit numeric mod GUID from a ModProject.
 *
 * For imported projects, `project.modGuid` is the real GUID captured from
 * the original `.mod.meta` — use it directly.
 *
 * For projects created fresh in the Studio, derive a deterministic numeric
 * GUID from the project's UUID by stripping non-digits and padding — same
 * approach used in itemModExporter.ts and itemModGenerator.ts.
 */
export function deriveModGuid(project: ModProject): string {
  return project.modGuid
    ?? project.id.replace(/[^0-9]/g, '').substring(0, 19).padEnd(19, '5')
}

/**
 * Generate the full text content of the `.mod.meta` manifest file.
 *
 * Produces a Workshop-ready manifest with all required fields. The game
 * backfills missing fields on import, but emitting them all up front means
 * no round-trip is needed before the mod can be uploaded to the Workshop.
 *
 * @param project - The mod project (name, author, description)
 * @param modGuid - The mod's numeric GUID — use deriveModGuid(project)
 * @returns CRLF-terminated string ready to write into the zip
 *
 * @example
 * const modGuid = deriveModGuid(project)
 * const metaText = generateModMeta(project, modGuid)
 * zip.file(`${folderName}.mod.meta`, metaText)
 */
export function generateModMeta(project: ModProject, modGuid: string): string {
  const lines: string[] = [
    `GUID:${modGuid}`,
    `Type:401`,
    `UpdatedToGameVersion:17287`,
    `ModName:${project.name || 'Untitled Mod'}`,
    `Enabled:False`,
    `IsSystemMod:False`,
    `CreationTime:0`,
    `LastEditTime:0`,
    `LastUploadTime:0`,
    `IsFromWorkshop:False`,
    `PublishedFileId:0`,
    `CreatorId:${project.author || 'Studio Creator'}`,
    `WorkshopDescription:${project.description || ''}`,
  ]

  return lines.join(CRLF) + CRLF
}