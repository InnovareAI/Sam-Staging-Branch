#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const unipileAccountId = 'lN6tdIWOStK_dEaxhygCEQ';

console.log('🔧 FIXING ALL PROSPECTS WITH MISSING DATA\n');

// Get ALL prospects with missing first_name OR last_name OR company_name
const { data: broken } = await supabase
  .from('campaign_prospects')
  .select('*')
  .or('first_name.eq.,last_name.eq.,company_name.is.null,company_name.eq.')
  .not('linkedin_url', 'is', null)
  .limit(100);

console.log(`Found ${broken?.length || 0} prospects to fix\n`);

if (!broken || broken.length === 0) {
  console.log('✅ No broken prospects found');
  process.exit(0);
}

let fixed = 0;
let errors = 0;

for (const prospect of broken) {
  try {
    const linkedinUsername = prospect.linkedin_url.split('/in/')[1]?.split('?')[0]?.replace('/', '');
    
    if (!linkedinUsername) {
      console.log(`❌ ${prospect.id.substring(0,8)}: Invalid LinkedIn URL`);
      errors++;
      continue;
    }

    const profileUrl = `https://${process.env.UNIPILE_DSN}/api/v1/users/${linkedinUsername}?account_id=${unipileAccountId}`;
    
    const response = await fetch(profileUrl, {
      method: 'GET',
      headers: {
        'X-API-KEY': process.env.UNIPILE_API_KEY
      }
    });

    if (!response.ok) {
      console.log(`❌ ${linkedinUsername}: API error ${response.status}`);
      errors++;
      continue;
    }

    const data = await response.json();
    
    const firstName = data.first_name || data.display_name?.split(' ')[0] || prospect.first_name || '';
    const lastName = data.last_name || data.display_name?.split(' ').slice(1).join(' ') || prospect.last_name || '';
    const company = data.company_name || data.company?.name || prospect.company_name || '';
    
    if (!firstName && !lastName) {
      console.log(`⚠️  ${linkedinUsername}: No name in LinkedIn profile`);
      errors++;
      continue;
    }

    const { error: updateError } = await supabase
      .from('campaign_prospects')
      .update({
        first_name: firstName,
        last_name: lastName,
        company_name: company || 'Unknown Company'
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.log(`❌ ${linkedinUsername}: ${updateError.message}`);
      errors++;
    } else {
      console.log(`✅ ${firstName} ${lastName} at ${company || 'Unknown'}`);
      fixed++;
    }
    
    await new Promise(resolve => setTimeout(resolve, 1000));
    
  } catch (error) {
    errors++;
  }
}

console.log(`\n✅ FIXED: ${fixed} prospects`);
console.log(`❌ ERRORS: ${errors} prospects`);
