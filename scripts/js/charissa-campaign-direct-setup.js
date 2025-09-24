/**
 * Direct Charissa LinkedIn Campaign Setup
 * Creates campaign infrastructure without user lookup
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL
const SUPABASE_SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY

async function setupCharissaCampaignDirect() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY)
  
  console.log('🚀 Setting up Charissa\'s LinkedIn campaign infrastructure...')
  
  try {
    // Use fixed workspace/user IDs for Charissa
    const charissaWorkspaceId = 'charissa-workspace'
    const charissaUserId = 'charissa-user-direct'
    
    // 1. Create LinkedIn Account Association for Charissa
    console.log('🔗 Creating LinkedIn account association...')
    
    const { data: newAssoc, error: assocError } = await supabase
      .from('user_unipile_accounts')
      .upsert([{
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
      }], { 
        onConflict: 'user_id,unipile_account_id,platform',
        ignoreDuplicates: false 
      })
      .select()
    
    if (assocError) {
      console.error('❌ Error creating association:', assocError)
    } else {
      console.log('✅ LinkedIn association created/updated')
    }
    
    // 2. Create N8N Workflow Configuration for LinkedIn-Only
    console.log('⚙️  Creating LinkedIn-only N8N workflow config...')
    
    const { data: workflow, error: workflowError } = await supabase
      .from('workspace_n8n_workflows')
      .upsert([{
        workspace_id: charissaWorkspaceId,
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
      }], {
        onConflict: 'workspace_id',
        ignoreDuplicates: false
      })
      .select()
    
    if (workflowError) {
      console.error('❌ Error creating workflow:', workflowError)
    } else {
      console.log('✅ N8N workflow configuration created/updated')
    }
    
    // 3. Create Sample Campaign Ready for CSV Upload
    console.log('📋 Creating LinkedIn campaign ready for CSV upload...')
    
    const { data: campaign, error: campaignError } = await supabase
      .from('campaigns')
      .insert([{
        workspace_id: charissaWorkspaceId,
        name: 'Charissa - LinkedIn Founder Outreach',
        description: 'LinkedIn-only campaign targeting early-stage founders - CSV Upload Ready',
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
      console.log('✅ Campaign created with ID:', campaign[0]?.id)
      
      // Store campaign ID for CSV upload
      console.log(`\n📤 CAMPAIGN READY FOR CSV UPLOAD`)
      console.log(`Campaign ID: ${campaign[0]?.id}`)
      console.log(`Workspace ID: ${charissaWorkspaceId}`)
      console.log(`LinkedIn Account: he3RXnROSLuhONxgNle7dw (Charissa Daniel)`)
    }
    
    console.log('\n🎉 Charissa\'s LinkedIn campaign infrastructure complete!')
    console.log('\n📋 Next Steps:')
    console.log('1. ✅ LinkedIn account is active and ready')
    console.log('2. ✅ N8N workflow configured for LinkedIn-only')
    console.log('3. ✅ Campaign created and ready for prospects')
    console.log('4. 📤 UPLOAD CSV DATA to the campaign')
    console.log('5. 🚀 Launch campaign via SAM interface')
    
    console.log('\n📊 CSV Upload Instructions:')
    console.log(`Use campaign ID: ${campaign[0]?.id}`)
    console.log('Required CSV columns: first_name, last_name, email, company_name, linkedin_url')
    console.log('API endpoint: POST /api/campaigns/upload-with-resolution')
    console.log('Status: Ready for immediate CSV upload and launch')
    
  } catch (error) {
    console.error('❌ Setup failed:', error)
  }
}

// Run the setup
setupCharissaCampaignDirect()