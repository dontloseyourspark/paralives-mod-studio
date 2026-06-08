// src/components/TranslationEditorPanel.tsx
import React, { useState, useMemo, useRef } from 'react'
import { useModStore } from '../store/useModStore'
import { Plus, Translate, DownloadSimple, UploadSimple, Package } from 'phosphor-react'
import JSZip from 'jszip'
import englishReference from '../data/englishReference.json'

// Robust CSV parser to handle commas and escaped quotes within text fields
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
          currentCell += '"' 
          i++ 
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
        if (char === '\r' && i + 1 < text.length && text[i + 1] === '\n') {
          i++ 
        }
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
  
  const fileInputRef = useRef<HTMLInputElement>(null)

  const referenceStrings: Record<string, string> = englishReference

  const activeTranslation = translations[activeLangIndex]
  const stringEntries = activeTranslation ? Object.entries(activeTranslation.strings) : []
  
  const progress = useMemo(() => {
    if (!activeTranslation) return { completed: 0, total: 0 }
    const total = stringEntries.length
    const completed = stringEntries.filter(([_, val]) => val.trim() !== '').length
    return { completed, total }
  }, [activeTranslation, stringEntries])

  if (!currentProject) return null

  if (translations.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-gray-500 text-sm gap-3">
        <Translate size={32} weight="light" />
        <span>No translations found in this project.</span>
      </div>
    )
  }

  const handleAddString = () => {
    const newKey = `g${Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000}`
    updateTranslationString(activeTranslation.language, newKey, '')
  }

  const handleExportCSV = () => {
    const rows = [
      ['GUID', 'Source Text', 'Translation'],
      ...stringEntries.map(([guid, text]) => {
        const sourceText = referenceStrings[guid] || ''
        return [guid, `"${sourceText.replace(/"/g, '""')}"`, `"${text.replace(/"/g, '""')}"`]
      })
    ]
    
    const csvContent = rows.map(e => e.join(",")).join("\n")
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${activeTranslation.language}_Translations.csv`
    link.click()
    URL.revokeObjectURL(url)
  }

  const handleImportCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const confirmOverride = window.confirm(
      "Importing this CSV will overwrite your existing translations for matching GUIDs. Are you sure you want to proceed?"
    )

    if (!confirmOverride) {
      e.target.value = ''
      return
    }

    const reader = new FileReader()
    reader.onload = (event) => {
      const text = event.target?.result as string
      if (!text) return

      const parsedRows = parseCSV(text)
      
      const newStrings = { ...activeTranslation.strings }
      
      // Skip header row and extract values
      for (let i = 1; i < parsedRows.length; i++) {
        const row = parsedRows[i]
        if (row.length >= 3) {
          const guid = row[0].trim()
          const translation = row[2]
          
          if (guid.startsWith('g')) {
            newStrings[guid] = translation
          }
        }
      }

      const updatedTranslations = translations.map((t) => 
        t.language === activeTranslation.language 
          ? { ...t, strings: newStrings } 
          : t
      )

      updateProject({
        ...currentProject,
        translations: updatedTranslations,
        updatedAt: new Date().toISOString()
      })
      
      alert('CSV imported successfully!')
    }
    
    reader.readAsText(file)
    e.target.value = '' 
  }

  const handleExportMod = async () => {
    const zip = new JSZip()
    const lang = activeTranslation.language
    const modFolderName = `${lang}.mod`

    const rootFolder = zip.folder(modFolderName)
    if (!rootFolder) return

    const modGuid = Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000
    const modMetaContent = `GUID:${modGuid}\r\nType:401\r\nUpdatedToGameVersion:17287\r\nModName:\r\nEnabled:False\r\nIsSystemMod:False\r\nCreationTime:0\r\nLastEditTime:0\r\nLastUploadTime:0\r\nIsFromWorkshop:False\r\nPublishedFileId:0\r\nCreatorId:\r\n`
    rootFolder.file(`${modFolderName}.meta`, modMetaContent)

    const settingsFolder = rootFolder.folder('Settings')
    const settingGuid = Math.floor(Math.random() * 9000000000000000000) + 1000000000000000000
    const transMetaContent = `GUID:${settingGuid}\r\nType:203\r\nIsSettingType:True\r\nSettingType:Setting.Translations\r\n`
    settingsFolder?.file(`Translations.setting.meta`, transMetaContent)

    let transContent = `#Setting.Translations\r\n =Items\r\n`
    stringEntries.forEach(([key, value]) => {
      if (value.trim() !== '') {
        transContent += `  ${key}\r\n   =Value:${value}\r\n`
      }
    })
    settingsFolder?.file(`Translations.setting`, transContent)

    const blob = await zip.generateAsync({ type: 'blob' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `${modFolderName}.zip`
    link.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="flex flex-col h-full bg-[#161923] text-gray-300">
      {/* Hidden File Input */}
      <input
        type="file"
        accept=".csv"
        ref={fileInputRef}
        onChange={handleImportCSV}
        className="hidden"
      />

      <div className="flex items-center justify-between border-b border-white/10 bg-[#0e1017] px-4">
        <div className="flex">
          {translations.map((t, i) => (
            <button
              key={t.language}
              onClick={() => setActiveLangIndex(i)}
              className={`px-4 py-4 text-xs font-bold uppercase tracking-wider transition-colors outline-none cursor-pointer flex items-center gap-2 ${
                activeLangIndex === i
                  ? 'text-[#8b5cf6] border-b-2 border-[#8b5cf6] bg-white/5'
                  : 'text-gray-500 hover:text-gray-300 bg-transparent border-b-2 border-transparent'
              }`}
            >
              {t.language}
              <span className={`px-1.5 py-0.5 rounded-md text-[10px] ${activeLangIndex === i ? 'bg-[#8b5cf6]/20 text-[#a78bfa]' : 'bg-white/10 text-gray-400'}`}>
                {progress.completed}/{progress.total}
              </span>
            </button>
          ))}
        </div>
        
        <div className="flex items-center gap-2">
          <button
            onClick={handleAddString}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors outline-none cursor-pointer border border-white/10"
          >
            <Plus size={14} weight="bold" />
            Add String
          </button>

          <div className="h-4 w-px bg-white/10 mx-1"></div>

          <button
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors outline-none cursor-pointer border border-white/10"
          >
            <UploadSimple size={14} weight="bold" />
            Import CSV
          </button>

          <button
            onClick={handleExportCSV}
            className="flex items-center gap-2 px-3 py-1.5 bg-white/5 hover:bg-white/10 text-gray-300 rounded-lg text-xs font-semibold transition-colors outline-none cursor-pointer border border-white/10"
          >
            <DownloadSimple size={14} weight="bold" />
            Export CSV
          </button>
          
          <button
            onClick={handleExportMod}
            className="flex items-center gap-2 px-4 py-1.5 bg-[#8b5cf6] hover:bg-[#7c3aed] text-white rounded-lg text-xs font-bold transition-all shadow-lg shadow-[#8b5cf6]/20 outline-none cursor-pointer border-none ml-2"
          >
            <Package size={14} weight="fill" />
            Build .mod Package
          </button>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-6 space-y-4">
        {stringEntries.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-40 text-gray-500 text-sm border-2 border-dashed border-white/5 rounded-2xl">
            <span className="font-medium text-gray-400">No translation strings yet.</span>
            <span className="text-xs mt-1">Click "Add String" to start translating.</span>
          </div>
        ) : (
          stringEntries.map(([guid, text]) => {
            const hasReference = !!referenceStrings[guid]
            const displayText = hasReference ? referenceStrings[guid] : guid
            const isCompleted = text.trim() !== ''

            return (
              <div key={guid} className={`flex flex-col gap-1.5 p-4 rounded-xl border transition-colors focus-within:border-[#8b5cf6]/50 focus-within:bg-[#8b5cf6]/5 ${isCompleted ? 'bg-[#8b5cf6]/10 border-[#8b5cf6]/20' : 'bg-white/5 border-white/5'}`}>
                <div className="flex items-center justify-between">
                  <label className={`text-[11px] font-medium leading-relaxed ${hasReference ? 'text-gray-300' : 'text-gray-500 font-mono tracking-wider uppercase'}`}>
                    {displayText}
                  </label>
                  {!hasReference && (
                    <span className="text-[9px] text-amber-500/70 font-semibold uppercase tracking-widest shrink-0 ml-4">
                      Unmapped GUID
                    </span>
                  )}
                </div>
                <input
                  type="text"
                  value={text}
                  onChange={(e) => 
                    updateTranslationString(activeTranslation.language, guid, e.target.value)
                  }
                  className="bg-transparent border-none focus:outline-none text-sm text-[#a78bfa] placeholder-gray-600 w-full font-medium mt-1"
                  placeholder="Type translation here..."
                />
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}