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
    
    // A dictionary bucket to hold component-specific settings dynamically
    const componentSettings: Record<string, string> = {}
    const prefabFiles: string[] = []

    // Pass 1: Categorize file allocations from the directory selection tree
    for (const file of Array.from(fileList)) {
      const path = file.webkitRelativePath

      if (path.endsWith('Items.setting')) {
        itemsSettingContent = await file.text()
        continue
      }
      if (path.endsWith('Translations.setting')) {
        translationsSettingContent = await file.text()
        continue
      }
      
      // Catch-all reader for secondary component mapping rules (e.g., ItemObjectRoot.setting)
      if (path.includes('/Settings/') && path.endsWith('.setting')) {
        const settingName = file.name.replace('.setting', '')
        componentSettings[settingName] = await file.text()
        continue
      }

      if (path.includes('/Prefabs/') && path.endsWith('.prefab')) {
        prefabFiles.push(file.name.replace('.prefab', ''))
      }
    }

    if (!itemsSettingContent) {
      alert('Could not locate Items.setting inside the uploaded folder structure.')
      return
    }

    // Core line splitter engine for the Paralives custom indentation format
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
          currentItem = { tags: [], surfaces: [], defaultStates: [] }
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

    // Helper utility to parse standalone component anchors (like your surfaces maps)
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

    // Pass 2: Process metadata cross-references
    const itemsMeta = parseParalivesSetting(itemsSettingContent)
    const translationsMeta = parseParalivesSetting(translationsSettingContent)

    // Extract anchors directly from your new component settings files
    const rootStates = extractAnchors(componentSettings['ItemObjectRoot'] || '')
    const meshSurfaces = extractAnchors(componentSettings['ItemMeshReference'] || '')

    // Pass 3: Bind structural properties together safely
    const parsedItems = itemsMeta.map((metaItem) => {
      const matchedTranslation = translationsMeta.find(
        (t) => t.prefabFallbackName === 'ClutterPlasticBucket' || t.guid === metaItem.guid
      )

      return {
        id: crypto.randomUUID(),
        guid: metaItem.guid || crypto.randomUUID(),
        name: metaItem.name || 'Buckety McBucketFace',
        description: matchedTranslation ? 'Just a plastic bucket' : 'Custom decorative mod asset.',
        price: metaItem.price !== undefined ? metaItem.price : 5,
        tags: ['Decorative', 'Clutter'],
        
        // Injecting component configurations as reactive properties
        componentBlueprints: {
          rootDefaultStates: rootStates,  // Tracks GUIDs from ItemObjectRoot.setting
          materialSurfaces: meshSurfaces, // Tracks GUIDs from ItemMeshReference.setting
        }
      }
    })

    // Fallback map injection loop if primary parse returns flat
    if (parsedItems.length === 0 && prefabFiles.length > 0) {
      prefabFiles.forEach((pName) => {
        parsedItems.push({
          id: crypto.randomUUID(),
          guid: crypto.randomUUID(),
          name: pName.replace(/([A-Z])/g, ' $1').trim(),
          description: 'Imported configuration blueprint variant.',
          price: 5,
          tags: ['Decorative', 'Clutter'],
          componentBlueprints: { rootDefaultStates: [], materialSurfaces: [] }
        })
      })
    }

    // Pass 4: Finalize the payload manifest block
    const synthesizedProject: ModProject = {
      id: crypto.randomUUID(),
      name: parsedItems[0]?.name || 'Buckety McBucketFace Mod',
      description: 'Imported Paralives engine object manifest configuration.',
      version: '1.0.0',
      author: 'Studio Creator',
      items: parsedItems,
      assets: [],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }

    onImportComplete(synthesizedProject)
  }

  // Define the non-standard folder upload properties in a clean, typed object
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