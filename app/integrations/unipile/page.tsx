'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  LinkedinIcon, 
  CheckCircle, 
  AlertCircle, 
  ExternalLink, 
  RefreshCw,
  Plus,
  Settings,
  Info
} from 'lucide-react'

interface UnipileAccount {
  id: string
  name: string
  type: string
  created_at: string
  sources: Array<{
    id: string
    status: string
  }>
  connection_params?: {
    im?: {
      username: string
      publicIdentifier?: string
      premiumFeatures?: string[]
      organizations?: Array<{
        name: string
        messaging_enabled: boolean
      }>
    }
  }
}

export default function UnipileIntegrationPage() {
  const [accounts, setAccounts] = useState<UnipileAccount[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [duplicates, setDuplicates] = useState<any[]>([])
  const [autoCleanupInProgress, setAutoCleanupInProgress] = useState(false)

  const fetchAccounts = async () => {
    try {
      setError(null)
      const response = await fetch('/api/unipile/accounts')
      if (response.ok) {
        const data = await response.json()
        setAccounts(data.accounts || [])
        setDuplicates(data.duplicates || [])
        
        // Automatically clean up duplicates in the background if detected
        if (data.duplicates_detected > 0) {
          setAutoCleanupInProgress(true)
          setTimeout(async () => {
            try {
              const cleanupResponse = await fetch('/api/unipile/accounts?cleanup=true')
              if (cleanupResponse.ok) {
                const cleanupData = await cleanupResponse.json()
                setAccounts(cleanupData.accounts || [])
                setDuplicates([])
              }
            } catch (error) {
              console.error('Auto cleanup error:', error)
            } finally {
              setAutoCleanupInProgress(false)
            }
          }, 2000) // 2 second delay to let user see the page first
        }
      } else {
        throw new Error('Failed to fetch accounts')
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setError(error instanceof Error ? error.message : 'Unknown error')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshAccounts = async () => {
    setRefreshing(true)
    await fetchAccounts()
  }


  useEffect(() => {
    fetchAccounts()
  }, [])

  const linkedInAccounts = accounts.filter(account => account.type === 'LINKEDIN')
  const hasLinkedInConnections = linkedInAccounts.length > 0

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">Unipile Integration</h1>
          <p className="text-muted-foreground mt-2">
            Connect your LinkedIn accounts to enable prospect enrichment and messaging
          </p>
        </div>
        <Button 
          onClick={refreshAccounts} 
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Messages */}
      {loading ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-blue-600" />
              <p className="text-blue-800">Loading your Unipile connections...</p>
            </div>
          </CardContent>
        </Card>
      ) : autoCleanupInProgress ? (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 text-blue-600 animate-spin" />
              <p className="text-blue-800">Optimizing your LinkedIn connections...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">Error: {error}</p>
            </div>
          </CardContent>
        </Card>
      ) : hasLinkedInConnections ? (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <p className="text-green-800">
                Great! You have {linkedInAccounts.length} LinkedIn account{linkedInAccounts.length !== 1 ? 's' : ''} connected.
                You can now use the Prospect Approval system.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">
                No LinkedIn accounts connected. Please connect your LinkedIn account to use SAM AI's prospect features.
              </p>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Connection Instructions */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <LinkedinIcon className="h-5 w-5" />
            LinkedIn Connection Guide
          </CardTitle>
          <CardDescription>
            Follow these steps to connect your LinkedIn account to Unipile
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                1
              </div>
              <div>
                <h4 className="font-medium">Access Unipile Dashboard</h4>
                <p className="text-sm text-muted-foreground">
                  Open the Unipile dashboard in a new tab to manage your account connections
                </p>
                <Button 
                  className="mt-2" 
                  variant="outline" 
                  size="sm"
                  onClick={() => window.open('https://dashboard.unipile.com', '_blank')}
                >
                  <ExternalLink className="h-4 w-4 mr-2" />
                  Open Unipile Dashboard
                </Button>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                2
              </div>
              <div>
                <h4 className="font-medium">Connect LinkedIn Account</h4>
                <p className="text-sm text-muted-foreground">
                  In the Unipile dashboard, add a new LinkedIn account by providing your credentials
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-sm font-medium text-blue-600">
                3
              </div>
              <div>
                <h4 className="font-medium">Verify Connection</h4>
                <p className="text-sm text-muted-foreground">
                  Return to this page and click "Refresh" to verify your LinkedIn account is connected
                </p>
              </div>
            </div>
          </div>

          <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
            <h5 className="font-medium text-blue-900 mb-2">Important Notes:</h5>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Use your regular LinkedIn login credentials</li>
              <li>• Premium LinkedIn accounts provide enhanced features</li>
              <li>• SAM AI automatically manages your connections and prevents duplicates</li>
              <li>• All data is securely processed through Unipile's platform</li>
            </ul>
          </div>
        </CardContent>
      </Card>

      {/* Connected Accounts */}
      {linkedInAccounts.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Connected LinkedIn Accounts</CardTitle>
            <CardDescription>
              Your active LinkedIn connections through Unipile
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {linkedInAccounts.map((account) => (
                <div key={account.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center gap-3">
                    <LinkedinIcon className="h-8 w-8 text-blue-600" />
                    <div>
                      <div className="font-medium">{account.name}</div>
                      <div className="text-sm text-muted-foreground">
                        @{account.connection_params?.im?.publicIdentifier || account.connection_params?.im?.username}
                      </div>
                      {account.connection_params?.im?.premiumFeatures && (
                        <div className="flex gap-1 mt-1">
                          {account.connection_params.im.premiumFeatures.map((feature) => (
                            <Badge key={feature} variant="secondary" className="text-xs">
                              {feature.replace('_', ' ')}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="text-right">
                    <Badge variant={account.sources[0]?.status === 'OK' ? 'default' : 'secondary'}>
                      {account.sources[0]?.status === 'OK' ? 'Active' : account.sources[0]?.status || 'Unknown'}
                    </Badge>
                    <div className="text-xs text-muted-foreground mt-1">
                      Connected {new Date(account.created_at).toLocaleDateString()}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            If you're having trouble connecting your LinkedIn account or need assistance:
          </p>
          <div className="flex gap-3">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.open('https://docs.unipile.com', '_blank')}
            >
              <ExternalLink className="h-4 w-4 mr-2" />
              Unipile Documentation
            </Button>
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/dashboard/prospect-approval'}
            >
              Return to Prospect Approval
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}