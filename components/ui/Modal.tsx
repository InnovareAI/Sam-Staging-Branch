'use client'

import React from 'react'
import { X } from 'lucide-react'

interface ModalProps {
  isVisible: boolean
  onClose: () => void
  title: string
  subtitle?: string
  icon?: React.ReactNode
  children: React.ReactNode
  className?: string
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '4xl' | '6xl'
  showCloseButton?: boolean
}

export default function Modal({
  isVisible,
  onClose,
  title,
  subtitle,
  icon,
  children,
  className = '',
  size = '2xl',
  showCloseButton = true
}: ModalProps) {
  if (!isVisible) return null

  const sizeClasses = {
    sm: 'max-w-sm',
    md: 'max-w-md', 
    lg: 'max-w-lg',
    xl: 'max-w-xl',
    '2xl': 'max-w-2xl',
    '4xl': 'max-w-4xl',
    '6xl': 'max-w-6xl'
  }

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className={`bg-surface border border-border/60 rounded-xl shadow-2xl ${sizeClasses[size]} w-full max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-surface-highlight/50 px-6 py-5 border-b border-border/60">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              {icon && (
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/20 text-primary">
                  {icon}
                </div>
              )}
              <div>
                <h2 className="text-xl font-semibold text-foreground">
                  {title}
                </h2>
                {subtitle && (
                  <p className="text-sm text-muted-foreground mt-1">
                    {subtitle}
                  </p>
                )}
              </div>
            </div>
            {showCloseButton && (
              <button
                onClick={onClose}
                className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-surface-highlight hover:text-foreground"
              >
                <X size={18} />
              </button>
            )}
          </div>
        </div>

        {/* Content */}
        <div className="overflow-y-auto max-h-[calc(90vh-100px)]">
          {children}
        </div>
      </div>
    </div>
  )
}