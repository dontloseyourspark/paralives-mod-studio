// src/components/ModImporter.tsx
import React, { useState } from 'react'
import { Folder, UploadSimple } from 'phosphor-react'
import JSZip from 'jszip'
import { useModStore } from '../store/useModStore'
import { assetDb } from '../utils/assetDb'
import type { ModProject, TranslationData, ComponentNode, ModType } from '../types/types'

interface ModImporterProps {
  onImportComplete: (project: ModProject) => void
}

export default function ModImporter({ onImportComplete }: ModImporterProps) {
  const [isDragging, setIsDragging] = useState(false)
  const registerFileInCache = useModStore((state) => state.registerFileInCache)

  const processFiles = async (fileList: FileList | File[]) => {

    // Generate the project ID up front so the cover key can reference it
    // during the scan loop — keeps cover_${id} consistent with how
    // manually uploaded covers are keyed
    const newProjectId = crypto.randomUUID()

    // Purge all keys from previous import sessions before writing new ones.
    // Keeps cover_ keys (they're per-project and should persist across sessions).
    // Purges everything else: item_thumb_*, PROJECT_COVER_MASTER, texture keys.
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
    const textureKeys: Record<string, string> = {}
    let projectCoverKey: string | null = null

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

      const rootFolderMatch = path.match(/^([^/]+)\.mod\//i)
      if (rootFolderMatch && detectedLanguageName === 'Unknown') {
        detectedLanguageName = rootFolderMatch[1]
      }

      // _mod.meta holds the stable ModGUID
      if (path.endsWith('_mod.meta')) {
        const metaText = await entry.text()
        const match = metaText.match(/^ModGUID:\s*(.+)$/m)
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

      // Await registration so IndexedDB write completes before we navigate away
      if (path.split('/').length === 2 && path.endsWith('.png')) {
        const textureKey = fileName.replace('.png', '')
        await registerFileInCache(textureKey, await entry.getFile())
        textureKeys[textureKey] = textureKey
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

    // 3. Parsers
    const parseParalivesSetting = (text: string) => {
      const lines = text.split('\n')
      const itemsList: any[] = []
      let currentItem: any = null

      lines.forEach((rawLine) => {
        const line = rawLine.trim()
        
        if (line.startsWith('@')) {
          if (currentItem && currentItem.guid) itemsList.push(currentItem)
          currentItem = { tags: [] }
        }

        if (line.startsWith('=')) {
          const cleanProp = line.substring(1)
          const separatorIndex = cleanProp.indexOf(':')
          
          if (separatorIndex !== -1) {
            const key = cleanProp.substring(0, separatorIndex).trim()
            const value = cleanProp.substring(separatorIndex + 1).trim()

            if (currentItem) {
              if (key === 'GUID') currentItem.guid = value
              if (key === 'CustomModGUID') currentItem.modGuid = value
              // Store as displayNameGuid — it's a translation key, not the name itself
              if (key === 'DisplayName') currentItem.displayNameGuid = value
              if (key === 'PriceOverride') currentItem.price = parseFloat(value) || 0
              if (key === 'Prefab') currentItem.targetPrefabGuid = value
              if (key === 'Value') currentItem.prefabFallbackName = value
            }
          }
        }
      })

      if (currentItem && currentItem.guid) itemsList.push(currentItem)
      return itemsList
    }

    const parsePrefabGraph = (text: string) => {
      const lines = text.split('\n')
      const components: ComponentNode[] = []
      let currentComponent: ComponentNode | null = null

      lines.forEach((rawLine) => {
        const line = rawLine.trim()
        if (!line || line === '---') return

        if (line.endsWith(':') && !line.startsWith('=') && !line.startsWith('@') && !line.includes('(')) {
          if (currentComponent) components.push(currentComponent)
          currentComponent = { id: crypto.randomUUID(), type: line.replace(':', ''), properties: {} }
          return
        }

        if (currentComponent && line.includes(':')) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          
          if (sepIndex !== -1) {
            const pKey = cleanProp.substring(0, sepIndex).trim()
            const pValue = cleanProp.substring(sepIndex + 1).trim()
            
            if (pValue.startsWith('(') && pValue.endsWith(')')) {
              currentComponent.properties[pKey] = pValue.replace(/[()]/g, '').split(',').map(num => parseFloat(num.trim()) || 0)
            } else {
              currentComponent.properties[pKey] = isNaN(Number(pValue)) ? pValue : parseFloat(pValue)
            }
          }
        }
      })

      if (currentComponent) components.push(currentComponent)
      return components
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
      if (!item) return
      const stableKey = `item_thumb_${item.guid}`
      await registerFileInCache(stableKey, file)
      itemThumbnailKeys[item.guid] = stableKey
    }))

    const parsedItems = itemsMeta.map((metaItem) => {
      const targetGuid = metaItem.targetPrefabGuid || ''
      const rawPrefabText = prefabContents[targetGuid] || ''
      const extractedComponents = rawPrefabText ? parsePrefabGraph(rawPrefabText) : []

      // Resolve display name via translation map using the stored GUID
      const translatedName = metaItem.displayNameGuid
        ? (translationMap[`g${metaItem.displayNameGuid}`] ?? translationMap[metaItem.displayNameGuid] ?? null)
        : null

      // Fall back to prefab file name, then generic label
      const trackingName = translatedName || prefabGuidToNameMap[targetGuid] || 'Imported Object'

      const matchedThumbnailKey = itemThumbnailKeys[metaItem.guid] ?? null

      const itemTextures: Record<string, string> = {}
      Object.keys(textureKeys).forEach(texName => {
        const type = texName.endsWith('BaseColor') ? 'baseColor' :
                     texName.endsWith('Normal') ? 'normal' :
                     texName.endsWith('Roughness') ? 'roughness' : 'secondary'
        itemTextures[type] = texName
      })

      return {
        id: crypto.randomUUID(),
        guid: metaItem.guid || crypto.randomUUID(),
        name: trackingName.replace(/([A-Z])/g, ' $1').trim(),
        description: 'Imported Mod Object',
        price: metaItem.price !== undefined ? metaItem.price : 5,
        tags: ['Imported'],
        thumbnailKey: matchedThumbnailKey,
        textureKeys: itemTextures,
        componentBlueprints: { rootDefaultStates: rootStates, materialSurfaces: meshSurfaces },
        components: extractedComponents
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
      id: newProjectId,  // use the hoisted ID so cover_${newProjectId} matches
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
        <input type="file" className="hidden" multiple onChange={(e) => e.target.files && processFiles(e.target.files)} {...directoryAttributes} />
      </label>
    </div>
  )
}
