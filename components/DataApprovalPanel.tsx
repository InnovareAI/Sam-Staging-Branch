'use client'

import React, { useState } from 'react'
import { Check, X, Eye, Download, AlertTriangle, Users, CheckSquare } from 'lucide-react'
import Modal from './ui/Modal'

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
  workspaceId?: string
}

export default function DataApprovalPanel({
  isVisible,
  onClose,
  prospectData,
  onApprove,
  onReject,
  className = '',
  workspaceId
}: DataApprovalPanelProps) {
  const [dismissedProspects, setDismissedProspects] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('list')

  const dismissProspect = (prospectId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const newDismissed = new Set(dismissedProspects)
    newDismissed.add(prospectId)
    setDismissedProspects(newDismissed)
  }

  const undoDismiss = (prospectId: string, e?: React.MouseEvent) => {
    e?.stopPropagation()
    const newDismissed = new Set(dismissedProspects)
    newDismissed.delete(prospectId)
    setDismissedProspects(newDismissed)
  }

  const clearDismissed = () => {
    setDismissedProspects(new Set())
  }

  const handleApproveAll = () => {
    const approved = prospectData.filter(p => !dismissedProspects.has(p.id))
    const rejected = prospectData.filter(p => dismissedProspects.has(p.id))

    if (approved.length > 0) {
      onApprove(approved)
    }
    if (rejected.length > 0) {
      onReject(rejected)
    }

    setDismissedProspects(new Set())
  }

  const exportData = () => {
    const dataToExport = prospectData.filter(p => !dismissedProspects.has(p.id))
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
    <Modal
      isVisible={isVisible}
      onClose={onClose}
      title="Prospect Data Approval"
      subtitle="Review and approve incoming prospect data"
      icon={<Users size={20} />}
      size="6xl"
      className={className}
    >
      {/* Controls Bar */}
      <div className="bg-surface-highlight/30 px-6 py-4 border-b border-border/60">
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-6">
            <div className="flex items-center gap-3">
              <span className="text-sm text-muted-foreground">
                {prospectData.length} prospects found
              </span>
              <span className="text-xs px-2 py-1 bg-green-500/20 text-green-400 rounded-lg font-medium">
                {prospectData.length - dismissedProspects.size} to approve
              </span>
              {dismissedProspects.size > 0 && (
                <span className="text-xs px-2 py-1 bg-red-500/20 text-red-400 rounded-lg font-medium">
                  {dismissedProspects.size} dismissed
                </span>
              )}
            </div>

            {dismissedProspects.size > 0 && (
              <button
                onClick={clearDismissed}
                className="text-xs px-3 py-1.5 bg-surface-highlight hover:bg-surface border border-border/60 text-foreground rounded-lg transition-colors font-medium"
              >
                Undo All Dismissals
              </button>
            )}
          </div>

          <button
            onClick={exportData}
            disabled={prospectData.length - dismissedProspects.size === 0}
            className="flex items-center space-x-2 px-4 py-2 bg-primary/20 hover:bg-primary/30 disabled:bg-surface-highlight disabled:cursor-not-allowed text-primary disabled:text-muted-foreground rounded-lg transition-colors text-sm font-medium border border-primary/40 disabled:border-border/60"
          >
            <Download size={16} />
            <span>Export CSV</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="p-6 space-y-4 max-h-[50vh] overflow-y-auto">
        {prospectData.map((prospect) => {
          const isDismissed = dismissedProspects.has(prospect.id)

          return (
            <div
              key={prospect.id}
              className={`group p-5 rounded-xl border transition-all duration-200 ${
                isDismissed
                  ? 'border-red-500/40 bg-red-500/5 opacity-50'
                  : 'border-border/60 bg-surface-highlight/50 hover:border-border hover:bg-surface-highlight'
              }`}
            >
              <div className="flex items-start gap-4">
                <div className="flex-1">
                <div className="flex items-center space-x-3 mb-3">
                  <h3 className="text-lg font-semibold text-foreground">
                    {prospect.name}
                  </h3>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                    prospect.source === 'unipile' ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                    prospect.source === 'bright-data' ? 'bg-blue-500/20 text-blue-400 border-blue-500/40' :
                    'bg-purple-500/20 text-purple-400 border-purple-500/40'
                  }`}>
                    {prospect.source}
                  </span>
                  <span className={`px-2 py-1 rounded-lg text-xs font-medium border ${
                    prospect.confidence >= 0.8 ? 'bg-green-500/20 text-green-400 border-green-500/40' :
                    prospect.confidence >= 0.6 ? 'bg-yellow-500/20 text-yellow-400 border-yellow-500/40' :
                    'bg-red-500/20 text-red-400 border-red-500/40'
                  }`}>
                    {Math.round(prospect.confidence * 100)}% confidence
                  </span>
                </div>
                
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
                </div>
                
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
                
                {prospect.complianceFlags && prospect.complianceFlags.length > 0 && (
                  <div className="mt-3 flex items-center space-x-2 p-3 bg-yellow-500/10 border border-yellow-500/40 rounded-lg">
                    <AlertTriangle size={16} className="text-yellow-400" />
                    <div className="text-xs text-yellow-400 font-medium">
                      Compliance flags: {prospect.complianceFlags.join(', ')}
                    </div>
                  </div>
                )}
              </div>

              {/* Dismiss/Undo Button */}
              <div className="flex flex-col gap-2">
                {isDismissed ? (
                  <button
                    onClick={(e) => undoDismiss(prospect.id, e)}
                    className="px-4 py-2 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded-lg transition-colors font-medium border border-green-500/40 text-sm"
                    title="Undo dismissal"
                  >
                    <Check size={16} className="inline mr-1" />
                    Undo
                  </button>
                ) : (
                  <button
                    onClick={(e) => dismissProspect(prospect.id, e)}
                    className="px-4 py-2 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded-lg transition-colors font-medium border border-red-500/40 text-sm"
                    title="Dismiss this prospect"
                  >
                    <X size={16} className="inline mr-1" />
                    Dismiss
                  </button>
                )}
              </div>
            </div>
          </div>
          )
        })}
      </div>

      {/* Footer */}
      <div className="bg-surface-highlight/30 px-6 py-4 border-t border-border/60">
        <div className="flex items-center justify-between">
          <div className="text-sm">
            {dismissedProspects.size > 0 ? (
              <>
                <span className="text-green-400 font-semibold">{prospectData.length - dismissedProspects.size}</span>
                <span className="text-muted-foreground"> prospects will be approved</span>
                <span className="text-muted-foreground ml-2">•</span>
                <span className="text-red-400 font-semibold ml-2">{dismissedProspects.size}</span>
                <span className="text-muted-foreground"> dismissed</span>
              </>
            ) : (
              <>
                <span className="text-green-400 font-semibold">{prospectData.length}</span>
                <span className="text-muted-foreground"> prospects ready to approve</span>
              </>
            )}
          </div>

          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-surface-highlight hover:bg-surface text-muted-foreground hover:text-foreground rounded-lg transition-colors font-medium border border-border/60"
            >
              Cancel
            </button>

            <button
              onClick={handleApproveAll}
              disabled={prospectData.length - dismissedProspects.size === 0}
              className="flex items-center space-x-2 px-6 py-2 bg-green-500/20 hover:bg-green-500/30 disabled:bg-surface-highlight disabled:cursor-not-allowed text-green-400 disabled:text-muted-foreground rounded-lg transition-colors font-medium border border-green-500/40 disabled:border-border/60"
            >
              <CheckSquare size={16} />
              <span>Approve All ({prospectData.length - dismissedProspects.size})</span>
            </button>
          </div>
        </div>
      </div>
    </Modal>
  )
}