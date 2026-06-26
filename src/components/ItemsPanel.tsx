// src/components/ItemsPanel.tsx
import React, { useMemo, useRef, useState } from 'react'
import { Image, CaretDown, WarningCircle, Plus, X } from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import { getMeshNodes } from '../lib/itemTextureSlots'
import { validateItem, type ItemValidationResult } from '../lib/itemValidation'
import type { Item, ComponentNode } from '../types/types'

interface ItemsPanelProps {
  items: Item[]
  selectedItemId: string | null
  selectedNodeKey: string | null
  onSelectItem: (item: Item) => void
  onSelectNode: (node: ComponentNode) => void
  onAddItem: () => void
  onDeselectItem: () => void
  onAddChildNode: (item: Item) => void
  onRemoveChildNode: (item: Item, nodeGuid: string) => void
  coverThumbnailUrl: string | null
  coverThumbnailWarning: boolean
  onCoverUpload: (file: File) => void
}

// ── Status ring (validation/export-readiness) ─────────────────────────────────
function StatusRing({ result }: { result: ItemValidationResult }) {
  const colorClass = result.status === 'error'
    ? 'border-rose-400'
    : result.status === 'warning'
      ? 'border-amber-400'
      : 'border-emerald-400'
  const title = result.issues.length > 0 ? result.issues.join('\n') : 'Ready to export'
  return <div title={title} className={`w-2.5 h-2.5 rounded-full border-2 shrink-0 ${colorClass}`} />
}

// ── Node accordion (inline — shown when item is selected) ─────────────────────
interface NodeAccordionProps {
  item: Item
  selectedNodeKey: string | null
  onSelectNode: (node: ComponentNode) => void
  onAddChildNode: (item: Item) => void
  onRemoveChildNode: (item: Item, nodeGuid: string) => void
}

// ── Child node row with two-step removal confirm ─────────────────────────────
interface ChildNodeRowProps {
  item: Item
  child: ComponentNode
  selectedNodeKey: string | null
  onSelectNode: (node: ComponentNode) => void
  onRemoveChildNode: (item: Item, nodeGuid: string) => void
}

function ChildNodeRow({ item, child, selectedNodeKey, onSelectNode, onRemoveChildNode }: ChildNodeRowProps) {
  const [confirming, setConfirming] = useState(false)
  const childKey = `${child.id}_${child.type}`
  const label = child.childIndex !== undefined ? `Child ${child.childIndex + 1}` : 'Child'

  if (confirming) {
    return (
      <div className="flex items-center gap-1 pl-4 pr-1">
        <span className="text-[10px] text-gray-400 flex-1 px-1">Remove {label}?</span>
        <button
          onClick={(e) => { e.stopPropagation(); onRemoveChildNode(item, child.id) }}
          className="px-2 py-1 bg-rose-600/80 hover:bg-rose-600 text-white rounded-lg text-[10px] font-bold transition-colors outline-none"
        >
          Remove
        </button>
        <button
          onClick={(e) => { e.stopPropagation(); setConfirming(false) }}
          className="px-2 py-1 bg-white/5 hover:bg-white/10 text-gray-400 rounded-lg text-[10px] transition-colors outline-none"
        >
          Cancel
        </button>
      </div>
    )
  }

  return (
    <div className="flex items-center gap-1 pl-4">
      <button
        onClick={() => onSelectNode(child)}
        className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
          selectedNodeKey === childKey
            ? 'bg-[#8b5cf6]/15 text-white'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
        }`}
      >
        <div className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
        <span className="text-[11px] font-semibold">{label}</span>
      </button>
      <button
        onClick={(e) => { e.stopPropagation(); setConfirming(true) }}
        title="Remove child node"
        className="shrink-0 p-1 text-gray-700 hover:text-rose-400 hover:bg-rose-400/10 rounded-lg transition-colors outline-none"
      >
        <X size={10} weight="bold" />
      </button>
    </div>
  )
}

function NodeAccordion({ item, selectedNodeKey, onSelectNode, onAddChildNode, onRemoveChildNode }: NodeAccordionProps) {
  const meshNodes = getMeshNodes(item.components || [])
  if (meshNodes.length === 0) return null

  const root = meshNodes.find(n => n.childIndex === undefined) ?? meshNodes[0]
  const children = meshNodes.filter(n => n !== root)
  const rootKey = `${root.id}_${root.type}`

  return (
    <div className="mt-1 mb-1 mx-2 flex flex-col gap-0.5">
      {/* Root row */}
      <button
        onClick={() => onSelectNode(root)}
        className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all w-full ${
          selectedNodeKey === rootKey
            ? 'bg-[#8b5cf6]/15 text-white'
            : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
        }`}
      >
        <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
        <span className="text-[11px] font-semibold flex-1">Root</span>
        {children.length > 0 && (
          <span className="text-[9px] text-emerald-400/70 font-medium">
            • {children.length} {children.length === 1 ? 'child' : 'children'}
          </span>
        )}
      </button>

      {/* Child rows */}
      {children.map((child) => (
        <ChildNodeRow
          key={`${child.id}_${child.type}`}
          item={item}
          child={child}
          selectedNodeKey={selectedNodeKey}
          onSelectNode={onSelectNode}
          onRemoveChildNode={onRemoveChildNode}
        />
      ))}

      {/* Add child node */}
      <button
        onClick={() => onAddChildNode(item)}
        className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-left transition-all text-gray-600 hover:text-[#8b5cf6] hover:bg-[#8b5cf6]/5 w-full mt-0.5"
      >
        <Plus size={10} weight="bold" />
        <span className="text-[10px] font-semibold">Add child node</span>
      </button>
    </div>
  )
}

// ── Single item row ───────────────────────────────────────────────────────────
interface ItemRowProps {
  item: Item
  isSelected: boolean
  isChild?: boolean
  selectedNodeKey: string | null
  onSelect: (item: Item) => void
  onSelectNode: (node: ComponentNode) => void
  onDeselectItem: () => void
  onAddChildNode: (item: Item) => void
  onRemoveChildNode: (item: Item, nodeGuid: string) => void
}

function ItemRow({
  item,
  isSelected,
  isChild = false,
  selectedNodeKey,
  onSelect,
  onSelectNode,
  onDeselectItem,
  onAddChildNode,
  onRemoveChildNode,
}: ItemRowProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)
  const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)
  const validation = useMemo(() => validateItem(item), [item])
  const [accordionOpen, setAccordionOpen] = useState(true)
  const hasMeshNodes = getMeshNodes(item.components || []).length > 0

  return (
    <div className="flex flex-col">
      <div
        onClick={() => onSelect(item)}
        className={`flex items-center gap-3 rounded-xl transition-all duration-150 cursor-pointer group border ${
          isChild ? 'p-2 ml-3' : 'p-2.5'
        } ${
          isSelected
            ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/30 text-white'
            : 'bg-transparent border-transparent text-gray-400 hover:bg-white/2 hover:text-gray-200'
        }`}
      >
        {isChild && <div className="w-3 h-px bg-white/10 shrink-0" />}

        <div className={`shrink-0 bg-[#0e1017] border border-white/5 rounded-lg overflow-hidden flex items-center justify-center shadow-inner ${
          isChild ? 'w-7 h-7' : 'w-9 h-9'
        }`}>
          {liveThumbnailUrl ? (
            <img src={liveThumbnailUrl} alt={item.name}
              className="w-full h-full object-contain p-1 transform group-hover:scale-105 transition-transform duration-150" />
          ) : (
            <span className="text-[10px] font-bold text-gray-600 uppercase font-mono">
              {(item.name || 'UN').substring(0, 2)}
            </span>
          )}
        </div>

        <div className="flex flex-col min-w-0 flex-1">
          <span className={`font-medium truncate ${isChild ? 'text-[11px]' : 'text-xs'} ${
            isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'
          }`}>
            {item.name || 'Untitled Object'}
          </span>
          <span className="text-[10px] text-gray-500 font-mono mt-0.5">${item.price ?? 0}</span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          <StatusRing result={validation} />
          {isSelected && (
            <>
              <button
                onClick={(e) => { e.stopPropagation(); onDeselectItem() }}
                title="Deselect"
                className="shrink-0 p-1 text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors outline-none"
              >
                <X size={10} weight="bold" />
              </button>
              {hasMeshNodes && (
                <button
                  onClick={(e) => { e.stopPropagation(); setAccordionOpen(o => !o) }}
                  title={accordionOpen ? 'Collapse nodes' : 'Expand nodes'}
                  className="shrink-0 p-1 text-gray-600 hover:text-gray-300 hover:bg-white/5 rounded-lg transition-colors outline-none"
                >
                  <CaretDown size={10} weight="bold"
                    className={`transition-transform duration-200 ${accordionOpen ? 'rotate-0' : '-rotate-90'}`} />
                </button>
              )}
            </>
          )}
        </div>
      </div>

      {/* Node accordion — only when selected and not collapsed */}
      {isSelected && accordionOpen && (
        <NodeAccordion
          item={item}
          selectedNodeKey={selectedNodeKey}
          onSelectNode={onSelectNode}
          onAddChildNode={onAddChildNode}
          onRemoveChildNode={onRemoveChildNode}
        />
      )}
    </div>
  )
}

// ── Variant group (items with variant siblings) ───────────────────────────────
interface ItemGroup {
  parent: Item
  children: Item[]
}

function buildItemGroups(items: Item[]): { groups: ItemGroup[], standalones: Item[] } {
  const visibleItems = items.filter(item => item.components && item.components.length > 0)
  const childGuidSet = new Set<string>()

  for (const item of visibleItems) {
    if (item.variantGuids && item.variantGuids.length > 1) {
      for (const vGuid of item.variantGuids) {
        if (vGuid !== item.guid) childGuidSet.add(vGuid)
      }
    }
  }

  const groups: ItemGroup[] = []
  const standalones: Item[] = []
  const byGuid = new Map(visibleItems.map(i => [i.guid, i]))

  for (const item of visibleItems) {
    if (childGuidSet.has(item.guid)) continue
    if (item.variantGuids && item.variantGuids.length > 1) {
      const children = item.variantGuids
        .filter(g => g !== item.guid)
        .map(g => byGuid.get(g))
        .filter((i): i is Item => i !== undefined)
      groups.push({ parent: item, children })
    } else {
      standalones.push(item)
    }
  }

  return { groups, standalones }
}

interface AccordionGroupProps {
  group: ItemGroup
  selectedItemId: string | null
  selectedNodeKey: string | null
  onSelect: (item: Item) => void
  onSelectNode: (node: ComponentNode) => void
  onDeselectItem: () => void
  onAddChildNode: (item: Item) => void
  onRemoveChildNode: (item: Item, nodeGuid: string) => void
}

function AccordionGroup({
  group, selectedItemId, selectedNodeKey,
  onSelect, onSelectNode, onDeselectItem, onAddChildNode, onRemoveChildNode,
}: AccordionGroupProps) {
  const anySelected = selectedItemId === group.parent.id ||
    group.children.some(c => c.id === selectedItemId)
  const [open, setOpen] = useState(anySelected)

  return (
    <div className="flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <div className="flex-1 min-w-0">
          <ItemRow
            item={group.parent}
            isSelected={selectedItemId === group.parent.id}
            selectedNodeKey={selectedNodeKey}
            onSelect={onSelect}
            onSelectNode={onSelectNode}
            onDeselectItem={onDeselectItem}
            onAddChildNode={onAddChildNode}
            onRemoveChildNode={onRemoveChildNode}
          />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
          className="shrink-0 p-1.5 text-gray-600 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
          title={open ? 'Collapse variants' : 'Expand variants'}
        >
          <CaretDown size={10} weight="bold"
            className={`transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`} />
        </button>
      </div>

      {open && group.children.length > 0 && (
        <div className="flex flex-col gap-0.5 pl-1 border-l border-white/5 ml-3">
          {group.children.map(child => (
            <ItemRow
              key={child.id}
              item={child}
              isSelected={selectedItemId === child.id}
              isChild
              selectedNodeKey={selectedNodeKey}
              onSelect={onSelect}
              onSelectNode={onSelectNode}
              onDeselectItem={onDeselectItem}
              onAddChildNode={onAddChildNode}
              onRemoveChildNode={onRemoveChildNode}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Main panel ────────────────────────────────────────────────────────────────
export default function ItemsPanel({
  items,
  selectedItemId,
  selectedNodeKey,
  onSelectItem,
  onSelectNode,
  onAddItem,
  onDeselectItem,
  onAddChildNode,
  onRemoveChildNode,
  coverThumbnailUrl,
  coverThumbnailWarning,
  onCoverUpload,
}: ItemsPanelProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const file = e.dataTransfer.files[0]
    if (file && file.type.startsWith('image/')) onCoverUpload(file)
  }

  const { groups, standalones } = buildItemGroups(items || [])

  return (
    <div className="w-64 h-full bg-[#161923] border-r border-white/5 flex flex-col select-none box-border">

      <input ref={fileInputRef} type="file" accept="image/*" className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) onCoverUpload(f); e.target.value = '' }} />

      {/* Cover drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        title={coverThumbnailWarning
          ? 'Thumbnail should be exactly 1020×1020 px — click to replace'
          : coverThumbnailUrl ? 'Replace mod cover thumbnail' : 'Upload mod cover thumbnail'}
        className="w-full h-32 shrink-0 relative overflow-visible cursor-pointer group border-b border-white/5"
      >
        <div className="absolute inset-0 overflow-hidden">
          {coverThumbnailUrl ? (
            <>
              <img src={coverThumbnailUrl} alt="Mod cover" className="w-full h-full object-cover" />
              <div className={`absolute inset-0 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center gap-1.5 transition-opacity ${
                coverThumbnailWarning ? 'bg-amber-900/60' : 'bg-black/60'
              }`}>
                <Image size={16} className="text-white" weight="light" />
                <span className="text-white text-[10px] font-semibold tracking-wide">
                  {coverThumbnailWarning ? 'Fix Size (1020×1020)' : 'Change Cover'}
                </span>
              </div>
            </>
          ) : (
            <div className={`absolute inset-2 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition-all ${
              dragging ? 'border-[#8b5cf6]/60 bg-[#8b5cf6]/5' : 'border-white/10 group-hover:border-white/20'
            }`}>
              <Image size={20} weight="light" className={dragging ? 'text-[#a78bfa]' : 'text-gray-500 group-hover:text-gray-400'} />
              <span className={`text-[10px] font-medium text-center leading-tight px-3 ${
                dragging ? 'text-[#a78bfa]' : 'text-gray-500 group-hover:text-gray-400'
              }`}>
                {dragging ? 'Drop to set cover' : 'Click or drop\nto add cover'}
              </span>
            </div>
          )}
        </div>
        {coverThumbnailWarning && (
          <span className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
            <WarningCircle size={16} weight="fill" className="text-amber-400 drop-shadow-sm" />
          </span>
        )}
      </div>

      {/* Header with + button */}
      <div className="px-4 py-3 border-b border-white/5 shrink-0 flex items-center justify-between">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Mod Assets</h3>
        <button
          onClick={onAddItem}
          title="Add item"
          className="w-6 h-6 flex items-center justify-center rounded-lg bg-white/5 hover:bg-[#8b5cf6]/20 text-gray-400 hover:text-[#a78bfa] transition-colors outline-none"
        >
          <Plus size={12} weight="bold" />
        </button>
      </div>

      {/* Item list */}
      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0">
        {groups.length === 0 && standalones.length === 0 ? (
          <div className="text-xs text-gray-600 text-center py-8 italic">
            No items — click + to add
          </div>
        ) : (
          <>
            {groups.map(group => (
              <AccordionGroup
                key={group.parent.id}
                group={group}
                selectedItemId={selectedItemId}
                selectedNodeKey={selectedNodeKey}
                onSelect={onSelectItem}
                onSelectNode={onSelectNode}
                onDeselectItem={onDeselectItem}
                onAddChildNode={onAddChildNode}
                onRemoveChildNode={onRemoveChildNode}
              />
            ))}
            {standalones.map(item => (
              <ItemRow
                key={item.id}
                item={item}
                isSelected={item.id === selectedItemId}
                selectedNodeKey={selectedNodeKey}
                onSelect={onSelectItem}
                onSelectNode={onSelectNode}
                onDeselectItem={onDeselectItem}
                onAddChildNode={onAddChildNode}
                onRemoveChildNode={onRemoveChildNode}
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}
