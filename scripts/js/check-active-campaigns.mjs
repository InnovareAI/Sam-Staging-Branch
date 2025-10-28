import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Checking ALL campaigns...\n');

const { data: campaigns } = await supabase
  .from('campaigns')
  .select('id, name, status, workspace_id, workspaces(name)')
  .order('created_at', { ascending: false });

console.log('Total campaigns:', campaigns?.length || 0, '\n');

// Group by status
const byStatus = new Map();
for (const c of campaigns || []) {
  if (!byStatus.has(c.status)) {
    byStatus.set(c.status, []);
  }
  byStatus.get(c.status).push(c);
}

for (const [status, camps] of byStatus.entries()) {
  console.log(status.toUpperCase() + ':', camps.length);
  for (const c of camps) {
    console.log('  -', c.name, '(' + (c.workspaces?.name || 'Unknown') + ')');
  }
  console.log('');
}

// Check for any with NULL status
const { data: nullStatus } = await supabase
  .from('campaigns')
  .select('*')
  .is('status', null);

if (nullStatus && nullStatus.length > 0) {
  console.log('CAMPAIGNS WITH NULL STATUS:', nullStatus.length);
  for (const c of nullStatus) {
    console.log('  -', c.name);
  }
}
