'use client';

import React, { useState, useEffect } from 'react';
import { loadStripe } from '@stripe/stripe-js';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { CreditCard, Loader2, Check, X, ArrowRight } from 'lucide-react';

// Initialize Stripe
const stripePromise = loadStripe(process.env.NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY!);

interface PricingTier {
  id: 'startup' | 'sme' | 'enterprise';
  name: string;
  price: number;
  priceId: string; // Stripe price ID
  features: string[];
  limits: {
    linkedin_daily: number;
    email_daily: number;
    contacts: number;
    campaigns: number;
  };
  popular?: boolean;
}

const PRICING_TIERS: PricingTier[] = [
  {
    id: 'startup',
    name: 'Startup',
    price: 99,
    priceId: process.env.NEXT_PUBLIC_STRIPE_STARTUP_PRICE_ID!,
    features: [
      'Unipile LinkedIn & Email Integration',
      'Basic SAM AI Personalization',
      'Email-based HITL Approval',
      'Standard Analytics',
      'Community Support'
    ],
    limits: {
      linkedin_daily: 50,
      email_daily: 200,
      contacts: 2000,
      campaigns: 5
    }
  },
  {
    id: 'sme',
    name: 'SME',
    price: 399,
    priceId: process.env.NEXT_PUBLIC_STRIPE_SME_PRICE_ID!,
    features: [
      'Multi-Channel Setup (ReachInbox + Unipile)',
      'Advanced SAM AI Personalization',
      'A/B Testing & Analytics',
      'Priority Support',
      'Custom Workflows',
      'Advanced HITL Workflows'
    ],
    limits: {
      linkedin_daily: 200,
      email_daily: 2000,
      contacts: 10000,
      campaigns: 20
    },
    popular: true
  },
  {
    id: 'enterprise',
    name: 'Enterprise',
    price: 899,
    priceId: process.env.NEXT_PUBLIC_STRIPE_ENTERPRISE_PRICE_ID!,
    features: [
      'Premium Multi-Channel Setup',
      'Premium SAM AI with Custom Training',
      'Unlimited A/B Testing',
      'Dedicated Account Manager',
      'Custom MCP Integrations',
      'White-Glove Onboarding',
      'Advanced Analytics & Reporting'
    ],
    limits: {
      linkedin_daily: 500,
      email_daily: 5000,
      contacts: 30000,
      campaigns: 100
    }
  }
];

interface StripeCheckoutProps {
  workspaceId: string;
  currentTier?: 'startup' | 'sme' | 'enterprise';
  onSubscriptionSuccess?: () => void;
}

export default function StripeCheckout({ 
  workspaceId, 
  currentTier, 
  onSubscriptionSuccess 
}: StripeCheckoutProps) {
  const [selectedTier, setSelectedTier] = useState<PricingTier['id']>(currentTier || 'startup');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [user, setUser] = useState<any>(null);
  
  const supabase = createClientComponentClient();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);
    };
    getUser();
  }, [supabase]);

  const handleSubscribe = async (tier: PricingTier) => {
    if (!user) {
      setError('Please log in to subscribe');
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Create Stripe checkout session
      const response = await fetch('/api/billing/create-checkout-session', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          priceId: tier.priceId,
          workspaceId,
          tierType: tier.id,
          userId: user.id,
          successUrl: `${window.location.origin}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
          cancelUrl: `${window.location.origin}/billing?cancelled=true`
        }),
      });

      const session = await response.json();

      if (!response.ok) {
        throw new Error(session.error || 'Failed to create checkout session');
      }

      // Redirect to Stripe Checkout
      const stripe = await stripePromise;
      if (!stripe) {
        throw new Error('Stripe failed to load');
      }

      const result = await stripe.redirectToCheckout({
        sessionId: session.sessionId,
      });

      if (result.error) {
        throw new Error(result.error.message);
      }

    } catch (err) {
      console.error('Subscription error:', err);
      setError(err instanceof Error ? err.message : 'Failed to start subscription');
    } finally {
      setLoading(false);
    }
  };

  const formatPrice = (price: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
    }).format(price);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="text-center mb-12">
        <h2 className="text-3xl font-bold text-white mb-4">
          Choose Your SAM AI Plan
        </h2>
        <p className="text-gray-400 text-lg max-w-2xl mx-auto">
          Scale your outreach with our multi-tenant campaign orchestration platform. 
          All plans include workspace isolation and tenant-specific integrations.
        </p>
      </div>

      {error && (
        <div className="bg-red-900/20 border border-red-500 rounded-lg p-4 mb-6 flex items-center">
          <X className="h-5 w-5 text-red-400 mr-2" />
          <span className="text-red-400">{error}</span>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
        {PRICING_TIERS.map((tier) => {
          const isCurrentTier = currentTier === tier.id;
          const isSelected = selectedTier === tier.id;
          
          return (
            <div
              key={tier.id}
              className={`relative bg-gray-800 border rounded-xl p-6 transition-all duration-300 ${
                tier.popular
                  ? 'border-purple-500 bg-purple-900/20'
                  : 'border-gray-700 hover:border-gray-600'
              } ${isSelected ? 'ring-2 ring-purple-500' : ''}`}
            >
              {tier.popular && (
                <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                  <span className="bg-purple-600 text-white px-3 py-1 rounded-full text-sm font-medium">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrentTier && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-green-600 text-white px-3 py-1 rounded-full text-sm font-medium flex items-center">
                    <Check className="h-3 w-3 mr-1" />
                    Current Plan
                  </span>
                </div>
              )}

              <div className="text-center mb-6">
                <h3 className="text-xl font-bold text-white mb-2">{tier.name}</h3>
                <div className="text-3xl font-bold text-white mb-1">
                  {formatPrice(tier.price)}
                  <span className="text-lg font-normal text-gray-400">/month</span>
                </div>
                <p className="text-gray-400 text-sm">Per workspace</p>
              </div>

              <div className="space-y-4 mb-6">
                <div className="text-sm text-gray-300">
                  <h4 className="font-semibold mb-2">Usage Limits:</h4>
                  <ul className="space-y-1">
                    <li>• {tier.limits.linkedin_daily} LinkedIn messages/day</li>
                    <li>• {tier.limits.email_daily} emails/day</li>
                    <li>• {tier.limits.contacts.toLocaleString()} contacts</li>
                    <li>• {tier.limits.campaigns} active campaigns</li>
                  </ul>
                </div>

                <div className="text-sm text-gray-300">
                  <h4 className="font-semibold mb-2">Features:</h4>
                  <ul className="space-y-2">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-start">
                        <Check className="h-4 w-4 text-green-400 mr-2 mt-0.5 flex-shrink-0" />
                        <span>{feature}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                onClick={() => {
                  if (!isCurrentTier) {
                    setSelectedTier(tier.id);
                    handleSubscribe(tier);
                  }
                }}
                disabled={loading || isCurrentTier}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-all duration-300 flex items-center justify-center ${
                  isCurrentTier
                    ? 'bg-green-600 text-white cursor-default'
                    : tier.popular
                    ? 'bg-purple-600 hover:bg-purple-700 text-white'
                    : 'bg-gray-700 hover:bg-gray-600 text-white'
                } ${loading && isSelected ? 'opacity-50 cursor-not-allowed' : ''}`}
              >
                {loading && isSelected ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : isCurrentTier ? (
                  <>
                    <Check className="h-4 w-4 mr-2" />
                    Current Plan
                  </>
                ) : (
                  <>
                    {currentTier ? 'Upgrade' : 'Subscribe'}
                    <ArrowRight className="h-4 w-4 ml-2" />
                  </>
                )}
              </button>
            </div>
          );
        })}
      </div>

      <div className="mt-12 text-center">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-6 max-w-4xl mx-auto">
          <h3 className="text-xl font-bold text-white mb-4">Multi-Tenant Architecture Benefits</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 text-sm text-gray-300">
            <div className="text-center">
              <CreditCard className="h-8 w-8 text-purple-400 mx-auto mb-2" />
              <h4 className="font-semibold mb-1">Tenant Isolation</h4>
              <p>Complete data separation with dedicated Unipile instances per workspace</p>
            </div>
            <div className="text-center">
              <Check className="h-8 w-8 text-green-400 mx-auto mb-2" />
              <h4 className="font-semibold mb-1">GDPR Compliant</h4>
              <p>EU-region deployment with enhanced data protection measures</p>
            </div>
            <div className="text-center">
              <ArrowRight className="h-8 w-8 text-blue-400 mx-auto mb-2" />
              <h4 className="font-semibold mb-1">Scalable Infrastructure</h4>
              <p>Shared N8N funnel with workspace routing for cost efficiency</p>
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 text-center text-sm text-gray-400">
        <p>All plans include a 14-day free trial. Cancel anytime. No setup fees.</p>
        <p className="mt-2">
          Need custom integrations or enterprise features? 
          <a href="/contact" className="text-purple-400 hover:text-purple-300 ml-1">
            Contact our sales team
          </a>
        </p>
      </div>
    </div>
  );
}