'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Shield } from 'lucide-react'
import { motion } from 'framer-motion'

interface PlanSelectorProps {
  onPlanSelected: (plan: 'startup' | 'sme') => void
  showEuBadge?: boolean
}

export default function PlanSelector({ onPlanSelected, showEuBadge }: PlanSelectorProps) {
  return (
    <div className="w-full max-w-5xl">
      <div className="text-center mb-8">
        <h2 className="text-4xl font-bold mb-3 bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
          Choose Your Plan
        </h2>
        <p className="text-slate-600 text-lg">14-day free trial • Cancel anytime</p>
        {showEuBadge && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-4"
          >
            <Badge className="bg-blue-100 text-blue-700 px-4 py-2 text-sm">
              <Shield className="h-4 w-4 mr-2 inline" />
              🇪🇺 EU Customer - DPA signature required before payment setup
            </Badge>
          </motion.div>
        )}
      </div>

      <div className="grid md:grid-cols-2 gap-6">
        {/* Startup Plan */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="border-2 hover:border-indigo-500 transition-all duration-300 hover:shadow-xl h-full">
            <CardHeader className="space-y-4">
              <div>
                <CardTitle className="text-2xl">Startup</CardTitle>
                <p className="text-slate-500 text-sm mt-1">Perfect for small teams</p>
              </div>
              <div className="text-5xl font-bold">
                $99
                <span className="text-2xl text-slate-600 font-normal">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Up to 5 team members</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>1,000 prospects/month</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>LinkedIn + Email campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>AI-powered messaging</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Basic analytics</span>
                </li>
              </ul>
              <Button
                className="w-full bg-slate-900 hover:bg-slate-800"
                size="lg"
                onClick={() => onPlanSelected('startup')}
              >
                Start 14-Day Trial
              </Button>
            </CardContent>
          </Card>
        </motion.div>

        {/* SME Plan */}
        <motion.div
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="border-2 border-indigo-500 shadow-xl hover:shadow-2xl transition-all duration-300 h-full bg-gradient-to-br from-white to-indigo-50/30">
            <CardHeader className="space-y-4">
              <div>
                <Badge className="mb-3 bg-indigo-600 hover:bg-indigo-700">
                  Most Popular
                </Badge>
                <CardTitle className="text-2xl">SME</CardTitle>
                <p className="text-slate-500 text-sm mt-1">For growing businesses</p>
              </div>
              <div className="text-5xl font-bold text-indigo-600">
                $399
                <span className="text-2xl text-slate-600 font-normal">/month</span>
              </div>
            </CardHeader>
            <CardContent className="space-y-6">
              <ul className="space-y-4">
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>Unlimited team members</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span><strong>5,000 prospects/month</strong></span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>LinkedIn + Email campaigns</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Advanced AI features</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Advanced analytics & reporting</span>
                </li>
                <li className="flex items-start gap-3">
                  <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                  <span>Priority support</span>
                </li>
              </ul>
              <Button
                className="w-full bg-indigo-600 hover:bg-indigo-700"
                size="lg"
                onClick={() => onPlanSelected('sme')}
              >
                Start 14-Day Trial
              </Button>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      <p className="text-center text-sm text-slate-500 mt-6">
        💳 Payment method required • No charge for 14 days • Cancel anytime
      </p>
    </div>
  )
}
