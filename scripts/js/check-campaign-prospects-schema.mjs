#!/usr/bin/env node
/**
 * Check campaign_prospects table schema
 */

import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: join(__dirname, '../../.env.local') });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function checkSchema() {
  // Try to insert a minimal record to see what fields are required
  const { error } = await supabase
    .from('campaign_prospects')
    .insert({
      campaign_id: '00000000-0000-0000-0000-000000000000',
      workspace_id: '00000000-0000-0000-0000-000000000000',
      first_name: 'Test',
      linkedin_url: 'https://linkedin.com/in/test'
    });

  console.log('Insert error (expected):');
  console.log(error);
}

checkSchema().catch(console.error);
