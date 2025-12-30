'use client'

import React, { useState, useEffect } from 'react'
import { motion, PanInfo } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Shield, 
  Users, 
  Activity, 
  Database, 
  Server,
  AlertTriangle,
  CheckCircle,
  TrendingUp,
  BarChart3,
  Zap,
  Globe,
  Smartphone,
  Hand,
  ChevronLeft,
  ChevronRight
} from 'lucide-react'

export default function KiboAdminPage() {
  const [currentCard, setCurrentCard] = useState(0)
  const [stats, setStats] = useState({
    activeUsers: 2847,
    systemLoad: 67,
    uptime: 99.7,
    alerts: 3
  })

  const adminCards = [
    {
      id: 'overview',
      title: 'System Overview',
      icon: Activity,
      color: 'from-blue-400 to-blue-600',
      component: OverviewCard
    },
    {
      id: 'users',
      title: 'User Management',
      icon: Users,
      color: 'from-green-400 to-green-600', 
      component: UsersCard
    },
    {
      id: 'security',
      title: 'Security Center',
      icon: Shield,
      color: 'from-red-400 to-red-600',
      component: SecurityCard
    },
    {
      id: 'infrastructure',
      title: 'Infrastructure',
      icon: Server,
      color: 'from-purple-400 to-purple-600',
      component: InfrastructureCard
    },
    {
      id: 'analytics',
      title: 'Analytics Hub',
      icon: BarChart3,
      color: 'from-orange-400 to-orange-600',
      component: AnalyticsCard
    }
  ]

  const handleSwipe = (event: any, info: PanInfo) => {
    const threshold = 50
    if (info.offset.x > threshold && currentCard > 0) {
      setCurrentCard(currentCard - 1)
    } else if (info.offset.x < -threshold && currentCard < adminCards.length - 1) {
      setCurrentCard(currentCard + 1)
    }
  }

  function OverviewCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="grid grid-cols-2 gap-4">
          {[
            { label: 'Active Users', value: stats.activeUsers.toLocaleString(), color: 'blue' },
            { label: 'System Load', value: `${stats.systemLoad}%`, color: 'green' },
            { label: 'Uptime', value: `${stats.uptime}%`, color: 'purple' },
            { label: 'Active Alerts', value: stats.alerts, color: 'red' }
          ].map((item) => (
            <motion.div
              key={item.label}
              whileHover={{ scale: 1.05 }}
              className={`p-4 bg-gradient-to-r from-${item.color}-50 to-${item.color}-100 rounded-2xl border-2 border-${item.color}-200`}
            >
              <div className="text-center">
                <div className={`text-2xl font-semibold text-${item.color}-700`}>{item.value}</div>
                <div className={`text-sm text-${item.color}-600`}>{item.label}</div>
              </div>
            </motion.div>
          ))}
        </div>

        <div className="space-y-4">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </h3>
          {[
            { service: 'API Gateway', status: 'Healthy', color: 'green' },
            { service: 'Database', status: 'Optimal', color: 'green' },
            { service: 'Cache Layer', status: 'Warning', color: 'yellow' }
          ].map((service) => (
            <motion.div
              key={service.service}
              whileHover={{ x: 10 }}
              className="flex items-center justify-between p-3 bg-gray-50 rounded-xl"
            >
              <span className="font-medium">{service.service}</span>
              <Badge className={`bg-${service.color}-100 text-${service.color}-700 border-${service.color}-200`}>
                {service.status}
              </Badge>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  function UsersCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 bg-gradient-to-r from-green-400 to-green-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <Users className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-semibold">User Management</h2>
          <p className="text-gray-600">Manage user accounts and permissions</p>
        </div>

        <div className="space-y-4">
          {[
            { action: 'View All Users', count: '2,847', icon: Users },
            { action: 'Pending Approvals', count: '23', icon: CheckCircle },
            { action: 'Blocked Users', count: '12', icon: AlertTriangle }
          ].map((item) => (
            <motion.div
              key={item.action}
              whileHover={{ scale: 1.02, x: 10 }}
              whileTap={{ scale: 0.98 }}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-green-50 to-green-100 rounded-2xl border-2 border-green-200 cursor-pointer"
            >
              <div className="flex items-center gap-3">
                <item.icon className="h-5 w-5 text-green-600" />
                <span className="font-medium">{item.action}</span>
              </div>
              <Badge className="bg-green-500 text-white">{item.count}</Badge>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  function SecurityCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity }}
            className="w-20 h-20 bg-gradient-to-r from-red-400 to-red-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <Shield className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-semibold">Security Center</h2>
          <p className="text-gray-600">Monitor and manage security threats</p>
        </div>

        <div className="space-y-4">
          {[
            { threat: 'Failed Login Attempts', count: 45, severity: 'high' },
            { threat: 'Suspicious Activity', count: 12, severity: 'medium' },
            { threat: 'Blocked IPs', count: 8, severity: 'high' },
            { threat: 'Security Scans', count: 156, severity: 'info' }
          ].map((item) => (
            <motion.div
              key={item.threat}
              whileHover={{ x: 10, scale: 1.02 }}
              className={`p-4 rounded-2xl border-2 ${
                item.severity === 'high' ? 'bg-red-50 border-red-200' :
                item.severity === 'medium' ? 'bg-yellow-50 border-yellow-200' :
                'bg-blue-50 border-blue-200'
              }`}
            >
              <div className="flex items-center justify-between">
                <span className="font-medium">{item.threat}</span>
                <Badge className={
                  item.severity === 'high' ? 'bg-red-500 text-white' :
                  item.severity === 'medium' ? 'bg-yellow-500 text-white' :
                  'bg-blue-500 text-white'
                }>
                  {item.count}
                </Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  function InfrastructureCard() {
    return (
      <div className="p-6 space-y-6">
        <div className="text-center">
          <motion.div
            animate={{ rotateY: 360 }}
            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
            className="w-20 h-20 bg-gradient-to-r from-purple-400 to-purple-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <Server className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-semibold">Infrastructure</h2>
          <p className="text-gray-600">Monitor servers and services</p>
        </div>

        <div className="space-y-4">
          {[
            { region: 'US East', status: 'Healthy', latency: '12ms' },
            { region: 'EU West', status: 'Healthy', latency: '8ms' },
            { region: 'Asia Pacific', status: 'Warning', latency: '45ms' }
          ].map((server) => (
            <motion.div
              key={server.region}
              whileHover={{ x: 10, scale: 1.02 }}
              className="flex items-center justify-between p-4 bg-gradient-to-r from-purple-50 to-purple-100 rounded-2xl border-2 border-purple-200"
            >
              <div className="flex items-center gap-3">
                <div className={`w-4 h-4 rounded-full ${
                  server.status === 'Healthy' ? 'bg-green-500' : 'bg-yellow-500'
                } animate-pulse`} />
                <span className="font-medium">{server.region}</span>
              </div>
              <div className="text-right">
                <div className="text-sm text-purple-600">{server.latency}</div>
                <div className="text-xs text-purple-500">{server.status}</div>
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
            animate={{ rotate: [0, 180, 360] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-20 h-20 bg-gradient-to-r from-orange-400 to-orange-600 rounded-full mx-auto mb-4 flex items-center justify-center"
          >
            <BarChart3 className="h-10 w-10 text-white" />
          </motion.div>
          <h2 className="text-2xl font-semibold">Analytics Hub</h2>
          <p className="text-gray-600">Data insights and reporting</p>
        </div>

        <div className="space-y-4">
          {[
            { metric: 'Page Views', value: '1.2M', change: '+15%' },
            { metric: 'API Calls', value: '847K', change: '+8%' },
            { metric: 'Error Rate', value: '0.02%', change: '-12%' }
          ].map((item) => (
            <motion.div
              key={item.metric}
              whileHover={{ scale: 1.05 }}
              className="p-4 bg-gradient-to-r from-orange-50 to-orange-100 rounded-2xl border-2 border-orange-200"
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="font-medium">{item.metric}</div>
                  <div className="text-2xl font-semibold text-orange-700">{item.value}</div>
                </div>
                <Badge className="bg-green-500 text-white">{item.change}</Badge>
              </div>
            </motion.div>
          ))}
        </div>
      </div>
    )
  }

  const CurrentComponent = adminCards[currentCard].component

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
            <Shield className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-semibold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Admin Dashboard
          </h1>
          <p className="text-gray-600 text-sm flex items-center justify-center gap-2">
            <Smartphone className="h-4 w-4" />
            Kibo UI - Touch-First Admin Interface
          </p>
        </div>
      </motion.div>

      {/* Main swipeable admin area */}
      <div className="max-w-md mx-auto">
        {/* Card indicator dots */}
        <div className="flex justify-center gap-2 mb-6">
          {adminCards.map((_, index) => (
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
          initial={{ opacity: 1 }}
          animate={{ opacity: currentCard === 0 ? 1 : 0.3 }}
          className="text-center mb-4"
        >
          <p className="text-sm text-gray-500 flex items-center justify-center gap-2">
            <Hand className="h-4 w-4" />
            Swipe to navigate admin panels
          </p>
        </motion.div>

        {/* Main admin card */}
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotateY: -90 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleSwipe}
          whileDrag={{ scale: 1.05 }}
          className="relative"
        >
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-2xl rounded-3xl overflow-hidden min-h-[500px]">
            <CardHeader className={`bg-gradient-to-r ${adminCards[currentCard].color} text-white p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {React.createElement(adminCards[currentCard].icon, { className: "h-8 w-8" })}
                  <div>
                    <CardTitle className="text-xl font-semibold">{adminCards[currentCard].title}</CardTitle>
                    <CardDescription className="text-white/80">
                      Panel {currentCard + 1} of {adminCards.length}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {currentCard + 1}/{adminCards.length}
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
            onClick={() => currentCard < adminCards.length - 1 && setCurrentCard(currentCard + 1)}
            disabled={currentCard === adminCards.length - 1}
            className={`p-4 rounded-2xl transition-all ${
              currentCard === adminCards.length - 1 
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