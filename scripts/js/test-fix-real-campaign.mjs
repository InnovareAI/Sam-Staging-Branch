#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function fixCampaign() {
  const campaignId = '1d3428f8-454d-4ffb-8337-4273f781adfb';
  const sessionId = 'bd33a099-56a3-4389-a96e-e07685cb7841';
  const workspaceId = '96c03b38-a2f4-40de-9e16-43098599e1d4';
  
  console.log('\n🔧 FIXING REAL CAMPAIGN - INSERTING PROSPECTS\n');
  console.log('═══════════════════════════════════════════════════════════════\n');

  // Get approved prospects from the session
  const { data: decisions } = await supabase
    .from('prospect_approval_decisions')
    .select('prospect_id')
    .eq('session_id', sessionId)
    .eq('decision', 'approved');

  const approvedProspectIds = decisions?.map(d => d.prospect_id) || [];

  // Get the prospect data
  const { data: approvedProspects } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('session_id', sessionId)
    .in('prospect_id', approvedProspectIds);

  console.log(`Found ${approvedProspects?.length || 0} approved prospects\n`);

  if (approvedProspects && approvedProspects.length > 0) {
    // Get LinkedIn account
    const { data: linkedInAccount } = await supabase
      .from('workspace_accounts')
      .select('unipile_account_id')
      .eq('workspace_id', workspaceId)
      .eq('account_type', 'linkedin')
      .eq('connection_status', 'connected')
      .single();

    const unipileAccountId = linkedInAccount?.unipile_account_id || null;

    // Transform prospects (FIXED - no connection_degree)
    const campaignProspects = approvedProspects.map(prospect => {
      const contact = prospect.contact || {};
      const linkedinUrl = contact.linkedin_url || contact.linkedinUrl || prospect.linkedin_url || null;

      const fullName = prospect.name || `${contact.firstName || ''} ${contact.lastName || ''}`.trim();

      let firstName = 'Unknown';
      let lastName = 'User';

      if (fullName && fullName.trim() !== '') {
        const nameParts = fullName.trim().split(/\s+/);
        if (nameParts.length >= 2) {
          firstName = nameParts[0];
          lastName = nameParts.slice(1).join(' ');
        } else if (nameParts.length === 1) {
          firstName = nameParts[0];
          lastName = '';
        }
      }

      return {
        campaign_id: campaignId,
        workspace_id: workspaceId,
        first_name: firstName,
        last_name: lastName,
        email: contact.email || null,
        company_name: prospect.company?.name || contact.company || contact.companyName || '',
        linkedin_url: linkedinUrl,
        title: prospect.title || contact.title || contact.headline || '',
        location: prospect.location || contact.location || null,
        industry: prospect.company?.industry?.[0] || 'Not specified',
        status: 'approved',
        notes: 'Manually fixed - connection_degree issue resolved',
        added_by_unipile_account: unipileAccountId,
        personalization_data: {
          source: 'approval_session',
          session_id: sessionId,
          approval_data_id: prospect.id,
          approved_at: new Date().toISOString(),
          fixed_at: new Date().toISOString()
        }
      };
    });

    console.log('Inserting prospects...\n');
    const { data: inserted, error: insertError } = await supabase
      .from('campaign_prospects')
      .insert(campaignProspects)
      .select();

    if (insertError) {
      console.error('❌ INSERT FAILED:', insertError.message);
      console.error('   Code:', insertError.code);
    } else {
      console.log(`✅ SUCCESS! Inserted ${inserted.length} prospects!\n`);
      inserted.forEach((p, i) => {
        console.log(`   ${i + 1}. ${p.first_name} ${p.last_name}`);
        console.log(`      ├─ ID: ${p.id}`);
        console.log(`      ├─ Status: ${p.status}`);
        console.log(`      └─ LinkedIn: ${p.linkedin_url ? '✅' : '❌'}\n`);
      });
    }
  }

  console.log('═══════════════════════════════════════════════════════════════\n');
}

fixCampaign();
