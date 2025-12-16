#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

console.log('Updating account_type constraint...');

// Use RPC to run raw SQL
const { error: dropError } = await supabase.rpc('exec_sql', {
  query: 'ALTER TABLE workspace_accounts DROP CONSTRAINT IF EXISTS workspace_accounts_account_type_check'
});

if (dropError) {
  console.log('Drop constraint (may not exist):', dropError.message);
}

const { error: addError } = await supabase.rpc('exec_sql', {
  query: `ALTER TABLE workspace_accounts ADD CONSTRAINT workspace_accounts_account_type_check CHECK (account_type IN ('linkedin', 'email', 'google_calendar', 'google', 'outlook_calendar', 'calcom', 'calendly'))`
});

if (addError) {
  console.log('Add constraint error:', addError.message);
} else {
  console.log('✅ Constraint updated');
}
