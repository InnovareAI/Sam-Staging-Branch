import { createClient } from '@supabase/supabase-js'

const supabase = createClient(
  'https://latxadqrvrrrcvkktrog.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImxhdHhhZHFydnJycmN2a2t0cm9nIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjY5OTk4NiwiZXhwIjoyMDY4Mjc1OTg2fQ.nCcqwHSwGtqatcMmb1uanGxsL4DbD8woPwezMAE41OQ'
)

console.log('=== INVESTIGATING RUDY WALGRAEF (Most Recent Reply) ===\n')

// 1. Get Rudy's prospect record
const { data: rudy, error: rudyError } = await supabase
  .from('campaign_prospects')
  .select('*, campaigns(campaign_name, workspace_id)')
  .eq('id', '501529d7-a9b9-4d01-84cb-a4347b853430')
  .single()

if (rudyError) {
  console.error('Error:', rudyError)
  process.exit(1)
}

console.log('PROSPECT DETAILS:')
console.log(`Name: ${rudy.first_name} ${rudy.last_name}`)
console.log(`Campaign: ${rudy.campaigns?.campaign_name}`)
console.log(`Workspace: ${rudy.campaigns?.workspace_id}`)
console.log(`Status: ${rudy.status}`)
console.log(`Responded At: ${rudy.responded_at}`)
console.log(`Last Processed Message ID: ${rudy.last_processed_message_id}`)
console.log(`LinkedIn User ID: ${rudy.linkedin_user_id}`)
console.log(`LinkedIn URL: ${rudy.linkedin_url}`)

// 2. Check if Reply Agent is enabled for this workspace
console.log('\n\nREPLY AGENT CONFIG:')
const { data: replyConfig, error: configError } = await supabase
  .from('workspace_reply_agent_config')
  .select('*')
  .eq('workspace_id', rudy.campaigns?.workspace_id)
  .single()

if (configError) {
  console.error('Error:', configError)
  console.log('Reply Agent config not found - THIS IS THE PROBLEM!')
} else {
  console.log(`Enabled: ${replyConfig.enabled}`)
  console.log(`Approval Mode: ${replyConfig.approval_mode}`)
  console.log(`AI Model: ${replyConfig.ai_model}`)
  console.log(`Sender Name: ${replyConfig.sender_name}`)
}

// 3. Check for any reply drafts for this prospect
console.log('\n\nREPLY DRAFTS:')
const { data: drafts, error: draftsError } = await supabase
  .from('reply_agent_drafts')
  .select('*')
  .eq('prospect_id', rudy.id)
  .order('created_at', { ascending: false })

if (draftsError) {
  console.error('Error:', draftsError)
} else if (!drafts || drafts.length === 0) {
  console.log('NO DRAFTS FOUND - This is the issue!')
} else {
  drafts.forEach(draft => {
    console.log(`\n- Draft ID: ${draft.id}`)
    console.log(`  Status: ${draft.status}`)
    console.log(`  Created: ${draft.created_at}`)
    console.log(`  Inbound Message ID: ${draft.inbound_message_id}`)
    console.log(`  Inbound Text: ${draft.inbound_message_text}`)
    console.log(`  Draft Reply: ${draft.draft_text}`)
    console.log(`  Intent: ${draft.intent_detected}`)
  })
}

// 4. Get ALL prospects who recently replied
console.log('\n\n=== ALL RECENT REPLIES (Last 3 days) ===')
const threeDaysAgo = new Date()
threeDaysAgo.setDate(threeDaysAgo.getDate() - 3)

const { data: recentReplies, error: repliesError } = await supabase
  .from('campaign_prospects')
  .select('id, first_name, last_name, responded_at, status, campaigns(workspace_id)')
  .not('responded_at', 'is', null)
  .gte('responded_at', threeDaysAgo.toISOString())
  .order('responded_at', { ascending: false })

if (!repliesError && recentReplies) {
  console.log(`\nFound ${recentReplies.length} prospects who replied in last 3 days:`)
  for (const prospect of recentReplies) {
    // Check if they have a draft
    const { data: prospectDrafts } = await supabase
      .from('reply_agent_drafts')
      .select('id, status')
      .eq('prospect_id', prospect.id)
    
    const hasDraft = prospectDrafts && prospectDrafts.length > 0
    const draftStatus = hasDraft ? prospectDrafts[0].status : 'NONE'
    
    console.log(`\n${prospect.first_name} ${prospect.last_name}`)
    console.log(`  Replied: ${prospect.responded_at}`)
    console.log(`  Draft: ${hasDraft ? 'YES' : 'NO'} (${draftStatus})`)
    console.log(`  Workspace: ${prospect.campaigns?.workspace_id}`)
  }
}

// 5. Check workspace_reply_agent_config for all workspaces with recent replies
console.log('\n\n=== REPLY AGENT CONFIG FOR ALL WORKSPACES WITH REPLIES ===')
const uniqueWorkspaces = [...new Set(recentReplies?.map(r => r.campaigns?.workspace_id) || [])]
for (const wsId of uniqueWorkspaces) {
  const { data: wsConfig } = await supabase
    .from('workspace_reply_agent_config')
    .select('*')
    .eq('workspace_id', wsId)
    .single()
  
  console.log(`\nWorkspace: ${wsId}`)
  if (wsConfig) {
    console.log(`  Enabled: ${wsConfig.enabled}`)
    console.log(`  Approval Mode: ${wsConfig.approval_mode}`)
  } else {
    console.log('  NO CONFIG FOUND - Reply Agent not enabled!')
  }
}
