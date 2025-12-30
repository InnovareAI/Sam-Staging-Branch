'use client'

import React, { useState } from 'react'
import { motion } from 'framer-motion'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Palette, 
  Eye, 
  ArrowRight, 
  Sparkles,
  Layers,
  Target,
  Zap,
  Globe
} from 'lucide-react'
import Link from 'next/link'

export default function DemoShowcasePage() {
  const [selectedStyle, setSelectedStyle] = useState('all')

  const designStyles = [
    {
      id: 'blocks',
      name: 'Blocks.mvp-subha.me',
      description: 'Enterprise dashboards with visual depth, gradients, and advanced data visualization',
      color: 'blue',
      features: ['Advanced animations', 'Visual depth', 'Data-rich dashboards', 'Enterprise-grade'],
      preview: '/api/placeholder/400/240'
    },
    {
      id: 'kibo',
      name: 'Kibo UI',
      description: 'Interactive card-based interfaces with swipe gestures and mobile-first design',
      color: 'green',
      features: ['Swipeable cards', 'Gesture-driven', 'Mobile-first', 'Touch interactions'],
      preview: '/api/placeholder/400/240'
    },
    {
      id: 'skiper',
      name: 'Skiper UI',
      description: 'Premium components with advanced hover effects and scroll animations',
      color: 'purple',
      features: ['Hover effects', 'Scroll animations', 'Premium feel', 'Interactive elements'],
      preview: '/api/placeholder/400/240'
    },
    {
      id: 'origin',
      name: 'Origin UI',
      description: 'Clean, minimalist design with high component variety and rapid prototyping focus',
      color: 'orange',
      features: ['Minimalist design', 'High variety', 'Copy-paste ready', 'Clean aesthetics'],
      preview: '/api/placeholder/400/240'
    },
    {
      id: 'shsf',
      name: 'SHSF UI',
      description: 'Motion-first UI with elegant animations and detail-oriented micro-interactions',
      color: 'pink',
      features: ['Motion-first', 'Micro-interactions', 'Detail-oriented', 'Elegant animations'],
      preview: '/api/placeholder/400/240'
    }
  ]

  const demoPages = [
    {
      id: 'settings',
      title: 'Settings Page',
      description: 'User profile, integrations, appearance, notifications, and security settings',
      icon: Palette,
      variants: [
        { style: 'blocks', path: '/demo/settings/blocks', title: 'Enterprise Dashboard Style' },
        { style: 'kibo', path: '/demo/settings/kibo', title: 'Interactive Cards Style' },
        { style: 'skiper', path: '/demo/settings/skiper', title: 'Premium Hover Effects' },
        { style: 'origin', path: '/demo/settings/origin', title: 'Clean Minimalist Style' },
        { style: 'shsf', path: '/demo/settings/shsf', title: 'Motion-First Style' }
      ]
    },
    {
      id: 'admin',
      title: 'Super Admin Dashboard',
      description: 'System monitoring, user management, analytics, and security controls',
      icon: Target,
      variants: [
        { style: 'blocks', path: '/demo/admin/blocks', title: 'Data-Rich Dashboard' },
        { style: 'kibo', path: '/demo/admin/kibo', title: 'Swipeable Admin Cards' },
        { style: 'skiper', path: '/demo/admin/skiper', title: 'Premium Admin Interface' },
        { style: 'origin', path: '/demo/admin/origin', title: 'Clean Admin Panel' },
        { style: 'shsf', path: '/demo/admin/shsf', title: 'Animated Admin Hub' }
      ]
    },
    {
      id: 'campaign',
      title: 'Campaign Hub',
      description: 'Multi-channel campaign management, analytics, templates, and automation',
      icon: Zap,
      variants: [
        { style: 'blocks', path: '/demo/campaign-hub/blocks', title: 'Visual Campaign Analytics' },
        { style: 'kibo', path: '/demo/campaign-hub/kibo', title: 'Interactive Campaign Cards' },
        { style: 'skiper', path: '/demo/campaign-hub/skiper', title: 'Premium Campaign Suite' },
        { style: 'origin', path: '/demo/campaign-hub/origin', title: 'Clean Campaign Manager' },
        { style: 'shsf', path: '/demo/campaign-hub/shsf', title: 'Animated Campaign Flow' }
      ]
    }
  ]

  const filteredPages = selectedStyle === 'all' 
    ? demoPages 
    : demoPages.map(page => ({
        ...page,
        variants: page.variants.filter(variant => variant.style === selectedStyle)
      }))

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-indigo-50 to-purple-50 p-6">
      {/* Header */}
      <motion.div 
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="max-w-7xl mx-auto mb-8"
      >
        <div className="text-center mb-8">
          <h1 className="text-4xl font-semibold bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 bg-clip-text text-transparent mb-4">
            SAM AI Design Showcase
          </h1>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto">
            Explore 5 distinct design approaches for our platform. Each style showcases different philosophies: 
            from enterprise data visualization to motion-first interactions.
          </p>
        </div>

        {/* Style Filter */}
        <div className="flex flex-wrap justify-center gap-3 mb-8">
          <Button
            variant={selectedStyle === 'all' ? 'default' : 'outline'}
            onClick={() => setSelectedStyle('all')}
            className="mb-2"
          >
            <Globe className="h-4 w-4 mr-2" />
            All Styles
          </Button>
          {designStyles.map((style) => (
            <Button
              key={style.id}
              variant={selectedStyle === style.id ? 'default' : 'outline'}
              onClick={() => setSelectedStyle(style.id)}
              className={`mb-2 ${selectedStyle === style.id ? `bg-${style.color}-500 hover:bg-${style.color}-600` : ''}`}
            >
              {style.name}
            </Button>
          ))}
        </div>
      </motion.div>

      <div className="max-w-7xl mx-auto">
        {/* Design Styles Overview */}
        {selectedStyle === 'all' && (
          <motion.section
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="mb-12"
          >
            <h2 className="text-2xl font-semibold text-center mb-8">Design Philosophy Overview</h2>
            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
              {designStyles.map((style, index) => (
                <motion.div
                  key={style.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.5, delay: 0.1 * index }}
                  whileHover={{ y: -5, scale: 1.02 }}
                >
                  <Card className={`bg-gradient-to-br from-${style.color}-50 to-${style.color}-100 border-${style.color}-200 shadow-lg h-full`}>
                    <CardHeader>
                      <CardTitle className={`text-${style.color}-800`}>{style.name}</CardTitle>
                      <CardDescription>{style.description}</CardDescription>
                    </CardHeader>
                    <CardContent>
                      <div className="space-y-2 mb-4">
                        {style.features.map((feature) => (
                          <Badge key={feature} variant="secondary" className={`bg-${style.color}-100 text-${style.color}-700`}>
                            {feature}
                          </Badge>
                        ))}
                      </div>
                      <Button 
                        variant="outline" 
                        size="sm" 
                        onClick={() => setSelectedStyle(style.id)}
                        className={`w-full border-${style.color}-300 hover:bg-${style.color}-50`}
                      >
                        View Examples
                        <ArrowRight className="h-4 w-4 ml-2" />
                      </Button>
                    </CardContent>
                  </Card>
                </motion.div>
              ))}
            </div>
          </motion.section>
        )}

        {/* Demo Pages */}
        <section className="space-y-12">
          {filteredPages.map((page, pageIndex) => (
            <motion.div
              key={page.id}
              initial={{ opacity: 0, y: 30 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 * pageIndex }}
            >
              <div className="text-center mb-6">
                <div className="flex items-center justify-center gap-3 mb-2">
                  <page.icon className="h-6 w-6 text-indigo-600" />
                  <h2 className="text-2xl font-semibold">{page.title}</h2>
                </div>
                <p className="text-slate-600">{page.description}</p>
              </div>

              <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {page.variants.map((variant, variantIndex) => {
                  const styleConfig = designStyles.find(s => s.id === variant.style)
                  
                  return (
                    <motion.div
                      key={`${page.id}-${variant.style}`}
                      initial={{ opacity: 0, scale: 0.9 }}
                      animate={{ opacity: 1, scale: 1 }}
                      transition={{ duration: 0.5, delay: 0.1 * variantIndex }}
                      whileHover={{ 
                        y: -10, 
                        scale: 1.03,
                        boxShadow: "0 20px 25px -5px rgb(0 0 0 / 0.1)"
                      }}
                    >
                      <Card className={`bg-gradient-to-br from-${styleConfig?.color}-50 to-white border-${styleConfig?.color}-200 shadow-lg overflow-hidden group cursor-pointer`}>
                        <div className="aspect-video bg-gradient-to-br from-slate-100 to-slate-200 relative overflow-hidden">
                          {/* Placeholder preview image */}
                          <div className={`absolute inset-0 bg-gradient-to-br from-${styleConfig?.color}-400/20 to-${styleConfig?.color}-600/30 flex items-center justify-center`}>
                            <div className={`p-4 bg-${styleConfig?.color}-500 rounded-full shadow-lg group-hover:scale-110 transition-transform`}>
                              <page.icon className="h-8 w-8 text-white" />
                            </div>
                          </div>
                          
                          {/* Overlay on hover */}
                          <motion.div
                            initial={{ opacity: 0 }}
                            whileHover={{ opacity: 1 }}
                            className="absolute inset-0 bg-black/20 flex items-center justify-center"
                          >
                            <motion.div
                              initial={{ scale: 0.8, opacity: 0 }}
                              whileHover={{ scale: 1, opacity: 1 }}
                              transition={{ delay: 0.1 }}
                            >
                              <Link href={variant.path}>
                                <Button className={`bg-${styleConfig?.color}-500 hover:bg-${styleConfig?.color}-600`}>
                                  <Eye className="h-4 w-4 mr-2" />
                                  Preview
                                </Button>
                              </Link>
                            </motion.div>
                          </motion.div>
                        </div>
                        
                        <CardHeader>
                          <div className="flex items-center justify-between">
                            <Badge className={`bg-${styleConfig?.color}-100 text-${styleConfig?.color}-700`}>
                              {styleConfig?.name}
                            </Badge>
                            <Sparkles className={`h-4 w-4 text-${styleConfig?.color}-500`} />
                          </div>
                          <CardTitle className="text-lg">{variant.title}</CardTitle>
                        </CardHeader>
                        
                        <CardContent>
                          <p className="text-sm text-slate-600 mb-4">
                            Experience {page.title.toLowerCase()} designed with {styleConfig?.name}'s philosophy
                          </p>
                          
                          <div className="flex items-center justify-between">
                            <div className="flex gap-2">
                              {styleConfig?.features.slice(0, 2).map((feature) => (
                                <Badge key={feature} variant="outline" className="text-xs">
                                  {feature}
                                </Badge>
                              ))}
                            </div>
                            
                            <Link href={variant.path}>
                              <Button 
                                size="sm" 
                                className={`bg-${styleConfig?.color}-500 hover:bg-${styleConfig?.color}-600`}
                              >
                                View Demo
                                <ArrowRight className="h-4 w-4 ml-1" />
                              </Button>
                            </Link>
                          </div>
                        </CardContent>
                      </Card>
                    </motion.div>
                  )
                })}
              </div>
            </motion.div>
          ))}
        </section>

        {/* Call to Action */}
        <motion.section
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.5 }}
          className="text-center py-12"
        >
          <Card className="bg-gradient-to-br from-indigo-50 to-purple-50 border-indigo-200 shadow-xl max-w-2xl mx-auto">
            <CardContent className="p-8">
              <Sparkles className="h-12 w-12 text-indigo-600 mx-auto mb-4" />
              <h3 className="text-2xl font-semibold mb-4">Choose Your Design Direction</h3>
              <p className="text-slate-600 mb-6">
                Each design approach offers unique advantages. Explore the demos above to find the perfect 
                style for SAM AI's professional B2B platform.
              </p>
              <div className="flex justify-center gap-4">
                <Button className="bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-600 hover:to-purple-700">
                  <Layers className="h-4 w-4 mr-2" />
                  Compare All Styles
                </Button>
                <Button variant="outline">
                  <Target className="h-4 w-4 mr-2" />
                  Implementation Guide
                </Button>
              </div>
            </CardContent>
          </Card>
        </motion.section>
      </div>
    </div>
  )
}