import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Manually triggering test campaign 11 execution...\n');

// Call the execute-live API directly
const response = await fetch('http://localhost:3000/api/campaigns/linkedin/execute-live', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'x-internal-trigger': 'manual-script'
  },
  body: JSON.stringify({
    campaignId: 'b1fac757-f032-40a4-8daf-77b8cdb25268',
    maxProspects: 2,
    dryRun: false
  })
});

if (!response.ok) {
  console.log('Error:', response.status, response.statusText);
  const text = await response.text();
  console.log('Response:', text);
} else {
  const result = await response.json();
  console.log('SUCCESS:', JSON.stringify(result, null, 2));
}
