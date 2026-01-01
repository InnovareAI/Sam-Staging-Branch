/**
 * Calendly Integration - OAuth Callback
 *
 * GET /api/integrations/calendly/callback
 *
 * Handles Calendly OAuth callback after user authorization
 * Exchanges code for access token and stores credentials
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

export async function GET(req: NextRequest) {
  try {
    const searchParams = req.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    // Handle OAuth errors
    if (error) {
      console.error('Calendly OAuth error:', error);
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=${encodeURIComponent(error)}`);
    }

    if (!code || !state) {
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=missing_params`);
    }

    // Verify state and get workspace_id
    const { data: stateData, error: stateError } = await supabase
      .from('oauth_states')
      .select('*')
      .eq('state', state)
      .eq('provider', 'calendly')
      .single();

    if (stateError || !stateData) {
      console.error('Invalid OAuth state:', stateError);
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=invalid_state`);
    }

    // Check if state is expired
    if (new Date(stateData.expires_at) < new Date()) {
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=state_expired`);
    }

    const { workspace_id, user_id } = stateData;

    // Exchange code for access token
    const tokenResponse = await fetch('https://auth.calendly.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        client_id: CALENDLY_CLIENT_ID!,
        client_secret: CALENDLY_CLIENT_SECRET!,
        code,
        redirect_uri: `${APP_URL}/api/integrations/calendly/callback`,
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Calendly token error:', errorText);
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, expires_in } = tokenData;

    // Get user info from Calendly
    const userResponse = await fetch('https://api.calendly.com/users/me', {
      headers: {
        'Authorization': `Bearer ${access_token}`,
        'Content-Type': 'application/json',
      },
    });

    if (!userResponse.ok) {
      console.error('Calendly user fetch error:', await userResponse.text());
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=user_fetch_failed`);
    }

    const userData = await userResponse.json();
    const user = userData.resource;

    // Store Calendly account in workspace_accounts
    const { error: upsertError } = await supabase
      .from('workspace_accounts')
      .upsert({
        workspace_id,
        account_type: 'calendly',
        account_name: user.name,
        account_email: user.email,
        connection_status: 'connected',
        scheduling_url: user.scheduling_url,
        access_token,
        refresh_token,
        token_expires_at: new Date(Date.now() + expires_in * 1000).toISOString(),
        metadata: {
          calendly_uri: user.uri,
          calendly_slug: user.slug,
          timezone: user.timezone,
          avatar_url: user.avatar_url,
          current_organization: user.current_organization,
        },
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'workspace_id,account_type',
      });

    if (upsertError) {
      console.error('Calendly account save error:', upsertError);
      return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=save_failed`);
    }

    // Clean up state
    await supabase.from('oauth_states').delete().eq('state', state);

    console.log(`✅ Calendly connected for workspace ${workspace_id}: ${user.email}`);

    return NextResponse.redirect(`${APP_URL}/settings?connected=calendly`);

  } catch (error: any) {
    console.error('❌ Calendly callback error:', error);
    return NextResponse.redirect(`${APP_URL}/settings?error=calendly&message=${encodeURIComponent(error.message)}`);
  }
}
