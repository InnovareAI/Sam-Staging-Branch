require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

const INNOVAREAI_WORKSPACE_ID = 'babdcab8-1a78-4b2f-913e-6e9fd9821009';

(async () => {
  console.log('Updating Reply Agent Settings for InnovareAI workspace...\n');

  // Update settings with proper links and configuration
  const { data, error } = await supabase
    .from('reply_agent_settings')
    .update({
      calendar_link: 'https://links.innovareai.com/SamAIDemo',
      sam_description: 'SAM (Sales Agent Machine) is an AI-powered sales agent that handles prospecting and outreach autonomously. It researches prospects, crafts personalized messages, and manages follow-ups.',
      sam_differentiators: 'Unlike tools you operate, SAM is an agent that acts on your behalf. Works 24/7, costs 20% of an SDR, no ramp time, no turnover.',
      default_cta: 'book_call',
      proof_points: JSON.stringify([
        'SaaS Startup: +3x demo bookings in 60 days',
        'FinTech Firm: 65% ROI improvement in 3 months',
        'Recruiting Agency: Reduced time-to-fill by 40%'
      ]),
      updated_at: new Date().toISOString()
    })
    .eq('workspace_id', INNOVAREAI_WORKSPACE_ID)
    .select();

  if (error) {
    console.log('Error updating settings:', error.message);
    return;
  }

  console.log('Updated settings:', JSON.stringify(data, null, 2));

  // Check current settings
  const { data: settings } = await supabase
    .from('reply_agent_settings')
    .select('calendar_link, sam_description, sam_differentiators, default_cta, proof_points')
    .eq('workspace_id', INNOVAREAI_WORKSPACE_ID)
    .single();

  console.log('\n✅ Current settings after update:');
  console.log('Calendar Link:', settings?.calendar_link);
  console.log('SAM Description:', settings?.sam_description?.substring(0, 50) + '...');
  console.log('Differentiators:', settings?.sam_differentiators?.substring(0, 50) + '...');
  console.log('Default CTA:', settings?.default_cta);
  console.log('Proof Points:', settings?.proof_points);

})();
