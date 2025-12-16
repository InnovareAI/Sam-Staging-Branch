/**
 * Google Calendar Integration - Connect
 *
 * POST /api/integrations/google-calendar/connect
 *
 * Generates a Unipile hosted auth link for Google Calendar
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UNIPILE_DSN = process.env.UNIPILE_DSN || 'api6.unipile.com:13670';
const UNIPILE_API_KEY = process.env.UNIPILE_API_KEY;
const APP_URL = process.env.NEXT_PUBLIC_APP_URL || 'https://app.meet-sam.com';

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { workspace_id, user_id, user_email } = body;

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    if (!UNIPILE_API_KEY) {
      return NextResponse.json({ error: 'Unipile not configured' }, { status: 500 });
    }

    // Generate expiration (24 hours from now)
    const expiresOn = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString().replace(/\.\d{3}Z$/, '.999Z');

    // Generate Unipile hosted auth link for Google
    const response = await fetch(`https://${UNIPILE_DSN}/api/v1/hosted/accounts/link`, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json',
      },
      body: JSON.stringify({
        type: 'create',
        providers: ['GOOGLE'],
        api_url: `https://${UNIPILE_DSN}`,
        expiresOn,
        name: `${workspace_id}-google-calendar`,
        notify_url: `${APP_URL}/api/webhooks/unipile/google-calendar`,
        success_redirect_url: `${APP_URL}/settings?connected=google-calendar`,
        failure_redirect_url: `${APP_URL}/settings?error=google-calendar`,
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('Unipile error:', errorText);
      return NextResponse.json({ error: 'Failed to generate connection link' }, { status: 500 });
    }

    const data = await response.json();

    if (!data.url) {
      return NextResponse.json({ error: 'No URL returned from Unipile' }, { status: 500 });
    }

    console.log(`📅 Generated Google Calendar connection link for workspace ${workspace_id}`);

    return NextResponse.json({
      success: true,
      url: data.url,
    });

  } catch (error: any) {
    console.error('❌ Google Calendar connect error:', error);
    return NextResponse.json({
      error: error.message || 'Failed to generate connection link',
    }, { status: 500 });
  }
}
