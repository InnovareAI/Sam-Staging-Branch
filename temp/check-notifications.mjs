import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

console.log('=== CHECKING REPLY AGENT NOTIFICATIONS ===\n')

// 1. Get all pending approval drafts
const { data: pendingDrafts, error: draftsError } = await supabase
  .from('reply_agent_drafts')
  .select(`
    *,
    campaigns (campaign_name, workspace_id),
    campaign_prospects (first_name, last_name, linkedin_url, company_name, title)
  `)
  .eq('status', 'pending_approval')
  .order('created_at', { ascending: false })

if (draftsError) {
  console.error('Error:', draftsError)
  process.exit(1)
}

console.log(`PENDING APPROVAL DRAFTS: ${pendingDrafts.length}\n`)

pendingDrafts.forEach(draft => {
  console.log(`\n📬 Draft ID: ${draft.id}`)
  console.log(`   Prospect: ${draft.prospect_name}`)
  console.log(`   Company: ${draft.prospect_company}`)
  const title = draft.campaign_prospects && draft.campaign_prospects.title
  console.log(`   Title: ${title || 'N/A'}`)
  const campaignName = draft.campaigns && draft.campaigns.campaign_name
  console.log(`   Campaign: ${campaignName || 'N/A'}`)
  console.log(`   Workspace: ${draft.workspace_id}`)
  console.log(`   Created: ${draft.created_at}`)
  console.log(`   Intent: ${draft.intent_detected}`)
  console.log(`   Channel: ${draft.channel}`)
  console.log(`\n   Inbound Message:`)
  console.log(`   "${draft.inbound_message_text}"`)
  console.log(`\n   Draft Reply:`)
  console.log(`   "${draft.draft_text}"`)
  console.log(`\n   Approval Token: ${draft.approval_token}`)
  console.log(`   Expires: ${draft.expires_at}`)
})

// 2. Get workspace owner emails for notification targets
console.log('\n\n=== WORKSPACE OWNERS (Notification Recipients) ===\n')
for (const draft of pendingDrafts) {
  const { data: members } = await supabase
    .from('workspace_members')
    .select('user_id, role, users(email, full_name)')
    .eq('workspace_id', draft.workspace_id)
    .eq('role', 'owner')

  const campaignName = draft.campaigns && draft.campaigns.campaign_name
  console.log(`\nWorkspace: ${draft.workspace_id}`)
  console.log(`Campaign: ${campaignName || 'N/A'}`)
  if (members && members.length > 0) {
    members.forEach(member => {
      const fullName = member.users && member.users.full_name
      const email = member.users && member.users.email
      console.log(`  Owner: ${fullName || 'Unknown'}`)
      console.log(`  Email: ${email}`)
    })
  } else {
    console.log('  NO OWNER FOUND - Notifications will fail!')
  }
}

// 3. Check workspace config notification channels
console.log('\n\n=== NOTIFICATION CHANNELS ===\n')
const uniqueWorkspaces = [...new Set(pendingDrafts.map(d => d.workspace_id))]
for (const wsId of uniqueWorkspaces) {
  const { data: config } = await supabase
    .from('workspace_reply_agent_config')
    .select('notification_channels')
    .eq('workspace_id', wsId)
    .single()

  console.log(`Workspace: ${wsId}`)
  console.log(`  Notification Channels: ${JSON.stringify(config && config.notification_channels) || 'email (default)'}`)
}

// 4. Build approval URLs for each draft
console.log('\n\n=== APPROVAL URLS ===\n')
const APP_URL = 'https://app.meet-sam.com'
for (const draft of pendingDrafts) {
  console.log(`\n${draft.prospect_name}:`)
  console.log(`  Approve: ${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=approve`)
  console.log(`  Reject: ${APP_URL}/api/reply-agent/approve?token=${draft.approval_token}&action=reject`)
  console.log(`  Edit: ${APP_URL}/reply-agent/edit?id=${draft.id}&token=${draft.approval_token}`)
}
