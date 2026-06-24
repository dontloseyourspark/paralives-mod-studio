// src/components/ModImporter.tsx
import React, { useState } from 'react'
import { Folder, UploadSimple } from 'phosphor-react'
import JSZip from 'jszip'
import { useModStore } from '../store/useModStore'
import { assetDb } from '../utils/assetDb'
import { itemTextureCacheKey, ITEM_MESH_TEXTURE_SLOTS } from '../lib/itemTextureSlots'
import type { ModProject, TranslationData, ComponentNode, ModType, PrefabPropertyValue } from '../types/types'

interface ModImporterProps {
  onImportComplete: (project: ModProject) => void
  triggerRef?: React.RefObject<HTMLInputElement | null>
}

interface RawArrayEntry {
  _entryGuid: string
  [key: string]: string
}

interface RawItemMeta {
  _arrays: Record<string, RawArrayEntry[]>
  guid?: string
  modGuid?: string
  displayNameGuid?: string
  targetPrefabGuid?: string
  hideFromCatalog?: boolean
  hasSwatches?: boolean
  swatchGroup?: string
  defaultSwatch?: string
  swatchColorZoneCount?: number
  swatchThumbnailType?: number
  price?: number
  priceMultiplier?: number
  priceSkinProperty?: string
  multipurchaseOverride?: string
  autoSelect?: boolean
  itemPlacementTweenOverride?: string
  overrideSnap?: boolean
  rotateToSnapOverride?: string
  alwaysVisibleOnWalls?: boolean
  renderAsWall?: boolean
  overrideItemFadingFromCamera?: boolean
  cannotBatch?: boolean
  overrideItemForAnimation?: string
  ignoreUsageLevelFromTags?: boolean
  dirtinessSpeedTier?: string
  breakingSpeedTier?: string
  synchronizeSwatchAmongVariants?: boolean
  ignoreRememberIndexForCategory?: boolean
  hasSizeVariantsOverrides?: boolean
  collectibleCollection?: string
  patreonName?: string
  overrideInteractionGroup?: boolean
  overrideImpostorInteractions?: boolean
}

export default function ModImporter({ onImportComplete, triggerRef }: ModImporterProps) {
  const [isDragging, setIsDragging] = useState(false)
  const registerFileInCache = useModStore((state) => state.registerFileInCache)

  const processFiles = async (fileList: FileList | File[]) => {

    const newProjectId = crypto.randomUUID()

    const existingKeys = await assetDb.listKeys()
    await Promise.all(
      existingKeys
        .filter(k =>
          k.startsWith('item_thumb_') ||
          k === 'PROJECT_COVER_MASTER' ||
          (!k.startsWith('cover_'))
        )
        .map(k => assetDb.deleteFile(k))
    )

    let itemsSettingContent = ''
    let translationsSettingContent = ''
    let detectedLanguageName = 'Unknown'
    let detectedModGuid: string | null = null

    const componentSettings: Record<string, string> = {}
    const prefabContents: Record<string, string> = {}
    const prefabGuidToNameMap: Record<string, string> = {}
    const fileNameToTextMap: Record<string, string> = {}

    const thumbnailFiles: File[] = []
    let projectCoverKey: string | null = null

    const fbxFiles: Record<string, File> = {}
    const fbxMetaGuids: Record<string, string> = {}

    // PNG texture pipeline:
    // pngMetaGuidByBasename  — populated from .png.meta sidecars: basename → assetGuid
    // pngFileByBasename      — populated from .png files: basename → File
    // After the scan loop these are joined to produce pngByAssetGuid: assetGuid → File,
    // which is then used (after prefab parsing) to store textures under the correct
    // item_tex_{itemGuid}_{slot} keys by looking up each slot's assetGuid in the prefab.
    const pngMetaGuidByBasename: Record<string, string> = {}
    const pngFileByBasename: Record<string, File> = {}

    // 1. Normalize
    const isArchive = fileList.length === 1 && (fileList[0].name.endsWith('.zip') || fileList[0].name.endsWith('.mod'))
    if (isArchive) detectedLanguageName = fileList[0].name.replace(/\.(zip|mod)$/i, '')

    const fileEntries: { path: string, name: string, text: () => Promise<string>, getFile: () => Promise<File> }[] = []

    if (isArchive) {
      const zip = await JSZip.loadAsync(fileList[0])
      for (const [relativePath, zipEntry] of Object.entries(zip.files)) {
        if (zipEntry.dir) continue
        fileEntries.push({
          path: relativePath,
          name: zipEntry.name.split('/').pop() || '',
          text: () => zipEntry.async('string'),
          getFile: async () => {
            const blob = await zipEntry.async('blob')
            return new File([blob], zipEntry.name.split('/').pop() || '')
          }
        })
      }
    } else {
      for (const file of Array.from(fileList)) {
        if (!file.name) continue
        fileEntries.push({
          path: file.webkitRelativePath || file.name,
          name: file.name,
          text: async () => file.text(),
          getFile: async () => file
        })
      }
    }

    // 2. Scan
    for (const entry of fileEntries) {
      const path = entry.path
      const fileName = entry.name

      if (path.includes('__MACOSX/') || fileName.startsWith('._')) continue

      const rootFolderMatch = path.match(/^([^/]+)\.mod\//i)
      if (rootFolderMatch && detectedLanguageName === 'Unknown') detectedLanguageName = rootFolderMatch[1]

      if (path.endsWith('.mod.meta')) {
        const metaText = await entry.text()
        const match = metaText.match(/^GUID:\s*(.+)$/m)
        if (match) detectedModGuid = match[1].trim()
        continue
      }

      if (path.endsWith('Items.setting')) { itemsSettingContent = await entry.text(); continue }
      if (path.endsWith('Translations.setting')) { translationsSettingContent = await entry.text(); continue }

      if (path.includes('/Settings/') && path.endsWith('.setting')) {
        componentSettings[fileName.replace('.setting', '')] = await entry.text()
        continue
      }
      if (path.includes('/Prefabs/') && path.endsWith('.prefab')) {
        fileNameToTextMap[fileName.replace('.prefab', '')] = await entry.text()
        continue
      }
      if (path.includes('/_GeneratedThumbnails/') && path.endsWith('.png')) {
        thumbnailFiles.push(await entry.getFile())
        continue
      }

      const depth = path.split('/').length

      // PNG meta sidecars — extract assetGuid, keyed by basename
      if (depth === 2 && fileName.endsWith('.png.meta')) {
        const basename = fileName.replace('.png.meta', '')
        const metaText = await entry.text()
        const guidMatch = metaText.match(/^GUID:\s*(.+)$/m)
        if (guidMatch) pngMetaGuidByBasename[basename] = guidMatch[1].trim()
        continue
      }

      // Root-level PNG files — store File by basename, joined to GUID after scan
      if (depth === 2 && fileName.endsWith('.png')) {
        const basename = fileName.replace('.png', '')
        pngFileByBasename[basename] = await entry.getFile()
        continue
      }

      if (depth === 2 && fileName.endsWith('.fbx.meta')) {
        const basename = fileName.replace('.fbx.meta', '')
        const metaText = await entry.text()
        const guidMatch = metaText.match(/^GUID:\s*(.+)$/m)
        if (guidMatch) fbxMetaGuids[basename] = guidMatch[1].trim()
        continue
      }
      if (depth === 2 && fileName.endsWith('.fbx')) {
        fbxFiles[fileName.replace('.fbx', '')] = await entry.getFile()
        continue
      }
      if (depth === 2 && fileName.endsWith('.mod.thumbnail')) {
        const coverKey = `cover_${newProjectId}`
        await registerFileInCache(coverKey, await entry.getFile())
        projectCoverKey = coverKey
        continue
      }

      if (path.endsWith('Prefabs.Metacache')) {
        const blocks = (await entry.text()).split('\n\n')
        blocks.forEach(block => {
          const lines = block.split('\n')
          let p = '', g = ''
          lines.forEach(l => {
            const t = l.trim()
            if (t.startsWith('Prefabs/')) p = t.replace('Prefabs/', '').replace('.prefab', '')
            if (t.startsWith('GUID:')) g = t.split(':')[1].trim()
          })
          if (p && g) prefabGuidToNameMap[g] = p
        })
      }
    }

    // Join PNG basename→guid and basename→File into assetGuid→File
    const pngByAssetGuid: Record<string, File> = {}
    for (const [basename, assetGuid] of Object.entries(pngMetaGuidByBasename)) {
      const file = pngFileByBasename[basename]
      if (file) pngByAssetGuid[assetGuid] = file
    }

    if (!itemsSettingContent && !translationsSettingContent) {
      alert('Could not locate Items.setting or Translations.setting.')
      return
    }

    const originalZipBlob = isArchive
      ? fileList[0] as Blob
      : await (async () => {
          const zip = new JSZip()
          for (const entry of fileEntries) zip.file(entry.path, await entry.getFile())
          return zip.generateAsync({ type: 'blob' })
        })()
    await assetDb.saveFileRaw(`original_zip_${newProjectId}`, originalZipBlob)

    // 3. Parsers
    const parseParalivesSetting = (text: string): RawItemMeta[] => {
      const lines = text.split('\n')
      const itemsList: RawItemMeta[] = []
      let currentItem: RawItemMeta | null = null
      let currentArrayKey: string | null = null
      let currentArrayEntry: RawArrayEntry | null = null

      const flushArrayEntry = () => {
        if (!currentItem || !currentArrayKey || !currentArrayEntry) return
        if (!currentItem._arrays[currentArrayKey]) currentItem._arrays[currentArrayKey] = []
        currentItem._arrays[currentArrayKey].push(currentArrayEntry)
        currentArrayEntry = null
      }

      for (const rawLine of lines) {
        const indent = rawLine.length - rawLine.trimStart().length
        const line = rawLine.trim()
        if (!line || line.startsWith('#') || line === '=AllItems') continue

        if (indent === 2 && line.startsWith('@')) {
          flushArrayEntry()
          if (currentItem?.guid) itemsList.push(currentItem)
          currentItem = { _arrays: {} }
          currentArrayKey = null
          currentArrayEntry = null
          continue
        }
        if (indent === 4 && line.startsWith('@') && currentArrayKey) {
          flushArrayEntry()
          currentArrayEntry = { _entryGuid: line.substring(1).trim() }
          continue
        }
        if (!currentItem) continue

        if (indent === 3 && line.startsWith('=')) {
          const cleanProp = line.substring(1)
          const sep = cleanProp.indexOf(':')
          if (sep === -1) {
            flushArrayEntry()
            currentArrayKey = cleanProp.trim()
            currentArrayEntry = null
            continue
          }
          const key = cleanProp.substring(0, sep).trim()
          const value = cleanProp.substring(sep + 1).trim()
          currentArrayKey = null
          currentArrayEntry = null
          if (key === 'GUID') currentItem.guid = value
          else if (key === 'CustomModGUID') currentItem.modGuid = value
          else if (key === 'DisplayName') currentItem.displayNameGuid = value
          else if (key === 'Prefab') currentItem.targetPrefabGuid = value
          else if (key === 'HideFromCatalog') currentItem.hideFromCatalog = value === 'True'
          else if (key === 'HasSwatches') currentItem.hasSwatches = value === 'True'
          else if (key === 'SwatchGroup') currentItem.swatchGroup = value
          else if (key === 'DefaultSwatch') currentItem.defaultSwatch = value
          else if (key === 'SwatchColorZoneCount') currentItem.swatchColorZoneCount = parseInt(value) || 0
          else if (key === 'SwatchThumbnailType') currentItem.swatchThumbnailType = parseInt(value) || 1
          else if (key === 'PriceOverride') currentItem.price = parseFloat(value) || 0
          else if (key === 'PriceMultiplier') currentItem.priceMultiplier = parseFloat(value) || 1
          else if (key === 'PriceSkinProperty') currentItem.priceSkinProperty = value
          else if (key === 'MultipurchaseOverride') currentItem.multipurchaseOverride = value
          else if (key === 'AutoSelect') currentItem.autoSelect = value === 'True'
          else if (key === 'ItemPlacementTweenOverride') currentItem.itemPlacementTweenOverride = value
          else if (key === 'OverrideSnap') currentItem.overrideSnap = value === 'True'
          else if (key === 'RotateToSnapOverride') currentItem.rotateToSnapOverride = value
          else if (key === 'AlwaysVisibleOnWalls') currentItem.alwaysVisibleOnWalls = value === 'True'
          else if (key === 'RenderAsWall') currentItem.renderAsWall = value === 'True'
          else if (key === 'OverrideItemFadingFromCamera') currentItem.overrideItemFadingFromCamera = value === 'True'
          else if (key === 'CannotBatch') currentItem.cannotBatch = value === 'True'
          else if (key === 'OverrideItemForAnimation') currentItem.overrideItemForAnimation = value
          else if (key === 'IgnoreUsageLevelFromTags') currentItem.ignoreUsageLevelFromTags = value === 'True'
          else if (key === 'DirtinessSpeedTier') currentItem.dirtinessSpeedTier = value
          else if (key === 'BreakingSpeedTier') currentItem.breakingSpeedTier = value
          else if (key === 'SynchronizeSwatchAmongVariants') currentItem.synchronizeSwatchAmongVariants = value === 'True'
          else if (key === 'IgnoreRememberIndexForCategory') currentItem.ignoreRememberIndexForCategory = value === 'True'
          else if (key === 'HasSizeVariantsOverrides') currentItem.hasSizeVariantsOverrides = value === 'True'
          else if (key === 'CollectibleCollection') currentItem.collectibleCollection = value
          else if (key === 'PatreonName') currentItem.patreonName = value
          else if (key === 'OverrideInteractionGroup') currentItem.overrideInteractionGroup = value === 'True'
          else if (key === 'OverrideImpostorInteractions') currentItem.overrideImpostorInteractions = value === 'True'
          continue
        }

        if (indent === 5 && line.startsWith('=') && currentArrayEntry) {
          const cleanProp = line.substring(1)
          const sep = cleanProp.indexOf(':')
          if (sep === -1) continue
          currentArrayEntry[cleanProp.substring(0, sep).trim()] = cleanProp.substring(sep + 1).trim()
          continue
        }
      }

      flushArrayEntry()
      if (currentItem?.guid) itemsList.push(currentItem)
      return itemsList
    }

    // parsePrefabValue — parse a scalar property value from a .prefab line.
    //
    // The key insight: Paralives GUIDs are 64-bit unsigned integers stored as
    // decimal strings (up to 19 digits). JavaScript's Number type has only
    // 15–16 significant decimal digits, so parseFloat on a 19-digit GUID
    // silently corrupts the last 3–4 digits — e.g.:
    //   "7631569798772361429"  →  parseFloat  →  7631569798772361000  (wrong)
    //
    // Rule: if the value is a pure integer string with > 15 digits, keep it
    // as a string. Vectors, small integers, and floats parse normally.
    // Non-numeric strings (e.g. 'True', 'False', 'None', 'bool3(...)') are
    // returned as-is regardless.
    const parsePrefabValue = (raw: string): PrefabPropertyValue => {
      // Pure integer string with > 15 digits → GUID, keep as string
      if (/^\d{16,}$/.test(raw)) return raw
      // Negative integer with > 15 digits (rare but safe)
      if (/^-\d{16,}$/.test(raw)) return raw
      // Number (integer or float with ≤ 15 digits)
      const n = Number(raw)
      if (!isNaN(n) && raw.trim() !== '') return n
      // Anything else (strings, 'True', 'False', 'bool3(...)', etc.)
      return raw
    }

        const parsePrefabGraph = (text: string): ComponentNode[] => {
      const lines = text.split('\n')
      const components: ComponentNode[] = []
      let currentNodeGuid = ''
      let currentNodeName = ''
      let currentNodeChildIndex: number | undefined = undefined
      let currentComponent: ComponentNode | null = null
      let inSurfacesBlock = false
      let currentSurface: { guid: string; value: string } | null = null
      let lastIndent1Key: string | null = null
      // ItemMeshReferences registry: nodeGuid → assetMesh GUID string (raw, not parseFloat'd)
      // The registry lives on the root node's ItemMeshReference component and maps every
      // node GUID (root + children) to its AssetMesh. After parsing we do a second pass
      // to copy AssetMesh onto each component by matching component.id to registry keys.
      const meshRefRegistry: Record<string, string> = {}
      let lastMeshRefGuid: string | null = null  // GUID: at indent 2 inside ItemMeshReferences

      const flushComponent = () => {
        if (!currentComponent) return
        if (currentSurface) {
          currentComponent.surfaces = currentComponent.surfaces ?? []
          currentComponent.surfaces.push(currentSurface)
          currentSurface = null
        }
        if (currentComponent.surfaces && currentComponent.surfaces.length === 0) delete currentComponent.surfaces
        components.push(currentComponent)
        currentComponent = null
        inSurfacesBlock = false
        lastIndent1Key = null
      }

      for (const rawLine of lines) {
        if (rawLine === '' || rawLine === '\r') continue
        const indent = rawLine.length - rawLine.trimStart().length
        const line = rawLine.trim()

        if (line === '---') {
          flushComponent()
          currentNodeGuid = ''; currentNodeName = ''; currentNodeChildIndex = undefined
          inSurfacesBlock = false; currentSurface = null; lastIndent1Key = null
          continue
        }

        const itemObjMatch = line.match(/^ItemObject:(\d+)$/)
        if (itemObjMatch && indent === 0) {
          flushComponent()
          currentNodeGuid = itemObjMatch[1]; currentNodeName = ''; currentNodeChildIndex = undefined
          inSurfacesBlock = false; currentSurface = null
          continue
        }

        if (!currentComponent && indent === 1 && line.startsWith('Name:')) { currentNodeName = line.substring(5).trim(); continue }
        if (!currentComponent && line.startsWith('ParentGUID:')) continue
        if (!currentComponent && line.startsWith('ChildIndex:')) {
          const idx = parseInt(line.substring(11).trim(), 10)
          if (!isNaN(idx)) currentNodeChildIndex = idx
          continue
        }

        if (indent === 0 && line.endsWith(':') && !line.startsWith('=') && !line.startsWith('@') && !line.includes('(') && !line.includes(' ')) {
          flushComponent()
          currentComponent = {
            id: currentNodeGuid || crypto.randomUUID(),
            type: line.replace(':', ''),
            nodeName: currentNodeName || undefined,
            childIndex: currentNodeChildIndex,
            properties: {},
            surfaces: [],
          }
          inSurfacesBlock = false; currentSurface = null; lastIndent1Key = null
          continue
        }

        if (!currentComponent) continue

        if (indent === 1 && line === 'Surfaces:') { inSurfacesBlock = true; lastIndent1Key = null; continue }

        if (inSurfacesBlock) {
          if (indent === 2 && line === 'Surface:') {
            if (currentSurface) { currentComponent.surfaces = currentComponent.surfaces ?? []; currentComponent.surfaces.push(currentSurface) }
            currentSurface = { guid: '', value: '' }
            continue
          }
          if (indent === 3 && currentSurface && line.startsWith('GUID:')) { currentSurface.guid = line.substring(5).trim(); continue }
          if (indent === 3 && currentSurface && line.startsWith('Value:')) { currentSurface.value = line.substring(6).trim(); continue }
          if (indent <= 1) {
            if (currentSurface) { currentComponent.surfaces = currentComponent.surfaces ?? []; currentComponent.surfaces.push(currentSurface); currentSurface = null }
            inSurfacesBlock = false
          }
        }

        if (indent === 1 && line.includes(':') && !inSurfacesBlock) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          if (sepIndex === -1) continue
          const pKey = cleanProp.substring(0, sepIndex).trim()
          const pValue = cleanProp.substring(sepIndex + 1).trim()
          if (pKey === 'GUID' || pKey === 'Value') continue
          lastIndent1Key = pKey
          if (pValue === '') currentComponent.properties[pKey] = null
          else if (pValue.startsWith('(') && pValue.endsWith(')'))
            currentComponent.properties[pKey] = pValue.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()) || 0)
          else currentComponent.properties[pKey] = parsePrefabValue(pValue)
          continue
        }

        if (indent === 2 && line.includes(':') && !inSurfacesBlock && lastIndent1Key) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          if (sepIndex === -1) continue
          const pKey = cleanProp.substring(0, sepIndex).trim()
          const pValue = cleanProp.substring(sepIndex + 1).trim()

          // Inside ItemMeshReferences block: capture GUID: entries as registry keys.
          // AssetMesh lives at indent 3 under each GUID entry — handled below.
          if (lastIndent1Key === 'ItemMeshReferences') {
            if (pKey === 'GUID') lastMeshRefGuid = pValue
            // skip all other indent-2 lines inside this block
            continue
          }

          if (pKey === 'GUID' || pKey === 'Value') continue
          const parent = currentComponent.properties[lastIndent1Key]
          const bag: Record<string, PrefabPropertyValue | undefined> =
            typeof parent === 'object' && parent !== null && !Array.isArray(parent) ? parent : { _value: parent }
          currentComponent.properties[lastIndent1Key] = bag
          if (pValue.startsWith('(') && pValue.endsWith(')'))
            bag[pKey] = pValue.replace(/[()]/g, '').split(',').map(n => parseFloat(n.trim()) || 0)
          else bag[pKey] = parsePrefabValue(pValue)
          continue
        }

        // indent 3: AssetMesh inside ItemMeshReferences registry entries
        if (indent === 3 && lastIndent1Key === 'ItemMeshReferences' && lastMeshRefGuid) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          if (sepIndex === -1) continue
          const pKey = cleanProp.substring(0, sepIndex).trim()
          const pValue = cleanProp.substring(sepIndex + 1).trim()
          if (pKey === 'AssetMesh') {
            meshRefRegistry[lastMeshRefGuid] = pValue  // store as raw string — no parseFloat
            lastMeshRefGuid = null
          }
          continue
        }
      }

      flushComponent()

      // Second pass: copy AssetMesh from the registry onto each component by matching
      // component.id to the registry key. The registry is built from the root node's
      // ItemMeshReferences block and covers every node (root + all children).
      for (const c of components) {
        if (c.type === 'ItemMeshReference' && meshRefRegistry[c.id]) {
          c.properties['AssetMesh'] = meshRefRegistry[c.id]
        }
      }

      return components.map(c => ({ ...c, surfaces: c.surfaces && c.surfaces.length > 0 ? c.surfaces : undefined }))
    }

    const extractAnchors = (text: string): string[] => {
      if (!text) return []
      return text.split('\n').filter(l => l.trim().startsWith('=GUID:')).map(l => l.trim().split(':')[1])
    }

    const parseTranslations = (text: string): Record<string, string> => {
      const translations: Record<string, string> = {}
      const lines = text.split(/\r?\n/)
      let currentKey: string | null = null
      for (const line of lines) {
        if (line.startsWith('  g')) currentKey = line.trim()
        else if (currentKey !== null && line.startsWith('   =Value:')) { translations[currentKey] = line.substring(10); currentKey = null }
      }
      return translations
    }

    // 4. Object Synthesis
    Object.keys(prefabGuidToNameMap).forEach((guid) => {
      const name = prefabGuidToNameMap[guid]
      if (fileNameToTextMap[name]) prefabContents[guid] = fileNameToTextMap[name]
    })

    const itemsMeta = itemsSettingContent ? parseParalivesSetting(itemsSettingContent) : []
    const rootStates = extractAnchors(componentSettings['ItemObjectRoot'] || '')
    const meshSurfaces = extractAnchors(componentSettings['ItemMeshReference'] || '')
    const translationMap = translationsSettingContent ? parseTranslations(translationsSettingContent) : {}

    const itemThumbnailKeys: Record<string, string> = {}
    await Promise.all(thumbnailFiles.map(async (file, i) => {
      const item = itemsMeta[i]
      if (!item || !item.guid) return
      const stableKey = `item_thumb_${item.guid}`
      await registerFileInCache(stableKey, file)
      itemThumbnailKeys[item.guid] = stableKey
    }))

    const meshKeys: Record<string, string> = {}
    await Promise.all(Object.entries(fbxFiles).map(async ([basename, file]) => {
      const assetGuid = fbxMetaGuids[basename]
      if (!assetGuid) return
      const stableKey = `mesh_${assetGuid}`
      await assetDb.saveFileRaw(stableKey, file)
      meshKeys[assetGuid] = stableKey
    }))

    // Parse all items and their prefab components first (synchronous)
    const parsedItems = itemsMeta.map((metaItem) => {
      const targetGuid = metaItem.targetPrefabGuid || ''
      const rawPrefabText = prefabContents[targetGuid] || ''
      const extractedComponents = rawPrefabText ? parsePrefabGraph(rawPrefabText) : []

      const translatedName = metaItem.displayNameGuid
        ? (translationMap[`g${metaItem.displayNameGuid}`] ?? translationMap[metaItem.displayNameGuid] ?? null)
        : null
      const trackingName = translatedName
        || (typeof metaItem.displayNameGuid === 'string' && !/^\d+$/.test(metaItem.displayNameGuid) ? metaItem.displayNameGuid : null)
        || prefabGuidToNameMap[targetGuid]
        || 'Imported Object'

      const arrays = metaItem._arrays || {}
      const tags: import('../types/types').ItemTag[] = (arrays['Tag'] || []).map((e: RawArrayEntry) => ({ guid: e._entryGuid || '', value: e['Value'] || '' }))
      const colorZoneNames: import('../types/types').ItemColorZoneName[] = (arrays['ColorZoneNames'] || []).map((e: RawArrayEntry) => ({ guid: e._entryGuid || '', value: e['Value'] || '' }))
      const meshParts: import('../types/types').ItemMeshPart[] = (arrays['MeshParts'] || []).map((e: RawArrayEntry) => ({ guid: e._entryGuid || '', displayName: e['DisplayName'] || '' }))
      const itemVariants: import('../types/types').ItemVariantEntry[] = (arrays['ItemVariants'] || []).map((e: RawArrayEntry) => ({ guid: e._entryGuid || '', itemVariantGuid: e['ItemVariantGUID'] || '' }))
      const variantGuids = itemVariants.length > 0 ? itemVariants.map(v => v.itemVariantGuid).filter(Boolean) : undefined

      return {
        id: crypto.randomUUID(),
        guid: metaItem.guid || crypto.randomUUID(),
        name: trackingName.replace(/([A-Z])/g, ' $1').trim(),
        description: 'Imported Mod Object',
        prefabGuid: targetGuid,
        hideFromCatalog: metaItem.hideFromCatalog ?? false,
        overrideInteractionGroup: metaItem.overrideInteractionGroup ?? false,
        overrideImpostorInteractions: metaItem.overrideImpostorInteractions ?? false,
        tags,
        hasSwatches: metaItem.hasSwatches ?? false,
        swatchGroup: metaItem.swatchGroup ?? '',
        defaultSwatch: metaItem.defaultSwatch ?? '0',
        swatchColorZoneCount: metaItem.swatchColorZoneCount ?? 0,
        swatchThumbnailType: metaItem.swatchThumbnailType ?? 1,
        colorZoneNames,
        price: metaItem.price ?? 5,
        priceMultiplier: metaItem.priceMultiplier ?? 1,
        priceSkinProperty: metaItem.priceSkinProperty ?? 'None',
        multipurchaseOverride: metaItem.multipurchaseOverride ?? 'NoOverride',
        autoSelect: metaItem.autoSelect ?? false,
        itemPlacementTweenOverride: metaItem.itemPlacementTweenOverride ?? 'None',
        meshParts,
        ropeItems: [],
        overrideSnap: metaItem.overrideSnap ?? false,
        rotateToSnapOverride: metaItem.rotateToSnapOverride ?? 'NoOverride',
        alwaysVisibleOnWalls: metaItem.alwaysVisibleOnWalls ?? false,
        renderAsWall: metaItem.renderAsWall ?? false,
        overrideItemFadingFromCamera: metaItem.overrideItemFadingFromCamera ?? false,
        cannotBatch: metaItem.cannotBatch ?? false,
        overrideItemForAnimation: metaItem.overrideItemForAnimation ?? 'None',
        ignoreUsageLevelFromTags: metaItem.ignoreUsageLevelFromTags ?? false,
        dirtinessSpeedTier: metaItem.dirtinessSpeedTier ?? 'None',
        breakingSpeedTier: metaItem.breakingSpeedTier ?? 'None',
        itemVariants,
        variantGuids,
        synchronizeSwatchAmongVariants: metaItem.synchronizeSwatchAmongVariants ?? false,
        ignoreRememberIndexForCategory: metaItem.ignoreRememberIndexForCategory ?? false,
        hasSizeVariantsOverrides: metaItem.hasSizeVariantsOverrides ?? false,
        collectibleCollection: metaItem.collectibleCollection ?? 'None',
        patreonName: metaItem.patreonName ?? '',
        thumbnailKey: itemThumbnailKeys[metaItem.guid ?? ''] ?? null,
        displayNameGuid: metaItem.displayNameGuid ?? undefined,
        meshKeys,
        textureKeys: {},
        componentBlueprints: { rootDefaultStates: rootStates, materialSurfaces: meshSurfaces },
        components: extractedComponents,
      }
    })

    // Build a prefix-match index for GUID precision-loss tolerance.
    // Large GUIDs (≥ 1e15) parsed via parseFloat lose their last few digits.
    // The stored float stringifies to e.g. "1889569615905859400" while the
    // real GUID in the meta file is "1889569615905859423". Both share the same
    // first 13-14 significant digits, so we match on a 13-char prefix as a
    // fallback when an exact string lookup fails.
    const pngGuidKeys = Object.keys(pngByAssetGuid)

    const findPngByGuid = (assetGuid: string): File | undefined => {
      // Exact match first
      if (pngByAssetGuid[assetGuid]) return pngByAssetGuid[assetGuid]
      // Prefix fallback for precision-lossy floats
      const prefix = assetGuid.substring(0, 13)
      const match = pngGuidKeys.find(k => k.startsWith(prefix))
      return match ? pngByAssetGuid[match] : undefined
    }

    await Promise.all(parsedItems.map(async (item) => {
      const meshRefNodes = item.components.filter(c => c.type === 'ItemMeshReference')
      for (const node of meshRefNodes) {
        for (const slot of ITEM_MESH_TEXTURE_SLOTS) {
          const assetGuidRaw = node.properties[slot]
          if (assetGuidRaw == null) continue
          const assetGuid = String(assetGuidRaw)
          const pngFile = findPngByGuid(assetGuid)
          if (!pngFile) continue
          const cacheKey = itemTextureCacheKey(item.guid, slot)
          await assetDb.saveFileRaw(cacheKey, pngFile)
        }
      }
    }))

    const parsedTranslations: TranslationData[] = []
    if (translationsSettingContent) {
      parsedTranslations.push({ language: detectedLanguageName || 'Custom', strings: parseTranslations(translationsSettingContent) })
    }

    const resolvedModGuid = detectedModGuid ?? itemsMeta[0]?.modGuid ?? undefined
    const detectedModType: ModType = itemsMeta.length > 0 ? 'item' : 'translation'

    const synthesizedProject: ModProject = {
      id: newProjectId,
      modType: detectedModType,
      modGuid: resolvedModGuid,
      name: parsedItems[0]?.name || detectedLanguageName || 'Imported Mod',
      description: 'Imported Paralives engine mod configuration.',
      version: '1.0.0',
      author: 'Studio Creator',
      coverThumbnailKey: projectCoverKey,
      items: parsedItems,
      assets: [],
      translations: parsedTranslations,
      workshopTags: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onImportComplete(synthesizedProject)
  }

  const directoryAttributes = { webkitdirectory: "", directory: "" } as React.InputHTMLAttributes<HTMLInputElement>

  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
      onDragLeave={() => setIsDragging(false)}
      onDrop={(e) => {
        e.preventDefault()
        setIsDragging(false)
        if (e.dataTransfer.files) processFiles(e.dataTransfer.files)
      }}
      className={`border-2 border-dashed rounded-2xl p-12 flex flex-col items-center justify-center gap-4 transition-all duration-150 text-center select-none ${
        isDragging
          ? 'border-[#8b5cf6] bg-[#8b5cf6]/5 text-white'
          : 'border-white/10 bg-[#161923] text-gray-400 hover:border-white/20'
      }`}
    >
      <div className="p-4 bg-white/2 rounded-full text-gray-300">
        <Folder size={32} weight="duotone" className={isDragging ? 'text-[#8b5cf6]' : ''} />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-sm font-semibold text-white">Drag and drop your .mod or .zip file here</p>
        <p className="text-xs text-gray-500 max-w-xs">Your browser will automatically extract the internal definitions.</p>
      </div>
      <label className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors mt-2">
        <UploadSimple size={14} weight="bold" />
        <span>Select Folder</span>
        <input ref={triggerRef} type="file" className="hidden" multiple onChange={(e) => e.target.files && processFiles(e.target.files)} {...directoryAttributes} />
      </label>
    </div>
  )
}
