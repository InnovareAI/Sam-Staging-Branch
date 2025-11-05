// Create a test approval session with prospects
import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config({ path: '.env.local' });

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function createTestSession() {
  const workspaceId = '014509ba-226e-43ee-ba58-ab5f20d2ed08';
  const userId = 'f6885ff3-deef-4781-8721-93011c990b1b';

  console.log('Creating test approval session with prospects...\n');

  // 1. Create session
  const { data: session, error: sessionError } = await supabase
    .from('prospect_approval_sessions')
    .insert({
      workspace_id: workspaceId,
      user_id: userId,
      batch_number: Math.floor(Date.now() / 1000),
      campaign_name: 'Test Campaign ' + Date.now(),
      status: 'active',
      total_prospects: 2,
      pending_count: 2,
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (sessionError) {
    console.error('❌ Failed to create session:', sessionError);
    return;
  }

  console.log('✅ Session created:', session.id);

  // 2. Add test prospects to session
  const prospects = [
    {
      session_id: session.id,
      workspace_id: workspaceId,
      prospect_id: crypto.randomUUID(),
      name: 'John Smith',
      title: 'CEO',
      company: {
        name: 'Acme Corp',
        industry: ['Technology']
      },
      location: 'San Francisco, CA',
      contact: {
        firstName: 'John',
        lastName: 'Smith',
        email: 'john.smith@example.com',
        linkedin_url: 'https://www.linkedin.com/in/john-smith'
      },
      source: 'manual-upload',
      enrichment_score: 85,
      approval_status: 'pending'
    },
    {
      session_id: session.id,
      workspace_id: workspaceId,
      prospect_id: crypto.randomUUID(),
      name: 'Jane Doe',
      title: 'CTO',
      company: {
        name: 'Tech Startup Inc',
        industry: ['Software']
      },
      location: 'New York, NY',
      contact: {
        firstName: 'Jane',
        lastName: 'Doe',
        email: 'jane.doe@example.com',
        linkedin_url: 'https://www.linkedin.com/in/jane-doe'
      },
      source: 'manual-upload',
      enrichment_score: 90,
      approval_status: 'pending'
    }
  ];

  const { data: insertedProspects, error: prospectsError } = await supabase
    .from('prospect_approval_data')
    .insert(prospects)
    .select();

  if (prospectsError) {
    console.error('❌ Failed to add prospects:', prospectsError);
    return;
  }

  console.log('✅ Added', insertedProspects.length, 'prospects to session\n');

  console.log('🎉 Test session ready!');
  console.log('\nNow:');
  console.log('1. Refresh app.meet-sam.com');
  console.log('2. Go to Data Approval / Prospects');
  console.log('3. You should see the session with 2 prospects');
  console.log('4. Select a prospect and click "Approve & Launch"');
}

createTestSession().catch(console.error);
