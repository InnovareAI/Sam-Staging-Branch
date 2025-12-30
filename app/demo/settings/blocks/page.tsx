'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
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
  TrendingUp,
  BarChart3,
  PieChart,
  Activity
} from 'lucide-react'

export default function BlocksSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-blue-900 to-indigo-900 p-6">
      {/* Header with enterprise dashboard feel */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="bg-black/20 backdrop-blur-xl border border-white/10 rounded-2xl p-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                whileHover={{ rotate: 180, scale: 1.1 }}
                transition={{ type: "spring", stiffness: 300 }}
                className="p-3 bg-gradient-to-r from-blue-500 to-purple-600 rounded-xl shadow-lg"
              >
                <Settings className="h-8 w-8 text-white" />
              </motion.div>
              <div>
                <h1 className="text-3xl font-semibold text-white">Enterprise Settings</h1>
                <p className="text-blue-200">Blocks.mvp-subha.me Design - Data-Rich Dashboard Style</p>
              </div>
            </div>
            
            {/* Real-time metrics */}
            <div className="flex gap-6">
              <div className="text-center">
                <div className="text-2xl font-semibold text-green-400">98.7%</div>
                <div className="text-xs text-gray-400">System Health</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-blue-400">2.1K</div>
                <div className="text-xs text-gray-400">Active Users</div>
              </div>
              <div className="text-center">
                <div className="text-2xl font-semibold text-purple-400">847ms</div>
                <div className="text-xs text-gray-400">Response Time</div>
              </div>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Glass-morphism tab navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <TabsList className="grid w-full grid-cols-5 bg-black/20 backdrop-blur-xl border border-white/10 p-2">
              {[
                { id: 'profile', icon: User, label: 'Profile' },
                { id: 'integrations', icon: LinkedinIcon, label: 'Integrations' },
                { id: 'appearance', icon: Palette, label: 'Appearance' },
                { id: 'notifications', icon: Bell, label: 'Notifications' },
                { id: 'security', icon: Shield, label: 'Security' }
              ].map((tab) => (
                <TabsTrigger 
                  key={tab.id}
                  value={tab.id} 
                  className="flex items-center gap-2 text-white data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-500 data-[state=active]:to-purple-600 data-[state=active]:text-white transition-all duration-300"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          <div className="mt-6 grid gap-6">
            {/* Profile Tab - Data visualization focused */}
            <TabsContent value="profile" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="grid gap-6 lg:grid-cols-3"
              >
                {/* Main profile card with visual depth */}
                <Card className="lg:col-span-2 bg-black/20 backdrop-blur-xl border border-white/10 shadow-2xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <User className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                    <CardDescription className="text-gray-300">
                      Manage your account details and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-4 md:grid-cols-2">
                      <div>
                        <label className="text-sm font-medium mb-2 block text-gray-200">Full Name</label>
                        <Input 
                          defaultValue="Sarah Powell" 
                          className="bg-white/10 border-white/20 text-white placeholder:text-gray-400" 
                        />
                      </div>
                      <div>
                        <label className="text-sm font-medium mb-2 block text-gray-200">Email</label>
                        <Input 
                          defaultValue="sarah@innovareai.com" 
                          className="bg-white/10 border-white/20 text-white placeholder:text-gray-400" 
                        />
                      </div>
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block text-gray-200">Company</label>
                      <Input 
                        defaultValue="InnovareAI" 
                        className="bg-white/10 border-white/20 text-white placeholder:text-gray-400" 
                      />
                    </div>
                    
                    <Button className="w-full bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700 text-white">
                      Update Profile
                      <ArrowRight className="h-4 w-4 ml-2" />
                    </Button>
                  </CardContent>
                </Card>

                {/* Analytics sidebar */}
                <div className="space-y-6">
                  {/* Usage metrics */}
                  <Card className="bg-gradient-to-br from-green-500/20 to-emerald-500/20 backdrop-blur-xl border border-green-500/20 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <TrendingUp className="h-5 w-5 text-green-400" />
                        Account Usage
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-4">
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-200">Contacts</span>
                            <span className="text-white font-medium">2.1K / 5K</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: '42%' }}
                              transition={{ duration: 1, delay: 0.5 }}
                              className="bg-gradient-to-r from-green-400 to-blue-500 h-2 rounded-full"
                            />
                          </div>
                        </div>
                        
                        <div>
                          <div className="flex justify-between text-sm mb-2">
                            <span className="text-gray-200">API Calls</span>
                            <span className="text-white font-medium">847 / 1K</span>
                          </div>
                          <div className="w-full bg-gray-700 rounded-full h-2">
                            <motion.div 
                              initial={{ width: 0 }}
                              animate={{ width: '84.7%' }}
                              transition={{ duration: 1, delay: 0.7 }}
                              className="bg-gradient-to-r from-yellow-400 to-orange-500 h-2 rounded-full"
                            />
                          </div>
                        </div>
                        
                        <Badge className="bg-blue-500/20 text-blue-300 border-blue-500/30">
                          Professional Plan
                        </Badge>
                      </div>
                    </CardContent>
                  </Card>

                  {/* Activity chart */}
                  <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-white">
                        <Activity className="h-5 w-5 text-purple-400" />
                        Weekly Activity
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="flex items-end justify-between h-24 gap-2">
                        {[65, 78, 45, 92, 67, 89, 74].map((height, index) => (
                          <motion.div
                            key={index}
                            initial={{ height: 0 }}
                            animate={{ height: `${height}%` }}
                            transition={{ duration: 0.8, delay: index * 0.1 + 0.3 }}
                            className="bg-gradient-to-t from-purple-500 to-pink-500 w-8 rounded-t-lg"
                          />
                        ))}
                      </div>
                      <div className="flex justify-between text-xs text-gray-400 mt-2">
                        {['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].map(day => (
                          <span key={day}>{day}</span>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </TabsContent>

            {/* Other tabs with enterprise styling */}
            <TabsContent value="integrations">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <LinkedinIcon className="h-5 w-5 text-blue-400" />
                      Enterprise Integrations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                      {[
                        { name: 'LinkedIn Sales Navigator', connected: true, icon: LinkedinIcon, color: 'blue', users: '2.4K' },
                        { name: 'Unipile Multi-Platform', connected: true, icon: Zap, color: 'green', users: '1.8K' },
                        { name: 'ActiveCampaign Enterprise', connected: false, icon: Users, color: 'orange', users: '0' }
                      ].map((integration) => (
                        <motion.div
                          key={integration.name}
                          whileHover={{ y: -5, scale: 1.02 }}
                          className={`p-6 rounded-xl border transition-all duration-300 ${
                            integration.connected 
                              ? 'bg-gradient-to-br from-green-500/20 to-blue-500/20 border-green-500/30' 
                              : 'bg-gray-500/10 border-gray-500/30 hover:border-gray-400/50'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-4">
                            <integration.icon className={`h-10 w-10 text-${integration.color}-400`} />
                            {integration.connected ? (
                              <CheckCircle className="h-6 w-6 text-green-400" />
                            ) : (
                              <Button size="sm" variant="outline" className="text-white border-white/20">
                                Connect
                              </Button>
                            )}
                          </div>
                          <h3 className="font-semibold text-white mb-1">{integration.name}</h3>
                          <p className="text-sm text-gray-300 mb-3">
                            {integration.connected ? `${integration.users} active users` : 'Not connected'}
                          </p>
                          {integration.connected && (
                            <div className="flex items-center gap-2">
                              <div className="w-2 h-2 bg-green-400 rounded-full animate-pulse"></div>
                              <span className="text-xs text-green-400">Live</span>
                            </div>
                          )}
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
                initial={{ opacity: 0, rotateX: -15 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Palette className="h-5 w-5" />
                      Interface Customization
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between p-4 bg-white/5 rounded-xl">
                      <div>
                        <h3 className="font-medium text-white">Dark Mode</h3>
                        <p className="text-sm text-gray-300">Optimized for extended dashboard usage</p>
                      </div>
                      <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                    </div>

                    <div>
                      <h3 className="font-medium mb-4 text-white">Dashboard Themes</h3>
                      <div className="grid grid-cols-3 lg:grid-cols-5 gap-4">
                        {[
                          { name: 'Ocean', colors: 'from-blue-500 to-cyan-500' },
                          { name: 'Sunset', colors: 'from-orange-500 to-pink-500' },
                          { name: 'Forest', colors: 'from-green-500 to-teal-500' },
                          { name: 'Galaxy', colors: 'from-purple-500 to-indigo-500' },
                          { name: 'Fire', colors: 'from-red-500 to-yellow-500' }
                        ].map((theme) => (
                          <motion.div
                            key={theme.name}
                            whileHover={{ scale: 1.1, rotate: 5 }}
                            whileTap={{ scale: 0.9 }}
                            className={`h-16 w-full bg-gradient-to-br ${theme.colors} rounded-xl cursor-pointer shadow-lg border-2 border-transparent hover:border-white/50`}
                          >
                            <div className="flex items-center justify-center h-full">
                              <span className="text-xs font-medium text-white">{theme.name}</span>
                            </div>
                          </motion.div>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Notifications and Security tabs */}
            <TabsContent value="notifications">
              <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2 text-white">
                    <Bell className="h-5 w-5" />
                    Alert Management
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  {[
                    { title: 'System Alerts', desc: 'Critical system notifications and updates' },
                    { title: 'Performance Metrics', desc: 'Dashboard performance and usage alerts' },
                    { title: 'Security Events', desc: 'Authentication and access notifications' }
                  ].map((item, index) => (
                    <motion.div
                      key={item.title}
                      initial={{ opacity: 0, x: -20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.1 }}
                      className="flex items-center justify-between p-4 bg-white/5 rounded-xl hover:bg-white/10 transition-all"
                    >
                      <div>
                        <h3 className="font-medium text-white">{item.title}</h3>
                        <p className="text-sm text-gray-300">{item.desc}</p>
                      </div>
                      <Switch checked={notifications} onCheckedChange={setNotifications} />
                    </motion.div>
                  ))}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="security">
              <div className="grid gap-6 md:grid-cols-2">
                <Card className="bg-black/20 backdrop-blur-xl border border-white/10 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <Shield className="h-5 w-5 text-green-400" />
                      Enterprise Security
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block text-gray-200">Current Password</label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? 'text' : 'password'} 
                          className="pr-10 bg-white/10 border-white/20 text-white"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4 text-gray-400" /> : <Eye className="h-4 w-4 text-gray-400" />}
                        </button>
                      </div>
                    </div>
                    <Button className="w-full bg-gradient-to-r from-green-500 to-blue-600 hover:from-green-600 hover:to-blue-700">
                      Update Security Settings
                    </Button>
                  </CardContent>
                </Card>

                <Card className="bg-gradient-to-br from-green-500/20 to-blue-500/20 backdrop-blur-xl border border-green-500/20 shadow-xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2 text-white">
                      <CheckCircle className="h-5 w-5 text-green-400" />
                      Security Status
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-3">
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-200">Multi-factor authentication active</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-200">Enterprise SSO configured</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <div className="w-3 h-3 bg-green-400 rounded-full animate-pulse"></div>
                        <span className="text-sm text-gray-200">Audit logging enabled</span>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      </div>
    </div>
  )
}