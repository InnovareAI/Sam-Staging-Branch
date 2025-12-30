'use client'

import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence, useScroll, useTransform } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { 
  Settings, 
  User, 
  Shield, 
  Palette, 
  Bell, 
  LinkedinIcon,
  CheckCircle,
  Sparkles,
  Zap,
  Users,
  ArrowRight,
  Eye,
  EyeOff,
  Star,
  Crown,
  Diamond,
  Gem,
  MousePointer2
} from 'lucide-react'

export default function SkiperSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
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
      {/* Animated background elements */}
      <motion.div
        style={{ y: backgroundY }}
        className="absolute inset-0 opacity-30"
      >
        <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse"></div>
        <div className="absolute top-1/3 right-1/3 w-96 h-96 bg-pink-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-1000"></div>
        <div className="absolute bottom-1/4 left-1/3 w-96 h-96 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl animate-pulse delay-2000"></div>
      </motion.div>

      {/* Custom cursor follower */}
      <motion.div
        className="fixed top-0 left-0 w-6 h-6 bg-gradient-to-r from-purple-400 to-pink-400 rounded-full pointer-events-none z-50 mix-blend-difference"
        style={{
          x: mousePosition.x - 12,
          y: mousePosition.y - 12
        }}
        transition={{ type: "spring", stiffness: 500, damping: 30 }}
      />

      <div className="relative z-10 p-6">
        {/* Premium header */}
        <motion.div 
          initial={{ opacity: 0, y: -30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, type: "spring" }}
          className="max-w-6xl mx-auto mb-8"
        >
          <div className="bg-gradient-to-r from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 rounded-3xl p-8 shadow-2xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-6">
                <motion.div
                  whileHover={{ 
                    rotate: [0, -10, 10, -5, 5, 0],
                    scale: 1.1
                  }}
                  transition={{ 
                    duration: 0.6,
                    type: "spring",
                    stiffness: 300 
                  }}
                  className="relative p-4 bg-gradient-to-br from-purple-500 via-pink-500 to-rose-500 rounded-2xl shadow-2xl"
                >
                  <Settings className="h-10 w-10 text-white" />
                  <motion.div
                    className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-500 rounded-full flex items-center justify-center"
                    animate={{ rotate: 360 }}
                    transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                  >
                    <Crown className="h-3 w-3 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <motion.h1 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.3 }}
                    className="text-4xl font-semibold bg-gradient-to-r from-white via-purple-200 to-pink-200 bg-clip-text text-transparent"
                  >
                    Premium Settings
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: 0.5 }}
                    className="text-purple-200 flex items-center gap-2"
                  >
                    <Diamond className="h-4 w-4" />
                    Skiper UI - Premium Interactive Experience
                  </motion.p>
                </div>
              </div>
              
              <motion.div
                whileHover={{ scale: 1.05, rotateY: 10 }}
                className="flex items-center gap-4"
              >
                <Badge className="bg-gradient-to-r from-yellow-400 to-orange-500 text-black font-semibold px-4 py-2 text-sm">
                  <Star className="h-4 w-4 mr-1" />
                  PRO USER
                </Badge>
              </motion.div>
            </div>
          </div>
        </motion.div>

        <div className="max-w-6xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Floating tab navigation */}
            <motion.div
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4 }}
              className="mb-8"
            >
              <TabsList className="grid w-full grid-cols-5 bg-gradient-to-r from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 rounded-2xl p-2 shadow-2xl">
                {[
                  { id: 'profile', icon: User, label: 'Profile' },
                  { id: 'integrations', icon: LinkedinIcon, label: 'Integrations' },
                  { id: 'appearance', icon: Palette, label: 'Appearance' },
                  { id: 'notifications', icon: Bell, label: 'Notifications' },
                  { id: 'security', icon: Shield, label: 'Security' }
                ].map((tab, index) => (
                  <TabsTrigger 
                    key={tab.id}
                    value={tab.id}
                    className="relative flex items-center gap-2 text-white data-[state=active]:text-white transition-all duration-500 group"
                  >
                    <motion.div
                      whileHover={{ scale: 1.2, rotate: 360 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <tab.icon className="h-5 w-5" />
                    </motion.div>
                    <span className="hidden sm:inline font-medium">{tab.label}</span>
                    
                    {/* Active tab indicator */}
                    {activeTab === tab.id && (
                      <motion.div
                        layoutId="activeTab"
                        className="absolute inset-0 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl -z-10"
                        transition={{ type: "spring", stiffness: 300, damping: 30 }}
                      />
                    )}
                    
                    {/* Hover effect */}
                    <motion.div
                      className="absolute inset-0 bg-gradient-to-r from-white/10 to-purple-500/10 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 -z-20"
                    />
                  </TabsTrigger>
                ))}
              </TabsList>
            </motion.div>

            <div className="space-y-8">
              {/* Profile Tab */}
              <TabsContent value="profile" className="space-y-6">
                <motion.div
                  initial={{ opacity: 0, rotateX: -15 }}
                  animate={{ opacity: 1, rotateX: 0 }}
                  transition={{ duration: 0.8, type: "spring" }}
                  className="grid gap-6 lg:grid-cols-3"
                >
                  {/* Main profile card */}
                  <Card className="lg:col-span-2 bg-gradient-to-br from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl group hover:shadow-purple-500/25 transition-all duration-700">
                    <motion.div
                      whileHover={{ scale: 1.02, rotateY: 5 }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <CardHeader className="relative overflow-hidden">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-purple-500/20 to-pink-500/20 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        />
                        <CardTitle className="flex items-center gap-3 text-white relative z-10">
                          <motion.div
                            whileHover={{ rotate: 360, scale: 1.2 }}
                            transition={{ duration: 0.6 }}
                            className="p-2 bg-gradient-to-r from-purple-500 to-pink-500 rounded-xl"
                          >
                            <User className="h-6 w-6 text-white" />
                          </motion.div>
                          Profile Information
                          <Gem className="h-5 w-5 text-yellow-400" />
                        </CardTitle>
                        <CardDescription className="text-purple-200 relative z-10">
                          Manage your premium account details
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-6 relative">
                        <div className="grid gap-6 md:grid-cols-2">
                          {[
                            { label: 'Full Name', value: 'Sarah Powell' },
                            { label: 'Email', value: 'sarah@innovareai.com' }
                          ].map((field, index) => (
                            <motion.div
                              key={field.label}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              className="group/field"
                            >
                              <label className="text-sm font-medium mb-3 block text-purple-200">
                                {field.label}
                              </label>
                              <motion.div
                                whileHover={{ scale: 1.02 }}
                                whileFocus={{ scale: 1.02 }}
                              >
                                <Input 
                                  defaultValue={field.value}
                                  className="bg-white/10 border-white/20 text-white placeholder:text-gray-400 h-12 rounded-xl group-hover/field:border-purple-400 transition-all duration-300 focus:bg-white/15"
                                />
                              </motion.div>
                            </motion.div>
                          ))}
                        </div>
                        
                        <motion.div className="group/field">
                          <label className="text-sm font-medium mb-3 block text-purple-200">Company</label>
                          <motion.div
                            whileHover={{ scale: 1.02 }}
                            whileFocus={{ scale: 1.02 }}
                          >
                            <Input 
                              defaultValue="InnovareAI"
                              className="bg-white/10 border-white/20 text-white h-12 rounded-xl group-hover/field:border-purple-400 transition-all duration-300 focus:bg-white/15"
                            />
                          </motion.div>
                        </motion.div>
                        
                        <motion.div
                          whileHover={{ 
                            scale: 1.05,
                            boxShadow: "0 20px 40px rgba(168, 85, 247, 0.4)"
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button className="w-full h-14 bg-gradient-to-r from-purple-500 via-pink-500 to-rose-500 hover:from-purple-600 hover:via-pink-600 hover:to-rose-600 text-white text-lg font-semibold rounded-xl shadow-2xl">
                            <motion.div
                              whileHover={{ x: 5 }}
                              className="flex items-center"
                            >
                              Update Profile
                              <ArrowRight className="h-5 w-5 ml-2" />
                            </motion.div>
                          </Button>
                        </motion.div>
                      </CardContent>
                    </motion.div>
                  </Card>

                  {/* Premium features sidebar */}
                  <div className="space-y-6">
                    <motion.div
                      whileHover={{ 
                        scale: 1.05,
                        rotateY: 10,
                        boxShadow: "0 20px 40px rgba(34, 197, 94, 0.3)"
                      }}
                      transition={{ type: "spring", stiffness: 300 }}
                    >
                      <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-2xl border border-green-500/30 shadow-2xl overflow-hidden group">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-green-400/10 to-emerald-400/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        />
                        <CardHeader className="relative">
                          <CardTitle className="flex items-center gap-2 text-white">
                            <motion.div
                              animate={{ rotate: 360 }}
                              transition={{ duration: 3, repeat: Infinity, ease: "linear" }}
                            >
                              <Sparkles className="h-6 w-6 text-green-400" />
                            </motion.div>
                            Premium Analytics
                          </CardTitle>
                        </CardHeader>
                        <CardContent className="relative">
                          <div className="space-y-4">
                            {[
                              { metric: 'Engagement Score', value: '94.5%', color: 'green' },
                              { metric: 'Growth Rate', value: '+127%', color: 'blue' },
                              { metric: 'Conversion', value: '8.9%', color: 'purple' }
                            ].map((item, index) => (
                              <motion.div
                                key={item.metric}
                                initial={{ opacity: 0, x: -20 }}
                                animate={{ opacity: 1, x: 0 }}
                                transition={{ delay: index * 0.1 + 0.5 }}
                                whileHover={{ x: 10, scale: 1.05 }}
                                className="flex justify-between items-center p-3 bg-white/10 rounded-lg cursor-pointer"
                              >
                                <span className="text-gray-300 text-sm">{item.metric}</span>
                                <span className={`text-${item.color}-400 font-semibold`}>{item.value}</span>
                              </motion.div>
                            ))}
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  </div>
                </motion.div>
              </TabsContent>

              {/* Other tabs with premium styling */}
              <TabsContent value="integrations">
                <motion.div
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{ duration: 0.6 }}
                >
                  <Card className="bg-gradient-to-br from-black/40 to-blue-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-white text-2xl">
                        <motion.div
                          whileHover={{ rotate: 360, scale: 1.2 }}
                          className="p-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-xl"
                        >
                          <LinkedinIcon className="h-8 w-8 text-white" />
                        </motion.div>
                        Premium Integrations
                        <Crown className="h-6 w-6 text-yellow-400" />
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[
                          { name: 'LinkedIn Premium', connected: true, icon: LinkedinIcon, color: 'blue' },
                          { name: 'Unipile Pro', connected: true, icon: Zap, color: 'green' },
                          { name: 'ActiveCampaign Plus', connected: false, icon: Users, color: 'orange' }
                        ].map((integration, index) => (
                          <motion.div
                            key={integration.name}
                            initial={{ opacity: 0, y: 30 }}
                            animate={{ opacity: 1, y: 0 }}
                            transition={{ delay: index * 0.2 }}
                            whileHover={{ 
                              y: -10, 
                              scale: 1.05,
                              boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)"
                            }}
                            className={`p-6 rounded-2xl cursor-pointer transition-all duration-500 ${
                              integration.connected 
                                ? `bg-gradient-to-br from-${integration.color}-500/20 to-${integration.color}-600/20 border border-${integration.color}-500/30` 
                                : 'bg-gray-800/40 border border-gray-600/30 hover:border-gray-500/50'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-4">
                              <motion.div
                                whileHover={{ rotate: 360 }}
                                className={`p-4 rounded-xl ${integration.connected ? `bg-${integration.color}-500` : 'bg-gray-600'}`}
                              >
                                <integration.icon className="h-8 w-8 text-white" />
                              </motion.div>
                              {integration.connected ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  whileHover={{ scale: 1.2, rotate: 360 }}
                                >
                                  <CheckCircle className="h-8 w-8 text-green-400" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Button className="bg-gradient-to-r from-purple-500 to-pink-500 hover:from-purple-600 hover:to-pink-600">
                                    Connect
                                  </Button>
                                </motion.div>
                              )}
                            </div>
                            <h3 className="font-semibold text-white text-lg mb-2">{integration.name}</h3>
                            <p className="text-gray-300 text-sm">
                              {integration.connected ? 'Premium features active' : 'Unlock premium features'}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Appearance Tab */}
              <TabsContent value="appearance">
                <motion.div
                  initial={{ opacity: 0, rotateX: -20 }}
                  animate={{ opacity: 1, rotateX: 0 }}
                  transition={{ duration: 0.8 }}
                >
                  <Card className="bg-gradient-to-br from-black/40 to-pink-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-white text-2xl">
                        <motion.div
                          whileHover={{ rotate: 360, scale: 1.2 }}
                          className="p-3 bg-gradient-to-r from-pink-500 to-rose-500 rounded-xl"
                        >
                          <Palette className="h-8 w-8 text-white" />
                        </motion.div>
                        Premium Themes
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-8">
                      <motion.div
                        whileHover={{ scale: 1.02 }}
                        className="flex items-center justify-between p-6 bg-gradient-to-r from-white/10 to-purple-500/10 rounded-2xl border border-white/20"
                      >
                        <div className="flex items-center gap-4">
                          <motion.div
                            whileHover={{ rotate: 360 }}
                            className="p-3 bg-gradient-to-r from-gray-700 to-gray-900 rounded-xl"
                          >
                            <Palette className="h-6 w-6 text-white" />
                          </motion.div>
                          <div>
                            <h3 className="text-lg font-semibold text-white">Premium Dark Mode</h3>
                            <p className="text-gray-300 text-sm">Enhanced visual experience</p>
                          </div>
                        </div>
                        <motion.div whileTap={{ scale: 0.9 }}>
                          <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                        </motion.div>
                      </motion.div>

                      <div>
                        <h3 className="text-xl font-semibold mb-6 text-white flex items-center gap-2">
                          <Diamond className="h-6 w-6 text-purple-400" />
                          Premium Color Schemes
                        </h3>
                        <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
                          {[
                            { name: 'Cosmic', colors: 'from-purple-600 via-blue-600 to-purple-800' },
                            { name: 'Sunset', colors: 'from-orange-500 via-pink-500 to-red-600' },
                            { name: 'Ocean', colors: 'from-blue-500 via-teal-500 to-green-600' },
                            { name: 'Royal', colors: 'from-indigo-600 via-purple-600 to-pink-600' }
                          ].map((theme, index) => (
                            <motion.div
                              key={theme.name}
                              initial={{ opacity: 0, scale: 0.8 }}
                              animate={{ opacity: 1, scale: 1 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={{ 
                                scale: 1.1, 
                                rotate: 5,
                                boxShadow: "0 20px 40px rgba(0, 0, 0, 0.3)"
                              }}
                              whileTap={{ scale: 0.95 }}
                              className={`h-32 bg-gradient-to-br ${theme.colors} rounded-2xl cursor-pointer shadow-2xl flex items-center justify-center border-4 border-transparent hover:border-white/50 transition-all duration-300`}
                            >
                              <motion.span 
                                whileHover={{ scale: 1.2 }}
                                className="text-white font-semibold text-lg drop-shadow-2xl"
                              >
                                {theme.name}
                              </motion.span>
                            </motion.div>
                          ))}
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Notifications and Security tabs with similar premium styling */}
              <TabsContent value="notifications">
                <Card className="bg-gradient-to-br from-black/40 to-orange-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-white text-2xl">
                      <motion.div
                        animate={{ rotate: [0, 10, -10, 0] }}
                        transition={{ repeat: Infinity, duration: 2 }}
                        className="p-3 bg-gradient-to-r from-orange-500 to-yellow-500 rounded-xl"
                      >
                        <Bell className="h-8 w-8 text-white" />
                      </motion.div>
                      Smart Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { title: 'AI-Powered Alerts', desc: 'Machine learning notification optimization' },
                        { title: 'Real-time Updates', desc: 'Instant premium feature notifications' },
                        { title: 'Custom Sounds', desc: 'Premium notification sound library' }
                      ].map((item, index) => (
                        <motion.div
                          key={item.title}
                          initial={{ opacity: 0, x: -30 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: index * 0.2 }}
                          whileHover={{ 
                            x: 15, 
                            backgroundColor: 'rgba(249, 115, 22, 0.1)',
                            scale: 1.02
                          }}
                          className="flex items-center justify-between p-6 rounded-2xl transition-all duration-500 border border-transparent hover:border-orange-500/30"
                        >
                          <div>
                            <h3 className="font-semibold text-white text-lg">{item.title}</h3>
                            <p className="text-gray-300">{item.desc}</p>
                          </div>
                          <motion.div whileTap={{ scale: 0.9 }}>
                            <Switch checked={notifications} onCheckedChange={setNotifications} />
                          </motion.div>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <div className="grid gap-6 lg:grid-cols-2">
                  <motion.div
                    whileHover={{ 
                      scale: 1.05,
                      rotateY: 5,
                      boxShadow: "0 30px 60px rgba(168, 85, 247, 0.3)"
                    }}
                  >
                    <Card className="bg-gradient-to-br from-black/40 to-purple-900/40 backdrop-blur-2xl border border-white/10 shadow-2xl h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-white">
                          <motion.div
                            whileHover={{ rotate: 360, scale: 1.2 }}
                            className="p-3 bg-gradient-to-r from-purple-500 to-indigo-500 rounded-xl"
                          >
                            <Shield className="h-6 w-6 text-white" />
                          </motion.div>
                          Enterprise Security
                        </CardTitle>
                      </CardHeader>
                      <CardContent className="space-y-6">
                        <div>
                          <label className="text-sm font-medium mb-3 block text-purple-200">Premium Password</label>
                          <div className="relative">
                            <motion.div whileFocus={{ scale: 1.02 }}>
                              <Input 
                                type={showPassword ? 'text' : 'password'} 
                                className="pr-12 bg-white/10 border-white/20 text-white h-12 rounded-xl focus:border-purple-400"
                              />
                            </motion.div>
                            <motion.button
                              whileHover={{ scale: 1.1 }}
                              whileTap={{ scale: 0.9 }}
                              type="button"
                              onClick={() => setShowPassword(!showPassword)}
                              className="absolute right-4 top-1/2 -translate-y-1/2"
                            >
                              {showPassword ? <EyeOff className="h-5 w-5 text-gray-400" /> : <Eye className="h-5 w-5 text-gray-400" />}
                            </motion.button>
                          </div>
                        </div>
                        
                        <motion.div
                          whileHover={{ 
                            scale: 1.05,
                            boxShadow: "0 20px 40px rgba(168, 85, 247, 0.4)"
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button className="w-full h-14 bg-gradient-to-r from-purple-500 via-indigo-500 to-blue-500 hover:from-purple-600 hover:via-indigo-600 hover:to-blue-600 text-white text-lg font-semibold rounded-xl shadow-2xl">
                            Update Premium Security
                            <Shield className="h-5 w-5 ml-2" />
                          </Button>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    whileHover={{ 
                      scale: 1.05,
                      rotateY: -5,
                      boxShadow: "0 30px 60px rgba(34, 197, 94, 0.3)"
                    }}
                  >
                    <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-2xl border border-green-500/30 shadow-2xl h-full">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-3 text-white">
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                            className="p-3 bg-gradient-to-r from-green-500 to-emerald-500 rounded-xl"
                          >
                            <CheckCircle className="h-6 w-6 text-white" />
                          </motion.div>
                          Security Premium Status
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-4">
                          {[
                            { feature: 'Biometric Authentication', status: 'Active' },
                            { feature: 'End-to-end Encryption', status: 'Active' },
                            { feature: 'Advanced Threat Detection', status: 'Active' },
                            { feature: 'Zero-Trust Architecture', status: 'Active' }
                          ].map((item, index) => (
                            <motion.div
                              key={item.feature}
                              initial={{ opacity: 0, y: 10 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: index * 0.1 }}
                              whileHover={{ x: 10, scale: 1.05 }}
                              className="flex items-center gap-4 p-3 rounded-xl bg-white/10 cursor-pointer"
                            >
                              <motion.div
                                animate={{ scale: [1, 1.2, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                                className="w-4 h-4 bg-green-400 rounded-full"
                              />
                              <span className="text-gray-200 flex-1">{item.feature}</span>
                              <Badge className="bg-green-500/20 text-green-300 border-green-500/30">
                                {item.status}
                              </Badge>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}