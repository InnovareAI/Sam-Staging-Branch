'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Zap, Users, TrendingUp, Mail, LinkedinIcon, Target, Play, BarChart3, 
  DollarSign, Eye, Heart, Star, Sparkles, Butterfly, Flower, Waves
} from 'lucide-react'

export default function SHSFCampaignHubPage() {
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const { scrollYProgress } = useScroll()
  const y = useTransform(scrollYProgress, [0, 1], [0, -50])
  const opacity = useTransform(scrollYProgress, [0, 0.5, 1], [1, 0.8, 0.6])
  
  const mouseX = useMotionValue(0)
  const mouseY = useMotionValue(0)
  const springX = useSpring(mouseX, { stiffness: 300, damping: 30 })
  const springY = useSpring(mouseY, { stiffness: 300, damping: 30 })

  useEffect(() => {
    const updateMouse = (e: MouseEvent) => {
      setCursorPosition({ x: e.clientX, y: e.clientY })
      mouseX.set(e.clientX)
      mouseY.set(e.clientY)
    }
    window.addEventListener('mousemove', updateMouse)
    return () => window.removeEventListener('mousemove', updateMouse)
  }, [mouseX, mouseY])

  const FloatingElements = () => (
    <div className="fixed inset-0 pointer-events-none overflow-hidden">
      {[...Array(10)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          initial={{ 
            x: Math.random() * window.innerWidth, 
            y: Math.random() * window.innerHeight,
            opacity: 0 
          }}
          animate={{ 
            x: Math.random() * window.innerWidth,
            y: Math.random() * window.innerHeight,
            opacity: [0, 0.3, 0],
            scale: [0.5, 1.8, 0.5],
            rotate: 360
          }}
          transition={{
            duration: 25 + Math.random() * 10,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="text-purple-300/20 text-4xl">
            {[<Sparkles />, <Heart />, <Star />, <Butterfly />, <Flower />, <Waves />, <Zap />, <Target />, <TrendingUp />, <Eye />][i]}
          </div>
        </motion.div>
      ))}
    </div>
  )

  const MotionCursor = () => (
    <motion.div
      className="fixed top-0 left-0 pointer-events-none z-50 mix-blend-difference"
      style={{ x: springX, y: springY }}
    >
      <motion.div
        className="w-12 h-12 border-2 border-white rounded-full flex items-center justify-center"
        animate={{ 
          scale: [1, 1.3, 1],
          rotate: 360
        }}
        transition={{ 
          scale: { duration: 3, repeat: Infinity },
          rotate: { duration: 6, repeat: Infinity, ease: "linear" }
        }}
      >
        <Heart className="h-5 w-5 text-white" />
      </motion.div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 relative overflow-hidden">
      <FloatingElements />
      <MotionCursor />
      
      {/* Dreamy background */}
      <motion.div 
        className="absolute inset-0 opacity-40"
        style={{ y, opacity }}
      >
        <motion.div
          className="absolute top-20 left-20 w-96 h-96 bg-gradient-to-r from-pink-300 to-rose-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.4, 1],
            x: [0, 150, 0],
            y: [0, -80, 0]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-orange-300 to-yellow-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -100, 0],
            y: [0, 80, 0]
          }}
          transition={{ duration: 18, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 left-1/2 w-64 h-64 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.5, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 22, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative z-10 p-6">
        {/* Magical header */}
        <motion.div 
          initial={{ opacity: 0, y: -50, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.8, type: "spring", stiffness: 80 }}
          className="max-w-6xl mx-auto mb-12"
        >
          <motion.div 
            className="bg-white/60 backdrop-blur-xl border border-white/50 rounded-3xl p-8 shadow-2xl"
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 30px 60px rgba(139, 69, 19, 0.15)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ 
                    rotate: [0, 20, -20, 0],
                    scale: 1.1
                  }}
                  className="relative"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-400 via-pink-500 to-orange-400 rounded-3xl shadow-2xl flex items-center justify-center">
                    <Zap className="h-10 w-10 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center"
                    animate={{ 
                      scale: [1, 1.4, 1],
                      rotate: 360 
                    }}
                    transition={{ 
                      scale: { duration: 4, repeat: Infinity },
                      rotate: { duration: 8, repeat: Infinity, ease: "linear" }
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1.2 }}
                    className="text-5xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-orange-600 bg-clip-text text-transparent"
                  >
                    Campaign Sanctuary
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 1.2 }}
                    className="text-rose-700 flex items-center gap-3 text-xl"
                  >
                    <Butterfly className="h-6 w-6" />
                    SHSF UI - Mindful Campaign Creation
                  </motion.p>
                </div>
              </div>
              
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 1, type: "spring", stiffness: 150 }}
                whileHover={{ scale: 1.1, rotate: 360 }}
              >
                <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-8 py-4 text-xl font-semibold shadow-2xl rounded-2xl">
                  <Heart className="h-6 w-6 mr-3" />
                  Harmony Hub
                </Badge>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        <div className="max-w-6xl mx-auto space-y-12">
          {/* Gentle metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1.2 }}
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { title: 'Loving Campaigns', value: '47', icon: Heart, color: 'pink', emotion: '💖' },
              { title: 'Happy Reach', value: '847K', icon: Users, color: 'blue', emotion: '😊' },
              { title: 'Joyful Conversion', value: '8.4%', icon: TrendingUp, color: 'green', emotion: '🎉' },
              { title: 'Blissful Revenue', value: '$234K', icon: DollarSign, color: 'orange', emotion: '✨' }
            ].map((metric, index) => (
              <motion.div
                key={metric.title}
                initial={{ opacity: 0, y: 50, rotateX: -90 }}
                animate={{ opacity: 1, y: 0, rotateX: 0 }}
                transition={{ 
                  delay: index * 0.2 + 0.6, 
                  type: "spring", 
                  stiffness: 100,
                  damping: 15
                }}
                whileHover={{ 
                  y: -20, 
                  scale: 1.05,
                  rotateY: 10,
                  boxShadow: "0 30px 60px rgba(0, 0, 0, 0.1)"
                }}
              >
                <Card className="bg-white/50 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden group text-center">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-rose-100/50 to-pink-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  />
                  <CardContent className="p-8 relative z-10">
                    <motion.div
                      whileHover={{ 
                        rotate: 360, 
                        scale: 1.3 
                      }}
                      transition={{ type: "spring", stiffness: 300 }}
                      className={`w-16 h-16 bg-gradient-to-r from-${metric.color}-400 to-${metric.color}-600 rounded-2xl shadow-xl mx-auto flex items-center justify-center mb-4`}
                    >
                      <metric.icon className="h-8 w-8 text-white" />
                    </motion.div>
                    <div className="text-4xl mb-2">{metric.emotion}</div>
                    <div className="text-3xl font-bold text-gray-800 mb-2">{metric.value}</div>
                    <div className="text-sm text-gray-600">{metric.title}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Main harmony grid */}
          <div className="grid gap-12 lg:grid-cols-3">
            {/* Campaign wellness center */}
            <motion.div
              initial={{ opacity: 0, x: -50, rotateY: -30 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
              className="lg:col-span-2"
            >
              <Card className="bg-white/50 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-4 text-2xl">
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      className="p-4 bg-gradient-to-r from-blue-400 to-purple-600 rounded-2xl shadow-xl"
                    >
                      <BarChart3 className="h-8 w-8 text-white" />
                    </motion.div>
                    <span>Campaign Wellness Garden</span>
                    <motion.div
                      animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                      transition={{ 
                        rotate: { duration: 12, repeat: Infinity, ease: "linear" },
                        scale: { duration: 6, repeat: Infinity }
                      }}
                    >
                      <Flower className="h-6 w-6 text-purple-500" />
                    </motion.div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Nurturing campaigns */}
                  <div className="space-y-6">
                    {[
                      { name: 'Gentle Product Introduction', platform: 'Mindful Email', status: 'Blooming', reach: '45K', vibe: 'Peaceful', emoji: '🌸' },
                      { name: 'Holiday Joy Campaign', platform: 'LinkedIn Love', status: 'Flourishing', reach: '89K', vibe: 'Joyful', emoji: '🎄' },
                      { name: 'Brand Harmony Series', platform: 'Multi-Channel Zen', status: 'Growing', reach: '156K', vibe: 'Balanced', emoji: '🧘' }
                    ].map((campaign, index) => (
                      <motion.div
                        key={campaign.name}
                        initial={{ opacity: 0, x: -50 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index + 1 }}
                        whileHover={{ 
                          x: 15, 
                          scale: 1.02,
                          boxShadow: "0 20px 40px rgba(244, 114, 182, 0.2)"
                        }}
                        className="p-6 bg-gradient-to-br from-white/80 to-rose-50/80 rounded-3xl backdrop-blur-sm border border-white/60 shadow-lg cursor-pointer"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-4">
                            <span className="text-3xl">{campaign.emoji}</span>
                            <div>
                              <h4 className="text-lg font-semibold text-gray-800">{campaign.name}</h4>
                              <p className="text-sm text-gray-600">{campaign.platform}</p>
                            </div>
                          </div>
                          <Badge className="bg-gradient-to-r from-green-400 to-emerald-500 text-white px-4 py-2 font-semibold rounded-2xl">
                            {campaign.status}
                          </Badge>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Gentle Reach</p>
                            <p className="text-lg font-bold text-gray-800">{campaign.reach}</p>
                          </div>
                          <div>
                            <p className="text-xs text-gray-500 mb-1">Campaign Vibe</p>
                            <p className="text-lg font-bold text-purple-600">{campaign.vibe}</p>
                          </div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Harmony visualization */}
                  <div>
                    <h4 className="text-xl font-semibold mb-6 flex items-center gap-3">
                      <Waves className="h-6 w-6 text-blue-500" />
                      Weekly Harmony Flow
                    </h4>
                    <div className="h-48 flex items-end justify-between bg-gradient-to-r from-rose-50 to-pink-50 rounded-3xl p-6">
                      {[...Array(14)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ 
                            height: `${50 + Math.sin(i * 0.8) * 25 + Math.random() * 15}%`
                          }}
                          transition={{ 
                            delay: i * 0.1 + 1.5, 
                            duration: 1.5, 
                            type: "spring",
                            stiffness: 150
                          }}
                          whileHover={{ 
                            height: '90%', 
                            background: 'linear-gradient(to top, #f472b6, #fbbf24)',
                            boxShadow: "0 0 25px rgba(244, 114, 182, 0.6)"
                          }}
                          className="bg-gradient-to-t from-rose-400 via-pink-400 to-orange-400 flex-1 mx-1 rounded-t-2xl shadow-lg cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Mindful controls */}
            <motion.div
              initial={{ opacity: 0, x: 50, rotateY: 30 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 1, type: "spring", stiffness: 100 }}
              className="space-y-8"
            >
              {/* Gentle launch pad */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-green-800">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ 
                        scale: { duration: 4, repeat: Infinity },
                        rotate: { duration: 8, repeat: Infinity, ease: "linear" }
                      }}
                    >
                      <Play className="h-6 w-6 text-green-600" />
                    </motion.div>
                    Gentle Launch Pad
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { name: 'Loving Email', icon: Mail, vibe: 'Warm', emoji: '💌' },
                    { name: 'Mindful LinkedIn', icon: LinkedinIcon, vibe: 'Professional', emoji: '🤝' },
                    { name: 'Harmonious Multi-Channel', icon: Target, vibe: 'Balanced', emoji: '🌈' }
                  ].map((template, index) => (
                    <motion.div
                      key={template.name}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index + 1.2 }}
                      whileHover={{ 
                        scale: 1.05,
                        boxShadow: "0 15px 30px rgba(34, 197, 94, 0.2)"
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button className="w-full justify-start bg-gradient-to-r from-green-400 to-emerald-500 hover:from-green-500 hover:to-emerald-600 text-white border-0 shadow-lg rounded-2xl h-16 text-left">
                        <span className="text-2xl mr-3">{template.emoji}</span>
                        <div className="flex-1">
                          <div className="flex items-center gap-2">
                            <template.icon className="h-4 w-4" />
                            <span className="font-medium">{template.name}</span>
                          </div>
                          <div className="text-xs opacity-80">{template.vibe} vibes</div>
                        </div>
                      </Button>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>

              {/* Mindful insights */}
              <Card className="bg-white/50 backdrop-blur-xl border border-white/50 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <Eye className="h-6 w-6 text-blue-500" />
                    Gentle Insights
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { wisdom: 'Most Loved Campaign', insight: 'Holiday Joy', feeling: 'Joyful', emoji: '😊' },
                      { wisdom: 'Harmonious Platform', insight: 'LinkedIn Love', feeling: 'Connected', emoji: '🤝' },
                      { wisdom: 'Peak Energy Time', insight: '2-4 PM EST', feeling: 'Vibrant', emoji: '⚡' },
                      { wisdom: 'Wellness Score', insight: 'A+ Harmony', feeling: 'Peaceful', emoji: '🧘' }
                    ].map((insight, index) => (
                      <motion.div
                        key={insight.wisdom}
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        transition={{ delay: 0.1 * index + 1.4 }}
                        whileHover={{ x: 10, scale: 1.02 }}
                        className="flex items-center justify-between p-4 bg-gradient-to-r from-white/80 to-rose-50/80 rounded-2xl backdrop-blur-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{insight.emoji}</span>
                          <div>
                            <p className="text-xs text-gray-500">{insight.wisdom}</p>
                            <p className="text-sm font-medium text-gray-800">{insight.insight}</p>
                          </div>
                        </div>
                        <Badge className="bg-gradient-to-r from-purple-400 to-pink-500 text-white rounded-full">
                          {insight.feeling}
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