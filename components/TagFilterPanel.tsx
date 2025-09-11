/**
 * Advanced Tag Filter Panel for SAM AI
 * 
 * Provides sophisticated filtering and tag management for conversation threads
 */

'use client'

import React, { useState, useMemo } from 'react'
import { 
  Filter, 
  X, 
  Hash, 
  Target, 
  Building, 
  User, 
  Zap, 
  Calendar,
  ChevronDown,
  Search
} from 'lucide-react'

interface TagFilterPanelProps {
  allTags: string[]
  selectedTags: string[]
  onTagsChange: (tags: string[]) => void
  threadCounts?: Record<string, number>
  className?: string
}

// Tag categories for better organization
const TAG_CATEGORIES = {
  'Deal Stage': {
    icon: Target,
    color: 'bg-green-100 text-green-800',
    tags: ['qualified', 'demo-scheduled', 'proposal-sent', 'negotiation', 'closed-won', 'closed-lost']
  },
  'Industry': {
    icon: Building,
    color: 'bg-blue-100 text-blue-800',
    tags: ['fintech', 'healthcare', 'enterprise', 'startup', 'saas', 'manufacturing', 'retail', 'education']
  },
  'Lead Priority': {
    icon: Zap,
    color: 'bg-red-100 text-red-800',
    tags: ['hot-lead', 'warm-lead', 'cold-lead', 'decision-maker', 'influencer', 'champion']
  },
  'Source': {
    icon: User,
    color: 'bg-purple-100 text-purple-800',
    tags: ['linkedin', 'referral', 'cold-outreach', 'inbound', 'webinar', 'conference', 'content-marketing']
  },
  'Research': {
    icon: Search,
    color: 'bg-indigo-100 text-indigo-800',
    tags: ['prospect-research', 'company-analysis', 'competitor-intel', 'market-research']
  },
  'Methodology': {
    icon: Calendar,
    color: 'bg-orange-100 text-orange-800',
    tags: ['meddic', 'spin', 'challenger', 'discovery', 'objection-handling', 'follow-up-needed']
  }
}

export default function TagFilterPanel({
  allTags,
  selectedTags,
  onTagsChange,
  threadCounts = {},
  className = ''
}: TagFilterPanelProps) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [expandedCategories, setExpandedCategories] = useState<Set<string>>(new Set(['Deal Stage', 'Lead Priority']))

  // Organize tags by category
  const organizedTags = useMemo(() => {
    const categorized: Record<string, string[]> = {}
    const uncategorized: string[] = []

    // Initialize categories
    Object.keys(TAG_CATEGORIES).forEach(category => {
      categorized[category] = []
    })

    // Categorize existing tags
    allTags.forEach(tag => {
      let categorized_tag = false
      Object.entries(TAG_CATEGORIES).forEach(([category, config]) => {
        if (config.tags.includes(tag)) {
          categorized[category].push(tag)
          categorized_tag = true
        }
      })
      if (!categorized_tag) {
        uncategorized.push(tag)
      }
    })

    // Add uncategorized if any exist
    if (uncategorized.length > 0) {
      categorized['Other'] = uncategorized
    }

    return categorized
  }, [allTags])

  // Filter tags based on search
  const filteredTags = useMemo(() => {
    if (!searchQuery) return organizedTags

    const filtered: Record<string, string[]> = {}
    Object.entries(organizedTags).forEach(([category, tags]) => {
      const matchingTags = tags.filter(tag =>
        tag.toLowerCase().includes(searchQuery.toLowerCase())
      )
      if (matchingTags.length > 0) {
        filtered[category] = matchingTags
      }
    })
    return filtered
  }, [organizedTags, searchQuery])

  const toggleTag = (tag: string) => {
    if (selectedTags.includes(tag)) {
      onTagsChange(selectedTags.filter(t => t !== tag))
    } else {
      onTagsChange([...selectedTags, tag])
    }
  }

  const clearAllTags = () => {
    onTagsChange([])
  }

  const toggleCategory = (category: string) => {
    const newExpanded = new Set(expandedCategories)
    if (newExpanded.has(category)) {
      newExpanded.delete(category)
    } else {
      newExpanded.add(category)
    }
    setExpandedCategories(newExpanded)
  }

  const getCategoryConfig = (category: string) => {
    return TAG_CATEGORIES[category as keyof typeof TAG_CATEGORIES] || {
      icon: Hash,
      color: 'bg-gray-100 text-gray-800',
      tags: []
    }
  }

  const getTagCount = (tag: string) => {
    return threadCounts[tag] || 0
  }

  if (!isExpanded) {
    return (
      <div className={`${className}`}>
        <button
          onClick={() => setIsExpanded(true)}
          className="flex items-center space-x-2 px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 rounded-lg transition-colors"
        >
          <Filter size={16} />
          <span>Filter by Tags</span>
          {selectedTags.length > 0 && (
            <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
              {selectedTags.length}
            </span>
          )}
        </button>
      </div>
    )
  }

  return (
    <div className={`bg-white border border-gray-200 rounded-lg shadow-lg ${className}`}>
      {/* Header */}
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Filter size={16} className="text-gray-600" />
            <h3 className="font-medium text-gray-900">Filter by Tags</h3>
            {selectedTags.length > 0 && (
              <span className="bg-purple-600 text-white text-xs px-2 py-1 rounded-full">
                {selectedTags.length} selected
              </span>
            )}
          </div>
          <div className="flex items-center space-x-2">
            {selectedTags.length > 0 && (
              <button
                onClick={clearAllTags}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                Clear all
              </button>
            )}
            <button
              onClick={() => setIsExpanded(false)}
              className="text-gray-400 hover:text-gray-600"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Search */}
        <div className="mt-3 relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
          <input
            type="text"
            placeholder="Search tags..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
          />
        </div>
      </div>

      {/* Selected Tags */}
      {selectedTags.length > 0 && (
        <div className="p-4 border-b border-gray-200">
          <div className="text-sm font-medium text-gray-700 mb-2">Selected Tags:</div>
          <div className="flex flex-wrap gap-2">
            {selectedTags.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className="inline-flex items-center px-2 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-medium hover:bg-purple-200 transition-colors"
              >
                <Hash size={10} className="mr-1" />
                {tag}
                <X size={10} className="ml-1" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Tag Categories */}
      <div className="max-h-96 overflow-y-auto">
        {Object.entries(filteredTags).map(([category, tags]) => {
          if (tags.length === 0) return null

          const config = getCategoryConfig(category)
          const IconComponent = config.icon
          const isExpanded = expandedCategories.has(category)

          return (
            <div key={category} className="border-b border-gray-100 last:border-b-0">
              <button
                onClick={() => toggleCategory(category)}
                className="w-full flex items-center justify-between p-3 hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center space-x-2">
                  <IconComponent size={16} className="text-gray-600" />
                  <span className="text-sm font-medium text-gray-900">{category}</span>
                  <span className="text-xs text-gray-500">({tags.length})</span>
                </div>
                <ChevronDown
                  size={16}
                  className={`text-gray-400 transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                />
              </button>

              {isExpanded && (
                <div className="px-3 pb-3">
                  <div className="grid grid-cols-1 gap-1">
                    {tags.map((tag) => {
                      const isSelected = selectedTags.includes(tag)
                      const count = getTagCount(tag)

                      return (
                        <button
                          key={tag}
                          onClick={() => toggleTag(tag)}
                          className={`flex items-center justify-between px-2 py-1.5 text-sm rounded transition-colors ${
                            isSelected
                              ? 'bg-purple-100 text-purple-800'
                              : 'hover:bg-gray-100 text-gray-700'
                          }`}
                        >
                          <div className="flex items-center space-x-2">
                            <Hash size={12} className="text-gray-400" />
                            <span>{tag}</span>
                          </div>
                          {count > 0 && (
                            <span className="text-xs text-gray-500 bg-gray-200 px-1.5 py-0.5 rounded-full">
                              {count}
                            </span>
                          )}
                        </button>
                      )
                    })}
                  </div>
                </div>
              )}
            </div>
          )
        })}

        {Object.keys(filteredTags).length === 0 && (
          <div className="p-4 text-center text-gray-500 text-sm">
            {searchQuery ? 'No tags match your search.' : 'No tags available.'}
          </div>
        )}
      </div>
    </div>
  )
}