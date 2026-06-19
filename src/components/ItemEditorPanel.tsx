// src/components/ItemEditorPanel.tsx
import React, { useState, useRef } from 'react'
import {
  PencilSimple, CurrencyDollar, TextAlignLeft, Image, Cube,
  Palette, UploadSimple, X, CheckCircle, Warning, TreeStructure, Copy
} from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import { ITEM_MESH_TEXTURE_SLOTS, SLOT_LABELS, CONFIRMED_SLOTS, itemTextureCacheKey } from '../lib/itemTextureSlots'
import type { ItemMeshTextureSlot } from '../lib/itemTextureSlots'
import type { Item, ComponentNode, PrefabPropertyValue } from '../types/types'

interface ItemEditorPanelProps {
  item: Item | null
  activeNode: ComponentNode | null
  onSave: (updatedItem: Item) => void
}

type NodeTab = 'textures' | 'prefab'

// ─── Helpers ──────────────────────────────────────────────────────────────────

// A GUID in Paralives is a 15-19 digit numeric string.
// JS parseFloat loses precision on these, so we detect them by digit count
// on the *original stored value* (which may already be a number with precision loss).
function isGuidLike(val: unknown): boolean {
  if (typeof val === 'number') {
    // 1e15 ≈ 15 digits — anything this large is almost certainly a GUID
    return Math.abs(val) >= 1e15
  }
  if (typeof val === 'string') {
    return /^\d{15,19}$/.test(val.trim())
  }
  return false
}

function isBoolString(val: unknown): val is 'True' | 'False' {
  return val === 'True' || val === 'False'
}

function isVector(val: unknown): val is number[] {
  return Array.isArray(val) && val.every(v => typeof v === 'number')
}

// ─── Slot card ────────────────────────────────────────────────────────────────

interface SlotCardProps {
  slot: ItemMeshTextureSlot
  boundGuid: string | null
  cacheKey: string
  onUpload: (slot: ItemMeshTextureSlot, file: File) => void
  onClear: (slot: ItemMeshTextureSlot) => void
}

function SlotCard({ slot, boundGuid, cacheKey, onUpload, onClear }: SlotCardProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const stringUrlCache = useModStore((s) => s.stringUrlCache)
  const previewUrl = cacheKey
    ? (stringUrlCache[cacheKey] ?? localStorage.getItem(`asset_fallback_${cacheKey}`) ?? null)
    : null
  const isConfirmed = CONFIRMED_SLOTS.has(slot)
  const isBound = !!boundGuid

  return (
    <div className={`relative flex flex-col rounded-xl border transition-colors overflow-hidden ${
      isBound ? 'border-[#8b5cf6]/30 bg-[#8b5cf6]/5' : 'border-white/5 bg-[#161923]/60'
    }`}>
      <div className="flex items-center justify-between px-3 pt-3 pb-2">
        <div className="flex items-center gap-1.5">
          <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400">{SLOT_LABELS[slot]}</span>
          {!isConfirmed && (
            <span title="Not yet seen in validated mods — may have no in-game effect">
              <Warning size={10} className="text-yellow-500/70" />
            </span>
          )}
        </div>
        {isBound && (
          <button onClick={() => onClear(slot)} className="text-gray-600 hover:text-red-400 transition-colors" title="Remove binding">
            <X size={12} />
          </button>
        )}
      </div>

      <label className="mx-3 mb-3 flex flex-col items-center justify-center gap-2 rounded-lg cursor-pointer" style={{ minHeight: '80px' }}>
        {previewUrl ? (
          <div className="relative w-full" style={{ height: '80px' }}>
            <img src={previewUrl} alt={slot} className="w-full h-full object-cover rounded-lg" style={{ imageRendering: 'pixelated' }} />
            <div className="absolute inset-0 bg-black/50 opacity-0 hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
              <UploadSimple size={16} className="text-white" />
            </div>
          </div>
        ) : (
          <div className="w-full flex flex-col items-center justify-center gap-1.5 border border-dashed border-white/10 rounded-lg hover:border-[#8b5cf6]/40 hover:bg-[#8b5cf6]/3 transition-all" style={{ height: '80px' }}>
            <UploadSimple size={14} className="text-gray-600" />
            <span className="text-[10px] text-gray-600">Upload PNG</span>
          </div>
        )}
        <input ref={inputRef} type="file" accept="image/png" className="hidden"
          onChange={(e) => { if (e.target.files?.[0]) { onUpload(slot, e.target.files[0]); e.target.value = '' } }} />
      </label>

      {isBound && (
        <div className="flex items-center gap-1 px-3 pb-2.5">
          <CheckCircle size={9} weight="fill" className="text-[#8b5cf6] shrink-0" />
          <span className="text-[9px] font-mono text-gray-500 truncate">{boundGuid}</span>
        </div>
      )}
    </div>
  )
}

// ─── Texture panel ────────────────────────────────────────────────────────────

interface NodeTexturePanelProps {
  item: Item
  node: ComponentNode
  onSave: (updatedItem: Item) => void
}

function NodeTexturePanel({ item, node, onSave }: NodeTexturePanelProps) {
  const handleUpload = async (slot: ItemMeshTextureSlot, file: File) => {
    const { assetDb } = await import('../utils/assetDb')
    const cacheKey = itemTextureCacheKey(item.guid, slot)
    const assetGuid = node.properties[slot]
      ? String(node.properties[slot])
      : String(Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000)
    const registerFileInCache = useModStore.getState().registerFileInCache
    await registerFileInCache(cacheKey, file)
    await assetDb.saveFileRaw(cacheKey, file)
    const updatedComponents = item.components.map((c) =>
      c.id === node.id && c.type === node.type
        ? { ...c, properties: { ...c.properties, [slot]: assetGuid } }
        : c
    )
    onSave({ ...item, components: updatedComponents })
  }

  const handleClear = (slot: ItemMeshTextureSlot) => {
    const updatedComponents = item.components.map((c) => {
      if (c.id === node.id && c.type === node.type) {
        const rest = { ...c.properties }
        delete rest[slot]
        return { ...c, properties: rest }
      }
      return c
    })
    onSave({ ...item, components: updatedComponents })
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-2">
        {ITEM_MESH_TEXTURE_SLOTS.map((slot) => {
          const rawVal = node.properties[slot]
          const boundGuid = rawVal != null ? String(rawVal) : null
          return (
            <SlotCard
              key={slot}
              slot={slot}
              boundGuid={boundGuid}
              cacheKey={itemTextureCacheKey(item.guid, slot)}
              onUpload={handleUpload}
              onClear={handleClear}
            />
          )
        })}
      </div>
      <div className="flex items-start gap-2 px-3 py-2.5 bg-yellow-500/5 border border-yellow-500/10 rounded-xl">
        <Warning size={12} className="text-yellow-500/60 shrink-0 mt-0.5" />
        <p className="text-[10px] text-gray-600 leading-relaxed">
          <span className="text-yellow-500/70 font-semibold">DecalMap</span> and{' '}
          <span className="text-yellow-500/70 font-semibold">DirtyOverlay</span> are
          exposed by the in-game editor but not yet validated in real mod exports.
        </p>
      </div>
    </div>
  )
}

// ─── Blueprint panel ──────────────────────────────────────────────────────────

interface BlueprintPanelProps {
  item: Item
  nodes: ComponentNode[]   // all components sharing this node's id (ItemObjectRoot, ItemCubeTransform, ItemMeshReference, etc.)
  onSave: (updatedItem: Item) => void
}

// A single editable property row
interface PropRowProps {
  propKey: string
  value: PrefabPropertyValue
  onChange: (key: string, newVal: PrefabPropertyValue) => void
}

function PropRow({ propKey, value, onChange }: PropRowProps) {
  const inputClass = "bg-white/3 border border-white/8 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#8b5cf6]/40 transition-all font-mono"

  // Null, undefined, or unexpected object — read-only dash (should be caught upstream,
  // but guard here so a missed case never crashes the panel)
  if (value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value))) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{propKey}</span>
        <span className="text-[10px] text-gray-600 font-mono">—</span>
      </div>
    )
  }
  if (isGuidLike(value)) {
    const strVal = String(value)
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 shrink-0 font-medium">{propKey}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-gray-500 truncate">{strVal}</span>
          <button
            onClick={() => navigator.clipboard.writeText(strVal)}
            className="text-gray-600 hover:text-gray-300 transition-colors shrink-0"
            title="Copy GUID"
          >
            <Copy size={10} />
          </button>
          <span className="text-[9px] text-gray-700 bg-white/3 px-1.5 py-0.5 rounded shrink-0">GUID</span>
        </div>
      </div>
    )
  }

  // Boolean string → toggle
  if (isBoolString(value)) {
    const isTrue = value === 'True'
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{propKey}</span>
        <button
          onClick={() => onChange(propKey, isTrue ? 'False' : 'True')}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
            isTrue ? 'bg-[#8b5cf6]' : 'bg-white/10'
          }`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
            isTrue ? 'left-[18px]' : 'left-0.5'
          }`} />
        </button>
      </div>
    )
  }

  // Vector (number[]) → X/Y/Z number inputs
  if (isVector(value)) {
    const labels = ['X', 'Y', 'Z', 'W']
    return (
      <div className="flex flex-col gap-1 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{propKey}</span>
        <div className="flex gap-1.5">
          {value.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-600 text-center">{labels[i] ?? i}</span>
              <input
                type="number"
                className={`${inputClass} w-full text-center [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
                value={v}
                onChange={(e) => {
                  const updated = [...value]
                  updated[i] = parseFloat(e.target.value) || 0
                  onChange(propKey, updated)
                }}
              />
            </div>
          ))}
        </div>
      </div>
    )
  }

  // Number → number input
  if (typeof value === 'number') {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium shrink-0">{propKey}</span>
        <input
          type="number"
          className={`${inputClass} w-28 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          value={value}
          onChange={(e) => onChange(propKey, parseFloat(e.target.value) || 0)}
        />
      </div>
    )
  }

  // Special Unity type strings (bool3, etc.) → read-only
  if (typeof value === 'string' && value.startsWith('bool3(')) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{propKey}</span>
        <span className="text-[10px] font-mono text-gray-500">{value}</span>
      </div>
    )
  }

  // Generic string → text input
  if (typeof value === 'string') {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium shrink-0">{propKey}</span>
        <input
          type="text"
          className={`${inputClass} flex-1 min-w-0 text-right`}
          value={value}
          onChange={(e) => onChange(propKey, e.target.value)}
        />
      </div>
    )
  }

  // Null / undefined / unknown → read-only dash
  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
      <span className="text-[11px] text-gray-400 font-medium">{propKey}</span>
      <span className="text-[10px] text-gray-600 font-mono">—</span>
    </div>
  )
}

// ─── Single component section (collapsible) ───────────────────────────────────

interface ComponentSectionProps {
  item: Item
  node: ComponentNode
  defaultOpen?: boolean
  onSave: (updatedItem: Item) => void
}

function ComponentSection({ item, node, defaultOpen = true, onSave }: ComponentSectionProps) {
  const [open, setOpen] = useState(defaultOpen)

  const handleChange = (key: string, newVal: PrefabPropertyValue) => {
    const updatedComponents = item.components.map((c) =>
      c.id === node.id && c.type === node.type
        ? { ...c, properties: { ...c.properties, [key]: newVal } }
        : c
    )
    onSave({ ...item, components: updatedComponents })
  }

  const handleSubChange = (parentKey: string, subKey: string, newVal: PrefabPropertyValue) => {
    const updatedComponents = item.components.map((c) => {
      if (c.id === node.id && c.type === node.type) {
        const parent = c.properties[parentKey]
        const updatedParent = typeof parent === 'object' && parent !== null && !Array.isArray(parent)
          ? { ...parent, [subKey]: newVal }
          : { _value: parent, [subKey]: newVal }
        return { ...c, properties: { ...c.properties, [parentKey]: updatedParent } }
      }
      return c
    })
    onSave({ ...item, components: updatedComponents })
  }

  const propEntries = Object.entries(node.properties)
  const hasGuid = propEntries.some(([, v]) => isGuidLike(v))

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden mb-2">
      {/* Section header */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2.5 bg-white/2 hover:bg-white/4 transition-colors text-left"
      >
        <span className="text-[11px] font-bold text-gray-300 font-mono">{node.type}</span>
        <div className="flex items-center gap-2">
          <span className="text-[10px] text-gray-600">{propEntries.length} props</span>
          <span className={`text-gray-600 transition-transform duration-150 text-[9px] ${open ? 'rotate-0' : '-rotate-90'}`}>▾</span>
        </div>
      </button>

      {/* Properties */}
      {open && (
        <div className="px-3 pb-2 pt-1">
          {propEntries.length === 0 ? (
            <span className="text-[11px] text-gray-600 italic py-2 block">No properties</span>
          ) : (
            propEntries.map(([key, val]) => {
              // Nested sub-property object: { _value?: ..., SubKey: ... }
              if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const { _value, ...subProps } = val as Record<string, PrefabPropertyValue | undefined>
                return (
                  <div key={key} className="mb-1">
                    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
                      <span className="text-[11px] text-gray-300 font-semibold">{key}</span>
                      {_value !== undefined && _value !== null ? (
                        isBoolString(_value) ? (
                          <button
                            onClick={() => handleChange(key, {
                              ...(val as Record<string, PrefabPropertyValue | undefined>),
                              _value: _value === 'True' ? 'False' : 'True'
                            })}
                            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${
                              _value === 'True' ? 'bg-[#8b5cf6]' : 'bg-white/10'
                            }`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${
                              _value === 'True' ? 'left-[18px]' : 'left-0.5'
                            }`} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-gray-500">{String(_value)}</span>
                        )
                      ) : null}
                    </div>
                    <div className="pl-4 border-l border-white/5 ml-2">
                      {Object.entries(subProps).map(([subKey, subVal]) => (
                        <PropRow
                          key={subKey}
                          propKey={subKey}
                          value={subVal ?? null}
                          onChange={(k, v) => handleSubChange(key, k, v)}
                        />
                      ))}
                    </div>
                  </div>
                )
              }

              // Null placeholder (registry sub-block opener)
              if (val === null) {
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
                    <span className="text-[11px] text-gray-400 font-medium">{key}</span>
                    <span className="text-[10px] text-gray-600 bg-white/3 px-1.5 py-0.5 rounded font-mono">registry</span>
                  </div>
                )
              }

              return <PropRow key={key} propKey={key} value={val} onChange={handleChange} />
            })
          )}

          {hasGuid && (
            <div className="flex items-start gap-2 mt-2 px-2 py-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg">
              <Warning size={11} className="text-yellow-500/60 shrink-0 mt-0.5" />
              <p className="text-[10px] text-gray-600 leading-relaxed">
                GUID values over 15 digits may have lost precision — read-only.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

function BlueprintPanel({ item, nodes, onSave }: BlueprintPanelProps) {
  return (
    <div className="flex flex-col gap-0">
      {nodes.map((node, i) => (
        <ComponentSection
          key={`${node.id}_${node.type}`}
          item={item}
          node={node}
          defaultOpen={i === 0}
          onSave={onSave}
        />
      ))}
    </div>
  )
}

// ─── Node section (tabs) ──────────────────────────────────────────────────────

interface NodeSectionProps {
  item: Item
  node: ComponentNode
  onSave: (updatedItem: Item) => void
}

function NodeSection({ item, node, onSave }: NodeSectionProps) {
  const [tab, setTab] = useState<NodeTab>('textures')
  const isRoot = node.childIndex === undefined
  const label = isRoot ? 'Root' : `Child ${node.childIndex}`

  // All components that belong to this node (share the same ItemObject GUID)
  // Ordered: ItemObjectRoot first, then others alphabetically, ItemMeshReference last
  const nodeComponents = item.components
    .filter(c => c.id === node.id)
    .sort((a, b) => {
      if (a.type === 'ItemObjectRoot') return -1
      if (b.type === 'ItemObjectRoot') return 1
      if (a.type === 'ItemMeshReference') return 1
      if (b.type === 'ItemMeshReference') return -1
      return a.type.localeCompare(b.type)
    })

  return (
    <div className="flex flex-col h-full">
      {/* Node identity + tab strip */}
      <div className="flex items-center gap-3 mb-3 pb-3 border-b border-white/5">
        <div className={`w-2 h-2 rounded-full shrink-0 ${isRoot ? 'bg-blue-400' : 'bg-orange-400'}`} />
        <span className="text-xs font-bold text-white">{label}</span>
        <span className="text-[10px] text-gray-600 font-mono">{node.type}</span>
        <div className="ml-auto flex gap-1">
          <button
            onClick={() => setTab('textures')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              tab === 'textures'
                ? 'bg-[#8b5cf6]/15 text-[#a78bfa]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
            }`}
          >
            <Palette size={11} />
            Textures
          </button>
          <button
            onClick={() => setTab('prefab')}
            className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              tab === 'prefab'
                ? 'bg-[#8b5cf6]/15 text-[#a78bfa]'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
            }`}
          >
            <TreeStructure size={11} />
            Prefab
          </button>
        </div>
      </div>

      {/* Tab content */}
      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'textures' && <NodeTexturePanel item={item} node={node} onSave={onSave} />}
        {tab === 'prefab' && <BlueprintPanel item={item} nodes={nodeComponents} onSave={onSave} />}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export default function ItemEditorPanel({ item, activeNode, onSave }: ItemEditorPanelProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)
  // WorkspaceCanvas mounts this with key={activeSelectedItem?.id}, so a fresh
  // instance (and fresh initial state below) is guaranteed whenever item changes.
  const [name, setName] = useState(item?.name || '')
  const [price, setPrice] = useState<number>(item?.price ?? 0)
  const [description, setDescription] = useState(item?.description || '')

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm select-none gap-2">
        <Cube size={32} weight="thin" className="text-gray-600 animate-pulse" />
        <span>Select an item from the catalog list to edit details</span>
      </div>
    )
  }

  const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)

  const handleFieldBlur = () => {
    onSave({ ...item, name: name.trim(), price: Number(price) || 0, description: description.trim() })
  }

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0]
      const registerFileInCache = useModStore.getState().registerFileInCache
      const cacheKey = item.guid
      registerFileInCache(cacheKey, file)
      onSave({ ...item, thumbnailKey: cacheKey })
    }
  }

  return (
    <div className="h-full flex flex-col bg-transparent text-white select-none box-border">
      <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-5 min-h-0">

        {/* SECTION 1: Primary Metadata */}
        <div className="flex flex-col md:flex-row gap-6 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm shrink-0">
          <div className="flex flex-col gap-2 shrink-0 items-center">
            <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 self-start">Item Catalog Image</label>
            <div className="relative w-32 h-32 bg-[#0e1017] border border-white/5 rounded-xl overflow-hidden group flex items-center justify-center shadow-inner">
              {liveThumbnailUrl
                ? <img src={liveThumbnailUrl} alt={name} className="w-full h-full object-contain p-2" />
                : <Image size={32} weight="thin" className="text-gray-600" />
              }
              <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity duration-150 flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center p-2">
                <PencilSimple size={16} className="text-[#8b5cf6]" />
                <span className="text-[10px] font-semibold text-gray-200">Replace Photo</span>
                <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleThumbnailChange} />
              </label>
            </div>
          </div>

          <div className="flex-1 flex flex-col gap-4 justify-center">
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <PencilSimple size={10} /> Display Name
              </label>
              <input type="text"
                className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150"
                value={name} onChange={(e) => setName(e.target.value)} onBlur={handleFieldBlur}
                placeholder="Enter workspace display title..."
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
                <CurrencyDollar size={10} /> Catalog Price ($)
              </label>
              <input type="number"
                className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                value={price === 0 ? '' : price} onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                onBlur={handleFieldBlur} placeholder="0" min="0"
              />
            </div>
          </div>
        </div>

        {/* SECTION 2: Description */}
        <div className="flex flex-col gap-2 bg-[#161923] border border-white/5 rounded-2xl p-5 shadow-sm shrink-0">
          <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 flex items-center gap-1">
            <TextAlignLeft size={10} /> Catalog Description
          </label>
          <textarea
            className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150 min-h-[80px] resize-vertical leading-relaxed"
            value={description} onChange={(e) => setDescription(e.target.value)}
            onBlur={handleFieldBlur} placeholder="Add a description..."
          />
        </div>

        {/* SECTION 3: Active node — textures + blueprint tabs */}
        <div className="flex flex-col flex-1 min-h-0">
          <div className="bg-[#161923]/20 border border-white/5 rounded-xl p-4 flex-1 flex flex-col min-h-0">
            {activeNode ? (
              <NodeSection item={item} node={activeNode} onSave={onSave} />
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center gap-2 text-center">
                <Palette size={24} weight="thin" className="text-gray-600" />
                <span className="text-xs text-gray-600">Select a mesh node in the left panel</span>
              </div>
            )}
          </div>
        </div>

      </div>
    </div>
  )
}
