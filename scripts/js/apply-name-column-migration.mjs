#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import fs from 'fs';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('📝 Applying migration: Add name column to linkedin_post_monitors\n');

    // Read migration file
    const migrationSQL = fs.readFileSync(
      '/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/sql/migrations/017-add-name-column-to-linkedin-post-monitors.sql',
      'utf-8'
    );

    console.log('🔍 Migration SQL:');
    console.log('---');
    console.log(migrationSQL);
    console.log('---\n');

    console.log('⚠️  This migration will:');
    console.log('  1. Add a "name" column to linkedin_post_monitors table');
    console.log('  2. Create an index on the name column');
    console.log('  3. Update existing monitors with default names based on their type\n');

    console.log('📋 INSTRUCTIONS:');
    console.log('  1. Go to Supabase Dashboard: https://supabase.com/dashboard/project/latxadqrvrrrcvkktrog');
    console.log('  2. Click "SQL Editor" in the left sidebar');
    console.log('  3. Click "New Query"');
    console.log('  4. Copy the migration SQL above');
    console.log('  5. Paste it into the SQL editor');
    console.log('  6. Click "Run" to execute the migration\n');

    console.log('✅ After running the migration, run the check-monitor-names.mjs script to verify.');

  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

applyMigration();
