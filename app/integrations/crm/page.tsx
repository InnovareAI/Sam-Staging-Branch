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
  Database,
  Link as LinkIcon,
  Shield
} from 'lucide-react'
import { createClient } from '@/utils/supabase/client'

interface CRMConnection {
  id: string
  crm_type: string
  crm_account_name: string
  status: string
  connected_at: string
  last_synced_at: string | null
}

export default function CRMIntegrationsPage() {
  const [connections, setConnections] = useState<CRMConnection[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [connecting, setConnecting] = useState<string | null>(null)
  const [workspaceId, setWorkspaceId] = useState<string | null>(null)

  const supabase = createClient()

  const fetchWorkspaceAndConnections = async () => {
    try {
      setError(null)

      // Get current user
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        throw new Error('Please sign in to manage CRM integrations')
      }

      // Get user's workspace
      const { data: memberData, error: memberError } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('user_id', user.id)
        .limit(1)
        .single()

      if (memberError || !memberData) {
        throw new Error('No workspace found. Please create a workspace first.')
      }

      setWorkspaceId(memberData.workspace_id)

      // Fetch CRM connections for this workspace
      const { data: connectionsData, error: connectionsError } = await supabase
        .from('crm_connections')
        .select('*')
        .eq('workspace_id', memberData.workspace_id)
        .order('connected_at', { ascending: false })

      if (connectionsError) {
        throw connectionsError
      }

      setConnections(connectionsData || [])
    } catch (err) {
      console.error('Error fetching connections:', err)
      setError(err instanceof Error ? err.message : 'Failed to load CRM connections')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }

  const handleConnect = async (crmType: string) => {
    if (!workspaceId) {
      setError('No workspace found. Please refresh the page.')
      return
    }

    try {
      setConnecting(crmType)
      setError(null)

      // Call OAuth initiation endpoint
      const response = await fetch('/api/crm/oauth/initiate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          workspace_id: workspaceId,
          crm_type: crmType
        })
      })

      if (!response.ok) {
        const errorData = await response.json()
        throw new Error(errorData.error || 'Failed to initiate connection')
      }

      const data = await response.json()

      if (!data.auth_url) {
        throw new Error('Invalid response from server')
      }

      // Redirect to OAuth authorization page
      window.location.href = data.auth_url

    } catch (err) {
      console.error('Error connecting CRM:', err)
      setError(err instanceof Error ? err.message : 'Failed to connect CRM')
      setConnecting(null)
    }
  }

  const refreshConnections = async () => {
    setRefreshing(true)
    await fetchWorkspaceAndConnections()
  }

  useEffect(() => {
    fetchWorkspaceAndConnections()

    // Check for connection status in URL
    const urlParams = new URLSearchParams(window.location.search)
    const connected = urlParams.get('crm_connected')
    const crmError = urlParams.get('crm_error')

    if (connected) {
      // Clear URL parameter
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    } else if (crmError) {
      setError(`Connection failed: ${crmError}`)
      const newUrl = window.location.pathname
      window.history.replaceState({}, '', newUrl)
    }
  }, [])

  const crmTypes = [
    {
      type: 'hubspot',
      name: 'HubSpot',
      description: 'Powerful CRM for sales and marketing',
      color: 'bg-orange-500'
    },
    {
      type: 'activecampaign',
      name: 'ActiveCampaign',
      description: 'Email marketing and CRM automation',
      color: 'bg-blue-500'
    },
    {
      type: 'airtable',
      name: 'Airtable',
      description: 'Flexible database and CRM platform',
      color: 'bg-yellow-500'
    }
  ]

  const getConnection = (crmType: string) => connections.find(c => c.crm_type === crmType)

  return (
    <div className="container mx-auto p-6 max-w-4xl space-y-6">
      {/* Header */}
      <div className="flex justify-between items-start">
        <div>
          <h1 className="text-3xl font-bold">CRM Integrations</h1>
          <p className="text-muted-foreground mt-2">
            Connect your CRM platforms to enable bi-directional contact sync
          </p>
        </div>
        <Button
          onClick={refreshConnections}
          disabled={refreshing}
          variant="outline"
        >
          <RefreshCw className={`h-4 w-4 mr-2 ${refreshing ? 'animate-spin' : ''}`} />
          Refresh
        </Button>
      </div>

      {/* Status Messages */}
      {loading ? (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <RefreshCw className="h-5 w-5 animate-spin" />
              <p>Loading your CRM connections...</p>
            </div>
          </CardContent>
        </Card>
      ) : error ? (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <div className="flex items-center gap-3">
              <AlertCircle className="h-5 w-5 text-red-600" />
              <p className="text-red-800">{error}</p>
            </div>
          </CardContent>
        </Card>
      ) : null}

      {/* CRM Connection Cards */}
      <div className="space-y-4">
        {crmTypes.map((crm) => {
          const connection = getConnection(crm.type)
          const isConnected = !!connection
          const isConnecting = connecting === crm.type

          return (
            <Card key={crm.type}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className={`w-10 h-10 ${crm.color} rounded-lg flex items-center justify-center text-white font-bold`}>
                      {crm.name.charAt(0)}
                    </div>
                    <div>
                      <CardTitle>{crm.name}</CardTitle>
                      <CardDescription>{crm.description}</CardDescription>
                    </div>
                  </div>
                  {isConnected ? (
                    <Badge variant="default" className="bg-green-500">
                      <CheckCircle className="h-3 w-3 mr-1" />
                      Connected
                    </Badge>
                  ) : (
                    <Button
                      onClick={() => handleConnect(crm.type)}
                      disabled={isConnecting}
                    >
                      {isConnecting ? (
                        <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Plus className="h-4 w-4 mr-2" />
                      )}
                      Connect
                    </Button>
                  )}
                </div>
              </CardHeader>
              {isConnected && (
                <CardContent>
                  <div className="space-y-2 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Account:</span>
                      <span className="font-medium">{connection.crm_account_name || 'Unknown'}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Connected:</span>
                      <span className="font-medium">{new Date(connection.connected_at).toLocaleDateString()}</span>
                    </div>
                    {connection.last_synced_at && (
                      <div className="flex justify-between">
                        <span className="text-muted-foreground">Last Synced:</span>
                        <span className="font-medium">{new Date(connection.last_synced_at).toLocaleString()}</span>
                      </div>
                    )}
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Status:</span>
                      <Badge variant={connection.status === 'active' ? 'default' : 'secondary'}>
                        {connection.status}
                      </Badge>
                    </div>
                  </div>
                </CardContent>
              )}
            </Card>
          )
        })}
      </div>

      {/* How It Works */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            How CRM Sync Works
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="space-y-3">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <LinkIcon className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Bi-Directional Sync</h4>
                <p className="text-sm text-muted-foreground">
                  Contacts sync automatically between SAM and your CRM every 15 minutes
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Shield className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Secure & Private</h4>
                <p className="text-sm text-muted-foreground">
                  Your CRM credentials are encrypted and stored securely
                </p>
              </div>
            </div>

            <div className="flex items-start gap-3">
              <div className="w-8 h-8 bg-primary/10 rounded-full flex items-center justify-center">
                <Database className="h-4 w-4 text-primary" />
              </div>
              <div>
                <h4 className="font-medium">Smart Conflict Resolution</h4>
                <p className="text-sm text-muted-foreground">
                  When both systems are updated, CRM data wins automatically
                </p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
