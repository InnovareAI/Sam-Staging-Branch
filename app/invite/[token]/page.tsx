'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Building2, UserCheck, Clock, AlertCircle } from 'lucide-react';

interface InviteData {
  id: string;
  email: string;
  role: string;
  workspace: {
    name: string;
  };
  invited_by: {
    first_name?: string;
    last_name?: string;
    email: string;
  };
  expires_at: string;
  accepted_at?: string;
}

export default function InviteAcceptPage() {
  const params = useParams();
  const router = useRouter();
  const [invite, setInvite] = useState<InviteData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [accepting, setAccepting] = useState(false);

  useEffect(() => {
    if (params.token) {
      loadInvite(params.token as string);
    }
  }, [params.token]);

  const loadInvite = async (token: string) => {
    try {
      const { data, error } = await supabase
        .from('workspace_invites')
        .select(`
          *,
          workspaces!workspace_invites_workspace_id_fkey (name),
          users!workspace_invites_invited_by_fkey (first_name, last_name, email)
        `)
        .eq('token', token)
        .single();

      if (error || !data) {
        setError('Invalid or expired invitation');
        return;
      }

      // Check if expired
      if (new Date(data.expires_at) < new Date()) {
        setError('This invitation has expired');
        return;
      }

      // Check if already accepted
      if (data.accepted_at) {
        setError('This invitation has already been accepted');
        return;
      }

      setInvite({
        ...data,
        workspace: data.workspaces,
        invited_by: data.users
      });

    } catch (err) {
      console.error('Failed to load invite:', err);
      setError('Failed to load invitation');
    } finally {
      setLoading(false);
    }
  };

  const acceptInvite = async () => {
    if (!invite) return;

    setAccepting(true);
    try {
      // Check if user is already signed in
      const { data: { user } } = await supabase.auth.getUser();
      
      if (!user) {
        // Redirect to signup with invite context
        const signupUrl = new URL('/api/auth/signup', window.location.origin);
        signupUrl.searchParams.set('invite_token', params.token as string);
        signupUrl.searchParams.set('email', invite.email);
        window.location.href = signupUrl.toString();
        return;
      }

      // User is signed in, accept the invite directly
      const response = await fetch('/api/invites/accept', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ token: params.token })
      });

      if (response.ok) {
        router.push('/settings?tab=workspaces&accepted=true');
      } else {
        const errorData = await response.json();
        setError(errorData.error || 'Failed to accept invitation');
      }

    } catch (err) {
      console.error('Failed to accept invite:', err);
      setError('Failed to accept invitation');
    } finally {
      setAccepting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center">
          <Clock className="animate-spin mx-auto mb-4" size={48} />
          <p>Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
        <div className="text-center max-w-md mx-auto px-6">
          <AlertCircle className="mx-auto mb-4 text-red-500" size={64} />
          <h1 className="text-2xl font-bold mb-4">Invalid Invitation</h1>
          <p className="text-gray-400 mb-6">{error}</p>
          <a 
            href="/api/auth/signin"
            className="bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-lg inline-block transition-colors"
          >
            Sign In to SAM AI
          </a>
        </div>
      </div>
    );
  }

  if (!invite) return null;

  const inviterName = `${invite.invited_by.first_name || ''} ${invite.invited_by.last_name || ''}`.trim() || invite.invited_by.email;
  const expiresAt = new Date(invite.expires_at);
  const timeUntilExpiry = expiresAt.getTime() - Date.now();
  const daysUntilExpiry = Math.ceil(timeUntilExpiry / (1000 * 60 * 60 * 24));

  return (
    <div className="min-h-screen bg-gray-900 text-white flex items-center justify-center">
      <div className="max-w-lg mx-auto px-6">
        <div className="bg-gray-800 rounded-lg p-8 shadow-xl">
          <div className="text-center mb-8">
            <div className="bg-purple-600 rounded-full p-4 w-20 h-20 mx-auto mb-4 flex items-center justify-center">
              <Building2 size={32} />
            </div>
            <h1 className="text-2xl font-bold mb-2">You're Invited!</h1>
            <p className="text-gray-400">
              Join <strong>{invite.workspace.name}</strong> on SAM AI
            </p>
          </div>

          <div className="space-y-6">
            <div className="bg-gray-700 rounded-lg p-4">
              <h3 className="font-semibold mb-2">Invitation Details</h3>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-gray-400">Workspace:</span>
                  <span>{invite.workspace.name}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Role:</span>
                  <span className="capitalize">{invite.role}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Invited by:</span>
                  <span>{inviterName}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-400">Your email:</span>
                  <span>{invite.email}</span>
                </div>
              </div>
            </div>

            <div className="bg-yellow-900/20 border border-yellow-600 rounded-lg p-4">
              <div className="flex items-center">
                <Clock className="mr-2 text-yellow-500" size={16} />
                <span className="text-yellow-200 text-sm">
                  Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} 
                  ({expiresAt.toLocaleDateString()})
                </span>
              </div>
            </div>

            <div className="space-y-3">
              <button
                onClick={acceptInvite}
                disabled={accepting}
                className="w-full bg-green-600 hover:bg-green-700 disabled:bg-green-700 disabled:opacity-50 text-white py-3 px-6 rounded-lg font-semibold transition-colors flex items-center justify-center"
              >
                {accepting ? (
                  <>
                    <Clock className="animate-spin mr-2" size={16} />
                    Accepting...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2" size={16} />
                    Accept Invitation
                  </>
                )}
              </button>

              <p className="text-center text-sm text-gray-400">
                By accepting, you'll create an account or join the workspace if you're already signed in.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}