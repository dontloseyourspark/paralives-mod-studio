// src/components/ItemEditorPanel.tsx
import React, { useState, useRef } from 'react'
import {
  PencilSimple, Image, Cube, ArrowLeft, Trash,
  Palette, UploadSimple, X, CheckCircle, Warning, TreeStructure, Copy, Info
} from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import { validateItem } from '../lib/itemValidation'
import { ITEM_MESH_TEXTURE_SLOTS, SLOT_LABELS, CONFIRMED_SLOTS, itemTextureCacheKey } from '../lib/itemTextureSlots'
import type { ItemMeshTextureSlot } from '../lib/itemTextureSlots'
import type { Item, ComponentNode, PrefabPropertyValue } from '../types/types'

interface ItemEditorPanelProps {
  item: Item | null
  activeNode: ComponentNode | null
  onSave: (updatedItem: Item) => void
  onClearNode: () => void
  onDeleteItem?: (itemId: string) => void
  onRemoveChildNode?: (item: Item, nodeGuid: string) => void
  allItems?: Item[]  // for resolving Item Variant GUIDs to display names
}

type NodeTab = 'textures' | 'prefab'
type Level0Tab = 'basic' | 'advanced'

const SPECULATIVE_FIELD_NOTE =
  'Based on a UI mockup, not a real exported mod — not yet read on import or written on export.'

// ─── Field label with optional info / speculative-field affordances ───────────

interface FieldLabelProps {
  children: React.ReactNode
  info?: string
  speculative?: boolean
}

// Native `title` tooltips are slow to appear and easy to miss on a 10px icon,
// so info/speculative affordances use a CSS-only hover popover instead.
function HoverNote({ text, children }: { text: string; children: React.ReactNode }) {
  return (
    <span className="relative inline-flex group">
      {children}
      <span className="pointer-events-none absolute z-30 bottom-full left-1/2 -translate-x-1/2 mb-1.5 hidden group-hover:block w-max max-w-[220px] whitespace-normal rounded-lg border border-white/10 bg-[#0e1017] px-2.5 py-1.5 text-[10px] font-normal leading-snug text-gray-300 shadow-lg">
        {text}
      </span>
    </span>
  )
}

function FieldLabel({ children, info, speculative }: FieldLabelProps) {
  return (
    <span className="text-xs text-gray-400 flex items-center gap-1.5">
      {children}
      {speculative && (
        <HoverNote text={SPECULATIVE_FIELD_NOTE}>
          <Warning size={10} className="text-yellow-500/70" />
        </HoverNote>
      )}
      {info && (
        <HoverNote text={info}>
          <Info size={10} className="text-gray-600 hover:text-gray-400 transition-colors" />
        </HoverNote>
      )}
    </span>
  )
}

// ─── Prefab property key → human-readable label ───────────────────────────────
// Raw .prefab keys follow a consistent PascalCase convention (confirmed across
// every field seen in two validated real mods plus the in-game editor's own
// field labels) — e.g. "ItemCanBeStackedOn" → "Item Can Be Stacked On".

function humanizeKey(key: string): string {
  return key
    .replace(/([a-z0-9])([A-Z])/g, '$1 $2')
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2')
}

// ─── Default-injected fields per component type ────────────────────────────────
// The Prefab tab only ever shows what's literally present in node.properties —
// but the in-game editor always shows every field it knows about with a default
// value, even when absent from the source .prefab (e.g. a fresh Sheep.prefab has
// no `PathfindingImpact:` line, yet the game shows "Pathfinding Impact:
// BlockWalking"). These maps close that gap: merged in for any key NOT already
// present, so editing one "promotes" it into real, exported properties — fields
// never touched stay display-only defaults, never written to the saved item.
// Confirmed against the in-game editor's own field list. Raw key names follow
// the PascalCase-of-the-label convention confirmed across every other field in
// this codebase (zero exceptions found across two validated real mods).
const ITEM_OBJECT_ROOT_DEFAULTS: Record<string, PrefabPropertyValue> = {
  DefaultSwatchGroup: '',
  DefaultSwatchGUID: '0',
  IsWallItem: 'False',
  IsCeilingItem: 'False',
  PathfindingImpact: 'BlockWalking',
  IsResizable: 'False',
  CanSetAlphaDirty: 'False',
  ItemIsFlippable: 'bool3(False, False, False)',
  FlipSpecificTransforms: 'False',
  IsTransparent: 'False',
  Skinnable: 'False',
}
const ITEM_CUBE_TRANSFORM_DEFAULTS: Record<string, PrefabPropertyValue> = {
  MinAnchorPos: [0, 0, 0],
  MaxAnchorPos: [0, 0, 0],
  IsFlippable: 'False',
  Skinnable: 'False',
}
const ITEM_MESH_REFERENCE_DEFAULTS: Record<string, PrefabPropertyValue> = {
  OverrideMeshForCollision: 'False',
  ShowOutlineOnMouseOver: 'True',
  ForceUseAfterStencilBufferLayer: 'False',
  ShadowCastingMode: 'On',
  IsResizable: 'bool3(False, False, False)',
  HasUserPadding: 'False',
  HasMetadataPadding: 'True',
  AutoTiling: 'None',
  LayerOffset: 0,
  Skinnable: 'False',
}
const NODE_DEFAULTS: Record<string, Record<string, PrefabPropertyValue>> = {
  ItemObjectRoot: ITEM_OBJECT_ROOT_DEFAULTS,
  ItemCubeTransform: ITEM_CUBE_TRANSFORM_DEFAULTS,
  ItemMeshReference: ITEM_MESH_REFERENCE_DEFAULTS,
}

// ─── Simple string-array editor (Tags, Color Zone Names, Mesh Parts, Rope Items, etc.) ──

interface SimpleArrayEditorProps {
  label: string
  values: string[]
  onChange: (values: string[]) => void
  placeholder?: string
  info?: string
}

function SimpleArrayEditor({ label, values, onChange, placeholder, info }: SimpleArrayEditorProps) {
  const itemInputClass = "bg-white/3 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-medium text-white outline-none focus:border-[#8b5cf6]/40 transition-all font-mono flex-1"
  return (
    <div className="flex flex-col gap-1.5 py-1.5 border-b border-white/3 last:border-0">
      <div className="flex items-center justify-between gap-3">
        <FieldLabel info={info}>{label}</FieldLabel>
        <button
          onClick={() => onChange([...values, ''])}
          className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 hover:text-[#a78bfa] hover:bg-[#8b5cf6]/10 rounded transition-colors"
        >
          + Add
        </button>
      </div>
      {values.length === 0 ? (
        <p className="text-[10px] text-gray-600 italic">None</p>
      ) : (
        values.map((v, i) => (
          <div key={i} className="flex items-center gap-1.5">
            <span className="text-[9px] text-gray-600 w-4 shrink-0 text-right">{i + 1}</span>
            <input
              className={itemInputClass}
              value={v}
              placeholder={placeholder}
              onChange={(e) => { const next = [...values]; next[i] = e.target.value; onChange(next) }}
            />
            <button
              onClick={() => onChange(values.filter((_, j) => j !== i))}
              className="shrink-0 p-1 text-gray-600 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors"
            >
              <X size={10} weight="bold" />
            </button>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isGuidLike(val: unknown): boolean {
  if (typeof val === 'number') return Math.abs(val) >= 1e15
  if (typeof val === 'string') return /^\d{15,19}$/.test(val.trim())
  return false
}

function isBoolString(val: unknown): val is 'True' | 'False' {
  return val === 'True' || val === 'False'
}

function isVector(val: unknown): val is number[] {
  return Array.isArray(val) && val.every(v => typeof v === 'number')
}

// ─── Toggle switch ────────────────────────────────────────────────────────────

interface ToggleProps {
  value: boolean
  onChange: (v: boolean) => void
}

function Toggle({ value, onChange }: ToggleProps) {
  return (
    <button onClick={() => onChange(!value)}
      className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${value ? 'bg-[#8b5cf6]' : 'bg-white/10'}`}>
      <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${value ? 'left-[18px]' : 'left-0.5'}`} />
    </button>
  )
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
  nodes: ComponentNode[]
  onSave: (updatedItem: Item) => void
}

interface PropRowProps {
  propKey: string
  value: PrefabPropertyValue
  onChange: (key: string, newVal: PrefabPropertyValue) => void
}

function PropRow({ propKey, value, onChange }: PropRowProps) {
  const inputClass = "bg-white/3 border border-white/8 rounded-lg px-2.5 py-1 text-xs text-white outline-none focus:border-[#8b5cf6]/40 transition-all font-mono"
  const label = humanizeKey(propKey)

  if (value === null || value === undefined || (typeof value === 'object' && !Array.isArray(value))) {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <span className="text-[10px] text-gray-600 font-mono">—</span>
      </div>
    )
  }

  if (isGuidLike(value)) {
    const strVal = String(value)
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 shrink-0 font-medium">{label}</span>
        <div className="flex items-center gap-1.5 min-w-0">
          <span className="text-[10px] font-mono text-gray-500 truncate">{strVal}</span>
          <button onClick={() => navigator.clipboard.writeText(strVal)} className="text-gray-600 hover:text-gray-300 transition-colors shrink-0" title="Copy GUID">
            <Copy size={10} />
          </button>
          <span className="text-[9px] text-gray-700 bg-white/3 px-1.5 py-0.5 rounded shrink-0">GUID</span>
        </div>
      </div>
    )
  }

  if (isBoolString(value)) {
    const isTrue = value === 'True'
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <button
          onClick={() => onChange(propKey, isTrue ? 'False' : 'True')}
          className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${isTrue ? 'bg-[#8b5cf6]' : 'bg-white/10'}`}
        >
          <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${isTrue ? 'left-[18px]' : 'left-0.5'}`} />
        </button>
      </div>
    )
  }

  if (isVector(value)) {
    const axisLabels = ['X', 'Y', 'Z', 'W']
    return (
      <div className="flex flex-col gap-1 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <div className="flex gap-1.5">
          {value.map((v, i) => (
            <div key={i} className="flex-1 flex flex-col gap-0.5">
              <span className="text-[9px] text-gray-600 text-center">{axisLabels[i] ?? i}</span>
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

  if (typeof value === 'number') {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium shrink-0">{label}</span>
        <input
          type="number"
          className={`${inputClass} w-28 text-right [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none`}
          value={value}
          onChange={(e) => onChange(propKey, parseFloat(e.target.value) || 0)}
        />
      </div>
    )
  }

  if (typeof value === 'string' && value.startsWith('bool3(')) {
    const axisValues = value.replace('bool3(', '').replace(')', '').split(',').map(s => s.trim() === 'True')
    const axisLabels = ['X', 'Y', 'Z']
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium">{label}</span>
        <div className="flex gap-3">
          {axisValues.map((v, i) => (
            <div key={i} className="flex items-center gap-1.5">
              <span className="text-[9px] text-gray-600">{axisLabels[i] ?? i}</span>
              <button
                onClick={() => {
                  const updated = [...axisValues]; updated[i] = !v
                  onChange(propKey, `bool3(${updated.map(b => b ? 'True' : 'False').join(', ')})`)
                }}
                className={`relative w-7 h-4 rounded-full transition-colors shrink-0 ${v ? 'bg-[#8b5cf6]' : 'bg-white/10'}`}
              >
                <span className={`absolute top-0.5 w-3 h-3 bg-white rounded-full shadow transition-all ${v ? 'left-[14px]' : 'left-0.5'}`} />
              </button>
            </div>
          ))}
        </div>
      </div>
    )
  }

  if (typeof value === 'string') {
    return (
      <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
        <span className="text-[11px] text-gray-400 font-medium shrink-0">{label}</span>
        <input
          type="text"
          className={`${inputClass} flex-1 min-w-0 text-right`}
          value={value}
          onChange={(e) => onChange(propKey, e.target.value)}
        />
      </div>
    )
  }

  return (
    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
      <span className="text-[11px] text-gray-400 font-medium">{label}</span>
      <span className="text-[10px] text-gray-600 font-mono">—</span>
    </div>
  )
}

// ─── AssetMesh row — GUID display + import/replace mesh ────────────────────────

interface AssetMeshRowProps {
  item: Item
  node: ComponentNode
  value: PrefabPropertyValue
  onSave: (updatedItem: Item) => void
}

function AssetMeshRow({ item, node, value, onSave }: AssetMeshRowProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const strVal = value != null ? String(value) : null
  const [importError, setImportError] = useState<string | null>(null)
  const [importing, setImporting] = useState(false)

  const handleImport = async (file: File) => {
    setImportError(null)
    setImporting(true)
    try {
      const { importMeshForNode } = await import('../lib/meshImport')
      onSave(await importMeshForNode(item, node, file))
    } catch (err) {
      setImportError(err instanceof Error ? err.message : 'Could not import this mesh.')
    } finally {
      setImporting(false)
    }
  }

  return (
    <div className="flex flex-col gap-1 py-1.5 border-b border-white/3">
      <div className="flex items-center justify-between gap-3">
        <span className="text-[11px] text-gray-400 shrink-0 font-medium">Asset Mesh</span>
        <div className="flex items-center gap-1.5 min-w-0">
          {strVal && (
            <>
              <span className="text-[10px] font-mono text-gray-500 truncate">{strVal}</span>
              <button onClick={() => navigator.clipboard.writeText(strVal)} className="text-gray-600 hover:text-gray-300 transition-colors shrink-0" title="Copy GUID">
                <Copy size={10} />
              </button>
            </>
          )}
          <button
            onClick={() => inputRef.current?.click()}
            disabled={importing}
            className="shrink-0 flex items-center gap-1 px-1.5 py-0.5 text-[9px] font-semibold text-gray-500 hover:text-[#a78bfa] hover:bg-[#8b5cf6]/10 rounded transition-colors disabled:opacity-50"
          >
            <UploadSimple size={10} />
            {importing ? 'Importing…' : strVal ? 'Replace' : 'Import'}
          </button>
          <input ref={inputRef} type="file" accept=".fbx" className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) handleImport(f); e.target.value = '' }} />
        </div>
      </div>
      {importError && (
        <p className="text-[10px] text-rose-400/80 leading-relaxed m-0">{importError}</p>
      )}
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

  const mergedProperties = { ...(NODE_DEFAULTS[node.type] ?? {}), ...node.properties }
  const propEntries = Object.entries(mergedProperties)
  const hasGuid = propEntries.some(([, v]) => isGuidLike(v))

  return (
    <div className="border border-white/5 rounded-xl overflow-hidden mb-2">
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

      {open && (
        <div className="px-3 pb-2 pt-1">
          {propEntries.length === 0 && node.type !== 'ItemMeshReference' ? (
            <span className="text-[11px] text-gray-600 italic py-2 block">No properties</span>
          ) : (
            <>
            {node.type === 'ItemMeshReference' && !('AssetMesh' in node.properties) && (
              <AssetMeshRow item={item} node={node} value={null} onSave={onSave} />
            )}
            {propEntries.map(([key, val]) => {
              if (typeof val === 'object' && val !== null && !Array.isArray(val)) {
                const { _value, ...subProps } = val as Record<string, PrefabPropertyValue | undefined>
                return (
                  <div key={key} className="mb-1">
                    <div className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
                      <span className="text-[11px] text-gray-300 font-semibold">{humanizeKey(key)}</span>
                      {_value !== undefined && _value !== null ? (
                        isBoolString(_value) ? (
                          <button
                            onClick={() => handleChange(key, {
                              ...(val as Record<string, PrefabPropertyValue | undefined>),
                              _value: _value === 'True' ? 'False' : 'True'
                            })}
                            className={`relative w-9 h-5 rounded-full transition-colors shrink-0 ${_value === 'True' ? 'bg-[#8b5cf6]' : 'bg-white/10'}`}
                          >
                            <span className={`absolute top-0.5 w-4 h-4 bg-white rounded-full shadow transition-all ${_value === 'True' ? 'left-[18px]' : 'left-0.5'}`} />
                          </button>
                        ) : (
                          <span className="text-[10px] font-mono text-gray-500">{String(_value)}</span>
                        )
                      ) : null}
                    </div>
                    <div className="pl-4 border-l border-white/5 ml-2">
                      {Object.entries(subProps).map(([subKey, subVal]) => (
                        <PropRow key={subKey} propKey={subKey} value={subVal ?? null} onChange={(k, v) => handleSubChange(key, k, v)} />
                      ))}
                    </div>
                  </div>
                )
              }

              if (val === null) {
                return (
                  <div key={key} className="flex items-center justify-between gap-3 py-1.5 border-b border-white/3">
                    <span className="text-[11px] text-gray-400 font-medium">{humanizeKey(key)}</span>
                    <span className="text-[10px] text-gray-600 bg-white/3 px-1.5 py-0.5 rounded font-mono">registry</span>
                  </div>
                )
              }

              if (key === 'AssetMesh') {
                return <AssetMeshRow key={key} item={item} node={node} value={val} onSave={onSave} />
              }

              return <PropRow key={key} propKey={key} value={val} onChange={handleChange} />
            })}
            </>
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
      {nodes.map((node) => (
        <ComponentSection key={`${node.id}_${node.type}`} item={item} node={node} defaultOpen={true} onSave={onSave} />
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
  const [tab, setTab] = useState<NodeTab>('prefab')
  const isRoot = node.childIndex === undefined
  const label = isRoot ? 'Root' : `Child ${node.childIndex! + 1}`

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
      <div className="flex items-center gap-1 mb-3 pb-3 border-b border-white/5">
        <button
          onClick={() => setTab('prefab')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            tab === 'prefab' ? 'bg-[#8b5cf6]/15 text-[#a78bfa]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
          }`}
        >
          <TreeStructure size={11} />
          Prefab
        </button>
        <button
          onClick={() => setTab('textures')}
          className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
            tab === 'textures' ? 'bg-[#8b5cf6]/15 text-[#a78bfa]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
          }`}
        >
          <Palette size={11} />
          Textures
        </button>
        <div className="ml-auto flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full shrink-0 ${isRoot ? 'bg-blue-400' : 'bg-orange-400'}`} />
          <span className="text-xs font-bold text-white">{label}</span>
          <span className="text-[10px] text-gray-600 font-mono">{node.type}</span>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto min-h-0">
        {tab === 'textures' && <NodeTexturePanel item={item} node={node} onSave={onSave} />}
        {tab === 'prefab' && <BlueprintPanel item={item} nodes={nodeComponents} onSave={onSave} />}
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

// ── Delete item button (two-step confirm) ─────────────────────────────────────
function DeleteItemButton({ onDelete, label = 'Delete Item' }: { onDelete: () => void; label?: string }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2 px-5 pb-5 shrink-0">
        <span className="text-[11px] text-gray-400 flex-1">Delete this item?</span>
        <button
          onClick={() => { onDelete(); setConfirming(false) }}
          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors outline-none"
        >
          Delete
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[11px] cursor-pointer transition-colors outline-none"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 pb-5 shrink-0">
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-semibold text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/5 border border-rose-500/10 hover:border-rose-500/20 transition-all outline-none"
      >
        <Trash size={12} />
        {label}
      </button>
    </div>
  )
}

export default function ItemEditorPanel({ item, activeNode, onSave, onClearNode, onDeleteItem, onRemoveChildNode, allItems }: ItemEditorPanelProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)
  const [name, setName] = useState(item?.name || '')
  const [price, setPrice] = useState<number>(item?.price ?? 0)
  const [description, setDescription] = useState(item?.description || '')
  const [level0Tab, setLevel0Tab] = useState<Level0Tab>('basic')

  if (!item) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-gray-500 text-sm select-none gap-2">
        <Cube size={32} weight="thin" className="text-gray-600 animate-pulse" />
        <span>Select an item from the catalog list to edit details</span>
      </div>
    )
  }

  const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)
  const save = (patch: Partial<Item>) => onSave({ ...item, ...patch })

  const handleThumbnailChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.[0]) {
      const file = e.target.files[0]
      const registerFileInCache = useModStore.getState().registerFileInCache
      const cacheKey = item.guid
      registerFileInCache(cacheKey, file)
      save({ thumbnailKey: cacheKey })
    }
  }

  const inputClass = "w-full bg-white/3 border border-white/5 rounded-xl px-4 py-2.5 text-sm font-medium text-white outline-none focus:border-[#8b5cf6]/40 focus:bg-[#8b5cf6]/2 transition-all duration-150"
  const smallInputClass = "bg-white/3 border border-white/5 rounded-lg px-3 py-1.5 text-xs font-medium text-white outline-none focus:border-[#8b5cf6]/40 transition-all font-mono"
  const labelClass = "text-[10px] font-bold uppercase tracking-wider text-gray-400"
  const rowClass = "flex items-center justify-between gap-3 py-2 border-b border-white/3 last:border-0"
  const groupLabelClass = "text-[10px] font-semibold uppercase tracking-widest text-gray-600 mt-4 mb-1.5 first:mt-0"

  // ── Level 0: item fields ───────────────────────────────────────────────────
  if (!activeNode) {
    return (
      <div className="h-full flex flex-col bg-transparent text-white select-none box-border">
        <div className="flex items-center gap-1 px-6 pt-4 pb-3 shrink-0 border-b border-white/5">
          <button
            onClick={() => setLevel0Tab('basic')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              level0Tab === 'basic' ? 'bg-[#8b5cf6]/15 text-[#a78bfa]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
            }`}
          >
            Basic
          </button>
          <button
            onClick={() => setLevel0Tab('advanced')}
            className={`px-2.5 py-1 rounded-lg text-[11px] font-semibold transition-all ${
              level0Tab === 'advanced' ? 'bg-[#8b5cf6]/15 text-[#a78bfa]' : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
            }`}
          >
            Advanced
          </button>
          <span className="ml-auto text-[11px] text-gray-500 font-medium px-2.5 py-1 bg-white/3 rounded-lg truncate max-w-[160px]">
            {item.name || 'Item'}
          </span>
        </div>

        <div className="flex-1 overflow-y-auto p-6 flex flex-col gap-4 min-h-0">

          {/* Export-readiness banner — the actionable counterpart to the left
              panel's status ring. Only rendered when validateItem finds issues,
              so a clean item pays no visual cost. */}
          {(() => {
            const validation = validateItem(item)
            if (validation.status === 'ready') return null
            const isError = validation.status === 'error'
            return (
              <div className={`flex items-start gap-2.5 px-4 py-3 rounded-2xl border shrink-0 ${
                isError ? 'bg-rose-500/5 border-rose-500/15' : 'bg-amber-500/5 border-amber-500/15'
              }`}>
                <Warning size={14} weight="fill" className={`shrink-0 mt-0.5 ${isError ? 'text-rose-400/80' : 'text-amber-400/80'}`} />
                <div className="flex flex-col gap-1 min-w-0">
                  <span className={`text-[11px] font-semibold ${isError ? 'text-rose-300' : 'text-amber-300'}`}>
                    {isError ? 'This item can’t export correctly yet' : 'Worth checking before you export'}
                  </span>
                  <ul className="m-0 pl-0 list-none flex flex-col gap-0.5">
                    {validation.issues.map((issue) => (
                      <li key={issue} className="text-[11px] text-gray-500 leading-relaxed">• {issue}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )
          })()}

          {level0Tab === 'basic' ? (
            <>
              <div className="flex flex-col md:flex-row gap-5 bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <div className="flex flex-col gap-2 shrink-0 items-center">
                  <span className={labelClass}>Catalog Image</span>
                  <div className="relative w-28 h-28 bg-[#0e1017] border border-white/5 rounded-xl overflow-hidden group flex items-center justify-center shadow-inner">
                    {liveThumbnailUrl
                      ? <img src={liveThumbnailUrl} alt={name} className="w-full h-full object-contain p-2" />
                      : <Image size={28} weight="thin" className="text-gray-600" />
                    }
                    <label className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1.5 cursor-pointer text-center p-2">
                      <PencilSimple size={14} className="text-[#8b5cf6]" />
                      <span className="text-[10px] font-semibold text-gray-200">Replace</span>
                      <input type="file" accept="image/png, image/jpeg" className="hidden" onChange={handleThumbnailChange} />
                    </label>
                  </div>
                </div>
                <div className="flex-1 flex flex-col gap-3 justify-center">
                  <div className="flex flex-col gap-1.5">
                    <label className={labelClass}>Display Name</label>
                    <input type="text" className={inputClass} value={name}
                      onChange={(e) => setName(e.target.value)}
                      onBlur={() => save({ name: name.trim() })}
                      placeholder="Item display name..." />
                  </div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClass}>Price ($)</label>
                      <input type="number" className={inputClass + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
                        value={price === 0 ? '' : price}
                        onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                        onBlur={() => save({ price: Number(price) || 0 })}
                        placeholder="0" min="0" />
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className={labelClass}>Price Multiplier</label>
                      <input type="number" className={inputClass + " [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"}
                        value={item.priceMultiplier ?? 1}
                        onChange={(e) => save({ priceMultiplier: parseFloat(e.target.value) || 1 })}
                        step="0.1" min="0" />
                    </div>
                  </div>
                  <div className={rowClass}>
                    <FieldLabel info="Removes this item from the in-game Build Mode catalog without deleting it from the mod.">Hide From Catalog</FieldLabel>
                    <Toggle value={item.hideFromCatalog ?? false} onChange={(v) => save({ hideFromCatalog: v })} />
                  </div>
                  <div className={rowClass}>
                    <FieldLabel info="Uses a custom interaction group for this item instead of the one inherited from its category.">Override Interaction Group</FieldLabel>
                    <Toggle value={item.overrideInteractionGroup ?? false} onChange={(v) => save({ overrideInteractionGroup: v })} />
                  </div>
                  <div className={rowClass}>
                    <FieldLabel info="Customizes which interactions are available when this item is shown as a low-detail impostor at a distance.">Override Impostor Interactions</FieldLabel>
                    <Toggle value={item.overrideImpostorInteractions ?? false} onChange={(v) => save({ overrideImpostorInteractions: v })} />
                  </div>
                </div>
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Tags</p>
                <SimpleArrayEditor
                  label="Tag"
                  values={(item.tags ?? []).map(t => t.value)}
                  onChange={(next) => save({ tags: next.map((value, i) => ({ guid: item.tags?.[i]?.guid ?? crypto.randomUUID(), value })) })}
                  placeholder="Build-mode tag GUID..."
                  info="Build-mode catalog tags (e.g. Toilets, Plumbing) controlling which catalog categories this item appears under."
                />
              </div>

              <div className="flex flex-col gap-2 bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <label className={labelClass}>Catalog Description</label>
                <textarea className="w-full bg-white/3 border border-white/5 rounded-xl px-4 py-3 text-sm text-gray-300 placeholder-gray-600 outline-none focus:border-[#8b5cf6]/40 transition-all min-h-[70px] resize-vertical leading-relaxed"
                  value={description} onChange={(e) => setDescription(e.target.value)}
                  onBlur={() => save({ description: description.trim() })}
                  placeholder="Add a description..." />
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Swatch</p>
                <div className={rowClass}>
                  <FieldLabel info="Enables a recolorable swatch picker for this item in Build Mode.">Has Swatches</FieldLabel>
                  <Toggle value={item.hasSwatches ?? false} onChange={(v) => save({ hasSwatches: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="GUID linking this item to a swatch color group defined in the game's Swatches.setting.">Swatch Group GUID</FieldLabel>
                  <input className={smallInputClass + " w-48"} value={item.swatchGroup ?? ''}
                    onChange={(e) => save({ swatchGroup: e.target.value })} placeholder="GUID..." />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Index of the swatch variant selected by default when this item is placed.">Default Swatch</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.defaultSwatch ?? '0'}
                    onChange={(e) => save({ defaultSwatch: e.target.value })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Number of independently recolorable zones on this item's texture, beyond the base color.">Color Zone Count</FieldLabel>
                  <select className={smallInputClass} value={item.swatchColorZoneCount ?? 0}
                    onChange={(e) => save({ swatchColorZoneCount: parseInt(e.target.value) })}>
                    <option value={0}>One Color (0)</option>
                    <option value={1}>Two Zones (1)</option>
                    <option value={2}>Three Zones (2)</option>
                    <option value={3}>Four Zones (3)</option>
                  </select>
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Camera angle used to render this item's catalog thumbnail.">Thumbnail Type</FieldLabel>
                  <select className={smallInputClass} value={item.swatchThumbnailType ?? 1}
                    onChange={(e) => save({ swatchThumbnailType: parseInt(e.target.value) })}>
                    <option value={1}>Item</option>
                    <option value={3}>Floor (top-down)</option>
                    <option value={4}>Wall (side-on)</option>
                  </select>
                </div>
                <SimpleArrayEditor
                  label="Color Zone Names"
                  values={(item.colorZoneNames ?? []).map(c => c.value)}
                  onChange={(next) => save({ colorZoneNames: next.map((value, i) => ({ guid: item.colorZoneNames?.[i]?.guid ?? crypto.randomUUID(), value })) })}
                  placeholder="Translation GUID..."
                  info="Translation-string GUIDs naming each recolorable zone shown in the swatch picker."
                />
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Placement</p>
                <div className={rowClass}>
                  <FieldLabel info="Automatically selects this item in its catalog category when Build Mode opens.">Auto Select</FieldLabel>
                  <Toggle value={item.autoSelect ?? false} onChange={(v) => save({ autoSelect: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Replaces the default wall/floor snapping behavior for this item.">Override Snap</FieldLabel>
                  <Toggle value={item.overrideSnap ?? false} onChange={(v) => save({ overrideSnap: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Renders this item using wall-surface shading rules instead of standard object shading.">Render As Wall</FieldLabel>
                  <Toggle value={item.renderAsWall ?? false} onChange={(v) => save({ renderAsWall: v })} />
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Placement</p>
                <div className={rowClass}>
                  <FieldLabel info="Catalog property used to vary this item's price by selected skin/finish.">Price Skin Property</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.priceSkinProperty ?? 'None'}
                    onChange={(e) => save({ priceSkinProperty: e.target.value })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Overrides whether multiple copies of this item can be bought in one purchase.">Multipurchase Override</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.multipurchaseOverride ?? 'NoOverride'}
                    onChange={(e) => save({ multipurchaseOverride: e.target.value })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Overrides the placement animation played when this item is set down in Build Mode.">Item Placement Tween Override</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.itemPlacementTweenOverride ?? 'None'}
                    onChange={(e) => save({ itemPlacementTweenOverride: e.target.value })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Overrides whether this item automatically rotates to match the surface it snaps to.">Rotate To Snap Override</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.rotateToSnapOverride ?? 'NoOverride'}
                    onChange={(e) => save({ rotateToSnapOverride: e.target.value })} />
                </div>
                <SimpleArrayEditor
                  label="Resize Snap Profiles"
                  values={item.resizeSnapProfiles ?? []}
                  onChange={(v) => save({ resizeSnapProfiles: v })}
                  placeholder="Snap profile GUID..."
                  info="Profiles controlling how this item snaps to walls/floors/other items when resized."
                />
                <SimpleArrayEditor
                  label="Mesh Parts"
                  values={(item.meshParts ?? []).map(p => p.displayName)}
                  onChange={(next) => save({ meshParts: next.map((displayName, i) => ({ guid: item.meshParts?.[i]?.guid ?? crypto.randomUUID(), displayName })) })}
                  placeholder="Mesh part display name..."
                  info="Names sub-parts of this item's mesh, e.g. for box/floor-plan tools."
                />
                <SimpleArrayEditor
                  label="Rope Items"
                  values={item.ropeItems ?? []}
                  onChange={(v) => save({ ropeItems: v })}
                  placeholder="Rope item GUID..."
                  info="GUIDs of items connected to this one by a rope (e.g. string lights)."
                />
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Nested Prefab</p>
                <div className={rowClass}>
                  <FieldLabel info="Spawns a different, nested prefab alongside this item instead of the default one.">Override Nested Prefab To Spawn</FieldLabel>
                  <Toggle value={item.overrideNestedPrefabToSpawn ?? false} onChange={(v) => save({ overrideNestedPrefabToSpawn: v })} />
                </div>
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Rendering</p>
                <div className={rowClass}>
                  <FieldLabel info="Keeps this item visible when behind a wall that would normally hide it from camera.">Always Visible On Walls</FieldLabel>
                  <Toggle value={item.alwaysVisibleOnWalls ?? false} onChange={(v) => save({ alwaysVisibleOnWalls: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Disables the automatic fade/hide behavior when the camera gets too close to this item.">Override Item Fading From Camera</FieldLabel>
                  <Toggle value={item.overrideItemFadingFromCamera ?? false} onChange={(v) => save({ overrideItemFadingFromCamera: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Excludes this item from render batching with others — use if it has unusual shaders or transparency that batching would break.">Cannot Batch</FieldLabel>
                  <Toggle value={item.cannotBatch ?? false} onChange={(v) => save({ cannotBatch: v })} />
                </div>
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Animation</p>
                <div className={rowClass}>
                  <FieldLabel info="Substitutes a different item's animation set for this item's interactions.">Override Item For Animation</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.overrideItemForAnimation ?? 'None'}
                    onChange={(e) => save({ overrideItemForAnimation: e.target.value })} />
                </div>
                <p className={groupLabelClass}>Bills</p>
                <div className={rowClass}>
                  <FieldLabel info="Ignores the usage-level bill cost normally derived from this item's catalog tags.">Ignore Usage Level From Tags</FieldLabel>
                  <Toggle value={item.ignoreUsageLevelFromTags ?? false} onChange={(v) => save({ ignoreUsageLevelFromTags: v })} />
                </div>
                <p className={groupLabelClass}>Dirtyness</p>
                <div className={rowClass}>
                  <FieldLabel info="How quickly this item accumulates dirtiness over time (e.g. None, Slow, Medium, Fast).">Dirtiness Speed Tier</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.dirtinessSpeedTier ?? 'None'}
                    onChange={(e) => save({ dirtinessSpeedTier: e.target.value })} />
                </div>
                <p className={groupLabelClass}>Brokenness</p>
                <div className={rowClass}>
                  <FieldLabel info="How quickly this item can break down with use (e.g. None, Slow, Medium, Fast).">Breaking Speed Tier</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.breakingSpeedTier ?? 'None'}
                    onChange={(e) => save({ breakingSpeedTier: e.target.value })} />
                </div>
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Variants in UI</p>
                {item.itemVariants && item.itemVariants.length > 0 ? (
                  <div className="mb-3 flex flex-col gap-1.5">
                    {item.itemVariants.map((v, i) => {
                      const variantName = allItems?.find(other => other.guid === v.itemVariantGuid)?.name
                      return (
                        <div key={v.guid || i} className="flex items-center gap-2 px-3 py-2 bg-white/2 border border-white/5 rounded-lg">
                          <span className="text-[10px] text-gray-500 font-mono shrink-0">Variant {i + 1}</span>
                          <span className="text-[10px] font-mono text-gray-400 truncate flex-1" title={v.itemVariantGuid}>
                            {variantName || v.itemVariantGuid}
                          </span>
                          <FieldLabel info="Uses this variant's own surface as its catalog thumbnail instead of the parent item's.">
                            <span className="text-[9px] text-gray-500">Surface Thumbnail</span>
                          </FieldLabel>
                          <Toggle
                            value={v.useSurfaceThumbnailTexture ?? false}
                            onChange={(checked) => {
                              const nextVariants = item.itemVariants.map((entry, j) => j === i ? { ...entry, useSurfaceThumbnailTexture: checked } : entry)
                              save({ itemVariants: nextVariants })
                            }}
                          />
                          <button onClick={() => navigator.clipboard.writeText(v.itemVariantGuid)} className="text-gray-700 hover:text-gray-400 transition-colors shrink-0">
                            <Copy size={10} />
                          </button>
                        </div>
                      )
                    })}
                  </div>
                ) : (
                  <p className="text-xs text-gray-600 italic mb-3">No variants defined</p>
                )}
                <div className={rowClass}>
                  <FieldLabel info="Keeps the same swatch/color selection applied across all of this item's variants.">Synchronize Swatch Among Variants</FieldLabel>
                  <Toggle value={item.synchronizeSwatchAmongVariants ?? false} onChange={(v) => save({ synchronizeSwatchAmongVariants: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Stops the catalog from remembering this item's last-selected variant when reopening its category.">Ignore Remember Index For Category</FieldLabel>
                  <Toggle value={item.ignoreRememberIndexForCategory ?? false} onChange={(v) => save({ ignoreRememberIndexForCategory: v })} />
                </div>
                <div className={rowClass}>
                  <FieldLabel info="Indicates this item defines per-variant size overrides instead of sharing one size.">Has Size Variants Overrides</FieldLabel>
                  <Toggle value={item.hasSizeVariantsOverrides ?? false} onChange={(v) => save({ hasSizeVariantsOverrides: v })} />
                </div>
              </div>

              <div className="bg-[#161923] border border-white/5 rounded-2xl p-5 shrink-0">
                <p className={groupLabelClass}>Collectability</p>
                <div className={rowClass}>
                  <FieldLabel info="Groups this item into a named collectible set shown in the in-game collection tracker.">Collectible Collection</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.collectibleCollection ?? 'None'}
                    onChange={(e) => save({ collectibleCollection: e.target.value })} />
                </div>
                <p className={groupLabelClass}>Patreon</p>
                <div className={rowClass}>
                  <FieldLabel info="Creator name shown on this item's Patreon-exclusive badge, if any.">Patreon Name</FieldLabel>
                  <input className={smallInputClass + " w-32"} value={item.patreonName ?? ''}
                    onChange={(e) => save({ patreonName: e.target.value })} placeholder="(none)" />
                </div>
              </div>
            </>
          )}

          {/* ── Delete item ── */}
          {onDeleteItem && (
            <DeleteItemButton onDelete={() => onDeleteItem(item.id)} />
          )}

        </div>
      </div>
    )
  }

  // ── Level 1+: node-level view (Prefab + Textures tabs) ──────────────────────
  const isRootNode = activeNode.childIndex === undefined
  const nodeLabel = isRootNode ? 'Root' : `Child ${activeNode.childIndex! + 1}`

  return (
    <div className="h-full flex flex-col bg-transparent text-white select-none box-border">
      {/* Breadcrumb — click item name to return to Level 0 */}
      <div className="flex items-center gap-2 px-6 pt-4 shrink-0">
        <button
          onClick={onClearNode}
          className="flex items-center gap-1.5 text-[11px] text-gray-500 hover:text-white transition-colors group"
        >
          <ArrowLeft size={11} weight="bold" className="group-hover:-translate-x-0.5 transition-transform" />
          <span className="font-medium truncate max-w-[120px]">{item.name || 'Item'}</span>
        </button>
        <span className="text-gray-700 text-[11px]">/</span>
        <span className="text-[11px] text-gray-400 font-medium">{nodeLabel}</span>
      </div>
      <div className="flex-1 p-6 pb-0 flex flex-col min-h-0">
        <div className="bg-[#161923]/20 border border-white/5 rounded-xl p-4 flex-1 flex flex-col min-h-0">
          <NodeSection item={item} node={activeNode} onSave={onSave} />
        </div>
      </div>

      {/* Node-level actions */}
      {isRootNode ? (
        /* Root node — delete root = delete item */
        onDeleteItem && <DeleteItemButton onDelete={() => onDeleteItem(item.id)} label="Delete Item" />
      ) : (
        /* Child node — remove this node from the prefab graph */
        onRemoveChildNode && (
          <RemoveNodeButton
            label={nodeLabel}
            onRemove={() => { onRemoveChildNode(item, activeNode.id); onClearNode() }}
          />
        )
      )}
    </div>
  )
}

// ── Remove node button (two-step confirm) ─────────────────────────────────────
function RemoveNodeButton({ label, onRemove }: { label: string; onRemove: () => void }) {
  const [confirming, setConfirming] = useState(false)

  if (confirming) {
    return (
      <div className="flex items-center gap-2 px-5 py-3 shrink-0 border-t border-white/5">
        <span className="text-[11px] text-gray-400 flex-1">Remove {label}?</span>
        <button
          onClick={onRemove}
          className="px-3 py-1.5 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[11px] font-bold cursor-pointer transition-colors outline-none"
        >
          Remove
        </button>
        <button
          onClick={() => setConfirming(false)}
          className="px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[11px] cursor-pointer transition-colors outline-none"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="px-5 py-3 shrink-0 border-t border-white/5">
      <button
        onClick={() => setConfirming(true)}
        className="w-full flex items-center justify-center gap-2 py-2 rounded-xl text-[11px] font-semibold text-rose-400/60 hover:text-rose-400 hover:bg-rose-400/5 border border-rose-500/10 hover:border-rose-500/20 transition-all outline-none"
      >
        <Trash size={12} />
        Remove {label}
      </button>
    </div>
  )
}
