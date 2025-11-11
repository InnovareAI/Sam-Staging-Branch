#!/usr/bin/env node

/**
 * Fix Francois's LinkedIn URL - remove special characters
 */

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

config({ path: join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL;
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

async function fixFrancoisUrl() {
  console.log('🔧 Fixing Francois LinkedIn URL\n');

  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
    auth: { persistSession: false }
  });

  // Find Francois
  const { data: prospect } = await supabase
    .from('campaign_prospects')
    .select('*')
    .ilike('first_name', '%francois%')
    .ilike('last_name', '%senez%')
    .single();

  if (!prospect) {
    console.error('❌ Francois not found');
    return;
  }

  console.log('Found:', prospect.first_name, prospect.last_name);
  console.log('Current URL:', prospect.linkedin_url);
  console.log('Status:', prospect.status);

  // Option 1: Clean the URL (remove special characters)
  const cleanUrl = 'https://www.linkedin.com/in/francois-senez-5364a515';

  console.log('\nCleaned URL:', cleanUrl);
  console.log('(Removed MBA, SCR® credentials from URL)');

  // Update with clean URL
  const { data: updated, error } = await supabase
    .from('campaign_prospects')
    .update({
      linkedin_url: cleanUrl,
      status: 'pending' // Reset to pending so it can be retried
    })
    .eq('id', prospect.id)
    .select()
    .single();

  if (error) {
    console.error('❌ Error:', error.message);
    return;
  }

  console.log('\n✅ Updated!');
  console.log('New URL:', updated.linkedin_url);
  console.log('Status:', updated.status);
  console.log('\n💡 Francois will be retried in next batch');
}

fixFrancoisUrl().catch(console.error);
