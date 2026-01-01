/**
 * Cal.com Integration - OAuth Callback
 *
 * GET /api/integrations/calcom/callback
 *
 * Handles Cal.com OAuth callback after user authorization
 * Exchanges code for access token and stores credentials
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const CALCOM_CLIENT_ID = process.env.CALCOM_CLIENT_ID;
const CALCOM_CLIENT_SECRET = process.env.CALCOM_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Cal.com OAuth error:', error);
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=missing_params`);
    }

    // Verify state and get workspace_id
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'calcom')
      .single();

    if (stateError || !stateData) {
      console.error('Invalid OAuth state:', stateError);
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=invalid_state`);
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=state_expired`);
    }

    const { workspace_id, user_id } = stateData;

    // Exchange code for access token
    const tokenResponse = await fetch('https://app.cal.com/api/auth/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CALCOM_CLIENT_ID!,
        client_secret: CALCOM_CLIENT_SECRET!,
        code,
        redirect_uri: `${APP_URL}/api/integrations/calcom/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Cal.com token error:', errorText);
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user info from Cal.com
    const userResponse = await fetch('https://api.cal.com/v1/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Cal.com user fetch error:', await userResponse.text());
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=user_fetch_failed`);
    }

    const userData = await userResponse.json();
    const user = userData.user;

    // Store Cal.com account in workspace_accounts
    const { error: upsertError } = await supabase
      .from('workspace_accounts')
      .upsert({
        workspace_id,
        account_type: 'calcom',
        account_name: user.name,
        account_email: user.email,
        connection_status: 'connected',
        scheduling_url: `https://cal.com/${user.username}`,
        access_token,
        refresh_token,
        token_expires_at: expires_in ? new Date(Date.now() + expires_in * 1000).toISOString() : null,
        metadata: {
          calcom_id: user.id,
          calcom_username: user.username,
          timezone: user.timeZone,
          avatar: user.avatar,
          bio: user.bio,
          weekStart: user.weekStart,
          default_schedule_id: user.defaultScheduleId,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,account_type',
      });

    if (upsertError) {
      console.error('Cal.com account save error:', upsertError);
      return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=save_failed`);
    }

    // Clean up state
    await supabase.from('oauth_states').delete().eq('state', state);

    console.log(`✅ Cal.com connected for workspace ${workspace_id}: ${user.email}`);

    return NextResponse.redirect(`${APP_URL}/settings?connected=calcom`);

  } catch (error: any) {
    console.error('❌ Cal.com callback error:', error);
    return NextResponse.redirect(`${APP_URL}/settings?error=calcom&message=${encodeURIComponent(error.message)}`);
  }
}
