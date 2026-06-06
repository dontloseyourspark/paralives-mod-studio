import React, { useState } from 'react'
import { PencilSimple, CurrencyDollar, TextAlignLeft, Image, Cube, Palette, TreeStructure } from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'

interface ItemEditorPanelProps {
  item: Item | null
  onSave: (updatedItem: Item) => void
}

type TabType = 'nodes' | 'textures'

export default function ItemEditorPanel({ item, onSave }: ItemEditorPanelProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)

  // 1. Handle the empty fallback state up front 
  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm select-none gap-2">
        <Cube size={32} weight="thin" className="text-gray-600 animate-pulse" />
        <span>Select an item from the catalog list to edit details</span>
      </div>
    )
  }

  // 2. Safe resolution of the cache image URL
  const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)

  // 3. Initialize local state directly from the prop values. 
  // Because the parent component shifts the `key` when selection changes,
  // these initializers run fresh every time a new item row is clicked!
  const [name, setName] = useState(item.name || '')
  const [price, setPrice] = useState<number>(item.price ?? 0)
  const [description, setDescription] = useState(item.description || '')
  const [activeTab, setActiveTab] = useState<TabType>('nodes')

  // Trigger silent synchronization callback upstream via onBlur hooks
  const handleFieldBlur = () => {
    onSave({
      ...item,
      name: name.trim(),
      price: Number(price) || 0,
      description: description.trim()
    })
  }

  // Handle local binary file asset uploads via image replacement mask triggers
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0]
      const registerFileInCache = useModStore.getState().registerFileInCache
      
      // Use the item's GUID as the persistent cache lookup index key
      const cacheKey = item.guid
      registerFileInCache(cacheKey, file)

      // Save instantly to trigger upstream parent re-renders
      onSave({
        ...item,
        thumbnailKey: cacheKey
      })
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white select-none box-border">
      
      {/* Scrollable Work Area Container */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-h-0">
        
        {/* SECTION 1: Primary Metadata Matrix Panel */}
        <div className="flex flex-col md:flex-row gap-6 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm shrink-0">
          
          {/* Interactive Thumbnail Photo Component */}
          <div className="flex flex-col gap-2 shrink-0 items-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 self-start">
              Item Catalog Image
            </label>
            <div className="relative w-32 h-32 bg-[#0e1017] border border-white/5 rounded-xl overflow-hidden group flex items-center justify-center shadow-inner">
              {liveThumbnailUrl ? (
                <img src={liveThumbnailUrl} alt={name} className="w-full h-full object-contain p-2" />
              ) : (
                <Image size={32} weight="thin" className="text-gray-600" />
              )}
              
              {/* Hover Interactive Mask Control Overlays */}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center p-2">
                <PencilSimple size={16} className="text-[#8b5cf6]" />
                <span className="text-[10px] font-semibold text-gray-200">Replace Photo</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleThumbnailChange} />
              </label>
            </div>
          </div>

          {/* Text Form Ingestion Fields */}
          <div className="flex-1 flex flex-col gap-4 justify-center">
            {/* Field: Display Name */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <PencilSimple size={10} /> Display Name
              </label>
              <input 
                type="text" 
                className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150"
                value={name}
                onChange={(e) => setName(e.target.value)}
                onBlur={handleFieldBlur}
                placeholder="Enter workspace display title..."
              />
            </div>

            {/* Field: Catalog Price */}
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <CurrencyDollar size={10} /> Catalog Price ($)
              </label>
              <input 
                type="number" 
                className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={price === 0 ? '' : price}
                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                onBlur={handleFieldBlur}
                placeholder="0"
                min="0"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Extended Catalog Localization Textarea */}
        <div className="flex flex-col gap-2 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <TextAlignLeft size={10} /> Catalog Description
          </label>
          <textarea 
            className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150 min-h-[80px] resize-vertical leading-relaxed"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="Type your translation description string here..."
          />
        </div>

        {/* SECTION 3: Advanced Segmented Configuration Tabs Panel */}
        <div className="flex flex-col flex-1 min-h-0 mt-1">
          
          {/* Segmented Headers Tab Selection Strip */}
          <div className="flex border-b border-white/5 mb-4 gap-2">
            <button
              onClick={() => setActiveTab('nodes')}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-semibold tracking-tight transition-all relative cursor-pointer outline-none ${
                activeTab === 'nodes' ? 'text-[#8b5cf6]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <TreeStructure size={14} />
              <span>Blueprint Nodes ({item.components?.length || 0})</span>
              {activeTab === 'nodes' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8b5cf6] rounded-full" />
              )}
            </button>

            <button
              onClick={() => setActiveTab('textures')}
              className={`flex items-center gap-2 pb-2.5 px-1 text-xs font-semibold tracking-tight transition-all relative cursor-pointer outline-none ${
                activeTab === 'textures' ? 'text-[#8b5cf6]' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              <Palette size={14} />
              <span>Surface Textures ({Object.keys(item.textureKeys || {}).length})</span>
              {activeTab === 'textures' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8b5cf6] rounded-full" />
              )}
            </button>
          </div>

          {/* Active Sub-Viewport Area */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-[#161923]/20 border border-white/5 rounded-xl p-4">
            
            {/* TAB VIEW A: Component Blueprint Tree Nodes */}
            {activeTab === 'nodes' && (
              <div className="flex flex-col gap-2">
                {item.components && item.components.length > 0 ? (
                  item.components.map((comp: any) => (
                    <div key={comp.id} className="flex items-center justify-between p-3 bg-[#161923]/60 border border-white/5 rounded-xl text-xs group hover:border-white/10 transition-colors">
                      <div className="flex flex-col gap-0.5">
                        <span className="font-mono text-gray-200 font-semibold">{comp.type}</span>
                        <span className="text-[10px] text-gray-500 font-medium">Component Entity Node</span>
                      </div>
                      <span className="text-[10px] bg-white/5 px-2.5 py-1 rounded-md text-gray-400 font-mono">
                        {Object.keys(comp.properties || {}).length} variables
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-600 italic p-1">No custom configuration components attached</span>
                )}
              </div>
            )}

            {/* TAB VIEW B: PBR Material Texture Layer Maps */}
            {activeTab === 'textures' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.textureKeys && Object.keys(item.textureKeys).length > 0 ? (
                  Object.entries(item.textureKeys).map(([type, cacheKey]) => {
                    const textureUrl = getBlobUrlFromCache(cacheKey)
                    return (
                      <div key={type} className="flex items-center gap-3 p-2.5 bg-[#161923]/60 border border-white/5 rounded-xl group hover:border-white/10 transition-colors">
                        <div className="w-12 h-12 bg-black/30 border border-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-inner">
                          {textureUrl ? (
                            <img src={textureUrl} alt={type} className="w-full h-full object-cover rounded-md" />
                          ) : (
                            <Palette size={16} className="text-gray-600" />
                          )}
                        </div>
                        <div className="flex flex-col min-w-0">
                          <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 truncate">{type}</span>
                          <span className="text-[10px] text-gray-500 font-mono truncate">Linked material profile</span>
                        </div>
                      </div>
                    )
                  })
                ) : (
                  <span className="text-xs text-gray-600 italic p-1 col-span-2">No custom texture files located</span>
                )}
              </div>
            )}

          </div>

        </div>
      </div>
    </div>
  )
}