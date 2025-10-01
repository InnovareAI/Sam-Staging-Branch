'use client'

import React, { useState, useMemo } from 'react'
import { Check, X, Users, CheckSquare, Download, AlertTriangle, Filter, Search } from 'lucide-react'
import Modal from './ui/Modal'

export interface ProspectData {
  id: string
  name: string
  title: string
  company: string
  email?: string
  phone?: string
  linkedinUrl?: string
  source: 'linkedin' | 'csv_upload' | 'unipile' | 'bright-data' | 'websearch'
  confidence?: number
  complianceFlags?: string[]
  connectionDegree?: string
  mutualConnections?: number
  location?: string
  industry?: string
}

export interface ApprovalSession {
  session_id: string
  dataset_name: string
  dataset_source: string
  total_count: number
  data_quality_score: number
  completeness_score: number
  duplicate_count?: number
}

interface ProspectApprovalModalProps {
  isVisible: boolean
  onClose: () => void
  prospects: ProspectData[]
  session?: ApprovalSession
  onApprove: (approvedProspects: ProspectData[]) => void
  onReject: (rejectedProspects: ProspectData[]) => void
  title?: string
  subtitle?: string
  showEnrichment?: boolean
}

export default function ProspectApprovalModal({
  isVisible,
  onClose,
  prospects,
  session,
  onApprove,
  onReject,
  title = 'Approve Prospects',
  subtitle = 'Review and approve prospects for your campaign',
  showEnrichment = false
}: ProspectApprovalModalProps) {
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
  const [searchTerm, setSearchTerm] = useState('')
  const [filterConfidence, setFilterConfidence] = useState<'all' | 'high' | 'medium' | 'low'>('all')
  const [filterSource, setFilterSource] = useState<string>('all')

  // Filter prospects based on search and filters
  const filteredProspects = useMemo(() => {
    return prospects.filter(prospect => {
      // Search filter
      if (searchTerm) {
        const search = searchTerm.toLowerCase()
        const matchesSearch = 
          prospect.name.toLowerCase().includes(search) ||
          prospect.title.toLowerCase().includes(search) ||
          prospect.company.toLowerCase().includes(search) ||
          prospect.email?.toLowerCase().includes(search)
        
        if (!matchesSearch) return false
      }

      // Confidence filter
      if (filterConfidence !== 'all' && prospect.confidence !== undefined) {
        if (filterConfidence === 'high' && prospect.confidence < 0.8) return false
        if (filterConfidence === 'medium' && (prospect.confidence < 0.6 || prospect.confidence >= 0.8)) return false
        if (filterConfidence === 'low' && prospect.confidence >= 0.6) return false
      }

      // Source filter
      if (filterSource !== 'all' && prospect.source !== filterSource) return false

      return true
    })
  }, [prospects, searchTerm, filterConfidence, filterSource])

  // Get unique sources for filter dropdown
  const sources = useMemo(() => {
    const uniqueSources = new Set(prospects.map(p => p.source))
    return Array.from(uniqueSources)
  }, [prospects])

  const toggleProspectSelection = (prospectId: string) => {
    const newSelected = new Set(selectedProspects)
    if (newSelected.has(prospectId)) {
      newSelected.delete(prospectId)
    } else {
      newSelected.add(prospectId)
    }
    setSelectedProspects(newSelected)
  }

  const selectAll = () => {
    setSelectedProspects(new Set(filteredProspects.map(p => p.id)))
  }

  const selectNone = () => {
    setSelectedProspects(new Set())
  }

  const handleApprove = () => {
    const approved = prospects.filter(p => selectedProspects.has(p.id))
    onApprove(approved)
    setSelectedProspects(new Set())
  }

  const handleReject = () => {
    const rejected = prospects.filter(p => selectedProspects.has(p.id))
    onReject(rejected)
    setSelectedProspects(new Set())
  }

  const exportData = () => {
    const dataToExport = prospects.filter(p => selectedProspects.has(p.id))
    const csvContent = [
      ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn', 'Source', 'Confidence', 'Location'],
      ...dataToExport.map(p => [
        p.name,
        p.title,
        p.company,
        p.email || '',
        p.phone || '',
        p.linkedinUrl || '',
        p.source,
        p.confidence ? (p.confidence * 100).toFixed(0) + '%' : '',
        p.location || ''
      ])
    ].map(row => row.join(',')).join('\n')

    const blob = new Blob([csvContent], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `prospects_${new Date().toISOString().split('T')[0]}.csv`
    a.click()
    window.URL.revokeObjectURL(url)
  }

  const getConfidenceBadgeStyle = (confidence?: number) => {
    if (!confidence) return 'bg-gray-500/20 text-gray-400 border-gray-500/40'
    if (confidence >= 0.8) return 'bg-green-500/20 text-green-400 border-green-500/40'
    if (confidence >= 0.6) return 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40'
    return 'bg-red-500/20 text-red-400 border-red-500/40'
  }

  const getSourceBadgeStyle = (source: string) => {
    const styles: Record<string, string> = {
      'linkedin': 'bg-blue-500/20 text-blue-400 border-blue-500/40',
      'csv_upload': 'bg-purple-500/20 text-purple-400 border-purple-500/40',
      'unipile': 'bg-green-500/20 text-green-400 border-green-500/40',
      'bright-data': 'bg-orange-500/20 text-orange-400 border-orange-500/40',
      'websearch': 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40'
    }
    return styles[source] || 'bg-gray-500/20 text-gray-400 border-gray-500/40'
  }

  return (
    <Modal
      isVisible={isVisible}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      icon={<Users size={20} />}
      size="6xl"
    >
      {/* Session Info Banner (if available) */}
      {session && (
        <div className="bg-surface-highlight/30 px-6 py-3 border-b border-border/60">
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center space-x-4">
              <span className="text-muted-foreground">
                <span className="font-semibold text-foreground">{session.dataset_name}</span>
              </span>
              <span className="text-muted-foreground">
                Source: <span className="font-medium text-foreground">{session.dataset_source}</span>
              </span>
            </div>
            <div className="flex items-center space-x-4">
              <span className="text-muted-foreground">
                Quality: <span className="font-medium text-green-400">{(session.data_quality_score * 100).toFixed(0)}%</span>
              </span>
              <span className="text-muted-foreground">
                Complete: <span className="font-medium text-blue-400">{(session.completeness_score * 100).toFixed(0)}%</span>
              </span>
              {session.duplicate_count !== undefined && session.duplicate_count > 0 && (
                <span className="text-yellow-400">
                  ⚠️ {session.duplicate_count} duplicates
                </span>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Filters and Search Bar */}
      <div className="bg-surface-highlight/30 px-6 py-4 border-b border-border/60">
        <div className="flex items-center justify-between gap-4">
          {/* Search */}
          <div className="flex-1 relative">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Search by name, title, company, or email..."
              className="w-full pl-10 pr-4 py-2 bg-surface border border-border/60 rounded-lg text-foreground placeholder-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/50 text-sm"
            />
          </div>

          {/* Filters */}
          <div className="flex items-center gap-2">
            <select
              value={filterConfidence}
              onChange={(e) => setFilterConfidence(e.target.value as any)}
              className="px-3 py-2 bg-surface border border-border/60 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Confidence</option>
              <option value="high">High (80%+)</option>
              <option value="medium">Medium (60-80%)</option>
              <option value="low">Low (&lt;60%)</option>
            </select>

            <select
              value={filterSource}
              onChange={(e) => setFilterSource(e.target.value)}
              className="px-3 py-2 bg-surface border border-border/60 rounded-lg text-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
            >
              <option value="all">All Sources</option>
              {sources.map(source => (
                <option key={source} value={source}>{source}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Controls Bar */}
      <div className="bg-surface-highlight/30 px-6 py-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {filteredProspects.length} of {prospects.length} prospects shown
              </span>
              <span className="text-xs px-2 py-1 bg-primary/20 text-primary rounded-lg font-medium">
                {selectedProspects.size} selected
              </span>
            </div>
            
            <div className="flex space-x-2">
              <button
                onClick={selectAll}
                className="text-xs px-3 py-1.5 bg-surface-highlight hover:bg-surface border border-border/60 text-foreground rounded-lg transition-colors font-medium"
              >
                Select All
              </button>
              <button
                onClick={selectNone}
                className="text-xs px-3 py-1.5 bg-surface-highlight hover:bg-surface border border-border/60 text-foreground rounded-lg transition-colors font-medium"
              >
                Clear
              </button>
            </div>
          </div>
          
          <button
            onClick={exportData}
            disabled={selectedProspects.size === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 disabled:bg-surface-highlight disabled:cursor-not-allowed text-primary disabled:text-muted-foreground rounded-lg transition-colors text-sm font-medium border border-primary/40 disabled:border-border/60"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Prospect List */}
      <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
        {filteredProspects.length === 0 ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground text-lg mb-2">No prospects match your filters</p>
            <p className="text-muted-foreground text-sm">Try adjusting your search or filter criteria</p>
          </div>
        ) : (
          filteredProspects.map((prospect) => (
            <div
              key={prospect.id}
              className={`group p-5 rounded-xl border transition-all duration-200 cursor-pointer ${
                selectedProspects.has(prospect.id)
                  ? 'border-primary/60 bg-primary/10 shadow-glow ring-1 ring-primary/30'
                  : 'border-border/60 bg-surface-highlight/50 hover:border-border hover:bg-surface-highlight'
              }`}
              onClick={() => toggleProspectSelection(prospect.id)}
            >
              <div className="flex items-start gap-4">
                {/* Checkbox */}
                <div className="flex items-center justify-center w-6 h-6 mt-0.5">
                  <div className={`w-5 h-5 rounded-lg border-2 flex items-center justify-center transition-colors ${
                    selectedProspects.has(prospect.id)
                      ? 'border-primary bg-primary'
                      : 'border-border/60 group-hover:border-primary/60'
                  }`}>
                    {selectedProspects.has(prospect.id) && (
                      <Check size={12} className="text-white" />
                    )}
                  </div>
                </div>
                
                {/* Prospect Details */}
                <div className="flex-1">
                  {/* Header with name and badges */}
                  <div className="flex items-center space-x-3 mb-3 flex-wrap gap-2">
                    <h3 className="text-lg font-semibold text-foreground">
                      {prospect.name}
                    </h3>
                    <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getSourceBadgeStyle(prospect.source)}`}>
                      {prospect.source}
                    </span>
                    {prospect.confidence !== undefined && (
                      <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${getConfidenceBadgeStyle(prospect.confidence)}`}>
                        {Math.round(prospect.confidence * 100)}% match
                      </span>
                    )}
                    {prospect.connectionDegree && (
                      <span className="px-2 py-1 rounded-lg text-xs font-medium border bg-indigo-500/20 text-indigo-400 border-indigo-500/40">
                        {prospect.connectionDegree} connection
                      </span>
                    )}
                  </div>
                  
                  {/* Details Grid */}
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <span className="text-muted-foreground">Title:</span>
                      <span className="text-foreground ml-2 font-medium">{prospect.title}</span>
                    </div>
                    <div>
                      <span className="text-muted-foreground">Company:</span>
                      <span className="text-foreground ml-2 font-medium">{prospect.company}</span>
                    </div>
                    {prospect.email && (
                      <div>
                        <span className="text-muted-foreground">Email:</span>
                        <span className="text-foreground ml-2 font-medium">{prospect.email}</span>
                      </div>
                    )}
                    {prospect.phone && (
                      <div>
                        <span className="text-muted-foreground">Phone:</span>
                        <span className="text-foreground ml-2 font-medium">{prospect.phone}</span>
                      </div>
                    )}
                    {prospect.location && (
                      <div>
                        <span className="text-muted-foreground">Location:</span>
                        <span className="text-foreground ml-2 font-medium">{prospect.location}</span>
                      </div>
                    )}
                    {prospect.industry && (
                      <div>
                        <span className="text-muted-foreground">Industry:</span>
                        <span className="text-foreground ml-2 font-medium">{prospect.industry}</span>
                      </div>
                    )}
                    {prospect.mutualConnections !== undefined && prospect.mutualConnections > 0 && (
                      <div>
                        <span className="text-muted-foreground">Mutual Connections:</span>
                        <span className="text-foreground ml-2 font-medium">{prospect.mutualConnections}</span>
                      </div>
                    )}
                  </div>
                  
                  {/* LinkedIn Link */}
                  {prospect.linkedinUrl && (
                    <div className="mt-3">
                      <a
                        href={prospect.linkedinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-primary hover:text-primary/80 text-sm font-medium transition-colors"
                        onClick={(e) => e.stopPropagation()}
                      >
                        View LinkedIn Profile →
                      </a>
                    </div>
                  )}
                  
                  {/* Compliance Flags */}
                  {prospect.complianceFlags && prospect.complianceFlags.length > 0 && (
                    <div className="mt-3 flex items-center space-x-2 p-3 bg-yellow-500/10 border border-yellow-500/40 rounded-lg">
                      <AlertTriangle size={16} className="text-yellow-400" />
                      <div className="text-xs text-yellow-400 font-medium">
                        Compliance: {prospect.complianceFlags.join(', ')}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Footer Actions */}
      <div className="bg-surface-highlight/30 px-6 py-4 border-t border-border/60">
        <div className="flex items-center justify-between">
          <div className="text-sm text-muted-foreground">
            {selectedProspects.size} prospects selected for action
          </div>
          
          <div className="flex space-x-3">
            <button
              onClick={handleReject}
              disabled={selectedProspects.size === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-red-500/20 hover:bg-red-500/30 disabled:bg-surface-highlight disabled:cursor-not-allowed text-red-400 disabled:text-muted-foreground rounded-lg transition-colors font-medium border border-red-500/40 disabled:border-border/60"
            >
              <X size={16} />
              <span>Reject Selected</span>
            </button>
            
            <button
              onClick={handleApprove}
              disabled={selectedProspects.size === 0}
              className="flex items-center space-x-2 px-4 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:bg-surface-highlight disabled:cursor-not-allowed text-green-400 disabled:text-muted-foreground rounded-lg transition-colors font-medium border border-green-500/40 disabled:border-border/60"
            >
              <CheckSquare size={16} />
              <span>Approve Selected</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}
