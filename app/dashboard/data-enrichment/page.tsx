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
  LinkedinIcon,
  TrendingUp,
  AlertTriangle,
  Target,
  Star,
  Database,
  Eye,
  ThumbsUp,
  ThumbsDown
} from 'lucide-react'
import { EnrichedProspectData, DataScrapingQuota } from '@/lib/data-enrichment/enrichment-pipeline'

export default function ProspectApprovalDashboard() {
  // Mock data for development - replace with real data fetching
  const workspaceId = 'default-workspace'
  const userId = 'default-user'
  const [pendingProspects, setPendingProspects] = useState<EnrichedProspectData[]>([])
  const [quotaStatus, setQuotaStatus] = useState<DataScrapingQuota | null>(null)
  const [selectedProspect, setSelectedProspect] = useState<EnrichedProspectData | null>(null)
  const [loading, setLoading] = useState(true)
  const [approvalView, setApprovalView] = useState<'grid' | 'detail'>('grid')

  useEffect(() => {
    loadPendingProspects()
    loadQuotaStatus()
  }, [workspaceId, userId])

  const loadPendingProspects = async () => {
    try {
      // This would call your API endpoint
      const response = await fetch(`/api/data-enrichment/pending?workspace=${workspaceId}`)
      const data = await response.json()
      setPendingProspects(data.prospects || [])
    } catch (error) {
      console.error('Failed to load pending prospects:', error)
    } finally {
      setLoading(false)
    }
  }

  const loadQuotaStatus = async () => {
    try {
      const response = await fetch(`/api/data-enrichment/quota?workspace=${workspaceId}&user=${userId}`)
      const data = await response.json()
      setQuotaStatus(data.quota)
    } catch (error) {
      console.error('Failed to load quota status:', error)
    }
  }

  const handleProspectApproval = async (prospectId: string, approved: boolean) => {
    try {
      await fetch(`/api/data-enrichment/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prospect_id: prospectId,
          approved,
          workspace_id: workspaceId,
          user_id: userId
        })
      })

      // Remove from pending list
      setPendingProspects(prev => prev.filter(p => 
        `${p.first_name}-${p.last_name}-${p.company_name}` !== prospectId
      ))

      // Close detail view if this prospect was selected
      if (selectedProspect && `${selectedProspect.first_name}-${selectedProspect.last_name}-${selectedProspect.company_name}` === prospectId) {
        setSelectedProspect(null)
        setApprovalView('grid')
      }

      // Refresh quota status
      loadQuotaStatus()

    } catch (error) {
      console.error('Failed to approve/reject prospect:', error)
    }
  }

  const getICPScoreColor = (score: number) => {
    if (score >= 0.8) return 'text-green-600 bg-green-50'
    if (score >= 0.6) return 'text-yellow-600 bg-yellow-50'
    return 'text-red-600 bg-red-50'
  }

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600'
    if (confidence >= 0.6) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Data Enrichment Approval</h1>
          <p className="text-gray-600">Review and approve enriched prospect data</p>
        </div>
        <div className="flex items-center space-x-4">
          <Button
            variant={approvalView === 'grid' ? 'default' : 'outline'}
            onClick={() => setApprovalView('grid')}
          >
            Grid View
          </Button>
          <Button
            variant={approvalView === 'detail' ? 'default' : 'outline'}
            onClick={() => setApprovalView('detail')}
            disabled={!selectedProspect}
          >
            Detail View
          </Button>
        </div>
      </div>

      {/* Quota Status Card */}
      {quotaStatus && (
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Monthly Scraping Quota</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-between mb-2">
              <div className="text-2xl font-bold">
                {quotaStatus.current_usage} / {quotaStatus.monthly_limit}
              </div>
              <Badge variant="outline">
                {Math.round((quotaStatus.current_usage / quotaStatus.monthly_limit) * 100)}% used
              </Badge>
            </div>
            <Progress 
              value={(quotaStatus.current_usage / quotaStatus.monthly_limit) * 100} 
              className="w-full"
            />
            <p className="text-xs text-muted-foreground mt-2">
              Resets on {new Date(quotaStatus.reset_date).toLocaleDateString()}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Main Content */}
      {approvalView === 'grid' ? (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {pendingProspects.map((prospect, index) => {
            const prospectId = `${prospect.first_name}-${prospect.last_name}-${prospect.company_name}`
            
            return (
              <Card key={prospectId} className="hover:shadow-lg transition-shadow cursor-pointer">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center space-x-3">
                      <Avatar>
                        <AvatarImage src={`https://avatar.vercel.sh/${prospect.first_name}${prospect.last_name}`} />
                        <AvatarFallback>
                          {prospect.first_name?.charAt(0)}{prospect.last_name?.charAt(0)}
                        </AvatarFallback>
                      </Avatar>
                      <div>
                        <CardTitle className="text-lg">
                          {prospect.first_name} {prospect.last_name}
                        </CardTitle>
                        <CardDescription className="flex items-center">
                          <Building2 className="h-3 w-3 mr-1" />
                          {prospect.company_name}
                        </CardDescription>
                      </div>
                    </div>
                    <Badge 
                      className={`${getICPScoreColor(prospect.service_fit_analysis?.icp_score || 0)} border-0`}
                    >
                      {Math.round((prospect.service_fit_analysis?.icp_score || 0) * 100)}% ICP
                    </Badge>
                  </div>
                </CardHeader>

                <CardContent className="space-y-4">
                  {/* Key Info */}
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center">
                      <User className="h-3 w-3 mr-2 text-gray-400" />
                      {prospect.linkedin_profile?.current_position?.title || 'Unknown Title'}
                    </div>
                    <div className="flex items-center">
                      <Globe className="h-3 w-3 mr-2 text-gray-400" />
                      {prospect.website_url ? 'Website' : 'No Website'}
                    </div>
                    <div className="flex items-center">
                      <Mail className="h-3 w-3 mr-2 text-gray-400" />
                      {prospect.email_address ? 'Email' : 'No Email'}
                    </div>
                    <div className="flex items-center">
                      <LinkedinIcon className="h-3 w-3 mr-2 text-gray-400" />
                      {prospect.linkedin_url ? 'LinkedIn' : 'No LinkedIn'}
                    </div>
                  </div>

                  {/* Confidence Score */}
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">Confidence</span>
                    <span className={`text-sm font-semibold ${getConfidenceColor(prospect.confidence_score)}`}>
                      {Math.round(prospect.confidence_score * 100)}%
                    </span>
                  </div>

                  {/* Key Insights */}
                  <div className="space-y-2">
                    <div className="text-xs font-medium text-gray-500">Key Insights</div>
                    {prospect.service_fit_analysis?.pain_points_identified?.slice(0, 2).map((pain, idx) => (
                      <div key={idx} className="flex items-start space-x-2">
                        <AlertTriangle className="h-3 w-3 mt-0.5 text-amber-500 flex-shrink-0" />
                        <span className="text-xs text-gray-600">{pain.pain_point}</span>
                      </div>
                    ))}
                  </div>

                  {/* Buying Signals */}
                  {prospect.service_fit_analysis?.buying_signals?.length > 0 && (
                    <div className="space-y-2">
                      <div className="text-xs font-medium text-gray-500">Buying Signals</div>
                      {prospect.service_fit_analysis.buying_signals.slice(0, 1).map((signal, idx) => (
                        <div key={idx} className="flex items-start space-x-2">
                          <TrendingUp className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" />
                          <span className="text-xs text-gray-600">{signal.indicator}</span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Action Buttons */}
                  <div className="flex space-x-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      className="flex-1"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedProspect(prospect)
                        setApprovalView('detail')
                      }}
                    >
                      <Eye className="h-3 w-3 mr-1" />
                      Review
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-green-600 hover:bg-green-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleProspectApproval(prospectId, true)
                      }}
                    >
                      <ThumbsUp className="h-3 w-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="text-red-600 hover:bg-red-50"
                      onClick={(e) => {
                        e.stopPropagation()
                        handleProspectApproval(prospectId, false)
                      }}
                    >
                      <ThumbsDown className="h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            )
          })}
        </div>
      ) : (
        // Detail View
        selectedProspect && (
          <ProspectDetailView
            prospect={selectedProspect}
            onApprove={(approved) => {
              const prospectId = `${selectedProspect.first_name}-${selectedProspect.last_name}-${selectedProspect.company_name}`
              handleProspectApproval(prospectId, approved)
            }}
            onBack={() => {
              setSelectedProspect(null)
              setApprovalView('grid')
            }}
          />
        )
      )}

      {pendingProspects.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-gray-900 mb-2">All caught up!</h3>
            <p className="text-gray-600">No prospects pending approval at this time.</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

function ProspectDetailView({ 
  prospect, 
  onApprove, 
  onBack 
}: {
  prospect: EnrichedProspectData
  onApprove: (approved: boolean) => void
  onBack: () => void
}) {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={onBack}>
          ← Back to Grid
        </Button>
        <div className="flex space-x-2">
          <Button
            variant="outline"
            className="text-red-600 hover:bg-red-50"
            onClick={() => onApprove(false)}
          >
            <XCircle className="h-4 w-4 mr-2" />
            Reject
          </Button>
          <Button
            className="bg-green-600 hover:bg-green-700"
            onClick={() => onApprove(true)}
          >
            <CheckCircle className="h-4 w-4 mr-2" />
            Approve
          </Button>
        </div>
      </div>

      {/* Prospect Header */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-4">
              <Avatar className="h-16 w-16">
                <AvatarImage src={`https://avatar.vercel.sh/${prospect.first_name}${prospect.last_name}`} />
                <AvatarFallback className="text-lg">
                  {prospect.first_name?.charAt(0)}{prospect.last_name?.charAt(0)}
                </AvatarFallback>
              </Avatar>
              <div>
                <h1 className="text-2xl font-bold text-gray-900">
                  {prospect.first_name} {prospect.last_name}
                </h1>
                <p className="text-lg text-gray-600">
                  {prospect.linkedin_profile?.current_position?.title} at {prospect.company_name}
                </p>
                <div className="flex items-center space-x-4 mt-2">
                  {prospect.email_address && (
                    <a href={`mailto:${prospect.email_address}`} className="text-blue-600 hover:underline">
                      {prospect.email_address}
                    </a>
                  )}
                  {prospect.linkedin_url && (
                    <a href={prospect.linkedin_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      LinkedIn Profile
                    </a>
                  )}
                  {prospect.website_url && (
                    <a href={prospect.website_url} target="_blank" rel="noopener noreferrer" className="text-blue-600 hover:underline">
                      Company Website
                    </a>
                  )}
                </div>
              </div>
            </div>
            <div className="text-right">
              <Badge className={`${prospect.service_fit_analysis?.icp_score >= 0.8 ? 'bg-green-100 text-green-800' : prospect.service_fit_analysis?.icp_score >= 0.6 ? 'bg-yellow-100 text-yellow-800' : 'bg-red-100 text-red-800'} mb-2`}>
                ICP Score: {Math.round((prospect.service_fit_analysis?.icp_score || 0) * 100)}%
              </Badge>
              <div className="text-sm text-gray-600">
                Confidence: <span className={getConfidenceColor(prospect.confidence_score)}>
                  {Math.round(prospect.confidence_score * 100)}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Detailed Tabs */}
      <Tabs defaultValue="linkedin" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="linkedin">LinkedIn Profile</TabsTrigger>
          <TabsTrigger value="company">Company Intel</TabsTrigger>
          <TabsTrigger value="fit">Service Fit</TabsTrigger>
          <TabsTrigger value="approach">Recommended Approach</TabsTrigger>
        </TabsList>

        <TabsContent value="linkedin" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>LinkedIn Profile Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {prospect.linkedin_profile?.about_section && (
                <div>
                  <h4 className="font-semibold mb-2">About Section</h4>
                  <p className="text-gray-700">{prospect.linkedin_profile.about_section}</p>
                </div>
              )}
              
              <div>
                <h4 className="font-semibold mb-2">Current Position</h4>
                <div className="bg-gray-50 p-4 rounded-lg">
                  <p className="font-medium">{prospect.linkedin_profile?.current_position?.title}</p>
                  <p className="text-gray-600">{prospect.linkedin_profile?.current_position?.company}</p>
                  <p className="text-sm text-gray-500">{prospect.linkedin_profile?.current_position?.duration}</p>
                  {prospect.linkedin_profile?.current_position?.description && (
                    <p className="text-gray-700 mt-2">{prospect.linkedin_profile.current_position.description}</p>
                  )}
                </div>
              </div>

              {prospect.linkedin_profile?.skills?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Skills</h4>
                  <div className="flex flex-wrap gap-2">
                    {prospect.linkedin_profile.skills.slice(0, 10).map((skill, idx) => (
                      <Badge key={idx} variant="secondary">{skill}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="company" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Company Intelligence</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-semibold mb-2">SEO Data</h4>
                  <div className="space-y-1 text-sm">
                    <p>Domain Authority: <span className="font-medium">{prospect.website_intelligence?.seo_data?.domain_authority}</span></p>
                    <p>Traffic Estimate: <span className="font-medium">{prospect.website_intelligence?.seo_data?.organic_traffic_estimate?.toLocaleString()}</span></p>
                    <p>Backlinks: <span className="font-medium">{prospect.website_intelligence?.seo_data?.backlinks_count?.toLocaleString()}</span></p>
                  </div>
                </div>
                
                <div>
                  <h4 className="font-semibold mb-2">Company Size</h4>
                  <div className="space-y-1 text-sm">
                    <p>Estimated Employees: <span className="font-medium">{prospect.website_intelligence?.company_size_indicators?.estimated_employees}</span></p>
                    <p>Job Postings: <span className="font-medium">{prospect.website_intelligence?.company_size_indicators?.job_postings_count}</span></p>
                    <p>Team Page Count: <span className="font-medium">{prospect.website_intelligence?.company_size_indicators?.team_page_count}</span></p>
                  </div>
                </div>
              </div>

              {prospect.website_intelligence?.recent_blog_posts?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Recent Blog Posts</h4>
                  <div className="space-y-2">
                    {prospect.website_intelligence.recent_blog_posts.slice(0, 3).map((post, idx) => (
                      <div key={idx} className="border-l-4 border-blue-500 pl-3">
                        <p className="font-medium">{post.title}</p>
                        <p className="text-sm text-gray-600">{post.summary}</p>
                        <p className="text-xs text-gray-500">{post.published_date}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="fit" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Service Fit Analysis</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {prospect.service_fit_analysis?.pain_points_identified?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Identified Pain Points</h4>
                  <div className="space-y-3">
                    {prospect.service_fit_analysis.pain_points_identified.map((pain, idx) => (
                      <div key={idx} className="bg-amber-50 border-l-4 border-amber-400 p-3">
                        <div className="flex items-center justify-between mb-1">
                          <p className="font-medium text-amber-800">{pain.pain_point}</p>
                          <Badge variant={pain.urgency === 'high' ? 'destructive' : pain.urgency === 'medium' ? 'default' : 'secondary'}>
                            {pain.urgency} urgency
                          </Badge>
                        </div>
                        <div className="text-sm text-amber-700">
                          <p className="mb-1">Confidence: {Math.round(pain.confidence * 100)}%</p>
                          <ul className="list-disc list-inside">
                            {pain.evidence.map((evidence, evidenceIdx) => (
                              <li key={evidenceIdx}>{evidence}</li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {prospect.service_fit_analysis?.buying_signals?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Buying Signals</h4>
                  <div className="space-y-2">
                    {prospect.service_fit_analysis.buying_signals.map((signal, idx) => (
                      <div key={idx} className="flex items-start space-x-3 p-3 bg-green-50 rounded-lg">
                        <Target className="h-5 w-5 text-green-600 flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="font-medium text-green-800">{signal.signal_type.toUpperCase()}</p>
                          <p className="text-green-700">{signal.indicator}</p>
                          <Badge variant="outline" className="mt-1 text-green-600 border-green-600">
                            {signal.strength} strength
                          </Badge>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="approach" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Recommended Outreach Approach</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <h4 className="font-semibold mb-2">Messaging Angle</h4>
                <p className="text-gray-700 bg-gray-50 p-3 rounded-lg">
                  {prospect.service_fit_analysis?.recommended_approach?.messaging_angle}
                </p>
              </div>

              {prospect.service_fit_analysis?.recommended_approach?.key_value_props?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Key Value Propositions</h4>
                  <ul className="space-y-2">
                    {prospect.service_fit_analysis.recommended_approach.key_value_props.map((prop, idx) => (
                      <li key={idx} className="flex items-start space-x-2">
                        <Star className="h-4 w-4 text-yellow-500 flex-shrink-0 mt-0.5" />
                        <span>{prop}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {prospect.service_fit_analysis?.recommended_approach?.conversation_starters?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Conversation Starters</h4>
                  <div className="space-y-2">
                    {prospect.service_fit_analysis.recommended_approach.conversation_starters.map((starter, idx) => (
                      <div key={idx} className="bg-blue-50 p-3 rounded-lg border-l-4 border-blue-400">
                        <p className="text-blue-800">"{starter}"</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {prospect.service_fit_analysis?.competitive_threats?.length > 0 && (
                <div>
                  <h4 className="font-semibold mb-2">Competitive Threats & Differentiation</h4>
                  <div className="space-y-2">
                    {prospect.service_fit_analysis.competitive_threats.map((threat, idx) => (
                      <div key={idx} className="border rounded-lg p-3">
                        <div className="flex items-center justify-between mb-2">
                          <p className="font-medium">{threat.competitor}</p>
                          <Badge variant={threat.threat_level === 'high' ? 'destructive' : threat.threat_level === 'medium' ? 'default' : 'secondary'}>
                            {threat.threat_level} threat
                          </Badge>
                        </div>
                        <p className="text-gray-700 text-sm">{threat.differentiation_strategy}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

function getConfidenceColor(confidence: number): string {
  if (confidence >= 0.8) return 'text-green-600'
  if (confidence >= 0.6) return 'text-yellow-600'
  return 'text-red-600'
}