#!/usr/bin/env node
/**
 * Check Email Accounts Debug Script
 * Queries database and Unipile API to see what accounts exist
 */

import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkEmailAccounts() {
  console.log('🔍 Checking email accounts...\n');

  // 1. Check user_unipile_accounts table
  console.log('📊 Database: user_unipile_accounts');
  const { data: dbAccounts, error: dbError } = await supabase
    .from('user_unipile_accounts')
    .select('*')
    .order('created_at', { ascending: false })
    .limit(10);

  if (dbError) {
    console.error('❌ Database error:', dbError);
  } else {
    console.log(`Found ${dbAccounts?.length || 0} accounts in database:`);
    dbAccounts?.forEach(acc => {
      console.log(`  - ${acc.platform}: ${acc.account_email} (${acc.unipile_account_id})`);
      console.log(`    User: ${acc.user_id}`);
      console.log(`    Status: ${acc.connection_status}`);
      console.log(`    Created: ${acc.created_at}\n`);
    });
  }

  // 2. Check Unipile API
  console.log('\n📡 Unipile API: /accounts');
  try {
    const unipileResponse = await fetch(
      `https://${process.env.UNIPILE_DSN}/api/v1/accounts`,
      {
        headers: {
          'X-API-KEY': process.env.UNIPILE_API_KEY,
          'Accept': 'application/json'
        }
      }
    );

    if (!unipileResponse.ok) {
      console.error('❌ Unipile API error:', unipileResponse.status);
      const errorText = await unipileResponse.text();
      console.error(errorText);
    } else {
      const data = await unipileResponse.json();
      const accounts = data.items || [];
      console.log(`Found ${accounts.length} accounts in Unipile:`);

      accounts.forEach(acc => {
        const email = acc.connection_params?.email || acc.connection_params?.im?.email || 'N/A';
        console.log(`  - ${acc.type}: ${email} (${acc.id})`);
        console.log(`    Name: ${acc.name || 'N/A'}`);
        console.log(`    Status: ${acc.status}`);
        console.log(`    Sources: ${acc.sources?.map(s => s.status).join(', ') || 'N/A'}\n`);
      });
    }
  } catch (error) {
    console.error('❌ Unipile API error:', error.message);
  }

  // 3. Check workspace_accounts table
  console.log('\n📊 Database: workspace_accounts');
  const { data: wsAccounts, error: wsError } = await supabase
    .from('workspace_accounts')
    .select('*')
    .eq('account_type', 'email')
    .order('created_at', { ascending: false })
    .limit(10);

  if (wsError) {
    console.error('❌ Database error:', wsError);
  } else {
    console.log(`Found ${wsAccounts?.length || 0} email accounts in workspace_accounts:`);
    wsAccounts?.forEach(acc => {
      console.log(`  - Account: ${acc.account_identifier}`);
      console.log(`    Workspace: ${acc.workspace_id}`);
      console.log(`    Unipile ID: ${acc.unipile_account_id}`);
      console.log(`    Metadata: ${JSON.stringify(acc.account_metadata)}\n`);
    });
  }
}

checkEmailAccounts().catch(console.error);
