'use client'

import React, { useState, useEffect, useRef } from 'react'
import { motion, AnimatePresence, useScroll, useTransform, useMotionValue, useSpring } from 'framer-motion'
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
  Waves,
  Heart,
  Star,
  Butterfly,
  Flower
} from 'lucide-react'

export default function SHSFSettingsPage() {
  const [activeTab, setActiveTab] = useState('profile')
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [cursorPosition, setCursorPosition] = useState({ x: 0, y: 0 })
  const [isHovering, setIsHovering] = useState(false)
  
  const containerRef = useRef<HTMLDivElement>(null)
  const { scrollYProgress } = useScroll({ target: containerRef })
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
      {[...Array(6)].map((_, i) => (
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
            opacity: [0, 0.6, 0],
            scale: [0.5, 1.2, 0.5],
            rotate: 360
          }}
          transition={{
            duration: 15 + Math.random() * 10,
            repeat: Infinity,
            ease: "linear"
          }}
        >
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
            className="text-purple-300/30 text-2xl"
          >
            {[<Sparkles />, <Heart />, <Star />, <Butterfly />, <Flower />, <Waves />][i]}
          </motion.div>
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
        className="w-8 h-8 border-2 border-white rounded-full"
        animate={{ 
          scale: isHovering ? 2 : 1,
          borderColor: isHovering ? '#ff6b9d' : '#ffffff'
        }}
        transition={{ type: "spring", stiffness: 300, damping: 30 }}
      />
    </motion.div>
  )

  const tabVariants = {
    inactive: { scale: 1, y: 0, opacity: 0.7 },
    active: { 
      scale: 1.05, 
      y: -2, 
      opacity: 1,
      transition: { type: "spring", stiffness: 300, damping: 25 }
    },
    hover: { 
      scale: 1.02, 
      y: -1,
      transition: { type: "spring", stiffness: 400, damping: 20 }
    }
  }

  const cardVariants = {
    hidden: { opacity: 0, y: 60, rotateX: -15 },
    visible: (i: number) => ({
      opacity: 1,
      y: 0,
      rotateX: 0,
      transition: {
        delay: i * 0.15,
        duration: 0.8,
        type: "spring",
        stiffness: 100,
        damping: 15
      }
    }),
    hover: {
      y: -10,
      rotateX: 5,
      rotateY: 5,
      scale: 1.02,
      boxShadow: "0 25px 50px rgba(139, 69, 19, 0.1)",
      transition: { type: "spring", stiffness: 300, damping: 20 }
    }
  }

  const inputVariants = {
    focus: {
      scale: 1.02,
      boxShadow: "0 0 0 3px rgba(139, 69, 19, 0.1)",
      borderColor: "#8b4513",
      transition: { type: "spring", stiffness: 300, damping: 25 }
    }
  }

  return (
    <div ref={containerRef} className="min-h-screen bg-gradient-to-br from-rose-50 via-pink-50 to-orange-50 relative overflow-hidden">
      <FloatingElements />
      <MotionCursor />
      
      {/* Animated background pattern */}
      <motion.div 
        className="absolute inset-0 opacity-30"
        style={{ y, opacity }}
      >
        <motion.div
          className="absolute top-10 left-10 w-64 h-64 bg-gradient-to-r from-pink-300 to-rose-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.2, 1],
            x: [0, 50, 0],
            y: [0, -30, 0]
          }}
          transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute top-1/2 right-10 w-48 h-48 bg-gradient-to-r from-orange-300 to-yellow-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1.2, 1, 1.2],
            x: [0, -30, 0],
            y: [0, 40, 0]
          }}
          transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
        />
        <motion.div
          className="absolute bottom-20 left-1/3 w-56 h-56 bg-gradient-to-r from-purple-300 to-pink-300 rounded-full blur-3xl"
          animate={{ 
            scale: [1, 1.3, 1],
            rotate: [0, 180, 360]
          }}
          transition={{ duration: 12, repeat: Infinity, ease: "easeInOut" }}
        />
      </motion.div>

      <div className="relative z-10 p-6">
        {/* Motion-first header */}
        <motion.div 
          initial={{ opacity: 0, y: -50, rotateX: -30 }}
          animate={{ opacity: 1, y: 0, rotateX: 0 }}
          transition={{ 
            duration: 1.2, 
            type: "spring", 
            stiffness: 100,
            damping: 20 
          }}
          className="max-w-5xl mx-auto mb-12"
        >
          <motion.div 
            className="bg-white/70 backdrop-blur-xl border border-white/40 rounded-3xl p-8 shadow-2xl"
            whileHover={{ 
              scale: 1.02,
              boxShadow: "0 30px 60px rgba(139, 69, 19, 0.15)",
              borderColor: "rgba(255, 255, 255, 0.6)"
            }}
            transition={{ type: "spring", stiffness: 300, damping: 25 }}
          >
            <div className="flex items-center justify-between">
              <motion.div 
                className="flex items-center gap-6"
                initial={{ x: -30 }}
                animate={{ x: 0 }}
                transition={{ delay: 0.3, type: "spring", stiffness: 200 }}
              >
                <motion.div
                  whileHover={{ 
                    rotate: [0, 10, -10, 0],
                    scale: 1.1
                  }}
                  transition={{ 
                    rotate: { duration: 0.6, type: "spring", stiffness: 300 },
                    scale: { duration: 0.3 }
                  }}
                  className="relative"
                  onHoverStart={() => setIsHovering(true)}
                  onHoverEnd={() => setIsHovering(false)}
                >
                  <div className="w-16 h-16 bg-gradient-to-br from-rose-400 via-pink-500 to-orange-400 rounded-2xl shadow-lg flex items-center justify-center">
                    <Settings className="h-8 w-8 text-white" />
                  </div>
                  <motion.div
                    className="absolute -top-1 -right-1 w-6 h-6 bg-gradient-to-r from-yellow-400 to-orange-400 rounded-full flex items-center justify-center"
                    animate={{ 
                      scale: [1, 1.2, 1],
                      rotate: 360 
                    }}
                    transition={{ 
                      scale: { duration: 2, repeat: Infinity },
                      rotate: { duration: 4, repeat: Infinity, ease: "linear" }
                    }}
                  >
                    <Sparkles className="h-3 w-3 text-white" />
                  </motion.div>
                </motion.div>
                <div>
                  <motion.h1 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.5, duration: 0.8 }}
                    className="text-4xl font-bold bg-gradient-to-r from-rose-600 via-pink-600 to-orange-600 bg-clip-text text-transparent"
                  >
                    Elegant Settings
                  </motion.h1>
                  <motion.p 
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.7, duration: 0.8 }}
                    className="text-rose-700 flex items-center gap-2 text-lg"
                  >
                    <Butterfly className="h-5 w-5" />
                    SHSF UI - Motion-First Micro-Interactions
                  </motion.p>
                </div>
              </motion.div>
              
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ 
                  delay: 0.8,
                  type: "spring",
                  stiffness: 200,
                  damping: 15
                }}
                whileHover={{ 
                  scale: 1.1,
                  rotate: 360 
                }}
              >
                <Badge className="bg-gradient-to-r from-rose-500 to-pink-500 text-white px-6 py-3 text-base font-semibold shadow-lg">
                  <Heart className="h-4 w-4 mr-2" />
                  Premium Experience
                </Badge>
              </motion.div>
            </div>
          </motion.div>
        </motion.div>

        <div className="max-w-5xl mx-auto">
          <Tabs value={activeTab} onValueChange={setActiveTab} className="w-full">
            {/* Motion-enhanced tabs */}
            <motion.div
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.4, duration: 0.8 }}
            >
              <TabsList className="grid w-full grid-cols-5 bg-white/60 backdrop-blur-xl border border-white/40 rounded-2xl p-2 shadow-xl">
                {[
                  { id: 'profile', icon: User, label: 'Profile', color: 'from-blue-400 to-blue-600' },
                  { id: 'integrations', icon: LinkedinIcon, label: 'Integrations', color: 'from-green-400 to-green-600' },
                  { id: 'appearance', icon: Palette, label: 'Appearance', color: 'from-purple-400 to-purple-600' },
                  { id: 'notifications', icon: Bell, label: 'Notifications', color: 'from-orange-400 to-orange-600' },
                  { id: 'security', icon: Shield, label: 'Security', color: 'from-red-400 to-red-600' }
                ].map((tab, index) => (
                  <motion.div key={tab.id} custom={index}>
                    <TabsTrigger 
                      value={tab.id}
                      className="relative w-full h-14 text-gray-700 data-[state=active]:text-white transition-colors duration-300 overflow-hidden rounded-xl"
                      onHoverStart={() => setIsHovering(true)}
                      onHoverEnd={() => setIsHovering(false)}
                    >
                      <motion.div
                        variants={tabVariants}
                        initial="inactive"
                        animate={activeTab === tab.id ? "active" : "inactive"}
                        whileHover="hover"
                        className="flex items-center gap-3 relative z-10"
                      >
                        <motion.div
                          animate={{ rotate: activeTab === tab.id ? 360 : 0 }}
                          transition={{ duration: 0.6, type: "spring", stiffness: 200 }}
                        >
                          <tab.icon className="h-5 w-5" />
                        </motion.div>
                        <span className="hidden sm:inline font-medium">{tab.label}</span>
                      </motion.div>
                      
                      <AnimatePresence>
                        {activeTab === tab.id && (
                          <motion.div
                            layoutId="activeTabBackground"
                            className={`absolute inset-0 bg-gradient-to-r ${tab.color} rounded-xl shadow-lg`}
                            initial={{ opacity: 0, scale: 0.8 }}
                            animate={{ opacity: 1, scale: 1 }}
                            exit={{ opacity: 0, scale: 0.8 }}
                            transition={{ type: "spring", stiffness: 300, damping: 30 }}
                          />
                        )}
                      </AnimatePresence>
                    </TabsTrigger>
                  </motion.div>
                ))}
              </TabsList>
            </motion.div>

            <div className="mt-8 space-y-8">
              {/* Profile Tab */}
              <TabsContent value="profile">
                <div className="grid gap-8 lg:grid-cols-3">
                  <motion.div
                    className="lg:col-span-2"
                    custom={0}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover="hover"
                  >
                    <Card className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl overflow-hidden">
                      <CardHeader className="relative">
                        <motion.div
                          className="absolute inset-0 bg-gradient-to-r from-blue-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500"
                        />
                        <CardTitle className="flex items-center gap-3 text-xl relative z-10">
                          <motion.div
                            whileHover={{ rotate: 360, scale: 1.2 }}
                            transition={{ type: "spring", stiffness: 300 }}
                            className="p-3 bg-gradient-to-r from-blue-400 to-blue-600 rounded-xl shadow-lg"
                          >
                            <User className="h-6 w-6 text-white" />
                          </motion.div>
                          Personal Information
                          <motion.div
                            animate={{ rotate: 360 }}
                            transition={{ duration: 4, repeat: Infinity, ease: "linear" }}
                          >
                            <Sparkles className="h-5 w-5 text-blue-500" />
                          </motion.div>
                        </CardTitle>
                        <CardDescription className="text-gray-600 relative z-10">
                          Your personal details and account preferences
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="space-y-8 relative">
                        <div className="grid gap-6 md:grid-cols-2">
                          {[
                            { label: 'Full Name', value: 'Sarah Powell', icon: User },
                            { label: 'Email Address', value: 'sarah@innovareai.com', icon: User }
                          ].map((field, index) => (
                            <motion.div
                              key={field.label}
                              initial={{ opacity: 0, x: -30 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: 0.1 * index + 0.5, type: "spring", stiffness: 200 }}
                              className="space-y-3"
                            >
                              <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                                <field.icon className="h-4 w-4 text-gray-500" />
                                {field.label}
                              </label>
                              <motion.div
                                variants={inputVariants}
                                whileFocus="focus"
                              >
                                <Input 
                                  defaultValue={field.value}
                                  className="h-12 border-2 border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:bg-white transition-all duration-300"
                                />
                              </motion.div>
                            </motion.div>
                          ))}
                        </div>
                        
                        <motion.div
                          initial={{ opacity: 0, x: -30 }}
                          animate={{ opacity: 1, x: 0 }}
                          transition={{ delay: 0.7, type: "spring", stiffness: 200 }}
                          className="space-y-3"
                        >
                          <label className="text-sm font-medium text-gray-700 flex items-center gap-2">
                            <Users className="h-4 w-4 text-gray-500" />
                            Company
                          </label>
                          <motion.div
                            variants={inputVariants}
                            whileFocus="focus"
                          >
                            <Input 
                              defaultValue="InnovareAI"
                              className="h-12 border-2 border-gray-200 rounded-xl bg-white/70 backdrop-blur-sm focus:bg-white transition-all duration-300"
                            />
                          </motion.div>
                        </motion.div>
                        
                        <motion.div
                          whileHover={{ 
                            scale: 1.05,
                            boxShadow: "0 20px 40px rgba(59, 130, 246, 0.3)"
                          }}
                          whileTap={{ scale: 0.98 }}
                        >
                          <Button className="w-full h-14 bg-gradient-to-r from-blue-400 via-purple-500 to-pink-500 hover:from-blue-500 hover:via-purple-600 hover:to-pink-600 text-white text-lg font-semibold rounded-xl shadow-lg">
                            <motion.div
                              whileHover={{ x: 5 }}
                              className="flex items-center"
                            >
                              Save Changes
                              <ArrowRight className="h-5 w-5 ml-2" />
                            </motion.div>
                          </Button>
                        </motion.div>
                      </CardContent>
                    </Card>
                  </motion.div>

                  <motion.div
                    custom={1}
                    variants={cardVariants}
                    initial="hidden"
                    animate="visible"
                    whileHover="hover"
                  >
                    <Card className="bg-gradient-to-br from-rose-50 to-pink-50 border border-rose-200 shadow-xl rounded-3xl">
                      <CardHeader>
                        <CardTitle className="flex items-center gap-2 text-rose-800">
                          <motion.div
                            animate={{ 
                              scale: [1, 1.2, 1],
                              rotate: [0, 360, 0]
                            }}
                            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                          >
                            <Heart className="h-6 w-6 text-rose-600" />
                          </motion.div>
                          Activity Overview
                        </CardTitle>
                      </CardHeader>
                      <CardContent>
                        <div className="space-y-6">
                          {[
                            { label: 'Profile Views', value: '2,347', trend: '+12%', color: 'rose' },
                            { label: 'Connections', value: '1,456', trend: '+8%', color: 'pink' },
                            { label: 'Messages', value: '892', trend: '+23%', color: 'orange' }
                          ].map((stat, index) => (
                            <motion.div
                              key={stat.label}
                              initial={{ opacity: 0, y: 20 }}
                              animate={{ opacity: 1, y: 0 }}
                              transition={{ delay: 0.2 * index + 0.8 }}
                              whileHover={{ x: 10, scale: 1.05 }}
                              className="flex justify-between items-center p-4 bg-white/60 rounded-2xl cursor-pointer"
                            >
                              <div>
                                <p className="text-sm text-gray-600">{stat.label}</p>
                                <p className="text-xl font-bold text-gray-900">{stat.value}</p>
                              </div>
                              <motion.div
                                animate={{ scale: [1, 1.1, 1] }}
                                transition={{ duration: 2, repeat: Infinity }}
                              >
                                <Badge className={`bg-${stat.color}-100 text-${stat.color}-700 border-${stat.color}-200`}>
                                  {stat.trend}
                                </Badge>
                              </motion.div>
                            </motion.div>
                          ))}
                        </div>
                      </CardContent>
                    </Card>
                  </motion.div>
                </div>
              </TabsContent>

              {/* Other tabs with motion-first design... */}
              {/* For brevity, I'll include just one more tab to demonstrate the pattern */}
              <TabsContent value="integrations">
                <motion.div
                  custom={0}
                  variants={cardVariants}
                  initial="hidden"
                  animate="visible"
                  whileHover="hover"
                >
                  <Card className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl">
                    <CardHeader>
                      <CardTitle className="flex items-center gap-3 text-2xl">
                        <motion.div
                          whileHover={{ 
                            rotate: 360,
                            scale: 1.2
                          }}
                          className="p-3 bg-gradient-to-r from-green-400 to-green-600 rounded-xl shadow-lg"
                        >
                          <LinkedinIcon className="h-8 w-8 text-white" />
                        </motion.div>
                        Connected Services
                        <motion.div
                          animate={{ y: [-5, 5, -5] }}
                          transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                        >
                          <Waves className="h-6 w-6 text-green-500" />
                        </motion.div>
                      </CardTitle>
                    </CardHeader>
                    <CardContent>
                      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                        {[
                          { name: 'LinkedIn Premium', connected: true, icon: LinkedinIcon, color: 'blue' },
                          { name: 'Unipile Platform', connected: true, icon: Zap, color: 'green' },
                          { name: 'ActiveCampaign', connected: false, icon: Users, color: 'orange' }
                        ].map((integration, index) => (
                          <motion.div
                            key={integration.name}
                            initial={{ opacity: 0, y: 50, rotateY: -90 }}
                            animate={{ opacity: 1, y: 0, rotateY: 0 }}
                            transition={{ 
                              delay: index * 0.2,
                              type: "spring",
                              stiffness: 100,
                              damping: 15
                            }}
                            whileHover={{ 
                              y: -15,
                              rotateY: 10,
                              scale: 1.05,
                              boxShadow: "0 25px 50px rgba(0,0,0,0.15)"
                            }}
                            className={`p-8 rounded-3xl cursor-pointer transition-all duration-500 ${
                              integration.connected 
                                ? `bg-gradient-to-br from-${integration.color}-50 to-${integration.color}-100 border-2 border-${integration.color}-200` 
                                : 'bg-gray-50 border-2 border-gray-200 hover:border-gray-300'
                            }`}
                          >
                            <div className="flex items-center justify-between mb-6">
                              <motion.div
                                whileHover={{ rotate: 360 }}
                                transition={{ duration: 0.6 }}
                                className={`p-4 rounded-2xl ${integration.connected ? `bg-${integration.color}-500` : 'bg-gray-400'} shadow-lg`}
                              >
                                <integration.icon className="h-10 w-10 text-white" />
                              </motion.div>
                              {integration.connected ? (
                                <motion.div
                                  initial={{ scale: 0 }}
                                  animate={{ scale: 1 }}
                                  whileHover={{ scale: 1.2, rotate: 360 }}
                                  transition={{ type: "spring", stiffness: 300 }}
                                >
                                  <CheckCircle className="h-8 w-8 text-green-500" />
                                </motion.div>
                              ) : (
                                <motion.div
                                  whileHover={{ scale: 1.1 }}
                                  whileTap={{ scale: 0.9 }}
                                >
                                  <Button className="bg-gradient-to-r from-purple-400 to-pink-500 hover:from-purple-500 hover:to-pink-600 rounded-xl shadow-lg">
                                    Connect
                                  </Button>
                                </motion.div>
                              )}
                            </div>
                            <h3 className="font-bold text-xl mb-2">{integration.name}</h3>
                            <p className="text-gray-600">
                              {integration.connected ? 'Active integration' : 'Click to connect'}
                            </p>
                          </motion.div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                </motion.div>
              </TabsContent>

              {/* Simplified versions of remaining tabs for completeness */}
              <TabsContent value="appearance">
                <Card className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <Palette className="h-8 w-8 text-purple-600" />
                      Theme Customization
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      className="flex items-center justify-between p-6 bg-gradient-to-r from-purple-50 to-pink-50 rounded-2xl"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div>
                        <h3 className="text-lg font-semibold">Elegant Dark Mode</h3>
                        <p className="text-gray-600">Beautiful low-light experience</p>
                      </div>
                      <Switch checked={darkMode} onCheckedChange={setDarkMode} />
                    </motion.div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="notifications">
                <Card className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <Bell className="h-8 w-8 text-orange-600" />
                      Smart Notifications
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <motion.div
                      className="flex items-center justify-between p-6 bg-gradient-to-r from-orange-50 to-yellow-50 rounded-2xl"
                      whileHover={{ scale: 1.02 }}
                    >
                      <div>
                        <h3 className="text-lg font-semibold">Push Notifications</h3>
                        <p className="text-gray-600">Real-time updates and alerts</p>
                      </div>
                      <Switch checked={notifications} onCheckedChange={setNotifications} />
                    </motion.div>
                  </CardContent>
                </Card>
              </TabsContent>

              <TabsContent value="security">
                <Card className="bg-white/70 backdrop-blur-xl border border-white/40 shadow-xl rounded-3xl">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-3 text-2xl">
                      <Shield className="h-8 w-8 text-red-600" />
                      Security Center
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    <div className="space-y-3">
                      <label className="text-sm font-medium text-gray-700">Current Password</label>
                      <div className="relative">
                        <motion.div
                          variants={inputVariants}
                          whileFocus="focus"
                        >
                          <Input 
                            type={showPassword ? 'text' : 'password'} 
                            className="pr-12 h-12 border-2 border-gray-200 rounded-xl bg-white/70"
                          />
                        </motion.div>
                        <motion.button
                          whileHover={{ scale: 1.1 }}
                          whileTap={{ scale: 0.9 }}
                          onClick={() => setShowPassword(!showPassword)}
                          className="absolute right-4 top-1/2 -translate-y-1/2"
                        >
                          {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                        </motion.button>
                      </div>
                    </div>
                    
                    <motion.div
                      whileHover={{ scale: 1.05 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Button className="w-full h-14 bg-gradient-to-r from-red-400 to-pink-500 hover:from-red-500 hover:to-pink-600 text-white rounded-xl">
                        Update Security Settings
                      </Button>
                    </motion.div>
                  </CardContent>
                </Card>
              </TabsContent>
            </div>
          </Tabs>
        </div>
      </div>
    </div>
  )
}