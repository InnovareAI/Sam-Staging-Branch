import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';

console.log('📇 Stan\'s Prospect Lists in Blue Label Labs');
console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

// Get all prospects
const { data: prospects } = await supabase
  .from('workspace_prospects')
  .select('*')
  .eq('workspace_id', workspaceId)
  .order('created_at', { ascending: false });

console.log('Total Prospects:', prospects?.length || 0);

if (prospects && prospects.length > 0) {
  // Group by date
  const byDate = {};
  for (const p of prospects) {
    const date = new Date(p.created_at).toLocaleDateString();
    if (!byDate[date]) {
      byDate[date] = [];
    }
    byDate[date].push(p);
  }

  console.log('\nGrouped by Creation Date:');
  for (const [date, propsOnDate] of Object.entries(byDate)) {
    console.log(`\n📅 ${date} - ${propsOnDate.length} prospects`);

    // Show first 5 prospects from this date
    for (const p of propsOnDate.slice(0, 5)) {
      console.log(`  - ${p.first_name} ${p.last_name || ''}`);
      console.log(`    ${p.title || 'No title'} at ${p.company || 'Unknown company'}`);
      if (p.linkedin_url) {
        console.log(`    LinkedIn: ${p.linkedin_url}`);
      }
    }
    if (propsOnDate.length > 5) {
      console.log(`  ... and ${propsOnDate.length - 5} more`);
    }
  }
}
