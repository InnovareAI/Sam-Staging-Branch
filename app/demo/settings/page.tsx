'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import EmailProvidersOnboarding from '@/components/EmailProvidersOnboarding'
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
  Mail
} from 'lucide-react'

export default function DemoSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [linkedInConnected, setLinkedInConnected] = useState(true)
  const [isEmailModalOpen, setIsEmailModalOpen] = useState(false)

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-blue-50 to-indigo-50 p-6">
      {/* Header with motion */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-6xl mx-auto mb-8"
      >
        <div className="flex items-center gap-3 mb-2">
          <motion.div
            whileHover={{ rotate: 90, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="p-2 bg-indigo-100 rounded-xl"
          >
            <Settings className="h-6 w-6 text-indigo-600" />
          </motion.div>
          <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
            Personal Settings
          </h1>
        </div>
        <p className="text-slate-600">
          Manage your personal profile, integrations, and preferences
        </p>
      </motion.div>

      <div className="max-w-6xl mx-auto">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Enhanced Tab Navigation */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            <TabsList className="grid w-full grid-cols-5 bg-white/70 backdrop-blur-sm border border-white/20 shadow-lg">
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
                  className="flex items-center gap-2 data-[state=active]:bg-indigo-100 data-[state=active]:text-indigo-700 transition-all duration-300"
                >
                  <tab.icon className="h-4 w-4" />
                  <span className="hidden sm:inline">{tab.label}</span>
                </TabsTrigger>
              ))}
            </TabsList>
          </motion.div>

          <div className="mt-6 grid gap-6">
            {/* Profile Tab - Origin UI Style */}
            <TabsContent value="profile" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ duration: 0.5 }}
                className="grid gap-6 md:grid-cols-2"
              >
                {/* Clean Origin UI Card */}
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <User className="h-5 w-5" />
                      Profile Information
                    </CardTitle>
                    <CardDescription>
                      Update your account details and preferences
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4">
                    <div>
                      <label className="text-sm font-medium mb-2 block">Full Name</label>
                      <Input defaultValue="Sarah Powell" className="border-slate-200" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Email</label>
                      <Input defaultValue="sarah@innovareai.com" className="border-slate-200" />
                    </div>
                    <div>
                      <label className="text-sm font-medium mb-2 block">Company</label>
                      <Input defaultValue="InnovareAI" className="border-slate-200" />
                    </div>
                  </CardContent>
                </Card>

                {/* Blocks.mvp-subha.me Style with Gradients */}
                <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-lg overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-indigo-500/10 to-purple-500/10"></div>
                  <CardHeader className="relative">
                    <CardTitle className="flex items-center gap-2">
                      <motion.div 
                        animate={{ rotate: 360 }}
                        transition={{ duration: 2, repeat: Infinity, ease: "linear" }}
                      >
                        <Sparkles className="h-5 w-5 text-indigo-600" />
                      </motion.div>
                      Premium Features
                    </CardTitle>
                    <CardDescription>
                      Advanced analytics and insights
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="relative space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-sm">
                        <span>Account Usage</span>
                        <span className="font-medium">2.1K / 5K contacts</span>
                      </div>
                      <div className="w-full bg-indigo-100 rounded-full h-2">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '42%' }}
                          transition={{ duration: 1, delay: 0.5 }}
                          className="bg-gradient-to-r from-indigo-500 to-purple-500 h-2 rounded-full"
                        ></motion.div>
                      </div>
                    </div>
                    <Badge variant="secondary" className="bg-indigo-100 text-indigo-700">
                      Professional Plan
                    </Badge>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Integrations Tab - Kibo UI Swipe Style */}
            <TabsContent value="integrations">
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <LinkedinIcon className="h-5 w-5 text-blue-600" />
                      Connected Integrations
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                      {[
                        { name: 'LinkedIn', connected: true, icon: LinkedinIcon, color: 'blue', description: 'Professional networking' },
                        { name: 'Email Integration', connected: false, icon: Mail, color: 'emerald', action: () => setIsEmailModalOpen(true), description: 'Google & Microsoft email' }
                      ].map((integration) => (
                        <motion.div
                          key={integration.name}
                          whileHover={{ y: -5, scale: 1.02 }}
                          whileTap={{ scale: 0.98 }}
                          onClick={integration.action}
                          className={`p-4 rounded-xl border-2 transition-all duration-300 cursor-pointer ${
                            integration.connected 
                              ? `bg-${integration.color}-50 border-${integration.color}-200` 
                              : 'bg-gray-50 border-gray-200 hover:border-gray-300'
                          }`}
                        >
                          <div className="flex items-center justify-between mb-3">
                            <integration.icon className={`h-8 w-8 text-${integration.color}-600`} />
                            {integration.connected ? (
                              <CheckCircle className="h-5 w-5 text-green-500" />
                            ) : (
                              <Button size="sm" variant="outline">
                                Connect
                              </Button>
                            )}
                          </div>
                          <h3 className="font-semibold">{integration.name}</h3>
                          <p className="text-xs text-gray-600 mt-1">
                            {integration.description}
                          </p>
                          <p className="text-xs text-gray-500 mt-2">
                            {integration.connected ? 'Connected' : 'Not connected'}
                          </p>
                        </motion.div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Appearance Tab - SHSF UI Motion Style */}
            <TabsContent value="appearance">
              <motion.div
                initial={{ opacity: 0, rotateX: -15 }}
                animate={{ opacity: 1, rotateX: 0 }}
                transition={{ duration: 0.6 }}
                className="space-y-6"
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Palette className="h-5 w-5" />
                      Appearance Settings
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-medium">Dark Mode</h3>
                        <p className="text-sm text-gray-600">Switch between light and dark themes</p>
                      </div>
                      <motion.div
                        whileTap={{ scale: 0.9 }}
                      >
                        <Switch 
                          checked={darkMode} 
                          onCheckedChange={setDarkMode}
                        />
                      </motion.div>
                    </div>

                    <div>
                      <h3 className="font-medium mb-3">Theme Colors</h3>
                      <div className="flex gap-3">
                        {['indigo', 'purple', 'blue', 'green', 'orange'].map((color) => (
                          <motion.div
                            key={color}
                            whileHover={{ scale: 1.2, rotate: 5 }}
                            whileTap={{ scale: 0.9 }}
                            className={`w-12 h-12 bg-${color}-500 rounded-xl cursor-pointer shadow-lg`}
                          />
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Notifications Tab - Skiper UI Hover Effects */}
            <TabsContent value="notifications">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Bell className="h-5 w-5" />
                      Notification Preferences
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {[
                      { title: 'Email Notifications', desc: 'Receive updates via email' },
                      { title: 'Push Notifications', desc: 'Browser push notifications' },
                      { title: 'SMS Alerts', desc: 'Important alerts via SMS' }
                    ].map((item, index) => (
                      <motion.div
                        key={item.title}
                        initial={{ opacity: 0, x: -20 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: index * 0.1 }}
                        whileHover={{ x: 10, backgroundColor: 'rgba(99, 102, 241, 0.05)' }}
                        className="flex items-center justify-between p-4 rounded-lg transition-all duration-300"
                      >
                        <div>
                          <h3 className="font-medium">{item.title}</h3>
                          <p className="text-sm text-gray-600">{item.desc}</p>
                        </div>
                        <Switch checked={notifications} onCheckedChange={setNotifications} />
                      </motion.div>
                    ))}
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Security Tab - Combined Approach */}
            <TabsContent value="security">
              <motion.div
                initial={{ opacity: 0, scale: 0.9 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.5 }}
                className="space-y-6"
              >
                <div className="grid gap-6 md:grid-cols-2">
                  <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2">
                        <Shield className="h-5 w-5 text-green-600" />
                        Password Security
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <div>
                        <label className="text-sm font-medium mb-2 block">Current Password</label>
                        <div className="relative">
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            className="pr-10"
                          />
                          <button
                            type="button"
                            onClick={() => setShowPassword(!showPassword)}
                            className="absolute right-3 top-1/2 -translate-y-1/2"
                          >
                            {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                          </button>
                        </div>
                      </div>
                      <motion.div whileHover={{ scale: 1.02 }}>
                        <Button className="w-full bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
                          Update Password
                          <ArrowRight className="h-4 w-4 ml-2" />
                        </Button>
                      </motion.div>
                    </CardContent>
                  </Card>

                  <Card className="bg-gradient-to-br from-green-50 to-emerald-50 border-green-200 shadow-lg">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-2 text-green-800">
                        <CheckCircle className="h-5 w-5" />
                        Security Status
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-3">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm">Two-factor authentication enabled</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm">Strong password policy active</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></div>
                          <span className="text-sm">Recent login activity monitored</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </motion.div>
            </TabsContent>
          </div>
        </Tabs>
      </div>

      {/* Email Providers Onboarding Modal */}
      <EmailProvidersOnboarding
        isOpen={isEmailModalOpen}
        onClose={() => setIsEmailModalOpen(false)}
        onComplete={() => {
          console.log('Email provider connected');
          setIsEmailModalOpen(false);
        }}
      />
    </div>
  )
}
