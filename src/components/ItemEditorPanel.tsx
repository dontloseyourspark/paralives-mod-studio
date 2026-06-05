import React, { useEffect, useState } from 'react'
import { PencilSimple, CurrencyDollar, TextAlignLeft, Image, Cube, Palette } from 'phosphor-react'
import type { Item } from '../types'

interface ItemEditorPanelProps {
  item: Item | null
  onSave: (updatedItem: Item) => void
}

export default function ItemEditorPanel({ item, onSave }: ItemEditorPanelProps) {
  // Local state proxies to capture changes before committing back to the store
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  // Advanced accordion open states
  const [isNodesOpen, setIsNodesOpen] = useState(false)
  const [isTexturesOpen, setIsTexturesOpen] = useState(false)

  // Push fresh data values into the fields whenever the active item selection shifts
  useEffect(() => {
    if (item) {
      setName(item.name || '')
      setPrice(item.price ?? 0)
      setDescription(item.description || '')
      setThumbnail(item.thumbnail || null)
    }
  }, [item])

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm select-none gap-2">
        <Cube size={32} weight="thin" className="text-gray-600 animate-pulse" />
        <span>Select an item from the catalog list to edit details</span>
      </div>
    )
  }

  // Trigger data synchronization callback upstream
  const handleFieldBlur = () => {
    onSave({
      ...item,
      name: name.trim(),
      price: Number(price) || 0,
      description: description.trim(),
      thumbnail: thumbnail
    })
  }

  // Handle local image file swaps via browser object blobs
  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const freshBlobUrl = URL.createObjectURL(e.target.files[0])
      setThumbnail(freshBlobUrl)
      
      // Save instantly upon media swap
      onSave({
        ...item,
        thumbnail: freshBlobUrl
      })
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white select-none box-border">
      
      {/* Scrollable Work Area Container */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-6 min-h-0">
        
        {/* SECTION 1: Primary Metadata Matrix Panel */}
        <div className="flex flex-col md:flex-row gap-6 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm">
          
          {/* Interactive Thumbnail Component */}
          <div className="flex flex-col gap-2 shrink-0 items-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 self-start">
              Item Catalog Image
            </label>
            <div className="relative w-32 h-32 bg-[#0e1017] border border-white/5 rounded-xl overflow-hidden group flex items-center justify-center shadow-inner">
              {thumbnail ? (
                <img src={thumbnail} alt={name} className="w-full h-full object-contain p-2" />
              ) : (
                <Image size={32} weight="thin" className="text-gray-600" />
              )}
              
              {/* Overlay Interactive Mask Trigger */}
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center p-2">
                <PencilSimple size={16} className="text-[#8b5cf6]" />
                <span className="text-[10px] font-semibold text-gray-200">Replace Photo</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleThumbnailChange} />
              </label>
            </div>
          </div>

          {/* Text Input Block Layout Fields */}
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

        {/* SECTION 2: Extended Catalog Localization Description */}
        <div className="flex flex-col gap-2 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <TextAlignLeft size={10} /> Catalog Description (Translations.setting)
          </label>
          <textarea 
            className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150 min-h-[100px] resize-vertical leading-relaxed"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onBlur={handleFieldBlur}
            placeholder="Type your translation description string here..."
          />
        </div>

        {/* SECTION 3: Advanced Collapsible Accordion Blocks */}
        <div className="flex flex-col gap-3 mt-2">
          
          {/* Accordion Block A: Active Component Tree Blueprint Nodes */}
          <div className="bg-[#161923]/40 border border-white/5 rounded-xl overflow-hidden transition-all duration-150">
            <button 
              className="w-full px-4 py-3 flex items-center justify-between cursor-pointer text-gray-400 hover:text-white hover:bg-white/2 transition-colors text-xs font-semibold"
              onClick={() => setIsNodesOpen(!isNodesOpen)}
            >
              <div className="flex items-center gap-2">
                <Cube size={14} className="text-[#8b5cf6]" />
                <span>Component Blueprint Nodes ({item.components?.length || 0})</span>
              </div>
              <span className={`transform transition-transform duration-200 text-[10px] ${isNodesOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            {isNodesOpen && (
              <div className="border-t border-white/5 bg-[#0e1017]/50 p-4 flex flex-col gap-2">
                {item.components && item.components.length > 0 ? (
                  item.components.map((comp: any) => (
                    <div key={comp.id} className="flex items-center justify-between p-2.5 bg-white/2 border border-white/5 rounded-lg text-xs">
                      <span className="font-mono text-gray-300 font-semibold">{comp.type}</span>
                      <span className="text-[10px] bg-white/5 px-2 py-0.5 rounded text-gray-500 font-mono">
                        {Object.keys(comp.properties || {}).length} properties
                      </span>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-600 italic px-1">No custom entity nodes attached</span>
                )}
              </div>
            )}
          </div>

          {/* Accordion Block B: PBR Material Surface Maps */}
          <div className="bg-[#161923]/40 border border-white/5 rounded-xl overflow-hidden transition-all duration-150">
            <button 
              className="w-full px-4 py-3 flex items-center justify-between cursor-pointer text-gray-400 hover:text-white hover:bg-white/2 transition-colors text-xs font-semibold"
              onClick={() => setIsTexturesOpen(!isTexturesOpen)}
            >
              <div className="flex items-center gap-2">
                <Palette size={14} className="text-[#8b5cf6]" />
                <span>PBR Surface Textures ({Object.keys(item.textures || {}).length} maps)</span>
              </div>
              <span className={`transform transition-transform duration-200 text-[10px] ${isTexturesOpen ? 'rotate-180' : ''}`}>▼</span>
            </button>
            
            {isTexturesOpen && (
              <div className="border-t border-white/5 bg-[#0e1017]/50 p-4 grid grid-cols-2 gap-3">
                {item.textures && Object.keys(item.textures).length > 0 ? (
                  Object.entries(item.textures).map(([type, url]: [string, any]) => (
                    <div key={type} className="flex items-center gap-3 p-2 bg-white/2 border border-white/5 rounded-xl">
                      <div className="w-10 h-10 bg-black/30 border border-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-0.5">
                        <img src={url} alt={type} className="w-full h-full object-cover rounded-md" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400">{type}</span>
                        <span className="text-[10px] text-gray-600 truncate font-mono">Linked map</span>
                      </div>
                    </div>
                  ))
                ) : (
                  <span className="text-xs text-gray-600 italic px-1 col-span-2">No underlying textures discovered</span>
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  )
}