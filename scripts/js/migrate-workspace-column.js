#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';
import { config } from 'dotenv';
import { readFileSync } from 'fs';
config();

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function runMigration() {
  console.log('🔧 Adding current_workspace_id column to users table...\n');
  
  try {
    // Read the SQL file
    const sql = readFileSync('/Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/migrations/add_current_workspace_id.sql', 'utf8');
    
    console.log('📜 Running SQL migration...\n');
    console.log(sql);
    console.log('\n');
    
    // Execute the SQL
    const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });
    
    if (error) {
      console.error('❌ Migration failed:', error);
      
      // Try alternative: run statements individually
      console.log('\n🔄 Trying alternative approach...');
      
      // Add column
      const { error: alterError } = await supabase.rpc('exec_sql', {
        sql_query: 'ALTER TABLE users ADD COLUMN IF NOT EXISTS current_workspace_id UUID REFERENCES workspaces(id) ON DELETE SET NULL;'
      });
      
      if (alterError) {
        console.error('❌ Failed to add column:', alterError);
      } else {
        console.log('✅ Column added successfully');
      }
      
      // Now run the assign-workspace script to populate it
      console.log('\n🔄 Running workspace assignment...');
      const { execSync } = await import('child_process');
      execSync('node /Users/tvonlinz/Dev_Master/InnovareAI/Sam-New-Sep-7/scripts/js/fix-workspace-prod.js', { stdio: 'inherit' });
      
    } else {
      console.log('✅ Migration completed successfully!');
      console.log('Result:', data);
    }
    
  } catch (error) {
    console.error('❌ Error:', error.message);
  }
}

runMigration().catch(console.error);