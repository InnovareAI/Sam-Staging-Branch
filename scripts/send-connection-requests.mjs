#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const envPath = path.join(__dirname, '..', '.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');
const SUPABASE_URL = envContent.match(/NEXT_PUBLIC_SUPABASE_URL=(.*)/)[1].trim();
const SERVICE_ROLE_KEY = envContent.match(/SUPABASE_SERVICE_ROLE_KEY=(.*)/)[1].trim();
const UNIPILE_DSN = envContent.match(/UNIPILE_DSN=(.*)/)[1].trim();
const UNIPILE_API_KEY = envContent.match(/UNIPILE_API_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CAMPAIGN_ID = 'd33a2947-c2e4-4df2-a281-9d16b0bb9702'; // 20251023-BA-Outreach
const SENDER_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw'; // Thorsten Linz

console.log('\n🤝 SENDING LINKEDIN CONNECTION REQUESTS\n');
console.log('='.repeat(80) + '\n');
console.log(`Campaign: 20251023-BA-Outreach Campaign`);
console.log(`Sender: Thorsten Linz (${SENDER_ACCOUNT_ID})`);
console.log('');

// STEP 1: Get campaign prospects
console.log('='.repeat(80) + '\n');
console.log('STEP 1: FETCHING CAMPAIGN PROSPECTS\n');

const { data: prospects, error: prospectError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID);

if (prospectError) {
  console.log('❌ Error:', prospectError.message);
  process.exit(1);
}

console.log(`Found ${prospects.length} prospects\n`);

// STEP 2: For each prospect, get LinkedIn profile and send connection request
for (const prospect of prospects) {
  console.log('='.repeat(80) + '\n');
  console.log(`PROCESSING PROSPECT: ${prospect.id.substring(0, 8)}...\n`);
  
  if (!prospect.linkedin_url) {
    console.log('⚠️  No LinkedIn URL - skipping\n');
    continue;
  }
  
  // Extract profile name from URL (e.g., johnonit from linkedin.com/in/johnonit)
  const profileMatch = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?]+)/);
  if (!profileMatch) {
    console.log('⚠️  Could not parse LinkedIn profile name - skipping\n');
    continue;
  }
  
  const profileName = profileMatch[1];
  console.log(`LinkedIn Profile: ${profileName}`);
  console.log(`Full URL: ${prospect.linkedin_url}`);
  console.log('');
  
  // STEP 2A: Get profile to extract provider_id
  console.log('📡 Fetching profile from Unipile...');
  
  const profileUrl = `https://${UNIPILE_DSN}/api/v1/users/${profileName}?account_id=${SENDER_ACCOUNT_ID}`;
  
  try {
    const profileResponse = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Accept': 'application/json'
      }
    });
    
    if (!profileResponse.ok) {
      const error = await profileResponse.text();
      console.log(`❌ Failed to fetch profile (${profileResponse.status}): ${error.substring(0, 100)}\n`);
      continue;
    }
    
    const profileData = await profileResponse.json();
    console.log(`✅ Profile found: ${profileData.first_name} ${profileData.last_name}`);
    console.log(`   Provider ID: ${profileData.provider_id}`);
    console.log('');
    
    // Save LinkedIn internal ID
    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({ linkedin_user_id: profileData.provider_id })
      .eq('id', prospect.id);
    
    if (updateError) {
      console.log(`⚠️  Failed to save LinkedIn ID: ${updateError.message}`);
    } else {
      console.log(`✅ Saved LinkedIn ID to database`);
    }
    console.log('');
    
    // STEP 2B: Generate personalized connection message
    console.log('✍️  Generating connection message...');
    
    const message = `Hi ${profileData.first_name}, I came across your profile and would love to connect. Looking forward to exchanging ideas!`;
    console.log(`   Message: "${message}"`);
    console.log('');
    
    // Save message to database
    const { error: msgError } = await supabase
      .from('campaign_prospects')
      .update({ ai_message: message })
      .eq('id', prospect.id);
    
    if (msgError) {
      console.log(`⚠️  Failed to save message: ${msgError.message}`);
    }
    
    // STEP 2C: Send connection request
    console.log('🚀 Sending connection request...');
    
    const inviteUrl = `https://${UNIPILE_DSN}/api/v1/users/invite`;
    const requestBody = {
      provider_id: profileData.provider_id,
      account_id: SENDER_ACCOUNT_ID,
      message: message
    };
    
    const inviteResponse = await fetch(inviteUrl, {
      method: 'POST',
      headers: {
        'X-API-KEY': UNIPILE_API_KEY,
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify(requestBody)
    });
    
    if (inviteResponse.ok) {
      const result = await inviteResponse.json();
      console.log(`✅ Connection request sent successfully!`);
      
      // Update status
      const { error: statusError } = await supabase
        .from('campaign_prospects')
        .update({ 
          message_status: 'sent',
          sent_at: new Date().toISOString()
        })
        .eq('id', prospect.id);
      
      if (!statusError) {
        console.log(`✅ Updated status to 'sent'`);
      }
      
    } else {
      const errorText = await inviteResponse.text();
      console.log(`❌ Connection request failed (${inviteResponse.status})`);
      console.log(`   Error: ${errorText.substring(0, 200)}`);
      
      // Try without message as fallback
      console.log('\n🔄 Retrying without message...');
      const retryResponse = await fetch(inviteUrl, {
        method: 'POST',
        headers: {
          'X-API-KEY': UNIPILE_API_KEY,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          provider_id: profileData.provider_id,
          account_id: SENDER_ACCOUNT_ID
        })
      });
      
      if (retryResponse.ok) {
        console.log(`✅ Connection request sent (without message)`);
        
        await supabase
          .from('campaign_prospects')
          .update({ 
            message_status: 'sent',
            sent_at: new Date().toISOString()
          })
          .eq('id', prospect.id);
      } else {
        const retryError = await retryResponse.text();
        console.log(`❌ Retry also failed: ${retryError.substring(0, 100)}`);
      }
    }
    
    console.log('');
    
    // Rate limiting - wait 2 seconds between requests
    if (prospects.indexOf(prospect) < prospects.length - 1) {
      console.log('⏳ Waiting 2 seconds before next request...\n');
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
    
  } catch (error) {
    console.log(`❌ Error: ${error.message}\n`);
    continue;
  }
}

console.log('='.repeat(80) + '\n');
console.log('✅ CONNECTION REQUEST CAMPAIGN COMPLETE\n');
