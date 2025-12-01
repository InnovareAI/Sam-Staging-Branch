import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function fix() {
  // Get Brian Neiby monitors
  const { data: monitors } = await supabase
    .from('linkedin_post_monitors')
    .select('*')
    .ilike('name', '%Brian%');

  console.log('Found', monitors?.length || 0, 'Brian Neiby monitors');

  for (const monitor of monitors || []) {
    console.log('\n=== Processing:', monitor.name, '===');
    console.log('Current profile_vanities:', monitor.profile_vanities?.length || 0);
    console.log('Sample:', JSON.stringify((monitor.profile_vanities || []).slice(0, 3)));

    // Separate vanity names from provider IDs
    const profileVanities = monitor.profile_vanities || [];

    // Vanity names are like "tony-mannarino-cdctp-dcep-fmp-05451136"
    // Provider IDs start with "ACw"
    // Company IDs start with "COMPANY:"

    const vanityNames = profileVanities
      .filter(p => !p.startsWith('ACw') && !p.startsWith('COMPANY:'))
      .map(p => 'PROFILE:' + p);

    const companyIds = profileVanities
      .filter(p => p.startsWith('COMPANY:'))
      .map(p => p); // Already in correct format

    const providerIds = profileVanities
      .filter(p => p.startsWith('ACw'));

    console.log('Vanity names:', vanityNames.length);
    console.log('Company IDs:', companyIds.length);
    console.log('Provider IDs (cannot use):', providerIds.length);

    if (vanityNames.length === 0 && companyIds.length === 0) {
      console.log('⚠️ No processable entries - all are provider IDs');
      console.log('   Provider IDs need to be converted to vanity names via LinkedIn API');
      continue;
    }

    // Combine for hashtags field
    const hashtags = [...vanityNames, ...companyIds];

    // Update the monitor
    const { error } = await supabase
      .from('linkedin_post_monitors')
      .update({ hashtags })
      .eq('id', monitor.id);

    if (error) {
      console.log('❌ Update error:', error.message);
    } else {
      console.log('✅ Updated with', hashtags.length, 'entries');
      console.log('   Sample:', hashtags.slice(0, 3));
    }
  }
}

fix().catch(console.error);
