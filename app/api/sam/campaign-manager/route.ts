import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@/utils/supabase/server';
import { 
  detectLanguageFromContent, 
  getPersonalizationGuidelines, 
  getLanguageSpecificRecommendations 
} from '@/utils/linkedin-personalization-languages';

interface CampaignManagerRequest {
  action: 'create_campaign' | 'upload_prospects' | 'generate_templates' | 'review_message' | 'execute_campaign' | 'get_campaign_status';
  campaign_data?: {
    name: string;
    description?: string;
    campaign_type?: 'sales' | 'recruitment' | 'networking' | 'partnership';
    target_audience?: string;
    campaign_goals?: string[];
    daily_limit?: number;
  };
  prospects_data?: {
    prospects: Array<{
      first_name: string;
      last_name: string;
      company_name: string;
      job_title: string;
      linkedin_profile_url: string;
      email_address?: string;
      location?: string;
      industry?: string;
    }>;
    source?: 'manual' | 'csv' | 'apollo' | 'sales_navigator';
  };
  template_data?: {
    user_input: string;
    context?: {
      campaign_type?: string;
      target_audience?: string;
      language?: string;
    };
  };
  campaign_id?: string;
  message?: string;
  recipient?: {
    first_name: string;
    last_name: string;
    company_name: string;
    job_title: string;
  };
}

interface SamCampaignResponse {
  success: boolean;
  action: string;
  message: string;
  data?: any;
  next_steps?: string[];
  suggested_actions?: Array<{
    action: string;
    label: string;
    description: string;
  }>;
}

export async function POST(req: NextRequest) {
  try {
    const supabase = await createClient();
    
    // Get the current user
    const { data: { user }, error: userError } = await supabase.auth.getUser();
    if (userError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Parse request body
    let requestBody: CampaignManagerRequest;
    try {
      requestBody = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const { action } = requestBody;

    // Route to appropriate handler based on action
    let response: SamCampaignResponse;

    switch (action) {
      case 'create_campaign':
        response = await handleCreateCampaign(supabase, user, requestBody);
        break;
      
      case 'upload_prospects':
        response = await handleUploadProspects(supabase, user, requestBody);
        break;
      
      case 'generate_templates':
        response = await handleGenerateTemplates(supabase, user, requestBody);
        break;
      
      case 'review_message':
        response = await handleReviewMessage(supabase, user, requestBody);
        break;
      
      case 'execute_campaign':
        response = await handleExecuteCampaign(supabase, user, requestBody);
        break;
      
      case 'get_campaign_status':
        response = await handleGetCampaignStatus(supabase, user, requestBody);
        break;
      
      default:
        return NextResponse.json(
          { error: `Unknown action: ${action}` },
          { status: 400 }
        );
    }

    return NextResponse.json(response);

  } catch (error: any) {
    console.error('Campaign manager error:', error);
    return NextResponse.json(
      { error: 'Campaign management failed', details: error.message },
      { status: 500 }
    );
  }
}

// Handler: Create Campaign
async function handleCreateCampaign(
  supabase: any,
  user: any,
  request: CampaignManagerRequest
): Promise<SamCampaignResponse> {
  const { campaign_data } = request;
  
  if (!campaign_data?.name) {
    return {
      success: false,
      action: 'create_campaign',
      message: "I need a campaign name to get started. What would you like to call this campaign?",
      suggested_actions: [
        {
          action: 'create_campaign',
          label: 'Try Again',
          description: 'Provide a campaign name'
        }
      ]
    };
  }

  // Create the campaign
  const { data: campaign, error: campaignError } = await supabase
    .from('campaigns')
    .insert({
      workspace_id: user.user_metadata.workspace_id,
      name: campaign_data.name,
      description: campaign_data.description,
      campaign_type: campaign_data.campaign_type || 'networking',
      target_audience: campaign_data.target_audience,
      campaign_goals: campaign_data.campaign_goals,
      daily_limit: campaign_data.daily_limit || 50,
      status: 'draft',
      created_at: new Date().toISOString()
    })
    .select()
    .single();

  if (campaignError) {
    return {
      success: false,
      action: 'create_campaign',
      message: `Sorry, I couldn't create the campaign. Error: ${campaignError.message}`,
      suggested_actions: [
        {
          action: 'create_campaign',
          label: 'Try Again',
          description: 'Retry campaign creation'
        }
      ]
    };
  }

  return {
    success: true,
    action: 'create_campaign',
    message: `🎉 Great! I've created your campaign "${campaign_data.name}". Now let's add some prospects to target.`,
    data: { campaign_id: campaign.id, campaign },
    next_steps: [
      'Upload prospect list (CSV file or manual entry)',
      'Generate personalized message templates',
      'Review and approve messages',
      'Launch the campaign'
    ],
    suggested_actions: [
      {
        action: 'upload_prospects',
        label: 'Add Prospects',
        description: 'Upload or manually add prospects to target'
      },
      {
        action: 'generate_templates',
        label: 'Create Templates',
        description: 'Generate personalized message templates'
      }
    ]
  };
}

// Handler: Upload Prospects
async function handleUploadProspects(
  supabase: any,
  user: any,
  request: CampaignManagerRequest
): Promise<SamCampaignResponse> {
  const { prospects_data, campaign_id } = request;
  
  if (!campaign_id) {
    return {
      success: false,
      action: 'upload_prospects',
      message: "I need a campaign ID to add prospects. Which campaign are you working on?",
      suggested_actions: [
        {
          action: 'create_campaign',
          label: 'Create Campaign',
          description: 'Start by creating a new campaign'
        }
      ]
    };
  }

  if (!prospects_data?.prospects || prospects_data.prospects.length === 0) {
    return {
      success: false,
      action: 'upload_prospects',
      message: "I need prospect data to upload. You can either:\n\n1. **Upload CSV**: Attach a CSV file with columns: first_name, last_name, company_name, job_title, linkedin_profile_url\n2. **Manual Entry**: Tell me about each prospect individually\n\nWhich method would you prefer?",
      suggested_actions: [
        {
          action: 'upload_prospects',
          label: 'Upload CSV',
          description: 'Attach a CSV file with prospect data'
        },
        {
          action: 'upload_prospects',
          label: 'Manual Entry',
          description: 'Add prospects one by one'
        }
      ]
    };
  }

  let successCount = 0;
  let errorCount = 0;
  const errors: string[] = [];

  for (const prospect of prospects_data.prospects) {
    try {
      // First, create or get the workspace prospect
      const { data: workspaceProspect, error: prospectError } = await supabase
        .from('workspace_prospects')
        .upsert({
          workspace_id: user.user_metadata.workspace_id,
          first_name: prospect.first_name,
          last_name: prospect.last_name,
          company_name: prospect.company_name,
          job_title: prospect.job_title,
          linkedin_profile_url: prospect.linkedin_profile_url,
          email_address: prospect.email_address,
          location: prospect.location,
          industry: prospect.industry,
          created_at: new Date().toISOString()
        }, {
          onConflict: 'linkedin_profile_url,workspace_id'
        })
        .select()
        .single();

      if (prospectError) throw prospectError;

      // Then, add to campaign
      const { error: campaignProspectError } = await supabase
        .from('campaign_prospects')
        .insert({
          campaign_id,
          prospect_id: workspaceProspect.id,
          status: 'pending',
          sequence_step: 0,
          created_at: new Date().toISOString()
        });

      if (campaignProspectError) throw campaignProspectError;

      successCount++;
    } catch (error: any) {
      errorCount++;
      errors.push(`${prospect.first_name} ${prospect.last_name}: ${error.message}`);
    }
  }

  const message = `📊 Prospects uploaded! Successfully added ${successCount} prospects to your campaign.${errorCount > 0 ? ` ${errorCount} failed (${errors.slice(0, 3).join(', ')}${errors.length > 3 ? '...' : ''})` : ''}`;

  return {
    success: successCount > 0,
    action: 'upload_prospects',
    message,
    data: { 
      success_count: successCount, 
      error_count: errorCount, 
      errors: errors.slice(0, 5),
      campaign_id 
    },
    next_steps: [
      'Generate personalized message templates',
      'Review message quality with AI check',
      'Launch the campaign'
    ],
    suggested_actions: [
      {
        action: 'generate_templates',
        label: 'Create Templates',
        description: 'Generate personalized message templates for your prospects'
      },
      {
        action: 'get_campaign_status',
        label: 'View Campaign',
        description: 'Check campaign status and prospect list'
      }
    ]
  };
}

// Handler: Generate Templates
async function handleGenerateTemplates(
  supabase: any,
  user: any,
  request: CampaignManagerRequest
): Promise<SamCampaignResponse> {
  const { template_data, campaign_id } = request;
  
  if (!template_data?.user_input) {
    return {
      success: false,
      action: 'generate_templates',
      message: "I need template content to work with. Please provide:\n\n1. **Connection request message** (what you want to say initially)\n2. **Follow-up messages** (for after they accept)\n3. **Campaign context** (sales, recruitment, networking, etc.)\n\nYou can paste existing templates or describe what you want to achieve, and I'll help optimize them!",
      suggested_actions: [
        {
          action: 'generate_templates',
          label: 'Provide Templates',
          description: 'Share your message templates or ideas'
        }
      ]
    };
  }

  // Call the existing parse-templates API internally
  try {
    const parseResponse = await fetch('/api/sam/parse-templates', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_input: template_data.user_input,
        conversation_context: {
          campaign_type: template_data.context?.campaign_type,
          target_audience: template_data.context?.target_audience
        }
      })
    });

    if (!parseResponse.ok) {
      throw new Error('Failed to parse templates');
    }

    const parseResult = await parseResponse.json();

    // If campaign_id provided, save templates to campaign
    if (campaign_id && parseResult.parsed_templates) {
      const templates = parseResult.parsed_templates;
      const connectionRequest = templates.find((t: any) => t.type === 'connection_request');
      const followUps = templates.filter((t: any) => t.type.startsWith('follow_up'));

      await supabase
        .from('campaigns')
        .update({
          message_templates: {
            connection_request: connectionRequest?.content || template_data.user_input,
            follow_up_1: followUps[0]?.content,
            follow_up_2: followUps[1]?.content,
            follow_up_3: followUps[2]?.content
          },
          updated_at: new Date().toISOString()
        })
        .eq('id', campaign_id);
    }

    return {
      success: true,
      action: 'generate_templates',
      message: parseResult.sam_response,
      data: {
        templates: parseResult.parsed_templates,
        suggestions: parseResult.suggestions,
        performance_insights: parseResult.performance_insights,
        campaign_id
      },
      next_steps: [
        'Review message quality and cultural appropriateness',
        'Test messages with AI final check',
        'Launch campaign when ready'
      ],
      suggested_actions: [
        {
          action: 'review_message',
          label: 'Review Messages',
          description: 'Get AI quality check on your templates'
        },
        {
          action: 'execute_campaign',
          label: 'Launch Campaign',
          description: 'Start sending connection requests'
        }
      ]
    };

  } catch (error: any) {
    return {
      success: false,
      action: 'generate_templates',
      message: `Sorry, I had trouble analyzing your templates. Error: ${error.message}`,
      suggested_actions: [
        {
          action: 'generate_templates',
          label: 'Try Again',
          description: 'Retry template generation'
        }
      ]
    };
  }
}

// Handler: Review Message
async function handleReviewMessage(
  supabase: any,
  user: any,
  request: CampaignManagerRequest
): Promise<SamCampaignResponse> {
  const { message, recipient } = request;
  
  if (!message || !recipient) {
    return {
      success: false,
      action: 'review_message',
      message: "I need a message and recipient details to review. Please provide:\n\n1. **Message text** to review\n2. **Recipient info** (name, company, job title)\n\nI'll check for cultural appropriateness, personalization, length limits, and compliance!",
      suggested_actions: [
        {
          action: 'review_message',
          label: 'Provide Message',
          description: 'Share message and recipient details for review'
        }
      ]
    };
  }

  // Call the final check API internally
  try {
    const reviewResponse = await fetch('/api/sam/final-check', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        message,
        recipient,
        context: {
          message_type: 'connection_request',
          platform: 'linkedin'
        }
      })
    });

    if (!reviewResponse.ok) {
      throw new Error('Failed to review message');
    }

    const reviewResult = await reviewResponse.json();
    const finalCheck = reviewResult.final_check;

    let responseMessage = `## 🔍 AI Final Check Results\n\n`;
    
    // Approval status
    if (finalCheck.approved) {
      responseMessage += `✅ **APPROVED** - Message is ready to send!\n`;
      responseMessage += `🎯 **Confidence Score:** ${Math.round(finalCheck.confidence_score * 100)}%\n\n`;
    } else {
      responseMessage += `❌ **NEEDS IMPROVEMENT** - Please address critical issues\n`;
      responseMessage += `⚠️ **Confidence Score:** ${Math.round(finalCheck.confidence_score * 100)}%\n\n`;
    }

    // Character count
    responseMessage += `📏 **Character Count:** ${finalCheck.character_count.current}/${finalCheck.character_count.max_limit} (${finalCheck.character_count.recommended_max} recommended)\n\n`;

    // Issues
    if (finalCheck.issues.length > 0) {
      responseMessage += `## 🚨 Issues Found:\n`;
      finalCheck.issues.forEach((issue: any) => {
        const icon = issue.severity === 'critical' ? '🚫' : issue.severity === 'high' ? '⚠️' : '💡';
        responseMessage += `${icon} **${issue.category.toUpperCase()}**: ${issue.message}\n`;
      });
      responseMessage += `\n`;
    }

    // Optimized message
    if (finalCheck.optimized_message) {
      responseMessage += `## ✨ Optimized Version:\n\`\`\`\n${finalCheck.optimized_message}\n\`\`\`\n\n`;
    }

    // Recommendations
    if (finalCheck.recommendations.length > 0) {
      responseMessage += `## 💡 Recommendations:\n`;
      finalCheck.recommendations.forEach((rec: string) => {
        responseMessage += `• ${rec}\n`;
      });
      responseMessage += `\n`;
    }

    // Cultural notes
    if (finalCheck.cultural_notes) {
      responseMessage += `## 🌍 Cultural Guidelines:\n`;
      finalCheck.cultural_notes.forEach((note: string) => {
        responseMessage += `• ${note}\n`;
      });
    }

    return {
      success: true,
      action: 'review_message',
      message: responseMessage,
      data: finalCheck,
      suggested_actions: finalCheck.approved ? [
        {
          action: 'execute_campaign',
          label: 'Send Message',
          description: 'Message looks good - ready to send!'
        }
      ] : [
        {
          action: 'review_message',
          label: 'Review Again',
          description: 'Make improvements and review again'
        },
        {
          action: 'generate_templates',
          label: 'Regenerate',
          description: 'Create new templates'
        }
      ]
    };

  } catch (error: any) {
    return {
      success: false,
      action: 'review_message',
      message: `Sorry, I couldn't review the message. Error: ${error.message}`,
      suggested_actions: [
        {
          action: 'review_message',
          label: 'Try Again',
          description: 'Retry message review'
        }
      ]
    };
  }
}

// Handler: Execute Campaign
async function handleExecuteCampaign(
  supabase: any,
  user: any,
  request: CampaignManagerRequest
): Promise<SamCampaignResponse> {
  const { campaign_id } = request;
  
  if (!campaign_id) {
    return {
      success: false,
      action: 'execute_campaign',
      message: "I need a campaign ID to execute. Which campaign would you like to launch?",
      suggested_actions: [
        {
          action: 'get_campaign_status',
          label: 'View Campaigns',
          description: 'See your available campaigns'
        }
      ]
    };
  }

  // Call the N8N LinkedIn execute API internally
  try {
    const executeResponse = await fetch('/api/campaigns/linkedin/execute-via-n8n', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        campaignId: campaign_id,
        executionType: 'direct_linkedin'
      })
    });

    if (!executeResponse.ok) {
      const errorData = await executeResponse.json();
      throw new Error(errorData.error || 'Campaign execution failed');
    }

    const executeResult = await executeResponse.json();

    const message = `🚀 **Campaign Launched!**\n\n📊 **Results:**\n• ✅ Sent: ${executeResult.results.sent} connection requests\n• ❌ Failed: ${executeResult.results.failed}\n• 📋 Total processed: ${executeResult.results.total}\n\n${executeResult.results.errors.length > 0 ? `⚠️ **Errors:**\n${executeResult.results.errors.slice(0, 3).map((e: any) => `• ${e.name}: ${e.error}`).join('\n')}` : '🎉 All messages sent successfully!'}\n\n**Next Steps:**\n• Monitor responses in your LinkedIn messages\n• Follow up with prospects who accept\n• Track campaign performance in analytics`;

    return {
      success: true,
      action: 'execute_campaign',
      message,
      data: executeResult,
      suggested_actions: [
        {
          action: 'get_campaign_status',
          label: 'Check Status',
          description: 'Monitor campaign progress'
        }
      ]
    };

  } catch (error: any) {
    return {
      success: false,
      action: 'execute_campaign',
      message: `❌ **Campaign Launch Failed**\n\nError: ${error.message}\n\nCommon issues:\n• No active LinkedIn accounts connected\n• Missing message templates\n• No pending prospects to contact\n• Daily limit reached\n\nWould you like me to help troubleshoot?`,
      suggested_actions: [
        {
          action: 'get_campaign_status',
          label: 'Check Campaign',
          description: 'Review campaign setup and requirements'
        }
      ]
    };
  }
}

// Handler: Get Campaign Status
async function handleGetCampaignStatus(
  supabase: any,
  user: any,
  request: CampaignManagerRequest
): Promise<SamCampaignResponse> {
  const { campaign_id } = request;
  
  try {
    if (campaign_id) {
      // Get specific campaign
      const { data: campaign, error } = await supabase
        .from('campaigns')
        .select(`
          *,
          campaign_prospects (
            id,
            status,
            sequence_step,
            workspace_prospects (
              first_name,
              last_name,
              company_name
            )
          )
        `)
        .eq('id', campaign_id)
        .eq('workspace_id', user.user_metadata.workspace_id)
        .single();

      if (error) throw error;

      const totalProspects = campaign.campaign_prospects.length;
      const pendingProspects = campaign.campaign_prospects.filter((p: any) => p.status === 'pending').length;
      const sentProspects = campaign.campaign_prospects.filter((p: any) => p.status === 'invitation_sent').length;
      
      const message = `📋 **Campaign: ${campaign.name}**\n\n📊 **Status:** ${campaign.status.toUpperCase()}\n📈 **Progress:**\n• Total prospects: ${totalProspects}\n• Pending: ${pendingProspects}\n• Sent: ${sentProspects}\n• Daily limit: ${campaign.daily_limit}\n\n📝 **Templates:**\n• Connection request: ${campaign.message_templates?.connection_request ? '✅' : '❌'}\n• Follow-up messages: ${campaign.message_templates?.follow_up_1 ? '✅' : '❌'}\n\n🗓️ **Last executed:** ${campaign.last_executed_at ? new Date(campaign.last_executed_at).toLocaleDateString() : 'Never'}`;

      return {
        success: true,
        action: 'get_campaign_status',
        message,
        data: campaign,
        suggested_actions: campaign.status === 'draft' ? [
          {
            action: 'upload_prospects',
            label: 'Add Prospects',
            description: 'Add prospects to this campaign'
          },
          {
            action: 'generate_templates',
            label: 'Create Templates',
            description: 'Generate message templates'
          }
        ] : [
          {
            action: 'execute_campaign',
            label: 'Launch Campaign',
            description: 'Execute this campaign'
          }
        ]
      };
    } else {
      // Get all campaigns
      const { data: campaigns, error } = await supabase
        .from('campaigns')
        .select('id, name, status, created_at, invitations_sent')
        .eq('workspace_id', user.user_metadata.workspace_id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      if (campaigns.length === 0) {
        return {
          success: true,
          action: 'get_campaign_status',
          message: "You don't have any campaigns yet. Let's create your first one! 🚀",
          suggested_actions: [
            {
              action: 'create_campaign',
              label: 'Create Campaign',
              description: 'Start your first LinkedIn outreach campaign'
            }
          ]
        };
      }

      const message = `📋 **Your Campaigns:**\n\n${campaigns.map((c: any) => 
        `• **${c.name}** (${c.status}) - ${c.invitations_sent || 0} sent`
      ).join('\n')}\n\nWhich campaign would you like to work on?`;

      return {
        success: true,
        action: 'get_campaign_status',
        message,
        data: campaigns,
        suggested_actions: [
          {
            action: 'create_campaign',
            label: 'New Campaign',
            description: 'Create a new campaign'
          }
        ]
      };
    }
  } catch (error: any) {
    return {
      success: false,
      action: 'get_campaign_status',
      message: `Sorry, I couldn't fetch campaign status. Error: ${error.message}`,
      suggested_actions: [
        {
          action: 'create_campaign',
          label: 'Create Campaign',
          description: 'Start a new campaign'
        }
      ]
    };
  }
}