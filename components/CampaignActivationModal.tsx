'use client'

import React, { useState } from 'react'
import { CheckCircle, Rocket, X, ExternalLink } from 'lucide-react'

interface CampaignActivationModalProps {
  campaignName: string
  campaignId: string
  prospectCount: number
  hasLinkedInUrls: boolean
  hasLinkedInIds: boolean
  campaignType: 'connector' | 'messenger'
  workspaceId: string
  onClose: () => void
  onActivate: () => void
}

export default function CampaignActivationModal({
  campaignName,
  campaignId,
  prospectCount,
  hasLinkedInUrls,
  hasLinkedInIds,
  campaignType,
  workspaceId,
  onClose,
  onActivate
}: CampaignActivationModalProps) {
  const [isActivating, setIsActivating] = useState(false)

  const handleActivate = async () => {
    setIsActivating(true)
    try {
      // Call the activation endpoint
      const response = await fetch('/api/campaigns/activate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          campaignId,
          workspaceId
        })
      })

      if (response.ok) {
        onActivate()
      } else {
        const error = await response.json()
        alert(`Failed to activate campaign: ${error.error || 'Unknown error'}`)
      }
    } catch (error) {
      console.error('Activation error:', error)
      alert(`Error activating campaign: ${error instanceof Error ? error.message : 'Unknown error'}`)
    } finally {
      setIsActivating(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-background border border-gray-700 rounded-lg w-full max-w-2xl shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-700">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-green-500/20 rounded-full flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-green-400" />
            </div>
            <div>
              <h2 className="text-2xl font-bold text-foreground">Campaign Approved!</h2>
              <p className="text-gray-400 text-sm">Ready to activate and launch</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
            title="Close"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 space-y-6">
          {/* Campaign Details */}
          <div className="space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Campaign Details</h3>
              <div className="bg-surface-muted/50 border border-gray-700 rounded-lg p-4 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Campaign Name:</span>
                  <span className="text-white font-medium">{campaignName}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Prospects:</span>
                  <span className="text-white font-medium">{prospectCount}</span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="text-gray-400">Campaign Type:</span>
                  <span className="text-white font-medium capitalize">{campaignType}</span>
                </div>
              </div>
            </div>

            {/* Status Indicators */}
            <div>
              <h3 className="text-lg font-semibold text-white mb-2">Integration Status</h3>
              <div className="space-y-2">
                {hasLinkedInUrls && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>LinkedIn profile URLs detected</span>
                  </div>
                )}
                {hasLinkedInIds && (
                  <div className="flex items-center gap-2 text-green-400">
                    <CheckCircle className="w-5 h-5" />
                    <span>LinkedIn IDs resolved</span>
                  </div>
                )}
                {!hasLinkedInUrls && !hasLinkedInIds && (
                  <div className="flex items-center gap-2 text-yellow-400">
                    <ExternalLink className="w-5 h-5" />
                    <span>LinkedIn data pending - will sync automatically</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Info Box */}
          <div className="bg-blue-500/10 border border-blue-500/30 rounded-lg p-4">
            <p className="text-blue-300 text-sm">
              💡 <strong>Next Step:</strong> Click "Activate Campaign" to make this campaign live.
              Messages will be sent according to your campaign schedule.
            </p>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-6 border-t border-gray-700 bg-surface-muted/30">
          <button
            onClick={onClose}
            className="px-4 py-2 text-gray-400 hover:text-white transition-colors"
          >
            View in Inactive Tab
          </button>
          <button
            onClick={handleActivate}
            disabled={isActivating}
            className="px-6 py-3 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 text-white font-semibold rounded-lg flex items-center gap-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isActivating ? (
              <>
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Activating...</span>
              </>
            ) : (
              <>
                <Rocket className="w-5 h-5" />
                <span>Activate Campaign</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}
