import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function fix() {
  console.log('=== FIXING STUCK ITEMS ===\n');

  // Fix 1: Re-queue 50 stuck pending items
  console.log('1. Re-scheduling stuck pending items...');
  const now = new Date();

  const { data: stuck, error: e1 } = await supabase
    .from('send_queue')
    .update({
      scheduled_for: new Date(now.getTime() + 5 * 60 * 1000).toISOString(),
      error_message: null
    })
    .eq('status', 'pending')
    .lt('scheduled_for', now.toISOString())
    .select('id');

  if (e1) {
    console.log('   ❌ Error:', e1.message);
  } else {
    console.log(`   ✅ Re-scheduled ${stuck?.length || 0} items`);
  }

  // Fix 2: Add missing accounts to database
  console.log('\n2. Adding missing Unipile accounts to database...');

  // Martin Schechtner - need to find workspace
  const { data: workspaces } = await supabase
    .from('workspaces')
    .select('id, name, owner_id');

  // tl@innovareai.com - belongs to Thorsten
  const thorsten = workspaces?.find(w => w.name === 'Thorsten Linz');

  if (thorsten) {
    const { error: e2a } = await supabase
      .from('user_unipile_accounts')
      .upsert({
        user_id: thorsten.owner_id,
        unipile_account_id: 'jYXN8FeCTEukNSXDoaH3hA',
        platform: 'LINKEDIN',
        account_name: 'tl@innovareai.com',
        connection_status: 'active',
        workspace_id: thorsten.id
      }, { onConflict: 'unipile_account_id' });

    if (e2a) {
      console.log('   ❌ tl@innovareai.com:', e2a.message);
    } else {
      console.log('   ✅ Added tl@innovareai.com');
    }
  }

  // Martin Schechtner - likely Asphericon or new user
  const asphericon = workspaces?.find(w => w.name === 'Asphericon');
  if (asphericon) {
    const { error: e2b } = await supabase
      .from('user_unipile_accounts')
      .upsert({
        user_id: asphericon.owner_id,
        unipile_account_id: 'KeHOhroOTSut7IQr5DU4Ag',
        platform: 'LINKEDIN',
        account_name: 'Martin Schechtner',
        connection_status: 'active',
        workspace_id: asphericon.id
      }, { onConflict: 'unipile_account_id' });

    if (e2b) {
      console.log('   ❌ Martin Schechtner:', e2b.message);
    } else {
      console.log('   ✅ Added Martin Schechtner');
    }
  }

  // Fix 3: Queue stuck approved prospects
  console.log('\n3. Queueing stuck approved prospects...');

  // Get approved prospects not in queue
  const { data: approvedProspects } = await supabase
    .from('campaign_prospects')
    .select('id, campaign_id, linkedin_url, first_name, last_name')
    .eq('status', 'approved');

  // Get existing queue items
  const { data: existingQueue } = await supabase
    .from('send_queue')
    .select('prospect_id')
    .in('status', ['pending', 'sent']);

  const queuedProspectIds = new Set((existingQueue || []).map(q => q.prospect_id));

  // Get campaigns with linkedin_account_id
  const { data: campaigns } = await supabase
    .from('campaigns')
    .select('id, linkedin_account_id, message_templates, status');

  const campaignMap = {};
  for (const c of (campaigns || [])) {
    campaignMap[c.id] = c;
  }

  let queued = 0;
  let baseTime = now.getTime();
  const GAP_MS = 20 * 60 * 1000; // 20 minutes between each

  for (const p of (approvedProspects || [])) {
    if (queuedProspectIds.has(p.id)) continue;

    const campaign = campaignMap[p.campaign_id];
    if (!campaign || !campaign.linkedin_account_id || campaign.status !== 'active') continue;

    // Get message from campaign
    let message = '';
    if (campaign.message_templates) {
      const templates = typeof campaign.message_templates === 'string'
        ? JSON.parse(campaign.message_templates)
        : campaign.message_templates;
      message = templates.connectionRequest || templates.connection_request || '';
    }

    if (!message) continue;

    // Replace placeholders
    message = message
      .replace(/\{first_name\}/gi, p.first_name || '')
      .replace(/\{last_name\}/gi, p.last_name || '');

    const scheduledFor = new Date(baseTime + (queued * GAP_MS));

    const { error } = await supabase
      .from('send_queue')
      .insert({
        campaign_id: p.campaign_id,
        prospect_id: p.id,
        linkedin_user_id: p.linkedin_url,
        message: message,
        scheduled_for: scheduledFor.toISOString(),
        status: 'pending'
      });

    if (!error) {
      queued++;
    }
  }

  console.log(`   ✅ Queued ${queued} prospects`);

  console.log('\n=== DONE ===');
}

fix().catch(console.error);
