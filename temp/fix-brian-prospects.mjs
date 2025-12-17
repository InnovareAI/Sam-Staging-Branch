import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

async function fix() {
  const brianWsId = 'aa1a214c-02f0-4f3a-8849-92c7a50ee4f7';
  const campId = '64c672da-fb0c-42f3-861e-a47fa29ac06b';

  // Get approved prospects
  const { data: approved } = await supabase
    .from('prospect_approval_data')
    .select('*')
    .eq('workspace_id', brianWsId)
    .eq('approval_status', 'approved');

  console.log('Approved prospects:', approved?.length || 0);

  // Get existing campaign prospect URLs
  const { data: existing } = await supabase
    .from('campaign_prospects')
    .select('linkedin_url')
    .eq('campaign_id', campId);

  const existingUrls = new Set(existing?.map(e => e.linkedin_url) || []);
  console.log('Existing in campaign:', existingUrls.size);

  // Filter to only prospects not in campaign
  const toAdd = approved?.filter(p => {
    const url = p.contact?.linkedin_url;
    return url && !existingUrls.has(url);
  }) || [];

  console.log('To add:', toAdd.length);

  if (toAdd.length === 0) {
    console.log('Nothing to add');
    return;
  }

  // Prepare records - using correct column names
  const records = toAdd.map(p => {
    const nameParts = (p.name || '').split(' ');
    const firstName = nameParts[0] || '';
    const lastName = nameParts.slice(1).join(' ') || '';

    return {
      campaign_id: campId,
      workspace_id: brianWsId,
      first_name: firstName,
      last_name: lastName,
      linkedin_url: p.contact?.linkedin_url,
      email: p.contact?.email || null,
      company_name: p.company?.name || null,  // Fixed column name
      title: p.title || null,
      location: p.location || null,
      status: 'pending',
      connection_degree: p.connection_degree || null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
  });

  // Insert in batches
  const BATCH_SIZE = 100;
  let inserted = 0;

  for (let i = 0; i < records.length; i += BATCH_SIZE) {
    const batch = records.slice(i, i + BATCH_SIZE);
    const { error } = await supabase
      .from('campaign_prospects')
      .insert(batch);

    if (error) {
      console.log('Error at batch', i, ':', error.message);
    } else {
      inserted += batch.length;
      console.log('Inserted batch', Math.floor(i / BATCH_SIZE) + 1, '-', inserted, 'total');
    }
  }

  console.log('\nDone! Inserted', inserted, 'prospects');

  // Verify final count
  const { count } = await supabase
    .from('campaign_prospects')
    .select('*', { count: 'exact', head: true })
    .eq('campaign_id', campId);

  console.log('Final campaign prospect count:', count);
}

fix().catch(console.error);
