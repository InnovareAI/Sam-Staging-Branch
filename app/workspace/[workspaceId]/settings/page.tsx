'use client'

import React, { useState, useEffect } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Alert, AlertDescription } from '@/components/ui/alert'
import LLMConfigModal from '@/components/LLMConfigModal'
import EmailProvidersModal from '@/app/components/EmailProvidersModal'
import KBValidationPanel from '@/components/KBValidationPanel'
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs'
import {
  Settings,
  Building2,
  Users,
  Brain,
  CreditCard,
  Zap,
  CheckCircle,
  Globe,
  Shield,
  BarChart3,
  Sparkles,
  Mail,
  UserPlus,
  Clock,
  Trash2,
  Loader2,
  Database
} from 'lucide-react'

export default function WorkspaceSettingsPage({ params }: { params: { workspaceId: string } }) {
  const [activeTab, setActiveTab] = useState('general')
  const [isLLMModalOpen, setIsLLMModalOpen] = useState(false)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('InnovareAI')

  // Team invitation state
  const [showInviteForm, setShowInviteForm] = useState(false)
  const [inviteEmail, setInviteEmail] = useState('')
  const [inviteRole, setInviteRole] = useState<'admin' | 'member' | 'viewer'>('member')
  const [inviteLoading, setInviteLoading] = useState(false)
  const [inviteError, setInviteError] = useState('')
  const [inviteSuccess, setInviteSuccess] = useState('')
  const [members, setMembers] = useState<any[]>([])
  const [invitations, setInvitations] = useState<any[]>([])
  const [loadingMembers, setLoadingMembers] = useState(true)

  // Handle URL query parameters (OAuth redirects)
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const searchParams = new URLSearchParams(window.location.search)
      const tab = searchParams.get('tab')
      const emailConnected = searchParams.get('email_connected')
      const error = searchParams.get('error')

      // Set active tab from URL
      if (tab) {
        setActiveTab(tab)
      }

      // Show success message for email connection
      if (emailConnected === 'true') {
        const provider = searchParams.get('provider')
        setInviteSuccess(`✅ ${provider === 'google' ? 'Google' : 'Microsoft'} email account connected successfully!`)
        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname)
      }

      // Show error message
      if (error) {
        setInviteError(decodeURIComponent(error))
        // Clear URL parameters
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  // Load team members and invitations
  useEffect(() => {
    loadTeamData()
  }, [params.workspaceId])

  const loadTeamData = async () => {
    setLoadingMembers(true)
    const supabase = createClientComponentClient()

    try {
      // Load workspace members
      const { data: membersData } = await supabase
        .from('workspace_members')
        .select('*, users(email, first_name, last_name)')
        .eq('workspace_id', params.workspaceId)

      setMembers(membersData || [])

      // Load pending invitations
      const { data: invitationsData } = await supabase
        .from('workspace_invitations')
        .select('*')
        .eq('workspace_id', params.workspaceId)
        .eq('status', 'pending')

      setInvitations(invitationsData || [])
    } catch (error) {
      console.error('Failed to load team data:', error)
    } finally {
      setLoadingMembers(false)
    }
  }

  const handleSendInvitation = async () => {
    if (!inviteEmail.trim()) {
      setInviteError('Email is required')
      return
    }

    setInviteLoading(true)
    setInviteError('')
    setInviteSuccess('')

    try {
      const supabase = createClientComponentClient()
      const { data: { session } } = await supabase.auth.getSession()

      const response = await fetch('/api/workspace/invite', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${session?.access_token}`
        },
        body: JSON.stringify({
          workspaceId: params.workspaceId,
          email: inviteEmail.trim(),
          role: inviteRole
        })
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to send invitation')
      }

      setInviteSuccess(`Invitation sent to ${inviteEmail}`)
      setInviteEmail('')
      setShowInviteForm(false)

      // Reload invitations
      await loadTeamData()
    } catch (error) {
      setInviteError(error instanceof Error ? error.message : 'Failed to send invitation')
    } finally {
      setInviteLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            whileHover={{ rotate: 90, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="p-2 bg-indigo-100 rounded-xl"
          >
            <Building2 className="h-6 w-6 text-indigo-600" />
          </motion.div>
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Workspace Settings
            </h1>
            <p className="text-slate-600">
              Manage workspace configuration, team, and integrations
            </p>
          </div>
        </div>
      </motion.div>

      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Tab Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <TabsList className="grid w-full grid-cols-7 bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg">
              {[
                { id: 'general', icon: Settings, label: 'General' },
                { id: 'team', icon: Users, label: 'Team' },
                { id: 'knowledge', icon: Database, label: 'Knowledge' },
                { id: 'integrations', icon: Zap, label: 'Integrations' },
                { id: 'compliance', icon: Shield, label: 'Compliance' },
                { id: 'billing', icon: CreditCard, label: 'Billing' },
                { id: 'analytics', icon: BarChart3, label: 'Analytics' }
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 transition-all duration-300"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          <div className="mt-6 grid gap-6">
            {/* General Tab */}
            <TabsContent value="general" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="grid gap-6 md:grid-cols-2"
              >
                {/* Workspace Info */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Building2 className="h-5 w-5" />
                      Workspace Information
                    </CardTitle>
                    <CardDescription>
                      Basic workspace details and branding
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Workspace Name</label>
                      <Input 
                        value={workspaceName} 
                        onChange={(e) => setWorkspaceName(e.target.value)}
                        className="border-slate-200" 
                      />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Workspace ID</label>
                      <Input 
                        value={params.workspaceId} 
                        disabled
                        className="border-slate-200 bg-slate-50" 
                      />
                    </div>
                    <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>

                {/* Workspace Plan */}
                <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"></div>
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                      </motion.div>
                      Current Plan
                    </CardTitle>
                    <CardDescription>
                      Your workspace subscription
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700 text-lg px-4 py-2">
                      Enterprise Plan
                    </Badge>
                    <div className="space-y-2">
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Unlimited team members</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Advanced analytics</span>
                      </div>
                      <div className="flex items-center gap-2 text-sm">
                        <CheckCircle className="h-4 w-4 text-green-600" />
                        <span>Priority support</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Team Tab */}
            <TabsContent value="team" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* Success/Error Messages */}
                {inviteSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{inviteSuccess}</AlertDescription>
                  </Alert>
                )}

                {/* Current Team Members */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Users className="h-5 w-5 text-indigo-600" />
                        Team Members ({members.length})
                      </div>
                      <Button
                        onClick={() => setShowInviteForm(!showInviteForm)}
                        className="bg-indigo-600 hover:bg-indigo-700"
                      >
                        <UserPlus className="h-4 w-4 mr-2" />
                        Invite Member
                      </Button>
                    </CardTitle>
                    <CardDescription>
                      Manage workspace members and their roles
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    {loadingMembers ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-8 w-8 animate-spin text-indigo-600" />
                      </div>
                    ) : members.length === 0 ? (
                      <div className="text-center py-8 text-slate-600">
                        No team members yet. Invite your first member!
                      </div>
                    ) : (
                      members.map((member) => (
                        <div key={member.user_id} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg hover:border-indigo-300 transition-colors">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-indigo-600 font-medium">
                                {member.users?.first_name?.[0]}{member.users?.last_name?.[0]}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">
                                {member.users?.first_name} {member.users?.last_name}
                              </div>
                              <div className="text-sm text-slate-600">{member.users?.email}</div>
                            </div>
                          </div>
                          <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                            {member.role}
                          </Badge>
                        </div>
                      ))
                    )}
                  </CardContent>
                </Card>

                {/* Invitation Form */}
                {showInviteForm && (
                  <Card className="bg-white/80 backdrop-blur-sm border-2 border-indigo-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Mail className="h-5 w-5 text-indigo-600" />
                        Send Invitation
                      </CardTitle>
                      <CardDescription>
                        Invite a new member to join this workspace
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Email Address</label>
                        <Input
                          type="email"
                          placeholder="colleague@company.com"
                          value={inviteEmail}
                          onChange={(e) => setInviteEmail(e.target.value)}
                          className="border-slate-200"
                        />
                      </div>

                      <div>
                        <label className="text-sm font-medium mb-2 block">Role</label>
                        <select
                          value={inviteRole}
                          onChange={(e) => setInviteRole(e.target.value as 'admin' | 'member' | 'viewer')}
                          className="w-full px-3 py-2 border border-slate-200 rounded-md focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        >
                          <option value="member">Member - Can use the platform</option>
                          <option value="admin">Admin - Can manage team and settings</option>
                          <option value="viewer">Viewer - Read-only access</option>
                        </select>
                      </div>

                      {inviteError && (
                        <Alert variant="destructive">
                          <AlertDescription>{inviteError}</AlertDescription>
                        </Alert>
                      )}

                      <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
                        <h4 className="font-medium text-sm mb-2 text-blue-900">How it works:</h4>
                        <ul className="space-y-1 text-sm text-blue-800">
                          <li>• User receives invitation email with signup link</li>
                          <li>• They create account (no payment required)</li>
                          <li>• Automatically added to this workspace</li>
                          <li>• Your subscription updated (+1 seat, charged immediately)</li>
                        </ul>
                      </div>

                      <div className="flex gap-2">
                        <Button
                          onClick={handleSendInvitation}
                          disabled={inviteLoading}
                          className="flex-1 bg-indigo-600 hover:bg-indigo-700"
                        >
                          {inviteLoading ? (
                            <>
                              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                              Sending...
                            </>
                          ) : (
                            <>
                              <Mail className="h-4 w-4 mr-2" />
                              Send Invitation
                            </>
                          )}
                        </Button>
                        <Button
                          onClick={() => {
                            setShowInviteForm(false)
                            setInviteEmail('')
                            setInviteError('')
                          }}
                          variant="outline"
                        >
                          Cancel
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                )}

                {/* Pending Invitations */}
                {invitations.length > 0 && (
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Clock className="h-5 w-5 text-orange-600" />
                        Pending Invitations ({invitations.length})
                      </CardTitle>
                      <CardDescription>
                        Invitations awaiting acceptance
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {invitations.map((invitation) => (
                        <div key={invitation.id} className="flex items-center justify-between p-4 border border-orange-200 bg-orange-50 rounded-lg">
                          <div>
                            <div className="font-medium">{invitation.invited_email}</div>
                            <div className="text-sm text-slate-600">
                              Invited {new Date(invitation.created_at).toLocaleDateString()} · Expires {new Date(invitation.expires_at).toLocaleDateString()}
                            </div>
                          </div>
                          <Badge className="bg-orange-100 text-orange-700">
                            {invitation.role}
                          </Badge>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </motion.div>
            </TabsContent>

            {/* Knowledge Base Tab */}
            <TabsContent value="knowledge" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Database className="h-5 w-5 text-indigo-600" />
                      Knowledge Base Validation
                    </CardTitle>
                    <CardDescription>
                      Review and validate KB items with low confidence scores
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <KBValidationPanel
                      workspaceId={params.workspaceId}
                      threshold={0.8}
                      onValidationComplete={() => {
                        setInviteSuccess('KB item validated successfully!')
                        setTimeout(() => setInviteSuccess(''), 3000)
                      }}
                    />
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Integrations Tab - Tile Design */}
            <TabsContent value="integrations">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* Success/Error Messages */}
                {inviteSuccess && (
                  <Alert className="bg-green-50 border-green-200">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">{inviteSuccess}</AlertDescription>
                  </Alert>
                )}
                {inviteError && (
                  <Alert variant="destructive">
                    <AlertDescription>{inviteError}</AlertDescription>
                  </Alert>
                )}

                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Zap className="h-5 w-5 text-indigo-600" />
                      Workspace Integrations
                    </CardTitle>
                    <CardDescription>
                      Configure workspace-level tools and services
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[
                        { name: 'LLM Model', connected: true, icon: Brain, color: 'purple', action: () => setIsLLMModalOpen(true), description: 'AI model configuration' },
                        { name: 'Google Gmail', connected: false, icon: Mail, color: 'blue', action: () => setIsEmailModalOpen(true), description: 'Connect Gmail account' },
                        { name: 'Microsoft Outlook', connected: false, icon: Mail, color: 'blue', action: () => setIsEmailModalOpen(true), description: 'Connect Outlook account' },
                        { name: 'ActiveCampaign', connected: false, icon: Zap, color: 'orange', description: 'Marketing automation' },
                        { name: 'Zapier', connected: false, icon: Globe, color: 'orange', description: 'Workflow automation' },
                        { name: 'Slack', connected: false, icon: Globe, color: 'purple', description: 'Team communication' },
                        { name: 'HubSpot', connected: false, icon: BarChart3, color: 'orange', description: 'CRM platform' },
                        { name: 'Salesforce', connected: false, icon: Globe, color: 'blue', description: 'Sales CRM' }
                      ].map((integration) => (
                        <motion.div
                          key={integration.name}
                          whileHover={{ y: -5, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={integration.action}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                            integration.connected 
                              ? `bg-${integration.color}-50 border-${integration.color}-200` 
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <integration.icon className={`h-8 w-8 text-${integration.color}-600`} />
                            {integration.connected ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <Button size="sm" variant="outline">
                                Connect
                              </Button>
                            )}
                          </div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {integration.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {integration.connected ? 'Connected' : 'Not connected'}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Compliance Tab */}
            <TabsContent value="compliance" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                {/* DPA Management Card */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Shield className="h-5 w-5 text-indigo-600" />
                      Data Processing Agreement (GDPR Compliance)
                    </CardTitle>
                    <CardDescription>
                      EU customers require a signed DPA for GDPR compliance
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg mb-6">
                      <div className="flex items-start gap-3">
                        <Shield className="h-5 w-5 text-yellow-600 mt-0.5" />
                        <div className="flex-1">
                          <h3 className="font-semibold text-yellow-900 mb-1">DPA Signature Required</h3>
                          <p className="text-sm text-yellow-800 mb-3">
                            Your workspace is located in the EU. GDPR compliance requires a signed
                            Data Processing Agreement to continue using SAM AI.
                          </p>
                          <div className="flex items-center gap-2 text-sm text-yellow-700">
                            <span className="font-medium">Deadline: November 5, 2025</span>
                            <Badge variant="outline" className="border-yellow-400">30 days remaining</Badge>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div className="space-y-4">
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700" size="lg">
                        <Shield className="h-4 w-4 mr-2" />
                        Review & Sign Data Processing Agreement
                      </Button>

                      <div className="p-4 bg-slate-50 rounded-lg">
                        <h4 className="font-semibold text-sm mb-3">What is a DPA?</h4>
                        <p className="text-sm text-slate-600 mb-3">
                          A Data Processing Agreement (DPA) is a legally binding contract required by GDPR
                          when a service provider processes personal data on behalf of a customer. It outlines
                          data protection responsibilities, security measures, and your rights as a data controller.
                        </p>
                        <ul className="space-y-2 text-sm text-slate-600">
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            One-click electronic signature (legally valid)
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            Download signed PDF certificate
                          </li>
                          <li className="flex items-center gap-2">
                            <CheckCircle className="h-4 w-4 text-green-600" />
                            GDPR Article 28 compliant
                          </li>
                        </ul>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Sub-processors Card */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Globe className="h-5 w-5 text-indigo-600" />
                      Sub-processors
                    </CardTitle>
                    <CardDescription>
                      Third-party services that process data on behalf of SAM AI
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      {[
                        { name: 'Supabase', purpose: 'Database and authentication', location: 'United States', data: 'Prospect data, campaign data' },
                        { name: 'Anthropic', purpose: 'AI model inference (Claude)', location: 'United States', data: 'Conversation history, documents' },
                        { name: 'Unipile', purpose: 'LinkedIn/email integration', location: 'European Union (France)', data: 'Messages, prospect data' },
                        { name: 'Postmark', purpose: 'Transactional emails', location: 'United States', data: 'Email addresses, notifications' }
                      ].map((processor) => (
                        <div key={processor.name} className="p-3 border border-slate-200 rounded-lg">
                          <div className="flex items-start justify-between">
                            <div className="flex-1">
                              <div className="font-semibold">{processor.name}</div>
                              <div className="text-sm text-slate-600 mt-1">{processor.purpose}</div>
                              <div className="flex items-center gap-4 mt-2 text-xs text-slate-500">
                                <span className="flex items-center gap-1">
                                  <Globe className="h-3 w-3" />
                                  {processor.location}
                                </span>
                                <span>• {processor.data}</span>
                              </div>
                            </div>
                            <Badge variant="secondary" className="bg-green-100 text-green-700">
                              Active
                            </Badge>
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Billing Tab */}
            <TabsContent value="billing" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <CreditCard className="h-5 w-5" />
                      Billing & Subscription
                    </CardTitle>
                    <CardDescription>
                      Manage your workspace subscription and billing
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="p-4 bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg border border-indigo-200">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-lg">Enterprise Plan</h3>
                          <p className="text-sm text-slate-600">Billed annually</p>
                        </div>
                        <div className="text-right">
                          <div className="text-2xl font-bold text-indigo-600">$999</div>
                          <div className="text-sm text-slate-600">/month</div>
                        </div>
                      </div>
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span>Next billing date:</span>
                          <span className="font-medium">October 1, 2025</span>
                        </div>
                        <div className="flex justify-between">
                          <span>Payment method:</span>
                          <span className="font-medium">•••• 4242</span>
                        </div>
                      </div>
                    </div>
                    <Button className="w-full" variant="outline">
                      Manage Billing
                    </Button>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Analytics Tab */}
            <TabsContent value="analytics" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <BarChart3 className="h-5 w-5 text-indigo-600" />
                      Workspace Analytics
                    </CardTitle>
                    <CardDescription>
                      Usage statistics and insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3">
                      <div className="p-4 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-lg border border-blue-200">
                        <div className="text-sm text-slate-600 mb-1">Total Campaigns</div>
                        <div className="text-3xl font-bold text-indigo-600">247</div>
                        <div className="text-xs text-slate-500 mt-1">+12% this month</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 rounded-lg border border-green-200">
                        <div className="text-sm text-slate-600 mb-1">Active Prospects</div>
                        <div className="text-3xl font-bold text-green-600">1,843</div>
                        <div className="text-xs text-slate-500 mt-1">+8% this month</div>
                      </div>
                      <div className="p-4 bg-gradient-to-br from-purple-50 to-pink-50 rounded-lg border border-purple-200">
                        <div className="text-sm text-slate-600 mb-1">Team Members</div>
                        <div className="text-3xl font-bold text-purple-600">12</div>
                        <div className="text-xs text-slate-500 mt-1">No change</div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* LLM Configuration Modal */}
      <LLMConfigModal
        isOpen={isLLMModalOpen}
        onClose={() => setIsLLMModalOpen(false)}
        onSave={() => {
          console.log('LLM model selection saved for workspace');
          setIsLLMModalOpen(false);
        }}
      />

      {/* Email Providers Modal */}
      <EmailProvidersModal
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
      />
    </div>
  )
}
