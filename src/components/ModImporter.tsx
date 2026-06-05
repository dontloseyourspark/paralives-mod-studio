import React, { useState } from 'react'
import { Folder, UploadSimple } from 'phosphor-react'
import type { ModProject } from '../types'

interface ModImporterProps {
  onImportComplete: (project: ModProject) => void
}

export default function ModImporter({ onImportComplete }: ModImporterProps) {
  const [isDragging, setIsDragging] = useState(false)

  const processFiles = async (fileList: FileList | File[]) => {
    let itemsSettingContent = ''
    let translationsSettingContent = ''
    
    const componentSettings: Record<string, string> = {}
    const prefabContents: Record<string, string> = {}
    
    const prefabGuidToNameMap: Record<string, string> = {}
    const fileNameToTextMap: Record<string, string> = {}
    const discoveredThumbnails: Record<string, string> = {}
    
    // Data dictionaries to parse and link raw texture maps
    const discoveredTextures: Record<string, string> = {}
    let globalProjectCoverUrl: string | null = null

    // Pass 1: Gather file data buffers and index game meta-caches
    for (const file of Array.from(fileList)) {
      const path = file.webkitRelativePath
      const fileName = file.name

      // 1A: Intercept primary manifest sheets
      if (path.endsWith('Items.setting')) {
        itemsSettingContent = await file.text()
        continue
      }
      if (path.endsWith('Translations.setting')) {
        translationsSettingContent = await file.text()
        continue
      }
      if (path.includes('/Settings/') && path.endsWith('.setting')) {
        const settingName = fileName.replace('.setting', '')
        componentSettings[settingName] = await file.text()
        continue
      }
      
      // 1B: Cache structural prefab strings
      if (path.includes('/Prefabs/') && path.endsWith('.prefab')) {
        const pName = fileName.replace('.prefab', '')
        fileNameToTextMap[pName] = await file.text()
        continue
      }

      // 1C: Process catalog thumbnails
      if (path.includes('/_GeneratedThumbnails/Items/') && path.endsWith('.png')) {
        const imageHash = fileName.replace('.png', '')
        discoveredThumbnails[imageHash] = URL.createObjectURL(file)
        continue
      }

      // 1D: Process raw source textures (BaseColor, Normal, Roughness)
      if (path.split('/').length === 2 && path.endsWith('.png')) {
        const textureKey = fileName.replace('.png', '')
        discoveredTextures[textureKey] = URL.createObjectURL(file)
        continue
      }

      // 1E: Process high-res master cover image
      if (path.split('/').length === 2 && path.endsWith('.mod.thumbnail')) {
        globalProjectCoverUrl = URL.createObjectURL(file)
        continue
      }

      // 1F: Parse meta-cache layers to extract exact GUID lookup maps
      if (path.endsWith('Prefabs.Metacache')) {
        const cacheText = await file.text()
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

    if (!itemsSettingContent) {
      alert('Could not locate Items.setting inside the uploaded folder structure.')
      return
    }

    // Map out the actual content blocks using cache lookups
    Object.keys(prefabGuidToNameMap).forEach((guid) => {
      const name = prefabGuidToNameMap[guid]
      if (fileNameToTextMap[name]) {
        prefabContents[guid] = fileNameToTextMap[name]
      }
    })

    // Line splitter engine for custom tab-indented formats
    const parseParalivesSetting = (text: string) => {
      const lines = text.split('\n')
      const itemsList: any[] = []
      let currentItem: any = null

      lines.forEach((rawLine) => {
        const line = rawLine.trim()
        
        if (line.startsWith('@')) {
          if (currentItem && currentItem.guid) {
            itemsList.push(currentItem)
          }
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
              if (key === 'DisplayName') currentItem.name = value
              if (key === 'PriceOverride') currentItem.price = parseFloat(value) || 0
              if (key === 'Prefab') currentItem.targetPrefabGuid = value
              if (key === 'Value') currentItem.prefabFallbackName = value
            }
          }
        }
      })

      if (currentItem && currentItem.guid) {
        itemsList.push(currentItem)
      }

      return itemsList
    }

    // Specialized component graph graph parser
    const parsePrefabGraph = (text: string) => {
      const lines = text.split('\n')
      const components: any[] = []
      let currentComponent: any = null

      lines.forEach((rawLine) => {
        const line = rawLine.trim()
        if (!line || line === '---') return

        if (line.endsWith(':') && !line.startsWith('=') && !line.startsWith('@') && !line.includes('(')) {
          if (currentComponent) components.push(currentComponent)
          currentComponent = {
            id: crypto.randomUUID(),
            type: line.replace(':', ''),
            properties: {}
          }
          return
        }

        if (currentComponent && line.includes(':')) {
          const cleanProp = line.startsWith('=') ? line.substring(1) : line
          const sepIndex = cleanProp.indexOf(':')
          
          if (sepIndex !== -1) {
            const pKey = cleanProp.substring(0, sepIndex).trim()
            const pValue = cleanProp.substring(sepIndex + 1).trim()
            
            if (pValue.startsWith('(') && pValue.endsWith(')')) {
              currentComponent.properties[pKey] = pValue
                .replace(/[()]/g, '')
                .split(',')
                .map(num => parseFloat(num.trim()) || 0)
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
      const lines = text.split('\n')
      const guids: string[] = []
      lines.forEach(l => {
        const trimmed = l.trim()
        if (trimmed.startsWith('=GUID:')) {
          guids.push(trimmed.split(':')[1])
        }
      })
      return guids
    }

    // Pass 2: Process metadata arrays and component fields
    const itemsMeta = parseParalivesSetting(itemsSettingContent)
    const translationsMeta = parseParalivesSetting(translationsSettingContent)
    
    const rootStates = extractAnchors(componentSettings['ItemObjectRoot'] || '')
    const meshSurfaces = extractAnchors(componentSettings['ItemMeshReference'] || '')

    // Pass 3: Bind structural properties together safely via exact GUID lookups
    const parsedItems = itemsMeta.map((metaItem) => {
      const matchedTranslation = translationsMeta.find(
        (t) => t.prefabFallbackName === 'ClutterPlasticBucket' || t.guid === metaItem.guid
      )

      const targetGuid = metaItem.targetPrefabGuid || ''
      const rawPrefabText = prefabContents[targetGuid] || ''
      const extractedComponents = rawPrefabText ? parsePrefabGraph(rawPrefabText) : []
      const trackingName = metaItem.name || prefabGuidToNameMap[targetGuid] || 'Imported Object'
      const matchedThumbnailUrl = discoveredThumbnails[metaItem.guid] || discoveredThumbnails[targetGuid] || null

      // Filter your text channels to associate matching texture layers to this specific mod item
      const itemTextures: Record<string, string> = {}
      Object.keys(discoveredTextures).forEach(texName => {
        if (texName.toLowerCase().includes('bucket') || texName.toLowerCase().includes('plastic')) {
          const type = texName.endsWith('BaseColor') ? 'baseColor' :
                       texName.endsWith('Normal') ? 'normal' :
                       texName.endsWith('Roughness') ? 'roughness' : 'secondary'
          itemTextures[type] = discoveredTextures[texName]
        }
      })

      return {
        id: crypto.randomUUID(),
        guid: metaItem.guid || crypto.randomUUID(),
        name: trackingName.replace(/([A-Z])/g, ' $1').trim(),
        description: matchedTranslation ? 'Just a plastic bucket' : 'Custom decorative mod asset.',
        price: metaItem.price !== undefined ? metaItem.price : 5,
        tags: ['Decorative', 'Clutter'],
        thumbnail: matchedThumbnailUrl, 
        textures: itemTextures, // <--- Attaches material layers directly to the entity node records!
        componentBlueprints: {
          rootDefaultStates: rootStates,
          materialSurfaces: meshSurfaces,
        },
        components: extractedComponents
      }
    })

    // Pass 4: Finalize the integrated project manifest block
    const synthesizedProject: ModProject = {
      id: crypto.randomUUID(),
      name: parsedItems[0]?.name || 'Buckety McBucketFace Mod',
      description: 'Imported Paralives engine object manifest configuration.',
      version: '1.0.0',
      author: 'Studio Creator',
      coverThumbnail: globalProjectCoverUrl, 
      items: parsedItems,
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onImportComplete(synthesizedProject)
  }

  const directoryAttributes = {
    webkitdirectory: "",
    directory: ""
  } as React.InputHTMLAttributes<HTMLInputElement>

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault()
        setIsDragging(true)
      }}
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
        <p className="text-sm font-semibold text-white">
          Drag and drop your extracted `.mod` folder here
        </p>
        <p className="text-xs text-gray-500 max-w-xs">
          Your browser will automatically process your inner item settings, prefabs, and asset maps.
        </p>
      </div>

      <label className="flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-white/5 hover:bg-white/10 rounded-xl cursor-pointer transition-colors mt-2 focus-within:outline-none">
        <UploadSimple size={14} weight="bold" />
        <span>Select Folder</span>
        <input
          type="file"
          className="hidden"
          multiple
          onChange={(e) => e.target.files && processFiles(e.target.files)}
          {...directoryAttributes}
        />
      </label>
    </div>
  )
}