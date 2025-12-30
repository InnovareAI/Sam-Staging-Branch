'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, Users, TrendingUp, Mail, LinkedinIcon, Target, Play, BarChart3, 
  DollarSign, Eye, Crown, Diamond, Sparkles, Star
} from 'lucide-react'

export default function SkiperCampaignHubPage() {
  const [mousePosition, setMousePosition] = useState({ x: 0, y: 0 })
  const { scrollYProgress } = useScroll()
  const backgroundY = useTransform(scrollYProgress, [0, 1], ['0%', '100%'])

  useEffect(() => {
    const updateMousePosition = (e: MouseEvent) => {
      setMousePosition({ x: e.clientX, y: e.clientY })
    }
    window.addEventListener('mousemove', updateMousePosition)
    return () => window.removeEventListener('mousemove', updateMousePosition)
  }, [])

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-rose-900 relative overflow-hidden">
      {/* Premium background effects */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 opacity-30"
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute bottom-1/4 right-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
      </motion.div>

      {/* Premium cursor */}
      <motion.div
        className="fixed top-0 left-0 w-8 h-8 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full pointer-events-none z-50 mix-blend-difference"
        style={{
          x: mousePosition.x - 16,
          y: mousePosition.y - 16
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />

      <div className="relative z-10 p-6">
        {/* Premium header */}
        <motion.div 
          initial={{ opacity: 0, y: -30, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.2, type: "spring", stiffness: 100 }}
          className="max-w-7xl mx-auto mb-8"
        >
          <div className="bg-gradient-to-r from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ 
                    rotate: [0, -10, 10, -5, 5, 0],
                    scale: 1.1
                  }}
                  className="relative p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-2xl shadow-2xl"
                >
                  <Zap className="h-10 w-10 text-white" />
                  <motion.div
                    className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Crown className="h-3 w-3 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <h1 className="text-4xl font-semibold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    Elite Campaign Studio
                  </h1>
                  <p className="text-purple-200 flex items-center gap-2">
                    <Diamond className="h-4 w-4" />
                    Skiper UI - Premium Campaign Experience
                  </p>
                </div>
              </div>
              
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold px-6 py-3 text-lg shadow-2xl">
                <Star className="h-5 w-5 mr-2" />
                PLATINUM
              </Badge>
            </div>
          </div>
        </motion.div>

        <div className="max-w-7xl mx-auto space-y-8">
          {/* Premium metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
            className="grid gap-6 md:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { title: 'Elite Campaigns', value: '47', icon: Target, color: 'blue' },
              { title: 'Premium Reach', value: '2.1M', icon: Users, color: 'green' },
              { title: 'Conversion Elite', value: '12.8%', icon: TrendingUp, color: 'purple' },
              { title: 'Revenue Premium', value: '$487K', icon: DollarSign, color: 'orange' }
            ].map((metric, index) => (
              <motion.div
                key={metric.title}
                initial={{ opacity: 0, y: 30, rotateY: -90 }}
                animate={{ opacity: 1, y: 0, rotateY: 0 }}
                transition={{ delay: index * 0.1 + 0.3, type: "spring", stiffness: 200 }}
                whileHover={{ 
                  y: -15, 
                  scale: 1.05,
                  rotateY: 10,
                  boxShadow: "0 25px 50px rgba(0, 0, 0, 0.3)"
                }}
              >
                <Card className="bg-gradient-to-br from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl overflow-hidden group">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                  />
                  <CardContent className="p-6 relative z-10">
                    <div className="flex items-center justify-between mb-4">
                      <motion.div
                        whileHover={{ rotate: 360, scale: 1.2 }}
                        className={`p-3 bg-gradient-to-r from-${metric.color}-500 to-${metric.color}-600 rounded-xl shadow-lg`}
                      >
                        <metric.icon className="h-6 w-6 text-white" />
                      </motion.div>
                      <motion.div
                        animate={{ rotate: 360 }}
                        transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className={`h-5 w-5 text-${metric.color}-400`} />
                      </motion.div>
                    </div>
                    <div className="text-3xl font-semibold text-white mb-2">{metric.value}</div>
                    <div className="text-sm text-gray-300">{metric.title}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Main premium grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Campaign performance studio */}
            <motion.div
              initial={{ opacity: 0, x: -30, rotateY: -15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 0.4, type: "spring", stiffness: 100 }}
              className="lg:col-span-2"
            >
              <Card className="bg-gradient-to-br from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl h-full">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-white text-2xl">
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg"
                    >
                      <BarChart3 className="h-8 w-8 text-white" />
                    </motion.div>
                    Premium Campaign Analytics
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <Diamond className="h-6 w-6 text-purple-400" />
                    </motion.div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  {/* Elite campaigns list */}
                  <div className="space-y-6">
                    {[
                      { name: 'Premium Product Launch', platform: 'Multi-Channel', status: 'Elite', reach: '450K', roi: '+287%' },
                      { name: 'Exclusive Email Series', platform: 'Premium Email', status: 'Active', reach: '189K', roi: '+156%' },
                      { name: 'VIP LinkedIn Outreach', platform: 'LinkedIn Premium', status: 'Optimizing', reach: '267K', roi: '+198%' }
                    ].map((campaign, index) => (
                      <motion.div
                        key={campaign.name}
                        initial={{ opacity: 0, x: -30 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index + 0.6 }}
                        whileHover={{ 
                          x: 10, 
                          scale: 1.02,
                          boxShadow: "0 15px 30px rgba(168, 85, 247, 0.3)"
                        }}
                        className="p-6 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20 cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div>
                            <h4 className="text-lg font-semibold text-white">{campaign.name}</h4>
                            <p className="text-sm text-gray-300">{campaign.platform}</p>
                          </div>
                          <Badge className={`${
                            campaign.status === 'Elite' 
                              ? 'bg-gradient-to-r from-yellow-400 to-orange-500 text-black' 
                              : campaign.status === 'Active'
                              ? 'bg-green-500/20 text-green-300 border-green-500/30'
                              : 'bg-blue-500/20 text-blue-300 border-blue-500/30'
                          } px-3 py-1 font-semibold`}>
                            {campaign.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Premium Reach</p>
                            <p className="text-lg font-semibold text-white">{campaign.reach}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-400 mb-1">Elite ROI</p>
                            <p className="text-lg font-semibold text-green-400">{campaign.roi}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Premium performance chart */}
                  <div className="mt-8">
                    <h4 className="text-xl font-semibold text-white mb-4 flex items-center gap-2">
                      <TrendingUp className="h-6 w-6 text-green-400" />
                      Elite Performance Trends
                    </h4>
                    <div className="h-40 flex items-end justify-between gap-2">
                      {[...Array(14)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${40 + Math.random() * 50}%` }}
                          transition={{ delay: i * 0.05 + 1, duration: 0.8, type: "spring" }}
                          whileHover={{ 
                            height: '90%', 
                            background: 'linear-gradient(to top, #ec4899, #f59e0b)',
                            boxShadow: "0 0 20px rgba(236, 72, 153, 0.6)"
                          }}
                          className="bg-gradient-to-t from-purple-500 to-pink-500 flex-1 rounded-t-lg shadow-lg cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Premium controls */}
            <motion.div
              initial={{ opacity: 0, x: 30, rotateY: 15 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 0.6, type: "spring", stiffness: 100 }}
              className="space-y-6"
            >
              {/* Elite launch pad */}
              <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-2xl border border-green-500/30 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="p-2 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl"
                    >
                      <Play className="h-5 w-5 text-white" />
                    </motion.div>
                    Elite Launch Pad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { name: 'Premium Email', icon: Mail, tier: 'Platinum' },
                    { name: 'Elite LinkedIn', icon: LinkedinIcon, tier: 'Diamond' },
                    { name: 'VIP Multi-Channel', icon: Target, tier: 'Ultimate' }
                  ].map((template, index) => (
                    <motion.div
                      key={template.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index + 0.8 }}
                      whileHover={{ 
                        scale: 1.05,
                        boxShadow: "0 10px 30px rgba(34, 197, 94, 0.3)"
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button className="w-full justify-start bg-gradient-to-r from-green-500 to-emerald-500 hover:from-green-600 hover:to-emerald-600 text-white border-0 shadow-lg">
                        <template.icon className="h-4 w-4 mr-2" />
                        {template.name}
                        <Badge className="ml-auto bg-yellow-400 text-black text-xs px-2">
                          {template.tier}
                        </Badge>
                      </Button>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              {/* Premium insights */}
              <Card className="bg-gradient-to-br from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Eye className="h-5 w-5 text-blue-400" />
                    Premium Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { metric: 'Top Performer', value: 'VIP Launch', change: '+287%' },
                      { metric: 'Best Platform', value: 'LinkedIn Elite', change: '94% CTR' },
                      { metric: 'Peak Hours', value: '2-4 PM EST', change: 'Premium' },
                      { metric: 'Elite Score', value: 'A++', change: 'Platinum' }
                    ].map((insight) => (
                      <motion.div
                        key={insight.metric}
                        whileHover={{ x: 10, scale: 1.02 }}
                        className="flex items-center justify-between p-3 bg-white/10 rounded-xl backdrop-blur-sm cursor-pointer"
                      >
                        <div>
                          <p className="text-xs text-gray-400">{insight.metric}</p>
                          <p className="text-sm font-semibold text-white">{insight.value}</p>
                        </div>
                        <Badge className="bg-gradient-to-r from-purple-500 to-pink-500 text-white">
                          {insight.change}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}