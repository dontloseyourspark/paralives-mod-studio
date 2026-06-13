// src/App.tsx
import './App.css'
import AppRoutes from './routes/AppRoutes'
import React, { useEffect, useState } from 'react'
import { useModStore } from './store/useModStore'

export default function App() {
  const hydrateCacheFromDisk = useModStore((s) => s.hydrateCacheFromDisk)
  const hasHydratedDisk      = useModStore((s) => s.hasHydratedDisk)

  const [persistReady, setPersistReady] = useState(
    () => useModStore.persist.hasHydrated()
  )

  // Force the database to load the second persist is ready
  useEffect(() => {
    if (persistReady) {
      console.log("🚀 Firing database hydration...")
      
      // CRITICAL FIX: Erase the phantom 'true' flag from the previous session's persist
      useModStore.setState({ hasHydratedDisk: false }) 
      
      // Now the function will actually run instead of skipping itself!
      hydrateCacheFromDisk()
    }
  }, [persistReady, hydrateCacheFromDisk])

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