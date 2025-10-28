import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = process.argv[2] || '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('🔧 Fixing LinkedIn URL field name mismatch...');
console.log(`📁 Workspace ID: ${workspaceId}\n`);

// Find prospects with linkedin_profile_url but NULL linkedin_url
const { data: prospectsToFix, error: queryError } = await supabase
  .from('workspace_prospects')
  .select('id, first_name, last_name, company_name, linkedin_profile_url, linkedin_url')
  .eq('workspace_id', workspaceId)
  .is('linkedin_url', null)
  .not('linkedin_profile_url', 'is', null);

if (queryError) {
  console.error('❌ Error querying prospects:', queryError);
  process.exit(1);
}

console.log(`📊 Found ${prospectsToFix?.length || 0} prospects to fix\n`);

if (!prospectsToFix || prospectsToFix.length === 0) {
  console.log('✅ No prospects need fixing!');
  process.exit(0);
}

// Show sample of what will be fixed
console.log('Sample prospects to fix:');
for (const p of prospectsToFix.slice(0, 3)) {
  console.log(`  - ${p.first_name} ${p.last_name || ''} at ${p.company_name || 'Unknown'}`);
  console.log(`    linkedin_url (current): ${p.linkedin_url || 'NULL'}`);
  console.log(`    linkedin_profile_url: ${p.linkedin_profile_url}`);
  console.log('');
}

if (prospectsToFix.length > 3) {
  console.log(`  ... and ${prospectsToFix.length - 3} more\n`);
}

// Proceed with fix
console.log('🔄 Updating linkedin_url field for all prospects...\n');

let successCount = 0;
let errorCount = 0;

for (const prospect of prospectsToFix) {
  try {
    const { error: updateError } = await supabase
      .from('workspace_prospects')
      .update({
        linkedin_url: prospect.linkedin_profile_url,
        updated_at: new Date().toISOString()
      })
      .eq('id', prospect.id);

    if (updateError) {
      console.error(`❌ Failed to update ${prospect.first_name} ${prospect.last_name}:`, updateError.message);
      errorCount++;
    } else {
      successCount++;
      if (successCount % 10 === 0) {
        console.log(`   ... ${successCount}/${prospectsToFix.length} updated`);
      }
    }
  } catch (error) {
    console.error(`❌ Error updating prospect ${prospect.id}:`, error);
    errorCount++;
  }
}

console.log('\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
console.log('✅ Migration Complete!');
console.log(`   Success: ${successCount}`);
console.log(`   Errors: ${errorCount}`);
console.log(`   Total: ${prospectsToFix.length}`);
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Verify the fix
const { count: fixedCount } = await supabase
  .from('workspace_prospects')
  .select('*', { count: 'exact', head: true })
  .eq('workspace_id', workspaceId)
  .not('linkedin_url', 'is', null)
  .not('linkedin_profile_url', 'is', null);

console.log(`🔍 Verification: ${fixedCount || 0} prospects now have both fields populated`);
