// src/components/ExportResultModal.tsx
//
// Shown after the workspace's Export Mod finishes. New modders' single biggest
// post-export question is "now what?" — so the success state walks through
// installing the downloaded zip into the game's mods folder. The error state
// replaces the old bare alert() with a message plus a recovery hint.
//
// The success state can be suppressed via "Don't show this again"
// (localStorage flag, checked by WorkspaceHeader). Errors always show.

import { useEffect, useState } from 'react'
import { X, CheckCircle, WarningCircle, Copy, Check } from 'phosphor-react'

export const HIDE_EXPORT_INSTRUCTIONS_KEY = 'plms_hide_export_instructions'

// Validated macOS mods folder (see CLAUDE.md). The Windows location hasn't been
// verified against a real install, so the copy stays honest and generic there.
const MAC_MODS_PATH = '~/Library/Application Support/com.paralives.paralives'

export type ExportResult =
  | { status: 'success'; filename?: string }
  | { status: 'error'; message: string }

interface ExportResultModalProps {
  result: ExportResult
  onClose: () => void
}

export default function ExportResultModal({ result, onClose }: ExportResultModalProps) {
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleCopyPath = async () => {
    await navigator.clipboard.writeText(MAC_MODS_PATH)
    setCopied(true)
    window.setTimeout(() => setCopied(false), 2000)
  }

  const handleDontShowAgain = () => {
    localStorage.setItem(HIDE_EXPORT_INSTRUCTIONS_KEY, '1')
    onClose()
  }

  const isSuccess = result.status === 'success'

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm animate-in fade-in duration-150"
      onClick={onClose}
    >
      <div
        className="w-full max-w-lg bg-[#0e1017] border border-white/6 rounded-3xl shadow-2xl flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 max-h-[85vh]"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-white/5 shrink-0">
          <div className="flex items-center gap-2.5">
            {isSuccess ? (
              <CheckCircle size={20} weight="fill" className="text-emerald-400" />
            ) : (
              <WarningCircle size={20} weight="fill" className="text-rose-400" />
            )}
            <span className="text-sm font-bold text-white">
              {isSuccess ? 'Mod exported!' : 'Export failed'}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg hover:bg-white/6 text-gray-500 hover:text-white cursor-pointer transition-colors bg-transparent border-none outline-none"
          >
            <X size={16} weight="bold" />
          </button>
        </div>

        {/* Body */}
        <div className="px-6 py-5 overflow-y-auto flex flex-col gap-4">
          {isSuccess ? (
            <>
              <p className="text-sm text-gray-400 leading-relaxed m-0">
                {result.filename
                  ? <>Your mod downloaded as <span className="text-gray-300 font-mono text-[12px]">{result.filename}</span>.</>
                  : 'Your mod downloaded as a .zip file.'}{' '}
                To play it in Paralives:
              </p>

              <ol className="m-0 pl-0 list-none flex flex-col gap-2.5">
                {[
                  <>Unzip the download — inside is a folder ending in <span className="text-gray-300 font-mono text-[12px]">.mod</span>.</>,
                  <>Move that <span className="text-gray-300 font-mono text-[12px]">.mod</span> folder into your Paralives mods folder.</>,
                  <>Launch Paralives and enable the mod in the Mods menu.</>,
                ].map((step, i) => (
                  <li key={i} className="flex items-start gap-3 text-sm text-gray-400 leading-relaxed">
                    <span className="w-5 h-5 rounded-full bg-[#8b5cf6]/15 text-[#a78bfa] text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">
                      {i + 1}
                    </span>
                    <span>{step}</span>
                  </li>
                ))}
              </ol>

              <div className="flex flex-col gap-1.5">
                <span className="text-[10px] font-bold uppercase tracking-wider text-gray-500">
                  Mods folder on macOS
                </span>
                <div className="flex items-center gap-2 bg-white/3 border border-white/8 rounded-xl px-3 py-2.5">
                  <code className="flex-1 text-[11px] text-gray-300 font-mono truncate">{MAC_MODS_PATH}</code>
                  <button
                    onClick={handleCopyPath}
                    title="Copy path"
                    className={`flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] font-semibold transition-colors cursor-pointer outline-none border-none shrink-0 ${
                      copied
                        ? 'bg-emerald-500/15 text-emerald-400'
                        : 'bg-white/5 hover:bg-[#8b5cf6]/20 text-gray-400 hover:text-[#a78bfa]'
                    }`}
                  >
                    {copied ? <Check size={11} weight="bold" /> : <Copy size={11} />}
                    {copied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <p className="text-[11px] text-gray-600 leading-relaxed m-0">
                  In Finder: <span className="text-gray-500">Go → Go to Folder…</span> and paste the path.
                  Playing on Windows? The mods folder lives in the game's data directory — check the
                  Paralives modding docs for the exact location.
                </p>
              </div>
            </>
          ) : (
            <>
              <p className="text-sm text-gray-400 leading-relaxed m-0">{result.message}</p>
              <p className="text-[12px] text-gray-500 leading-relaxed m-0">
                Try exporting again. If it keeps failing, go back to the dashboard and re-open the
                project — or, for imported mods, re-import the original mod file and re-apply your
                changes.
              </p>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-white/5 shrink-0">
          {isSuccess ? (
            <button
              onClick={handleDontShowAgain}
              className="text-[11px] text-gray-600 hover:text-gray-400 transition-colors cursor-pointer bg-transparent border-none outline-none p-0"
            >
              Don't show this again
            </button>
          ) : <span />}
          <button
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-[#8b5cf6] hover:bg-[#7c3aed] text-xs font-semibold text-white cursor-pointer transition-colors outline-none border-none"
          >
            {isSuccess ? 'Got it' : 'Close'}
          </button>
        </div>
      </div>
    </div>
  )
}
