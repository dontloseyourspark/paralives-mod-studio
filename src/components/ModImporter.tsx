// src/components/ModImporter.tsx
import React, { useState } from 'react'
import { Folder, UploadSimple } from 'phosphor-react'
import JSZip from 'jszip'
import { useModStore } from '../store/useModStore'
import { assetDb } from '../utils/assetDb'
import type { ModProject, TranslationData, ComponentNode, ModType, PrefabPropertyValue } from '../types/types'

interface ModImporterProps {
  onImportComplete: (project: ModProject) => void
  triggerRef?: React.RefObject<HTMLInputElement | null>
}

// RawArrayEntry — one @GUID entry inside an array block (Tag, ColorZoneNames,
// MeshParts, ItemVariants). _entryGuid is the entry's own throwaway GUID;
// every other key is whatever flat field that array's entries carry
// (Value, DisplayName, ItemVariantGUID, etc).
interface RawArrayEntry {
  _entryGuid: string
  [key: string]: string
}

// RawItemMeta — one @GUID item entry parsed from Items.setting, before
// synthesis into a full Item. Mirrors the flat Items.setting fields handled
// in parseParalivesSetting; structured sub-arrays land in _arrays and are
// built into typed ItemTag[]/ItemColorZoneName[]/etc. in Object Synthesis.
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

    // Generate the project ID up front so the cover key can reference it
    // during the scan loop — keeps cover_${id} consistent with how
    // manually uploaded covers are keyed
    const newProjectId = crypto.randomUUID()

    // Purge all keys from previous import sessions before writing new ones.
    // Keeps cover_ keys (they're per-project and should persist across sessions).
    // Purges everything else: item_thumb_*, texture keys, etc.
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

    // Thumbnails collected in order — matched positionally to items
    const thumbnailFiles: File[] = []
    let projectCoverKey: string | null = null

    // FBX mesh assets: filename (without .fbx) → File, matched to its asset GUID
    // via the .fbx.meta sidecar of the same basename. Mod-wide (not per-item) —
    // MeshViewport resolves which GUID to show per node via AssetMesh properties.
    const fbxFiles: Record<string, File> = {}
    const fbxMetaGuids: Record<string, string> = {}

    // 1. Normalize file inputs (handles both zip archives and unzipped directories)
    const isArchive = fileList.length === 1 && (fileList[0].name.endsWith('.zip') || fileList[0].name.endsWith('.mod'))

    if (isArchive) {
      detectedLanguageName = fileList[0].name.replace(/\.(zip|mod)$/i, '')
    }

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

    // 2. Scan and categorize entries
    for (const entry of fileEntries) {
      const path = entry.path
      const fileName = entry.name

      // Skip macOS zip cruft: the __MACOSX/ sidecar folder and the ._-prefixed
      // AppleDouble resource-fork file it creates for every real file when a
      // folder is zipped via macOS's "Compress" feature. Without this, a real
      // Settings/Translations.setting and its __MACOSX/.../._Translations.setting
      // junk twin both match the same endsWith() checks below, and whichever is
      // processed last silently overwrites the real content with ~200 bytes of
      // binary AppleDouble header — corrupting (usually emptying) the import.
      if (path.includes('__MACOSX/') || fileName.startsWith('._')) continue

      const rootFolderMatch = path.match(/^([^/]+)\.mod\//i)
      if (rootFolderMatch && detectedLanguageName === 'Unknown') {
        detectedLanguageName = rootFolderMatch[1]
      }

      // .mod.meta holds the stable ModGUID. Filename is {Name}_{ModGUID}.mod.meta —
      // checking endsWith('_mod.meta') (no GUID digits in between) never matches.
      if (path.endsWith('.mod.meta')) {
        const metaText = await entry.text()
        const match = metaText.match(/^GUID:\s*(.+)$/m)
        if (match) detectedModGuid = match[1].trim()
        continue
      }

      if (path.endsWith('Items.setting')) {
        itemsSettingContent = await entry.text()
        continue
      }
      if (path.endsWith('Translations.setting')) {
        translationsSettingContent = await entry.text()
        continue
      }
      if (path.includes('/Settings/') && path.endsWith('.setting')) {
        const settingName = fileName.replace('.setting', '')
        componentSettings[settingName] = await entry.text()
        continue
      }
      if (path.includes('/Prefabs/') && path.endsWith('.prefab')) {
        const pName = fileName.replace('.prefab', '')
        fileNameToTextMap[pName] = await entry.text()
        continue
      }

      // Collect generated item thumbnails in order — positionally matched to items later
      if (path.includes('/_GeneratedThumbnails/') && path.endsWith('.png')) {
        thumbnailFiles.push(await entry.getFile())
        continue
      }

      // Root-level PNGs: register in IDB for potential future use but do not
      // map to PBR slot names — slot bindings come from the prefab, not filenames.
      if (path.split('/').length === 2 && path.endsWith('.png')) {
        const textureKey = fileName.replace('.png', '')
        await registerFileInCache(textureKey, await entry.getFile())
        continue
      }

      // FBX meta sidecars — extract the asset GUID (checked before the plain
      // .fbx case below since both share the same root-level depth check)
      if (path.split('/').length === 2 && path.endsWith('.fbx.meta')) {
        const basename = fileName.replace('.fbx.meta', '')
        const metaText = await entry.text()
        const guidMatch = metaText.match(/^GUID:\s*(.+)$/m)
        if (guidMatch) fbxMetaGuids[basename] = guidMatch[1].trim()
        continue
      }

      // FBX mesh files — store the raw file, matched to its meta GUID below
      if (path.split('/').length === 2 && path.endsWith('.fbx')) {
        const basename = fileName.replace('.fbx', '')
        fbxFiles[basename] = await entry.getFile()
        continue
      }

      // Key cover to project ID — same pattern as manually uploaded covers,
      // so getBlobUrlFromCache finds it and the dashboard displays it correctly
      if (path.split('/').length === 2 && path.endsWith('.mod.thumbnail')) {
        const coverKey = `cover_${newProjectId}`
        await registerFileInCache(coverKey, await entry.getFile())
        projectCoverKey = coverKey
        continue
      }

      if (path.endsWith('Prefabs.Metacache')) {
        const cacheText = await entry.text()
        const blocks = cacheText.split('\n\n')

        blocks.forEach(block => {
          const lines = block.split('\n')
          let currentPath = ''
          let currentGuid = ''

          lines.forEach(l => {
            const trimL = l.trim()
            if (trimL.startsWith('Prefabs/')) {
              currentPath = trimL.replace('Prefabs/', '').replace('.prefab', '')
            }
            if (trimL.startsWith('GUID:')) {
              currentGuid = trimL.split(':')[1].trim()
            }
          })

          if (currentPath && currentGuid) {
            prefabGuidToNameMap[currentGuid] = currentPath
          }
        })
      }
    }

    if (!itemsSettingContent && !translationsSettingContent) {
      alert('Could not locate Items.setting or Translations.setting.')
      return
    }

    // Preserve the original archive so item mods can later be re-exported by
    // patching just the edited Items.setting fields back into the untouched
    // original files (see lib/itemModExporter.ts) — rather than regenerating
    // everything (prefabs, Metacache, etc.) from scratch, which isn't built yet.
    const originalZipBlob = isArchive
      ? fileList[0] as Blob
      : await (async () => {
          const zip = new JSZip()
          for (const entry of fileEntries) zip.file(entry.path, await entry.getFile())
          return zip.generateAsync({ type: 'blob' })
        })()
    await assetDb.saveFileRaw(`original_zip_${newProjectId}`, originalZipBlob)

    // 3. Parsers

    // parseParalivesSetting — captures all Items.setting fields.
    //
    // Items.setting indent layout (using spaces):
    //   2 spaces  @GUID  — top-level item entry
    //   3 spaces  =Key:Value — item flat field
    //   3 spaces  =ArrayKey  — array block opener (no value)
    //   4 spaces  @GUID  — array entry
    //   5 spaces  =Key:Value — array entry field
    //
    // We track: currentItem → currentArrayKey → currentArrayEntry
    // (RawArrayEntry / RawItemMeta are declared at module scope above)
    const parseParalivesSetting = (text: string): RawItemMeta[] => {
      const lines = text.split('\n')
      const itemsList: RawItemMeta[] = []
      let currentItem: RawItemMeta | null = null
      let currentArrayKey: string | null = null
      let currentArrayEntry: RawArrayEntry | null = null

      const flushArrayEntry = () => {
        if (!currentItem || !currentArrayKey || !currentArrayEntry) return
        if (!currentItem._arrays) currentItem._arrays = {}
        if (!currentItem._arrays[currentArrayKey]) currentItem._arrays[currentArrayKey] = []
        currentItem._arrays[currentArrayKey].push(currentArrayEntry)
        currentArrayEntry = null
      }

      for (const rawLine of lines) {
        const indent = rawLine.length - rawLine.trimStart().length
        const line = rawLine.trim()
        if (!line || line.startsWith('#') || line === '=AllItems') continue

        // 2-space @GUID — new top-level item
        if (indent === 2 && line.startsWith('@')) {
          flushArrayEntry()
          if (currentItem?.guid) itemsList.push(currentItem)
          currentItem = { _arrays: {} }
          currentArrayKey = null
          currentArrayEntry = null
          continue
        }

        // 4-space @GUID — array entry inside current array block
        if (indent === 4 && line.startsWith('@') && currentArrayKey) {
          flushArrayEntry()
          currentArrayEntry = { _entryGuid: line.substring(1).trim() }
          continue
        }

        if (!currentItem) continue

        // 3-space =Key or =Key:Value — item-level field
        if (indent === 3 && line.startsWith('=')) {
          const cleanProp = line.substring(1)
          const sep = cleanProp.indexOf(':')

          if (sep === -1) {
            // Array block opener (e.g. =Tag, =ItemVariants, =ColorZoneNames)
            flushArrayEntry()
            currentArrayKey = cleanProp.trim()
            currentArrayEntry = null
            continue
          }

          const key = cleanProp.substring(0, sep).trim()
          const value = cleanProp.substring(sep + 1).trim()

          // Reset array context — flat field ends any array block
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

        // 5-space =Key:Value — field inside an array entry
        if (indent === 5 && line.startsWith('=') && currentArrayEntry) {
          const cleanProp = line.substring(1)
          const sep = cleanProp.indexOf(':')
          if (sep === -1) continue
          const key = cleanProp.substring(0, sep).trim()
          const value = cleanProp.substring(sep + 1).trim()
          currentArrayEntry[key] = value
          continue
        }
      }

      flushArrayEntry()
      if (currentItem?.guid) itemsList.push(currentItem)
      return itemsList
    }

    // parsePrefabGraph — indentation-aware prefab parser.
    //
    // The Paralives prefab format uses indentation as structure (LF line endings, no CRLF):
    //   indent 0 — component headings (ItemMeshReference:) and node separators (---)
    //   indent 1 — flat properties on the current component, OR sub-block openers (Surfaces:)
    //   indent 2 — entries inside a sub-block (Surface:)
    //   indent 3 — properties inside a sub-block entry (GUID:, Value: inside Surface)
    //
    // ColorZoneMap and DetailMap are at indent 1 — flat properties on ItemMeshReference,
    // appearing after the Surfaces block closes. They are what the texture editor reads/writes.
    const parsePrefabGraph = (text: string): ComponentNode[] => {
      const lines = text.split('\n')
      const components: ComponentNode[] = []

      let currentNodeGuid = ''
      let currentNodeName = ''
      let currentNodeChildIndex: number | undefined = undefined
      let currentComponent: ComponentNode | null = null
      let inSurfacesBlock = false
      let currentSurface: { guid: string; value: string } | null = null
      // Tracks the last indent-1 property key so indent-2 lines can be attached
      // to it as sub-properties rather than being dropped or flattened incorrectly.
      let lastIndent1Key: string | null = null

      const flushComponent = () => {
        if (!currentComponent) return
        if (currentSurface) {
          currentComponent.surfaces = currentComponent.surfaces ?? []
          currentComponent.surfaces.push(currentSurface)
          currentSurface = null
        }
        if (currentComponent.surfaces && currentComponent.surfaces.length === 0) {
          delete currentComponent.surfaces
        }
        components.push(currentComponent)
        currentComponent = null
        inSurfacesBlock = false
        lastIndent1Key = null
      }

      for (const rawLine of lines) {
        if (rawLine === '' || rawLine === '\r') continue

        const indent = rawLine.length - rawLine.trimStart().length
        const line = rawLine.trim()

        // Node separator
        if (line === '---') {
          flushComponent()
          currentNodeGuid = ''
          currentNodeName = ''
          currentNodeChildIndex = undefined
          inSurfacesBlock = false
          currentSurface = null
          lastIndent1Key = null
          continue
        }

        // ItemObject:{guid} at indent 0 — capture stable node GUID
        const itemObjMatch = line.match(/^ItemObject:(\d+)$/)
        if (itemObjMatch && indent === 0) {
          flushComponent()
          currentNodeGuid = itemObjMatch[1]
          currentNodeName = ''
          currentNodeChildIndex = undefined
          inSurfacesBlock = false
          currentSurface = null
          continue
        }

        // Name: at indent 1, before any component is open
        if (!currentComponent && indent === 1 && line.startsWith('Name:')) {
          currentNodeName = line.substring(5).trim()
          continue
        }

        // ParentGUID: — structural metadata, skip
        if (!currentComponent && line.startsWith('ParentGUID:')) {
          continue
        }

        // ChildIndex: — capture for disambiguation of same-named child nodes
        if (!currentComponent && line.startsWith('ChildIndex:')) {
          const idx = parseInt(line.substring(11).trim(), 10)
          if (!isNaN(idx)) currentNodeChildIndex = idx
          continue
        }

        // Component heading: indent 0, ends with ':', no spaces in the name
        // e.g. "ItemMeshReference:", "ItemObjectRoot:", "ItemCubeTransform:"
        if (
          indent === 0 &&
          line.endsWith(':') &&
          !line.startsWith('=') &&
          !line.startsWith('@') &&
          !line.includes('(') &&
          !line.includes(' ')
        ) {
          flushComponent()
          currentComponent = {
            id: currentNodeGuid || crypto.randomUUID(),
            type: line.replace(':', ''),
            nodeName: currentNodeName || undefined,
            childIndex: currentNodeChildIndex,
            properties: {},
            surfaces: [],
          }
          inSurfacesBlock = false
          currentSurface = null
          lastIndent1Key = null
          continue
        }

        if (!currentComponent) continue

        // ' Surfaces:' at indent 1 — enter surface block
        if (indent === 1 && line === 'Surfaces:') {
          inSurfacesBlock = true
          lastIndent1Key = null
          continue
        }

        if (inSurfacesBlock) {
          // '  Surface:' at indent 2 — new surface entry
          if (indent === 2 && line === 'Surface:') {
            if (currentSurface) {
              currentComponent.surfaces = currentComponent.surfaces ?? []
              currentComponent.surfaces.push(currentSurface)
            }
            currentSurface = { guid: '', value: '' }
            continue
          }
          // '   GUID:' / '   Value:' at indent 3 — properties inside Surface
          if (indent === 3 && currentSurface && line.startsWith('GUID:')) {
            currentSurface.guid = line.substring(5).trim()
            continue
          }
          if (indent === 3 && currentSurface && line.startsWith('Value:')) {
            currentSurface.value = line.substring(6).trim()
            continue
          }
          // Back to indent 1 — surfaces block is done, fall through to flat property parsing
          if (indent <= 1) {
            if (currentSurface) {
              currentComponent.surfaces = currentComponent.surfaces ?? []
              currentComponent.surfaces.push(currentSurface)
              currentSurface = null
            }
            inSurfacesBlock = false
            // Fall through
          }
        }

        // ── Property parsing (indent 1 and indent 2) ──────────────────────
        //
        // Indent-1 lines are direct properties on the component.
        // Indent-2 lines are sub-properties of the most recent indent-1 key.
        //
        // When a property has sub-properties, it's stored as an object:
        //   { _value: 'True', ScalableAxes: 'bool3(...)', HasMinScale: 'True', MinScale: 0.0135 }
        // When it has no sub-properties, it's stored as a plain value:
        //   'True' | 0.0135 | [0.5, 0.5, 0.5]
        //
        // This preserves all values from the prefab including nested ones like
        // SurfaceCanBeNotFlat (under ItemCanBeStackedOn) and ScalableAxes/
        // HasMinScale/MinScale/HasMaxScale/MaxScale (under IsScalable).

        if (indent === 1 && line.includes(':') && !inSurfacesBlock) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          if (sepIndex === -1) continue
          const pKey = cleanProp.substring(0, sepIndex).trim()
          const pValue = cleanProp.substring(sepIndex + 1).trim()
          if (pKey === 'GUID' || pKey === 'Value') continue

          lastIndent1Key = pKey

          if (pValue === '') {
            // Sub-block opener with no value (e.g. ItemMeshReferences:) — null placeholder
            currentComponent.properties[pKey] = null
          } else if (pValue.startsWith('(') && pValue.endsWith(')')) {
            currentComponent.properties[pKey] = pValue
              .replace(/[()]/g, '')
              .split(',')
              .map(n => parseFloat(n.trim()) || 0)
          } else {
            currentComponent.properties[pKey] = isNaN(Number(pValue)) ? pValue : parseFloat(pValue)
          }
          continue
        }

        if (indent === 2 && line.includes(':') && !inSurfacesBlock && lastIndent1Key) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          if (sepIndex === -1) continue
          const pKey = cleanProp.substring(0, sepIndex).trim()
          const pValue = cleanProp.substring(sepIndex + 1).trim()
          // Skip GUID/Value/AssetMesh — these are mesh-registry entries, not component props
          if (pKey === 'GUID' || pKey === 'Value' || pKey === 'AssetMesh') continue

          // Promote the parent property to an object so it can hold sub-properties.
          // Use a separately-typed `bag` reference (rather than re-indexing the
          // PrefabPropertyValue union below) so TS knows it's safe to write subkeys into.
          const parent = currentComponent.properties[lastIndent1Key]
          const bag: Record<string, PrefabPropertyValue | undefined> =
            typeof parent === 'object' && parent !== null && !Array.isArray(parent)
              ? parent
              : { _value: parent } // Preserve the original scalar value under _value
          currentComponent.properties[lastIndent1Key] = bag

          if (pValue.startsWith('(') && pValue.endsWith(')')) {
            bag[pKey] = pValue
              .replace(/[()]/g, '')
              .split(',')
              .map(n => parseFloat(n.trim()) || 0)
          } else {
            bag[pKey] = isNaN(Number(pValue))
              ? pValue
              : parseFloat(pValue)
          }
          continue
        }
      }

      flushComponent()

      return components.map(c => ({
        ...c,
        surfaces: c.surfaces && c.surfaces.length > 0 ? c.surfaces : undefined,
      }))
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
        if (line.startsWith('  g')) {
          currentKey = line.trim()
        } else if (currentKey !== null && line.startsWith('   =Value:')) {
          translations[currentKey] = line.substring(10)
          currentKey = null
        }
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

    // Build translation map once outside the item loop
    const translationMap = translationsSettingContent
      ? parseTranslations(translationsSettingContent)
      : {}

    // Register each thumbnail under a stable item GUID-based key, positionally matched.
    // Awaited in parallel so all IndexedDB writes finish before we call onImportComplete.
    const itemThumbnailKeys: Record<string, string> = {}
    await Promise.all(thumbnailFiles.map(async (file, i) => {
      const item = itemsMeta[i]
      if (!item || !item.guid) return
      const stableKey = `item_thumb_${item.guid}`
      await registerFileInCache(stableKey, file)
      itemThumbnailKeys[item.guid] = stableKey
    }))

    // Register each FBX under a stable asset-GUID-based key (mesh_{assetGuid}).
    // Mod-wide, not per-item — every item gets the same map; MeshViewport picks
    // the right entry per node via its AssetMesh property.
    //
    // Uses saveFileRaw (not registerFileInCache) — registerFileInCache routes
    // through assetDb.saveFile, which assumes every file is a displayable image
    // and tries to draw it onto a <canvas> for WebP compression. An FBX binary
    // isn't a valid image, so that draw silently fails and the file never
    // actually gets persisted — MeshViewport would then hang on "Loading mesh…"
    // forever (assetDb.getFile resolves null, and the loader has nothing to load).
    // MeshViewport always reads FBX bytes via assetDb.getFile directly, so there's
    // no need for the in-memory binaryFileCache/stringUrlCache registerFileInCache provides.
    const meshKeys: Record<string, string> = {}
    await Promise.all(Object.entries(fbxFiles).map(async ([basename, file]) => {
      const assetGuid = fbxMetaGuids[basename]
      if (!assetGuid) return
      const stableKey = `mesh_${assetGuid}`
      await assetDb.saveFileRaw(stableKey, file)
      meshKeys[assetGuid] = stableKey
    }))

    const parsedItems = itemsMeta.map((metaItem) => {
      const targetGuid = metaItem.targetPrefabGuid || ''
      const rawPrefabText = prefabContents[targetGuid] || ''
      const extractedComponents = rawPrefabText ? parsePrefabGraph(rawPrefabText) : []

      // Resolve display name via translation map using the stored GUID key
      const translatedName = metaItem.displayNameGuid
        ? (translationMap[`g${metaItem.displayNameGuid}`] ?? translationMap[metaItem.displayNameGuid] ?? null)
        : null
      const trackingName = translatedName
        || (typeof metaItem.displayNameGuid === 'string' && !/^\d+$/.test(metaItem.displayNameGuid) ? metaItem.displayNameGuid : null)
        || prefabGuidToNameMap[targetGuid]
        || 'Imported Object'

      const matchedThumbnailKey = itemThumbnailKeys[metaItem.guid ?? ''] ?? null

      // Build typed sub-arrays from the _arrays bag
      const arrays = metaItem._arrays || {}

      const tags: import('../types/types').ItemTag[] = (arrays['Tag'] || []).map((e: RawArrayEntry) => ({
        guid: e._entryGuid || '',
        value: e['Value'] || '',
      }))

      const colorZoneNames: import('../types/types').ItemColorZoneName[] = (arrays['ColorZoneNames'] || []).map((e: RawArrayEntry) => ({
        guid: e._entryGuid || '',
        value: e['Value'] || '',
      }))

      const meshParts: import('../types/types').ItemMeshPart[] = (arrays['MeshParts'] || []).map((e: RawArrayEntry) => ({
        guid: e._entryGuid || '',
        displayName: e['DisplayName'] || '',
      }))

      const itemVariants: import('../types/types').ItemVariantEntry[] = (arrays['ItemVariants'] || []).map((e: RawArrayEntry) => ({
        guid: e._entryGuid || '',
        itemVariantGuid: e['ItemVariantGUID'] || '',
      }))

      const variantGuids = itemVariants.length > 0
        ? itemVariants.map(v => v.itemVariantGuid).filter(Boolean)
        : undefined

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
        thumbnailKey: matchedThumbnailKey,
        meshKeys,
        textureKeys: {},
        componentBlueprints: { rootDefaultStates: rootStates, materialSurfaces: meshSurfaces },
        components: extractedComponents,
      }
    })

    const parsedTranslations: TranslationData[] = []
    if (translationsSettingContent) {
      parsedTranslations.push({
        language: detectedLanguageName || 'Custom',
        strings: parseTranslations(translationsSettingContent)
      })
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