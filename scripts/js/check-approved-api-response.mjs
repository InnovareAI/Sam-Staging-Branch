import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkApprovedAPIResponse() {
  try {
    // Get the workspace ID (hardcoded from context)
    const workspaceId = '20c34cb1-3d1f-49f0-8fa2-49d5b1d3a82c';

    console.log('\n🔍 SIMULATING /api/prospect-approval/approved API CALL');
    console.log('='.repeat(80));

    // Replicate the exact API logic
    // 1. Get sessions for workspace
    const { data: sessions, error: sessionsError } = await supabase
      .from('prospect_approval_sessions')
      .select('id')
      .eq('workspace_id', workspaceId);

    if (sessionsError) throw sessionsError;

    const sessionIds = (sessions || []).map(s => s.id);
    console.log(`\n📋 Found ${sessionIds.length} sessions for workspace`);

    if (sessionIds.length === 0) {
      console.log('❌ No sessions found');
      return;
    }

    // 2. Get approved prospects (exact API query)
    const { data: approvedData, error: dataError } = await supabase
      .from('prospect_approval_data')
      .select(`
        *,
        prospect_approval_sessions(
          workspace_id,
          campaign_name,
          campaign_tag,
          prospect_source
        )
      `)
      .in('session_id', sessionIds)
      .eq('approval_status', 'approved')
      .order('created_at', { ascending: false });

    if (dataError) throw dataError;

    console.log(`\n✅ Found ${approvedData.length} approved prospects\n`);

    // 3. Process like the API does (with the fix)
    const prospectsWithCampaignStatus = await Promise.all(
      (approvedData || []).slice(0, 3).map(async (prospect, index) => {
        // CRITICAL FIX: Extract LinkedIn URL from contact JSONB object
        const linkedinUrl = prospect.contact?.linkedin_url || prospect.linkedin_url || null;

        console.log(`\n${index + 1}. PROSPECT DATA STRUCTURE:`);
        console.log(`   Name: ${prospect.name}`);
        console.log(`   Raw contact field type: ${typeof prospect.contact}`);
        console.log(`   Raw contact field: ${JSON.stringify(prospect.contact, null, 2)}`);
        console.log(`   prospect.contact?.linkedin_url: ${prospect.contact?.linkedin_url || 'UNDEFINED'}`);
        console.log(`   prospect.linkedin_url: ${prospect.linkedin_url || 'UNDEFINED'}`);
        console.log(`   Extracted linkedinUrl: ${linkedinUrl || 'NULL'}`);

        // Check if in campaign
        const { data: campaignProspect } = await supabase
          .from('campaign_prospects')
          .select('campaign_id')
          .eq('linkedin_url', linkedinUrl)
          .single();

        const result = {
          ...prospect,
          // CRITICAL FIX: Flatten linkedin_url to top level for campaign creation
          linkedin_url: linkedinUrl,
          in_campaign: !!campaignProspect,
        };

        console.log(`\n   RESULT OBJECT:`);
        console.log(`   result.linkedin_url (top-level): ${result.linkedin_url || 'NULL'}`);
        console.log(`   result.contact?.linkedin_url (JSONB): ${result.contact?.linkedin_url || 'UNDEFINED'}`);
        console.log(`   In campaign: ${result.in_campaign}`);

        return result;
      })
    );

    // Filter out prospects already in campaigns
    const availableProspects = prospectsWithCampaignStatus.filter(p => !p.in_campaign);

    console.log('\n' + '='.repeat(80));
    console.log(`\n📊 SUMMARY:`);
    console.log(`   Total approved: ${approvedData.length}`);
    console.log(`   Available (not in campaign): ${availableProspects.length}`);
    console.log(`\n   This is what the API would return to CampaignHub.tsx`);

    if (availableProspects.length > 0) {
      console.log('\n✅ First available prospect structure:');
      const first = availableProspects[0];
      console.log(`   name: ${first.name}`);
      console.log(`   linkedin_url (top-level): ${first.linkedin_url || 'NULL'}`);
      console.log(`   contact?.linkedin_url: ${first.contact?.linkedin_url || 'UNDEFINED'}`);
      console.log(`\n   CampaignHub.tsx line 3470 uses: prospect.contact?.linkedin_url`);
      console.log(`   Value it will get: ${first.contact?.linkedin_url || 'EMPTY STRING'}`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkApprovedAPIResponse();
