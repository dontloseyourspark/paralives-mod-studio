import React, { useEffect, useState } from 'react'
import { PencilSimple, CurrencyDollar, TextAlignLeft, Image, Cube, Palette, TreeStructure } from 'phosphor-react'
import type { Item } from '../types'

interface ItemEditorPanelProps {
  item: Item | null
  onSave: (updatedItem: Item) => void
}

type TabType = 'nodes' | 'textures'

export default function ItemEditorPanel({ item, onSave }: ItemEditorPanelProps) {
  // Local state proxies for basic fields
  const [name, setName] = useState('')
  const [price, setPrice] = useState<number>(0)
  const [description, setDescription] = useState('')
  const [thumbnail, setThumbnail] = useState<string | null>(null)

  // Active sub-panel tab toggle state
  const [activeTab, setActiveTab] = useState<TabType>('nodes')

  // Sync state whenever the selected item changes
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

  const handleFieldBlur = () => {
    onSave({
      ...item,
      name: name.trim(),
      price: Number(price) || 0,
      description: description.trim(),
      thumbnail: thumbnail
    })
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const freshBlobUrl = URL.createObjectURL(e.target.files[0])
      setThumbnail(freshBlobUrl)
      onSave({ ...item, thumbnail: freshBlobUrl })
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white select-none box-border">
      
      {/* Scrollable Work Area */}
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-h-0">
        
        {/* SECTION 1: Primary Metadata Matrix Panel */}
        <div className="flex flex-col md:flex-row gap-6 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm shrink-0">
          
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
              
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center p-2">
                <PencilSimple size={16} className="text-[#8b5cf6]" />
                <span className="text-[10px] font-semibold text-gray-200">Replace Photo</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleThumbnailChange} />
              </label>
            </div>
          </div>

          {/* Core Text Input Fields */}
          <div className="flex-1 flex flex-col gap-4 justify-center">
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

        {/* SECTION 2: Catalog Description Layout Textarea */}
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

        {/* SECTION 3: Advanced Segmented Configuration Tabs */}
        <div className="flex flex-col flex-1 min-h-0 mt-1">
          
          {/* Segmented Tab Headers Selector */}
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
              <span>Surface Textures ({Object.keys(item.textures || {}).length})</span>
              {activeTab === 'textures' && (
                <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#8b5cf6] rounded-full" />
              )}
            </button>
          </div>

          {/* Active Tab View Window Container */}
          <div className="flex-1 overflow-y-auto min-h-0 bg-[#161923]/20 border border-white/5 rounded-xl p-4">
            
            {/* VIEW A: Blueprint Components */}
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

            {/* VIEW B: PBR Material Maps */}
            {activeTab === 'textures' && (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {item.textures && Object.keys(item.textures).length > 0 ? (
                  Object.entries(item.textures).map(([type, url]: [string, any]) => (
                    <div key={type} className="flex items-center gap-3 p-2.5 bg-[#161923]/60 border border-white/5 rounded-xl group hover:border-white/10 transition-colors">
                      <div className="w-12 h-12 bg-black/30 border border-white/5 rounded-lg overflow-hidden shrink-0 flex items-center justify-center p-0.5 shadow-inner">
                        <img src={url} alt={type} className="w-full h-full object-cover rounded-md" />
                      </div>
                      <div className="flex flex-col min-w-0">
                        <span className="text-[11px] font-bold uppercase tracking-wider text-gray-400 truncate">{type}</span>
                        <span className="text-[10px] text-gray-500 font-mono truncate">Linked material profile</span>
                      </div>
                    </div>
                  ))
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