'use client';

import { useEffect, useState, Suspense } from 'react';
import { createClient } from '@supabase/supabase-js';
import { useRouter, useSearchParams } from 'next/navigation';

function AuthCallbackContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [message, setMessage] = useState('');

  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      // Handle the auth callback
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setStatus('error');
        setMessage('Authentication failed: ' + error.message);
        return;
      }

      if (!data.session) {
        // No session yet, try to exchange the code
        const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(window.location.href);
        
        if (exchangeError) {
          setStatus('error');
          setMessage('Failed to complete authentication: ' + exchangeError.message);
          return;
        }
      }

      const { data: { session } } = await supabase.auth.getSession();
      
      if (session?.user) {
        const user = session.user;
        
        // Check if user has invitation metadata
        const organizationId = user.user_metadata?.organization_id;
        const organizationName = user.user_metadata?.organization_name;
        const role = user.user_metadata?.role || 'member';

        // Create or update user profile
        const { error: profileError } = await supabase
          .from('users')
          .upsert({
            id: user.id,
            email: user.email,
            first_name: user.user_metadata?.first_name || '',
            last_name: user.user_metadata?.last_name || '',
            created_at: new Date().toISOString()
          });

        if (profileError) {
          console.error('Profile creation error:', profileError);
        }

        // If invited to an organization, add them to it
        if (organizationId) {
          try {
            // Add to user_organizations
            await supabase
              .from('user_organizations')
              .insert({
                user_id: user.id,
                organization_id: organizationId,
                role: role
              });

            // Create or find workspace for organization
            let { data: workspace } = await supabase
              .from('workspaces')
              .select('*')
              .eq('owner_id', user.id)
              .single();

            if (!workspace) {
              const { data: newWorkspace } = await supabase
                .from('workspaces')
                .insert({
                  name: `${organizationName} Workspace`,
                  owner_id: user.id,
                  created_by: user.id,
                  settings: {}
                })
                .select()
                .single();
              
              workspace = newWorkspace;
            }

            if (workspace) {
              // Add to workspace members
              await supabase
                .from('workspace_members')
                .insert({
                  workspace_id: workspace.id,
                  user_id: user.id,
                  role: role === 'owner' ? 'admin' : 'member'
                });

              // Update user's current workspace
              await supabase
                .from('users')
                .update({ current_workspace_id: workspace.id })
                .eq('id', user.id);
            }

            setStatus('success');
            setMessage(`Welcome to ${organizationName}! Your account has been set up successfully.`);
            
            // Redirect to main app after 3 seconds
            setTimeout(() => {
              router.push('/');
            }, 3000);

          } catch (orgError) {
            console.error('Organization setup error:', orgError);
            setStatus('success'); // Still success, just no org assignment
            setMessage('Account created successfully! You can now access the platform.');
            setTimeout(() => router.push('/'), 3000);
          }
        } else {
          // No organization invitation, regular signup
          setStatus('success');
          setMessage('Account verified successfully! You can now access the platform.');
          setTimeout(() => router.push('/'), 3000);
        }
      } else {
        setStatus('error');
        setMessage('No user session found. Please try signing in again.');
      }

    } catch (error) {
      console.error('Callback handling error:', error);
      setStatus('error');
      setMessage('An unexpected error occurred. Please try again.');
    }
  };

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="max-w-md w-full bg-white p-8 rounded-lg shadow-lg text-center">
        {status === 'loading' && (
          <>
            <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600 mx-auto mb-6"></div>
            <h2 className="text-2xl font-bold text-gray-800 mb-4">Setting up your account...</h2>
            <p className="text-gray-600">Please wait while we complete your registration.</p>
          </>
        )}

        {status === 'success' && (
          <>
            <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-green-800 mb-4">🎉 Welcome to SAM AI!</h2>
            <p className="text-gray-600 mb-4">{message}</p>
            <p className="text-sm text-gray-500">Redirecting you to the platform...</p>
          </>
        )}

        {status === 'error' && (
          <>
            <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
              <svg className="w-8 h-8 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </div>
            <h2 className="text-2xl font-bold text-red-800 mb-4">Authentication Error</h2>
            <p className="text-gray-600 mb-6">{message}</p>
            <button
              onClick={() => router.push('/signin')}
              className="bg-purple-600 text-white px-6 py-2 rounded-lg hover:bg-purple-700"
            >
              Try Again
            </button>
          </>
        )}
      </div>
    </div>
  );
}

export default function AuthCallbackPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-gray-100 flex items-center justify-center">
        <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-purple-600"></div>
      </div>
    }>
      <AuthCallbackContent />
    </Suspense>
  );
}