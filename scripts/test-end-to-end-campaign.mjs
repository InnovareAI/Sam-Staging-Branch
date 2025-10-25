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
const OPENROUTER_API_KEY = envContent.match(/OPENROUTER_API_KEY=(.*)/)[1].trim();

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

const CAMPAIGN_ID = 'd33a2947-c2e4-4df2-a281-9d16b0bb9702'; // 20251023-BA-Outreach Campaign
const THORSTEN_ACCOUNT_ID = 'mERQmojtSZq5GeomZZazlw';

console.log('\n🚀 END-TO-END LINKEDIN CAMPAIGN TEST\n');
console.log('='.repeat(80) + '\n');
console.log('Campaign: 20251023-BA-Outreach Campaign');
console.log('Sender: Thorsten Linz (InnovareAI)');
console.log('');

// STEP 1: Get prospects and extract LinkedIn IDs
console.log('='.repeat(80) + '\n');
console.log('STEP 1: EXTRACTING LINKEDIN IDs FROM URLs\n');

const { data: prospects, error: prospectError } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('campaign_id', CAMPAIGN_ID);

if (prospectError) {
  console.log('❌ Error:', prospectError.message);
  process.exit(1);
}

console.log(`Found ${prospects.length} prospects\n`);

// Extract LinkedIn IDs from URLs
for (const prospect of prospects) {
  if (prospect.linkedin_url && !prospect.linkedin_user_id) {
    // Parse miniProfileUrn from URL
    const urlMatch = prospect.linkedin_url.match(/miniProfileUrn=([^&]+)/);
    if (urlMatch) {
      const urnEncoded = urlMatch[1];
      const urnDecoded = decodeURIComponent(urnEncoded);
      // Extract the ID from urn:li:fs_miniProfile:ACoAAAA9JlMB...
      const idMatch = urnDecoded.match(/fs_miniProfile:(.+)/);
      if (idMatch) {
        const linkedinId = idMatch[1];
        
        console.log(`✅ Extracted ID for prospect ${prospect.id.substring(0, 8)}...`);
        console.log(`   LinkedIn ID: ${linkedinId}`);
        
        // Update prospect with LinkedIn ID
        const { error: updateError } = await supabase
          .from('campaign_prospects')
          .update({ linkedin_user_id: linkedinId })
          .eq('id', prospect.id);
        
        if (updateError) {
          console.log(`   ❌ Failed to update: ${updateError.message}`);
        } else {
          console.log(`   ✅ Saved to database`);
          prospect.linkedin_user_id = linkedinId; // Update local object
        }
        console.log('');
      }
    }
  }
}

// STEP 2: Generate AI messages
console.log('='.repeat(80) + '\n');
console.log('STEP 2: GENERATING AI MESSAGES\n');

for (const prospect of prospects) {
  if (prospect.linkedin_user_id && !prospect.ai_message) {
    console.log(`📝 Generating message for prospect ${prospect.id.substring(0, 8)}...`);
    
    // Simple AI message generation
    const prompt = `Write a short, personalized LinkedIn connection message for a B2B outreach campaign. 
    
Keep it under 200 characters, professional and friendly. Just return the message text, nothing else.`;

    try {
      const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${OPENROUTER_API_KEY}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          model: 'anthropic/claude-3.5-sonnet',
          messages: [{ role: 'user', content: prompt }],
          max_tokens: 100
        })
      });

      if (!response.ok) {
        console.log(`   ❌ AI generation failed: ${response.status}`);
        continue;
      }

      const data = await response.json();
      const message = data.choices[0].message.content.trim();
      
      console.log(`   Generated: "${message.substring(0, 50)}..."`);
      
      // Save message
      const { error: updateError } = await supabase
        .from('campaign_prospects')
        .update({ ai_message: message })
        .eq('id', prospect.id);
      
      if (updateError) {
        console.log(`   ❌ Failed to save: ${updateError.message}`);
      } else {
        console.log(`   ✅ Saved to database`);
        prospect.ai_message = message; // Update local object
      }
      console.log('');
    } catch (error) {
      console.log(`   ❌ Error: ${error.message}`);
    }
  }
}

// STEP 3: Send via Unipile
console.log('='.repeat(80) + '\n');
console.log('STEP 3: SENDING MESSAGES VIA UNIPILE\n');

console.log(`⚠️  DRY RUN MODE - Not actually sending messages yet`);
console.log(`   Would send ${prospects.length} messages using account: ${THORSTEN_ACCOUNT_ID}\n`);

for (const prospect of prospects) {
  if (prospect.linkedin_user_id && prospect.ai_message) {
    console.log(`📤 Would send to: ${prospect.linkedin_user_id}`);
    console.log(`   Message: "${prospect.ai_message.substring(0, 60)}..."`);
    console.log('');
  } else {
    console.log(`⚠️  Skipping prospect ${prospect.id.substring(0, 8)} - missing data`);
    console.log(`   Has LinkedIn ID: ${!!prospect.linkedin_user_id}`);
    console.log(`   Has AI message: ${!!prospect.ai_message}`);
    console.log('');
  }
}

console.log('='.repeat(80) + '\n');
console.log('📊 SUMMARY\n');
console.log(`Total prospects: ${prospects.length}`);
console.log(`With LinkedIn IDs: ${prospects.filter(p => p.linkedin_user_id).length}`);
console.log(`With AI messages: ${prospects.filter(p => p.ai_message).length}`);
console.log(`Ready to send: ${prospects.filter(p => p.linkedin_user_id && p.ai_message).length}`);
console.log('');
console.log('💡 Next: Remove DRY RUN mode and actually send messages\n');
