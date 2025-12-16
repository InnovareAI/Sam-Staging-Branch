import { createClient } from '@supabase/supabase-js';

const supabase = createClient('https://latxadqrvrrrcvkktrog.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ');

const { data } = await supabase
  .from('system_health_checks')
  .select('check_date, overall_status, checks, auto_fixes, duration_ms')
  .order('check_date', { ascending: false })
  .limit(1);

if (data && data[0]) {
  const check = data[0];
  console.log('Latest QA check:', check.check_date);
  console.log('Status:', check.overall_status);
  console.log('Duration:', check.duration_ms + 'ms');

  const issues = check.checks?.filter(c => c.status !== 'pass') || [];
  console.log('\nISSUES (' + issues.length + '):');
  issues.forEach(c => {
    console.log('  ' + c.status.toUpperCase() + ': ' + c.check_name);
    console.log('    ' + c.details);
  });
  if (issues.length === 0) {
    console.log('  (none - all checks passed)');
  }

  console.log('\nAuto-fixes:', check.auto_fixes?.length || 0);
  check.auto_fixes?.forEach(f => {
    console.log('  ' + (f.success ? '✅' : '❌') + ' ' + f.issue + ': ' + f.details);
  });
}
