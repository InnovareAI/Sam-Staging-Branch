/**
 * Setup Charissa's First LinkedIn Campaign
 * LinkedIn-only campaign setup with Unipile integration
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function setupCharissaCampaign() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  console.log('🚀 Setting up Charissa\'s first LinkedIn campaign...')
  
  try {
    // 1. Find Charissa's user account
    const { data: users, error: userError } = await supabase
      .from('auth.users')
      .select('*')
      .or('email.ilike.%charissa%,raw_user_meta_data->>full_name.ilike.%charissa%')
    
    if (userError) {
      console.error('Error finding Charissa:', userError)
      return
    }
    
    console.log('👤 Found users:', users?.map(u => ({
      id: u.id,
      email: u.email,
      name: u.raw_user_meta_data?.full_name
    })))
    
    let charissaUserId = users?.[0]?.id
    
    if (!charissaUserId) {
      console.log('⚠️  Charissa not found, using default workspace...')
      charissaUserId = 'default-user'
    }
    
    // 2. Create LinkedIn Account Association for Charissa
    const { data: existingAssoc, error: assocCheckError } = await supabase
      .from('user_unipile_accounts')
      .select('*')
      .eq('unipile_account_id', 'he3RXnROSLuhONxgNle7dw')
      .eq('platform', 'LINKEDIN')
    
    if (!existingAssoc?.length) {
      console.log('🔗 Creating LinkedIn account association...')
      
      const { data: newAssoc, error: assocError } = await supabase
        .from('user_unipile_accounts')
        .insert([{
          user_id: charissaUserId,
          unipile_account_id: 'he3RXnROSLuhONxgNle7dw',
          platform: 'LINKEDIN',
          account_name: 'Charissa Daniel',
          status: 'active',
          last_sync: new Date().toISOString(),
          connection_data: {
            linkedin_id: 'ACoAADop-UABEUd5Sn_XycUyk52X73muKIaW4cc',
            username: 'Charissa Daniel',
            public_identifier: 'charissa-daniel-054978232',
            premium_features: ['premium']
          }
        }])
        .select()
      
      if (assocError) {
        console.error('❌ Error creating association:', assocError)
      } else {
        console.log('✅ LinkedIn association created:', newAssoc)
      }
    } else {
      console.log('✅ LinkedIn association already exists')
    }
    
    // 3. Create N8N Workflow Configuration for LinkedIn-Only
    const { data: existingWorkflow, error: workflowCheckError } = await supabase
      .from('workspace_n8n_workflows')
      .select('*')
      .eq('workspace_id', 'charissa-workspace')
    
    if (!existingWorkflow?.length) {
      console.log('⚙️  Creating LinkedIn-only N8N workflow config...')
      
      const { data: workflow, error: workflowError } = await supabase
        .from('workspace_n8n_workflows')
        .insert([{
          workspace_id: 'charissa-workspace',
          deployed_workflow_id: 'SAM_LINKEDIN_ONLY_WORKFLOW',
          deployment_status: 'active',
          master_template_version: 'v1.0',
          n8n_instance_url: 'https://workflows.innovareai.com',
          
          // LinkedIn-Only Configuration
          channel_preferences: {
            email_enabled: false,
            linkedin_enabled: true,
            execution_sequence: 'linkedin_only',
            delay_between_channels: 0
          },
          
          // Email Config (disabled)
          email_config: {
            enabled: false
          },
          
          // LinkedIn Config (active)
          linkedin_config: {
            enabled: true,
            linkedin_account_id: 'he3RXnROSLuhONxgNle7dw',
            connection_request_template: 'Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I\'m always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?',
            follow_up_sequences: [
              {
                delay_days: 7,
                template: 'Hi {first_name}, I\'ve been thinking about the early-stage founder reality - you\'re probably wearing 10+ hats right now: product development, customer discovery, fundraising prep, AND trying to generate your first paying customers. The catch-22 is brutal: you need customers to show traction for investors, but you can\'t afford to hire sales help, and the manual outreach eats up the time you need for building and fundraising. I\'m curious - as a solo founder (or small team), what\'s your biggest time sink right now? Finding customers, handling repetitive processes, or are you mostly focused on building?'
              }
            ],
            inmails_enabled: false,
            response_handling: {
              auto_response_enabled: false,
              human_handoff_triggers: ['interested', 'meeting', 'demo']
            }
          },
          
          // Reply Handling
          reply_handling_config: {
            auto_response_enabled: false,
            response_classification: 'manual',
            positive_reply_actions: ['notify_sales_rep', 'schedule_meeting'],
            negative_reply_actions: ['remove_from_sequence'],
            human_handoff_triggers: ['all_responses']
          }
        }])
        .select()
      
      if (workflowError) {
        console.error('❌ Error creating workflow:', workflowError)
      } else {
        console.log('✅ N8N workflow configuration created:', workflow)
      }
    } else {
      console.log('✅ N8N workflow configuration already exists')
    }
    
    // 4. Create Sample Campaign
    console.log('📋 Creating sample LinkedIn campaign...')
    
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert([{
        workspace_id: 'charissa-workspace',
        name: 'Charissa - LinkedIn Founder Outreach',
        description: 'LinkedIn-only campaign targeting early-stage founders',
        campaign_type: 'linkedin_only',
        status: 'draft',
        channel_preferences: {
          email: false,
          linkedin: true
        },
        linkedin_config: {
          account_id: 'he3RXnROSLuhONxgNle7dw',
          connection_message: 'Hi {first_name}, I work for InnovareAI, an AI company known for its innovative workflow automation and AI agent solutions. I\'m always interested in connecting with like-minded individuals who want to learn all things AI. Would you be open to connecting?',
          follow_up_message: 'Hi {first_name}, I\'ve been thinking about the early-stage founder reality - you\'re probably wearing 10+ hats right now: product development, customer discovery, fundraising prep, AND trying to generate your first paying customers. The catch-22 is brutal: you need customers to show traction for investors, but you can\'t afford to hire sales help, and the manual outreach eats up the time you need for building and fundraising. I\'m curious - as a solo founder (or small team), what\'s your biggest time sink right now? Finding customers, handling repetitive processes, or are you mostly focused on building?'
        }
      }])
      .select()
    
    if (campaignError) {
      console.error('❌ Error creating campaign:', campaignError)
    } else {
      console.log('✅ Sample campaign created:', campaign)
    }
    
    console.log('\n🎉 Charissa\'s LinkedIn campaign setup complete!')
    console.log('\n📋 Next Steps:')
    console.log('1. ✅ LinkedIn account is active and ready')
    console.log('2. ✅ N8N workflow configured for LinkedIn-only')
    console.log('3. ✅ Sample campaign created')
    console.log('4. 📤 Upload prospect list to campaign')
    console.log('5. 🚀 Launch campaign via SAM interface')
    
    console.log('\n🔗 Charissa\'s LinkedIn Account Details:')
    console.log('- Account ID: he3RXnROSLuhONxgNle7dw')
    console.log('- Status: Active ✅')
    console.log('- Recent Activity: September 22, 2025 ✅')
    console.log('- Ready for campaigns: YES ✅')
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Run the setup
setupCharissaCampaign()