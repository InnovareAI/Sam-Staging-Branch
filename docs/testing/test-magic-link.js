import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function testMagicLink() {
  console.log('Testing magic link Edge Function...');
  
  try {
    const { data, error } = await supabase.functions.invoke('send-magic-link', {
      body: { email: 'tl@innovareai.com' }
    });

    if (error) {
      console.error('❌ Magic link error:', error);
      return;
    }

    console.log('✅ Magic link sent successfully:', data);
  } catch (error) {
    console.error('❌ Test error:', error);
  }
}

testMagicLink();