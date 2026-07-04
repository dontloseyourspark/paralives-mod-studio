// src/components/CreateModWizard.tsx
import { useState, useRef, useCallback, useEffect } from 'react'
import {
  X, Armchair, ArrowRight, Check, CloudArrowUp,
  Sliders, File, PaintBucket, Translate
} from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import { assetDb } from '../utils/assetDb'
import { itemTextureCacheKey, ITEM_MESH_TEXTURE_SLOTS } from '../lib/itemTextureSlots'
import { makeDefaultComponents, makeTextureGuidMap } from '../lib/defaultComponents'
import type { Item } from '../types/types'

// ─── Types ────────────────────────────────────────────────────────────────────

type ModType = 'wall_paint' | 'furniture' | 'translation'
//type ModType = 'translation'

interface WizardState {
  modType: ModType | null
  modName: string
  language: string
  meshFile: File | null
  textureFiles: File[]
}

export interface TranslationWizardPayload {
  isTranslation: true
  language: string
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onAdvancedEditing?: (partial: Partial<Item> | TranslationWizardPayload) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOD_TYPES = [
  {
    id: 'furniture' as ModType,
    label: 'Furniture Item',
    description: 'Design a new piece of furniture for players to place in their builds.',
    tags: ['Object', 'Placeable', 'Build Mode'],
    icon: Armchair,
    comingSoon: false,
  },
  {
    id: 'translation' as ModType,
    label: 'Translation',
    description: 'Translate the game or a mod into a different language.',
    tags: ['Language', 'Text', 'Localization'],
    icon: Translate,
    comingSoon: false,
  },
  {
    // Surface mods aren't wired into the workspace yet (see CLAUDE.md roadmap) —
    // shown disabled so newcomers aren't funneled into an item project by mistake.
    id: 'wall_paint' as ModType,
    label: 'Wall Paint',
    description: 'Create a custom paint or wallpaper pattern for walls and surfaces.',
    tags: ['Decoration', 'Color', 'Texture'],
    icon: PaintBucket,
    comingSoon: true,
  },
]

const STEPS = ['Mod type', 'Details', 'Preview']

// ─── Sub-components ───────────────────────────────────────────────────────────

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center justify-center gap-0 select-none">
      {STEPS.map((label, i) => {
        const done    = i < current
        const active  = i === current
        const isLast  = i === STEPS.length - 1

        return (
          <div key={label} className="flex items-center">
            <div className="flex flex-col items-center gap-1.5">
              <div className={`
                w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold
                transition-all duration-300
                ${done   ? 'bg-[#8b5cf6] text-white'                          : ''}
                ${active ? 'bg-[#8b5cf6] text-white ring-4 ring-[#8b5cf6]/20' : ''}
                ${!done && !active ? 'bg-white/6 text-gray-500 border border-white/8' : ''}
              `}>
                {done ? <Check size={15} weight="bold" /> : i + 1}
              </div>
              <span className={`text-[11px] font-medium tracking-wide transition-colors duration-200 ${active ? 'text-white' : done ? 'text-[#8b5cf6]' : 'text-gray-600'}`}>
                {label}
              </span>
            </div>

            {!isLast && (
              <div className={`w-20 h-px mb-5 mx-1 transition-colors duration-300 ${done ? 'bg-[#8b5cf6]' : 'bg-white/8'}`} />
            )}
          </div>
        )
      })}
    </div>
  )
}

function DropZone({
  label,
  hint,
  accept,
  multiple = false,
  files,
  icon: Icon,
  onFiles,
}: {
  label: string
  hint: string
  accept: string
  multiple?: boolean
  files: File[]
  icon: React.ElementType
  onFiles: (files: File[]) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const dropped = Array.from(e.dataTransfer.files)
    onFiles(multiple ? dropped : [dropped[0]])
  }, [multiple, onFiles])

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? [])
    onFiles(multiple ? picked : [picked[0]])
  }

  const hasFiles = files.length > 0

  return (
    <div className="flex flex-col gap-2">
      <label className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</label>
      <div
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`
          relative rounded-2xl border-2 border-dashed cursor-pointer transition-all duration-200
          ${dragging
            ? 'border-[#8b5cf6] bg-[#8b5cf6]/8 scale-[1.01]'
            : hasFiles
              ? 'border-[#8b5cf6]/40 bg-[#8b5cf6]/4 hover:border-[#8b5cf6]/60'
              : 'border-white/8 bg-white/2 hover:border-white/15 hover:bg-white/3'
          }
        `}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          multiple={multiple}
          className="hidden"
          onChange={handleChange}
        />

        <div className="flex flex-col items-center justify-center gap-2 py-8 px-4">
          {hasFiles ? (
            <>
              <div className="flex flex-wrap gap-1.5 justify-center max-w-xs">
                {files.map((f) => (
                  <span key={f.name} className="flex items-center gap-1 px-2 py-1 bg-[#8b5cf6]/15 text-[#a78bfa] text-[11px] rounded-lg border border-[#8b5cf6]/20 font-medium">
                    <File size={10} />
                    {f.name}
                  </span>
                ))}
              </div>
              <span className="text-[11px] text-gray-500 mt-1">Click to replace</span>
            </>
          ) : (
            <>
              <Icon size={28} className="text-[#8b5cf6]/60" weight="light" />
              <span className="text-sm text-gray-400 text-center">{hint}</span>
              <span className="text-[11px] text-gray-600">or click to browse</span>
            </>
          )}
        </div>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export default function CreateModWizard({ isOpen, onClose, onAdvancedEditing }: Props) {
  const registerFileInCache = useModStore((s) => s.registerFileInCache)

  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    modType: null,
    modName: '',
    language: '',
    meshFile: null,
    textureFiles: [],
  })

  // Declared before the early return so the Escape-key effect (which must also
  // run before it, per the rules of hooks) can reference it.
  const handleClose = useCallback(() => {
    setStep(0)
    setState({ modType: null, modName: '', language: '', meshFile: null, textureFiles: [] })
    onClose()
  }, [onClose])

  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') handleClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [isOpen, handleClose])

  if (!isOpen) return null

  // ── Navigation ─────────────────────────────────────────────────────────────

  const canAdvance = step === 0
    ? state.modType !== null
    : step === 1
      ? state.modType === 'translation'
          ? state.language.trim().length > 0
          : state.modName.trim().length > 0
      : true

  const goNext = () => { if (canAdvance && step < 2) setStep((s) => s + 1) }
  const goBack = () => { if (step > 0) setStep((s) => s - 1) }

  // ── Build item from wizard state ───────────────────────────────────────────
  //
  // Async because we need to persist the FBX and textures to assetDb before
  // handing the item off to the store. The FBX is stored via saveFileRaw under
  // mesh_{assetGuid}; textures are stored under item_tex_{itemGuid}_{slot}
  // with the first texture → DetailMap, second → ColorZoneMap, etc.
  // The user can reassign slots in the Textures tab afterwards.

  const buildItem = async (): Promise<Partial<Item>> => {
    const itemId   = crypto.randomUUID()
    // item.guid is a stable 19-digit numeric string — derive from UUID digits
    const itemGuid = itemId.replace(/-/g, '').replace(/[a-f]/g, (c) =>
      String(c.charCodeAt(0) - 87)).replace(/[^0-9]/g, '1').substring(0, 19).padEnd(19, '0')
    const meshKeys: Record<string, string> = {}

    // Store FBX — generate a stable numeric-style GUID from a UUID
    let fbxAssetGuid: string | null = null
    if (state.meshFile) {
      fbxAssetGuid = crypto.randomUUID()
        .replace(/-/g, '')
        .replace(/[a-f]/g, (c) => String(c.charCodeAt(0) - 87))
        .replace(/[^0-9]/g, '1')
        .substring(0, 19)
        .padEnd(19, '0')
      const cacheKey = `mesh_${fbxAssetGuid}`
      await assetDb.saveFileRaw(cacheKey, state.meshFile)
      meshKeys[fbxAssetGuid] = cacheKey
    }

    // Store textures under item_tex_{itemGuid}_{slot} — first file → DetailMap, etc.
    // Track the asset GUID for each slot so makeDefaultComponents can bind them.
    const textureAssetGuids: string[] = []
    for (let i = 0; i < state.textureFiles.length; i++) {
      const slot = ITEM_MESH_TEXTURE_SLOTS[i]
      if (!slot) break
      // Generate a stable numeric asset GUID for this texture
      const texAssetGuid = crypto.randomUUID()
        .replace(/-/g, '')
        .replace(/[a-f]/g, (c) => String(c.charCodeAt(0) - 87))
        .replace(/[^0-9]/g, '1')
        .substring(0, 19)
        .padEnd(19, '0')
      textureAssetGuids.push(texAssetGuid)
      const cacheKey = itemTextureCacheKey(itemGuid, slot)
      await assetDb.saveFileRaw(cacheKey, state.textureFiles[i])
      // Also register in the in-memory cache so the Textures tab preview works immediately
      await registerFileInCache(cacheKey, state.textureFiles[i])
    }

    // Build the prefab component scaffold so the node accordion and viewport work immediately
    const textureGuidMap = makeTextureGuidMap(textureAssetGuids)
    const components = makeDefaultComponents(itemGuid, fbxAssetGuid, textureGuidMap)

    // Stable prefab GUID — same derivation as getPrefabGuid in itemModExporter
    const prefabGuid = itemGuid.substring(0, 18) + '1'

    return {
      id:   itemId,
      guid: itemGuid,
      name: state.modName.trim() || 'New Mod Item',
      description: state.modType === 'wall_paint'
        ? 'Custom wall paint or wallpaper pattern.'
        : 'Custom placeable furniture item.',
      price: 0,
      tags: [],
      thumbnailKey: null,
      prefabGuid,
      meshKeys,
      textureKeys: {},  // legacy field — textures now live in assetDb under item_tex_ keys
      componentBlueprints: { rootDefaultStates: [], materialSurfaces: [] },
      components,
    }
  }

  // ── Finish actions ─────────────────────────────────────────────────────────
  //
  // There used to be a "Download mod" button here that saved the raw internal
  // item JSON as `{name}.mod.json` — NOT a game-loadable mod. New modders would
  // drop it in their mods folder and conclude the tool was broken. The only real
  // export is the workspace's Export Mod (itemModExporter), so the wizard now
  // funnels everyone into the editor instead.

  const handleAdvancedEditing = async () => {
    if (state.modType === 'translation') {
      // Pass a special payload so the parent (Dashboard) can create the project & navigate
      onAdvancedEditing?.({
        isTranslation: true,
        language: state.language.trim()
      })
      handleClose()
      return
    }

    const partial = await buildItem()
    onAdvancedEditing?.(partial)
    handleClose()
  }

  /* const handleSkipToAdvanced = () => {
    onAdvancedEditing?.({
      id:   crypto.randomUUID(),
      guid: crypto.randomUUID(),
      name: 'New Mod Item',
      description: '',
      price: 0,
      tags: [],
      thumbnailKey: null,
      textureKeys: {},
      componentBlueprints: { rootDefaultStates: [], materialSurfaces: [] },
      components: [],
    })
    handleClose()
  } */

  // ── Step renderers ─────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white m-0">What kind of mod?</h2>
        <p className="text-sm text-gray-500 mt-2 m-0">Choose the type of content you want to create.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
        {MOD_TYPES.map(({ id, label, description, tags, icon: Icon, comingSoon }) => {
          const selected = state.modType === id
          return (
            <button
              key={id}
              onClick={() => { if (!comingSoon) setState((s) => ({ ...s, modType: id })) }}
              disabled={comingSoon}
              className={`
                text-left p-5 rounded-2xl border-2 transition-all duration-200 outline-none
                ${comingSoon
                  ? 'border-white/4 bg-white/1 opacity-50 cursor-not-allowed'
                  : selected
                    ? 'border-[#8b5cf6] bg-[#8b5cf6]/8 shadow-lg shadow-[#8b5cf6]/10 cursor-pointer'
                    : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4 cursor-pointer'
                }
              `}
            >
              <div className="flex items-start justify-between">
                <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${selected ? 'bg-[#8b5cf6]/20' : 'bg-white/5'}`}>
                  <Icon size={20} weight="light" className={selected ? 'text-[#a78bfa]' : 'text-gray-400'} />
                </div>
                {comingSoon && (
                  <span className="text-[10px] px-2 py-0.5 rounded-full border border-amber-500/30 text-amber-400/80 bg-amber-500/10 font-medium">
                    Coming soon
                  </span>
                )}
              </div>
              <div className={`text-sm font-bold mb-1 transition-colors ${selected ? 'text-white' : 'text-gray-200'}`}>{label}</div>
              <div className="text-[12px] text-gray-500 leading-relaxed mb-3">{description}</div>
              <div className="flex flex-wrap gap-1.5">
                {tags.map((tag) => (
                  <span key={tag} className={`text-[10px] px-2 py-0.5 rounded-full border font-medium transition-colors ${selected ? 'border-[#8b5cf6]/30 text-[#a78bfa] bg-[#8b5cf6]/10' : 'border-white/8 text-gray-500'}`}>
                    {tag}
                  </span>
                ))}
              </div>
            </button>
          )
        })}
      </div>

      {/* <div className="text-center">
        <button
          onClick={handleSkipToAdvanced}
          className="text-xs text-gray-500 hover:text-[#a78bfa] transition-colors underline underline-offset-2 cursor-pointer bg-transparent border-none outline-none"
        >
          Skip to advanced editing →
        </button>
      </div> */}
    </div>
  )

  const renderStep1 = () => {
    if (state.modType === 'translation') {
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white m-0">Language Details</h2>
            <p className="text-sm text-gray-500 mt-2 m-0">What language are you translating to?</p>
          </div>

          <div className="flex flex-col gap-5">
            <div className="flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
                Language Name <span className="text-[#8b5cf6]">*</span>
              </label>
              <input
                autoFocus
                type="text"
                value={state.language}
                onChange={(e) => setState((s) => ({ ...s, language: e.target.value }))}
                placeholder="e.g. German, Spanish, French"
                className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/4 transition-all duration-150"
              />
            </div>
          </div>
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white m-0">Upload assets</h2>
          <p className="text-sm text-gray-500 mt-2 m-0">Provide your 3D mesh and texture files.</p>
        </div>

        <div className="flex flex-col gap-5">
          <div className="flex flex-col gap-2">
            <label className="text-xs font-bold uppercase tracking-wider text-gray-400">
              Mod name <span className="text-[#8b5cf6]">*</span>
            </label>
            <input
              autoFocus
              type="text"
              value={state.modName}
              onChange={(e) => setState((s) => ({ ...s, modName: e.target.value }))}
              placeholder="e.g. Cozy Oak Chair"
              className="w-full bg-white/3 border border-white/8 rounded-xl px-4 py-3 text-sm text-white placeholder-gray-600 outline-none focus:border-[#8b5cf6]/50 focus:bg-[#8b5cf6]/4 transition-all duration-150"
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <DropZone
              label="3D Mesh"
              hint="Drop your .fbx file here"
              accept=".fbx"
              files={state.meshFile ? [state.meshFile] : []}
              icon={CloudArrowUp}
              onFiles={([f]) => setState((s) => ({ ...s, meshFile: f ?? null }))}
            />
            <p className="text-[11px] text-gray-600 leading-relaxed m-0 px-1">
              Paralives uses FBX meshes. Exporting from Blender? Use{' '}
              <span className="text-gray-400 font-medium">Forward: Z Forward</span> and{' '}
              <span className="text-gray-400 font-medium">Up: Y Up</span> in the FBX export settings.
              You can also add or replace the mesh later in the editor.
            </p>
          </div>

          <div className="flex flex-col gap-1.5">
            <DropZone
              label="Textures"
              hint="Drop texture images here (PNG recommended)"
              accept=".png,.jpg,.jpeg,.tga,.webp"
              multiple
              files={state.textureFiles}
              icon={CloudArrowUp}
              onFiles={(files) => setState((s) => ({ ...s, textureFiles: files }))}
            />
            <p className="text-[11px] text-gray-600 leading-relaxed m-0 px-1">
              The first image becomes the <span className="text-gray-400 font-medium">Detail Map</span>{' '}
              (your item's main texture); the second becomes the Color Zone Map. You can reassign
              slots later in the Textures tab.
            </p>
          </div>
        </div>
      </div>
    )
  }

  const renderStep2 = () => {
    const selectedType = MOD_TYPES.find((t) => t.id === state.modType)

    if (state.modType === 'translation') {
      return (
        <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white m-0">Preview &amp; export</h2>
            <p className="text-sm text-gray-500 mt-2 m-0">Review your translation mod before proceeding.</p>
          </div>

          <div className="w-full h-48 rounded-2xl border border-white/6 bg-white/2 flex flex-col items-center justify-center gap-2">
            <Translate size={28} className="text-[#8b5cf6]" weight="light" />
            <span className="text-xs text-gray-400">Translation to {state.language || 'Unknown Language'}</span>
          </div>

          <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
            {[
              ['Mod type', selectedType?.label ?? '—'],
              ['Language', state.language.trim() || '—'],
            ].map(([key, val], i, arr) => (
              <div
                key={key}
                className={`flex items-center justify-between px-4 py-3 text-sm ${i < arr.length - 1 ? 'border-b border-white/4' : ''}`}
              >
                <span className="text-gray-500 font-medium">{key}</span>
                <span className="text-gray-300 font-medium">{val}</span>
              </div>
            ))}
          </div>
          {/*  
          <div className="grid grid-cols-2 gap-3">
             <button
              onClick={handleDownload}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/14 text-sm font-semibold text-gray-300 hover:text-white cursor-pointer transition-all duration-150 outline-none"
            >
              <Download size={15} weight="bold" />
              Download template
            </button> 
            
          </div>*/}
        </div>
      )
    }

    return (
      <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white m-0">Ready to build</h2>
          <p className="text-sm text-gray-500 mt-2 m-0">Check the summary, then open your new item in the editor.</p>
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          {[
            ['Mod name', state.modName.trim() || '—'],
            ['Type', selectedType?.label ?? '—'],
            ['Mesh', state.meshFile?.name ?? 'None (add one in the editor)'],
            ['Textures', state.textureFiles.length > 0 ? `${state.textureFiles.length} file${state.textureFiles.length > 1 ? 's' : ''}` : 'None (add them in the editor)'],
          ].map(([key, val], i, arr) => (
            <div
              key={key}
              className={`flex items-center justify-between px-4 py-3 text-sm ${i < arr.length - 1 ? 'border-b border-white/4' : ''}`}
            >
              <span className="text-gray-500 font-medium">{key}</span>
              <span className="text-gray-300 font-medium">{val}</span>
            </div>
          ))}
        </div>

        <p className="text-[12px] text-gray-500 leading-relaxed m-0 text-center">
          Next you'll see your mesh in the 3D viewport, where you can preview textures, tweak
          properties, and export the finished <span className="text-gray-400 font-mono text-[11px]">.mod</span> when you're ready.
        </p>

        <button
          onClick={handleAdvancedEditing}
          className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-sm font-semibold text-white cursor-pointer transition-all duration-150 outline-none border-none shadow-lg shadow-[#8b5cf6]/20"
        >
          <Sliders size={15} weight="bold" />
          Open in Editor
        </button>
      </div>
    )
  }

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="w-full max-w-xl bg-[#0e1017] border border-white/6 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200">

        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5">
          <div className="flex items-center gap-3 text-sm text-gray-400">
            <span className="text-gray-500 font-medium">New Mod</span>
          </div>

          <button
            onClick={handleClose}
            className="p-1.5 rounded-lg hover:bg-white/6 text-gray-500 hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        <div className="px-6 pt-6 pb-2">
          <StepIndicator current={step} />
        </div>

        <div className="px-6 py-5 overflow-y-auto max-h-[70vh]">
          {step === 0 && renderStep0()}
          {step === 1 && renderStep1()}
          {step === 2 && renderStep2()}
        </div>

        <div className="flex justify-between px-6 pb-5 pt-2 border-t border-white/5">
           {step > 0 ? (
            <button
              onClick={goBack}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/14 text-sm font-semibold text-gray-300 hover:text-white cursor-pointer transition-all duration-150 outline-none"
            >
              Back
            </button>
          ) : (
            <button
              onClick={handleClose}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/14 text-sm font-semibold text-gray-300 hover:text-white cursor-pointer transition-all duration-150 outline-none"
            >
              Cancel
            </button>
          )}
          {step < 2 && (
          <button
            onClick={goNext}
            disabled={!canAdvance}
            className={`
              flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold cursor-pointer outline-none border-none transition-all duration-150
              ${canAdvance
                ? 'bg-[#8b5cf6] hover:bg-[#7c3aed] text-white shadow-md shadow-[#8b5cf6]/25'
                : 'bg-white/5 text-gray-600 cursor-not-allowed'
              }
            `}
          >
            Continue
            <ArrowRight size={14} weight="bold" />
          </button>
        )}
        {state.modType === 'translation' && step === 2 && (
        <button
              onClick={handleAdvancedEditing}
              className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-sm font-semibold text-white cursor-pointer transition-all duration-150 outline-none border-none shadow-lg shadow-[#8b5cf6]/20"
            >
              <Sliders size={15} weight="bold" />
              Edit translation
            </button>
        )}
        </div>
      </div>
    </div>
  )
}