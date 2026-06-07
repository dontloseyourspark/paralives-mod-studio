import './App.css'
import AppRoutes from './routes/AppRoutes'
import React, { useEffect, useState } from 'react'
import { useModStore } from './store/useModStore'

export default function App() {
  const hydrateCacheFromDisk = useModStore((s) => s.hydrateCacheFromDisk)
  const hasHydratedDisk      = useModStore((s) => s.hasHydratedDisk)

  // ── Two-phase boot sequence ────────────────────────────────────────────────
  //
  // Phase 1 (Zustand persist): recentProjects is loaded from localStorage.
  //   Tracked by useModStore.persist.hasHydrated().
  //
  // Phase 2 (IndexedDB): binary file blobs are loaded and object URLs are
  //   generated. Tracked by hasHydratedDisk in the store.
  //
  // We block rendering AppRoutes until BOTH phases complete. This guarantees:
  //   - useProjectWorkspace always finds recentProjects populated on refresh
  //   - getBlobUrlFromCache always hits a warm cache on first render, so
  //     thumbnails and images never flicker or show as missing

  const [persistReady, setPersistReady] = useState(
    () => useModStore.persist.hasHydrated()
  )

  useEffect(() => {
    if (persistReady) return
    const unsub = useModStore.persist.onFinishHydration(() => setPersistReady(true))
    return unsub
  }, [persistReady])

  // Kick off IndexedDB load as soon as the persist phase is done
  useEffect(() => {
    if (persistReady && !hasHydratedDisk) {
      hydrateCacheFromDisk()
    }
  }, [persistReady, hasHydratedDisk, hydrateCacheFromDisk])

  // Both phases must be complete before we render anything
  if (!persistReady || !hasHydratedDisk) {
    return (
      <div className="min-h-screen bg-[#0e1017] flex items-center justify-center">
        <span className="text-xs text-gray-600 font-mono tracking-wider animate-pulse">
          Initialising studio...
        </span>
      </div>
    )
  }

  return <AppRoutes />
}
