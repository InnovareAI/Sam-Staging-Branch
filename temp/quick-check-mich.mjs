#!/usr/bin/env node

/**
 * Quick check for Mich's campaign issue
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Load environment variables
config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function checkMichCampaign() {
  console.log('🔍 Checking Mich\'s Campaign Issue\n');

  if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
    console.error('❌ Missing Supabase credentials');
    console.error('SUPABASE_URL:', SUPABASE_URL ? '✓' : '✗');
    console.error('SUPABASE_SERVICE_KEY:', SUPABASE_SERVICE_KEY ? '✓' : '✗');
    process.exit(1);
  }

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  try {
    // Find mg@innovareai.com
    console.log('Step 1: Finding user mg@innovareai.com...');
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers();

    if (authError) throw authError;

    const mgUser = authData.users.find(u => u.email === 'mg@innovareai.com');

    if (!mgUser) {
      console.error('❌ User not found');
      process.exit(1);
    }

    console.log(`✅ Found: ${mgUser.email} (${mgUser.id})\n`);

    // Get workspaces
    console.log('Step 2: Getting workspaces...');
    const { data: workspaces, error: wsError } = await supabase
      .from('workspace_members')
      .select('workspace_id, role')
      .eq('user_id', mgUser.id);

    if (wsError) throw wsError;

    console.log(`✅ Found ${workspaces.length} workspace(s)\n`);

    // Get workspace details
    const workspaceDetails = [];
    for (const ws of workspaces) {
      const { data: wsData } = await supabase
        .from('workspaces')
        .select('id, name')
        .eq('id', ws.workspace_id)
        .single();

      if (wsData) {
        workspaceDetails.push({ ...ws, workspace_name: wsData.name });
      }
    }

    // For each workspace, get latest campaigns
    for (const ws of workspaceDetails) {
      console.log(`\n📊 Workspace: ${ws.workspace_name}`);
      console.log('─'.repeat(60));

      const { data: campaigns, error: campError } = await supabase
        .from('campaigns')
        .select('*')
        .eq('workspace_id', ws.workspace_id)
        .order('created_at', { ascending: false })
        .limit(5);

      if (campError) {
        console.error(`❌ Error:`, campError.message);
        continue;
      }

      if (!campaigns || campaigns.length === 0) {
        console.log('   ⚠️ No campaigns found\n');
        continue;
      }

      for (const campaign of campaigns) {
        console.log(`\n   Campaign: ${campaign.name}`);
        console.log(`   ID: ${campaign.id}`);
        console.log(`   Status: ${campaign.status}`);
        console.log(`   Type: ${campaign.campaign_type || 'N/A'}`);
        console.log(`   Active: ${campaign.is_active ? 'YES' : 'NO'}`);

        // Get prospect counts
        const { data: prospects, error: prospectError } = await supabase
          .from('campaign_prospects')
          .select('id, status, contacted_at, linkedin_url')
          .eq('campaign_id', campaign.id)
          .limit(10);

        if (prospectError) {
          console.error(`   ❌ Prospect error:`, prospectError.message);
        } else {
          const statusCounts = {};
          prospects.forEach(p => {
            statusCounts[p.status] = (statusCounts[p.status] || 0) + 1;
          });

          console.log(`\n   Prospects:`);
          console.log(`   - Total: ${prospects.length}`);
          Object.entries(statusCounts).forEach(([status, count]) => {
            console.log(`   - ${status}: ${count}`);
          });

          // Check if any have linkedin_url
          const withLinkedIn = prospects.filter(p => p.linkedin_url).length;
          const withoutLinkedIn = prospects.length - withLinkedIn;

          if (withoutLinkedIn > 0) {
            console.log(`\n   ⚠️ WARNING: ${withoutLinkedIn} prospects missing linkedin_url!`);
          }
        }
      }
    }

    // Check workspace accounts
    console.log('\n\n🔌 Checking Workspace Accounts');
    console.log('─'.repeat(60));

    for (const ws of workspaceDetails) {
      const { data: accounts, error: accError } = await supabase
        .from('workspace_accounts')
        .select('*')
        .eq('workspace_id', ws.workspace_id);

      if (accError) {
        console.error(`❌ Account error:`, accError.message);
        continue;
      }

      console.log(`\nWorkspace: ${ws.workspace_name}`);
      if (!accounts || accounts.length === 0) {
        console.log('   ⚠️ No accounts connected!');
        continue;
      }

      accounts.forEach(acc => {
        const icon = acc.is_active ? '🟢' : '🔴';
        console.log(`   ${icon} ${acc.account_type}: ${acc.account_name}`);
        console.log(`      Status: ${acc.connection_status}`);
        console.log(`      Unipile ID: ${acc.unipile_account_id || 'N/A'}`);
      });
    }

    console.log('\n✅ Check Complete\n');

  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.stack) console.error(error.stack);
    process.exit(1);
  }
}

checkMichCampaign().catch(console.error);
