'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  User, 
  Building2, 
  Globe, 
  Mail, 
  Phone,
  LinkedinIcon,
  TrendingUp,
  AlertTriangle,
  Target,
  Star,
  Database,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Download,
  ExternalLink,
  AlertCircle,
  Settings
} from 'lucide-react'

interface UnipileProspectData {
  id: string
  name: string
  title: string
  company: {
    name: string
    size: string
    industry: string
    website?: string
  }
  contact: {
    email?: string
    phone?: string
    linkedin_url: string
  }
  location: string
  profile_image?: string
  recent_activity?: string
  connection_degree: number
  enrichment_score: number
  source: 'unipile_linkedin_search' | 'unipile_profile_enrichment'
  enriched_at: string
}

interface ApprovalSession {
  id: string
  batch_number: number
  user_id: string
  workspace_id: string
  created_at: string
  status: 'active' | 'completed' | 'archived'
  total_prospects: number
  approved_count: number
  rejected_count: number
  pending_count: number
  icp_criteria: {
    job_titles: string[]
    industries: string[]
    company_sizes: string[]
    locations: string[]
  }
  learning_insights?: {
    approval_rate: number
    common_reject_reasons: string[]
    preferred_criteria: Record<string, any>
  }
}

interface ProspectDecision {
  prospect_id: string
  decision: 'approved' | 'rejected'
  reason?: string
  decided_at: string
  is_immutable: boolean
}

export default function ProspectApprovalDashboard() {
  const [currentSession, setCurrentSession] = useState<ApprovalSession | null>(null)
  const [prospects, setProspects] = useState<UnipileProspectData[]>([])
  const [decisions, setDecisions] = useState<Record<string, ProspectDecision>>({})
  const [selectedProspects, setSelectedProspects] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid')
  const [filterCriteria, setFilterCriteria] = useState<{
    company_size?: string[]
    industry?: string[]
    connection_degree?: number[]
    has_email?: boolean
  }>({})
  const [loading, setLoading] = useState(true)
  const [unipileAccounts, setUnipileAccounts] = useState<any[]>([])
  const [hasLinkedInConnection, setHasLinkedInConnection] = useState<boolean>(false)
  const [checkingConnection, setCheckingConnection] = useState(true)

  useEffect(() => {
    checkLinkedInConnection()
  }, [])

  useEffect(() => {
    if (hasLinkedInConnection && !checkingConnection) {
      loadCurrentSession()
    }
  }, [hasLinkedInConnection, checkingConnection])

  const checkLinkedInConnection = async () => {
    setCheckingConnection(true)
    try {
      // Check Unipile accounts to see if LinkedIn is connected
      const response = await fetch('/api/unipile/accounts')
      if (response.ok) {
        const data = await response.json()
        setUnipileAccounts(data.accounts || [])
        
        // Use the has_linkedin property from the API response
        setHasLinkedInConnection(data.has_linkedin || false)
      }
    } catch (error) {
      console.error('Error checking LinkedIn connection:', error)
      setHasLinkedInConnection(false)
    }
    setCheckingConnection(false)
  }

  const loadCurrentSession = async () => {
    try {
      setLoading(true)
      
      // Load current active approval session
      const sessionResponse = await fetch('/api/prospect-approval/session')
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        setCurrentSession(sessionData.session)
        
        if (sessionData.session) {
          // Load prospects for this session
          const prospectsResponse = await fetch(`/api/prospect-approval/prospects?session_id=${sessionData.session.id}`)
          if (prospectsResponse.ok) {
            const prospectsData = await prospectsResponse.json()
            setProspects(prospectsData.prospects)
          }
          
          // Load existing decisions
          const decisionsResponse = await fetch(`/api/prospect-approval/decisions?session_id=${sessionData.session.id}`)
          if (decisionsResponse.ok) {
            const decisionsData = await decisionsResponse.json()
            const decisionsMap = decisionsData.decisions.reduce((acc: Record<string, ProspectDecision>, decision: ProspectDecision) => {
              acc[decision.prospect_id] = decision
              return acc
            }, {})
            setDecisions(decisionsMap)
          }
        }
      }
    } catch (error) {
      console.error('Error loading approval session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleProspectDecision = async (prospectId: string, decision: 'approved' | 'rejected', reason?: string) => {
    try {
      const response = await fetch('/api/prospect-approval/decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: currentSession?.id,
          prospect_id: prospectId,
          decision,
          reason
        })
      })

      if (response.ok) {
        const result = await response.json()
        setDecisions(prev => ({
          ...prev,
          [prospectId]: result.decision
        }))
        
        // Update session counts
        if (currentSession) {
          const newSession = { ...currentSession }
          if (decision === 'approved') {
            newSession.approved_count += 1
          } else {
            newSession.rejected_count += 1
          }
          newSession.pending_count -= 1
          setCurrentSession(newSession)
        }
      }
    } catch (error) {
      console.error('Error saving prospect decision:', error)
    }
  }

  const handleBulkDecision = async (decision: 'approved' | 'rejected') => {
    if (selectedProspects.size === 0) return
    
    const promises = Array.from(selectedProspects).map(prospectId => 
      handleProspectDecision(prospectId, decision, `Bulk ${decision}`)
    )
    
    await Promise.all(promises)
    setSelectedProspects(new Set())
  }

  const handleCompleteSession = async () => {
    if (!currentSession) return
    
    try {
      const response = await fetch('/api/prospect-approval/complete', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: currentSession.id
        })
      })

      if (response.ok) {
        const result = await response.json()
        // Redirect to results or start new session
        window.location.href = `/dashboard/prospect-approval/results/${currentSession.id}`
      }
    } catch (error) {
      console.error('Error completing session:', error)
    }
  }

  const getProspectDecisionStatus = (prospectId: string) => {
    return decisions[prospectId]?.decision || 'pending'
  }

  const getDecisionIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />
    }
  }

  const getFilteredProspects = () => {
    return prospects.filter(prospect => {
      if (filterCriteria.company_size?.length && !filterCriteria.company_size.includes(prospect.company.size)) {
        return false
      }
      if (filterCriteria.industry?.length && !filterCriteria.industry.includes(prospect.company.industry)) {
        return false
      }
      if (filterCriteria.connection_degree?.length && !filterCriteria.connection_degree.includes(prospect.connection_degree)) {
        return false
      }
      if (filterCriteria.has_email !== undefined && !!prospect.contact.email !== filterCriteria.has_email) {
        return false
      }
      return true
    })
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Loading Prospect Approval Session...</h2>
        </div>
      </div>
    )
  }

  if (!currentSession) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Active Approval Session</CardTitle>
            <CardDescription>
              Start a new ICP research session to begin prospect approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/dashboard'}>
              Start New Research Session
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredProspects = getFilteredProspects()
  const progressPercentage = ((currentSession.approved_count + currentSession.rejected_count) / currentSession.total_prospects) * 100

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* LinkedIn Connection Warning */}
      {checkingConnection && (
        <Card className="border-blue-200 bg-blue-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <Clock className="h-5 w-5 text-blue-600 animate-spin" />
              <div>
                <p className="text-blue-800 font-medium">Checking LinkedIn Connection...</p>
                <p className="text-blue-600 text-sm">Verifying your Unipile account status</p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!checkingConnection && !hasLinkedInConnection && (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="py-6">
            <div className="flex items-start gap-4">
              <AlertCircle className="h-6 w-6 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h3 className="text-red-800 font-semibold text-lg mb-2">
                  LinkedIn Account Not Connected
                </h3>
                <p className="text-red-700 mb-4">
                  To use the Prospect Approval system, you need to connect your LinkedIn account through Unipile. 
                  This allows us to enrich prospect data and provide comprehensive contact information for your approval decisions.
                </p>
                <div className="flex gap-3">
                  <Button 
                    onClick={() => window.open('/integrations/unipile', '_blank')}
                    className="bg-red-600 hover:bg-red-700 text-white"
                  >
                    <LinkedinIcon className="h-4 w-4 mr-2" />
                    Connect LinkedIn Account
                  </Button>
                  <Button 
                    variant="outline" 
                    onClick={checkLinkedInConnection}
                    className="border-red-300 text-red-700 hover:bg-red-100"
                  >
                    <Settings className="h-4 w-4 mr-2" />
                    Refresh Connection Status
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {!checkingConnection && hasLinkedInConnection && (
        <Card className="border-green-200 bg-green-50">
          <CardContent className="py-4">
            <div className="flex items-center gap-3">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-green-800 font-medium">LinkedIn Connected</p>
                <p className="text-green-600 text-sm">
                  {unipileAccounts.length} Unipile account{unipileAccounts.length !== 1 ? 's' : ''} connected
                </p>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Session Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl">
                Prospect Approval - Batch #{currentSession.batch_number}
              </CardTitle>
              <CardDescription>
                Review and approve prospects from Unipile LinkedIn enrichment
              </CardDescription>
            </div>
            <Badge variant="outline" className="text-lg px-3 py-1">
              {currentSession.total_prospects} Prospects
            </Badge>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{currentSession.approved_count}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{currentSession.rejected_count}</div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-yellow-600">{currentSession.pending_count}</div>
              <div className="text-sm text-muted-foreground">Pending</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-blue-600">{Math.round(progressPercentage)}%</div>
              <div className="text-sm text-muted-foreground">Complete</div>
            </div>
          </div>
          <Progress value={progressPercentage} className="w-full" />
        </CardContent>
      </Card>

      {/* Action Bar */}
      <div className="flex justify-between items-center">
        <div className="flex gap-2">
          <Button
            variant={viewMode === 'grid' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('grid')}
          >
            Grid View
          </Button>
          <Button
            variant={viewMode === 'list' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('list')}
          >
            List View
          </Button>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDecision('approved')}
            disabled={selectedProspects.size === 0}
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            Approve Selected ({selectedProspects.size})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDecision('rejected')}
            disabled={selectedProspects.size === 0}
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            Reject Selected ({selectedProspects.size})
          </Button>
          <Button
            onClick={handleCompleteSession}
            disabled={currentSession.pending_count > 0}
          >
            Complete Session
          </Button>
        </div>
      </div>

      {/* Prospects Grid */}
      <div className={viewMode === 'grid' ? 'grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4' : 'space-y-4'}>
        {filteredProspects.map((prospect) => {
          const decisionStatus = getProspectDecisionStatus(prospect.id)
          const isDecided = decisionStatus !== 'pending'
          const isSelected = selectedProspects.has(prospect.id)

          return (
            <Card 
              key={prospect.id}
              className={`transition-all ${
                isDecided ? 'opacity-75' : 'hover:shadow-lg'
              } ${
                decisionStatus === 'approved' ? 'border-green-200 bg-green-50' :
                decisionStatus === 'rejected' ? 'border-red-200 bg-red-50' :
                isSelected ? 'border-blue-200 bg-blue-50' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    <Avatar>
                      <AvatarImage src={prospect.profile_image} />
                      <AvatarFallback>
                        {prospect.name.split(' ').map(n => n[0]).join('')}
                      </AvatarFallback>
                    </Avatar>
                    <div>
                      <CardTitle className="text-lg">{prospect.name}</CardTitle>
                      <CardDescription>{prospect.title}</CardDescription>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getDecisionIcon(decisionStatus)}
                    {!isDecided && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSelected = new Set(selectedProspects)
                          if (e.target.checked) {
                            newSelected.add(prospect.id)
                          } else {
                            newSelected.delete(prospect.id)
                          }
                          setSelectedProspects(newSelected)
                        }}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex items-center gap-2">
                  <Building2 className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{prospect.company.name}</span>
                  <Badge variant="outline" className="text-xs">
                    {prospect.company.size}
                  </Badge>
                </div>
                
                <div className="flex items-center gap-2">
                  <Target className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">{prospect.company.industry}</span>
                </div>

                {prospect.contact.email && (
                  <div className="flex items-center gap-2">
                    <Mail className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{prospect.contact.email}</span>
                  </div>
                )}

                {prospect.contact.phone && (
                  <div className="flex items-center gap-2">
                    <Phone className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm">{prospect.contact.phone}</span>
                  </div>
                )}

                <div className="flex items-center gap-2">
                  <LinkedinIcon className="w-4 h-4 text-muted-foreground" />
                  <span className="text-sm">
                    {prospect.connection_degree === 1 ? '1st' :
                     prospect.connection_degree === 2 ? '2nd' :
                     prospect.connection_degree === 3 ? '3rd' : 
                     `${prospect.connection_degree}th`} connection
                  </span>
                </div>

                <div className="flex justify-between items-center pt-2">
                  <Badge variant="secondary" className="text-xs">
                    Score: {prospect.enrichment_score}/100
                  </Badge>
                  <div className="flex gap-1">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => window.open(prospect.contact.linkedin_url, '_blank')}
                    >
                      <ExternalLink className="w-3 h-3" />
                    </Button>
                  </div>
                </div>

                {!isDecided && (
                  <div className="flex gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="default"
                      onClick={() => handleProspectDecision(prospect.id, 'approved')}
                      className="flex-1"
                    >
                      <CheckCircle className="w-4 h-4 mr-1" />
                      Approve
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleProspectDecision(prospect.id, 'rejected')}
                      className="flex-1"
                    >
                      <XCircle className="w-4 h-4 mr-1" />
                      Reject
                    </Button>
                  </div>
                )}

                {isDecided && decisions[prospect.id]?.reason && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    {decisions[prospect.id].reason}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {filteredProspects.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <Database className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No prospects found</h3>
            <p className="text-muted-foreground">Try adjusting your filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}