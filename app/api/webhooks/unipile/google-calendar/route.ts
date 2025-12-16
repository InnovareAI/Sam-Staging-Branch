/**
 * Google Calendar Webhook - Unipile Account Connection Callback
 *
 * POST /api/webhooks/unipile/google-calendar
 *
 * Called by Unipile when a Google account is successfully connected.
 * Links the account to the workspace in our database.
 *
 * Created: December 16, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    console.log('📅 Google Calendar webhook received:', JSON.stringify(body, null, 2));

    // Unipile sends account info on successful connection
    const {
      account_id,
      account,
      name,
      type,
      status,
      event,
    } = body;

    const unipileAccountId = account_id || account?.id;
    const accountName = name || account?.name;
    const accountType = type || account?.type;

    if (!unipileAccountId) {
      console.log('⚠️ No account_id in webhook payload');
      return NextResponse.json({ received: true, warning: 'No account_id' });
    }

    // Extract workspace_id from the account name (we set it as `{workspace_id}-google-calendar`)
    let workspaceId: string | null = null;
    if (accountName && accountName.includes('-google-calendar')) {
      workspaceId = accountName.replace('-google-calendar', '');
    }

    if (!workspaceId) {
      console.log('⚠️ Could not extract workspace_id from account name:', accountName);
      // Try to find existing workspace with this email
      return NextResponse.json({ received: true, warning: 'Could not determine workspace' });
    }

    // Get the workspace owner's user_id
    const { data: member } = await supabase
      .from('workspace_members')
      .select('user_id')
      .eq('workspace_id', workspaceId)
      .eq('role', 'owner')
      .single();

    if (!member) {
      console.log('⚠️ Could not find workspace owner for:', workspaceId);
      return NextResponse.json({ received: true, warning: 'Workspace not found' });
    }

    // Check if already linked
    const { data: existing } = await supabase
      .from('workspace_accounts')
      .select('id')
      .eq('workspace_id', workspaceId)
      .eq('unipile_account_id', unipileAccountId)
      .single();

    if (existing) {
      // Update existing record
      await supabase
        .from('workspace_accounts')
        .update({
          connection_status: 'connected',
          connected_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', existing.id);

      console.log(`✅ Updated existing Google Calendar account: ${existing.id}`);
    } else {
      // Create new record
      const { data: newAccount, error } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: workspaceId,
          user_id: member.user_id,
          account_type: 'google_calendar',
          account_identifier: accountName,
          account_name: accountName,
          unipile_account_id: unipileAccountId,
          connection_status: 'connected',
          connected_at: new Date().toISOString(),
          is_active: true,
          capabilities: { calendar: true, mail: true },
          account_metadata: {
            type: accountType || 'GOOGLE_OAUTH',
            connected_via: 'unipile_webhook',
          },
        })
        .select()
        .single();

      if (error) {
        console.error('❌ Failed to create workspace_account:', error);
        return NextResponse.json({ received: true, error: error.message }, { status: 500 });
      }

      console.log(`✅ Created Google Calendar account: ${newAccount.id}`);
    }

    return NextResponse.json({ success: true, received: true });

  } catch (error: any) {
    console.error('❌ Google Calendar webhook error:', error);
    return NextResponse.json({
      received: true,
      error: error.message,
    }, { status: 500 });
  }
}

// Also handle GET for verification
export async function GET(req: NextRequest) {
  return NextResponse.json({ status: 'Google Calendar webhook endpoint active' });
}
