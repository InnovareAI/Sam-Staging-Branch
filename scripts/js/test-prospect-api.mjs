#!/usr/bin/env node
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://latxadqrvrrrcvkktrog.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

const adminClient = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test fetching prospects for the session
const sessionId = '4628be7e-06cc-4434-a510-f18af19a6432';

console.log(`Testing prospect fetch for session: ${sessionId}`);

const { data, error } = await adminClient
  .from('prospect_approval_data')
  .select('*')
  .eq('session_id', sessionId);

if (error) {
  console.error('Error:', error);
} else {
  console.log(`Found ${data.length} prospects:`);
  console.log(data.slice(0, 3).map(p => ({ id: p.prospect_id, name: p.name })));
}
