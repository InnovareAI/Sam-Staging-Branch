const SUPABASE_URL = 'https://latxadqrvrrrcvkktrog.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ';

async function fix() {
  // 1. Unpause Sebastian campaign
  const resp1 = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?name=ilike.*Sebastian*`, {
    method: 'PATCH',
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      'Prefer': 'return=representation'
    },
    body: JSON.stringify({ status: 'active' })
  });
  const data1 = await resp1.json();
  console.log('Sebastian campaign unpaused:', data1);

  // 2. Get ASP campaign
  const resp2 = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?name=ilike.*ASP*Company*Follow*&select=id`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const campaigns = await resp2.json();
  if (!campaigns.length) {
    console.log('ASP campaign not found');
    return;
  }
  const aspCampaignId = campaigns[0].id;
  console.log('ASP Campaign ID:', aspCampaignId);

  // 3. Get pending prospects for ASP
  const resp3 = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?campaign_id=eq.${aspCampaignId}&status=eq.pending&select=id,prospect_id,first_name,last_name`, {
    headers: {
      'apikey': SUPABASE_KEY,
      'Authorization': `Bearer ${SUPABASE_KEY}`
    }
  });
  const prospects = await resp3.json();
  console.log(`Found ${prospects.length} pending prospects for ASP`);

  // 4. Insert into send_queue
  const queueItems = prospects.map(p => ({
    campaign_id: aspCampaignId,
    prospect_id: p.prospect_id,
    campaign_prospect_id: p.id,
    scheduled_for: new Date().toISOString(),
    status: 'pending',
    message_type: 'connection_request'
  }));

  if (queueItems.length > 0) {
    const resp4 = await fetch(`${SUPABASE_URL}/rest/v1/send_queue`, {
      method: 'POST',
      headers: {
        'apikey': SUPABASE_KEY,
        'Authorization': `Bearer ${SUPABASE_KEY}`,
        'Content-Type': 'application/json',
        'Prefer': 'return=representation'
      },
      body: JSON.stringify(queueItems)
    });
    const queueData = await resp4.json();
    console.log(`Inserted ${queueData.length || 0} items into send_queue`);
  }
}

fix().catch(console.error);
