'use client';

import { useEffect, useState, Suspense } from 'react';
import { useSearchParams, useRouter } from 'next/navigation';
import { createBrowserClient } from '@supabase/ssr';
import { Check, AlertCircle, Slack, ArrowRight, Loader2 } from 'lucide-react';

/**
 * /slack/connect
 *
 * Landing page for users who installed SAM from the Slack App Directory.
 *
 * Flow:
 * 1. User installs SAM from Slack App Directory
 * 2. OAuth callback stores pending installation and redirects here
 * 3. This page shows:
 *    - If logged in: Select workspace to link Slack to
 *    - If not logged in: Login/signup options
 * 4. After linking, redirect to workspace settings
 */

function SlackConnectContent() {
  const searchParams = useSearchParams();
  const router = useRouter();

  const teamId = searchParams.get('team_id');
  const teamName = searchParams.get('team_name');
  const success = searchParams.get('success');
  const error = searchParams.get('error');

  const [user, setUser] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [workspaces, setWorkspaces] = useState<any[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<string>('');
  const [linking, setLinking] = useState(false);
  const [linkError, setLinkError] = useState<string | null>(null);

  const supabase = createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

  useEffect(() => {
    async function checkAuth() {
      const { data: { user } } = await supabase.auth.getUser();
      setUser(user);

      if (user) {
        // Fetch user's workspaces
        const { data: memberships } = await supabase
          .from('workspace_members')
          .select('workspace_id, workspaces(id, name)')
          .eq('user_id', user.id);

        if (memberships) {
          const ws = memberships.map((m: any) => ({
            id: m.workspace_id,
            name: m.workspaces?.name || 'Unknown Workspace'
          }));
          setWorkspaces(ws);
          if (ws.length === 1) {
            setSelectedWorkspace(ws[0].id);
          }
        }
      }

      setLoading(false);
    }

    checkAuth();
  }, []);

  const handleLink = async () => {
    if (!selectedWorkspace || !teamId) return;

    setLinking(true);
    setLinkError(null);

    try {
      const res = await fetch('/api/integrations/slack/link-pending', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          slack_team_id: teamId,
          workspace_id: selectedWorkspace,
        }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to link Slack workspace');
      }

      // Redirect to workspace settings with success
      router.push(`/workspace/${selectedWorkspace}/settings?slack_success=true&team_name=${encodeURIComponent(teamName || '')}`);
    } catch (err: any) {
      setLinkError(err.message);
      setLinking(false);
    }
  };

  const handleLogin = () => {
    // Store the slack connection info in sessionStorage for after login
    if (teamId && teamName) {
      sessionStorage.setItem('slack_pending_connection', JSON.stringify({ teamId, teamName }));
    }
    router.push('/login');
  };

  const handleSignup = () => {
    if (teamId && teamName) {
      sessionStorage.setItem('slack_pending_connection', JSON.stringify({ teamId, teamName }));
    }
    router.push('/signup');
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  // Error state
  if (error) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center">
          <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
            <AlertCircle className="h-8 w-8 text-red-500" />
          </div>
          <h1 className="text-xl font-bold mb-2">Connection Failed</h1>
          <p className="text-muted-foreground mb-6">
            {error === 'access_denied'
              ? 'You cancelled the Slack authorization.'
              : `Error: ${error}`}
          </p>
          <button
            onClick={() => router.push('/')}
            className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90"
          >
            Go to Home
          </button>
        </div>
      </div>
    );
  }

  // Success state - Slack installed, now link to SAM
  if (success && teamId) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-card border rounded-xl p-8">
          {/* Success Header */}
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="h-8 w-8 text-green-500" />
            </div>
            <h1 className="text-xl font-bold mb-2">SAM Installed in Slack!</h1>
            <p className="text-muted-foreground">
              {teamName ? (
                <>Connected to <strong>{teamName}</strong></>
              ) : (
                'Slack workspace connected'
              )}
            </p>
          </div>

          {/* If logged in, show workspace selector */}
          {user ? (
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-2">
                  Select SAM Workspace to Link
                </label>
                {workspaces.length === 0 ? (
                  <p className="text-sm text-muted-foreground bg-muted/50 p-3 rounded-lg">
                    You don't have any SAM workspaces yet. Create one first.
                  </p>
                ) : workspaces.length === 1 ? (
                  <div className="bg-muted/50 p-3 rounded-lg flex items-center gap-3">
                    <Slack className="h-5 w-5 text-purple-500" />
                    <span className="font-medium">{workspaces[0].name}</span>
                  </div>
                ) : (
                  <select
                    value={selectedWorkspace}
                    onChange={(e) => setSelectedWorkspace(e.target.value)}
                    className="w-full bg-muted/50 border rounded-lg p-3"
                  >
                    <option value="">Select a workspace...</option>
                    {workspaces.map((ws) => (
                      <option key={ws.id} value={ws.id}>{ws.name}</option>
                    ))}
                  </select>
                )}
              </div>

              {linkError && (
                <div className="bg-red-500/10 text-red-500 p-3 rounded-lg text-sm">
                  {linkError}
                </div>
              )}

              <button
                onClick={handleLink}
                disabled={!selectedWorkspace || linking}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {linking ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Linking...
                  </>
                ) : (
                  <>
                    Link to SAM
                    <ArrowRight className="h-4 w-4" />
                  </>
                )}
              </button>
            </div>
          ) : (
            /* Not logged in - show login/signup options */
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground text-center">
                Sign in or create an account to complete the Slack connection.
              </p>

              <button
                onClick={handleLogin}
                className="w-full bg-primary text-primary-foreground py-3 rounded-lg font-medium hover:opacity-90 flex items-center justify-center gap-2"
              >
                Sign In
                <ArrowRight className="h-4 w-4" />
              </button>

              <button
                onClick={handleSignup}
                className="w-full bg-muted text-foreground py-3 rounded-lg font-medium hover:bg-muted/80"
              >
                Create Account
              </button>

              <p className="text-xs text-muted-foreground text-center">
                Your Slack connection will be saved for 24 hours.
              </p>
            </div>
          )}
        </div>
      </div>
    );
  }

  // Default state - no Slack connection in progress
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-card border rounded-xl p-8 text-center">
        <div className="w-16 h-16 bg-purple-500/10 rounded-full flex items-center justify-center mx-auto mb-4">
          <Slack className="h-8 w-8 text-purple-500" />
        </div>
        <h1 className="text-xl font-bold mb-2">Connect SAM to Slack</h1>
        <p className="text-muted-foreground mb-6">
          Install the SAM app in your Slack workspace to receive campaign updates and interact with SAM directly.
        </p>
        <a
          href={`https://slack.com/oauth/v2/authorize?client_id=${process.env.NEXT_PUBLIC_SLACK_CLIENT_ID}&scope=channels:read,chat:write,commands,users:read&redirect_uri=${encodeURIComponent('https://app.meet-sam.com/api/integrations/slack/oauth-callback')}&state=slack_direct`}
          className="w-full bg-[#4A154B] text-white py-3 rounded-lg font-medium hover:opacity-90 inline-flex items-center justify-center gap-2"
        >
          <Slack className="h-5 w-5" />
          Add to Slack
        </a>
      </div>
    </div>
  );
}

function LoadingFallback() {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
    </div>
  );
}

export default function SlackConnectPage() {
  return (
    <Suspense fallback={<LoadingFallback />}>
      <SlackConnectContent />
    </Suspense>
  );
}
