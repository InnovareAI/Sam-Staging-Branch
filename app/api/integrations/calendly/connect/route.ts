/**
 * Calendly Integration - OAuth Connect
 *
 * POST /api/integrations/calendly/connect
 *
 * Initiates Calendly OAuth flow
 * Requires CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET env vars
 *
 * Calendly OAuth docs: https://developer.calendly.com/api-docs/d7755e2f9e5fe-get-current-user
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/db';

const CALENDLY_CLIENT_ID = process.env.CALENDLY_CLIENT_ID;
const CALENDLY_CLIENT_SECRET = process.env.CALENDLY_CLIENT_SECRET;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspace_id, user_id } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    if (!CALENDLY_CLIENT_ID || !CALENDLY_CLIENT_SECRET) {
      return NextResponse.json({
        error: 'Calendly integration not configured. Please set CALENDLY_CLIENT_ID and CALENDLY_CLIENT_SECRET environment variables.'
      }, { status: 500 });
    }

    // Generate a unique state parameter for CSRF protection
    const state = `${workspace_id}:${Date.now()}:${Math.random().toString(36).substring(7)}`;

    // Store state in database for verification during callback
    await supabase.from('oauth_states').upsert({
      state,
      workspace_id,
      user_id,
      provider: 'calendly',
      expires_at: new Date(Date.now() + 10 * 60 * 1000).toISOString(), // 10 minutes
      created_at: new Date().toISOString(),
    });

    // Build Calendly OAuth URL
    // Reference: https://developer.calendly.com/api-docs/d7755e2f9e5fe-get-current-user
    const params = new URLSearchParams({
      client_id: CALENDLY_CLIENT_ID,
      response_type: 'code',
      redirect_uri: `${APP_URL}/api/integrations/calendly/callback`,
      state,
    });

    const authUrl = `https://auth.calendly.com/oauth/authorize?${params.toString()}`;

    console.log(`📅 Generated Calendly OAuth URL for workspace ${workspace_id}`);

    return NextResponse.json({
      success: true,
      url: authUrl,
    });

  } catch (error: any) {
    console.error('❌ Calendly connect error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to start Calendly connection',
    }, { status: 500 });
  }
}
