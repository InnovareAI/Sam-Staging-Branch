'use client'

import React, { useState, useRef, useEffect } from 'react'
import { motion, AnimatePresence, useAnimation, useInView } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Megaphone, 
  Target, 
  Send, 
  BarChart3,
  Users,
  Calendar,
  Clock,
  Mail,
  LinkedinIcon,
  MessageCircle,
  TrendingUp,
  Play,
  Pause,
  Settings,
  Plus,
  Eye,
  Heart,
  Share2,
  Download,
  Filter,
  Search,
  Zap,
  Sparkles,
  Globe,
  Layers,
  PieChart,
  Activity
} from 'lucide-react'

export default function DemoCampaignHubPage() {
  const [activeTab, setActiveTab] = useState('overview')
  const [campaigns, setCampaigns] = useState([
    {
      id: 1,
      name: 'Q1 Lead Generation',
      status: 'active',
      type: 'email',
      reach: 12450,
      engagement: 8.7,
      conversions: 156,
      budget: 5000,
      spent: 3200
    },
    {
      id: 2,
      name: 'LinkedIn Outreach',
      status: 'draft',
      type: 'linkedin',
      reach: 0,
      engagement: 0,
      conversions: 0,
      budget: 2000,
      spent: 0
    },
    {
      id: 3,
      name: 'Product Launch',
      status: 'completed',
      type: 'multi',
      reach: 45230,
      engagement: 12.3,
      conversions: 892,
      budget: 15000,
      spent: 14750
    }
  ])

  // Animation refs
  const ref = useRef(null)
  const isInView = useInView(ref)
  const controls = useAnimation()

  useEffect(() => {
    if (isInView) {
      controls.start("visible")
    }
  }, [controls, isInView])


  // Campaign card hover effect
  const CampaignCard = ({ campaign, index }) => {
    const [isHovered, setIsHovered] = useState(false)
    
    return (
      <motion.div
        initial={{ opacity: 0, y: 50, rotateX: -15 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 0.6, delay: index * 0.1 }}
        whileHover={{ 
          y: -10, 
          scale: 1.02,
          rotateX: 5,
          boxShadow: "0 25px 50px -12px rgba(0, 0, 0, 0.25)"
        }}
        onHoverStart={() => setIsHovered(true)}
        onHoverEnd={() => setIsHovered(false)}
        className="relative"
      >
        <Card className="bg-gradient-to-br from-white/90 to-blue-50/90 backdrop-blur-sm border-0 shadow-xl overflow-hidden">
          {/* Animated background gradient */}
          <motion.div
            animate={{
              background: isHovered 
                ? "linear-gradient(135deg, rgba(99, 102, 241, 0.1), rgba(168, 85, 247, 0.1))"
                : "linear-gradient(135deg, rgba(99, 102, 241, 0.05), rgba(168, 85, 247, 0.05))"
            }}
            className="absolute inset-0"
          />
          
          <CardHeader className="relative">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <motion.div
                  whileHover={{ rotate: 360, scale: 1.2 }}
                  transition={{ duration: 0.6 }}
                  className={`p-2 rounded-lg ${
                    campaign.type === 'email' ? 'bg-blue-100' :
                    campaign.type === 'linkedin' ? 'bg-blue-600 text-white' :
                    'bg-gradient-to-r from-purple-500 to-pink-500 text-white'
                  }`}
                >
                  {campaign.type === 'email' ? <Mail className="h-5 w-5 text-blue-600" /> :
                   campaign.type === 'linkedin' ? <LinkedinIcon className="h-5 w-5" /> :
                   <Megaphone className="h-5 w-5" />}
                </motion.div>
                <div>
                  <CardTitle className="text-lg">{campaign.name}</CardTitle>
                  <CardDescription className="capitalize">{campaign.type} Campaign</CardDescription>
                </div>
              </div>
              <Badge 
                variant={
                  campaign.status === 'active' ? 'default' : 
                  campaign.status === 'draft' ? 'secondary' : 
                  'outline'
                }
                className={`${
                  campaign.status === 'active' ? 'bg-green-100 text-green-700' :
                  campaign.status === 'draft' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-gray-100 text-gray-700'
                }`}
              >
                {campaign.status}
              </Badge>
            </div>
          </CardHeader>
          
          <CardContent className="relative">
            <div className="grid grid-cols-2 gap-4 mb-4">
              <div className="text-center p-3 bg-white/70 rounded-lg">
                <motion.p 
                  key={campaign.reach}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-blue-600"
                >
                  {campaign.reach.toLocaleString()}
                </motion.p>
                <p className="text-sm text-gray-600">Reach</p>
              </div>
              <div className="text-center p-3 bg-white/70 rounded-lg">
                <motion.p 
                  key={campaign.conversions}
                  initial={{ scale: 1.2 }}
                  animate={{ scale: 1 }}
                  className="text-2xl font-bold text-purple-600"
                >
                  {campaign.conversions}
                </motion.p>
                <p className="text-sm text-gray-600">Conversions</p>
              </div>
            </div>
            
            <div className="mb-4">
              <div className="flex justify-between text-sm mb-2">
                <span>Budget Progress</span>
                <span>${campaign.spent.toLocaleString()} / ${campaign.budget.toLocaleString()}</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <motion.div
                  initial={{ width: 0 }}
                  animate={{ width: `${(campaign.spent / campaign.budget) * 100}%` }}
                  transition={{ duration: 1, delay: 0.3 }}
                  className={`h-2 rounded-full ${
                    campaign.status === 'active' ? 'bg-gradient-to-r from-blue-500 to-purple-500' :
                    campaign.status === 'draft' ? 'bg-gray-400' :
                    'bg-green-500'
                  }`}
                />
              </div>
            </div>
            
            <div className="flex justify-between items-center">
              <div className="flex items-center gap-1">
                <TrendingUp className="h-4 w-4 text-green-500" />
                <span className="text-sm text-green-600">+{campaign.engagement}%</span>
              </div>
              <div className="flex gap-2">
                <Button size="sm" variant="outline" className="hover:bg-blue-50">
                  <Eye className="h-4 w-4" />
                </Button>
                <Button size="sm" variant="outline" className="hover:bg-green-50">
                  {campaign.status === 'active' ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 p-6">
      {/* Floating background elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <motion.div
          animate={{
            y: [-10, 10, -10]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear"
          }}
          className="absolute -top-4 -left-4 w-72 h-72 bg-gradient-to-r from-blue-400/20 to-purple-400/20 rounded-full blur-3xl"
        />
        <motion.div
          animate={{
            y: [10, -10, 10]
          }}
          transition={{
            duration: 4,
            repeat: Infinity,
            ease: "linear",
            delay: 2
          }}
          className="absolute -bottom-4 -right-4 w-96 h-96 bg-gradient-to-r from-pink-400/20 to-yellow-400/20 rounded-full blur-3xl"
        />
      </div>

      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6 }}
        className="max-w-7xl mx-auto mb-8 relative z-10"
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ 
                rotate: [0, 360],
                scale: [1, 1.1, 1]
              }}
              transition={{ 
                duration: 6, 
                repeat: Infinity,
                ease: "easeInOut"
              }}
              className="p-4 bg-gradient-to-br from-blue-500 to-purple-600 rounded-2xl shadow-xl"
            >
              <Megaphone className="h-8 w-8 text-white" />
            </motion.div>
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-600 via-purple-600 to-pink-600 bg-clip-text text-transparent">
                Campaign Hub Demo
              </h1>
              <p className="text-slate-600 mt-1">
                Multi-channel campaign management • All 5 design approaches showcase
              </p>
            </div>
          </div>
          
          <motion.div whileHover={{ scale: 1.05 }} whileTap={{ scale: 0.95 }}>
            <Button className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 shadow-lg">
              <Plus className="h-4 w-4 mr-2" />
              New Campaign
            </Button>
          </motion.div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto relative z-10">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Enhanced Tab Navigation - SHSF UI Style */}
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: 0.2 }}
          >
            <TabsList className="grid w-full grid-cols-5 bg-white/70 backdrop-blur-xl border-0 shadow-xl rounded-2xl p-2">
              {[
                { id: 'overview', icon: BarChart3, label: 'Overview', color: 'blue' },
                { id: 'campaigns', icon: Target, label: 'Campaigns', color: 'purple' },
                { id: 'analytics', icon: PieChart, label: 'Analytics', color: 'green' },
                { id: 'templates', icon: Layers, label: 'Templates', color: 'orange' },
                { id: 'automation', icon: Zap, label: 'Automation', color: 'pink' }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className={`flex items-center gap-2 data-[state=active]:bg-gradient-to-r data-[state=active]:from-${tab.color}-500 data-[state=active]:to-${tab.color}-600 data-[state=active]:text-white data-[state=active]:shadow-lg rounded-xl transition-all duration-300`}
                >
                  <motion.div
                    whileHover={{ rotate: 360 }}
                    transition={{ duration: 0.5 }}
                  >
                    <tab.icon className="h-4 w-4" />
                  </motion.div>
                  <span className="hidden sm:inline font-medium">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          <div className="mt-8 space-y-8">
            {/* Overview Tab - Blocks.mvp-subha.me Style */}
            <TabsContent value="overview" className="space-y-8">
              {/* Stats Cards */}
              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-4">
                {[
                  { title: 'Active Campaigns', value: '12', change: '+3', icon: Activity, color: 'blue' },
                  { title: 'Total Reach', value: '125.4K', change: '+12%', icon: Users, color: 'green' },
                  { title: 'Engagement Rate', value: '8.7%', change: '+2.1%', icon: Heart, color: 'purple' },
                  { title: 'Conversions', value: '1,234', change: '+23%', icon: Target, color: 'orange' }
                ].map((stat, index) => (
                  <motion.div
                    key={stat.title}
                    initial={{ opacity: 0, y: 20, scale: 0.9 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    transition={{ duration: 0.5, delay: index * 0.1 }}
                    whileHover={{ 
                      y: -5, 
                      scale: 1.02,
                      boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)"
                    }}
                  >
                    <Card className={`bg-gradient-to-br from-${stat.color}-50 to-${stat.color}-100 border-${stat.color}-200 shadow-lg overflow-hidden`}>
                      <div className={`absolute inset-0 bg-gradient-to-br from-${stat.color}-500/5 to-${stat.color}-600/10`}></div>
                      <CardContent className="p-6 relative">
                        <div className="flex items-center justify-between">
                          <div>
                            <p className={`text-sm font-medium text-${stat.color}-600`}>{stat.title}</p>
                            <motion.p 
                              key={stat.value}
                              initial={{ scale: 1.3 }}
                              animate={{ scale: 1 }}
                              className="text-3xl font-bold text-gray-900 mt-2"
                            >
                              {stat.value}
                            </motion.p>
                            <div className="flex items-center mt-2">
                              <TrendingUp className="h-4 w-4 text-green-500 mr-1" />
                              <span className="text-sm text-green-600">{stat.change}</span>
                            </div>
                          </div>
                          <motion.div
                            whileHover={{ rotate: 360, scale: 1.2 }}
                            transition={{ duration: 0.6 }}
                            className={`p-3 bg-${stat.color}-500 rounded-full shadow-lg`}
                          >
                            <stat.icon className="h-8 w-8 text-white" />
                          </motion.div>
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                ))}
              </div>

              {/* Quick Actions - Origin UI Style */}
              <motion.div
                initial={{ opacity: 0, y: 30 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.6, delay: 0.4 }}
              >
                <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Sparkles className="h-5 w-5 text-purple-600" />
                      Quick Actions
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
                      {[
                        { label: 'Email Campaign', icon: Mail, color: 'blue' },
                        { label: 'LinkedIn Outreach', icon: LinkedinIcon, color: 'blue' },
                        { label: 'Social Media', icon: Share2, color: 'purple' },
                        { label: 'SMS Campaign', icon: MessageCircle, color: 'green' },
                        { label: 'Web Push', icon: Globe, color: 'orange' },
                        { label: 'Analytics', icon: BarChart3, color: 'pink' }
                      ].map((action, index) => (
                        <motion.button
                          key={action.label}
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          transition={{ delay: 0.1 * index }}
                          whileHover={{ scale: 1.05, y: -5 }}
                          whileTap={{ scale: 0.95 }}
                          className={`p-4 bg-gradient-to-br from-${action.color}-50 to-${action.color}-100 border-${action.color}-200 rounded-xl border-2 hover:border-${action.color}-300 transition-all duration-300 group`}
                        >
                          <motion.div
                            whileHover={{ rotate: 10 }}
                            className={`w-12 h-12 bg-${action.color}-500 rounded-lg flex items-center justify-center mx-auto mb-2 shadow-lg group-hover:shadow-xl`}
                          >
                            <action.icon className="h-6 w-6 text-white" />
                          </motion.div>
                          <p className="text-sm font-medium text-gray-700">{action.label}</p>
                        </motion.button>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Campaigns Tab - Kibo UI Card Stack Style */}
            <TabsContent value="campaigns" ref={ref}>
              <motion.div
                initial={{ opacity: 0 }}
                animate={controls}
                variants={{
                  visible: { opacity: 1, transition: { staggerChildren: 0.1 } }
                }}
                className="space-y-6"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    <div className="flex items-center gap-2 bg-white/70 backdrop-blur-sm rounded-xl p-3 shadow-lg">
                      <Search className="h-4 w-4 text-gray-500" />
                      <Input placeholder="Search campaigns..." className="border-0 bg-transparent" />
                    </div>
                    <Button variant="outline" className="bg-white/70 backdrop-blur-sm shadow-lg border-0">
                      <Filter className="h-4 w-4 mr-2" />
                      Filter
                    </Button>
                  </div>
                </div>

                <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                  {campaigns.map((campaign, index) => (
                    <CampaignCard key={campaign.id} campaign={campaign} index={index} />
                  ))}
                </div>
              </motion.div>
            </TabsContent>

            {/* Analytics Tab - Skiper UI Enhanced Effects */}
            <TabsContent value="analytics">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-gradient-to-br from-blue-50 to-indigo-100 border-blue-200 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-blue-800">
                        <BarChart3 className="h-5 w-5" />
                        Performance Overview
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        {['Email Open Rate', 'Click-through Rate', 'Conversion Rate'].map((metric, index) => (
                          <motion.div
                            key={metric}
                            initial={{ opacity: 0, x: -20 }}
                            animate={{ opacity: 1, x: 0 }}
                            transition={{ delay: index * 0.1 }}
                            whileHover={{ x: 10, backgroundColor: 'rgba(59, 130, 246, 0.05)' }}
                            className="p-3 rounded-lg transition-all duration-300"
                          >
                            <div className="flex justify-between items-center mb-2">
                              <span className="text-sm font-medium">{metric}</span>
                              <span className="text-sm text-blue-600 font-bold">
                                {index === 0 ? '24.5%' : index === 1 ? '8.7%' : '3.2%'}
                              </span>
                            </div>
                            <div className="w-full bg-blue-100 rounded-full h-2">
                              <motion.div
                                initial={{ width: 0 }}
                                animate={{ 
                                  width: index === 0 ? '75%' : index === 1 ? '65%' : '45%' 
                                }}
                                transition={{ duration: 1, delay: 0.2 + index * 0.1 }}
                                className="bg-gradient-to-r from-blue-500 to-indigo-600 h-2 rounded-full"
                              />
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-purple-50 to-pink-100 border-purple-200 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-purple-800">
                        <PieChart className="h-5 w-5" />
                        Channel Distribution
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        {[
                          { channel: 'Email', percentage: 45, color: 'blue' },
                          { channel: 'LinkedIn', percentage: 30, color: 'blue' },
                          { channel: 'Social Media', percentage: 25, color: 'purple' }
                        ].map((item, index) => (
                          <motion.div
                            key={item.channel}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ delay: index * 0.15 }}
                            whileHover={{ scale: 1.02 }}
                            className="flex items-center justify-between p-3 bg-white/70 rounded-lg"
                          >
                            <div className="flex items-center gap-3">
                              <div className={`w-4 h-4 bg-${item.color}-500 rounded-full`}></div>
                              <span className="font-medium">{item.channel}</span>
                            </div>
                            <span className="font-bold text-purple-600">{item.percentage}%</span>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </TabsContent>

            {/* Templates Tab - Combined Approach */}
            <TabsContent value="templates">
              <motion.div
                initial={{ opacity: 0, rotateX: -10 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <Card className="bg-white/80 backdrop-blur-sm shadow-xl border-0">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Layers className="h-5 w-5 text-orange-600" />
                      Campaign Templates
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[
                        { name: 'Welcome Series', type: 'Email', users: 1234 },
                        { name: 'Product Launch', type: 'Multi-channel', users: 892 },
                        { name: 'Re-engagement', type: 'Email + SMS', users: 567 },
                        { name: 'Lead Nurturing', type: 'LinkedIn', users: 445 },
                        { name: 'Event Promotion', type: 'Social', users: 778 },
                        { name: 'Customer Survey', type: 'Email', users: 334 }
                      ].map((template, index) => (
                        <motion.div
                          key={template.name}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          transition={{ delay: index * 0.1 }}
                          whileHover={{ scale: 1.05, rotateY: 5 }}
                          className="p-4 bg-gradient-to-br from-gray-50 to-white border-2 border-gray-200 hover:border-orange-300 rounded-xl cursor-pointer transition-all duration-300"
                        >
                          <h3 className="font-semibold text-lg mb-2">{template.name}</h3>
                          <p className="text-sm text-gray-600 mb-3">{template.type}</p>
                          <div className="flex justify-between items-center">
                            <span className="text-xs text-gray-500">{template.users.toLocaleString()} users</span>
                            <Button size="sm" className="bg-orange-500 hover:bg-orange-600">
                              Use Template
                            </Button>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Automation Tab - SHSF UI Motion First */}
            <TabsContent value="automation">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <Card className="bg-gradient-to-br from-pink-50 to-purple-100 border-pink-200 shadow-xl overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-pink-500/5 to-purple-500/10"></div>
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2 text-pink-800">
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Zap className="h-5 w-5" />
                      </motion.div>
                      Automation Rules
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="relative">
                    <div className="space-y-4">
                      {[
                        { 
                          trigger: 'New lead captured', 
                          action: 'Send welcome email series', 
                          status: 'active',
                          executions: 234 
                        },
                        { 
                          trigger: 'Email not opened in 7 days', 
                          action: 'Send follow-up SMS', 
                          status: 'paused',
                          executions: 89 
                        },
                        { 
                          trigger: 'Link clicked in email', 
                          action: 'Add to high-intent list', 
                          status: 'active',
                          executions: 156 
                        }
                      ].map((rule, index) => (
                        <motion.div
                          key={index}
                          initial={{ opacity: 0, x: -30 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.15 }}
                          whileHover={{ 
                            scale: 1.02, 
                            backgroundColor: 'rgba(236, 72, 153, 0.05)' 
                          }}
                          className="p-4 bg-white/70 rounded-xl border-2 border-pink-200 hover:border-pink-300 transition-all duration-300"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <h4 className="font-medium text-gray-900 mb-1">
                                When: {rule.trigger}
                              </h4>
                              <p className="text-sm text-gray-600 mb-2">
                                Then: {rule.action}
                              </p>
                              <p className="text-xs text-gray-500">
                                {rule.executions} executions this month
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              <Badge 
                                variant={rule.status === 'active' ? 'default' : 'secondary'}
                                className={rule.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}
                              >
                                {rule.status}
                              </Badge>
                              <Button size="sm" variant="outline">
                                <Settings className="h-4 w-4" />
                              </Button>
                            </div>
                          </div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}
