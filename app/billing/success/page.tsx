'use client';

import React, { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';
import { Check, Loader2, AlertCircle } from 'lucide-react';

export default function BillingSuccessPage() {
  const [loading, setLoading] = useState(true);
  const [subscription, setSubscription] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const supabase = createClientComponentClient();

  useEffect(() => {
    const verifySubscription = async () => {
      if (!sessionId) {
        setError('Missing session ID');
        setLoading(false);
        return;
      }

      try {
        // Get current user
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          setError('Please log in to view subscription details');
          setLoading(false);
          return;
        }

        // Fetch subscription details - the webhook should have processed this by now
        const { data: workspaceSubscriptions, error: subError } = await supabase
          .from('workspace_subscriptions')
          .select(`
            *,
            workspaces (
              name,
              slug
            ),
            workspace_tiers (
              tier_type
            )
          `)
          .eq('status', 'active')
          .order('created_at', { ascending: false })
          .limit(1);

        if (subError) {
          console.error('Error fetching subscription:', subError);
          setError('Failed to verify subscription');
          setLoading(false);
          return;
        }

        if (workspaceSubscriptions && workspaceSubscriptions.length > 0) {
          setSubscription(workspaceSubscriptions[0]);
        } else {
          // Subscription might still be processing
          setError('Subscription is being processed. Please check back in a few minutes.');
        }

      } catch (err) {
        console.error('Subscription verification error:', err);
        setError('Failed to verify subscription');
      } finally {
        setLoading(false);
      }
    };

    verifySubscription();
  }, [sessionId, supabase]);

  const formatTierName = (tierType: string) => {
    switch (tierType) {
      case 'startup': return 'Startup';
      case 'sme': return 'SME';
      case 'enterprise': return 'Enterprise';
      default: return tierType;
    }
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-12 w-12 text-purple-500 animate-spin mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-2">Processing Your Subscription</h2>
          <p className="text-gray-400">Please wait while we set up your account...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full bg-gray-800 border border-gray-700 rounded-xl p-8 text-center">
          <AlertCircle className="h-16 w-16 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-2xl font-bold text-white mb-4">Subscription Processing</h2>
          <p className="text-gray-300 mb-6">{error}</p>
          <a 
            href="/billing" 
            className="inline-flex items-center px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg transition-colors"
          >
            Check Billing Status
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-900 py-12">
      <div className="max-w-3xl mx-auto px-4">
        <div className="bg-gray-800 border border-gray-700 rounded-xl p-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-white" />
            </div>
            <h1 className="text-3xl font-bold text-white mb-2">
              Subscription Activated!
            </h1>
            <p className="text-gray-400">
              Your SAM AI subscription has been successfully set up.
            </p>
          </div>

          {subscription && (
            <>
              {/* Subscription Details */}
              <div className="bg-gray-700 rounded-lg p-6 mb-6">
                <h3 className="text-lg font-semibold text-white mb-4">Subscription Details</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                  <div>
                    <span className="text-gray-400">Workspace:</span>
                    <span className="text-white ml-2">{subscription.workspaces?.name}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Plan:</span>
                    <span className="text-white ml-2">{formatTierName(subscription.workspace_tiers?.tier_type || subscription.tier_type)}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Status:</span>
                    <span className="text-green-400 ml-2 capitalize">{subscription.status}</span>
                  </div>
                  <div>
                    <span className="text-gray-400">Billing Period:</span>
                    <span className="text-white ml-2">
                      {formatDate(subscription.current_period_start)} - {formatDate(subscription.current_period_end)}
                    </span>
                  </div>
                  {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                    <div className="md:col-span-2">
                      <span className="text-gray-400">Trial Ends:</span>
                      <span className="text-yellow-400 ml-2">{formatDate(subscription.trial_end)}</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Trial Information */}
              {subscription.trial_end && new Date(subscription.trial_end) > new Date() && (
                <div className="bg-yellow-900/20 border border-yellow-500/30 rounded-lg p-4 mb-6">
                  <div className="flex items-start">
                    <AlertCircle className="h-5 w-5 text-yellow-400 mr-3 mt-0.5" />
                    <div>
                      <h4 className="text-yellow-400 font-medium mb-1">Free Trial Active</h4>
                      <p className="text-yellow-300 text-sm">
                        You're currently in your 14-day free trial. You won't be charged until {formatDate(subscription.trial_end)}.
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Next Steps */}
              <div className="bg-purple-900/20 border border-purple-500/30 rounded-lg p-6">
                <h3 className="text-lg font-semibold text-white mb-4">What's Next?</h3>
                <ul className="space-y-3 text-gray-300">
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-400 mr-3 mt-0.5" />
                    <span>Your workspace has been upgraded to the {formatTierName(subscription.workspace_tiers?.tier_type || subscription.tier_type)} plan</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-400 mr-3 mt-0.5" />
                    <span>All premium features are now available in your workspace</span>
                  </li>
                  <li className="flex items-start">
                    <Check className="h-5 w-5 text-green-400 mr-3 mt-0.5" />
                    <span>You can start creating campaigns and accessing advanced analytics</span>
                  </li>
                </ul>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-4 mt-8">
                <a 
                  href="/campaign-hub" 
                  className="flex-1 bg-purple-600 hover:bg-purple-700 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  Go to Campaign Hub
                </a>
                <a 
                  href="/billing" 
                  className="flex-1 bg-gray-700 hover:bg-gray-600 text-white text-center py-3 px-6 rounded-lg font-medium transition-colors"
                >
                  View Billing Details
                </a>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}