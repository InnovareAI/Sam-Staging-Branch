import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
);

const sessionId = '51b7df55-6ef0-4f0c-8ad9-73ba1b7ab96c'; // Most recent session

console.log('🔍 Verifying LinkedIn import is working\n');
console.log(`Session ID: ${sessionId}\n`);

// Get all prospects for this session
const { data: prospects, error } = await supabase
  .from('prospect_approval_data')
  .select('*')
  .eq('session_id', sessionId)
  .limit(5);

if (error) {
  console.log('❌ Error:', error.message);
  process.exit(1);
}

if (!prospects || prospects.length === 0) {
  console.log('❌ No prospects found in this session');
  process.exit(1);
}

console.log('✅ Found prospects! Schema:\n');
console.log('Available columns:', Object.keys(prospects[0]).join(', '));

// Count total
const { count, error: countError } = await supabase
  .from('prospect_approval_data')
  .select('*', { count: 'exact', head: true })
  .eq('session_id', sessionId);

if (countError) {
  console.log('❌ Count error:', countError.message);
} else {
  console.log(`\n✅ Total prospects in session: ${count}`);
}

// Show sample data
console.log('\n📋 Sample prospects:\n');
prospects.forEach((p, i) => {
  const name = p.name || `${p.contact?.name || 'Unknown'}`;
  const position = p.position || p.contact?.position || 'Unknown';
  const company = p.company || p.contact?.company || 'Unknown';

  console.log(`${i + 1}. ${name}`);
  console.log(`   ${position} at ${company}`);
  console.log('');
});

// Check if import is complete or still running
const { data: session } = await supabase
  .from('prospect_approval_sessions')
  .select('*')
  .eq('id', sessionId)
  .single();

console.log('📊 Session Status:\n');
console.log(`  Campaign: ${session.campaign_name}`);
console.log(`  Total prospects: ${session.total_prospects}`);
console.log(`  Status: ${session.status}`);
console.log(`  Created: ${session.created_at}`);

if (count && count === session.total_prospects) {
  console.log(`\n✅ Import complete! All ${count} prospects saved.`);
} else {
  console.log(`\n⚠️  Mismatch: Session says ${session.total_prospects}, DB has ${count}`);
}

// Check if we're getting more than 50
if (count && count > 50) {
  console.log(`\n🎉 SUCCESS! Pagination is working - got ${count} prospects (not limited to 50)`);
} else if (count === 50) {
  console.log('\n⚠️  Only 50 prospects - pagination may not be working');
}
