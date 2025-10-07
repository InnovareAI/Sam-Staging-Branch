
import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { requireAdmin } from '@/lib/security/route-auth';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function callUnipileAPI(endpoint: string) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  if (!unipileDsn || !unipileApiKey) {
    throw new Error('Unipile credentials not configured');
  }

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'X-API-KEY': unipileApiKey,
      'Accept': 'application/json'
    }
  });

  if (!response.ok) {
    throw new Error(`Unipile API error: ${response.status}`);
  }

  return await response.json();
}

export async function POST(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  try {
    console.log('🔄 Starting email accounts sync...');

    // Get all Unipile accounts
    const data = await callUnipileAPI('accounts');
    const allAccounts = Array.isArray(data) ? data : (data.items || data.accounts || []);

    // Filter email accounts
    const emailAccounts = allAccounts.filter((account: any) => {
      const type = account.type?.toUpperCase() || '';
      return type.includes('GOOGLE') || type.includes('OUTLOOK') || type === 'MESSAGING';
    });

    console.log(`📧 Found ${emailAccounts.length} email accounts in Unipile`);

    let synced = 0;
    let skipped = 0;
    const results = [];

    for (const account of emailAccounts) {
      const email = account.connection_params?.mail?.username ||
                    account.connection_params?.im?.email ||
                    account.connection_params?.email ||
                    account.name ||
                    account.email;

      console.log(`🔍 Processing account ${account.id}:`, {
        type: account.type,
        email,
        connection_params: account.connection_params,
        all_keys: Object.keys(account)
      });

      if (!email) {
        console.log(`⏭️ Skipping account ${account.id} - no email found`);
        skipped++;
        results.push({ account_id: account.id, status: 'no_email', account_data: account });
        continue;
      }

      // Find user by email
      const { data: userData } = await supabase.auth.admin.listUsers();
      const user = userData?.users?.find(u => u.email?.toLowerCase() === email.toLowerCase());

      if (!user) {
        console.log(`⏭️ Skipping ${email} - no matching user`);
        skipped++;
        results.push({ email, status: 'no_user', account_id: account.id });
        continue;
      }

      // Get user's workspace
      const { data: userProfile } = await supabase
        .from('users')
        .select('current_workspace_id')
        .eq('id', user.id)
        .single();

      const workspaceId = userProfile?.current_workspace_id;

      if (!workspaceId) {
        console.log(`⏭️ Skipping ${email} - no workspace`);
        skipped++;
        results.push({ email, status: 'no_workspace', account_id: account.id });
        continue;
      }

      // Check if already synced
      const { data: existing } = await supabase
        .from('workspace_accounts')
        .select('id')
        .eq('workspace_id', workspaceId)
        .eq('unipile_account_id', account.id)
        .single();

      if (existing) {
        console.log(`⏭️ Already synced: ${email}`);
        skipped++;
        results.push({ email, status: 'already_synced', account_id: account.id });
        continue;
      }

      // Store in workspace_accounts
      const { error } = await supabase
        .from('workspace_accounts')
        .insert({
          workspace_id: workspaceId,
          user_id: user.id,
          account_type: 'email',
          account_identifier: email,
          account_name: email,
          unipile_account_id: account.id,
          connection_status: 'connected',
          is_active: true,
          account_metadata: {
            platform: account.type,
            provider: account.type?.includes('GOOGLE') ? 'google' : 'microsoft',
            synced_at: new Date().toISOString()
          }
        });

      if (error) {
        console.error(`❌ Failed to sync ${email}:`, error);
        results.push({ email, status: 'error', error: error.message, account_id: account.id });
      } else {
        console.log(`✅ Synced ${email}`);
        synced++;
        results.push({ email, status: 'synced', account_id: account.id });
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Email accounts sync complete',
      stats: {
        total: emailAccounts.length,
        synced,
        skipped
      },
      results
    });

  } catch (error) {
    console.error('❌ Sync error:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Sync failed'
    }, { status: 500 });
  }
}
