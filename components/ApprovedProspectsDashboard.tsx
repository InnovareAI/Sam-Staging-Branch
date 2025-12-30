'use client'

import React, { useState, useEffect } from 'react'
import { Users, Download, Plus, Search, Filter, Calendar, Target, ArrowRight, CheckCircle, XCircle } from 'lucide-react'

interface ApprovedProspect {
  id: string
  prospect_id: string
  name: string
  title: string
  company: string
  email?: string
  phone?: string
  linkedin_url?: string
  source_platform: string
  confidence_score: number
  compliance_flags: string[]
  approval_status: string
  approved_at: string
  thread_id: string
  sam_conversation_threads: {
    title: string
    thread_type: string
  }
}

interface ApprovedProspectsDashboardProps {
  onCreateCampaign?: (prospects: ApprovedProspect[]) => void
}

export default function ApprovedProspectsDashboard({ onCreateCampaign }: ApprovedProspectsDashboardProps) {
  const [prospects, setProspects] = useState<ApprovedProspect[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState('')
  const [filterSource, setFilterSource] = useState<string>('all')
  const [sortBy, setSortBy] = useState<'recent' | 'confidence' | 'name'>('recent')

  useEffect(() => {
    loadApprovedProspects()
  }, [])

  const loadApprovedProspects = async () => {
    setLoading(true)
    try {
      const response = await fetch('/api/sam/approved-prospects')
      const data = await response.json()
      
      if (data.success) {
        setProspects(data.data.prospects || [])
      } else {
        console.error('Failed to load approved prospects:', data.error)
      }
    } catch (error) {
      console.error('Error loading approved prospects:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleSelectProspect = (prospectId: string) => {
    const newSelected = new Set(selectedProspects)
    if (newSelected.has(prospectId)) {
      newSelected.delete(prospectId)
    } else {
      newSelected.add(prospectId)
    }
    setSelectedProspects(newSelected)
  }

  const handleSelectAll = () => {
    if (selectedProspects.size === filteredProspects.length) {
      setSelectedProspects(new Set())
    } else {
      setSelectedProspects(new Set(filteredProspects.map(p => p.id)))
    }
  }

  const handleCreateCampaign = () => {
    const selectedProspectData = prospects.filter(p => selectedProspects.has(p.id))
    if (selectedProspectData.length > 0) {
      onCreateCampaign?.(selectedProspectData)
    }
  }

  const handleExportSelected = () => {
    const selectedProspectData = prospects.filter(p => selectedProspects.has(p.id))
    if (selectedProspectData.length === 0) return

    const csvContent = [
      ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn URL', 'Source', 'Confidence', 'Approved At'],
      ...selectedProspectData.map(p => [
        p.name,
        p.title,
        p.company,
        p.email || '',
        p.phone || '',
        p.linkedin_url || '',
        p.source_platform,
        p.confidence_score.toString(),
        p.approved_at
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `approved-prospects-${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    URL.revokeObjectURL(url)
  }

  // Filter and sort prospects
  const filteredProspects = prospects
    .filter(p => {
      if (searchQuery) {
        const query = searchQuery.toLowerCase()
        return p.name.toLowerCase().includes(query) ||
               p.company.toLowerCase().includes(query) ||
               p.title.toLowerCase().includes(query)
      }
      return true
    })
    .filter(p => {
      if (filterSource === 'all') return true
      return p.source_platform === filterSource
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'recent':
          return new Date(b.approved_at).getTime() - new Date(a.approved_at).getTime()
        case 'confidence':
          return b.confidence_score - a.confidence_score
        case 'name':
          return a.name.localeCompare(b.name)
        default:
          return 0
      }
    })

  const uniqueSources = [...new Set(prospects.map(p => p.source_platform))]

  if (loading) {
    return (
      <div className="bg-surface-muted rounded-lg p-8">
        <div className="flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-400"></div>
          <span className="ml-3 text-gray-300">Loading approved prospects...</span>
        </div>
      </div>
    )
  }

  if (prospects.length === 0) {
    return (
      <div className="bg-surface-muted rounded-lg p-8 text-center">
        <Users className="w-16 h-16 text-gray-400 mx-auto mb-4" />
        <h3 className="text-xl font-semibold text-white mb-2">No Approved Prospects Yet</h3>
        <p className="text-gray-400 mb-6">
          Upload and approve some prospect data to get started with your campaigns.
        </p>
        <div className="space-y-3">
          <div className="bg-gray-700 rounded-lg p-4 text-left">
            <h4 className="font-medium text-white mb-2">📊 To get approved prospects:</h4>
            <ol className="space-y-1 text-sm text-gray-300">
              <li>1. Go to "Data Approval" section</li>
              <li>2. Upload CSV or use LinkedIn search</li>
              <li>3. Review and approve prospects</li>
              <li>4. Return here to create campaigns</li>
            </ol>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="bg-surface-muted rounded-lg">
      {/* Header */}
      <div className="border-b border-gray-700 p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-2xl font-semibold text-white flex items-center">
              <CheckCircle className="w-6 h-6 text-green-400 mr-2" />
              Approved Prospects
            </h2>
            <p className="text-gray-400">
              {prospects.length} approved prospects ready for campaigns
            </p>
          </div>
          <div className="flex space-x-3">
            <button
              onClick={handleExportSelected}
              disabled={selectedProspects.size === 0}
              className="flex items-center px-4 py-2 bg-gray-700 hover:bg-gray-600 disabled:bg-surface-muted disabled:text-gray-500 text-white rounded-lg transition-colors"
            >
              <Download className="w-4 h-4 mr-2" />
              Export ({selectedProspects.size})
            </button>
            <button
              onClick={handleCreateCampaign}
              disabled={selectedProspects.size === 0}
              className="flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 disabled:bg-gray-600 disabled:text-gray-400 text-white rounded-lg transition-colors"
            >
              <Plus className="w-4 h-4 mr-2" />
              Create Campaign ({selectedProspects.size})
            </button>
          </div>
        </div>

        {/* Search and Filters */}
        <div className="flex space-x-4">
          <div className="flex-1 relative">
            <Search className="w-4 h-4 absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              placeholder="Search prospects..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-10 pr-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white placeholder-gray-400 focus:outline-none focus:border-purple-500"
            />
          </div>
          
          <select
            value={filterSource}
            onChange={(e) => setFilterSource(e.target.value)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="all">All Sources</option>
            {uniqueSources.map(source => (
              <option key={source} value={source}>{source}</option>
            ))}
          </select>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as any)}
            className="px-4 py-2 bg-gray-700 border border-gray-600 rounded-lg text-white focus:outline-none focus:border-purple-500"
          >
            <option value="recent">Most Recent</option>
            <option value="confidence">Highest Confidence</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {/* Prospects List */}
      <div className="p-6">
        {filteredProspects.length === 0 ? (
          <div className="text-center py-8">
            <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
            <p className="text-gray-400">No prospects match your filters</p>
          </div>
        ) : (
          <>
            {/* Select All */}
            <div className="flex items-center mb-4 pb-4 border-b border-gray-700">
              <input
                type="checkbox"
                checked={selectedProspects.size === filteredProspects.length && filteredProspects.length > 0}
                onChange={handleSelectAll}
                className="mr-3 rounded"
              />
              <span className="text-gray-300">
                Select all ({filteredProspects.length} prospects)
              </span>
              {selectedProspects.size > 0 && (
                <span className="ml-4 text-purple-400 font-medium">
                  {selectedProspects.size} selected
                </span>
              )}
            </div>

            {/* Prospects Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredProspects.map((prospect) => (
                <div
                  key={prospect.id}
                  className={`border rounded-lg p-4 cursor-pointer transition-all ${
                    selectedProspects.has(prospect.id)
                      ? 'border-purple-500 bg-purple-900/20'
                      : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                  }`}
                  onClick={() => handleSelectProspect(prospect.id)}
                >
                  <div className="flex items-start justify-between mb-3">
                    <input
                      type="checkbox"
                      checked={selectedProspects.has(prospect.id)}
                      onChange={() => handleSelectProspect(prospect.id)}
                      className="mt-1"
                      onClick={(e) => e.stopPropagation()}
                    />
                    <div className="flex items-center space-x-2">
                      <span className={`px-2 py-1 text-xs rounded-full ${
                        prospect.confidence_score >= 0.8 ? 'bg-green-900 text-green-300' :
                        prospect.confidence_score >= 0.6 ? 'bg-yellow-900 text-yellow-300' :
                        'bg-red-900 text-red-300'
                      }`}>
                        {Math.round(prospect.confidence_score * 100)}%
                      </span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="font-medium text-foreground">{prospect.name}</h3>
                    <p className="text-sm text-gray-300">{prospect.title}</p>
                    <p className="text-sm text-gray-400">{prospect.company}</p>
                    
                    {prospect.email && (
                      <p className="text-xs text-blue-400">{prospect.email}</p>
                    )}
                    
                    <div className="flex items-center justify-between pt-2">
                      <span className="text-xs text-gray-500 capitalize">
                        {prospect.source_platform}
                      </span>
                      <span className="text-xs text-gray-500">
                        {new Date(prospect.approved_at).toLocaleDateString()}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>
    </div>
  )
}