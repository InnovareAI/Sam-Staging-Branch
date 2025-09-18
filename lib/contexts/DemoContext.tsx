'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface DemoContextType {
  isDemoMode: boolean
  setDemoMode: (mode: boolean) => void
  toggleDemoMode: () => void
}

const DemoContext = createContext<DemoContextType | undefined>(undefined)

export function DemoProvider({ children }: { children: React.ReactNode }) {
  const [isDemoMode, setIsDemoMode] = useState(false)

  // Load demo mode from localStorage on mount
  useEffect(() => {
    const savedDemoMode = localStorage.getItem('sam-demo-mode')
    if (savedDemoMode === 'true') {
      setIsDemoMode(true)
    }
  }, [])

  const setDemoMode = (mode: boolean) => {
    setIsDemoMode(mode)
    localStorage.setItem('sam-demo-mode', mode.toString())
  }

  const toggleDemoMode = () => {
    const newMode = !isDemoMode
    setDemoMode(newMode)
  }

  return (
    <DemoContext.Provider value={{ isDemoMode, setDemoMode, toggleDemoMode }}>
      {children}
    </DemoContext.Provider>
  )
}

export function useDemoMode() {
  const context = useContext(DemoContext)
  if (context === undefined) {
    throw new Error('useDemoMode must be used within a DemoProvider')
  }
  return context
}