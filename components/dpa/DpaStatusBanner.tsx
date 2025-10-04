'use client'

import { useState, useEffect } from 'react'
import { Shield, AlertTriangle, CheckCircle, Download, X } from 'lucide-react'
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { motion, AnimatePresence } from 'framer-motion'

interface DpaStatus {
  requiresDpa: boolean
  hasSignedDpa: boolean
  dpaVersion: string | null
  daysRemaining: number | null
  isBlocked: boolean
  agreement: {
    id: string
    signed_at: string
    signed_by_name: string
    signed_dpa_pdf_url: string
  } | null
}

interface DpaStatusBannerProps {
  workspaceId: string
  onSignClick?: () => void
}

/**
 * DPA Status Banner Component
 *
 * Displays prominent banner for EU workspaces requiring DPA signature
 * Shows different states:
 * - Not required (no banner)
 * - Pending signature (yellow warning)
 * - Signed (green success, dismissible)
 * - Service blocked (red alert)
 */
export default function DpaStatusBanner({ workspaceId, onSignClick }: DpaStatusBannerProps) {
  const [dpaStatus, setDpaStatus] = useState<DpaStatus | null>(null)
  const [loading, setLoading] = useState(true)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    fetchDpaStatus()
  }, [workspaceId])

  const fetchDpaStatus = async () => {
    try {
      const response = await fetch(`/api/dpa/sign-click-through?workspaceId=${workspaceId}`)
      if (response.ok) {
        const data = await response.json()
        setDpaStatus(data)
      }
    } catch (error) {
      console.error('Failed to fetch DPA status:', error)
    } finally {
      setLoading(false)
    }
  }

  // Don't show banner if loading or not required
  if (loading || !dpaStatus?.requiresDpa) {
    return null
  }

  // Don't show if dismissed (only for signed state)
  if (dismissed && dpaStatus.hasSignedDpa) {
    return null
  }

  // Service blocked state (critical)
  if (dpaStatus.isBlocked) {
    return (
      <Alert variant="destructive" className="mb-6 border-2 border-red-500">
        <AlertTriangle className="h-5 w-5" />
        <AlertTitle className="text-lg font-bold">Service Blocked - DPA Required</AlertTitle>
        <AlertDescription>
          <p className="mb-4">
            Your workspace has been blocked due to an unsigned Data Processing Agreement.
            EU customers must sign a DPA to comply with GDPR regulations.
          </p>
          <Button
            onClick={onSignClick}
            className="bg-red-600 hover:bg-red-700"
          >
            <Shield className="h-4 w-4 mr-2" />
            Sign DPA Now to Restore Service
          </Button>
        </AlertDescription>
      </Alert>
    )
  }

  // Signed state (success, dismissible)
  if (dpaStatus.hasSignedDpa && dpaStatus.agreement) {
    return (
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -20 }}
        >
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle className="h-5 w-5 text-green-600" />
            <div className="flex items-start justify-between w-full">
              <div className="flex-1">
                <AlertTitle className="text-green-900">DPA Signed & Active</AlertTitle>
                <AlertDescription className="text-green-800">
                  <p className="mb-3">
                    Your Data Processing Agreement (v{dpaStatus.dpaVersion}) was signed on{' '}
                    {new Date(dpaStatus.agreement.signed_at).toLocaleDateString()} by{' '}
                    {dpaStatus.agreement.signed_by_name}. Your workspace is GDPR compliant.
                  </p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => window.open(dpaStatus.agreement!.signed_dpa_pdf_url, '_blank')}
                    className="border-green-300 text-green-700 hover:bg-green-100"
                  >
                    <Download className="h-3 w-3 mr-2" />
                    Download Signed DPA PDF
                  </Button>
                </AlertDescription>
              </div>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setDismissed(true)}
                className="text-green-600 hover:text-green-700 hover:bg-green-100"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </Alert>
        </motion.div>
      </AnimatePresence>
    )
  }

  // Pending signature state (warning)
  const daysRemaining = dpaStatus.daysRemaining || 0
  const isUrgent = daysRemaining <= 7

  return (
    <Alert
      variant={isUrgent ? "destructive" : "default"}
      className={`mb-6 border-2 ${
        isUrgent
          ? 'border-red-400 bg-red-50'
          : 'border-yellow-400 bg-yellow-50'
      }`}
    >
      <AlertTriangle className={`h-5 w-5 ${isUrgent ? 'text-red-600' : 'text-yellow-600'}`} />
      <AlertTitle className={`text-lg font-bold ${isUrgent ? 'text-red-900' : 'text-yellow-900'}`}>
        {isUrgent ? '⚠️ Urgent: ' : ''}Data Processing Agreement Signature Required
      </AlertTitle>
      <AlertDescription className={isUrgent ? 'text-red-800' : 'text-yellow-800'}>
        <p className="mb-3">
          Your workspace is located in the EU. GDPR compliance requires a signed
          Data Processing Agreement to continue using SAM AI.
        </p>
        <div className="flex items-center gap-4 mb-4">
          <div className="flex items-center gap-2">
            <span className="font-medium">Deadline:</span>
            <Badge
              variant="outline"
              className={isUrgent ? 'border-red-400' : 'border-yellow-400'}
            >
              {daysRemaining} days remaining
            </Badge>
          </div>
          {isUrgent && (
            <span className="text-sm font-medium">
              Service will be blocked after deadline
            </span>
          )}
        </div>
        <Button
          onClick={onSignClick}
          className={isUrgent ? 'bg-red-600 hover:bg-red-700' : 'bg-yellow-600 hover:bg-yellow-700'}
        >
          <Shield className="h-4 w-4 mr-2" />
          Review & Sign Data Processing Agreement
        </Button>
      </AlertDescription>
    </Alert>
  )
}
