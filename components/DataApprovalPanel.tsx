'use client'

import React, { useState } from 'react'
import { Check, X, Eye, Download, AlertTriangle } from 'lucide-react'

interface ProspectData {
  id: string
  name: string
  title: string
  company: string
  email?: string
  phone?: string
  linkedinUrl?: string
  source: 'unipile' | 'bright-data' | 'websearch'
  confidence: number
  complianceFlags?: string[]
}

interface DataApprovalPanelProps {
  isVisible: boolean
  onClose: () => void
  prospectData: ProspectData[]
  onApprove: (approvedData: ProspectData[]) => void
  onReject: (rejectedData: ProspectData[]) => void
  className?: string
}

export default function DataApprovalPanel({
  isVisible,
  onClose,
  prospectData,
  onApprove,
  onReject,
  className = ''
}: DataApprovalPanelProps) {
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  if (!isVisible) return null

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
    setSelectedProspects(new Set(prospectData.map(p => p.id)))
  }

  const selectNone = () => {
    setSelectedProspects(new Set())
  }

  const handleApprove = () => {
    const approved = prospectData.filter(p => selectedProspects.has(p.id))
    onApprove(approved)
  }

  const handleReject = () => {
    const rejected = prospectData.filter(p => selectedProspects.has(p.id))
    onReject(rejected)
  }

  const exportData = () => {
    const dataToExport = prospectData.filter(p => selectedProspects.has(p.id))
    const csvContent = [
      ['Name', 'Title', 'Company', 'Email', 'Phone', 'LinkedIn', 'Source', 'Confidence'],
      ...dataToExport.map(p => [
        p.name,
        p.title,
        p.company,
        p.email || '',
        p.phone || '',
        p.linkedinUrl || '',
        p.source,
        p.confidence.toString()
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

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className={`bg-gray-800 rounded-lg shadow-xl max-w-6xl w-full mx-4 max-h-[90vh] overflow-hidden ${className}`}>
        {/* Header */}
        <div className="bg-gray-700 px-6 py-4 border-b border-gray-600">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-white">
              Data Approval - Review Prospect Information
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-white transition-colors"
            >
              <X size={24} />
            </button>
          </div>
          
          <div className="flex items-center justify-between mt-4">
            <div className="flex items-center space-x-4">
              <span className="text-sm text-gray-300">
                {prospectData.length} prospects found • {selectedProspects.size} selected
              </span>
              
              <div className="flex space-x-2">
                <button
                  onClick={selectAll}
                  className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                >
                  Select All
                </button>
                <button
                  onClick={selectNone}
                  className="text-xs px-3 py-1 bg-gray-600 hover:bg-gray-500 text-white rounded transition-colors"
                >
                  Select None
                </button>
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <button
                onClick={exportData}
                disabled={selectedProspects.size === 0}
                className="flex items-center space-x-2 px-3 py-1 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors text-sm"
              >
                <Download size={16} />
                <span>Export</span>
              </button>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 overflow-y-auto max-h-[calc(90vh-200px)]">
          <div className="space-y-4">
            {prospectData.map((prospect) => (
              <div
                key={prospect.id}
                className={`p-4 rounded-lg border transition-colors cursor-pointer ${
                  selectedProspects.has(prospect.id)
                    ? 'border-purple-500 bg-purple-600 bg-opacity-10'
                    : 'border-gray-600 bg-gray-700 hover:border-gray-500'
                }`}
                onClick={() => toggleProspectSelection(prospect.id)}
              >
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-4 flex-1">
                    <div className="flex items-center justify-center w-6 h-6 mt-1">
                      <div className={`w-4 h-4 rounded border-2 flex items-center justify-center ${
                        selectedProspects.has(prospect.id)
                          ? 'border-purple-500 bg-purple-500'
                          : 'border-gray-400'
                      }`}>
                        {selectedProspects.has(prospect.id) && (
                          <Check size={12} className="text-white" />
                        )}
                      </div>
                    </div>
                    
                    <div className="flex-1">
                      <div className="flex items-center space-x-3 mb-2">
                        <h3 className="text-lg font-medium text-white">
                          {prospect.name}
                        </h3>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          prospect.source === 'unipile' ? 'bg-green-600 text-green-100' :
                          prospect.source === 'bright-data' ? 'bg-blue-600 text-blue-100' :
                          'bg-purple-600 text-purple-100'
                        }`}>
                          {prospect.source}
                        </span>
                        <span className={`px-2 py-1 rounded text-xs font-medium ${
                          prospect.confidence >= 0.8 ? 'bg-green-600 text-green-100' :
                          prospect.confidence >= 0.6 ? 'bg-yellow-600 text-yellow-100' :
                          'bg-red-600 text-red-100'
                        }`}>
                          {Math.round(prospect.confidence * 100)}% confidence
                        </span>
                      </div>
                      
                      <div className="grid grid-cols-2 gap-4 text-sm">
                        <div>
                          <span className="text-gray-400">Title:</span>
                          <span className="text-white ml-2">{prospect.title}</span>
                        </div>
                        <div>
                          <span className="text-gray-400">Company:</span>
                          <span className="text-white ml-2">{prospect.company}</span>
                        </div>
                        {prospect.email && (
                          <div>
                            <span className="text-gray-400">Email:</span>
                            <span className="text-white ml-2">{prospect.email}</span>
                          </div>
                        )}
                        {prospect.phone && (
                          <div>
                            <span className="text-gray-400">Phone:</span>
                            <span className="text-white ml-2">{prospect.phone}</span>
                          </div>
                        )}
                      </div>
                      
                      {prospect.linkedinUrl && (
                        <div className="mt-2">
                          <a
                            href={prospect.linkedinUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-blue-400 hover:text-blue-300 text-sm"
                            onClick={(e) => e.stopPropagation()}
                          >
                            View LinkedIn Profile →
                          </a>
                        </div>
                      )}
                      
                      {prospect.complianceFlags && prospect.complianceFlags.length > 0 && (
                        <div className="mt-3 flex items-center space-x-2">
                          <AlertTriangle size={16} className="text-yellow-500" />
                          <div className="text-xs text-yellow-400">
                            Compliance flags: {prospect.complianceFlags.join(', ')}
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-700 px-6 py-4 border-t border-gray-600">
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-300">
              {selectedProspects.size} prospects selected for action
            </div>
            
            <div className="flex space-x-3">
              <button
                onClick={handleReject}
                disabled={selectedProspects.size === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-red-600 hover:bg-red-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                <X size={16} />
                <span>Reject Selected</span>
              </button>
              
              <button
                onClick={handleApprove}
                disabled={selectedProspects.size === 0}
                className="flex items-center space-x-2 px-4 py-2 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed text-white rounded transition-colors"
              >
                <Check size={16} />
                <span>Approve Selected</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}