'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import LLMConfigModal from '@/components/LLMConfigModal'
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
  Sparkles
} from 'lucide-react'

export default function WorkspaceSettingsPage({ params }: { params: { workspaceId: string } }) {
  const [activeTab, setActiveTab] = useState('general')
  const [isLLMModalOpen, setIsLLMModalOpen] = useState(false)
  const [workspaceName, setWorkspaceName] = useState('InnovareAI')

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
            <TabsList className="grid w-full grid-cols-5 bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg">
              {[
                { id: 'general', icon: Settings, label: 'General' },
                { id: 'team', icon: Users, label: 'Team' },
                { id: 'integrations', icon: Zap, label: 'Integrations' },
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
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Users className="h-5 w-5 text-indigo-600" />
                      Team Members
                    </CardTitle>
                    <CardDescription>
                      Manage workspace members and their roles
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { name: 'Sarah Powell', email: 'sarah@innovareai.com', role: 'Owner', status: 'active' },
                        { name: 'John Smith', email: 'john@innovareai.com', role: 'Admin', status: 'active' },
                        { name: 'Jane Doe', email: 'jane@innovareai.com', role: 'Member', status: 'active' }
                      ].map((member) => (
                        <div key={member.email} className="flex items-center justify-between p-4 border border-slate-200 rounded-lg">
                          <div className="flex items-center gap-3">
                            <div className="w-10 h-10 bg-indigo-100 rounded-full flex items-center justify-center">
                              <span className="text-indigo-600 font-medium">
                                {member.name.split(' ').map(n => n[0]).join('')}
                              </span>
                            </div>
                            <div>
                              <div className="font-medium">{member.name}</div>
                              <div className="text-sm text-slate-600">{member.email}</div>
                            </div>
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="secondary">{member.role}</Badge>
                            <Badge className="bg-green-100 text-green-700">{member.status}</Badge>
                          </div>
                        </div>
                      ))}
                      <Button className="w-full bg-indigo-600 hover:bg-indigo-700">
                        <Users className="h-4 w-4 mr-2" />
                        Invite Team Member
                      </Button>
                    </div>
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
    </div>
  )
}
