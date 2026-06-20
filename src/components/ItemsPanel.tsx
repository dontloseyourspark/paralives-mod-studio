// src/components/ItemsPanel.tsx
import React, { useRef, useState } from 'react'
import { Image, CaretDown, WarningCircle } from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import { getMeshNodes } from '../lib/itemTextureSlots'
import type { Item, ComponentNode } from '../types/types'

interface ItemsPanelProps {
  items: Item[]
  selectedItemId: string | null
  selectedNodeKey: string | null
  onSelectItem: (item: Item) => void
  onSelectNode: (node: ComponentNode) => void
  coverThumbnailUrl: string | null
  coverThumbnailWarning: boolean
  onCoverUpload: (file: File) => void
}

// ── Group items into parent/child structure ───────────────────────────────────
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

// ── Node accordion ────────────────────────────────────────────────────────────
interface NodeAccordionProps {
  item: Item
  selectedNodeKey: string | null
  onSelectNode: (node: ComponentNode) => void
}

function NodeAccordion({ item, selectedNodeKey, onSelectNode }: NodeAccordionProps) {
  const [open, setOpen] = useState(true)
  const meshNodes = getMeshNodes(item.components || [])
  if (meshNodes.length === 0) return null

  const root = meshNodes.find(n => n.childIndex === undefined) ?? meshNodes[0]
  const children = meshNodes.filter(n => n !== root)
  const rootKey = `${root.id}_${root.type}`

  return (
    <div className="mt-1 ml-3 border-l border-white/8 pl-2 flex flex-col gap-0.5">
      <div className="flex items-center gap-1">
        <button
          onClick={() => onSelectNode(root)}
          className={`flex-1 flex items-center gap-2 px-2.5 py-1.5 rounded-lg text-left transition-all ${
            selectedNodeKey === rootKey
              ? 'bg-[#8b5cf6]/15 text-white'
              : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
          }`}
        >
          <div className="w-1.5 h-1.5 rounded-full bg-blue-400 shrink-0" />
          <span className="text-[11px] font-semibold">Root</span>
          {children.length > 0 && (
            <span className="text-[9px] text-emerald-400/70 font-medium ml-auto">
              • {children.length} {children.length === 1 ? 'child' : 'children'}
            </span>
          )}
        </button>
        {children.length > 0 && (
          <button
            onClick={() => setOpen(o => !o)}
            className="p-1 text-gray-600 hover:text-gray-300 transition-colors rounded"
          >
            <CaretDown
              size={9}
              weight="bold"
              className={`transition-transform duration-150 ${open ? 'rotate-0' : '-rotate-90'}`}
            />
          </button>
        )}
      </div>

      {open && children.map((child) => {
        const childKey = `${child.id}_${child.type}`
        const label = child.childIndex !== undefined ? `Child ${child.childIndex}` : 'Child'
        return (
          <button
            key={childKey}
            onClick={() => onSelectNode(child)}
            className={`flex items-center gap-2 px-2.5 py-1.5 rounded-lg ml-2 text-left transition-all ${
              selectedNodeKey === childKey
                ? 'bg-[#8b5cf6]/15 text-white'
                : 'text-gray-500 hover:text-gray-300 hover:bg-white/3'
            }`}
          >
            <div className="w-1 h-1 rounded-full bg-orange-400 shrink-0" />
            <span className="text-[11px] font-semibold">{label}</span>
          </button>
        )
      })}
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
}

function ItemRow({ item, isSelected, isChild = false, selectedNodeKey, onSelect, onSelectNode }: ItemRowProps) {
  const getBlobUrlFromCache = useModStore((state) => state.getBlobUrlFromCache)
  const liveThumbnailUrl = getBlobUrlFromCache(item.thumbnailKey ?? null)

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
            <img
              src={liveThumbnailUrl}
              alt={item.name}
              className="w-full h-full object-contain p-1 transform group-hover:scale-105 transition-transform duration-150"
            />
          ) : (
            <span className="text-[10px] font-bold text-gray-600 uppercase font-mono">
              {(item.name || 'UN').substring(0, 2)}
            </span>
          )}
        </div>

        <div className="flex flex-col min-w-0">
          <span className={`font-medium truncate ${isChild ? 'text-[11px]' : 'text-xs'} ${
            isSelected ? 'text-white' : 'text-gray-300 group-hover:text-white'
          }`}>
            {item.name || 'Untitled Object'}
          </span>
          <span className="text-[10px] text-gray-500 font-mono mt-0.5">${item.price ?? 0}</span>
        </div>
      </div>

      {isSelected && (
        <NodeAccordion
          item={item}
          selectedNodeKey={selectedNodeKey}
          onSelectNode={onSelectNode}
        />
      )}
    </div>
  )
}

// ── Variant accordion group ───────────────────────────────────────────────────
interface AccordionGroupProps {
  group: ItemGroup
  selectedItemId: string | null
  selectedNodeKey: string | null
  onSelect: (item: Item) => void
  onSelectNode: (node: ComponentNode) => void
}

function AccordionGroup({ group, selectedItemId, selectedNodeKey, onSelect, onSelectNode }: AccordionGroupProps) {
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
          />
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); setOpen(o => !o) }}
          className="shrink-0 p-1.5 text-gray-600 hover:text-gray-300 transition-colors rounded-lg hover:bg-white/5"
          title={open ? 'Collapse variants' : 'Expand variants'}
        >
          <CaretDown
            size={10}
            weight="bold"
            className={`transition-transform duration-200 ${open ? 'rotate-0' : '-rotate-90'}`}
          />
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

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onCoverUpload(file)
          e.target.value = ''
        }}
      />

      {/* Cover drop zone */}
      <div
        onClick={() => fileInputRef.current?.click()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        title={
          coverThumbnailWarning
            ? 'Thumbnail should be exactly 1020×1020 px — click to replace'
            : coverThumbnailUrl
              ? 'Replace mod cover thumbnail'
              : 'Upload mod cover thumbnail (1020×1020 PNG recommended)'
        }
        className="w-full h-32 shrink-0 relative overflow-visible cursor-pointer group border-b border-white/5"
      >
        {/* Clip inner content separately so the badge can escape */}
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
              <Image size={20} weight="light" className={`transition-colors ${dragging ? 'text-[#a78bfa]' : 'text-gray-500 group-hover:text-gray-400'}`} />
              <span className={`text-[10px] font-medium text-center leading-tight px-3 transition-colors ${dragging ? 'text-[#a78bfa]' : 'text-gray-500 group-hover:text-gray-400'}`}>
                {dragging ? 'Drop to set cover' : 'Click or drop\nto add cover'}
              </span>
            </div>
          )}
        </div>

        {/* Warning badge — escapes the clip */}
        {coverThumbnailWarning && (
          <span className="absolute top-1.5 right-1.5 z-10 pointer-events-none">
            <WarningCircle size={16} weight="fill" className="text-amber-400 drop-shadow-sm" />
          </span>
        )}
      </div>

      <div className="p-4 border-b border-white/5 shrink-0">
        <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400 m-0">Mod Assets</h3>
      </div>

      <div className="flex-1 overflow-y-auto p-2 flex flex-col gap-1 min-h-0 pb-16">
        {groups.length === 0 && standalones.length === 0 ? (
          <div className="text-xs text-gray-600 text-center py-8 italic">
            No items inside package manifest
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
              />
            ))}
          </>
        )}
      </div>
    </div>
  )
}