'use client'

import React, { useState, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import { 
  CheckCircle, 
  XCircle, 
  Clock, 
  MessageSquare, 
  Send, 
  Mail, 
  MessageCircle,
  AlertTriangle,
  Target,
  Star,
  Edit3,
  Eye,
  ThumbsUp,
  ThumbsDown,
  Filter,
  Download,
  ExternalLink,
  AlertCircle,
  Settings,
  Copy,
  Zap,
  Users,
  BarChart3,
  FileText,
  ChevronRight,
  History,
  Shield
} from 'lucide-react'

interface CampaignMessage {
  id: string
  campaign_id: string
  message_type: 'email' | 'linkedin' | 'sms'
  subject?: string
  content: string
  template_name?: string
  target_audience: {
    icp_profiles: string[]
    company_sizes: string[]
    industries: string[]
    estimated_reach: number
  }
  personalization_fields: string[]
  compliance_check: {
    passed: boolean
    issues: string[]
    score: number
  }
  brand_guidelines: {
    passed: boolean
    issues: string[]
    tone_score: number
  }
  a_b_variant?: string
  created_by: string
  created_at: string
  status: 'pending' | 'approved' | 'rejected' | 'revision_needed'
  reviewer_notes?: string
  performance_prediction?: {
    open_rate: number
    response_rate: number
    conversion_rate: number
  }
}

interface ApprovalSession {
  id: string
  campaign_id: string
  campaign_name: string
  user_id: string
  workspace_id: string
  created_at: string
  status: 'active' | 'completed' | 'archived'
  total_messages: number
  approved_count: number
  rejected_count: number
  revision_count: number
  pending_count: number
  campaign_type: 'email' | 'linkedin' | 'multi_channel'
  launch_date?: string
}

interface MessageDecision {
  message_id: string
  decision: 'approved' | 'rejected' | 'revision_needed'
  notes?: string
  suggested_changes?: string
  decided_at: string
  reviewer_id: string
}

export default function CampaignApprovalDashboard() {
  const [currentSession, setCurrentSession] = useState<ApprovalSession | null>(null)
  const [messages, setMessages] = useState<CampaignMessage[]>([])
  const [decisions, setDecisions] = useState<Record<string, MessageDecision>>({})
  const [selectedMessages, setSelectedMessages] = useState<Set<string>>(new Set())
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards')
  const [filterType, setFilterType] = useState<'all' | 'email' | 'linkedin' | 'sms'>('all')
  const [filterStatus, setFilterStatus] = useState<'all' | 'pending' | 'approved' | 'rejected'>('all')
  const [loading, setLoading] = useState(true)
  const [selectedMessage, setSelectedMessage] = useState<CampaignMessage | null>(null)
  const [reviewNotes, setReviewNotes] = useState('')
  const [suggestedChanges, setSuggestedChanges] = useState('')

  useEffect(() => {
    loadCurrentSession()
  }, [])

  const loadCurrentSession = async () => {
    try {
      setLoading(true)
      
      // Load current active campaign approval session
      const sessionResponse = await fetch('/api/campaign-approval/session')
      if (sessionResponse.ok) {
        const sessionData = await sessionResponse.json()
        setCurrentSession(sessionData.session)
        
        if (sessionData.session) {
          // Load messages for this session
          const messagesResponse = await fetch(`/api/campaign-approval/messages?session_id=${sessionData.session.id}`)
          if (messagesResponse.ok) {
            const messagesData = await messagesResponse.json()
            setMessages(messagesData.messages)
          }
          
          // Load existing decisions
          const decisionsResponse = await fetch(`/api/campaign-approval/decisions?session_id=${sessionData.session.id}`)
          if (decisionsResponse.ok) {
            const decisionsData = await decisionsResponse.json()
            const decisionsMap = decisionsData.decisions.reduce((acc: Record<string, MessageDecision>, decision: MessageDecision) => {
              acc[decision.message_id] = decision
              return acc
            }, {})
            setDecisions(decisionsMap)
          }
        }
      }
    } catch (error) {
      console.error('Error loading campaign approval session:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleMessageDecision = async (messageId: string, decision: 'approved' | 'rejected' | 'revision_needed', notes?: string, suggestedChanges?: string) => {
    try {
      const response = await fetch('/api/campaign-approval/decide', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          session_id: currentSession?.id,
          message_id: messageId,
          decision,
          notes,
          suggested_changes: suggestedChanges
        })
      })

      if (response.ok) {
        const result = await response.json()
        setDecisions(prev => ({
          ...prev,
          [messageId]: result.decision
        }))
        
        // Update session counts
        if (currentSession) {
          const newSession = { ...currentSession }
          if (decision === 'approved') {
            newSession.approved_count += 1
          } else if (decision === 'rejected') {
            newSession.rejected_count += 1
          } else {
            newSession.revision_count += 1
          }
          newSession.pending_count -= 1
          setCurrentSession(newSession)
        }
        
        // Close message detail modal
        setSelectedMessage(null)
        setReviewNotes('')
        setSuggestedChanges('')
      }
    } catch (error) {
      console.error('Error saving message decision:', error)
    }
  }

  const handleBulkDecision = async (decision: 'approved' | 'rejected') => {
    if (selectedMessages.size === 0) return
    
    const promises = Array.from(selectedMessages).map(messageId => 
      handleMessageDecision(messageId, decision, `Bulk ${decision}`)
    )
    
    await Promise.all(promises)
    setSelectedMessages(new Set())
  }

  const getMessageDecisionStatus = (messageId: string) => {
    return decisions[messageId]?.decision || 'pending'
  }

  const getDecisionIcon = (status: string) => {
    switch (status) {
      case 'approved':
        return <CheckCircle className="w-5 h-5 text-green-600" />
      case 'rejected':
        return <XCircle className="w-5 h-5 text-red-600" />
      case 'revision_needed':
        return <Edit3 className="w-5 h-5 text-orange-600" />
      default:
        return <Clock className="w-5 h-5 text-yellow-600" />
    }
  }

  const getMessageTypeIcon = (type: string) => {
    switch (type) {
      case 'email':
        return <Mail className="w-4 h-4" />
      case 'linkedin':
        return <MessageCircle className="w-4 h-4" />
      case 'sms':
        return <MessageSquare className="w-4 h-4" />
      default:
        return <MessageSquare className="w-4 h-4" />
    }
  }

  const getFilteredMessages = () => {
    return messages.filter(message => {
      if (filterType !== 'all' && message.message_type !== filterType) {
        return false
      }
      if (filterStatus !== 'all') {
        const status = getMessageDecisionStatus(message.id)
        if (status !== filterStatus) {
          return false
        }
      }
      return true
    })
  }

  const getComplianceColor = (score: number) => {
    if (score >= 90) return 'text-green-600'
    if (score >= 70) return 'text-yellow-600'
    return 'text-red-600'
  }

  if (loading) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center">
          <Clock className="w-8 h-8 animate-spin mx-auto mb-4" />
          <h2 className="text-xl font-semibold">Loading Campaign Approval Session...</h2>
        </div>
      </div>
    )
  }

  if (!currentSession) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardHeader>
            <CardTitle>No Active Campaign Approval Session</CardTitle>
            <CardDescription>
              Start a new campaign to begin message approval
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Button onClick={() => window.location.href = '/demo/campaign-hub'}>
              Create New Campaign
            </Button>
          </CardContent>
        </Card>
      </div>
    )
  }

  const filteredMessages = getFilteredMessages()
  const progressPercentage = ((currentSession.approved_count + currentSession.rejected_count + currentSession.revision_count) / currentSession.total_messages) * 100

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Session Header */}
      <Card>
        <CardHeader>
          <div className="flex justify-between items-start">
            <div>
              <CardTitle className="text-2xl flex items-center gap-3">
                <MessageSquare className="w-6 h-6" />
                Campaign Message Approval
              </CardTitle>
              <CardDescription className="text-lg mt-2">
                {currentSession.campaign_name}
              </CardDescription>
              <div className="flex items-center gap-4 mt-3">
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {currentSession.campaign_type.toUpperCase()}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {currentSession.total_messages} Messages
                </Badge>
                {currentSession.launch_date && (
                  <Badge variant="secondary" className="text-sm px-3 py-1">
                    Launch: {new Date(currentSession.launch_date).toLocaleDateString()}
                  </Badge>
                )}
              </div>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-5 gap-4 mb-6">
            <div className="text-center">
              <div className="text-2xl font-bold text-green-600">{currentSession.approved_count}</div>
              <div className="text-sm text-muted-foreground">Approved</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-red-600">{currentSession.rejected_count}</div>
              <div className="text-sm text-muted-foreground">Rejected</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-orange-600">{currentSession.revision_count}</div>
              <div className="text-sm text-muted-foreground">Revisions</div>
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
            variant={viewMode === 'cards' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('cards')}
          >
            Card View
          </Button>
          <Button
            variant={viewMode === 'table' ? 'default' : 'outline'}
            size="sm"
            onClick={() => setViewMode('table')}
          >
            Table View
          </Button>
          
          <select 
            value={filterType} 
            onChange={(e) => setFilterType(e.target.value as any)}
            className="px-3 py-2 text-sm border rounded-md"
          >
            <option value="all">All Types</option>
            <option value="email">Email</option>
            <option value="linkedin">LinkedIn</option>
            <option value="sms">SMS</option>
          </select>
          
          <select 
            value={filterStatus} 
            onChange={(e) => setFilterStatus(e.target.value as any)}
            className="px-3 py-2 text-sm border rounded-md"
          >
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="approved">Approved</option>
            <option value="rejected">Rejected</option>
          </select>
        </div>

        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDecision('approved')}
            disabled={selectedMessages.size === 0}
          >
            <ThumbsUp className="w-4 h-4 mr-2" />
            Approve Selected ({selectedMessages.size})
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleBulkDecision('rejected')}
            disabled={selectedMessages.size === 0}
          >
            <ThumbsDown className="w-4 h-4 mr-2" />
            Reject Selected ({selectedMessages.size})
          </Button>
        </div>
      </div>

      {/* Messages Grid/Table */}
      <div className={viewMode === 'cards' ? 'grid grid-cols-1 lg:grid-cols-2 gap-4' : 'space-y-4'}>
        {filteredMessages.map((message) => {
          const decisionStatus = getMessageDecisionStatus(message.id)
          const isDecided = decisionStatus !== 'pending'
          const isSelected = selectedMessages.has(message.id)

          return (
            <Card 
              key={message.id}
              className={`transition-all ${
                isDecided ? 'opacity-75' : 'hover:shadow-lg'
              } ${
                decisionStatus === 'approved' ? 'border-green-200 bg-green-50' :
                decisionStatus === 'rejected' ? 'border-red-200 bg-red-50' :
                decisionStatus === 'revision_needed' ? 'border-orange-200 bg-orange-50' :
                isSelected ? 'border-blue-200 bg-blue-50' : ''
              }`}
            >
              <CardHeader className="pb-3">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-3">
                    {getMessageTypeIcon(message.message_type)}
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-1">
                        <CardTitle className="text-lg">
                          {message.template_name || `${message.message_type.charAt(0).toUpperCase() + message.message_type.slice(1)} Message`}
                        </CardTitle>
                        {message.a_b_variant && (
                          <Badge variant="outline" className="text-xs">
                            Variant {message.a_b_variant}
                          </Badge>
                        )}
                      </div>
                      {message.subject && (
                        <CardDescription className="font-medium">
                          {message.subject}
                        </CardDescription>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {getDecisionIcon(decisionStatus)}
                    {!isDecided && (
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={(e) => {
                          const newSelected = new Set(selectedMessages)
                          if (e.target.checked) {
                            newSelected.add(message.id)
                          } else {
                            newSelected.delete(message.id)
                          }
                          setSelectedMessages(newSelected)
                        }}
                      />
                    )}
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* Message Preview */}
                <div className="bg-gray-50 rounded-lg p-3">
                  <p className="text-sm text-gray-700 line-clamp-3">
                    {message.content.length > 150 ? `${message.content.substring(0, 150)}...` : message.content}
                  </p>
                </div>

                {/* Target Audience */}
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Target className="w-4 h-4 text-muted-foreground" />
                    <span className="text-sm font-medium">Target Audience</span>
                  </div>
                  <div className="flex flex-wrap gap-1">
                    {message.target_audience.icp_profiles.slice(0, 3).map((profile, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {profile}
                      </Badge>
                    ))}
                    {message.target_audience.icp_profiles.length > 3 && (
                      <Badge variant="secondary" className="text-xs">
                        +{message.target_audience.icp_profiles.length - 3} more
                      </Badge>
                    )}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    Est. reach: {message.target_audience.estimated_reach.toLocaleString()} contacts
                  </div>
                </div>

                {/* Compliance & Brand Guidelines */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium">Compliance</span>
                    </div>
                    <div className={`text-sm font-bold ${getComplianceColor(message.compliance_check.score)}`}>
                      {message.compliance_check.score}%
                    </div>
                    {message.compliance_check.issues.length > 0 && (
                      <div className="text-xs text-red-600">
                        {message.compliance_check.issues.length} issue(s)
                      </div>
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <Star className="w-4 h-4 text-muted-foreground" />
                      <span className="text-xs font-medium">Brand</span>
                    </div>
                    <div className={`text-sm font-bold ${getComplianceColor(message.brand_guidelines.tone_score)}`}>
                      {message.brand_guidelines.tone_score}%
                    </div>
                    {message.brand_guidelines.issues.length > 0 && (
                      <div className="text-xs text-orange-600">
                        {message.brand_guidelines.issues.length} note(s)
                      </div>
                    )}
                  </div>
                </div>

                {/* Performance Prediction */}
                {message.performance_prediction && (
                  <div className="space-y-2">
                    <div className="flex items-center gap-2">
                      <BarChart3 className="w-4 h-4 text-muted-foreground" />
                      <span className="text-sm font-medium">Predicted Performance</span>
                    </div>
                    <div className="grid grid-cols-3 gap-2 text-xs">
                      <div className="text-center">
                        <div className="font-bold">{(message.performance_prediction.open_rate * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground">Open</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">{(message.performance_prediction.response_rate * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground">Response</div>
                      </div>
                      <div className="text-center">
                        <div className="font-bold">{(message.performance_prediction.conversion_rate * 100).toFixed(1)}%</div>
                        <div className="text-muted-foreground">Convert</div>
                      </div>
                    </div>
                  </div>
                )}

                {/* Action Buttons */}
                <div className="flex gap-2 pt-2">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={() => setSelectedMessage(message)}
                    className="flex-1"
                  >
                    <Eye className="w-4 h-4 mr-1" />
                    Review
                  </Button>
                  {!isDecided && (
                    <>
                      <Button
                        size="sm"
                        variant="default"
                        onClick={() => handleMessageDecision(message.id, 'approved')}
                      >
                        <CheckCircle className="w-4 h-4" />
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleMessageDecision(message.id, 'rejected')}
                      >
                        <XCircle className="w-4 h-4" />
                      </Button>
                    </>
                  )}
                </div>

                {/* Decision Notes */}
                {isDecided && decisions[message.id]?.notes && (
                  <div className="text-xs text-muted-foreground bg-muted p-2 rounded">
                    <strong>Notes:</strong> {decisions[message.id].notes}
                  </div>
                )}
              </CardContent>
            </Card>
          )
        })}
      </div>

      {/* Message Detail Modal */}
      {selectedMessage && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <Card className="w-full max-w-4xl max-h-[90vh] overflow-hidden">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div>
                  <CardTitle className="text-xl flex items-center gap-2">
                    {getMessageTypeIcon(selectedMessage.message_type)}
                    {selectedMessage.template_name || `${selectedMessage.message_type.charAt(0).toUpperCase() + selectedMessage.message_type.slice(1)} Message`}
                  </CardTitle>
                  {selectedMessage.subject && (
                    <CardDescription className="text-lg mt-1">
                      {selectedMessage.subject}
                    </CardDescription>
                  )}
                </div>
                <Button variant="outline" onClick={() => setSelectedMessage(null)}>
                  ✕
                </Button>
              </div>
            </CardHeader>
            <CardContent className="overflow-y-auto max-h-[70vh] space-y-6">
              {/* Full Message Content */}
              <div>
                <h4 className="font-medium mb-2">Message Content</h4>
                <div className="bg-gray-50 rounded-lg p-4">
                  <pre className="whitespace-pre-wrap text-sm text-gray-700">
                    {selectedMessage.content}
                  </pre>
                </div>
              </div>

              {/* Personalization Fields */}
              {selectedMessage.personalization_fields.length > 0 && (
                <div>
                  <h4 className="font-medium mb-2">Personalization Fields</h4>
                  <div className="flex flex-wrap gap-2">
                    {selectedMessage.personalization_fields.map((field, index) => (
                      <Badge key={index} variant="outline">
                        {field}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              {/* Compliance Details */}
              <div className="grid md:grid-cols-2 gap-4">
                <div>
                  <h4 className="font-medium mb-2">Compliance Check</h4>
                  <div className={`text-lg font-bold mb-2 ${getComplianceColor(selectedMessage.compliance_check.score)}`}>
                    Score: {selectedMessage.compliance_check.score}%
                  </div>
                  {selectedMessage.compliance_check.issues.length > 0 && (
                    <ul className="text-sm text-red-600 space-y-1">
                      {selectedMessage.compliance_check.issues.map((issue, index) => (
                        <li key={index}>• {issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <h4 className="font-medium mb-2">Brand Guidelines</h4>
                  <div className={`text-lg font-bold mb-2 ${getComplianceColor(selectedMessage.brand_guidelines.tone_score)}`}>
                    Tone Score: {selectedMessage.brand_guidelines.tone_score}%
                  </div>
                  {selectedMessage.brand_guidelines.issues.length > 0 && (
                    <ul className="text-sm text-orange-600 space-y-1">
                      {selectedMessage.brand_guidelines.issues.map((issue, index) => (
                        <li key={index}>• {issue}</li>
                      ))}
                    </ul>
                  )}
                </div>
              </div>

              {/* Review Form */}
              <div className="space-y-4">
                <div>
                  <label className="block text-sm font-medium mb-2">Review Notes</label>
                  <Textarea
                    value={reviewNotes}
                    onChange={(e) => setReviewNotes(e.target.value)}
                    placeholder="Add your review notes..."
                    className="min-h-[80px]"
                  />
                </div>
                
                <div>
                  <label className="block text-sm font-medium mb-2">Suggested Changes (for revisions)</label>
                  <Textarea
                    value={suggestedChanges}
                    onChange={(e) => setSuggestedChanges(e.target.value)}
                    placeholder="Describe what changes are needed..."
                    className="min-h-[80px]"
                  />
                </div>

                <div className="flex gap-3">
                  <Button
                    onClick={() => handleMessageDecision(selectedMessage.id, 'approved', reviewNotes)}
                    className="flex-1"
                  >
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Approve
                  </Button>
                  <Button
                    variant="outline"
                    onClick={() => handleMessageDecision(selectedMessage.id, 'revision_needed', reviewNotes, suggestedChanges)}
                    className="flex-1"
                  >
                    <Edit3 className="w-4 h-4 mr-2" />
                    Request Revision
                  </Button>
                  <Button
                    variant="destructive"
                    onClick={() => handleMessageDecision(selectedMessage.id, 'rejected', reviewNotes)}
                    className="flex-1"
                  >
                    <XCircle className="w-4 h-4 mr-2" />
                    Reject
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {filteredMessages.length === 0 && (
        <Card>
          <CardContent className="text-center py-8">
            <MessageSquare className="w-12 h-12 mx-auto mb-4 text-muted-foreground" />
            <h3 className="text-lg font-medium mb-2">No messages found</h3>
            <p className="text-muted-foreground">Try adjusting your filter criteria</p>
          </CardContent>
        </Card>
      )}
    </div>
  )
}