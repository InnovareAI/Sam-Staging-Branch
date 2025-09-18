'use client'

import React from 'react'
import { Switch } from '@/components/ui/switch'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip'
import { Eye, EyeOff, Database, TestTube } from 'lucide-react'
import { useDemoMode } from '@/lib/contexts/DemoContext'

interface DemoModeToggleProps {
  variant?: 'switch' | 'button' | 'badge'
  size?: 'sm' | 'lg'
  showLabel?: boolean
}

export function DemoModeToggle({ 
  variant = 'switch', 
  size = 'sm',
  showLabel = true 
}: DemoModeToggleProps) {
  const { isDemoMode, toggleDemoMode } = useDemoMode()

  if (variant === 'badge') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Badge 
              variant={isDemoMode ? 'default' : 'secondary'}
              className={`cursor-pointer transition-colors ${
                isDemoMode 
                  ? 'bg-orange-100 text-orange-800 hover:bg-orange-200' 
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
              onClick={toggleDemoMode}
            >
              {isDemoMode ? <TestTube className="h-3 w-3 mr-1" /> : <Database className="h-3 w-3 mr-1" />}
              {isDemoMode ? 'Demo Mode' : 'Live Data'}
            </Badge>
          </TooltipTrigger>
          <TooltipContent>
            <p>Currently showing {isDemoMode ? 'demo' : 'live'} data. Click to switch.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  if (variant === 'button') {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              variant={isDemoMode ? 'default' : 'outline'}
              size={size === 'sm' ? 'sm' : 'lg'}
              onClick={toggleDemoMode}
              className={`flex items-center space-x-2 ${
                isDemoMode 
                  ? 'bg-orange-600 hover:bg-orange-700 text-white' 
                  : 'border-gray-300 hover:bg-gray-50'
              }`}
            >
              {isDemoMode ? <TestTube className="h-4 w-4" /> : <Database className="h-4 w-4" />}
              {showLabel && (
                <span>{isDemoMode ? 'Demo Mode' : 'Live Data'}</span>
              )}
            </Button>
          </TooltipTrigger>
          <TooltipContent>
            <p>Switch between demo and live data</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    )
  }

  // Default switch variant
  return (
    <div className="flex items-center space-x-3">
      {showLabel && (
        <div className="flex items-center space-x-2">
          {isDemoMode ? (
            <Eye className="h-4 w-4 text-orange-600" />
          ) : (
            <EyeOff className="h-4 w-4 text-gray-600" />
          )}
          <span className={`text-sm font-medium ${
            isDemoMode ? 'text-orange-800' : 'text-gray-700'
          }`}>
            {isDemoMode ? 'Demo Mode' : 'Live Data'}
          </span>
        </div>
      )}
      
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Switch
              checked={isDemoMode}
              onCheckedChange={toggleDemoMode}
              className={isDemoMode ? 'data-[state=checked]:bg-orange-600' : ''}
            />
          </TooltipTrigger>
          <TooltipContent>
            <p>
              {isDemoMode 
                ? 'Switch to live data from your database' 
                : 'Switch to demo data for testing'
              }
            </p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      
      {isDemoMode && (
        <Badge variant="outline" className="bg-orange-50 text-orange-700 border-orange-200">
          Demo
        </Badge>
      )}
    </div>
  )
}