'use client'

import { Moon, Sun, Palette, Droplets, Star, Sparkles } from 'lucide-react'
import { useTheme } from 'next-themes'
import { useEffect, useState } from 'react'
import { Button } from '@/components/ui/button'
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'

const themes = [
    { id: 'dark', label: 'Dark', icon: Moon, description: 'Deep blue with purple', isDark: true },
    { id: 'dark-black', label: 'True Black', icon: Star, description: 'OLED pure black', isDark: true },
    { id: 'night-sky', label: 'Night Sky', icon: Sparkles, description: 'Space with comets', isDark: true },
    { id: 'light', label: 'Light - White', icon: Sun, description: 'Clean white & gray', isDark: false },
    { id: 'light-warm', label: 'Light - Cream', icon: Droplets, description: 'Soft cream & ivory', isDark: false },
    { id: 'light-cool', label: 'Light - Ice Blue', icon: Palette, description: 'Modern blue-gray', isDark: false },
]

export function ThemeToggle() {
    const { setTheme, theme } = useTheme()
    const [mounted, setMounted] = useState(false)

    // Prevent hydration mismatch
    useEffect(() => {
        setMounted(true)
    }, [])

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4" />
                <span className="sr-only">Toggle theme</span>
            </Button>
        )
    }

    const currentTheme = themes.find(t => t.id === theme) || themes[0]
    const CurrentIcon = currentTheme.icon

    return (
        <DropdownMenu>
            <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="icon" className="h-9 w-9 relative">
                    <CurrentIcon className="h-4 w-4" />
                    <span className="sr-only">Toggle theme</span>
                </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel className="text-foreground">Choose Theme</DropdownMenuLabel>
                <DropdownMenuSeparator />
                {themes.map(({ id, label, icon: Icon, description, isDark }) => (
                    <DropdownMenuItem
                        key={id}
                        onClick={() => setTheme(id)}
                        className={theme === id ? 'bg-accent' : ''}
                    >
                        <Icon className="mr-2 h-4 w-4 text-foreground" />
                        <div className="flex flex-col">
                            <span className="text-foreground">{label}</span>
                            <span className="text-xs opacity-70">{description}</span>
                        </div>
                    </DropdownMenuItem>
                ))}
            </DropdownMenuContent>
        </DropdownMenu>
    )
}

// Simple dark/light toggle (quick switch between dark and current light theme)
export function ThemeToggleSimple() {
    const { setTheme, theme, resolvedTheme } = useTheme()
    const [mounted, setMounted] = useState(false)
    const [lastLightTheme, setLastLightTheme] = useState('light')

    useEffect(() => {
        setMounted(true)
    }, [])

    useEffect(() => {
        // Remember the last used light theme
        if (theme && theme !== 'dark') {
            setLastLightTheme(theme)
        }
    }, [theme])

    if (!mounted) {
        return (
            <Button variant="ghost" size="icon" className="h-9 w-9">
                <Sun className="h-4 w-4" />
            </Button>
        )
    }

    const isDark = theme === 'dark'

    return (
        <Button
            variant="ghost"
            size="icon"
            className="h-9 w-9"
            onClick={() => setTheme(isDark ? lastLightTheme : 'dark')}
        >
            <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
            <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}
