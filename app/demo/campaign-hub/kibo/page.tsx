'use client'

import React, { useState } from 'react'
import { motion, PanInfo } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, Users, TrendingUp, Mail, LinkedinIcon, Target, Play, ChevronLeft, ChevronRight,
  BarChart3, DollarSign, Eye, Smartphone, Swipe
} from 'lucide-react'

export default function KiboCampaignHubPage() {
  const [currentCard, setCurrentCard] = useState(0)

  const campaignCards = [
    {
      id: 'overview',
      title: 'Campaign Overview',
      icon: Target,
      color: 'from-blue-400 to-blue-600',
      component: OverviewCard
    },
    {
      id: 'active',
      title: 'Active Campaigns',
      icon: Play,
      color: 'from-green-400 to-green-600',
      component: ActiveCampaignsCard
    },
    {
      id: 'analytics',
      title: 'Performance Analytics',
      icon: BarChart3,
      color: 'from-purple-400 to-purple-600',
      component: AnalyticsCard
    },
    {
      id: 'templates',
      title: 'Quick Templates',
      icon: Zap,
      color: 'from-orange-400 to-orange-600',
      component: TemplatesCard
    }
  ]

  const handleSwipe = (event: any, info: PanInfo) => {
    const threshold = 50
    if (info.offset.x > threshold && currentCard > 0) {
      setCurrentCard(currentCard - 1)
    } else if (info.offset.x < -threshold && currentCard < campaignCards.length - 1) {
      setCurrentCard(currentCard + 1)
    }
  }

  function OverviewCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 bg-gradient-to-r from-blue-400 to-blue-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <Target className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold">Campaign Hub</h2>
          <p className="text-gray-600">Manage all your marketing campaigns</p>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Total Campaigns', value: '47', color: 'blue' },
            { label: 'Active Now', value: '23', color: 'green' },
            { label: 'Total Reach', value: '847K', color: 'purple' },
            { label: 'Revenue', value: '$234K', color: 'orange' }
          ].map((metric) => (
            <motion.div
              key={metric.label}
              whileHover={{ scale: 1.05 }}
              className={`p-4 bg-gradient-to-r from-${metric.color}-50 to-${metric.color}-100 rounded-2xl border-2 border-${metric.color}-200 text-center`}
            >
              <div className={`text-2xl font-bold text-${metric.color}-700`}>{metric.value}</div>
              <div className={`text-sm text-${metric.color}-600`}>{metric.label}</div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  function ActiveCampaignsCard() {
    const campaigns = [
      { name: 'Q4 Product Launch', platform: 'LinkedIn', status: 'active', reach: '45K' },
      { name: 'Holiday Email Series', platform: 'Email', status: 'active', reach: '89K' },
      { name: 'Brand Awareness', platform: 'Multi', status: 'paused', reach: '156K' }
    ]

    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <Play className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold">Active Campaigns</h2>
          <p className="text-gray-600">Currently running campaigns</p>
        </div>

        <div className="space-y-4">
          {campaigns.map((campaign, index) => (
            <motion.div
              key={campaign.name}
              initial={{ opacity: 0, x: -20 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ x: 10, scale: 1.02 }}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border-2 border-green-200"
            >
              <div>
                <h3 className="font-semibold">{campaign.name}</h3>
                <p className="text-sm text-gray-600">{campaign.platform}</p>
              </div>
              <div className="text-right">
                <div className="text-lg font-bold text-green-700">{campaign.reach}</div>
                <Badge className={campaign.status === 'active' ? 'bg-green-500 text-white' : 'bg-yellow-500 text-white'}>
                  {campaign.status}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  function AnalyticsCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ rotateY: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <BarChart3 className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold">Performance Analytics</h2>
          <p className="text-gray-600">Campaign insights and metrics</p>
        </div>

        <div className="space-y-4">
          {[
            { metric: 'Conversion Rate', value: '8.4%', trend: '+2.1%' },
            { metric: 'Click-Through Rate', value: '12.3%', trend: '+0.8%' },
            { metric: 'Cost per Lead', value: '$24.50', trend: '-$3.20' }
          ].map((item) => (
            <motion.div
              key={item.metric}
              whileHover={{ scale: 1.05 }}
              className="p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl border-2 border-purple-200"
            >
              <div className="flex justify-between items-center">
                <div>
                  <div className="text-sm text-gray-600">{item.metric}</div>
                  <div className="text-2xl font-bold text-purple-700">{item.value}</div>
                </div>
                <Badge className="bg-green-500 text-white">{item.trend}</Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  function TemplatesCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ rotate: [0, 180, 360] }}
            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <Zap className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-bold">Quick Templates</h2>
          <p className="text-gray-600">Launch campaigns instantly</p>
        </div>

        <div className="space-y-4">
          {[
            { name: 'Email Newsletter', icon: Mail, count: 12 },
            { name: 'LinkedIn Outreach', icon: LinkedinIcon, count: 8 },
            { name: 'Product Launch', icon: Target, count: 5 }
          ].map((template) => (
            <motion.div
              key={template.name}
              whileHover={{ scale: 1.05, x: 10 }}
              whileTap={{ scale: 0.95 }}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <template.icon className="h-6 w-6 text-orange-600" />
                <span className="font-medium">{template.name}</span>
              </div>
              <Badge className="bg-orange-500 text-white">{template.count}</Badge>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  const CurrentComponent = campaignCards[currentCard].component

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-100 via-blue-50 to-purple-50 p-4">
      {/* Mobile-first header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-md mx-auto mb-8"
      >
        <div className="text-center">
          <motion.div
            whileHover={{ rotate: 180, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
          >
            <Zap className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Campaign Hub
          </h1>
          <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
            <Smartphone className="h-4 w-4" />
            Kibo UI - Swipeable Campaign Management
          </p>
        </div>
      </motion.div>

      {/* Main campaign interface */}
      <div className="max-w-md mx-auto">
        {/* Card indicators */}
        <div className="flex justify-center gap-2 mb-6">
          {campaignCards.map((_, index) => (
            <motion.button
              key={index}
              whileTap={{ scale: 0.8 }}
              onClick={() => setCurrentCard(index)}
              className={`w-3 h-3 rounded-full transition-all duration-300 ${
                index === currentCard ? 'bg-blue-500 scale-125' : 'bg-gray-300'
              }`}
            />
          ))}
        </div>

        {/* Swipe instruction */}
        <motion.div
          className="text-center mb-4"
        >
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <Swipe className="h-4 w-4" />
            Swipe to explore campaign tools
          </p>
        </motion.div>

        {/* Main campaign card */}
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleSwipe}
          whileDrag={{ scale: 1.05 }}
        >
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-2xl rounded-3xl overflow-hidden min-h-[500px]">
            <CardHeader className={`bg-gradient-to-r ${campaignCards[currentCard].color} text-white p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <campaignCards[currentCard].icon className="h-8 w-8" />
                  <div>
                    <CardTitle className="text-xl font-bold">{campaignCards[currentCard].title}</CardTitle>
                    <p className="text-white/80">Section {currentCard + 1} of {campaignCards.length}</p>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {currentCard + 1}/{campaignCards.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <CurrentComponent />
            </CardContent>
          </Card>
        </motion.div>

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          <motion.button
            whileHover={{ scale: 1.1, x: -5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => currentCard > 0 && setCurrentCard(currentCard - 1)}
            disabled={currentCard === 0}
            className={`p-4 rounded-2xl transition-all ${
              currentCard === 0 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
            }`}
          >
            <ChevronLeft className="h-6 w-6" />
          </motion.button>
          
          <motion.button
            whileHover={{ scale: 1.1, x: 5 }}
            whileTap={{ scale: 0.9 }}
            onClick={() => currentCard < campaignCards.length - 1 && setCurrentCard(currentCard + 1)}
            disabled={currentCard === campaignCards.length - 1}
            className={`p-4 rounded-2xl transition-all ${
              currentCard === campaignCards.length - 1 
                ? 'bg-gray-200 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 text-white hover:bg-blue-600 shadow-lg'
            }`}
          >
            <ChevronRight className="h-6 w-6" />
          </motion.button>
        </div>
      </div>
    </div>
  )
}