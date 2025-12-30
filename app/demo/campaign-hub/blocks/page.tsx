'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Zap, 
  Users, 
  TrendingUp, 
  Mail, 
  LinkedinIcon,
  BarChart3,
  Target,
  Calendar,
  MessageSquare,
  Eye,
  MousePointer,
  DollarSign,
  CheckCircle,
  AlertTriangle,
  Play,
  Pause,
  Settings,
  Filter,
  Download,
  Share
} from 'lucide-react'

export default function BlocksCampaignHubPage() {
  const [activeFilter, setActiveFilter] = useState('all')

  const campaignMetrics = {
    totalCampaigns: 47,
    activeCampaigns: 23,
    totalReach: 847392,
    conversionRate: 8.4,
    totalRevenue: 234750,
    pendingApproval: 5
  }

  const recentCampaigns = [
    {
      id: 1,
      name: 'Q4 Product Launch',
      status: 'active',
      platform: 'LinkedIn',
      reach: 45230,
      engagement: 12.3,
      conversion: 8.7,
      budget: 15000,
      spent: 8750,
      daysLeft: 12
    },
    {
      id: 2,
      name: 'Holiday Email Series',
      status: 'active', 
      platform: 'Email',
      reach: 89450,
      engagement: 24.1,
      conversion: 5.2,
      budget: 8000,
      spent: 3200,
      daysLeft: 25
    },
    {
      id: 3,
      name: 'Brand Awareness Drive',
      status: 'paused',
      platform: 'Multi-Channel',
      reach: 156780,
      engagement: 8.9,
      conversion: 3.1,
      budget: 25000,
      spent: 18900,
      daysLeft: 8
    }
  ]

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="bg-black/30 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 360, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg"
              >
                <Zap className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-semibold text-white">Campaign Command Center</h1>
                <p className="text-blue-200">Blocks.mvp-subha.me - Enterprise Campaign Analytics</p>
              </div>
            </div>
            
            {/* Real-time stats */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-semibold text-green-400">{campaignMetrics.activeCampaigns}</div>
                <div className="text-xs text-gray-400">Active</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-400">{(campaignMetrics.totalReach / 1000).toFixed(0)}K</div>
                <div className="text-xs text-gray-400">Total Reach</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-purple-400">{campaignMetrics.conversionRate}%</div>
                <div className="text-xs text-gray-400">Conversion</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto space-y-8">
        {/* Key Metrics Dashboard */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="grid gap-6 md:grid-cols-3 lg:grid-cols-6"
        >
          {[
            { title: 'Total Campaigns', value: campaignMetrics.totalCampaigns, icon: Target, color: 'blue' },
            { title: 'Active Now', value: campaignMetrics.activeCampaigns, icon: Play, color: 'green' },
            { title: 'Total Reach', value: `${(campaignMetrics.totalReach / 1000).toFixed(0)}K`, icon: Users, color: 'purple' },
            { title: 'Avg CVR', value: `${campaignMetrics.conversionRate}%`, icon: TrendingUp, color: 'orange' },
            { title: 'Revenue', value: `$${(campaignMetrics.totalRevenue / 1000).toFixed(0)}K`, icon: DollarSign, color: 'pink' },
            { title: 'Pending', value: campaignMetrics.pendingApproval, icon: AlertTriangle, color: 'yellow' }
          ].map((metric, index) => (
            <motion.div
              key={metric.title}
              whileHover={{ y: -5, scale: 1.02 }}
              className="relative"
            >
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl overflow-hidden group">
                <div className="absolute inset-0 bg-gradient-to-br from-white/5 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></div>
                <CardContent className="p-4 relative z-10">
                  <div className="flex items-center justify-between mb-2">
                    <metric.icon className={`h-5 w-5 text-${metric.color}-400`} />
                    <Badge className={`text-xs bg-${metric.color}-500/20 text-${metric.color}-300 border-${metric.color}-500/30`}>
                      Live
                    </Badge>
                  </div>
                  <div className="text-2xl font-semibold text-white mb-1">{metric.value}</div>
                  <div className="text-xs text-gray-400">{metric.title}</div>
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </motion.div>

        {/* Main Dashboard Grid */}
        <div className="grid gap-8 lg:grid-cols-4">
          {/* Campaign Performance Analytics */}
          <motion.div
            initial={{ opacity: 0, x: -20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.4 }}
            className="lg:col-span-3"
          >
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-white text-xl">
                    <BarChart3 className="h-6 w-6 text-blue-400" />
                    Campaign Performance Dashboard
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm" className="text-white border-white/20 hover:bg-white/10">
                      <Download className="h-4 w-4 mr-2" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-6">
                {/* Performance Chart Visualization */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-green-400" />
                    Weekly Performance Trends
                  </h4>
                  <div className="h-48 bg-gradient-to-r from-blue-500/10 to-purple-500/10 rounded-xl flex items-end justify-between p-4 gap-2">
                    {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map((day, index) => (
                      <div key={day} className="flex-1 flex flex-col items-center">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${30 + Math.random() * 60}%` }}
                          transition={{ delay: index * 0.1 + 0.6, duration: 0.8 }}
                          className="bg-gradient-to-t from-blue-400 to-purple-500 w-full rounded-t-lg mb-2"
                        />
                        <span className="text-xs text-gray-400">{day}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Active Campaigns Table */}
                <div>
                  <h4 className="text-lg font-semibold text-white mb-4 flex items-center gap-2">
                    <Target className="h-5 w-5 text-orange-400" />
                    Active Campaign Overview
                  </h4>
                  <div className="space-y-3">
                    {recentCampaigns.map((campaign, index) => (
                      <motion.div
                        key={campaign.id}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: index * 0.1 + 0.8 }}
                        whileHover={{ x: 5, scale: 1.01 }}
                        className="bg-white/5 backdrop-blur-sm border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-all cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <div className="flex items-center gap-3">
                            <div className={`w-3 h-3 rounded-full ${
                              campaign.status === 'active' ? 'bg-green-400 animate-pulse' : 'bg-yellow-400'
                            }`} />
                            <div>
                              <h5 className="font-semibold text-white">{campaign.name}</h5>
                              <p className="text-sm text-gray-400">{campaign.platform}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <Badge className={`${
                              campaign.status === 'active' 
                                ? 'bg-green-500/20 text-green-300 border-green-500/30' 
                                : 'bg-yellow-500/20 text-yellow-300 border-yellow-500/30'
                            }`}>
                              {campaign.status}
                            </Badge>
                            <span className="text-xs text-gray-400">{campaign.daysLeft} days left</span>
                          </div>
                        </div>

                        <div className="grid grid-cols-4 gap-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Reach</p>
                            <p className="text-sm font-semibold text-white">{campaign.reach.toLocaleString()}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Engagement</p>
                            <p className="text-sm font-semibold text-blue-400">{campaign.engagement}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Conversion</p>
                            <p className="text-sm font-semibold text-green-400">{campaign.conversion}%</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Budget Used</p>
                            <div className="flex items-center gap-2">
                              <Progress 
                                value={(campaign.spent / campaign.budget) * 100} 
                                className="h-2 flex-1 bg-gray-700"
                              />
                              <span className="text-xs text-white">{Math.round((campaign.spent / campaign.budget) * 100)}%</span>
                            </div>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </motion.div>

          {/* Campaign Controls & Quick Actions */}
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.6 }}
            className="space-y-6"
          >
            {/* Quick Launch */}
            <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-500/30 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Play className="h-5 w-5 text-green-400" />
                  Quick Launch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Email Campaign', icon: Mail, count: 3 },
                  { name: 'LinkedIn Outreach', icon: LinkedinIcon, count: 5 },
                  { name: 'Multi-Channel', icon: Target, count: 2 }
                ].map((template) => (
                  <motion.div
                    key={template.name}
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button variant="outline" className="w-full justify-start bg-white/5 border-green-500/20 text-white hover:bg-green-500/10">
                      <template.icon className="h-4 w-4 mr-2 text-green-400" />
                      {template.name}
                      <Badge className="ml-auto bg-green-500/20 text-green-300 border-green-500/30">
                        {template.count}
                      </Badge>
                    </Button>
                  </motion.div>
                ))}
              </CardContent>
            </Card>

            {/* Performance Insights */}
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Eye className="h-5 w-5 text-blue-400" />
                  Live Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { metric: 'Best Performing', value: 'Q4 Launch', change: '+23%', color: 'green' },
                  { metric: 'Top Platform', value: 'LinkedIn', change: '89% reach', color: 'blue' },
                  { metric: 'Peak Time', value: '2-4 PM EST', change: 'Today', color: 'purple' },
                  { metric: 'Budget Alert', value: '3 Campaigns', change: '85% spent', color: 'orange' }
                ].map((insight) => (
                  <div key={insight.metric} className="flex items-center justify-between p-3 bg-white/5 rounded-lg">
                    <div>
                      <p className="text-xs text-gray-400">{insight.metric}</p>
                      <p className="text-sm font-semibold text-white">{insight.value}</p>
                    </div>
                    <Badge className={`text-xs bg-${insight.color}-500/20 text-${insight.color}-300 border-${insight.color}-500/30`}>
                      {insight.change}
                    </Badge>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Campaign Tools */}
            <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-white">
                  <Settings className="h-5 w-5 text-purple-400" />
                  Campaign Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { label: 'A/B Test Creator', icon: Target },
                  { label: 'Audience Builder', icon: Users },
                  { label: 'Content Optimizer', icon: TrendingUp },
                  { label: 'Analytics Export', icon: BarChart3 }
                ].map((tool) => (
                  <motion.div
                    key={tool.label}
                    whileHover={{ scale: 1.02, x: 5 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <Button variant="outline" className="w-full justify-start bg-white/5 border-white/10 text-white hover:bg-white/10">
                      <tool.icon className="h-4 w-4 mr-2 text-purple-400" />
                      {tool.label}
                    </Button>
                  </motion.div>
                ))}
              </CardContent>
            </Card>
          </motion.div>
        </div>
      </div>
    </div>
  )
}