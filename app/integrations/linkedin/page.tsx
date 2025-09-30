'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  CheckCircle, 
  AlertCircle, 
  RefreshCw,
  Plus,
  Settings,
  Info,
  Users,
  MessageSquare,
  Shield,
  Clock,
  Bell
} from 'lucide-react'
import LocationIndicator from '@/components/LocationIndicator'
import { LinkedInLogo } from '@/components/ui/LinkedInLogo'
import { WhatsAppLogo } from '@/components/ui/WhatsAppLogo'
import { TelegramLogo } from '@/components/ui/TelegramLogo'
import { TwitterLogo } from '@/components/ui/TwitterLogo'

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
  const [connecting, setConnecting] = useState(false)
  const fetchAccounts = async () => {
    try {
      setError(null)
      
      console.log('🔍 Checking LinkedIn connections via authenticated API...')
      
      // Use authenticated endpoint; requires user to be signed in
      const response = await fetch('/api/unipile/accounts')
      if (response.ok) {
        const data = await response.json()
        console.log('📊 LinkedIn status result:', {
          has_linkedin: data.has_linkedin,
          connection_status: data.connection_status,
          accounts: (data.accounts || []).length
        })
        
        const unipileAccounts = (data.accounts || []) as UnipileAccount[]
        if (data.has_linkedin && unipileAccounts.length > 0) {
          console.log('✅ LinkedIn is connected')
          setAccounts(unipileAccounts)
        } else {
          console.log('❌ No LinkedIn connections found')
          setAccounts([])
        }
        setDuplicates([])
      } else {
        if (response.status === 401) {
          throw new Error('Please sign in to access LinkedIn integration. You need to be logged into SAM AI first.')
        }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        const msg = errorData.error || errorData.debug_info?.error_message || 'Unable to check LinkedIn connection status. Please try again.'
        throw new Error(msg)
      }
    } catch (error) {
      console.error('Error fetching accounts:', error)
      setError(error instanceof Error ? error.message : 'Unable to connect LinkedIn at this time. Please try again.')
      setAccounts([])
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const refreshAccounts = async () => {
    setRefreshing(true)
    await fetchAccounts()
  }

  const handleConnectLinkedIn = async () => {
    try {
      setConnecting(true)
      setError(null)
      
      console.log('🔗 Initiating LinkedIn hosted auth connection...')
      
      // Call our hosted auth endpoint to generate the auth link (requires login)
      const response = await fetch('/api/linkedin/hosted-auth', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include'
      })

      if (!response.ok) {
        if (response.status === 401) {
          throw new Error('Please sign in to generate the LinkedIn authentication link.')
        }
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error(errorData.error || errorData.debug_info?.error_message || 'Failed to generate authentication link')
      }

      const data = await response.json()
      
      if (!data.success || !data.auth_url) {
        throw new Error('Invalid response from authentication service')
      }

      console.log(`✅ Generated hosted auth URL: ${data.auth_url}`)
      console.log(`🔗 Action: ${data.action}, Existing connections: ${data.existing_connections}`)
      
      // Redirect to LinkedIn OAuth authentication
      // This will handle all authentication, 2FA, CAPTCHA, etc.
      window.location.href = data.auth_url
      
    } catch (error) {
      console.error('❌ Error initiating LinkedIn connection:', error)
      setError(error instanceof Error ? error.message : 'Failed to connect LinkedIn')
      setConnecting(false)
    }
  }


  useEffect(() => {
    // Check for hosted auth status in URL parameters
    const urlParams = new URLSearchParams(window.location.search)
    const status = urlParams.get('status')
    
    if (status === 'success') {
      console.log('✅ Hosted auth successful - refreshing accounts')
      // Clear the URL parameter
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    } else if (status === 'failed') {
      console.log('❌ Hosted auth failed')
      setError('LinkedIn connection failed. Please try again.')
      // Clear the URL parameter
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
    
    fetchAccounts()
  }, [])

  const linkedInAccounts = accounts.filter(account => account.type === 'LINKEDIN')
  const hasLinkedInConnections = linkedInAccounts.length > 0


  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold text-[#0A66C2]">LinkedIn Integration</h1>
          <p className="text-muted-foreground mt-2">
            Connect your LinkedIn account to enable prospect enrichment and messaging
          </p>
        </div>
        <Button 
          onClick={refreshAccounts} 
          disabled={refreshing}
          variant="outline"
          className="border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Messages */}
      {loading ? (
        <Card className="border-[#0A66C2]/20 bg-[#0A66C2]/5">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <Info className="h-5 w-5 text-[#0A66C2]" />
              <p className="text-[#0A66C2]/80">Loading your LinkedIn connections...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <AlertCircle className="h-5 w-5 text-red-600" />
                <p className="text-red-800">Error: {error}</p>
              </div>
              {error.includes('sign in') && (
                <Button 
                  onClick={() => window.location.href = '/signin'}
                  className="bg-red-600 hover:bg-red-700 text-white"
                >
                  Sign In
                </Button>
              )}
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
                You can now use SAM AI's prospect features.
              </p>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card className="border-[#0A66C2]/20 bg-[#0A66C2]/5">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <LinkedInLogo size={20} className="text-[#0A66C2]" />
                <p className="text-[#0A66C2]/80">
                  Connect your LinkedIn account to get started with SAM AI
                </p>
              </div>
              <Button 
                onClick={handleConnectLinkedIn}
                disabled={connecting}
                className="bg-[#0A66C2] hover:bg-[#084d94] text-white"
              >
                {connecting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Plus className="h-4 w-4 mr-2" />
                )}
                Connect LinkedIn
              </Button>
            </div>
          </CardContent>
        </Card>
      )}


      {/* Connection Benefits */}
      {!hasLinkedInConnections && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-[#0A66C2]">
              <LinkedInLogo size={20} />
              Why Connect LinkedIn?
            </CardTitle>
            <CardDescription>
              Unlock powerful prospect research and messaging capabilities
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid md:grid-cols-2 gap-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0A66C2]/10 rounded-full flex items-center justify-center">
                    <Users className="h-4 w-4 text-[#0A66C2]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#0A66C2]">Prospect Research</h4>
                    <p className="text-sm text-muted-foreground">
                      Access detailed profile information and company insights
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0A66C2]/10 rounded-full flex items-center justify-center">
                    <MessageSquare className="h-4 w-4 text-[#0A66C2]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#0A66C2]">Smart Messaging</h4>
                    <p className="text-sm text-muted-foreground">
                      Send personalized messages directly through LinkedIn
                    </p>
                  </div>
                </div>
              </div>

              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0A66C2]/10 rounded-full flex items-center justify-center">
                    <Shield className="h-4 w-4 text-[#0A66C2]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#0A66C2]">Secure & Private</h4>
                    <p className="text-sm text-muted-foreground">
                      Your credentials are encrypted and securely stored
                    </p>
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <div className="w-8 h-8 bg-[#0A66C2]/10 rounded-full flex items-center justify-center">
                    <CheckCircle className="h-4 w-4 text-[#0A66C2]" />
                  </div>
                  <div>
                    <h4 className="font-medium text-[#0A66C2]">Easy Setup</h4>
                    <p className="text-sm text-muted-foreground">
                      Connect in just a few clicks with your existing LinkedIn account
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="bg-[#0A66C2]/5 p-4 rounded-lg border border-[#0A66C2]/20">
              <h5 className="font-medium text-[#0A66C2] mb-2">Ready to get started?</h5>
              <p className="text-sm text-[#0A66C2]/80 mb-3">
                Click the button below to connect your LinkedIn account and unlock SAM AI's full potential.
              </p>
              <Button 
                onClick={handleConnectLinkedIn}
                disabled={connecting}
                className="bg-[#0A66C2] hover:bg-[#084d94] text-white"
              >
                {connecting ? (
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LinkedInLogo size={16} className="mr-2" />
                )}
                Connect LinkedIn Account
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Connected Accounts */}
      {linkedInAccounts.length > 0 && (
        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-[#0A66C2]">Connected LinkedIn Accounts</CardTitle>
              <CardDescription>
                Your active LinkedIn accounts integrated with SAM AI
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {linkedInAccounts.map((account) => (
                  <div key={account.id} className="flex items-center justify-between p-4 border border-[#0A66C2]/20 rounded-lg bg-[#0A66C2]/5">
                    <div className="flex items-center gap-3">
                      <LinkedInLogo size={32} className="text-[#0A66C2]" />
                      <div>
                        <div className="font-medium text-[#0A66C2]">{account.name}</div>
                        <div className="text-sm text-muted-foreground">
                          @{account.connection_params?.im?.publicIdentifier || account.connection_params?.im?.username}
                        </div>
                        {account.connection_params?.im?.premiumFeatures && (
                          <div className="flex gap-1 mt-1">
                            {account.connection_params.im.premiumFeatures.map((feature) => (
                              <Badge key={feature} className="text-xs bg-[#0A66C2] text-white">
                                {feature.replace('_', ' ')}
                              </Badge>
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                    <div className="text-right">
                      <Badge 
                        variant={account.sources[0]?.status === 'OK' ? 'default' : 'secondary'}
                        className={account.sources[0]?.status === 'OK' ? 'bg-green-500 text-white' : ''}
                      >
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

          {/* Proxy Location Indicator */}
          <div>
            <h3 className="text-lg font-semibold text-[#0A66C2] mb-2">Proxy Location</h3>
            <p className="text-sm text-muted-foreground mb-3">
              Your current Bright Data proxy location for LinkedIn scraping and messaging
            </p>
            <LocationIndicator />
          </div>
        </div>
      )}


      {/* Help & Support */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-[#0A66C2]">
            <Settings className="h-5 w-5" />
            Need Help?
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Having trouble connecting your LinkedIn account? Here are some quick tips:
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p>• Make sure you're using your correct LinkedIn email and password</p>
            <p>• If LinkedIn asks for verification, complete it in your browser first</p>
            <p>• Premium LinkedIn accounts work best with SAM AI</p>
            <p>• Your credentials are encrypted and stored securely</p>
          </div>
          <div className="flex gap-3 pt-2">
            <Button 
              variant="outline" 
              size="sm"
              onClick={() => window.location.href = '/dashboard/prospect-approval'}
              className="border-[#0A66C2] text-[#0A66C2] hover:bg-[#0A66C2] hover:text-white"
            >
              Return to Prospect Approval
            </Button>
          </div>
        </CardContent>
      </Card>

    </div>
  )
}