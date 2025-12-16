import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

const { data, error } = await supabase
  .from('system_health_checks')
  .select('*')
  .order('check_date', { ascending: false })
  .limit(3);

console.log('Error:', error);
console.log('Count:', data?.length);
if (data && data[0]) {
  const latest = data[0];
  console.log('Latest check:', latest.check_date);
  console.log('Status:', latest.overall_status);

  const issues = latest.checks?.filter(c => c.status !== 'pass') || [];
  console.log('Issues:', issues.length);
  issues.forEach(i => console.log(' -', i.check_name + ':', i.details?.substring(0, 100)));
}
