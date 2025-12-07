import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('\n🔧 FIXING STUCK PENDING PROSPECT e49405d2 (V2)\n');

const prospectId = 'e49405d2-9b49-4192-9d70-7007cf7df7ac';

// Get full prospect details
const { data: prospect } = await supabase
  .from('campaign_prospects')
  .select('*')
  .eq('id', prospectId)
  .single();

console.log('Current state:');
console.log(`  ID: ${prospect.id}`);
console.log(`  First Name: ${prospect.first_name || 'NULL'}`);
console.log(`  Last Name: ${prospect.last_name || 'NULL'}`);
console.log(`  Status: ${prospect.status}`);
console.log(`  Validation Status: ${prospect.validation_status || 'NULL'}`);
console.log(`  LinkedIn URL: ${prospect.linkedin_url}`);
console.log(`  Campaign: ${prospect.campaign_id}`);
console.log(`  Created: ${new Date(prospect.created_at).toLocaleString()}`);

const daysOld = Math.floor((Date.now() - new Date(prospect.created_at).getTime()) / (1000 * 60 * 60 * 24));
console.log(`  Days old: ${daysOld}`);

// Determine if we need to fix
let needsFix = false;
let reason = [];

if (!prospect.first_name || !prospect.last_name) {
  needsFix = true;
  reason.push('Missing name fields');
}

if (prospect.status === 'pending' && daysOld >= 3) {
  needsFix = true;
  reason.push(`Stuck in pending for ${daysOld} days`);
}

if (needsFix) {
  console.log(`\n⚠️  NEEDS FIX: ${reason.join(', ')}`);

  // Extract name from LinkedIn URL if missing
  let firstName = prospect.first_name;
  let lastName = prospect.last_name;

  if ((!firstName || !lastName) && prospect.linkedin_url) {
    const match = prospect.linkedin_url.match(/linkedin\.com\/in\/([^\/\?#]+)/);
    if (match) {
      const vanity = match[1];
      // For "allennatian", split into parts
      const parts = vanity.split('-');

      if (parts.length >= 2) {
        firstName = parts[0].charAt(0).toUpperCase() + parts[0].slice(1);
        lastName = parts.slice(1).join(' ').charAt(0).toUpperCase() + parts.slice(1).join(' ').slice(1);
      } else {
        // Single word vanity - use as last name
        lastName = vanity.charAt(0).toUpperCase() + vanity.slice(1);
        firstName = 'Unknown';
      }
    }
  }

  const updates = {};

  if (firstName && !prospect.first_name) {
    updates.first_name = firstName;
  }

  if (lastName && !prospect.last_name) {
    updates.last_name = lastName;
  }

  // If stuck in pending for >3 days, move to validated (ready for approval)
  if (prospect.status === 'pending' && daysOld >= 3) {
    updates.status = 'validated';
    updates.validation_status = 'valid';
    updates.validated_at = new Date().toISOString();
  }

  if (Object.keys(updates).length > 0) {
    console.log('\nApplying fixes:');
    Object.entries(updates).forEach(([key, value]) => {
      const current = prospect[key] || 'NULL';
      console.log(`  ${key}: ${current} → ${value}`);
    });

    const { error } = await supabase
      .from('campaign_prospects')
      .update(updates)
      .eq('id', prospectId);

    if (error) {
      console.error('\n❌ Error updating prospect:', error.message);
    } else {
      console.log('\n✅ Prospect fixed successfully');

      // Verify the fix
      const { data: updated } = await supabase
        .from('campaign_prospects')
        .select('first_name, last_name, status, validation_status')
        .eq('id', prospectId)
        .single();

      console.log('\nVerification:');
      console.log(`  First Name: ${updated.first_name}`);
      console.log(`  Last Name: ${updated.last_name}`);
      console.log(`  Status: ${updated.status}`);
      console.log(`  Validation Status: ${updated.validation_status}`);
    }
  } else {
    console.log('\n⚠️  No updates needed');
  }
} else {
  console.log('\n✅ Prospect is OK (no fix needed)');
}

console.log('\n');
