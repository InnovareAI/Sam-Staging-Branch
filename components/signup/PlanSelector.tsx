'use client'

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { CheckCircle, Shield, Sparkles } from 'lucide-react'
import { motion } from 'framer-motion'

interface PlanSelectorProps {
  onPlanSelected: (plan: 'perseat' | 'sme') => void
  showEuBadge?: boolean
}

export default function PlanSelector({ onPlanSelected, showEuBadge }: PlanSelectorProps) {
  const plans = [
    {
      id: 'perseat' as const,
      name: 'Startup Plan',
      description: 'Perfect for solo entrepreneurs & early stage startups',
      originalPrice: 199,
      price: 99,
      period: '/seat/month',
      showDiscount: true,
      discountText: 'Save $100/month',
      popular: true,
      features: [
        { text: '2,000 AI enrichments/month', highlight: true, subtext: 'per seat' },
        { text: '2,000 sent messages/month', highlight: true, subtext: 'per seat' },
        { text: 'Unlimited contact uploads', highlight: false, subtext: 'LinkedIn and/or Email' },
        { text: 'AI-powered messaging', highlight: false },
        { text: 'CRM integration sync', highlight: false },
      ],
      cta: 'Start 14-Day Trial',
      buttonClass: 'bg-[#8907FF] hover:bg-[#6600FF]'
    },
    {
      id: 'sme' as const,
      name: 'SME Plan',
      description: 'For growing companies and SME sales teams',
      originalPrice: 499,
      price: 349,
      period: '/month',
      showDiscount: true,
      discountText: 'Save $150/month',
      popular: false,
      features: [
        { text: '5,000 AI enrichments/month', highlight: true, subtext: 'shared across team' },
        { text: '5,000 sent messages/month', highlight: true, subtext: 'across 2 accounts' },
        { text: 'Unlimited contact uploads', highlight: false, subtext: 'LinkedIn and/or Email' },
        { text: 'Advanced AI features', highlight: false },
        { text: 'CRM integration sync', highlight: false },
        { text: 'Advanced analytics & reporting', highlight: false },
        { text: 'Priority support', highlight: false },
      ],
      cta: 'Start 14-Day Trial',
      buttonClass: 'bg-[#8907FF] hover:bg-[#6600FF]'
    }
  ]

  return (
    <div className="w-full max-w-6xl">
      {/* Header Section */}
      <div className="text-center mb-12">
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.4 }}
        >
          <h2 className="text-5xl font-bold mb-4 text-[#111827]">
            Choose Your Plan
          </h2>
          <p className="text-gray-600 text-lg mb-6">
            Start your 14-day free trial today
          </p>

          {/* Trust Indicators - Moved to top */}
          <div className="flex items-center justify-center gap-6 text-sm">
            <div className="flex items-center gap-2 text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>No charge for 14 days</span>
            </div>
            <div className="flex items-center gap-2 text-gray-700">
              <CheckCircle className="h-5 w-5 text-green-600" />
              <span>Cancel anytime</span>
            </div>
          </div>
        </motion.div>

        {showEuBadge && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            className="mt-6"
          >
            <Badge className="bg-blue-100 text-blue-700 px-4 py-2 text-sm">
              <Shield className="h-4 w-4 mr-2 inline" />
              🇪🇺 EU Customer - DPA signature required before payment setup
            </Badge>
          </motion.div>
        )}
      </div>

      {/* Pricing Cards */}
      <div className="grid md:grid-cols-2 gap-8 mb-8">
        {plans.map((plan, index) => (
          <motion.div
            key={plan.id}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.1, duration: 0.4 }}
            className="relative"
          >
            {/* Popular Badge - Floating above card */}
            {plan.popular && (
              <div className="absolute -top-4 left-1/2 -translate-x-1/2 z-10">
                <Badge className="bg-gradient-to-r from-[#8907FF] to-[#6600FF] text-white px-6 py-2 text-sm font-semibold shadow-lg">
                  <Sparkles className="h-4 w-4 mr-2 inline" />
                  Most Popular
                </Badge>
              </div>
            )}

            <Card className={`
              relative overflow-hidden transition-all duration-300 h-full bg-white
              ${plan.popular
                ? 'border-2 border-[#8907FF] shadow-2xl scale-105'
                : 'border border-gray-200 shadow-lg hover:shadow-xl hover:border-[#8907FF]'
              }
            `}>
              {/* Discount badge - Top right corner */}
              {plan.showDiscount && (
                <div className="absolute top-4 right-4">
                  <Badge className="bg-green-500 text-white px-3 py-1 text-xs font-bold shadow-md">
                    LIMITED TIME
                  </Badge>
                </div>
              )}

              <CardHeader className="pb-8 pt-10">
                {/* Plan Name & Description */}
                <div className="mb-6">
                  <CardTitle className="text-3xl font-bold text-[#111827] mb-2">
                    {plan.name}
                  </CardTitle>
                  <p className="text-gray-600 text-base">
                    {plan.description}
                  </p>
                </div>

                {/* Pricing Display */}
                <div className="space-y-3">
                  {plan.showDiscount && (
                    <div className="flex items-center gap-3">
                      <span className="text-3xl font-bold text-gray-400 line-through">
                        ${plan.originalPrice}
                      </span>
                      <Badge className="bg-green-100 text-green-700 px-3 py-1 text-xs">
                        {plan.discountText}
                      </Badge>
                    </div>
                  )}

                  <div className="flex items-baseline gap-2">
                    <span className="text-6xl font-bold text-[#8907FF]">
                      ${plan.price}
                    </span>
                    <span className="text-xl text-gray-600 font-medium">
                      {plan.period}
                    </span>
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6 px-6 pb-8">
                {/* Features List */}
                <ul className="space-y-4 mb-8">
                  {plan.features.map((feature, idx) => (
                    <li key={idx} className="flex items-start gap-3">
                      <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />
                      <div className="flex-1">
                        <span className={feature.highlight ? 'font-semibold text-[#111827]' : 'text-gray-700'}>
                          {feature.text}
                        </span>
                        {feature.subtext && (
                          <span className="text-gray-500 text-sm ml-1">
                            ({feature.subtext})
                          </span>
                        )}
                      </div>
                    </li>
                  ))}
                </ul>

                {/* CTA Button */}
                <Button
                  className={`w-full text-white text-lg py-6 font-semibold shadow-lg transition-all duration-200 ${plan.buttonClass}`}
                  onClick={() => onPlanSelected(plan.id)}
                >
                  {plan.cta}
                </Button>
              </CardContent>
            </Card>
          </motion.div>
        ))}
      </div>

      {/* Bottom Trust Message */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.4 }}
        className="text-center"
      >
        <div className="inline-flex items-center gap-2 bg-gray-50 px-6 py-3 rounded-full border border-gray-200">
          <Shield className="h-4 w-4 text-gray-600" />
          <p className="text-sm text-gray-700">
            <strong>Secure checkout</strong> • Payment method required • No charge until trial ends
          </p>
        </div>
      </motion.div>
    </div>
  )
}
