import './App.css'
import AppRoutes from './routes/AppRoutes'
import React, { useEffect } from 'react'
import { useModStore } from './store/useModStore'

export default function App() {
  const hydrateCacheFromDisk = useModStore((s) => s.hydrateCacheFromDisk)

  useEffect(() => {
    // Rebuild the volatile asset cache map immediately on system start
    hydrateCacheFromDisk()
  }, [hydrateCacheFromDisk])

  return (
    <AppRoutes />
  )
}