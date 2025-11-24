#!/usr/bin/env node

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Missing Supabase credentials');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function deleteMonitor() {
  const monitorId = '3e0546ed-73f7-49b7-bb96-6ac2308bf1df'; // Hashtag Monitor - GenAI

  try {
    console.log('🗑️  Deleting hashtag monitor...\n');

    const { error } = await supabase
      .from('linkedin_post_monitors')
      .delete()
      .eq('id', monitorId);

    if (error) {
      console.error('❌ Error:', error.message);
      return;
    }

    console.log('✅ Hashtag monitor deleted successfully!');
    console.log(`   ID: ${monitorId}`);
    console.log('   Name: Hashtag Monitor - Nov 23, 2025');
    console.log('   Hashtags: GenAI\n');

  } catch (error) {
    console.error('❌ Unexpected error:', error);
  }
}

deleteMonitor();
