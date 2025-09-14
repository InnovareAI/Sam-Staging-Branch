'use client'

import React, { useState } from 'react'
import { motion, AnimatePresence, PanInfo } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Switch } from '@/components/ui/switch'
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
  ChevronLeft,
  ChevronRight,
  Smartphone,
  Hand
} from 'lucide-react'

export default function KiboSettingsPage() {
  const [currentCard, setCurrentCard] = useState(0)
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [dragDirection, setDragDirection] = useState<'left' | 'right' | null>(null)

  const settingsCards = [
    {
      id: 'profile',
      title: 'Profile Settings',
      icon: User,
      color: 'from-blue-400 to-purple-500',
      component: ProfileCard
    },
    {
      id: 'integrations',
      title: 'Connected Apps',
      icon: LinkedinIcon,
      color: 'from-green-400 to-teal-500',
      component: IntegrationsCard
    },
    {
      id: 'appearance',
      title: 'Visual Theme',
      icon: Palette,
      color: 'from-pink-400 to-rose-500',
      component: AppearanceCard
    },
    {
      id: 'notifications',
      title: 'Alert Settings',
      icon: Bell,
      color: 'from-orange-400 to-yellow-500',
      component: NotificationsCard
    },
    {
      id: 'security',
      title: 'Security Center',
      icon: Shield,
      color: 'from-purple-400 to-indigo-500',
      component: SecurityCard
    }
  ]

  const handleDragEnd = (event: any, info: PanInfo) => {
    const threshold = 50
    if (info.offset.x > threshold && currentCard > 0) {
      setCurrentCard(currentCard - 1)
      setDragDirection('right')
    } else if (info.offset.x < -threshold && currentCard < settingsCards.length - 1) {
      setCurrentCard(currentCard + 1)
      setDragDirection('left')
    }
    setTimeout(() => setDragDirection(null), 300)
  }

  function ProfileCard() {
    return (
      <div className="space-y-6 p-6">
        <div className="text-center mb-6">
          <div className="w-24 h-24 bg-gradient-to-br from-blue-400 to-purple-500 rounded-full mx-auto mb-4 flex items-center justify-center">
            <User className="h-12 w-12 text-white" />
          </div>
          <h2 className="text-2xl font-bold">Sarah Powell</h2>
          <p className="text-gray-600">Product Manager</p>
        </div>
        
        <div className="space-y-4">
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus-within:border-blue-300 transition-colors"
          >
            <label className="text-sm font-medium text-gray-700 block mb-1">Full Name</label>
            <Input 
              defaultValue="Sarah Powell" 
              className="border-0 bg-transparent p-0 text-lg font-medium focus:ring-0" 
            />
          </motion.div>
          
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus-within:border-blue-300 transition-colors"
          >
            <label className="text-sm font-medium text-gray-700 block mb-1">Email</label>
            <Input 
              defaultValue="sarah@innovareai.com" 
              className="border-0 bg-transparent p-0 text-lg font-medium focus:ring-0" 
            />
          </motion.div>
          
          <motion.div
            whileTap={{ scale: 0.98 }}
            className="p-4 bg-gray-50 rounded-2xl border-2 border-transparent focus-within:border-blue-300 transition-colors"
          >
            <label className="text-sm font-medium text-gray-700 block mb-1">Company</label>
            <Input 
              defaultValue="InnovareAI" 
              className="border-0 bg-transparent p-0 text-lg font-medium focus:ring-0" 
            />
          </motion.div>
        </div>
        
        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button className="w-full h-14 text-lg bg-gradient-to-r from-blue-400 to-purple-500 hover:from-blue-500 hover:to-purple-600 rounded-2xl">
            Save Changes
            <ArrowRight className="h-5 w-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    )
  }

  function IntegrationsCard() {
    const integrations = [
      { name: 'LinkedIn', connected: true, icon: LinkedinIcon, color: 'blue', description: 'Professional network sync' },
      { name: 'Unipile', connected: true, icon: Zap, color: 'green', description: 'Multi-platform messaging' },
      { name: 'ActiveCampaign', connected: false, icon: Users, color: 'orange', description: 'Email automation' }
    ]

    return (
      <div className="space-y-4 p-6">
        {integrations.map((integration, index) => (
          <motion.div
            key={integration.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ scale: 1.02, x: 10 }}
            whileTap={{ scale: 0.98 }}
            className={`p-6 rounded-3xl cursor-pointer transition-all duration-300 ${
              integration.connected 
                ? `bg-gradient-to-r from-${integration.color}-50 to-${integration.color}-100 border-2 border-${integration.color}-200` 
                : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
            }`}
          >
            <div className="flex items-center gap-4">
              <div className={`p-4 rounded-2xl ${integration.connected ? `bg-${integration.color}-500` : 'bg-gray-400'}`}>
                <integration.icon className="h-8 w-8 text-white" />
              </div>
              <div className="flex-1">
                <h3 className="text-lg font-semibold">{integration.name}</h3>
                <p className="text-sm text-gray-600">{integration.description}</p>
              </div>
              <div>
                {integration.connected ? (
                  <motion.div
                    initial={{ scale: 0 }}
                    animate={{ scale: 1 }}
                    className="flex items-center gap-2"
                  >
                    <CheckCircle className="h-6 w-6 text-green-500" />
                    <span className="text-sm font-medium text-green-600">Connected</span>
                  </motion.div>
                ) : (
                  <Button size="sm" className="bg-gray-600 hover:bg-gray-700 rounded-full px-6">
                    Connect
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        ))}
      </div>
    )
  }

  function AppearanceCard() {
    const themes = [
      { name: 'Ocean', colors: 'from-blue-400 to-cyan-400' },
      { name: 'Sunset', colors: 'from-orange-400 to-pink-400' },
      { name: 'Forest', colors: 'from-green-400 to-teal-400' },
      { name: 'Galaxy', colors: 'from-purple-400 to-indigo-400' },
      { name: 'Coral', colors: 'from-red-400 to-pink-400' }
    ]

    return (
      <div className="space-y-8 p-6">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-between p-6 bg-gray-50 rounded-3xl"
        >
          <div className="flex items-center gap-4">
            <div className="p-3 bg-gradient-to-r from-gray-600 to-gray-800 rounded-2xl">
              <Palette className="h-6 w-6 text-white" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">Dark Mode</h3>
              <p className="text-sm text-gray-600">Easy on the eyes</p>
            </div>
          </div>
          <motion.div whileTap={{ scale: 0.9 }}>
            <Switch checked={darkMode} onCheckedChange={setDarkMode} />
          </motion.div>
        </motion.div>

        <div>
          <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Sparkles className="h-5 w-5" />
            Color Themes
          </h3>
          <div className="grid grid-cols-2 gap-4">
            {themes.map((theme, index) => (
              <motion.div
                key={theme.name}
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ delay: index * 0.1 }}
                whileHover={{ scale: 1.05, rotate: 2 }}
                whileTap={{ scale: 0.95 }}
                className={`h-24 bg-gradient-to-br ${theme.colors} rounded-3xl cursor-pointer shadow-lg flex items-center justify-center border-4 border-transparent hover:border-white`}
              >
                <span className="text-white font-semibold text-lg drop-shadow-lg">{theme.name}</span>
              </motion.div>
            ))}
          </div>
        </div>
      </div>
    )
  }

  function NotificationsCard() {
    const notificationTypes = [
      { title: 'Push Notifications', desc: 'Instant mobile alerts', icon: Smartphone },
      { title: 'Email Updates', desc: 'Daily digest and reports', icon: Bell },
      { title: 'Touch Feedback', desc: 'Haptic response', icon: Hand }
    ]

    return (
      <div className="space-y-4 p-6">
        {notificationTypes.map((item, index) => (
          <motion.div
            key={item.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1 }}
            whileHover={{ x: 10, backgroundColor: 'rgba(249, 250, 251, 1)' }}
            whileTap={{ scale: 0.98 }}
            className="flex items-center justify-between p-6 rounded-3xl transition-all duration-300 border-2 border-transparent hover:border-gray-200"
          >
            <div className="flex items-center gap-4">
              <div className="p-3 bg-gradient-to-r from-orange-400 to-yellow-500 rounded-2xl">
                <item.icon className="h-6 w-6 text-white" />
              </div>
              <div>
                <h3 className="text-lg font-semibold">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.desc}</p>
              </div>
            </div>
            <motion.div whileTap={{ scale: 0.9 }}>
              <Switch checked={notifications} onCheckedChange={setNotifications} />
            </motion.div>
          </motion.div>
        ))}
      </div>
    )
  }

  function SecurityCard() {
    return (
      <div className="space-y-6 p-6">
        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-6 bg-gradient-to-br from-green-50 to-emerald-50 rounded-3xl border-2 border-green-200"
        >
          <div className="flex items-center gap-3 mb-4">
            <CheckCircle className="h-8 w-8 text-green-500" />
            <h3 className="text-xl font-semibold text-green-800">Security Status</h3>
          </div>
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700">Two-factor authentication</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700">Touch ID enabled</span>
            </div>
            <div className="flex items-center gap-3">
              <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse"></div>
              <span className="text-green-700">Secure cloud sync</span>
            </div>
          </div>
        </motion.div>

        <motion.div
          whileTap={{ scale: 0.98 }}
          className="p-4 bg-gray-50 rounded-3xl border-2 border-transparent focus-within:border-purple-300 transition-colors"
        >
          <label className="text-sm font-medium text-gray-700 block mb-2">Password</label>
          <div className="relative">
            <Input 
              type={showPassword ? 'text' : 'password'} 
              className="border-0 bg-transparent text-lg pr-12 focus:ring-0"
              placeholder="Enter current password"
            />
            <motion.button
              whileTap={{ scale: 0.9 }}
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 p-2 rounded-full hover:bg-gray-200"
            >
              {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
            </motion.button>
          </div>
        </motion.div>

        <motion.div
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
        >
          <Button className="w-full h-14 text-lg bg-gradient-to-r from-purple-400 to-indigo-500 hover:from-purple-500 hover:to-indigo-600 rounded-3xl">
            Update Security
            <Shield className="h-5 w-5 ml-2" />
          </Button>
        </motion.div>
      </div>
    )
  }

  const CurrentCardComponent = settingsCards[currentCard].component

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
            whileHover={{ rotate: 90, scale: 1.1 }}
            transition={{ type: "spring", stiffness: 300 }}
            className="w-16 h-16 bg-gradient-to-r from-blue-400 to-purple-500 rounded-2xl mx-auto mb-4 flex items-center justify-center shadow-lg"
          >
            <Settings className="h-8 w-8 text-white" />
          </motion.div>
          <h1 className="text-2xl font-bold bg-gradient-to-r from-blue-600 to-purple-600 bg-clip-text text-transparent">
            Mobile Settings
          </h1>
          <p className="text-gray-600 text-sm">Kibo UI - Gesture-Driven Interface</p>
        </div>
      </motion.div>

      {/* Main swipeable card container */}
      <div className="max-w-md mx-auto">
        {/* Card indicator dots */}
        <div className="flex justify-center gap-2 mb-6">
          {settingsCards.map((_, index) => (
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
            Swipe left or right to navigate
          </p>
        </motion.div>

        {/* Main swipeable card */}
        <motion.div
          key={currentCard}
          initial={{ opacity: 0, scale: 0.8, rotateY: 90 }}
          animate={{ opacity: 1, scale: 1, rotateY: 0 }}
          exit={{ opacity: 0, scale: 0.8, rotateY: -90 }}
          transition={{ type: "spring", stiffness: 300, damping: 30 }}
          drag="x"
          dragConstraints={{ left: 0, right: 0 }}
          onDragEnd={handleDragEnd}
          whileDrag={{ scale: 1.05, rotate: dragDirection === 'left' ? -5 : dragDirection === 'right' ? 5 : 0 }}
          className="relative"
        >
          <Card className="bg-white/80 backdrop-blur-sm border-0 shadow-2xl rounded-3xl overflow-hidden">
            <CardHeader className={`bg-gradient-to-r ${settingsCards[currentCard].color} text-white p-6`}>
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  {React.createElement(settingsCards[currentCard].icon, { className: "h-8 w-8" })}
                  <div>
                    <CardTitle className="text-xl font-bold">{settingsCards[currentCard].title}</CardTitle>
                    <CardDescription className="text-white/80">
                      Card {currentCard + 1} of {settingsCards.length}
                    </CardDescription>
                  </div>
                </div>
                <Badge variant="secondary" className="bg-white/20 text-white border-white/30">
                  {currentCard + 1}/{settingsCards.length}
                </Badge>
              </div>
            </CardHeader>
            <CardContent className="p-0">
              <CurrentCardComponent />
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
            onClick={() => currentCard < settingsCards.length - 1 && setCurrentCard(currentCard + 1)}
            disabled={currentCard === settingsCards.length - 1}
            className={`p-4 rounded-2xl transition-all ${
              currentCard === settingsCards.length - 1 
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