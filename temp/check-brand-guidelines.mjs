import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const { data: guidelines } = await supabase
  .from('linkedin_brand_guidelines')
  .select('*')
  .eq('workspace_id', 'd4e5f6a7-b8c9-0123-def4-567890123456')
  .single();

console.log('\n📋 BRAND GUIDELINES:\n');
console.log(JSON.stringify(guidelines, null, 2));
