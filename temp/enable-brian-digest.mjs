import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_SERVICE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);

const BRIAN_WORKSPACE_ID = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';

async function enableDigest() {
  console.log('ENABLING DAILY DIGEST FOR BRIAN\'S WORKSPACE');
  console.log('='.repeat(60));

  // 1. Enable digest with tl@innovareai.com email
  console.log('\n1. ENABLING DIGEST EMAIL...');
  const { data, error } = await supabase
    .from('linkedin_brand_guidelines')
    .update({
      digest_enabled: true,
      digest_email: 'tl@innovareai.com',
      digest_timezone: 'Europe/Berlin', // Brian is in Germany
      auto_approve_enabled: false // Keep manual approval mode for now
    })
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .select();

  if (error) {
    console.error('Error:', error.message);

    // Maybe the columns don't exist? Let's check
    const { data: existing } = await supabase
      .from('linkedin_brand_guidelines')
      .select('*')
      .eq('workspace_id', BRIAN_WORKSPACE_ID);

    console.log('Existing data:', JSON.stringify(existing, null, 2));
    return;
  }

  console.log('   ✅ Digest enabled');
  console.log('   Email: tl@innovareai.com');
  console.log('   Timezone: Europe/Berlin');
  console.log('   Mode: Approval (you approve each comment)');

  // 2. Verify the update
  console.log('\n2. VERIFYING SETTINGS...');
  const { data: verify } = await supabase
    .from('linkedin_brand_guidelines')
    .select('digest_enabled, digest_email, digest_timezone, auto_approve_enabled')
    .eq('workspace_id', BRIAN_WORKSPACE_ID)
    .single();

  console.log('   Settings:', JSON.stringify(verify, null, 2));

  console.log('\n' + '='.repeat(60));
  console.log('DAILY DIGEST ENABLED');
  console.log('\nYou will receive daily emails at 5 AM PT (1 PM UTC) with:');
  console.log('- Up to 25 posts with suggested comments');
  console.log('- One-click Approve/Reject buttons');
  console.log('- Feedback options to improve AI');
  console.log('\n⚠️  CRITICAL: Brian still needs to connect his LinkedIn account!');
  console.log('Without it, approved comments cannot be posted.');
}

enableDigest().catch(console.error);
