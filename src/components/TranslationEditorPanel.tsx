// src/components/TranslationEditorPanel.tsx
import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useModStore } from '../store/useModStore'
import { Plus, MagnifyingGlass, CheckCircle, Warning, Code, Image } from 'phosphor-react'
import JSZip from 'jszip'
import englishReference from '../data/englishReference.json'
import TranslationLeftPanel from './TranslationLeftPanel'
import type { CategoryStat } from './TranslationLeftPanel'

// ─── Category definitions ─────────────────────────────────────────────────────

interface CategoryDef {
  id: string
  label: string
  prefixes?: Set<string>
}

const TRANSLATION_CATEGORIES: CategoryDef[] = [
  { id: 'all', label: 'All Strings' },
  {
    id: 'items',
    label: 'Items & Objects',
    prefixes: new Set(['Item', 'ItemTag', 'ItemDescription', 'ItemPlacementError', 'ItemPortrait', 'ColorZoneName', 'PaletteColor', 'Molding', 'Fence', 'SurfaceGroup', 'TerrainPaint', 'Terrain']),
  },
  {
    id: 'interactions',
    label: 'Interactions',
    prefixes: new Set(['Interaction', 'InteractionGroup', 'NestedInteraction', 'InteractionQuality', 'InteractionUsabilityRuleTooltip']),
  },
  {
    id: 'characters',
    label: 'Characters & CAS',
    prefixes: new Set(['CharacterCreatorTag', 'CharacterName', 'CharacterPremadeTag', 'Skin', 'CustomizationSlider', 'Gender', 'LifeStage', 'LifeStageDuration', 'OutfitType', 'CensoredEffectRegion', 'SkinLevelLabel']),
  },
  {
    id: 'traits',
    label: 'Traits & Emotions',
    prefixes: new Set(['Trait', 'TraitDescription', 'TraitCategory', 'TraitChoice', 'Emotion', 'StatusEffect', 'StatusEffectDescription']),
  },
  {
    id: 'needs_wants',
    label: 'Needs & Wants',
    prefixes: new Set(['Want', 'Need', 'NeedDescription', 'Goal', 'GoalObjective', 'GoalDescription']),
  },
  {
    id: 'skills',
    label: 'Skills',
    prefixes: new Set(['SkillName', 'SkillDescription', 'SkillHowToImprove', 'SkillCurrentLearningSpeed', 'SkillCurrentSlowLearningSpeed', 'SkillBaseLearningSpeed']),
  },
  {
    id: 'occupations',
    label: 'Occupations',
    prefixes: new Set(['OccupationName', 'OccupationUnlockableName', 'OccupationUnlockableDescription', 'OccupationDomain']),
  },
  {
    id: 'social',
    label: 'Social & Together',
    prefixes: new Set(['RelationshipLabel', 'GetToKnowResult', 'TogetherCard', 'TogetherBar', 'Household', 'HouseholdBio']),
  },
  {
    id: 'story',
    label: 'Story & Notifications',
    prefixes: new Set(['StoryCard', 'StoryCardDescription', 'StoryCardPack', 'StoryCardPackDescription', 'StoryCardHand', 'Storyteller', 'StorytellerDescription', 'Notification', 'NotificationSubtitle', 'NotificationSubtitleB', 'Article', 'ArticleActionText', 'Letter', 'Newspaper', 'NewspaperArticleClaimButton']),
  },
  {
    id: 'brain',
    label: 'Gameplay Logic',
    prefixes: new Set(['BrainLogic', 'SuccessModifier', 'SuccessPeacefulAbilityOccupationPoint', 'SuccessPeacefulAbilityRemoveRandomNegativeEmotion', 'SuccessPeacefulAbilityRelieveRandomNeed', 'CommunityBundle', 'CommunityBundleGroup', 'BundleUnlockConditions']),
  },
  { id: 'ui', label: 'UI & System' },
  { id: 'other', label: 'Other / Unmapped' },
]

// Build prefix → categoryId map from explicit prefix sets
const PREFIX_TO_CATEGORY = new Map<string, string>()
for (const cat of TRANSLATION_CATEGORIES) {
  if (cat.prefixes) {
    for (const prefix of cat.prefixes) {
      PREFIX_TO_CATEGORY.set(prefix, cat.id)
    }
  }
}

const UI_SYSTEM_PREFIXES = new Set([
  'Settings', 'Help', 'Button', 'Error', 'General', 'GeneralOptions',
  'Command', 'CommandCategory', 'GameVersion', 'BillableElement', 'BillLine',
  'BillUnit', 'BillUnitDescription', 'DayOfWeek', 'Month', 'LotType',
  'CompanyName', 'CompanyTagName', 'Credit', 'KeybindingTip', 'ElapsedTime',
  'FormatServices', 'ParameterDescription', 'AssetManager', 'TEST',
  'LODQualityLevel', 'PaintingSize', 'Steamworks', 'VoiceActor',
])

function getEntryCategory(devKey: string): string {
  if (!devKey) return 'other'
  const prefix = devKey.split('_')[0]
  const cat = PREFIX_TO_CATEGORY.get(prefix)
  if (cat) return cat
  if (prefix.startsWith('UI') || UI_SYSTEM_PREFIXES.has(prefix)) return 'ui'
  return 'other'
}

// ─── CSV parser ───────────────────────────────────────────────────────────────

function parseCSV(text: string): string[][] {
  const rows: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    if (inQuotes) {
      if (char === '"') {
        if (i + 1 < text.length && text[i + 1] === '"') {
          currentCell += '"'; i++
        } else {
          inQuotes = false
        }
      } else {
        currentCell += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === ',') {
        currentRow.push(currentCell)
        currentCell = ''
      } else if (char === '\n' || char === '\r') {
        currentRow.push(currentCell)
        rows.push(currentRow)
        currentRow = []
        currentCell = ''
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') i++
      } else {
        currentCell += char
      }
    }
  }
  if (currentCell !== '' || currentRow.length > 0) {
    currentRow.push(currentCell)
    rows.push(currentRow)
  }
  return rows
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function TranslationSkeleton() {
  return (
    <div className="flex-1 flex min-h-0 overflow-hidden">
      <div className="w-52 shrink-0 h-full bg-[#161923] border-r border-white/5 p-2 pt-3 flex flex-col gap-1">
        {Array.from({ length: 12 }).map((_, i) => (
          <div
            key={i}
            className="h-11 bg-white/5 rounded-xl animate-pulse"
            style={{ opacity: Math.max(0.12, 1 - i * 0.07) }}
          />
        ))}
      </div>
      <div className="flex-1 p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <div
              key={i}
              className="bg-[#161923] border border-white/5 rounded-xl h-24 animate-pulse"
              style={{ opacity: Math.max(0.08, 1 - i * 0.1) }}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function TranslationEditorPanel() {
  const currentProject = useModStore((state) => state.currentProject)
  const updateProject = useModStore((state) => state.updateProject)
  const updateTranslationString = useModStore((state) => state.updateTranslationString)

  const translations = currentProject?.translations || []
  const [activeLangIndex, setActiveLangIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'filled' | 'empty'>('all')
  const [selectedCategory, setSelectedCategory] = useState('all')
  const [isReady, setIsReady] = useState(false)

  const fileInputRef = useRef<HTMLInputElement>(null)
  const thumbnailInputRef = useRef<HTMLInputElement>(null)
  const [thumbnailFile, setThumbnailFile] = useState<File | null>(null)

  const referenceStrings = englishReference as Record<string, string | { text: string; key: string }>
  const activeTranslation = translations[activeLangIndex]

  // Show skeleton on first mount to mask the initial heavy useMemo computation
  useEffect(() => {
    const raf = requestAnimationFrame(() => setIsReady(true))
    return () => cancelAnimationFrame(raf)
  }, [])

  // Per-category stats (counts all strings, ignores search/status filter)
  const categoryStats = useMemo(() => {
    const stats = new Map<string, { total: number; completed: number }>()
    for (const cat of TRANSLATION_CATEGORIES) stats.set(cat.id, { total: 0, completed: 0 })

    if (!isReady || !activeTranslation) return stats

    for (const [guid, text] of Object.entries(activeTranslation.strings)) {
      const refData = referenceStrings[guid]
      const devKey = typeof refData === 'object' ? refData.key : ''
      const catId = getEntryCategory(devKey)
      const isCompleted = (text as string).trim() !== ''

      const all = stats.get('all')!
      all.total++
      if (isCompleted) all.completed++

      const cat = stats.get(catId)!
      cat.total++
      if (isCompleted) cat.completed++
    }
    return stats
  }, [isReady, activeTranslation, referenceStrings])

  const categoryList: CategoryStat[] = useMemo(
    () =>
      TRANSLATION_CATEGORIES.map((cat) => ({
        id: cat.id,
        label: cat.label,
        ...(categoryStats.get(cat.id) || { total: 0, completed: 0 }),
      })),
    [categoryStats]
  )

  const filteredEntries = useMemo(() => {
    if (!isReady || !activeTranslation) return []
    return Object.entries(activeTranslation.strings).filter(([guid, text]) => {
      const refData = referenceStrings[guid]
      const refText = typeof refData === 'object' ? refData.text : refData || ''
      const devKey = typeof refData === 'object' ? refData.key : ''

      if (selectedCategory !== 'all' && getEntryCategory(devKey) !== selectedCategory) return false

      const matchesSearch =
        (refText as string).toLowerCase().includes(search.toLowerCase()) ||
        (text as string).toLowerCase().includes(search.toLowerCase()) ||
        devKey.toLowerCase().includes(search.toLowerCase()) ||
        guid.includes(search)

      if (!matchesSearch) return false

      const isCompleted = (text as string).trim() !== ''
      if (statusFilter === 'filled') return isCompleted
      if (statusFilter === 'empty') return !isCompleted
      return true
    })
  }, [isReady, activeTranslation, search, statusFilter, referenceStrings, selectedCategory])

  const progress = useMemo(() => {
    const all = categoryStats.get('all')
    return all ?? { completed: 0, total: 0 }
  }, [categoryStats])

  if (!currentProject || translations.length === 0) return null

  const handleAddString = () => {
    const newKey = `g${Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000}`
    updateTranslationString(activeTranslation.language, newKey, '')
  }

  const handleExportCSV = () => {
    const rows = [
      ['GUID', 'Key', 'Source Text', 'Translation'],
      ...filteredEntries.map(([guid, text]) => {
        const refData = referenceStrings[guid]
        const refText = typeof refData === 'object' ? refData.text : refData || ''
        const devKey = typeof refData === 'object' ? refData.key : ''
        return [
          guid,
          `"${devKey.replace(/"/g, '""')}"`,
          `"${(refText as string).replace(/"/g, '""')}"`,
          `"${(text as string).replace(/"/g, '""')}"`
        ]
      })
    ]
    const csvContent = rows.map(e => e.join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeTranslation.language}_Translations.csv`
    link.click()
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const confirmOverride = window.confirm('Importing this CSV will overwrite matching rows. Proceed?')
    if (!confirmOverride) return

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      const parsedRows = parseCSV(text)
      if (parsedRows.length < 2) return

      const headers = parsedRows[0].map(h => h.trim().toLowerCase())
      const guidIndex = headers.indexOf('guid')
      let transIndex = headers.findIndex(h => h.includes('translation') || h.includes('kolom voor') || h.includes('value'))
      if (transIndex === -1 || transIndex === guidIndex) transIndex = 2

      if (guidIndex === -1) return

      const newStrings = { ...activeTranslation.strings }
      for (let i = 1; i < parsedRows.length; i++) {
        const row = parsedRows[i]
        if (row.length > Math.max(guidIndex, transIndex)) {
          let guid = row[guidIndex].trim()
          if (!guid) continue
          if (!guid.startsWith('g') && /^\d+$/.test(guid)) guid = 'g' + guid
          newStrings[guid] = row[transIndex]
        }
      }

      updateProject({
        ...currentProject,
        translations: translations.map(t =>
          t.language === activeTranslation.language ? { ...t, strings: newStrings } : t
        ),
        updatedAt: new Date().toISOString()
      })
    }
    reader.readAsText(file)
  }

  const handleExportMod = async () => {
    const zip = new JSZip()
    const lang = activeTranslation.language

    const stableNumericGuid = currentProject.id.replace(/[^0-9]/g, '').substring(0, 19).padEnd(19, '5')
    const modFolderName = `${lang}translation_${stableNumericGuid}.mod`
    const root = zip.folder(modFolderName)
    if (!root) return

    const modMetaContent = [
      `GUID:${stableNumericGuid}`,
      `Type:401`,
      `UpdatedToGameVersion:17287`,
      `ModName:${currentProject.name || `${lang} translation`}`,
      `Enabled:False`,
      `IsSystemMod:False`,
      `CreationTime:0`,
      `LastEditTime:0`,
      `LastUploadTime:0`,
      `IsFromWorkshop:False`,
      `PublishedFileId:0`,
      `CreatorId:${currentProject.author || 'Studio Creator'}`,
      `WorkshopDescription:${currentProject.description || `Custom ${lang} localization package.`}`
    ].join('\r\n') + '\r\n'

    root.file(`${modFolderName}.meta`, modMetaContent)

    if (thumbnailFile) {
      const thumbBuffer = await thumbnailFile.arrayBuffer()
      root.file(`${modFolderName}.thumbnail`, thumbBuffer)
    }

    const settings = root.folder('Settings')
    const settingStableGuid = stableNumericGuid.split('').reverse().join('')
    settings?.file(`Translations.setting.meta`, `GUID:${settingStableGuid}\r\nType:203\r\nIsSettingType:True\r\nSettingType:Setting.Translations\r\n`)

    const transContent = `#Setting.Translations\r\n =Items\r\n` +
      Object.entries(activeTranslation.strings)
        .filter(([_, v]) => (v as string).trim() !== '')
        .map(([k, v]) => `  ${k}\r\n   =Value:${v}`).join('\r\n')

    settings?.file(`Translations.setting`, transContent)

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${modFolderName}.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-[#0e1017] text-gray-300 overflow-hidden">
      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
      <input type="file" accept="image/png,image/jpeg" ref={thumbnailInputRef} onChange={(e) => setThumbnailFile(e.target.files?.[0] || null)} className="hidden" />

      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#161923] px-4 py-3 shrink-0">
        <div className="flex items-center gap-4">
          {translations.map((t, i) => (
            <button
              key={t.language}
              onClick={() => { setActiveLangIndex(i); setSelectedCategory('all') }}
              className={`text-xs font-bold uppercase transition-colors ${activeLangIndex === i ? 'text-[#8b5cf6]' : 'text-gray-500 hover:text-gray-400'}`}
            >
              {t.language} ({progress.completed}/{progress.total})
            </button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <div className="flex bg-black/30 border border-white/5 rounded-lg p-0.5 select-none">
            {(['all', 'filled', 'empty'] as const).map((filter) => (
              <button
                key={filter}
                onClick={() => setStatusFilter(filter)}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all uppercase ${statusFilter === filter ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
              >
                {filter}
              </button>
            ))}
          </div>

          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 text-gray-600" size={14} />
            <input
              placeholder="Search text, GUIDs, or keys..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="bg-white/5 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs w-64 focus:outline-none focus:border-[#8b5cf6]/50"
            />
          </div>

          <button
            onClick={() => thumbnailInputRef.current?.click()}
            className={`flex items-center gap-1.5 px-3 py-2 border rounded-lg text-xs font-bold transition-colors ${thumbnailFile ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-white/5 border-white/10 text-gray-300 hover:bg-white/10'}`}
          >
            <Image size={14} />
            {thumbnailFile ? 'Thumbnail Loaded' : 'Set Thumbnail'}
          </button>

          <button onClick={handleAddString} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">Add</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">Import</button>
          <button onClick={handleExportCSV} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">CSV</button>
          <button onClick={handleExportMod} className="px-3 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-[#8b5cf6]/10">Export .mod</button>
        </div>
      </div>

      {/* Content area */}
      {!isReady ? (
        <TranslationSkeleton />
      ) : (
        <div className="flex-1 flex min-h-0">
          <TranslationLeftPanel
            categories={categoryList}
            activeCategoryId={selectedCategory}
            onSelect={setSelectedCategory}
          />

          {/* Editor grid */}
          <div className="flex-1 overflow-y-auto p-6">
            {filteredEntries.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-2xl">
                <span className="font-medium text-gray-400">No matching translation strings found.</span>
              </div>
            ) : (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                {filteredEntries.map(([guid, text]) => {
                  const refData = referenceStrings[guid]
                  const refText = typeof refData === 'object' ? refData.text : refData || 'Unmapped GUID'
                  const devKey = typeof refData === 'object' ? refData.key : null
                  const isCompleted = (text as string).trim() !== ''

                  return (
                    <div key={guid} className="bg-[#161923] border border-white/5 p-4 rounded-xl flex flex-col gap-2 transition-colors focus-within:border-[#8b5cf6]/30">
                      <div className="flex justify-between items-center text-[10px] text-gray-600 font-mono">
                        <div className="flex items-center gap-2 truncate max-w-[85%]">
                          <span className="shrink-0">{guid}</span>
                          {devKey && (
                            <span className="flex items-center gap-1 bg-white/5 px-1.5 py-0.5 rounded text-gray-400 font-sans truncate" title={devKey}>
                              <Code size={10} className="text-[#a78bfa]" />
                              {devKey}
                            </span>
                          )}
                        </div>
                        {isCompleted
                          ? <CheckCircle className="text-emerald-500 shrink-0" size={14} />
                          : <Warning className="text-amber-500 shrink-0" size={14} />
                        }
                      </div>
                      <p className="text-xs font-medium text-gray-300 leading-relaxed min-h-[1.5rem]">{refText as string}</p>
                      <input
                        value={text as string}
                        onChange={(e) => updateTranslationString(activeTranslation.language, guid, e.target.value)}
                        className="w-full bg-black/20 rounded-lg px-3 py-2 text-sm text-[#a78bfa] font-medium border border-transparent focus:border-[#8b5cf6]/40 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 transition-all"
                        placeholder="Enter translation mapping..."
                      />
                    </div>
                  )
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
