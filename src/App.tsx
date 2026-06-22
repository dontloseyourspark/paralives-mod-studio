// src/App.tsx
import './App.css'
import AppRoutes from './routes/AppRoutes'
import { useEffect, useState } from 'react'
import { useModStore } from './store/useModStore'

export default function App() {
  const hydrateCacheFromDisk = useModStore((s) => s.hydrateCacheFromDisk)
  const hasHydratedDisk      = useModStore((s) => s.hasHydratedDisk)

  const [persistReady, setPersistReady] = useState(false)

  useEffect(() => {
    // If already hydrated, or nothing to hydrate, proceed immediately
    if (useModStore.persist.hasHydrated()) {
      const t = setTimeout(() => setPersistReady(true), 0)
      return () => clearTimeout(t)
    }

    const unsub = useModStore.persist.onFinishHydration(() => {
      setPersistReady(true)
    })

    // Safety timeout — if onFinishHydration never fires (e.g. empty localStorage),
    // unblock after 300ms so the app doesn't hang forever
    const fallback = setTimeout(() => setPersistReady(true), 300)

    return () => {
      unsub()
      clearTimeout(fallback)
    }
  }, [])

  useEffect(() => {
    if (!persistReady) return
    useModStore.setState({ hasHydratedDisk: false })
    hydrateCacheFromDisk()
  }, [persistReady, hydrateCacheFromDisk])

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