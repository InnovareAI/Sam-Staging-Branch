'use client'

import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'

export function NightSkyEffect() {
    const { theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    useEffect(() => {
        setMounted(true)
    }, [])

    // Only render for night-sky theme
    if (!mounted || theme !== 'night-sky') {
        return null
    }

    return (
        <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden">
            {/* Comet 1 - Main shooting star */}
            <div
                className="absolute h-[1px] w-24 bg-gradient-to-r from-transparent via-white/40 to-transparent"
                style={{
                    animation: 'comet 12s linear infinite',
                    top: '-10px',
                    right: '-100px',
                }}
            />
            {/* Comet 2 - Smaller, delayed */}
            <div
                className="absolute h-[1px] w-16 bg-gradient-to-r from-transparent via-white/25 to-transparent"
                style={{
                    animation: 'comet-2 18s linear infinite',
                    animationDelay: '6s',
                    top: '-5px',
                    right: '-80px',
                }}
            />
            {/* Comet 3 - Very subtle, longer delay */}
            <div
                className="absolute h-[1px] w-12 bg-gradient-to-r from-transparent via-blue-200/20 to-transparent"
                style={{
                    animation: 'comet 25s linear infinite',
                    animationDelay: '14s',
                    top: '-8px',
                    right: '-60px',
                }}
            />
        </div>
    )
}
