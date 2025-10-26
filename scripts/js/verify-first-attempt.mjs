import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function verifyFirstAttempt() {
  try {
    const linkedinUrl = 'https://www.linkedin.com/in/skiyer';

    // Get the first "successful" attempt
    const { data: prospect, error } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('linkedin_url', linkedinUrl)
      .eq('status', 'connection_requested')
      .single();

    if (error) throw error;

    console.log(`\n🔍 First "Successful" Attempt Details:`);
    console.log('='.repeat(80));
    console.log(`Status: ${prospect.status}`);
    console.log(`Contacted At: ${prospect.contacted_at}`);
    console.log(`\n📋 Full Personalization Data:`);
    console.log(JSON.stringify(prospect.personalization_data, null, 2));

    // Check if it has a Unipile message ID
    if (prospect.personalization_data?.unipile_message_id) {
      console.log(`\n✅ HAS Unipile Message ID: ${prospect.personalization_data.unipile_message_id}`);
      console.log(`   This means the message WAS actually sent to LinkedIn via Unipile`);
    } else {
      console.log(`\n❌ NO Unipile Message ID found!`);
      console.log(`   This suggests the prospect was marked as "connection_requested"`);
      console.log(`   but the actual API call to Unipile may have failed silently`);
    }

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

verifyFirstAttempt();
