'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { 
  Settings, 
  User, 
  Shield, 
  Palette, 
  Bell, 
  LinkedinIcon,
  CheckCircle,
  Zap,
  Users,
  ArrowRight,
  Eye,
  EyeOff,
  Check,
  X,
  Circle
} from 'lucide-react'

export default function OriginSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)

  return (
    <div className="min-h-screen bg-white">
      {/* Clean header */}
      <motion.div 
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3 }}
        className="border-b border-gray-100 bg-white"
      >
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-gray-900 rounded-lg flex items-center justify-center">
              <Settings className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Settings</h1>
              <p className="text-gray-500 text-sm">Origin UI - Clean & Minimalist</p>
            </div>
          </div>
        </div>
      </motion.div>

      <div className="max-w-4xl mx-auto px-6 py-8">
        <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
          {/* Simple tab navigation */}
          <TabsList className="grid w-full grid-cols-5 bg-gray-50 p-1 h-auto">
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
                className="flex items-center gap-2 py-3 text-sm font-medium data-[state=active]:bg-white data-[state=active]:shadow-sm"
              >
                <tab.icon className="h-4 w-4" />
                <span className="hidden sm:inline">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          <div className="mt-8">
            {/* Profile Tab */}
            <TabsContent value="profile" className="space-y-6">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Profile Information</CardTitle>
                    <CardDescription>
                      Update your account details and preferences.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="grid gap-6 md:grid-cols-2">
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Full Name</label>
                        <Input 
                          defaultValue="Sarah Powell" 
                          className="h-10"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-sm font-medium text-gray-700">Email</label>
                        <Input 
                          defaultValue="sarah@innovareai.com" 
                          className="h-10"
                        />
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Company</label>
                      <Input 
                        defaultValue="InnovareAI" 
                        className="h-10"
                      />
                    </div>
                    
                    <Separator />
                    
                    <div className="flex justify-between items-center">
                      <div>
                        <h4 className="text-sm font-medium">Account Status</h4>
                        <p className="text-sm text-gray-500">Professional Plan</p>
                      </div>
                      <Badge variant="secondary" className="bg-green-50 text-green-700 border-green-200">
                        Active
                      </Badge>
                    </div>
                    
                    <Button className="w-full sm:w-auto">
                      Save Changes
                    </Button>
                  </CardContent>
                </Card>

                {/* Usage overview */}
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Usage Overview</CardTitle>
                    <CardDescription>
                      Your current plan usage and limits.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>Contacts</span>
                          <span className="text-gray-500">2,100 / 5,000</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-gray-900 h-2 rounded-full w-[42%]"></div>
                        </div>
                      </div>
                      
                      <div>
                        <div className="flex justify-between text-sm mb-2">
                          <span>API Calls</span>
                          <span className="text-gray-500">847 / 1,000</span>
                        </div>
                        <div className="w-full bg-gray-100 rounded-full h-2">
                          <div className="bg-orange-500 h-2 rounded-full w-[85%]"></div>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Integrations Tab */}
            <TabsContent value="integrations">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Connected Services</CardTitle>
                    <CardDescription>
                      Manage your third-party integrations.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { 
                          name: 'LinkedIn', 
                          connected: true, 
                          icon: LinkedinIcon, 
                          description: 'Professional networking and outreach'
                        },
                        { 
                          name: 'Unipile', 
                          connected: true, 
                          icon: Zap, 
                          description: 'Multi-platform messaging integration'
                        },
                        { 
                          name: 'ActiveCampaign', 
                          connected: false, 
                          icon: Users, 
                          description: 'Email marketing automation'
                        }
                      ].map((integration) => (
                        <div key={integration.name} className="flex items-center justify-between p-4 border border-gray-100 rounded-lg">
                          <div className="flex items-center gap-4">
                            <div className="w-10 h-10 bg-gray-50 rounded-lg flex items-center justify-center">
                              <integration.icon className="h-5 w-5 text-gray-600" />
                            </div>
                            <div>
                              <h3 className="font-medium text-gray-900">{integration.name}</h3>
                              <p className="text-sm text-gray-500">{integration.description}</p>
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            {integration.connected ? (
                              <>
                                <div className="flex items-center gap-2">
                                  <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                  <span className="text-sm text-green-700">Connected</span>
                                </div>
                                <Button variant="outline" size="sm">
                                  Configure
                                </Button>
                              </>
                            ) : (
                              <Button size="sm">
                                Connect
                              </Button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Appearance Tab */}
            <TabsContent value="appearance">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Interface Preferences</CardTitle>
                    <CardDescription>
                      Customize how the application looks and feels.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="flex items-center justify-between py-2">
                      <div>
                        <h4 className="text-sm font-medium">Dark Mode</h4>
                        <p className="text-sm text-gray-500">Switch between light and dark themes</p>
                      </div>
                      <Switch 
                        checked={darkMode} 
                        onCheckedChange={setDarkMode}
                      />
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium mb-4">Accent Color</h4>
                      <div className="grid grid-cols-6 gap-3">
                        {[
                          { name: 'Gray', color: 'bg-gray-900' },
                          { name: 'Blue', color: 'bg-blue-600' },
                          { name: 'Green', color: 'bg-green-600' },
                          { name: 'Purple', color: 'bg-purple-600' },
                          { name: 'Orange', color: 'bg-orange-600' },
                          { name: 'Red', color: 'bg-red-600' }
                        ].map((color, index) => (
                          <button
                            key={color.name}
                            className={`w-12 h-12 rounded-lg ${color.color} ${index === 0 ? 'ring-2 ring-offset-2 ring-gray-900' : ''} hover:scale-105 transition-transform`}
                            title={color.name}
                          />
                        ))}
                      </div>
                    </div>

                    <Separator />

                    <div>
                      <h4 className="text-sm font-medium mb-4">Font Size</h4>
                      <div className="flex gap-3">
                        {['Small', 'Medium', 'Large'].map((size, index) => (
                          <Button 
                            key={size}
                            variant={index === 1 ? 'default' : 'outline'}
                            size="sm"
                          >
                            {size}
                          </Button>
                        ))}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Notifications Tab */}
            <TabsContent value="notifications">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Notification Settings</CardTitle>
                    <CardDescription>
                      Choose what notifications you want to receive.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-6">
                      {[
                        {
                          title: 'Email Notifications',
                          description: 'Receive updates and alerts via email',
                          enabled: true
                        },
                        {
                          title: 'Push Notifications',
                          description: 'Browser notifications for important updates',
                          enabled: true
                        },
                        {
                          title: 'SMS Alerts',
                          description: 'Text messages for critical alerts only',
                          enabled: false
                        },
                        {
                          title: 'Weekly Reports',
                          description: 'Summary of your activity and metrics',
                          enabled: true
                        }
                      ].map((item) => (
                        <div key={item.title} className="flex items-center justify-between py-3">
                          <div className="flex-1">
                            <h4 className="text-sm font-medium text-gray-900">{item.title}</h4>
                            <p className="text-sm text-gray-500">{item.description}</p>
                          </div>
                          <Switch 
                            checked={item.enabled} 
                            onCheckedChange={() => {}}
                          />
                        </div>
                      ))}
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            </TabsContent>

            {/* Security Tab */}
            <TabsContent value="security">
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="space-y-6"
              >
                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Password & Authentication</CardTitle>
                    <CardDescription>
                      Manage your account security settings.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Current Password</label>
                      <div className="relative">
                        <Input 
                          type={showPassword ? 'text' : 'password'} 
                          className="pr-10 h-10"
                          placeholder="Enter current password"
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                        >
                          {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">New Password</label>
                      <Input 
                        type="password" 
                        className="h-10"
                        placeholder="Enter new password"
                      />
                    </div>
                    
                    <div className="space-y-2">
                      <label className="text-sm font-medium text-gray-700">Confirm Password</label>
                      <Input 
                        type="password" 
                        className="h-10"
                        placeholder="Confirm new password"
                      />
                    </div>
                    
                    <Button>
                      Update Password
                    </Button>
                  </CardContent>
                </Card>

                <Card className="shadow-sm">
                  <CardHeader>
                    <CardTitle className="text-lg font-medium">Security Status</CardTitle>
                    <CardDescription>
                      Current security features and their status.
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-4">
                      {[
                        { feature: 'Two-factor authentication', enabled: true, recommended: true },
                        { feature: 'Login notifications', enabled: true, recommended: true },
                        { feature: 'Session management', enabled: true, recommended: false },
                        { feature: 'API key rotation', enabled: false, recommended: true }
                      ].map((item) => (
                        <div key={item.feature} className="flex items-center justify-between py-2">
                          <div className="flex items-center gap-3">
                            <div className="flex items-center justify-center w-8 h-8">
                              {item.enabled ? (
                                <CheckCircle className="h-5 w-5 text-green-600" />
                              ) : (
                                <Circle className="h-5 w-5 text-gray-400" />
                              )}
                            </div>
                            <div>
                              <span className="text-sm font-medium text-gray-900">{item.feature}</span>
                              {item.recommended && !item.enabled && (
                                <Badge variant="outline" className="ml-2 text-xs border-orange-200 text-orange-700 bg-orange-50">
                                  Recommended
                                </Badge>
                              )}
                            </div>
                          </div>
                          <Switch 
                            checked={item.enabled}
                            onCheckedChange={() => {}}
                          />
                        </div>
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