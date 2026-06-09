// src/components/CreateModWizard.tsx
import { useState, useRef, useCallback } from 'react'
import {
  X, ArrowLeft, ArrowRight, Check,
  PaintBucket, Armchair, CloudArrowUp,
  Download, Sliders, Eye, File, Translate
} from 'phosphor-react'
import { useModStore } from '../store/useModStore'
import type { Item } from '../types/types'

// ─── Types ────────────────────────────────────────────────────────────────────

// type ModType = 'wall_paint' | 'furniture' | 'translation'
type ModType = 'translation'

interface WizardState {
  modType: ModType | null
  modName: string
  language: string
  meshFile: File | null
  textureFiles: File[]
}

interface Props {
  isOpen: boolean
  onClose: () => void
  onComplete?: (item: Item) => void
  onAdvancedEditing?: (partial: Partial<Item>) => void
}

// ─── Constants ────────────────────────────────────────────────────────────────

const MOD_TYPES = [
  /* {
    id: 'wall_paint' as ModType,
    label: 'Wall Paint',
    description: 'Create a custom paint or wallpaper pattern for walls and surfaces.',
    tags: ['Decoration', 'Color', 'Texture'],
    icon: PaintBucket,
  },
  {
    id: 'furniture' as ModType,
    label: 'Furniture Item',
    description: 'Design a new piece of furniture for players to place in their builds.',
    tags: ['Object', 'Placeable', 'Build Mode'],
    icon: Armchair,
  }, */
  {
    id: 'translation' as ModType,
    label: 'Translation',
    description: 'Translate the game or a mod into a different language.',
    tags: ['Language', 'Text', 'Localization'],
    icon: Translate,
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

export default function CreateModWizard({ isOpen, onClose, onComplete, onAdvancedEditing }: Props) {
  const currentProject = useModStore((s) => s.currentProject)
  const updateProject = useModStore((s) => s.updateProject)
  const addItemWith = useModStore((s) => s.addItemWith)
  const registerFileInCache = useModStore((s) => s.registerFileInCache)

  const [step, setStep] = useState(0)
  const [state, setState] = useState<WizardState>({
    modType: null,
    modName: '',
    language: '',
    meshFile: null,
    textureFiles: [],
  })

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

  const handleClose = () => {
    setStep(0)
    setState({ modType: null, modName: '', language: '', meshFile: null, textureFiles: [] })
    onClose()
  }

  // ── Build item from wizard state ───────────────────────────────────────────

  const buildPartialItem = (): Partial<Item> => {
    const textureKeys: Record<string, string> = {}
    state.textureFiles.forEach((f) => {
      const key = `texture_${crypto.randomUUID()}`
      registerFileInCache(key, f)
      textureKeys[key] = f.name
    })

    return {
      id:   crypto.randomUUID(),
      guid: crypto.randomUUID(),
      name: state.modName.trim() || 'New Mod Item',
      description: state.modType === 'wall_paint'
        ? 'Custom wall paint or wallpaper pattern.'
        : 'Custom placeable furniture item.',
      price: 0,
      tags: state.modType === 'wall_paint'
        ? ['Decoration', 'Color', 'Texture']
        : ['Object', 'Placeable', 'Build Mode'],
      thumbnailKey: null,
      textureKeys,
      componentBlueprints: { rootDefaultStates: [], materialSurfaces: [] },
      components: [],
    }
  }

  // ── Finish actions ─────────────────────────────────────────────────────────

  const handleDownload = () => {
    if (state.modType === 'translation') {
      const translationText = "#Setting.Translations\n =Items\n"
      const blob = new Blob([translationText], { type: 'text/plain' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Translations.setting`
      a.click()
      URL.revokeObjectURL(url)
      handleClose()
      return
    }

    const item = buildPartialItem() as Item
    addItemWith(item)
    const blob = new Blob([JSON.stringify(item, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `${item.name.replace(/\s+/g, '-').toLowerCase()}.mod.json`
    a.click()
    URL.revokeObjectURL(url)
    onComplete?.(item)
    handleClose()
  }

  const handleAdvancedEditing = () => {
    if (state.modType === 'translation') {
      // Pass a special payload so the parent (Dashboard) can create the project & navigate
      onAdvancedEditing?.({ 
        isTranslation: true, 
        language: state.language.trim() 
      } as any)
      handleClose()
      return
    }

    const partial = buildPartialItem()
    onAdvancedEditing?.(partial)
    handleClose()
  }

  const handleSkipToAdvanced = () => {
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
  }

  // ── Step renderers ─────────────────────────────────────────────────────────

  const renderStep0 = () => (
    <div className="flex flex-col gap-6 animate-in fade-in slide-in-from-bottom-3 duration-200">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-white m-0">What kind of mod?</h2>
        <p className="text-sm text-gray-500 mt-2 m-0">Choose the type of content you want to create.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-1 gap-3">
        {MOD_TYPES.map(({ id, label, description, tags, icon: Icon }) => {
          const selected = state.modType === id
          return (
            <button
              key={id}
              onClick={() => setState((s) => ({ ...s, modType: id }))}
              className={`
                text-left p-5 rounded-2xl border-2 cursor-pointer transition-all duration-200 outline-none
                ${selected
                  ? 'border-[#8b5cf6] bg-[#8b5cf6]/8 shadow-lg shadow-[#8b5cf6]/10'
                  : 'border-white/6 bg-white/2 hover:border-white/12 hover:bg-white/4'
                }
              `}
            >
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center mb-3 transition-colors ${selected ? 'bg-[#8b5cf6]/20' : 'bg-white/5'}`}>
                <Icon size={20} weight="light" className={selected ? 'text-[#a78bfa]' : 'text-gray-400'} />
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

          <DropZone
            label="3D Mesh"
            hint="Drop your .obj, .fbx, .glb, or .gltf file here"
            accept=".obj,.fbx,.glb,.gltf"
            files={state.meshFile ? [state.meshFile] : []}
            icon={CloudArrowUp}
            onFiles={([f]) => setState((s) => ({ ...s, meshFile: f ?? null }))}
          />

          <DropZone
            label="Textures"
            hint="Drop texture images here (PNG, JPG, TGA…)"
            accept=".png,.jpg,.jpeg,.tga,.webp"
            multiple
            files={state.textureFiles}
            icon={CloudArrowUp}
            onFiles={(files) => setState((s) => ({ ...s, textureFiles: files }))}
          />
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
          <h2 className="text-2xl font-bold text-white m-0">Preview &amp; export</h2>
          <p className="text-sm text-gray-500 mt-2 m-0">Review your mod before downloading or editing further.</p>
        </div>

        <div className="w-full h-48 rounded-2xl border border-white/6 bg-white/2 flex flex-col items-center justify-center gap-2">
          <Eye size={28} className="text-gray-600" weight="light" />
          <span className="text-xs text-gray-600">3D preview not available in browser</span>
        </div>

        <div className="rounded-2xl border border-white/6 bg-white/2 overflow-hidden">
          {[
            ['Mod name', state.modName.trim() || '—'],
            ['Type', selectedType?.label ?? '—'],
            ['Mesh', state.meshFile?.name ?? 'None'],
            ['Textures', state.textureFiles.length > 0 ? `${state.textureFiles.length} file${state.textureFiles.length > 1 ? 's' : ''}` : 'None'],
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

        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={handleDownload}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-white/5 hover:bg-white/8 border border-white/8 hover:border-white/14 text-sm font-semibold text-gray-300 hover:text-white cursor-pointer transition-all duration-150 outline-none"
          >
            <Download size={15} weight="bold" />
            Download mod
          </button>
          <button
            onClick={handleAdvancedEditing}
            className="flex items-center justify-center gap-2 px-4 py-3 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-sm font-semibold text-white cursor-pointer transition-all duration-150 outline-none border-none shadow-lg shadow-[#8b5cf6]/20"
          >
            <Sliders size={15} weight="bold" />
            Advanced editing
          </button>
        </div>
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