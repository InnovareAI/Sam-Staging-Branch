#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

dotenv.config({ path: join(__dirname, '../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔍 Finding prospects that were marked sent but never reached LinkedIn...\n');

// These are prospects we tested that showed "already sent" in Unipile
// but were never actually sent to LinkedIn
const TEST_PROSPECTS = [
  'Joel Baker',
  'Tobi Oladimeji', 
  'David Pisarek',
  'Armin M.',
  'Alexander W.',
  'Frederic Bastien',
  'Nima Aryan',
  'David Racicot',
  'Hyelim Juliana KIM',
  'Sébastien Dault',
  'Paul Landry'
];

// Find these prospects in database
for (const name of TEST_PROSPECTS) {
  const [firstName, ...lastNameParts] = name.split(' ');
  const lastName = lastNameParts.join(' ');
  
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('id, first_name, last_name, status')
    .eq('first_name', firstName)
    .eq('last_name', lastName)
    .single();
  
  if (prospect) {
    console.log(`${firstName} ${lastName}: status=${prospect.status}`);
    
    if (prospect.status !== 'pending') {
      // Reset to pending
      const { error } = await supabase
        .from('campaign_prospects')
        .update({ 
          status: 'pending',
          contacted_at: null,
          scheduled_send_at: null
        })
        .eq('id', prospect.id);
      
      if (error) {
        console.log(`   ❌ Failed to reset: ${error.message}`);
      } else {
        console.log(`   ✅ Reset to pending`);
      }
    }
  }
}

console.log('\n✅ Done\n');
