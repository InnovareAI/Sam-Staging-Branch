#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';
import { readFileSync } from 'fs';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('🔧 Applying Schema Standardization Migration\n');
console.log('⚠️  This will rename columns in workspace_prospects');
console.log('   Affects ALL workspaces!\n');

const migrations = [
  {
    name: 'Rename linkedin_profile_url to linkedin_url',
    sql: `ALTER TABLE workspace_prospects RENAME COLUMN linkedin_profile_url TO linkedin_url;`
  },
  {
    name: 'Rename email_address to email',
    sql: `ALTER TABLE workspace_prospects RENAME COLUMN email_address TO email;`
  },
  {
    name: 'Rename job_title to title',
    sql: `ALTER TABLE workspace_prospects RENAME COLUMN job_title TO title;`
  },
  {
    name: 'Drop old index',
    sql: `DROP INDEX IF EXISTS idx_workspace_prospects_linkedin_url;`
  },
  {
    name: 'Create new index on linkedin_url',
    sql: `CREATE INDEX idx_workspace_prospects_linkedin_url ON workspace_prospects(linkedin_url);`
  },
  {
    name: 'Drop old unique constraint',
    sql: `ALTER TABLE workspace_prospects DROP CONSTRAINT IF EXISTS workspace_prospects_workspace_id_linkedin_profile_url_key;`
  },
  {
    name: 'Add new unique constraint',
    sql: `ALTER TABLE workspace_prospects ADD CONSTRAINT workspace_prospects_workspace_id_linkedin_url_key UNIQUE (workspace_id, linkedin_url);`
  },
  {
    name: 'Update resolve_campaign_linkedin_ids function',
    sql: `CREATE OR REPLACE FUNCTION resolve_campaign_linkedin_ids(
  p_campaign_id UUID,
  p_user_id UUID
) RETURNS TABLE (
  prospect_id UUID,
  linkedin_url TEXT,
  linkedin_internal_id TEXT,
  resolution_status TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT
    cp.prospect_id,
    wp.linkedin_url,
    lc.linkedin_internal_id,
    CASE
      WHEN lc.linkedin_internal_id IS NOT NULL THEN 'found'
      ELSE 'not_found'
    END as resolution_status
  FROM campaign_prospects cp
  JOIN workspace_prospects wp ON cp.prospect_id = wp.id
  LEFT JOIN linkedin_contacts lc ON wp.linkedin_url = lc.linkedin_profile_url
  WHERE cp.campaign_id = p_campaign_id;
END;
$$ LANGUAGE plpgsql;`
  }
];

console.log('📋 Migration steps:');
migrations.forEach((m, i) => {
  console.log(`   ${i + 1}. ${m.name}`);
});
console.log('');

let errors = 0;
let success = 0;

for (const migration of migrations) {
  try {
    console.log(`⏳ ${migration.name}...`);

    const { error } = await supabase.rpc('exec_sql', {
      sql_query: migration.sql
    });

    if (error) {
      // Try direct execution if RPC fails
      const response = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/rpc/exec_sql`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'apikey': process.env.SUPABASE_SERVICE_ROLE_KEY,
          'Authorization': `Bearer ${process.env.SUPABASE_SERVICE_ROLE_KEY}`
        },
        body: JSON.stringify({ sql_query: migration.sql })
      });

      if (!response.ok) {
        console.log(`   ❌ Failed: ${error?.message || 'Unknown error'}`);
        console.log(`   SQL: ${migration.sql.substring(0, 100)}...`);
        errors++;

        // For column rename errors, check if already renamed
        if (migration.name.includes('Rename') && error?.message?.includes('does not exist')) {
          console.log(`   ℹ️  Column may already be renamed - continuing...`);
        } else {
          throw error;
        }
      } else {
        console.log(`   ✅ Success`);
        success++;
      }
    } else {
      console.log(`   ✅ Success`);
      success++;
    }

  } catch (err) {
    console.log(`   ❌ Error: ${err.message}`);
    errors++;
  }
}

console.log(`\n📊 Migration Results:`);
console.log(`   ✅ Successful: ${success}/${migrations.length}`);
console.log(`   ❌ Failed: ${errors}/${migrations.length}`);

if (errors > 0) {
  console.log(`\n⚠️  Some migrations failed. This is expected if columns are already renamed.`);
  console.log(`   Run verification script to check: node scripts/js/verify-schema-standardization.mjs`);
} else {
  console.log(`\n✅ All migrations completed successfully!`);
  console.log(`   Run verification: node scripts/js/verify-schema-standardization.mjs`);
}
