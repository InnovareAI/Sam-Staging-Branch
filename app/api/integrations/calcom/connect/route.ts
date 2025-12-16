/**
 * Cal.com Integration - OAuth Connect
 *
 * POST /api/integrations/calcom/connect
 *
 * Initiates Cal.com OAuth flow
 * Requires CALCOM_CLIENT_ID and CALCOM_CLIENT_SECRET env vars
 *
 * Cal.com OAuth docs: https://cal.com/docs/enterprise-features/api/oauth
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const CALCOM_CLIENT_ID = process.env.CALCOM_CLIENT_ID;
const CALCOM_CLIENT_SECRET = process.env.CALCOM_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspace_id, user_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    if (!CALCOM_CLIENT_ID || !CALCOM_CLIENT_SECRET) {
      return NextResponse.json({
        error: 'Cal.com integration not configured. Please set CALCOM_CLIENT_ID and CALCOM_CLIENT_SECRET environment variables.'
      }, { status: 500 });
    }

    // Generate a unique state parameter for CSRF protection
    const state = `${workspace_id}:${Date.now()}:${Math.random().toString(36).substring(7)}`;

    // Store state in database for verification during callback
    await supabase.from('oauth_states').upsert({
      state,
      workspace_id,
      user_id,
      provider: 'calcom',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      created_at: new Date().toISOString(),
    });

    // Build Cal.com OAuth URL
    // Reference: https://cal.com/docs/enterprise-features/api/oauth
    const params = new URLSearchParams({
      client_id: CALCOM_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${APP_URL}/api/integrations/calcom/callback`,
      state,
    });

    const authUrl = `https://app.cal.com/auth/oauth2/authorize?${params.toString()}`;

    console.log(`📅 Generated Cal.com OAuth URL for workspace ${workspace_id}`);

    return NextResponse.json({
      success: true,
      url: authUrl,
    });

  } catch (error: any) {
    console.error('❌ Cal.com connect error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to start Cal.com connection',
    }, { status: 500 });
  }
}
