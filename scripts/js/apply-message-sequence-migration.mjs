#!/usr/bin/env node

/**
 * Apply message_sequence migration to campaigns table
 */

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  console.log('\n🔧 Applying message_sequence migration...\n');

  const migration = `
    -- Add the message_sequence column to the campaigns table
    ALTER TABLE campaigns
    ADD COLUMN IF NOT EXISTS message_sequence JSONB;

    -- Add a comment for clarity
    COMMENT ON COLUMN campaigns.message_sequence IS 'Stores the array of message objects for the campaign, including connection request and follow-ups with timestamps.';
  `;

  // Split into individual statements
  const statements = migration
    .split(';')
    .map(s => s.trim())
    .filter(s => s && !s.startsWith('--'));

  for (const statement of statements) {
    console.log('Executing:', statement.substring(0, 80) + '...');
    
    const { error } = await supabase.rpc('exec_sql', { 
      sql: statement 
    });

    if (error) {
      console.error('❌ Error:', error.message);
    } else {
      console.log('✅ Success');
    }
  }

  console.log('\n✅ Migration complete!\n');
  
  // Verify
  const { data: campaign } = await supabase
    .from('campaigns')
    .select('message_sequence')
    .limit(1)
    .single();

  if ('message_sequence' in campaign) {
    console.log('✅ Verification: message_sequence column exists\n');
  } else {
    console.log('⚠️  Verification failed: column might not exist\n');
  }
}

applyMigration();
