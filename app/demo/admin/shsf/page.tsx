'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Shield, Users, Activity, Database, Server, AlertTriangle, CheckCircle,
  TrendingUp, BarChart3, Settings, Globe, Zap, Heart, Star, Sparkles, 
  Butterfly, Flower, Waves
} from 'lucide-react'

export default function SHSFAdminPage() {
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
      {[...Array(8)].map((_, i) => (
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
            opacity: [0, 0.4, 0],
            scale: [0.5, 1.5, 0.5],
            rotate: 360
          }}
          transition={{
            duration: 20 + Math.random() * 10,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <div className="text-purple-300/20 text-3xl">
            {[<Sparkles />, <Heart />, <Star />, <Butterfly />, <Flower />, <Waves />, <Shield />, <Activity />][i]}
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
        className="w-10 h-10 border-2 border-white rounded-full flex items-center justify-center"
        animate={{ 
          scale: [1, 1.2, 1],
          rotate: 360
        }}
        transition={{ 
          scale: { duration: 2, repeat: Infinity },
          rotate: { duration: 4, repeat: Infinity, ease: "linear" }
        }}
      >
        <Heart className="h-4 w-4 text-white" />
      </motion.div>
    </motion.div>
  )

  return (
    <div className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 relative overflow-hidden">
      <FloatingElements />
      <MotionCursor />
      
      {/* Animated background */}
      <motion.div 
        className="absolute inset-0 opacity-30"
        style={{ y, opacity }}
      >
        <motion.div
          className="absolute top-10 left-10 w-96 h-96 bg-gradient-to-r from-pink-300 to-rose-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.3, 1],
            x: [0, 100, 0],
            y: [0, -50, 0]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 right-20 w-80 h-80 bg-gradient-to-r from-orange-300 to-yellow-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -80, 0],
            y: [0, 60, 0]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative z-10 p-6">
        {/* Elegant header */}
        <motion.div 
          initial={{ opacity: 0, y: -50, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ duration: 1.5, type: "spring", stiffness: 100 }}
          className="max-w-6xl mx-auto mb-12"
        >
          <motion.div 
            className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-2xl"
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 30px 60px rgba(139, 69, 19, 0.15)"
            }}
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ 
                    rotate: [0, 15, -15, 0],
                    scale: 1.1
                  }}
                  className="relative"
                >
                  <div className="w-20 h-20 bg-gradient-to-br from-rose-400 via-pink-500 to-orange-400 rounded-3xl shadow-2xl flex items-center justify-center">
                    <Shield className="h-10 w-10 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-2 -right-2 w-8 h-8 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center"
                    animate={{ 
                      scale: [1, 1.3, 1],
                      rotate: 360 
                    }}
                    transition={{ 
                      scale: { duration: 3, repeat: Infinity },
                      rotate: { duration: 6, repeat: Infinity, ease: "linear" }
                    }}
                  >
                    <Sparkles className="h-4 w-4 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 1 }}
                    className="text-5xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-orange-600 bg-clip-text text-transparent"
                  >
                    Admin Sanctuary
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 1 }}
                    className="text-rose-700 flex items-center gap-2 text-xl"
                  >
                    <Butterfly className="h-6 w-6" />
                    SHSF UI - Elegant Motion Dashboard
                  </motion.p>
                </div>
              </div>
              
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ delay: 1, type: "spring", stiffness: 200 }}
                whileHover={{ scale: 1.1, rotate: 360 }}
              >
                <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-8 py-4 text-xl font-semibold shadow-2xl rounded-2xl">
                  <Heart className="h-6 w-6 mr-3" />
                  Wellness Dashboard
                </Badge>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        <div className="max-w-6xl mx-auto space-y-12">
          {/* Floating metrics */}
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 1 }}
            className="grid gap-8 md:grid-cols-2 lg:grid-cols-4"
          >
            {[
              { title: 'Happy Users', value: '2,847', icon: Users, color: 'blue', emotion: '😊' },
              { title: 'System Harmony', value: '98.7%', icon: Activity, color: 'green', emotion: '🎵' },
              { title: 'Peaceful Uptime', value: '99.99%', icon: CheckCircle, color: 'purple', emotion: '🧘' },
              { title: 'Joy Index', value: 'A+', icon: Heart, color: 'pink', emotion: '💖' }
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
                <Card className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl overflow-hidden group">
                  <motion.div
                    className="absolute inset-0 bg-gradient-to-br from-rose-100/50 to-pink-100/50 opacity-0 group-hover:opacity-100 transition-opacity duration-700"
                  />
                  <CardHeader className="relative z-10 text-center pb-4">
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
                  </CardHeader>
                  <CardContent className="relative z-10 text-center">
                    <div className="text-3xl font-bold text-gray-800 mb-2">{metric.value}</div>
                    <div className="text-sm text-gray-600">{metric.title}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Main harmony grid */}
          <div className="grid gap-12 lg:grid-cols-3">
            {/* System wellness */}
            <motion.div
              initial={{ opacity: 0, x: -50, rotateY: -30 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 0.8, type: "spring", stiffness: 100 }}
              className="lg:col-span-2"
            >
              <Card className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl overflow-hidden">
                <CardHeader>
                  <CardTitle className="flex items-center gap-4 text-2xl">
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      className="p-4 bg-gradient-to-r from-blue-400 to-purple-600 rounded-2xl shadow-xl"
                    >
                      <Activity className="h-8 w-8 text-white" />
                    </motion.div>
                    <span>System Wellness Monitor</span>
                    <motion.div
                      animate={{ rotate: 360, scale: [1, 1.2, 1] }}
                      transition={{ 
                        rotate: { duration: 8, repeat: Infinity, ease: "linear" },
                        scale: { duration: 4, repeat: Infinity }
                      }}
                    >
                      <Sparkles className="h-6 w-6 text-purple-500" />
                    </motion.div>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-8">
                  {/* Wellness meters */}
                  <div className="grid gap-8 md:grid-cols-2">
                    {[
                      { label: 'Server Happiness', value: 92, icon: Heart, color: 'pink' },
                      { label: 'Data Flow Energy', value: 87, icon: Waves, color: 'blue' },
                      { label: 'Network Harmony', value: 78, icon: Globe, color: 'green' },
                      { label: 'Security Serenity', value: 95, icon: Shield, color: 'purple' }
                    ].map((wellness, index) => (
                      <motion.div
                        key={wellness.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * index + 1 }}
                        whileHover={{ scale: 1.05, rotateX: 5 }}
                        className="p-6 bg-gradient-to-br from-white/80 to-rose-50/80 rounded-3xl backdrop-blur-sm border border-white/60 shadow-lg"
                      >
                        <div className="flex items-center justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <motion.div
                              whileHover={{ rotate: 360 }}
                              className={`p-2 bg-gradient-to-r from-${wellness.color}-400 to-${wellness.color}-600 rounded-xl`}
                            >
                              <wellness.icon className="h-5 w-5 text-white" />
                            </motion.div>
                            <span className="font-medium text-gray-700">{wellness.label}</span>
                          </div>
                          <span className="text-2xl font-bold text-gray-800">{wellness.value}%</span>
                        </div>
                        <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${wellness.value}%` }}
                            transition={{ duration: 2, delay: 1.5, type: "spring" }}
                            className={`h-4 bg-gradient-to-r from-${wellness.color}-400 to-${wellness.color}-600 rounded-full relative overflow-hidden`}
                          >
                            <motion.div
                              className="absolute inset-0 bg-white/40"
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  {/* Harmony visualization */}
                  <div>
                    <h4 className="text-xl font-semibold mb-6 flex items-center gap-3">
                      <BarChart3 className="h-6 w-6 text-rose-500" />
                      Daily Wellness Rhythm
                    </h4>
                    <div className="h-40 flex items-end justify-between bg-gradient-to-r from-rose-50 to-pink-50 rounded-2xl p-6">
                      {[...Array(12)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${40 + Math.sin(i * 0.5) * 30 + Math.random() * 20}%` }}
                          transition={{ 
                            delay: i * 0.1 + 2, 
                            duration: 1, 
                            type: "spring",
                            stiffness: 200
                          }}
                          whileHover={{ 
                            height: '90%', 
                            backgroundColor: '#f472b6',
                            boxShadow: "0 0 20px rgba(244, 114, 182, 0.6)"
                          }}
                          className="bg-gradient-to-t from-rose-400 via-pink-400 to-orange-400 flex-1 mx-1 rounded-t-xl shadow-lg cursor-pointer"
                        />
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </motion.div>

            {/* Zen controls */}
            <motion.div
              initial={{ opacity: 0, x: 50, rotateY: 30 }}
              animate={{ opacity: 1, x: 0, rotateY: 0 }}
              transition={{ delay: 1, type: "spring", stiffness: 100 }}
              className="space-y-8"
            >
              {/* Mindful monitoring */}
              <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3 text-green-800">
                    <motion.div
                      animate={{ 
                        scale: [1, 1.2, 1],
                        rotate: [0, 180, 360]
                      }}
                      transition={{ 
                        scale: { duration: 3, repeat: Infinity },
                        rotate: { duration: 6, repeat: Infinity, ease: "linear" }
                      }}
                    >
                      <CheckCircle className="h-6 w-6 text-green-600" />
                    </motion.div>
                    Peaceful Status
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-4">
                    {[
                      { service: 'Meditation API', status: 'Zen', emoji: '🧘' },
                      { service: 'Harmony Database', status: 'Balanced', emoji: '⚖️' },
                      { service: 'Serenity Cache', status: 'Flowing', emoji: '🌊' },
                      { service: 'Bliss Network', status: 'Connected', emoji: '🌐' }
                    ].map((service, index) => (
                      <motion.div
                        key={service.service}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index + 1.2 }}
                        whileHover={{ x: 10, scale: 1.02 }}
                        className="flex items-center justify-between p-4 bg-white/60 rounded-2xl backdrop-blur-sm cursor-pointer"
                      >
                        <div className="flex items-center gap-3">
                          <span className="text-2xl">{service.emoji}</span>
                          <span className="text-sm font-medium text-green-700">{service.service}</span>
                        </div>
                        <Badge className="bg-green-500/20 text-green-700 border-green-500/30">
                          {service.status}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Gentle actions */}
              <Card className="bg-white/60 backdrop-blur-xl border border-white/40 shadow-2xl rounded-3xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    <motion.div
                      whileHover={{ rotate: 360, scale: 1.2 }}
                      className="p-2 bg-gradient-to-r from-orange-400 to-pink-500 rounded-xl"
                    >
                      <Zap className="h-5 w-5 text-white" />
                    </motion.div>
                    Mindful Actions
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { label: 'Gentle Backup', icon: Database, emoji: '💾' },
                    { label: 'Loving Scan', icon: Heart, emoji: '💝' },
                    { label: 'Peaceful Optimize', icon: TrendingUp, emoji: '📈' },
                    { label: 'Harmony Check', icon: Settings, emoji: '⚙️' }
                  ].map((action, index) => (
                    <motion.div
                      key={action.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index + 1.4 }}
                      whileHover={{ 
                        scale: 1.05,
                        boxShadow: "0 15px 30px rgba(244, 114, 182, 0.2)"
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button className="w-full justify-start bg-gradient-to-r from-rose-400 to-pink-500 hover:from-rose-500 hover:to-pink-600 text-white border-0 shadow-lg rounded-2xl h-12">
                        <span className="text-xl mr-3">{action.emoji}</span>
                        <action.icon className="h-4 w-4 mr-2" />
                        {action.label}
                      </Button>
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </motion.div>
          </div>
        </div>
      </div>
    </div>
  )
}