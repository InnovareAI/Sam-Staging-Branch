import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import fetch from 'node-fetch';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

function extractLinkedInUserId(url) {
  if (!url) return null;
  const match = url.match(/\/in\/([^\/\?]+)/);
  return match ? match[1] : null;
}

console.log('🔧 Fixing missing first and last names from LinkedIn profiles...\n');

// Get ALL prospects with missing names (including failed to retry them)
const { data: prospects } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, linkedin_url, campaign_id, status, campaigns(workspace_id)')
  .or('first_name.is.null,last_name.is.null,first_name.eq.,last_name.eq.')
  .in('status', ['pending', 'approved', 'ready_to_message', 'failed'])
  .not('linkedin_url', 'is', null)
  .limit(150);

console.log(`Found ${prospects?.length || 0} prospects with missing names\n`);

// Get LinkedIn account for each workspace
const workspaceAccounts = new Map();

let fixed = 0;
let failed = 0;

for (const prospect of prospects || []) {
  try {
    const workspaceId = prospect.campaigns.workspace_id;

    // Get LinkedIn account for this workspace (cached)
    if (!workspaceAccounts.has(workspaceId)) {
      const { data: accounts } = await supabase
        .from('workspace_accounts')
        .select('unipile_account_id')
        .eq('workspace_id', workspaceId)
        .eq('account_type', 'linkedin')
        .eq('connection_status', 'connected')
        .limit(1);

      if (accounts && accounts.length > 0) {
        workspaceAccounts.set(workspaceId, accounts[0].unipile_account_id);
      }
    }

    const accountId = workspaceAccounts.get(workspaceId);
    if (!accountId) {
      console.log(`⚠️  No LinkedIn account for workspace ${workspaceId}`);
      failed++;
      continue;
    }

    // Extract LinkedIn identifier
    const linkedinId = extractLinkedInUserId(prospect.linkedin_url);
    if (!linkedinId) {
      console.log(`❌ Invalid LinkedIn URL: ${prospect.linkedin_url}`);
      failed++;
      continue;
    }

    // Fetch profile from Unipile
    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinId}?account_id=${accountId}`;

    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY || '',
        'Accept': 'application/json'
      }
    });

    if (!response.ok) {
      console.log(`❌ Failed to fetch profile for ${linkedinId}: ${response.status}`);
      failed++;
      continue;
    }

    const profileData = await response.json();

    // Extract names
    let firstName = prospect.first_name || '';
    let lastName = prospect.last_name || '';

    if (profileData.first_name) {
      firstName = profileData.first_name;
    }
    if (profileData.last_name) {
      lastName = profileData.last_name;
    }

    // If still missing, try splitting full name
    if ((!firstName || !lastName) && profileData.name) {
      const nameParts = profileData.name.split(' ');
      if (!firstName && nameParts.length > 0) {
        firstName = nameParts[0];
      }
      if (!lastName && nameParts.length > 1) {
        lastName = nameParts.slice(1).join(' ');
      }
    }

    // Update database
    if (firstName && lastName) {
      const updateData = {
        first_name: firstName,
        last_name: lastName,
        updated_at: new Date().toISOString()
      };

      // If prospect was failed due to missing name, reset to pending
      if (prospect.status === 'failed') {
        updateData.status = 'pending';
        updateData.error_message = null;
      }

      await supabase
        .from('campaign_prospects')
        .update(updateData)
        .eq('id', prospect.id);

      const statusNote = prospect.status === 'failed' ? ' (reset to pending)' : '';
      console.log(`✅ ${firstName} ${lastName}${statusNote}`);
      fixed++;
    } else {
      console.log(`⚠️  No name found in profile for ${linkedinId}`);
      failed++;
    }

    // Rate limit: 1 request per second
    await new Promise(resolve => setTimeout(resolve, 1000));

  } catch (error) {
    console.error(`❌ Error processing ${prospect.linkedin_url}:`, error.message);
    failed++;
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('Summary:');
console.log(`  ✅ Fixed: ${fixed}`);
console.log(`  ❌ Failed: ${failed}`);
console.log(`  Total: ${prospects?.length || 0}`);
