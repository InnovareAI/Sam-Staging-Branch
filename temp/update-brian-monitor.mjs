import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

// Load env
const envContent = readFileSync('.env.local', 'utf-8');
envContent.split('\n').forEach(line => {
  const match = line.match(/^([^#=]+)=(.*)$/);
  if (match) {
    process.env[match[1].trim()] = match[2].trim().replace(/^["']|["']$/g, '');
  }
});

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function main() {
  const monitorId = 'b7c12560-9e24-4430-9ff9-bf738ba9c235';

  // Update Brian's monitor with his specific settings
  const { data, error } = await supabase
    .from('linkedin_post_monitors')
    .update({
      metadata: {
        daily_comment_limit: 2,
        skip_day_probability: 0.20,
        randomizer_enabled: true,
        comment_delay_min_hours: 1,
        comment_delay_max_hours: 4,
        updated_at: new Date().toISOString()
      }
    })
    .eq('id', monitorId)
    .select();

  if (error) {
    console.error('❌ Error updating monitor:', error);
    return;
  }

  console.log('✅ Updated Brian\'s monitor with:');
  console.log('   - daily_comment_limit: 2');
  console.log('   - skip_day_probability: 20%');
  console.log('   - randomizer_enabled: true');
  console.log('   - comment_delay: 1-4 hours');
  console.log('\nUpdated record:', JSON.stringify(data, null, 2));
}

main().catch(console.error);
