'use client'

import React, { useState, useEffect } from 'react'
import { motion, useScroll, useTransform } from 'framer-motion'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { 
  Shield, Users, Activity, Database, Server, AlertTriangle, CheckCircle,
  TrendingUp, BarChart3, Zap, Globe, Crown, Diamond, Sparkles, Star
} from 'lucide-react'

export default function SkiperAdminPage() {
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
      {/* Premium animated background */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 opacity-30"
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
      </motion.div>

      {/* Custom cursor */}
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
                  <Shield className="h-10 w-10 text-white" />
                  <motion.div
                    className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Crown className="h-3 w-3 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <h1 className="text-4xl font-bold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent">
                    Elite Admin Center
                  </h1>
                  <p className="text-purple-200 flex items-center gap-2">
                    <Diamond className="h-4 w-4" />
                    Skiper UI - Premium Interactive Dashboard
                  </p>
                </div>
              </div>
              
              <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold px-6 py-3 text-lg shadow-2xl">
                <Star className="h-5 w-5 mr-2" />
                PREMIUM
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
              { title: 'Elite Users', value: '2,847', icon: Users, color: 'blue' },
              { title: 'System Performance', value: '98.7%', icon: Activity, color: 'green' },
              { title: 'Premium Uptime', value: '99.99%', icon: CheckCircle, color: 'purple' },
              { title: 'Security Score', value: 'A+', icon: Shield, color: 'orange' }
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
                  <CardHeader className="relative z-10">
                    <div className="flex items-center justify-between">
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
                  </CardHeader>
                  <CardContent className="relative z-10">
                    <div className="text-3xl font-bold text-white mb-2">{metric.value}</div>
                    <div className="text-sm text-gray-300">{metric.title}</div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>

          {/* Main dashboard grid */}
          <div className="grid gap-8 lg:grid-cols-3">
            {/* Premium system monitoring */}
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
                      <Activity className="h-8 w-8 text-white" />
                    </motion.div>
                    Premium System Analytics
                    <motion.div
                      animate={{ rotate: 360 }}
                      transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                    >
                      <Diamond className="h-6 w-6 text-purple-400" />
                    </motion.div>
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="grid gap-6 md:grid-cols-2">
                    {[
                      { label: 'CPU Performance', value: 87, color: 'blue' },
                      { label: 'Memory Optimization', value: 92, color: 'green' },
                      { label: 'Network Efficiency', value: 78, color: 'purple' },
                      { label: 'Storage Health', value: 96, color: 'orange' }
                    ].map((resource, index) => (
                      <motion.div
                        key={resource.label}
                        initial={{ opacity: 0, scale: 0.8 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ delay: 0.1 * index + 0.6 }}
                        whileHover={{ scale: 1.05, rotateX: 5 }}
                        className="p-4 bg-white/10 rounded-2xl backdrop-blur-sm border border-white/20"
                      >
                        <div className="flex items-center justify-between mb-3">
                          <span className="text-white font-medium">{resource.label}</span>
                          <span className="text-2xl font-bold text-white">{resource.value}%</span>
                        </div>
                        <div className="w-full bg-gray-700 rounded-full h-3 overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${resource.value}%` }}
                            transition={{ duration: 1.5, delay: 0.8 }}
                            className={`h-3 bg-gradient-to-r from-${resource.color}-400 to-${resource.color}-600 rounded-full relative overflow-hidden`}
                          >
                            <motion.div
                              className="absolute inset-0 bg-white/30"
                              animate={{ x: ['-100%', '100%'] }}
                              transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            />
                          </motion.div>
                        </div>
                      </motion.div>
                    ))}
                  </div>

                  <div className="mt-8">
                    <h4 className="text-xl font-bold text-white mb-4 flex items-center gap-2">
                      <BarChart3 className="h-6 w-6 text-blue-400" />
                      Performance Timeline
                    </h4>
                    <div className="h-32 flex items-end justify-between gap-2">
                      {[...Array(12)].map((_, i) => (
                        <motion.div
                          key={i}
                          initial={{ height: 0 }}
                          animate={{ height: `${30 + Math.random() * 60}%` }}
                          transition={{ delay: i * 0.1 + 1, duration: 0.8, type: "spring" }}
                          whileHover={{ 
                            height: '90%', 
                            backgroundColor: '#ec4899',
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
              {/* Elite security */}
              <Card className="bg-gradient-to-br from-red-500/20 to-orange-500/20 backdrop-blur-2xl border border-red-500/30 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <motion.div
                      animate={{ rotate: [0, 10, -10, 0] }}
                      transition={{ duration: 2, repeat: Infinity }}
                      className="p-2 bg-gradient-to-r from-red-500 to-orange-500 rounded-xl"
                    >
                      <Shield className="h-5 w-5 text-white" />
                    </motion.div>
                    Elite Security
                  </CardTitle>
                </CardHeader>
                <CardContent>
                  <div className="space-y-3">
                    {[
                      { threat: 'Advanced Threats', count: 0, status: 'blocked' },
                      { threat: 'Intrusion Attempts', count: 23, status: 'mitigated' },
                      { threat: 'Anomaly Detection', count: 156, status: 'monitored' }
                    ].map((item, index) => (
                      <motion.div
                        key={item.threat}
                        initial={{ opacity: 0, x: 20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: 0.1 * index + 0.8 }}
                        whileHover={{ x: 10, scale: 1.02 }}
                        className="flex items-center justify-between p-3 bg-white/10 rounded-xl backdrop-blur-sm"
                      >
                        <span className="text-white text-sm">{item.threat}</span>
                        <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                          {item.count}
                        </Badge>
                      </motion.div>
                    ))}
                  </div>
                </CardContent>
              </Card>

              {/* Premium actions */}
              <Card className="bg-gradient-to-br from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Zap className="h-5 w-5 text-yellow-400" />
                    Premium Controls
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  {[
                    { label: 'System Optimization', icon: TrendingUp },
                    { label: 'Performance Boost', icon: Zap },
                    { label: 'Security Scan', icon: Shield },
                    { label: 'Global Sync', icon: Globe }
                  ].map((action, index) => (
                    <motion.div
                      key={action.label}
                      initial={{ opacity: 0, scale: 0.8 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ delay: 0.1 * index + 1 }}
                      whileHover={{ 
                        scale: 1.05,
                        boxShadow: "0 10px 30px rgba(168, 85, 247, 0.3)"
                      }}
                      whileTap={{ scale: 0.95 }}
                    >
                      <Button className="w-full justify-start bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600 text-white border-0 shadow-lg">
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