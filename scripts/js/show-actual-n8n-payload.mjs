#!/usr/bin/env node
/**
 * Show the actual payload being sent to N8N
 */
import 'dotenv/config';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

const campaignId = '5067bfd4-e4c6-4082-a242-04323c8860c8';
const workspaceId = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

console.log('📦 Fetching campaign data to simulate N8N payload\n');

// Get campaign
const cRes = await fetch(`${SUPABASE_URL}/rest/v1/campaigns?select=*&id=eq.${campaignId}`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const campaign = (await cRes.json())[0];

// Get prospects  
const pRes = await fetch(`${SUPABASE_URL}/rest/v1/campaign_prospects?select=*&campaign_id=eq.${campaignId}&status=eq.pending&limit=2`, {
  headers: { 'apikey': SUPABASE_KEY, 'Authorization': `Bearer ${SUPABASE_KEY}` }
});
const prospects = await pRes.json();

console.log(`Campaign: ${campaign.name}`);
console.log(`Prospects: ${prospects.length}\n`);

// Show what the buildCampaignData function would create
const campaignData = {
  name: campaign.name,
  description: campaign.description,
  status: campaign.status,
  channel: campaign.channel,
  message_templates: campaign.message_templates,
  prospects: prospects.map(p => ({
    id: p.id,
    first_name: p.first_name,
    last_name: p.last_name,
    company: p.company_name,
    job_title: p.title,
    linkedin_url: p.linkedin_url,
    linkedin_id: p.linkedin_user_id,
    email: p.email,
    location: p.location,
    industry: p.industry
  }))
};

console.log('📋 campaign_data structure:');
console.log(JSON.stringify(campaignData, null, 2));
