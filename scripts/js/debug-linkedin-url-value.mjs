#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function debugLinkedInURL() {
  const { data, error } = await supabase
    .from('prospect_approval_data')
    .select('name, contact, linkedin_url')
    .eq('session_id', '8780a551-32f8-4dd1-8226-0354eb2c8297')
    .limit(1)
    .maybeSingle();

  if (error || !data) {
    console.log('❌ Error or no data:', error || 'No data found');
    return;
  }

  console.log('📋 Prospect:', data.name);
  console.log('\n🔍 Raw data:');
  console.log('  contact:', JSON.stringify(data.contact, null, 2));
  console.log('  linkedin_url (direct):', data.linkedin_url);

  console.log('\n🧪 JavaScript evaluations:');
  const url = data.contact?.linkedin_url;
  console.log('  typeof url:', typeof url);
  console.log('  url === "":', url === '');
  console.log('  url === null:', url === null);
  console.log('  url === undefined:', url === undefined);
  console.log('  Boolean(url):', Boolean(url));
  console.log('  url || "":', url || '');
  console.log('  url || null:', url || null);

  console.log('\n✅ After line 432 mapping:');
  const mapped = {
    linkedin_url: data.contact?.linkedin_url || ''
  };
  console.log('  linkedin_url:', mapped.linkedin_url);
  console.log('  Boolean(mapped.linkedin_url):', Boolean(mapped.linkedin_url));

  console.log('\n✅ After line 1501 mapping:');
  const finalMapped = {
    // Simulates: prospect.linkedin_url || prospect.contact?.linkedin_url
    // But contact no longer exists!
    linkedin_url: mapped.linkedin_url || undefined  // prospect.contact is undefined
  };
  console.log('  linkedin_url:', finalMapped.linkedin_url);
}

debugLinkedInURL();
