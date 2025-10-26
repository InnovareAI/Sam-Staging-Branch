import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkProspectHistory() {
  try {
    const linkedinUrl = 'https://www.linkedin.com/in/skiyer';

    console.log(`\n🔍 Searching for all campaign attempts for: ${linkedinUrl}`);
    console.log('='.repeat(80));

    // Find all campaign_prospects with this LinkedIn URL
    const { data: prospects, error } = await supabase
      .from('campaign_prospects')
      .select(`
        id,
        campaign_id,
        status,
        contacted_at,
        created_at,
        personalization_data,
        campaigns!inner(name, created_at, status)
      `)
      .eq('linkedin_url', linkedinUrl)
      .order('created_at', { ascending: false });

    if (error) throw error;

    console.log(`\n📊 Found ${prospects.length} campaign attempts:\n`);

    prospects.forEach((p, i) => {
      console.log(`${i + 1}. Campaign: ${p.campaigns.name}`);
      console.log(`   Campaign Status: ${p.campaigns.status}`);
      console.log(`   Prospect Status: ${p.status}`);
      console.log(`   Added to Campaign: ${new Date(p.created_at).toLocaleString()}`);
      console.log(`   Contacted At: ${p.contacted_at ? new Date(p.contacted_at).toLocaleString() : 'Never'}`);

      if (p.personalization_data) {
        if (p.personalization_data.error) {
          console.log(`   ❌ Error: ${p.personalization_data.error}`);
          console.log(`   Detail: ${p.personalization_data.detail || 'N/A'}`);
        }
        if (p.personalization_data.unipile_message_id) {
          console.log(`   ✅ Unipile Message ID: ${p.personalization_data.unipile_message_id}`);
        }
      }
      console.log('');
    });

    // Check if any actually succeeded
    const successfulAttempts = prospects.filter(p =>
      p.status === 'connection_requested' ||
      p.personalization_data?.unipile_message_id
    );

    console.log(`\n📈 Summary:`);
    console.log(`   Total Attempts: ${prospects.length}`);
    console.log(`   Successful: ${successfulAttempts.length}`);
    console.log(`   Failed/Blocked: ${prospects.length - successfulAttempts.length}`);

    if (successfulAttempts.length > 0) {
      console.log(`\n✅ This prospect WAS successfully contacted in at least one campaign`);
    } else {
      console.log(`\n❌ This prospect was NEVER successfully contacted`);
      console.log(`   All attempts were blocked by Unipile/LinkedIn`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

checkProspectHistory();
