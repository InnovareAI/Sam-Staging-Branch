import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Analyzing prospect_approval_data workspace associations...\n');

// Check workspace_id distribution
const { data: all, error } = await supabase
  .from('prospect_approval_data')
  .select('workspace_id, created_at')
  .order('created_at', { ascending: false });

if (error) {
  console.log('Error querying data:', error.message);
  process.exit(1);
}

if (!all || all.length === 0) {
  console.log('No prospect_approval_data found in database');
  process.exit(0);
}

const withWorkspace = all.filter(p => p.workspace_id);
const withoutWorkspace = all.filter(p => !p.workspace_id);

console.log('Prospect Approval Data Analysis:');
console.log('================================');
console.log('Total records:', all.length);
console.log('With workspace_id:', withWorkspace.length);
console.log('WITHOUT workspace_id (ORPHANED):', withoutWorkspace.length);
console.log('');

if (withWorkspace.length > 0) {
  // Group by workspace
  const byWorkspace = new Map();
  for (const p of withWorkspace) {
    const count = byWorkspace.get(p.workspace_id) || 0;
    byWorkspace.set(p.workspace_id, count + 1);
  }

  console.log('Records by workspace:');
  for (const [wsId, count] of byWorkspace.entries()) {
    // Get workspace name
    const { data: ws } = await supabase
      .from('workspaces')
      .select('name')
      .eq('id', wsId)
      .single();

    console.log(`  ${ws?.name || 'Unknown'} (${wsId.substring(0, 8)}...): ${count} records`);
  }
  console.log('');
}

if (withoutWorkspace.length > 0) {
  const oldest = withoutWorkspace[withoutWorkspace.length - 1];
  const newest = withoutWorkspace[0];
  console.log('⚠️  ORPHANED RECORDS (NO WORKSPACE):');
  console.log('  Count:', withoutWorkspace.length);
  console.log('  Oldest:', new Date(oldest.created_at).toLocaleString());
  console.log('  Newest:', new Date(newest.created_at).toLocaleString());
  console.log('');
  console.log('❌ These records are invisible to all users!');
}

// Calculate percentage
const percentageOrphaned = ((withoutWorkspace.length / all.length) * 100).toFixed(1);
console.log('');
console.log(`IMPACT: ${percentageOrphaned}% of all prospect data is orphaned`);
