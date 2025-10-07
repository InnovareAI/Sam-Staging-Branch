# IMMEDIATE OAUTH FIXES - Action Plan

**Priority**: P0 - CRITICAL
**Estimated Time**: 2-4 hours
**Must Complete Before**: End of day (user is waiting)

---

## Fix #1: Add OAuth Attempt Logging (30 minutes)

### Create Tracking Table

```sql
-- File: supabase/migrations/YYYYMMDD_add_oauth_attempt_tracking.sql

CREATE TABLE IF NOT EXISTS oauth_attempts (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID REFERENCES auth.users(id),
  workspace_id UUID,
  provider VARCHAR(50) NOT NULL, -- 'google', 'microsoft', 'linkedin'
  flow_type VARCHAR(50) NOT NULL, -- 'hosted-auth', 'connect-email', 'callback'
  status VARCHAR(50) NOT NULL DEFAULT 'initiated', -- 'initiated', 'redirected', 'callback_received', 'success', 'failed', 'expired'
  unipile_account_id VARCHAR(255),
  oauth_url TEXT,
  callback_url TEXT,
  error_message TEXT,
  error_stack TEXT,
  request_data JSONB,
  response_data JSONB,
  initiated_at TIMESTAMPTZ DEFAULT NOW(),
  callback_received_at TIMESTAMPTZ,
  completed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Add indexes for common queries
CREATE INDEX idx_oauth_attempts_user_id ON oauth_attempts(user_id);
CREATE INDEX idx_oauth_attempts_workspace_id ON oauth_attempts(workspace_id);
CREATE INDEX idx_oauth_attempts_status ON oauth_attempts(status);
CREATE INDEX idx_oauth_attempts_created_at ON oauth_attempts(created_at DESC);

-- RLS policies
ALTER TABLE oauth_attempts ENABLE ROW LEVEL SECURITY;

-- Users can see their own OAuth attempts
CREATE POLICY "Users can view own oauth attempts"
  ON oauth_attempts
  FOR SELECT
  USING (auth.uid() = user_id);

-- Service role can insert/update
CREATE POLICY "Service role can manage oauth attempts"
  ON oauth_attempts
  FOR ALL
  USING (auth.role() = 'service_role');

COMMENT ON TABLE oauth_attempts IS 'Tracks all OAuth connection attempts for debugging and monitoring';
```

### Add Tracking Helper Function

```typescript
// File: lib/services/oauth-tracking.ts

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export interface OAuthAttempt {
  user_id: string;
  workspace_id: string | null;
  provider: 'google' | 'microsoft' | 'linkedin';
  flow_type: 'hosted-auth' | 'connect-email' | 'callback';
  status: 'initiated' | 'redirected' | 'callback_received' | 'success' | 'failed' | 'expired';
  unipile_account_id?: string;
  oauth_url?: string;
  callback_url?: string;
  error_message?: string;
  error_stack?: string;
  request_data?: any;
  response_data?: any;
}

export async function trackOAuthAttempt(attempt: Partial<OAuthAttempt>) {
  try {
    const { data, error } = await supabase
      .from('oauth_attempts')
      .insert({
        ...attempt,
        updated_at: new Date().toISOString()
      })
      .select()
      .single();

    if (error) {
      console.error('Failed to track OAuth attempt:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception tracking OAuth attempt:', err);
    return null;
  }
}

export async function updateOAuthAttempt(attemptId: string, updates: Partial<OAuthAttempt>) {
  try {
    const { data, error } = await supabase
      .from('oauth_attempts')
      .update({
        ...updates,
        updated_at: new Date().toISOString()
      })
      .eq('id', attemptId)
      .select()
      .single();

    if (error) {
      console.error('Failed to update OAuth attempt:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception updating OAuth attempt:', err);
    return null;
  }
}

export async function getOAuthAttempt(filters: {
  user_id?: string;
  unipile_account_id?: string;
  status?: string;
}) {
  try {
    let query = supabase.from('oauth_attempts').select('*');

    if (filters.user_id) query = query.eq('user_id', filters.user_id);
    if (filters.unipile_account_id) query = query.eq('unipile_account_id', filters.unipile_account_id);
    if (filters.status) query = query.eq('status', filters.status);

    const { data, error } = await query.order('created_at', { ascending: false }).limit(1).single();

    if (error) {
      console.error('Failed to get OAuth attempt:', error);
      return null;
    }

    return data;
  } catch (err) {
    console.error('Exception getting OAuth attempt:', err);
    return null;
  }
}
```

---

## Fix #2: Fix Provider Mapping Bug (15 minutes)

### Update `/app/api/unipile/callback/route.ts`

```typescript
// Line 101: BEFORE (BROKEN)
provider: accountData.type === 'GMAIL' ? 'google' : 'microsoft',

// Line 101: AFTER (FIXED)
provider: getProviderFromUnipileType(accountData.type),

// Add helper function at top of file
function getProviderFromUnipileType(unipileType: string): 'google' | 'microsoft' | 'unknown' {
  const type = (unipileType || '').toUpperCase();

  if (type.includes('GOOGLE') || type === 'GMAIL') {
    return 'google';
  }

  if (type.includes('MICROSOFT') || type.includes('OUTLOOK')) {
    return 'microsoft';
  }

  console.warn(`Unknown Unipile type: ${unipileType}, defaulting to microsoft`);
  return 'microsoft';
}
```

---

## Fix #3: Add Error Notifications (45 minutes)

### Create Notification Service

```typescript
// File: lib/services/oauth-notifications.ts

import { Resend } from 'resend';

const resend = new Resend(process.env.RESEND_API_KEY);
const ADMIN_EMAIL = process.env.ADMIN_EMAIL || 'tl@innovareai.com';

export interface OAuthFailureNotification {
  user_email: string;
  user_id: string;
  workspace_id: string;
  provider: string;
  error_message: string;
  error_stack?: string;
  unipile_account_id?: string;
  timestamp: string;
}

export async function notifyAdminOAuthFailure(notification: OAuthFailureNotification) {
  try {
    await resend.emails.send({
      from: 'SAM AI System <noreply@meet-sam.com>',
      to: [ADMIN_EMAIL],
      subject: `🚨 OAuth Connection Failed - ${notification.provider} for ${notification.user_email}`,
      html: `
        <h2>OAuth Connection Failed</h2>
        <p>A user attempted to connect their ${notification.provider} account but the connection failed.</p>

        <h3>User Details</h3>
        <ul>
          <li><strong>Email:</strong> ${notification.user_email}</li>
          <li><strong>User ID:</strong> ${notification.user_id}</li>
          <li><strong>Workspace ID:</strong> ${notification.workspace_id}</li>
          <li><strong>Provider:</strong> ${notification.provider}</li>
          <li><strong>Timestamp:</strong> ${notification.timestamp}</li>
        </ul>

        <h3>Error Details</h3>
        <p><strong>Error Message:</strong> ${notification.error_message}</p>
        ${notification.unipile_account_id ? `<p><strong>Unipile Account ID:</strong> ${notification.unipile_account_id}</p>` : ''}

        ${notification.error_stack ? `
          <h3>Stack Trace</h3>
          <pre>${notification.error_stack}</pre>
        ` : ''}

        <h3>Action Required</h3>
        <p>Please investigate this failure and contact the user to help them reconnect.</p>

        <p>
          <a href="https://app.meet-sam.com/admin/oauth-debugger?user_id=${notification.user_id}"
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            View OAuth Debugger
          </a>
        </p>
      `,
    });

    console.log(`✅ Admin notified of OAuth failure for ${notification.user_email}`);
  } catch (error) {
    console.error('Failed to send admin notification:', error);
  }
}

export async function notifyUserOAuthFailure(userEmail: string, provider: string, errorMessage: string) {
  try {
    await resend.emails.send({
      from: 'SAM AI Support <support@meet-sam.com>',
      to: [userEmail],
      subject: `Action Required: ${provider} Connection Failed`,
      html: `
        <h2>Connection Issue with Your ${provider} Account</h2>
        <p>Hi there,</p>
        <p>We encountered an issue connecting your ${provider} account to SAM AI.</p>

        <h3>What happened?</h3>
        <p>${errorMessage}</p>

        <h3>What should you do?</h3>
        <p>Please try connecting your account again. If the issue persists, contact our support team.</p>

        <p>
          <a href="https://app.meet-sam.com/settings?tab=integrations"
             style="background-color: #3b82f6; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; display: inline-block;">
            Try Again
          </a>
        </p>

        <p>Need help? Reply to this email or reach out to our support team.</p>

        <p>Best regards,<br>SAM AI Team</p>
      `,
    });

    console.log(`✅ User notified of OAuth failure: ${userEmail}`);
  } catch (error) {
    console.error('Failed to send user notification:', error);
  }
}
```

---

## Fix #4: Update Callback Endpoints (60 minutes)

### Update `/app/api/unipile/callback/route.ts`

```typescript
import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { trackOAuthAttempt, updateOAuthAttempt } from '@/lib/services/oauth-tracking';
import { notifyAdminOAuthFailure, notifyUserOAuthFailure } from '@/lib/services/oauth-notifications';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function getProviderFromUnipileType(unipileType: string): 'google' | 'microsoft' | 'unknown' {
  const type = (unipileType || '').toUpperCase();
  if (type.includes('GOOGLE') || type === 'GMAIL') return 'google';
  if (type.includes('MICROSOFT') || type.includes('OUTLOOK')) return 'microsoft';
  console.warn(`Unknown Unipile type: ${unipileType}`);
  return 'unknown' as any;
}

/**
 * GET /api/unipile/callback
 * Handle Unipile OAuth callback for email connections
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now();
  let attemptId: string | null = null;

  try {
    const { searchParams } = new URL(request.url);
    const accountId = searchParams.get('account_id');
    const status = searchParams.get('status');
    const error = searchParams.get('error');
    const userContext = searchParams.get('user_context'); // NEW: Get user context

    console.log('🔄 Unipile callback received:', { accountId, status, error, userContext });

    // Parse user context if available
    let userId: string | null = null;
    let workspaceId: string | null = null;
    let userEmail: string | null = null;

    if (userContext) {
      try {
        const context = JSON.parse(decodeURIComponent(userContext));
        userId = context.user_id;
        workspaceId = context.workspace_id;
        userEmail = context.user_email;
      } catch (parseError) {
        console.error('Failed to parse user context:', parseError);
      }
    }

    // Track callback received
    if (userId) {
      const attempt = await trackOAuthAttempt({
        user_id: userId,
        workspace_id: workspaceId || undefined,
        provider: 'google', // Will update after we fetch account details
        flow_type: 'callback',
        status: 'callback_received',
        unipile_account_id: accountId || undefined,
        callback_url: request.url,
      });
      attemptId = attempt?.id || null;
    }

    if (error || status !== 'success') {
      console.error('❌ Unipile OAuth failed:', error);

      // Track failure
      if (attemptId) {
        await updateOAuthAttempt(attemptId, {
          status: 'failed',
          error_message: error || 'OAuth status not success',
          completed_at: new Date().toISOString()
        });
      }

      // Notify admin and user
      if (userId && userEmail) {
        await notifyAdminOAuthFailure({
          user_email: userEmail,
          user_id: userId,
          workspace_id: workspaceId || 'unknown',
          provider: 'email',
          error_message: error || 'OAuth failed',
          unipile_account_id: accountId || undefined,
          timestamp: new Date().toISOString()
        });

        await notifyUserOAuthFailure(
          userEmail,
          'Email',
          error || 'Authentication failed. Please try again.'
        );
      }

      // Redirect to frontend with error
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?tab=integrations&error=oauth_failed&message=${encodeURIComponent(error || 'Authentication failed')}`
      );
    }

    if (!accountId) {
      console.error('❌ No account ID in Unipile callback');

      if (attemptId) {
        await updateOAuthAttempt(attemptId, {
          status: 'failed',
          error_message: 'No account ID received from Unipile',
          completed_at: new Date().toISOString()
        });
      }

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?tab=integrations&error=missing_account&message=No account ID received`
      );
    }

    // Get account details from Unipile
    const unipileApiKey = process.env.UNIPILE_API_KEY;
    const unipileBaseUrl = process.env.UNIPILE_BASE_URL || 'https://api.unipile.com';

    const accountResponse = await fetch(`${unipileBaseUrl}/v1/accounts/${accountId}`, {
      headers: {
        'X-API-Key': unipileApiKey!,
      },
    });

    if (!accountResponse.ok) {
      console.error('❌ Failed to fetch account details from Unipile');

      const errorText = await accountResponse.text();

      if (attemptId) {
        await updateOAuthAttempt(attemptId, {
          status: 'failed',
          error_message: `Unipile API error: ${accountResponse.status} - ${errorText}`,
          completed_at: new Date().toISOString()
        });
      }

      if (userId && userEmail) {
        await notifyAdminOAuthFailure({
          user_email: userEmail,
          user_id: userId,
          workspace_id: workspaceId || 'unknown',
          provider: 'email',
          error_message: `Failed to fetch account from Unipile: ${accountResponse.status}`,
          unipile_account_id: accountId,
          timestamp: new Date().toISOString()
        });
      }

      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?tab=integrations&error=account_fetch_failed`
      );
    }

    const accountData = await accountResponse.json();
    const provider = getProviderFromUnipileType(accountData.type);

    console.log('📧 Unipile account connected:', {
      id: accountData.id,
      email: accountData.connection_params?.mail?.username,
      type: accountData.type,
      status: accountData.status,
      provider
    });

    // Update attempt with correct provider
    if (attemptId) {
      await updateOAuthAttempt(attemptId, {
        provider: provider,
        response_data: accountData
      });
    }

    // Store email account in workspace_accounts
    try {
      // Extract email from account data
      const email = accountData.connection_params?.mail?.username ||
                    accountData.connection_params?.email ||
                    accountData.email;

      if (!email) {
        throw new Error('No email found in account connection parameters');
      }

      // If we don't have user context, try to find user by email
      if (!userId) {
        const { data: userData } = await supabase.auth.admin.listUsers();
        const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

        if (user) {
          userId = user.id;
          userEmail = user.email || null;

          // Get user's workspace
          const { data: userProfile } = await supabase
            .from('users')
            .select('current_workspace_id')
            .eq('id', user.id)
            .single();

          workspaceId = userProfile?.current_workspace_id;
        } else {
          throw new Error(`No user found with email: ${email}`);
        }
      }

      if (!workspaceId) {
        throw new Error('No workspace ID available for user');
      }

      // Store in workspace_accounts
      const { error: dbError } = await supabase
        .from('workspace_accounts')
        .upsert({
          workspace_id: workspaceId,
          user_id: userId,
          account_type: 'email',
          account_identifier: email,
          account_name: email,
          unipile_account_id: accountData.id,
          connection_status: 'connected',
          is_active: true,
          account_metadata: {
            platform: accountData.type,
            provider: provider,
            unipile_data: accountData,
            connected_at: new Date().toISOString()
          }
        }, {
          onConflict: 'workspace_id,user_id,account_type,account_identifier'
        });

      if (dbError) {
        throw new Error(`Database error: ${dbError.message}`);
      }

      console.log('✅ Stored email account in workspace_accounts');

      // Track success
      if (attemptId) {
        await updateOAuthAttempt(attemptId, {
          status: 'success',
          completed_at: new Date().toISOString()
        });
      }

      console.log(`✅ ${accountData.type} account connected successfully: ${email} (took ${Date.now() - startTime}ms)`);

      // Redirect to frontend with success
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?tab=integrations&success=email_connected&email=${encodeURIComponent(email)}&provider=${provider}`
      );

    } catch (dbError) {
      console.error('❌ Database connection error:', dbError);

      // Track failure
      if (attemptId) {
        await updateOAuthAttempt(attemptId, {
          status: 'failed',
          error_message: dbError instanceof Error ? dbError.message : 'Database error',
          error_stack: dbError instanceof Error ? dbError.stack : undefined,
          completed_at: new Date().toISOString()
        });
      }

      // Notify admin and user
      if (userId && userEmail) {
        await notifyAdminOAuthFailure({
          user_email: userEmail,
          user_id: userId,
          workspace_id: workspaceId || 'unknown',
          provider: provider,
          error_message: dbError instanceof Error ? dbError.message : 'Database error',
          error_stack: dbError instanceof Error ? dbError.stack : undefined,
          unipile_account_id: accountId,
          timestamp: new Date().toISOString()
        });

        await notifyUserOAuthFailure(
          userEmail,
          provider === 'google' ? 'Google' : 'Microsoft',
          'Failed to save your account connection. Our team has been notified.'
        );
      }

      // CRITICAL: FAIL THE FLOW instead of silent success
      return NextResponse.redirect(
        `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?tab=integrations&error=database_error&message=Failed to save account connection`
      );
    }

  } catch (error) {
    console.error('❌ Unipile callback error:', error);

    // Track failure
    if (attemptId) {
      await updateOAuthAttempt(attemptId, {
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        error_stack: error instanceof Error ? error.stack : undefined,
        completed_at: new Date().toISOString()
      });
    }

    return NextResponse.redirect(
      `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/settings?tab=integrations&error=callback_error&message=Internal server error`
    );
  }
}
```

---

## Fix #5: Update Hosted Auth to Include User Context (30 minutes)

### Update `/app/api/unipile/connect-email/route.ts`

Add user context to callback URL:

```typescript
// Around line 52
const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/unipile/callback`;

// CHANGE TO:
// Get authenticated user
const cookieStore = await cookies();
const supabase = createRouteHandlerClient({ cookies: () => cookieStore });
const { data: { session } } = await supabase.auth.getSession();

if (!session || !session.user) {
  return NextResponse.json({
    success: false,
    error: 'Authentication required'
  }, { status: 401 });
}

// Get workspace
const { data: profile } = await supabase
  .from('users')
  .select('current_workspace_id')
  .eq('id', session.user.id)
  .single();

const workspaceId = profile?.current_workspace_id || session.user.id;

// Encode user context
const userContext = encodeURIComponent(JSON.stringify({
  user_id: session.user.id,
  user_email: session.user.email,
  workspace_id: workspaceId
}));

const redirectUrl = `${process.env.NEXT_PUBLIC_SITE_URL || 'http://localhost:3000'}/api/unipile/callback?user_context=${userContext}`;
```

---

## Deployment Checklist

### Before Deployment
- [ ] Run migration to create oauth_attempts table
- [ ] Test all fixes in staging environment
- [ ] Verify email notifications work
- [ ] Test Google OAuth flow end-to-end
- [ ] Test Microsoft OAuth flow end-to-end

### After Deployment
- [ ] Monitor OAuth attempts table for failures
- [ ] Check admin email for failure notifications
- [ ] Contact SendingCell users to retry
- [ ] Monitor Sentry for any new errors

---

## Testing Commands

```bash
# Test Supabase connection
node scripts/investigate-missing-emails.cjs

# Test email notification
node -e "require('./lib/services/oauth-notifications').notifyAdminOAuthFailure({
  user_email: 'test@test.com',
  user_id: 'test-user-id',
  workspace_id: 'test-workspace',
  provider: 'google',
  error_message: 'Test error',
  timestamp: new Date().toISOString()
})"
```

---

**Next Steps**: Implement these fixes in order, test thoroughly, then contact SendingCell users to retry their email connections.
