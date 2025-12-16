#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';
import 'dotenv/config';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

// Get distinct account types
const { data } = await supabase
  .from('workspace_accounts')
  .select('account_type')
  .limit(100);

const types = [...new Set(data?.map(d => d.account_type))];
console.log('Existing account_type values:', types);
