// src/components/TranslationEditorPanel.tsx
import React, { useState, useMemo, useRef } from 'react'
import { useModStore } from '../store/useModStore'
import { Plus, DownloadSimple, Package, MagnifyingGlass, CheckCircle, Warning, Code } from 'phosphor-react'
import JSZip from 'jszip'
import englishReference from '../data/englishReference.json'

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

export default function TranslationEditorPanel() {
  const currentProject = useModStore((state) => state.currentProject)
  const updateProject = useModStore((state) => state.updateProject)
  const updateTranslationString = useModStore((state) => state.updateTranslationString)
  
  const translations = currentProject?.translations || []
  const [activeLangIndex, setActiveLangIndex] = useState(0)
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState<'all' | 'filled' | 'empty'>('all')
  const fileInputRef = useRef<HTMLInputElement>(null)

  const referenceStrings = englishReference as Record<string, string | { text: string; key: string }>
  const activeTranslation = translations[activeLangIndex]

  const filteredEntries = useMemo(() => {
    if (!activeTranslation) return []
    return Object.entries(activeTranslation.strings).filter(([guid, text]) => {
      const refData = referenceStrings[guid]
      const refText = typeof refData === 'object' ? refData.text : refData || ''
      const devKey = typeof refData === 'object' ? refData.key : ''
      
      const matchesSearch = refText.toLowerCase().includes(search.toLowerCase()) || 
                            text.toLowerCase().includes(search.toLowerCase()) ||
                            devKey.toLowerCase().includes(search.toLowerCase()) ||
                            guid.includes(search)
      
      if (!matchesSearch) return false

      const isCompleted = text.trim() !== ''
      if (statusFilter === 'filled') return isCompleted
      if (statusFilter === 'empty') return !isCompleted
      return true
    })
  }, [activeTranslation, search, statusFilter, referenceStrings])

  const progress = useMemo(() => {
    if (!activeTranslation) return { completed: 0, total: 0 }
    const total = Object.keys(activeTranslation.strings).length
    const completed = Object.values(activeTranslation.strings).filter(val => val.trim() !== '').length
    return { completed, total }
  }, [activeTranslation])

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
          `"${refText.replace(/"/g, '""')}"`, 
          `"${text.replace(/"/g, '""')}"`
        ]
      })
    ]
    const csvContent = rows.map(e => e.join(",")).join("\n")
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

    const confirmOverride = window.confirm(
      "Importing this CSV will overwrite your existing translations for matching GUIDs. Proceed?"
    )
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

      if (guidIndex === -1) {
        alert('Could not map data layout: Column header "GUID" is missing.')
        return
      }

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
        translations: translations.map(t => t.language === activeTranslation.language ? { ...t, strings: newStrings } : t),
        updatedAt: new Date().toISOString()
      })
      alert('CSV dataset synchronized successfully.')
    }
    reader.readAsText(file)
  }

  const handleExportMod = async () => {
    const zip = new JSZip()
    const lang = activeTranslation.language
    const modFolderName = `${lang}.mod`
    const root = zip.folder(modFolderName)
    
    root?.file(`${modFolderName}.meta`, `GUID:${Math.floor(Math.random()*1e18)}\r\nType:401\r\n`)
    const settings = root?.folder('Settings')
    settings?.file(`Translations.setting`, `#Setting.Translations\r\n =Items\r\n` + 
      Object.entries(activeTranslation.strings)
        .filter(([_, v]) => v.trim() !== '')
        .map(([k, v]) => `  ${k}\r\n   =Value:${v}`).join('\r\n')
    )

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${modFolderName}.zip`
    link.click()
  }

  return (
    <div className="flex flex-col h-full bg-[#0e1017] text-gray-300 overflow-hidden">
      <input type="file" accept=".csv" ref={fileInputRef} onChange={handleImportCSV} className="hidden" />
      
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b border-white/10 bg-[#161923] px-4 py-3 shrink-0">
        <div className="flex items-center gap-4">
          {translations.map((t, i) => (
            <button key={t.language} onClick={() => setActiveLangIndex(i)} className={`text-xs font-bold uppercase transition-colors ${activeLangIndex === i ? 'text-[#8b5cf6]' : 'text-gray-500 hover:text-gray-400'}`}>
              {t.language} ({progress.completed}/{progress.total})
            </button>
          ))}
        </div>
        <div className="flex items-center gap-3">
          
          {/* Status Filter Tabs */}
          <div className="flex bg-black/30 border border-white/5 rounded-lg p-0.5 select-none">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${statusFilter === 'all' ? 'bg-white/10 text-white shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              All
            </button>
            <button
              onClick={() => setStatusFilter('filled')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${statusFilter === 'filled' ? 'bg-emerald-500/10 text-emerald-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Filled
            </button>
            <button
              onClick={() => setStatusFilter('empty')}
              className={`px-2.5 py-1 text-[11px] font-semibold rounded-md transition-all ${statusFilter === 'empty' ? 'bg-amber-500/10 text-amber-400 shadow-sm' : 'text-gray-500 hover:text-gray-300'}`}
            >
              Missing
            </button>
          </div>

          <div className="relative">
            <MagnifyingGlass className="absolute left-3 top-2.5 text-gray-600" size={14} />
            <input placeholder="Search text, GUIDs, or keys..." value={search} onChange={(e) => setSearch(e.target.value)} className="bg-white/5 border border-white/5 rounded-lg pl-9 pr-3 py-2 text-xs w-64 focus:outline-none focus:border-[#8b5cf6]/50" />
          </div>
          <button onClick={handleAddString} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">Add</button>
          <button onClick={() => fileInputRef.current?.click()} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">Import</button>
          <button onClick={handleExportCSV} className="px-3 py-2 bg-white/5 hover:bg-white/10 rounded-lg text-xs font-bold transition-colors">CSV</button>
          <button onClick={handleExportMod} className="px-3 py-2 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg text-xs font-bold transition-all shadow-md shadow-[#8b5cf6]/10">Export .mod</button>
        </div>
      </div>

      {/* Editor Grid */}
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
              const isCompleted = text.trim() !== ''

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
                    {isCompleted ? <CheckCircle className="text-emerald-500 shrink-0" size={14} /> : <Warning className="text-amber-500 shrink-0" size={14} />}
                  </div>
                  <p className="text-xs font-medium text-gray-300 leading-relaxed min-h-[1.5rem]">{refText}</p>
                  <input value={text} onChange={(e) => updateTranslationString(activeTranslation.language, guid, e.target.value)} className="w-full bg-black/20 rounded-lg px-3 py-2 text-sm text-[#a78bfa] font-medium border border-transparent focus:border-[#8b5cf6]/40 focus:outline-none focus:ring-1 focus:ring-[#8b5cf6]/30 transition-all" placeholder="Enter translation mapping..." />
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}