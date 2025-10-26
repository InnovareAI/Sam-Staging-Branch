import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function showFullProspectData() {
  try {
    const linkedinUrl = 'https://www.linkedin.com/in/skiyer';

    const { data: prospect, error } = await supabase
      .from('campaign_prospects')
      .select('*')
      .eq('linkedin_url', linkedinUrl)
      .order('created_at', { ascending: false })
      .limit(1)
      .single();

    if (error) throw error;

    console.log('\n📋 FULL PROSPECT DATA:');
    console.log('='.repeat(80));
    console.log(JSON.stringify(prospect, null, 2));

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

showFullProspectData();
