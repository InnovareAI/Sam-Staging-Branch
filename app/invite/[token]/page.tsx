'use client';

import React, { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { supabase } from '../../lib/supabase';
import { Building2, UserCheck, Clock, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';

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
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary mx-auto mb-4"></div>
          <p className="text-muted-foreground">Loading invitation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
        <div className="container mx-auto px-4">
          <Card className="w-full max-w-md mx-auto">
            <CardHeader className="text-center">
              <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-destructive/10">
                <AlertCircle className="h-8 w-8 text-destructive" />
              </div>
              <CardTitle className="text-2xl">Invalid Invitation</CardTitle>
              <CardDescription>{error}</CardDescription>
            </CardHeader>
            <CardContent className="text-center">
              <Button asChild>
                <a href="/api/auth/signin">Sign In to SAM AI</a>
              </Button>
            </CardContent>
          </Card>
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
    <div className="min-h-screen bg-background text-foreground flex items-center justify-center">
      <div className="container mx-auto px-4">
        <Card className="w-full max-w-lg mx-auto">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-primary">
              <Building2 className="h-8 w-8 text-primary-foreground" />
            </div>
            <CardTitle className="text-2xl">You're Invited!</CardTitle>
            <CardDescription>
              Join <strong>{invite.workspace.name}</strong> on SAM AI
            </CardDescription>
          </CardHeader>
          
          <CardContent className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Invitation Details</CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Workspace:</span>
                  <span className="font-medium">{invite.workspace.name}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Role:</span>
                  <Badge variant="secondary" className="capitalize">{invite.role}</Badge>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Invited by:</span>
                  <span className="font-medium">{inviterName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-muted-foreground">Your email:</span>
                  <span className="font-medium">{invite.email}</span>
                </div>
              </CardContent>
            </Card>

            <Alert>
              <Clock className="h-4 w-4" />
              <AlertDescription>
                Expires in {daysUntilExpiry} day{daysUntilExpiry !== 1 ? 's' : ''} 
                ({expiresAt.toLocaleDateString()})
              </AlertDescription>
            </Alert>

            <div className="space-y-4">
              <Button
                onClick={acceptInvite}
                disabled={accepting}
                className="w-full"
                size="lg"
              >
                {accepting ? (
                  <>
                    <Clock className="mr-2 h-4 w-4 animate-spin" />
                    Accepting...
                  </>
                ) : (
                  <>
                    <UserCheck className="mr-2 h-4 w-4" />
                    Accept Invitation
                  </>
                )}
              </Button>

              <p className="text-center text-sm text-muted-foreground">
                By accepting, you'll create an account or join the workspace if you're already signed in.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}