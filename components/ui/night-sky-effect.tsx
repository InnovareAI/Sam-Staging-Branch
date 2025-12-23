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
            {/* Starfield - subtle dots */}
            <div
                className="absolute inset-0"
                style={{
                    backgroundImage: `
                        radial-gradient(1px 1px at 20px 30px, white, transparent),
                        radial-gradient(1px 1px at 40px 70px, rgba(255,255,255,0.8), transparent),
                        radial-gradient(1px 1px at 50px 160px, rgba(255,255,255,0.6), transparent),
                        radial-gradient(1px 1px at 90px 40px, white, transparent),
                        radial-gradient(1px 1px at 130px 80px, rgba(255,255,255,0.7), transparent),
                        radial-gradient(2px 2px at 160px 120px, rgba(200,220,255,0.9), transparent),
                        radial-gradient(1px 1px at 200px 50px, white, transparent),
                        radial-gradient(1px 1px at 250px 180px, rgba(255,255,255,0.5), transparent),
                        radial-gradient(1px 1px at 300px 30px, rgba(255,255,255,0.8), transparent),
                        radial-gradient(2px 2px at 350px 90px, rgba(180,200,255,0.8), transparent),
                        radial-gradient(1px 1px at 400px 150px, white, transparent),
                        radial-gradient(1px 1px at 450px 70px, rgba(255,255,255,0.6), transparent),
                        radial-gradient(1px 1px at 500px 200px, rgba(255,255,255,0.7), transparent),
                        radial-gradient(1px 1px at 550px 40px, white, transparent),
                        radial-gradient(2px 2px at 600px 130px, rgba(200,210,255,0.9), transparent)
                    `,
                    backgroundSize: '650px 220px',
                    opacity: 0.6
                }}
            />

            {/* Comet 1 - Main shooting star - BIGGER and BRIGHTER */}
            <div
                className="absolute h-[2px] w-40 bg-gradient-to-r from-transparent via-white to-cyan-200/50"
                style={{
                    animation: 'comet 6s linear infinite',
                    top: '10%',
                    right: '-200px',
                    boxShadow: '0 0 6px 2px rgba(255,255,255,0.5)',
                }}
            />
            {/* Comet 2 - Secondary shooting star */}
            <div
                className="absolute h-[2px] w-32 bg-gradient-to-r from-transparent via-cyan-100 to-blue-200/40"
                style={{
                    animation: 'comet-2 9s linear infinite',
                    animationDelay: '3s',
                    top: '25%',
                    right: '-150px',
                    boxShadow: '0 0 4px 1px rgba(100,200,255,0.4)',
                }}
            />
            {/* Comet 3 - Third shooting star */}
            <div
                className="absolute h-[1px] w-24 bg-gradient-to-r from-transparent via-white/70 to-blue-100/30"
                style={{
                    animation: 'comet 8s linear infinite',
                    animationDelay: '5s',
                    top: '60%',
                    right: '-120px',
                    boxShadow: '0 0 3px 1px rgba(255,255,255,0.3)',
                }}
            />
        </div>
    )
}
