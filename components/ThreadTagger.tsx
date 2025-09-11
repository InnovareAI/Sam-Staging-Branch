/**
 * Thread Tagging Component for SAM AI
 * 
 * Allows users to add, remove, and manage tags on conversation threads
 */

'use client'

import React, { useState, useRef, useEffect } from 'react'
import { X, Plus, Tag, Hash } from 'lucide-react'

interface ThreadTaggerProps {
  currentTags: string[]
  onTagsChange: (tags: string[]) => void
  suggestedTags?: string[]
  className?: string
  maxTags?: number
  placeholder?: string
}

// Predefined tag suggestions for sales workflows
const DEFAULT_SUGGESTED_TAGS = [
  // Deal Stages
  'qualified', 'demo-scheduled', 'proposal-sent', 'negotiation', 'closed-won', 'closed-lost',
  
  // Industries  
  'fintech', 'healthcare', 'enterprise', 'startup', 'saas', 'manufacturing',
  
  // Priorities
  'hot-lead', 'warm-lead', 'cold-lead', 'follow-up-needed', 'decision-maker', 'influencer',
  
  // Sources
  'linkedin', 'referral', 'cold-outreach', 'inbound', 'webinar', 'conference',
  
  // Research Types
  'prospect-research', 'company-analysis', 'competitor-intel', 'market-research',
  
  // Methodologies
  'meddic', 'spin', 'challenger', 'discovery', 'objection-handling'
]

export default function ThreadTagger({
  currentTags = [],
  onTagsChange,
  suggestedTags = DEFAULT_SUGGESTED_TAGS,
  className = '',
  maxTags = 10,
  placeholder = 'Add tags...'
}: ThreadTaggerProps) {
  const [isOpen, setIsOpen] = useState(false)
  const [inputValue, setInputValue] = useState('')
  const [filteredSuggestions, setFilteredSuggestions] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  // Filter suggestions based on input
  useEffect(() => {
    if (inputValue.trim()) {
      const filtered = suggestedTags
        .filter(tag => 
          tag.toLowerCase().includes(inputValue.toLowerCase()) &&
          !currentTags.includes(tag)
        )
        .slice(0, 8) // Limit suggestions
      setFilteredSuggestions(filtered)
    } else {
      const recentlyUsed = suggestedTags
        .filter(tag => !currentTags.includes(tag))
        .slice(0, 8)
      setFilteredSuggestions(recentlyUsed)
    }
  }, [inputValue, currentTags, suggestedTags])

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false)
        setInputValue('')
      }
    }

    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  const addTag = (tag: string) => {
    const trimmedTag = tag.trim().toLowerCase()
    if (trimmedTag && !currentTags.includes(trimmedTag) && currentTags.length < maxTags) {
      onTagsChange([...currentTags, trimmedTag])
      setInputValue('')
      setIsOpen(false)
    }
  }

  const removeTag = (tagToRemove: string) => {
    onTagsChange(currentTags.filter(tag => tag !== tagToRemove))
  }

  const handleInputKeyDown = (e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'Enter':
        e.preventDefault()
        if (inputValue.trim()) {
          addTag(inputValue)
        }
        break
      case 'Escape':
        setIsOpen(false)
        setInputValue('')
        break
      case 'Backspace':
        if (!inputValue && currentTags.length > 0) {
          removeTag(currentTags[currentTags.length - 1])
        }
        break
    }
  }

  const getTagColor = (tag: string): string => {
    // Color coding based on tag category
    if (['hot-lead', 'decision-maker', 'qualified'].includes(tag)) return 'bg-red-100 text-red-800'
    if (['warm-lead', 'demo-scheduled', 'follow-up-needed'].includes(tag)) return 'bg-orange-100 text-orange-800'
    if (['cold-lead', 'prospect-research'].includes(tag)) return 'bg-blue-100 text-blue-800'
    if (['closed-won', 'proposal-sent'].includes(tag)) return 'bg-green-100 text-green-800'
    if (['linkedin', 'referral', 'inbound'].includes(tag)) return 'bg-purple-100 text-purple-800'
    if (['meddic', 'spin', 'challenger'].includes(tag)) return 'bg-indigo-100 text-indigo-800'
    return 'bg-gray-100 text-gray-800'
  }

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* Tags Display */}
      <div className="flex flex-wrap gap-2 mb-2">
        {currentTags.map((tag) => (
          <span
            key={tag}
            className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTagColor(tag)}`}
          >
            <Hash size={12} className="mr-1" />
            {tag}
            <button
              onClick={() => removeTag(tag)}
              className="ml-1 hover:bg-black hover:bg-opacity-20 rounded-full p-0.5"
            >
              <X size={12} />
            </button>
          </span>
        ))}
      </div>

      {/* Add Tag Input */}
      <div className="relative">
        <div className="flex items-center space-x-2">
          <div className="relative flex-1">
            <input
              ref={inputRef}
              type="text"
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleInputKeyDown}
              onFocus={() => setIsOpen(true)}
              placeholder={currentTags.length >= maxTags ? `Max ${maxTags} tags reached` : placeholder}
              disabled={currentTags.length >= maxTags}
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent disabled:bg-gray-100 disabled:cursor-not-allowed"
            />
            <Tag className="absolute right-3 top-2.5 h-4 w-4 text-gray-400" />
          </div>
          
          {inputValue.trim() && (
            <button
              onClick={() => addTag(inputValue)}
              className="px-3 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700 transition-colors"
            >
              <Plus size={16} />
            </button>
          )}
        </div>

        {/* Suggestions Dropdown */}
        {isOpen && filteredSuggestions.length > 0 && (
          <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-48 overflow-y-auto">
            <div className="p-2">
              <div className="text-xs font-medium text-gray-500 mb-2">Suggested tags:</div>
              <div className="space-y-1">
                {filteredSuggestions.map((tag) => (
                  <button
                    key={tag}
                    onClick={() => addTag(tag)}
                    className="w-full text-left px-2 py-1 text-sm hover:bg-gray-100 rounded flex items-center space-x-2"
                  >
                    <Hash size={12} className="text-gray-400" />
                    <span>{tag}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tag Count */}
      <div className="mt-2 text-xs text-gray-500">
        {currentTags.length}/{maxTags} tags
      </div>
    </div>
  )
}