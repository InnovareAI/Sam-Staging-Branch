import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function runTenantMigration() {
  console.log('🔧 Running tenant constraint expansion migration...\n')

  try {
    // Step 1: Drop existing constraint
    console.log('1. Dropping existing tenant check constraint...')
    const { error: dropError } = await supabase.rpc('exec', {
      sql: 'ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_tenant_check;'
    })

    if (dropError) {
      console.log('   Using alternative method...')
      // Constraints can't be easily dropped via Supabase client
      // We'll need to update values first, then the constraint will be replaced
    }

    // Step 2: Update tenant values
    console.log('\n2. Updating Sendingcell Workspace tenant...')
    const { error: sendingcellError } = await supabase
      .from('workspaces')
      .update({ tenant: 'sendingcell' })
      .eq('name', 'Sendingcell Workspace')

    if (sendingcellError) {
      console.error('   ❌ Error:', sendingcellError.message)
      console.log('   Constraint prevents update - need to drop constraint first via Supabase Dashboard')
      console.log('\n📋 MANUAL STEPS REQUIRED:')
      console.log('\n1. Go to Supabase Dashboard → SQL Editor')
      console.log('2. Copy and run this migration:\n')
      console.log('─'.repeat(80))
      console.log(`
-- Expand tenant constraints
ALTER TABLE workspaces DROP CONSTRAINT IF EXISTS workspaces_tenant_check;

ALTER TABLE workspaces
ADD CONSTRAINT workspaces_tenant_check CHECK (
  tenant IN ('innovareai', '3cubed', 'sendingcell', 'truepeople', 'wtmatchmaker', 'bluelabel')
);

-- Update tenant values
UPDATE workspaces SET tenant = 'sendingcell' WHERE name = 'Sendingcell Workspace';
UPDATE workspaces SET tenant = 'truepeople' WHERE name = 'True People Consulting';
UPDATE workspaces SET tenant = 'wtmatchmaker' WHERE name = 'WT Matchmaker Workspace';
UPDATE workspaces SET tenant = 'bluelabel' WHERE name = 'Blue Label Labs';
      `.trim())
      console.log('─'.repeat(80))
      return
    }

    console.log('   ✅ Sendingcell updated')

    console.log('\n3. Updating True People Consulting tenant...')
    await supabase
      .from('workspaces')
      .update({ tenant: 'truepeople' })
      .eq('name', 'True People Consulting')
    console.log('   ✅ True People Consulting updated')

    console.log('\n4. Updating WT Matchmaker Workspace tenant...')
    await supabase
      .from('workspaces')
      .update({ tenant: 'wtmatchmaker' })
      .eq('name', 'WT Matchmaker Workspace')
    console.log('   ✅ WT Matchmaker updated')

    console.log('\n5. Updating Blue Label Labs tenant...')
    await supabase
      .from('workspaces')
      .update({ tenant: 'bluelabel' })
      .eq('name', 'Blue Label Labs')
    console.log('   ✅ Blue Label Labs updated')

    console.log('\n✅ Migration complete!')

  } catch (error) {
    console.error('\n❌ Migration failed:', error)
  }
}

runTenantMigration().catch(console.error)
