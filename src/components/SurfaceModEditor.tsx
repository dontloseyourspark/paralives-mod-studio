import { useState, useCallback, useRef } from 'react'
import {
  CloudArrowUp, Download, Plus, Trash, FloppyDisk,
  PaintBucket, File, CheckCircle, WarningCircle,
} from 'phosphor-react'
import type {
  SurfaceMod, BuildModeTagName, ColorZoneCount,
  SwatchEntry, SwatchColor, SurfaceTextureAsset,
} from '../types/surfaceModTypes'
import {
  SURFACE_TAG_PRESETS, generatePGuid, GAME_ASSET_GUID,
} from '../types/surfaceModTypes'
import { generateSurfaceModFiles } from '../lib/surfaceModGenerator'
import { exportSurfaceModAsZip } from '../lib/modBundleExporter'
import { useModStore } from '../store/useModStore'

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mb-3 pb-1.5 border-b border-white/5">
      {children}
    </div>
  )
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-gray-400">{label}</label>
      {children}
    </div>
  )
}

function Input({ value, onChange, placeholder, mono = false }: {
  value: string | number
  onChange: (v: string) => void
  placeholder?: string
  mono?: boolean
}) {
  return (
    <input
      type="text"
      value={String(value)}
      placeholder={placeholder}
      onChange={e => onChange(e.target.value)}
      className={`bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-sm text-white placeholder-gray-600 outline-none focus:border-[#8b5cf6]/50 transition-colors ${mono ? 'font-mono text-xs' : ''}`}
    />
  )
}

function NumberInput({ value, onChange, min, max, step }: {
  value: number
  onChange: (v: number) => void
  min?: number; max?: number; step?: number
}) {
  return (
    <input
      type="number"
      value={value}
      min={min} max={max} step={step ?? 0.1}
      onChange={e => onChange(parseFloat(e.target.value) || 0)}
      className="bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#8b5cf6]/50 transition-colors font-mono"
    />
  )
}

function Toggle({ value, onChange, label }: { value: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      onClick={() => onChange(!value)}
      className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-semibold border transition-colors cursor-pointer outline-none ${
        value
          ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/40 text-[#a78bfa]'
          : 'bg-white/3 border-white/8 text-gray-400 hover:border-white/15'
      }`}
    >
      <div className={`w-3 h-3 rounded-full ${value ? 'bg-[#8b5cf6]' : 'bg-gray-600'}`} />
      {label}
    </button>
  )
}

// ─── Texture drop zone ────────────────────────────────────────────────────────

function TextureDropZone({
  label, hint, asset, onFile, onClear,
}: {
  label: string
  hint: string
  asset: SurfaceTextureAsset | null
  onFile: (file: File) => void
  onClear: () => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const getBlobUrl = useModStore(s => s.getBlobUrlFromCache)

  const previewUrl = asset ? getBlobUrl(asset.cacheKey) : null

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setDragging(false)
    const f = e.dataTransfer.files[0]
    if (f) onFile(f)
  }, [onFile])

  return (
    <div className="flex flex-col gap-1.5">
      <label className="text-[11px] font-semibold text-gray-400">{label}</label>
      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={handleDrop}
        onClick={() => !asset && inputRef.current?.click()}
        className={`relative rounded-xl border-2 border-dashed transition-all duration-150 ${
          dragging
            ? 'border-[#8b5cf6] bg-[#8b5cf6]/8'
            : asset
              ? 'border-[#8b5cf6]/30 bg-[#8b5cf6]/4 cursor-default'
              : 'border-white/8 bg-white/2 hover:border-white/15 cursor-pointer'
        }`}
      >
        <input ref={inputRef} type="file" accept=".png,.jpg,.jpeg" className="hidden"
          onChange={e => { const f = e.target.files?.[0]; if (f) onFile(f) }} />

        {asset ? (
          <div className="flex items-center gap-3 px-3 py-3">
            {previewUrl
              ? <img src={previewUrl} alt="" className="w-10 h-10 rounded-lg object-cover border border-white/8" />
              : <div className="w-10 h-10 rounded-lg bg-white/5 flex items-center justify-center"><File size={16} className="text-gray-500" /></div>
            }
            <div className="flex-1 min-w-0">
              <div className="text-xs font-semibold text-white truncate">{asset.filename}</div>
              <div className="text-[10px] text-gray-500 font-mono truncate">{(asset as any).guid?.slice(0, 16)}…</div>
            </div>
            <button
              onClick={e => { e.stopPropagation(); onClear() }}
              className="p-1.5 hover:bg-white/8 rounded-lg text-gray-500 hover:text-rose-400 transition-colors cursor-pointer outline-none"
            >
              <Trash size={13} />
            </button>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-1.5 py-5">
            <CloudArrowUp size={22} className="text-[#8b5cf6]/50" weight="light" />
            <span className="text-xs text-gray-500 text-center">{hint}</span>
          </div>
        )}
      </div>
    </div>
  )
}

// ─── Swatch editor ────────────────────────────────────────────────────────────

function SwatchEditor({
  swatches, colorZoneCount, onChange,
}: {
  swatches: SwatchEntry[]
  colorZoneCount: ColorZoneCount
  onChange: (swatches: SwatchEntry[]) => void
}) {
  const numColors = colorZoneCount + 1
  const zoneLabels = ['Base', 'Zone 1 (Red)', 'Zone 2 (Green)', 'Zone 3 (Blue)'].slice(0, numColors)

  const updateColor = (si: number, ci: number, field: keyof SwatchColor, raw: string) => {
    const val = parseFloat(raw)
    if (isNaN(val)) return
    const next = swatches.map((s, i) => i !== si ? s : {
      ...s,
      colors: s.colors.map((c, j) => j !== ci ? c : { ...c, [field]: Math.max(0, Math.min(1, val)) }),
    })
    onChange(next)
  }

  const addSwatch = () => {
    onChange([...swatches, {
      guid: generatePGuid(),
      colors: Array.from({ length: numColors }, () => ({ guid: generatePGuid(), r: 1, g: 1, b: 1, a: 1 })),
    }])
  }

  const removeSwatch = (i: number) => onChange(swatches.filter((_, j) => j !== i))

  return (
    <div className="flex flex-col gap-3">
      {swatches.map((swatch, si) => (
        <div key={swatch.guid} className="bg-white/2 border border-white/6 rounded-xl p-3">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-semibold text-gray-400">Swatch {si + 1}</span>
            {swatches.length > 1 && (
              <button onClick={() => removeSwatch(si)}
                className="p-1 hover:bg-white/8 rounded text-gray-600 hover:text-rose-400 transition-colors cursor-pointer outline-none">
                <Trash size={12} />
              </button>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            {zoneLabels.map((zoneName, ci) => {
              const c = swatch.colors[ci] ?? { guid: generatePGuid(), r: 1, g: 1, b: 1, a: 1 }
              const hex = `#${Math.round(c.r * 255).toString(16).padStart(2, '0')}${Math.round(c.g * 255).toString(16).padStart(2, '0')}${Math.round(c.b * 255).toString(16).padStart(2, '0')}`
              return (
                <div key={ci} className="flex flex-col gap-1">
                  <span className="text-[10px] text-gray-500">{zoneName}</span>
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded border border-white/10 shrink-0" style={{ background: hex }} />
                    <input
                      type="color"
                      value={hex}
                      onChange={e => {
                        const v = e.target.value
                        const r = parseInt(v.slice(1, 3), 16) / 255
                        const g = parseInt(v.slice(3, 5), 16) / 255
                        const b = parseInt(v.slice(5, 7), 16) / 255
                        const next = swatches.map((s, i) => i !== si ? s : {
                          ...s,
                          colors: s.colors.map((col, j) => j !== ci ? col : { ...col, r, g, b }),
                        })
                        onChange(next)
                      }}
                      className="flex-1 h-7 rounded bg-white/5 border border-white/8 cursor-pointer outline-none"
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      ))}
      <button
        onClick={addSwatch}
        className="flex items-center justify-center gap-1.5 py-2 text-xs font-semibold text-gray-400 hover:text-white border border-dashed border-white/8 hover:border-white/15 rounded-xl transition-colors cursor-pointer outline-none"
      >
        <Plus size={12} weight="bold" />
        Add swatch
      </button>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  mod: SurfaceMod
  onChange: (mod: SurfaceMod) => void
  onSave?: () => void
  /** Cache key for the workshop thumbnail PNG (from project.coverThumbnailKey) */
  workshopThumbnailKey?: string | null
}

export default function SurfaceModEditor({ mod, onChange, onSave, workshopThumbnailKey }: Props) {
  const [exporting, setExporting] = useState(false)
  const [exportDone, setExportDone] = useState(false)
  const [exportError, setExportError] = useState<string | null>(null)

  const registerFileInCache = useModStore(s => s.registerFileInCache)

  const update = (partial: Partial<SurfaceMod>) => onChange({ ...mod, ...partial, updatedAt: new Date().toISOString() })

  // ── SHA-1 checksum ──────────────────────────────────────────────────────
  const sha1Hex = async (file: File): Promise<string> => {
    const buf    = await file.arrayBuffer()
    const digest = await crypto.subtle.digest('SHA-1', buf)
    return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('').toUpperCase()
  }

  // ── Texture registration ────────────────────────────────────────────────
  const registerTexture = async (
    file: File,
    field: 'texture' | 'colorZoneMap' | 'normalAoMap' | 'smoothnessMap'
  ) => {
    const guid     = generatePGuid()
    const cacheKey = `surface_${mod.modGuid}_${field}_${guid}`
    const checksum = await sha1Hex(file)
    registerFileInCache(cacheKey, file)
    const asset: SurfaceTextureAsset & { guid: string } = {
      cacheKey,
      filename:    file.name,
      checksum,
      gameVersion: '20031',
      guid,
    }
    update({ [field]: asset })
  }

  const clearTexture = (field: 'texture' | 'colorZoneMap' | 'normalAoMap' | 'smoothnessMap') => {
    update({ [field]: null })
  }

  // ── Zone count change — keep swatch colors in sync ─────────────────────
  const handleZoneCountChange = (count: ColorZoneCount) => {
    const numColors = count + 1
    const swatches = mod.swatches.map(s => {
      const colors = Array.from({ length: numColors }, (_, i) =>
        s.colors[i] ?? { guid: generatePGuid(), r: 1, g: 1, b: 1, a: 1 }
      )
      return { ...s, colors }
    })
    const czGuids = Array.from({ length: numColors }, (_, i) => mod.colorZoneNameGuids[i] ?? generatePGuid())
    update({ colorZoneCount: count, swatches, colorZoneNameGuids: czGuids })
  }

  // ── Export ──────────────────────────────────────────────────────────────
  const handleExport = async () => {
    setExporting(true)
    setExportError(null)
    try {
      const entries = generateSurfaceModFiles(mod)
      await exportSurfaceModAsZip(mod, entries, workshopThumbnailKey)
      setExportDone(true)
      setTimeout(() => setExportDone(false), 3000)
    } catch (err) {
      setExportError(err instanceof Error ? err.message : 'Export failed')
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="flex flex-col h-full overflow-y-auto">

      {/* Header */}
      <div className="sticky top-0 z-10 flex items-center justify-between px-5 py-3 bg-[#0e1017] border-b border-white/5">
        <div className="flex items-center gap-2">
          <PaintBucket size={16} className="text-[#8b5cf6]" weight="light" />
          <span className="text-sm font-bold text-white">{mod.displayName || 'Untitled Surface'}</span>
        </div>
        <div className="flex items-center gap-2">
          {onSave && (
            <button onClick={onSave}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold bg-white/5 hover:bg-white/8 border border-white/8 rounded-lg text-gray-300 cursor-pointer transition-colors outline-none">
              <FloppyDisk size={13} weight="bold" /> Save
            </button>
          )}
          <button
            onClick={handleExport}
            disabled={exporting}
            className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg cursor-pointer transition-colors outline-none border-none ${
              exportDone
                ? 'bg-emerald-600 text-white'
                : 'bg-[#8b5cf6] hover:bg-[#7c3aed] disabled:bg-[#8b5cf6]/40 text-white'
            }`}
          >
            {exportDone
              ? <><CheckCircle size={13} weight="bold" /> Exported!</>
              : exporting
                ? 'Exporting…'
                : <><Download size={13} weight="bold" /> Export .mod</>
            }
          </button>
        </div>
      </div>

      {exportError && (
        <div className="mx-5 mt-3 flex items-center gap-2 px-3 py-2.5 bg-rose-950/30 border border-rose-500/20 rounded-xl text-xs text-rose-300">
          <WarningCircle size={14} />
          {exportError}
        </div>
      )}

      <div className="flex flex-col gap-6 p-5">

        {/* Identity */}
        <div>
          <SectionHeader>Identity</SectionHeader>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Internal name (no spaces)">
              <Input value={mod.internalName} onChange={v => update({ internalName: v.replace(/\s+/g, '') })} placeholder="MySurface" />
            </Field>
            <Field label="Display name (shown in-game)">
              <Input value={mod.displayName} onChange={v => update({ displayName: v })} placeholder="My Surface" />
            </Field>
            <Field label="Creator ID">
              <Input value={mod.creatorId} onChange={v => update({ creatorId: v })} placeholder="yourname" />
            </Field>
            <Field label="Mod GUID">
              <Input value={mod.modGuid} onChange={() => {}} mono />
            </Field>
          </div>
        </div>

        {/* Catalog placement */}
        <div>
          <SectionHeader>Catalog placement</SectionHeader>
          <Field label="Surface category">
            <select
              value={Object.entries(SURFACE_TAG_PRESETS).find(([, v]) => v[0] === mod.buildModeTags[0] && v[1] === mod.buildModeTags[1])?.[0] ?? ''}
              onChange={e => {
                const preset = SURFACE_TAG_PRESETS[e.target.value]
                if (!preset) return
                const isFloor = preset[0] === 'FloorSurfaces'
                update({
                  buildModeTags: preset,
                  swatchThumbnailType: isFloor ? 3 : 4,
                })
              }}
              className="bg-white/3 border border-white/8 rounded-lg px-3 py-2 text-sm text-white outline-none focus:border-[#8b5cf6]/50"
            >
              <option value="">Custom…</option>
              {Object.keys(SURFACE_TAG_PRESETS).map(name => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
          </Field>
        </div>

        {/* Textures */}
        <div>
          <SectionHeader>Textures</SectionHeader>
          <div className="flex flex-col gap-3">
            <TextureDropZone
              label="GrayMask / MasterMap (primary)"
              hint="Drop your .png GrayMask or packed MasterMap here"
              asset={mod.texture}
              onFile={f => registerTexture(f, 'texture')}
              onClear={() => clearTexture('texture')}
            />
            <TextureDropZone
              label="Color Zone Map (optional)"
              hint="Drop your RGBA color zone map here"
              asset={mod.colorZoneMap}
              onFile={f => registerTexture(f, 'colorZoneMap')}
              onClear={() => clearTexture('colorZoneMap')}
            />
            <TextureDropZone
              label="Normal + AO Map (optional)"
              hint="RGB=Normal, A=Ambient Occlusion"
              asset={mod.normalAoMap}
              onFile={f => registerTexture(f, 'normalAoMap')}
              onClear={() => clearTexture('normalAoMap')}
            />
            <TextureDropZone
              label="Smoothness Map (optional)"
              hint="Grayscale smoothness variation map"
              asset={mod.smoothnessMap}
              onFile={f => registerTexture(f, 'smoothnessMap')}
              onClear={() => clearTexture('smoothnessMap')}
            />
          </div>
        </div>

        {/* Shader parameters */}
        <div>
          <SectionHeader>Shader parameters</SectionHeader>
          <div className="grid grid-cols-3 gap-3">
            <Field label="Tiling X"><NumberInput value={mod.tilingX} onChange={v => update({ tilingX: v })} min={0.1} max={20} /></Field>
            <Field label="Tiling Y"><NumberInput value={mod.tilingY} onChange={v => update({ tilingY: v })} min={0.1} max={20} /></Field>
            <Field label="Smoothness"><NumberInput value={mod.smoothnessValue} onChange={v => update({ smoothnessValue: v })} min={0} max={1} /></Field>
            <Field label="AO Strength"><NumberInput value={mod.ambientOcclusionStrength} onChange={v => update({ ambientOcclusionStrength: v })} min={0} max={2} /></Field>
            <Field label="Metallic"><NumberInput value={mod.metallicValue} onChange={v => update({ metallicValue: v })} min={0} max={1} /></Field>
            <Field label="Emissive"><NumberInput value={mod.emissiveStrength} onChange={v => update({ emissiveStrength: v })} min={0} max={5} /></Field>
            <Field label="Variant Strength"><NumberInput value={mod.variantStrength} onChange={v => update({ variantStrength: v })} min={0} max={2} /></Field>
            <Field label="Hue Shift"><NumberInput value={mod.hueShift} onChange={v => update({ hueShift: v })} min={0} max={2} /></Field>
            <Field label="Alpha Clip"><NumberInput value={mod.alphaClip} onChange={v => update({ alphaClip: v })} min={0} max={1} /></Field>
          </div>
          <div className="mt-3">
            <Toggle value={mod.grayMaskPureWhiteIsPureWhite} onChange={v => update({ grayMaskPureWhiteIsPureWhite: v })} label="Gray Mask: pure white is pure white" />
          </div>
        </div>

        {/* Wall/floor settings */}
        <div>
          <SectionHeader>Wall / floor settings</SectionHeader>
          <div className="flex flex-wrap gap-2 mb-4">
            <Toggle value={mod.isWallOrFloor} onChange={v => update({ isWallOrFloor: v })} label="Is wall or floor" />
            <Toggle value={mod.wallYStretching} onChange={v => update({ wallYStretching: v })} label="Stretch vertically (Y)" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Top border (0 = none)">
              <NumberInput value={mod.topBorder ?? 0} onChange={v => update({ topBorder: v === 0 ? null : v })} min={0} max={10} step={0.5} />
            </Field>
            <Field label="Bottom border">
              <NumberInput value={mod.bottomBorder ?? 0} onChange={v => update({ bottomBorder: v === 0 ? null : v })} min={0} max={10} step={0.5} />
            </Field>
            <Field label="Left border">
              <NumberInput value={mod.leftBorder ?? 0} onChange={v => update({ leftBorder: v === 0 ? null : v })} min={0} max={10} step={0.5} />
            </Field>
            <Field label="Right border">
              <NumberInput value={mod.rightBorder ?? 0} onChange={v => update({ rightBorder: v === 0 ? null : v })} min={0} max={10} step={0.5} />
            </Field>
          </div>
        </div>

        {/* Color zones */}
        <div>
          <SectionHeader>Color zones</SectionHeader>
          <div className="mb-4">
            <Field label="Number of color zones">
              <div className="flex gap-2">
                {([0, 1, 2, 3] as ColorZoneCount[]).map(n => (
                  <button
                    key={n}
                    onClick={() => handleZoneCountChange(n)}
                    className={`px-4 py-2 rounded-lg text-xs font-bold border transition-colors cursor-pointer outline-none ${
                      mod.colorZoneCount === n
                        ? 'bg-[#8b5cf6]/15 border-[#8b5cf6]/40 text-[#a78bfa]'
                        : 'bg-white/3 border-white/8 text-gray-400 hover:border-white/15'
                    }`}
                  >
                    {n === 0 ? 'None' : `${n + 1} zones`}
                  </button>
                ))}
              </div>
            </Field>
          </div>

          {/* Swatches */}
          <SectionHeader>Default swatches</SectionHeader>
          <SwatchEditor
            swatches={mod.swatches}
            colorZoneCount={mod.colorZoneCount}
            onChange={swatches => update({ swatches })}
          />
        </div>

      </div>
    </div>
  )
}
