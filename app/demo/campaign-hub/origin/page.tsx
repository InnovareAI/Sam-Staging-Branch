'use client'

import React from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { 
  Zap, Users, TrendingUp, Mail, LinkedinIcon, Target, Play, BarChart3, 
  DollarSign, Eye, Settings, Filter, Plus
} from 'lucide-react'

export default function OriginCampaignHubPage() {
  return (
    <div className="min-h-screen bg-white">
      {/* Clean header */}
      <div className="border-b border-gray-100 bg-white">
        <div className="max-w-6xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
                <Zap className="h-6 w-6 text-white" />
              </div>
              <div>
                <h1 className="text-2xl font-semibold text-gray-900">Campaign Hub</h1>
                <p className="text-gray-500 text-sm">Origin UI - Clean Campaign Management</p>
              </div>
            </div>
            <Button>
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </div>
        </div>
      </div>

      <div className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Key metrics */}
        <motion.div 
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
          className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
        >
          {[
            { title: 'Total Campaigns', value: '47', icon: Target, change: '+3 this month' },
            { title: 'Active Campaigns', value: '23', icon: Play, change: 'Currently running' },
            { title: 'Total Reach', value: '847K', icon: Users, change: '+12% vs last month' },
            { title: 'Conversion Rate', value: '8.4%', icon: TrendingUp, change: '+2.1% improvement' }
          ].map((metric) => (
            <Card key={metric.title} className="shadow-sm">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium text-gray-600">
                  {metric.title}
                </CardTitle>
                <metric.icon className="h-4 w-4 text-gray-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-semibold">{metric.value}</div>
                <p className="text-xs text-gray-500 mt-1">{metric.change}</p>
              </CardContent>
            </Card>
          ))}
        </motion.div>

        {/* Main content */}
        <div className="grid gap-8 lg:grid-cols-3">
          {/* Campaign list */}
          <div className="lg:col-span-2">
            <Card className="shadow-sm">
              <CardHeader>
                <div className="flex items-center justify-between">
                  <CardTitle className="flex items-center gap-2">
                    <BarChart3 className="h-5 w-5" />
                    Active Campaigns
                  </CardTitle>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                    <Button variant="outline" size="sm">
                      View All
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-6">
                  {[
                    {
                      name: 'Q4 Product Launch Campaign',
                      platform: 'Multi-Channel',
                      status: 'active',
                      reach: 45230,
                      engagement: 12.3,
                      budget: 15000,
                      spent: 8750,
                      daysLeft: 12
                    },
                    {
                      name: 'Holiday Email Marketing',
                      platform: 'Email',
                      status: 'active',
                      reach: 89450,
                      engagement: 24.1,
                      budget: 8000,
                      spent: 3200,
                      daysLeft: 25
                    },
                    {
                      name: 'LinkedIn Professional Outreach',
                      platform: 'LinkedIn',
                      status: 'paused',
                      reach: 156780,
                      engagement: 8.9,
                      budget: 25000,
                      spent: 18900,
                      daysLeft: 8
                    }
                  ].map((campaign) => (
                    <div key={campaign.name} className="border border-gray-100 rounded-lg p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div>
                          <h3 className="font-semibold text-gray-900">{campaign.name}</h3>
                          <p className="text-sm text-gray-500">{campaign.platform}</p>
                        </div>
                        <div className="flex items-center gap-3">
                          <Badge 
                            variant="outline"
                            className={campaign.status === 'active' ? 'border-green-200 text-green-700 bg-green-50' : 'border-yellow-200 text-yellow-700 bg-yellow-50'}
                          >
                            {campaign.status}
                          </Badge>
                          <span className="text-sm text-gray-500">{campaign.daysLeft} days left</span>
                        </div>
                      </div>

                      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Reach</p>
                          <p className="font-semibold">{campaign.reach.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Engagement</p>
                          <p className="font-semibold">{campaign.engagement}%</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Budget</p>
                          <p className="font-semibold">${campaign.budget.toLocaleString()}</p>
                        </div>
                        <div>
                          <p className="text-xs text-gray-500 mb-1">Spent</p>
                          <p className="font-semibold">${campaign.spent.toLocaleString()}</p>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-gray-600">Budget Usage</span>
                          <span>{Math.round((campaign.spent / campaign.budget) * 100)}%</span>
                        </div>
                        <Progress value={(campaign.spent / campaign.budget) * 100} className="h-2" />
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Right sidebar */}
          <div className="space-y-6">
            {/* Quick actions */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Play className="h-5 w-5" />
                  Quick Launch
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  { name: 'Email Campaign', icon: Mail, templates: 12 },
                  { name: 'LinkedIn Outreach', icon: LinkedinIcon, templates: 8 },
                  { name: 'Multi-Channel Campaign', icon: Target, templates: 5 }
                ].map((option) => (
                  <Button 
                    key={option.name}
                    variant="outline" 
                    className="w-full justify-between"
                  >
                    <div className="flex items-center">
                      <option.icon className="h-4 w-4 mr-2" />
                      {option.name}
                    </div>
                    <Badge variant="secondary">{option.templates}</Badge>
                  </Button>
                ))}
              </CardContent>
            </Card>

            {/* Performance insights */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Eye className="h-5 w-5" />
                  Performance Insights
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {[
                  { label: 'Best Performing Campaign', value: 'Holiday Email', metric: '24.1% engagement' },
                  { label: 'Top Platform', value: 'Email Marketing', metric: '89K reach' },
                  { label: 'Peak Performance Time', value: '2-4 PM EST', metric: 'Weekdays' },
                  { label: 'Budget Optimization', value: '3 campaigns', metric: 'Need attention' }
                ].map((insight) => (
                  <div key={insight.label} className="border border-gray-100 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <p className="text-xs text-gray-500">{insight.label}</p>
                        <p className="text-sm font-medium">{insight.value}</p>
                      </div>
                      <Badge variant="outline" className="text-xs">
                        {insight.metric}
                      </Badge>
                    </div>
                  </div>
                ))}
              </CardContent>
            </Card>

            {/* Campaign tools */}
            <Card className="shadow-sm">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Settings className="h-5 w-5" />
                  Campaign Tools
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {[
                  'A/B Test Manager',
                  'Audience Segmentation',
                  'Content Optimizer',
                  'Performance Analytics'
                ].map((tool) => (
                  <Button 
                    key={tool}
                    variant="outline" 
                    className="w-full justify-start"
                  >
                    {tool}
                  </Button>
                ))}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}