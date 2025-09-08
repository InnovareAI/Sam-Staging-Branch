'use client';

import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth, useUser } from '@clerk/nextjs';
import Image from 'next/image';

interface InvitationPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default function InvitationPage({ params }: InvitationPageProps) {
  const [token, setToken] = useState<string>('');
  
  useEffect(() => {
    params.then(p => setToken(p.token));
  }, [params]);
  const router = useRouter();
  const { isSignedIn, userId } = useAuth();
  const { user } = useUser();
  const [isLoading, setIsLoading] = useState(true);
  const [invitation, setInvitation] = useState<any>(null);
  const [error, setError] = useState<string>('');
  const [isJoining, setIsJoining] = useState(false);

  useEffect(() => {
    if (!token) return;
    if (isSignedIn && userId) {
      // User is signed in, attempt to join workspace
      handleAcceptInvitation();
    } else {
      // User is not signed in, show invitation details and sign-in prompt
      fetchInvitationDetails();
    }
  }, [isSignedIn, userId, token]);

  const fetchInvitationDetails = async () => {
    try {
      // For now, we'll show a generic invitation page
      // In a full implementation, you'd fetch invitation details from the token
      setIsLoading(false);
    } catch (error) {
      setError('Failed to load invitation details');
      setIsLoading(false);
    }
  };

  const handleAcceptInvitation = async () => {
    setIsJoining(true);
    try {
      const response = await fetch('/api/workspaces/join', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          invite_token: token,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Failed to join workspace');
      }

      if (data.success) {
        // Successfully joined workspace, redirect to main app
        router.push('/');
      } else {
        throw new Error(data.error || 'Failed to join workspace');
      }
    } catch (error) {
      console.error('Error joining workspace:', error);
      setError(error instanceof Error ? error.message : 'Failed to join workspace');
    } finally {
      setIsJoining(false);
    }
  };

  const handleSignIn = () => {
    // Redirect to sign-in with the invitation token preserved
    router.push(`/sign-in?redirect_url=${encodeURIComponent(`/invite/${token}`)}`);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-white text-xl">Loading invitation...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="text-center">
          <div className="text-red-400 text-xl mb-4">⚠️ Invitation Error</div>
          <div className="text-gray-300 mb-8">{error}</div>
          <button
            onClick={() => router.push('/')}
            className="bg-purple-600 hover:bg-purple-700 text-white font-medium py-2 px-6 rounded-lg"
          >
            Go to SAM AI
          </button>
        </div>
      </div>
    );
  }

  if (!isSignedIn) {
    return (
      <div className="min-h-screen bg-gray-900 flex items-center justify-center">
        <div className="max-w-md w-full mx-4">
          <div className="text-center">
            <Image 
              src="/SAM.jpg" 
              alt="SAM AI" 
              width={100}
              height={100}
              className="rounded-full mx-auto mb-6 object-cover"
              style={{ objectPosition: 'center 30%' }}
            />
            <h1 className="text-3xl font-bold text-white mb-2">You're Invited!</h1>
            <p className="text-gray-400 mb-8">
              You've been invited to join a SAM AI workspace. Sign in to accept the invitation and start collaborating.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={handleSignIn}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-medium py-3 px-6 rounded-lg transition-colors"
              >
                Sign In to Accept Invitation
              </button>
              
              <div className="text-center text-sm text-gray-400">
                Don't have an account?{' '}
                <button
                  onClick={() => router.push(`/sign-up?redirect_url=${encodeURIComponent(`/invite/${token}`)}`)}
                  className="text-purple-400 hover:text-purple-300"
                >
                  Sign up here
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // User is signed in and joining workspace
  return (
    <div className="min-h-screen bg-gray-900 flex items-center justify-center">
      <div className="text-center">
        <Image 
          src="/SAM.jpg" 
          alt="SAM AI" 
          width={100}
          height={100}
          className="rounded-full mx-auto mb-6 object-cover"
          style={{ objectPosition: 'center 30%' }}
        />
        <h1 className="text-3xl font-bold text-white mb-2">
          {isJoining ? 'Joining Workspace...' : 'Welcome!'}
        </h1>
        <p className="text-gray-400 mb-8">
          {isJoining 
            ? 'Please wait while we add you to the workspace.'
            : `Hi ${user?.firstName || user?.username}, you're being added to the workspace.`
          }
        </p>
        
        {isJoining && (
          <div className="flex justify-center space-x-1">
            <div className="w-2 h-2 bg-purple-400 rounded-full animate-pulse"></div>
            <div className="w-2 h-2 bg-purple-500 rounded-full animate-pulse" style={{animationDelay: '0.2s'}}></div>
            <div className="w-2 h-2 bg-purple-600 rounded-full animate-pulse" style={{animationDelay: '0.4s'}}></div>
          </div>
        )}
      </div>
    </div>
  );
}