import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function check() {
  // Get pending items
  const { data: pending } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, campaign_id')
    .eq('status', 'pending')
    .limit(100);

  console.log('=== PENDING QUEUE ITEMS ===');
  console.log('Sample count:', pending?.length || 0);

  if (pending && pending.length > 0) {
    let validProvider = 0;
    let fullUrl = 0;
    let vanityName = 0;
    let nullId = 0;

    const badItems = [];

    pending.forEach(p => {
      const uid = p.linkedin_user_id;
      if (!uid) {
        nullId++;
      } else if (uid.startsWith('ACo') || uid.startsWith('ACw')) {
        validProvider++;
      } else if (uid.includes('linkedin.com')) {
        fullUrl++;
        badItems.push({ id: p.id, uid });
      } else {
        vanityName++;
        badItems.push({ id: p.id, uid });
      }
    });

    console.log('\nID Format breakdown:');
    console.log('  Valid provider (ACo/ACw):', validProvider);
    console.log('  Full URL:', fullUrl);
    console.log('  Vanity name:', vanityName);
    console.log('  Null:', nullId);

    if (badItems.length > 0) {
      console.log('\nItems with non-provider IDs (will be resolved at send time):');
      badItems.slice(0, 10).forEach(b => {
        console.log('  -', b.uid.substring(0, 70));
      });
    }
  }

  // Check failed items too
  const { data: failed } = await supabase
    .from('send_queue')
    .select('id, linkedin_user_id, error_message, updated_at')
    .eq('status', 'failed')
    .order('updated_at', { ascending: false })
    .limit(20);

  console.log('\n=== FAILED QUEUE ITEMS ===');
  console.log('Count:', failed?.length || 0);

  if (failed && failed.length > 0) {
    failed.forEach(f => {
      console.log('---');
      console.log('ID:', f.id.substring(0,8));
      console.log('linkedin_user_id:', f.linkedin_user_id);
      console.log('Error:', f.error_message?.substring(0, 100));
    });
  }
}

check().catch(console.error);
