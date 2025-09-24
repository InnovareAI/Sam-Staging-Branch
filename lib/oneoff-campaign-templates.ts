import { CampaignTemplate, CampaignStep } from './campaign-templates';

// Move existing 4 templates to One-off Campaigns module
// These are for custom/experimental campaigns that require human approval

export interface OneoffCampaignTemplate extends CampaignTemplate {
  approval_required: boolean;
  manual_oversight: boolean;
  experimental: boolean;
}

export const ONEOFF_CAMPAIGN_TEMPLATES: OneoffCampaignTemplate[] = [
  {
    id: 'linkedin_connection_followup',
    name: 'Connection Request + Company Follow + 3 Follow-ups',
    description: 'Start with connection request, follow their company, then 3 strategic follow-up messages',
    type: 'linkedin_connection',
    approval_required: true,
    manual_oversight: true,
    experimental: false,
    steps: [
      {
        step_number: 1,
        type: 'connection_request',
        delay_days: 0,
        message_template: "Hi {first_name}, I came across your profile and was impressed by your work at {company_name}. I'd love to connect and learn more about your experience in {industry}.",
        conditions: ['profile_available', 'not_connected']
      },
      {
        step_number: 2,
        type: 'company_follow',
        delay_days: 1,
        message_template: 'Follow company page for {company_name}',
        conditions: ['connection_accepted', 'company_page_exists']
      },
      {
        step_number: 3,
        type: 'follow_up_message',
        delay_days: 3,
        message_template: "Thanks for connecting, {first_name}! I noticed {company_name} is doing some interesting work in {industry}. I just followed your company page to stay updated on your latest developments.",
        conditions: ['connection_accepted']
      },
      {
        step_number: 4,
        type: 'follow_up_message',
        delay_days: 7,
        message_template: "Hi {first_name}, I saw {company_name}'s recent update about {recent_activity}. Really impressive! I'd love to hear your thoughts on how this impacts the {industry} landscape.",
        conditions: ['previous_message_sent', 'no_negative_response']
      },
      {
        step_number: 5,
        type: 'follow_up_message',
        delay_days: 14,
        message_template: "Hope you're having a great week, {first_name}! I've been thinking about our conversation and would love to explore how we might collaborate. Are you available for a brief call this week?",
        conditions: ['previous_message_sent', 'engagement_detected']
      }
    ],
    settings: {
      daily_limit: 20,
      delay_between_steps_days: 1,
      timing_restrictions: ['weekdays_only', 'business_hours']
    },
    variables: ['first_name', 'company_name', 'industry', 'recent_activity'],
    use_cases: ['B2B Sales', 'Partnership Development', 'Professional Networking'],
    expected_response_rate: '15-25%'
  },

  {
    id: 'linkedin_direct_message',
    name: 'Direct Message + 3 Follow-ups',
    description: 'Direct message sequence for existing connections with strategic follow-ups',
    type: 'linkedin_dm',
    approval_required: true,
    manual_oversight: true,
    experimental: false,
    steps: [
      {
        step_number: 1,
        type: 'direct_message',
        delay_days: 0,
        subject: 'Quick question about {industry}',
        message_template: "Hi {first_name}, hope you're doing well! I've been following {company_name}'s progress and wanted to reach out. I'm working on something that might be relevant to your work in {industry}. Would you be open to a quick chat?",
        conditions: ['already_connected', 'recent_activity_detected']
      },
      {
        step_number: 2,
        type: 'follow_up_message',
        delay_days: 4,
        subject: 'Following up on my message',
        message_template: "Hi {first_name}, just wanted to follow up on my previous message. I know you're busy, but I think there could be some interesting synergies between what you're doing at {company_name} and what we're working on.",
        conditions: ['no_response_to_previous']
      },
      {
        step_number: 3,
        type: 'follow_up_message',
        delay_days: 8,
        subject: 'Thought you might find this interesting',
        message_template: "Hi {first_name}, I came across this article about {relevant_topic} and thought of our earlier conversation. No pressure to respond, but I thought you might find it relevant to your work at {company_name}: {article_link}",
        conditions: ['no_response_to_previous', 'relevant_content_available']
      },
      {
        step_number: 4,
        type: 'follow_up_message',
        delay_days: 15,
        subject: 'Last follow-up',
        message_template: "Hi {first_name}, I realize you're probably swamped, so this will be my last message. If you're ever interested in discussing {relevant_topic} or how it might impact {industry}, I'm here. Best of luck with everything at {company_name}!",
        conditions: ['no_response_to_previous']
      }
    ],
    settings: {
      daily_limit: 15,
      delay_between_steps_days: 2,
      prerequisites: ['existing_connection'],
      timing_restrictions: ['weekdays_only', 'no_holidays']
    },
    variables: ['first_name', 'company_name', 'industry', 'relevant_topic', 'article_link'],
    use_cases: ['Existing Network Activation', 'Product Introduction', 'Service Offering'],
    expected_response_rate: '25-35%'
  },

  {
    id: 'group_message_campaign',
    name: 'Group Message Campaign',
    description: 'Target group members with valuable content (requires 4+ days group membership)',
    type: 'group_message',
    approval_required: true,
    manual_oversight: true,
    experimental: true,
    steps: [
      {
        step_number: 1,
        type: 'group_message',
        delay_days: 0,
        message_template: "Great discussion happening here about {group_topic}! I've been working on something related that the group might find valuable. {first_name}, your point about {specific_comment} really resonated with me. I'd love to continue this conversation and share some insights I've gathered from working with companies in {industry}.",
        conditions: ['group_member_4plus_days', 'recent_group_activity', 'relevant_discussion']
      },
      {
        step_number: 2,
        type: 'follow_up_message',
        delay_days: 3,
        message_template: "Hi {first_name}, thanks for the engaging discussion in {group_name}. I thought you might be interested in this resource I mentioned: {resource_link}. Would love to hear your thoughts!",
        conditions: ['group_interaction_occurred']
      },
      {
        step_number: 3,
        type: 'follow_up_message',
        delay_days: 7,
        message_template: "Hi {first_name}, I've been thinking about your insights on {group_topic} from {group_name}. I'm curious - how is {company_name} approaching this challenge? I'd love to learn from your experience.",
        conditions: ['positive_group_interaction']
      },
      {
        step_number: 4,
        type: 'follow_up_message',
        delay_days: 14,
        message_template: "Hi {first_name}, hope you're well! I wanted to share an update on the {group_topic} discussion we had in {group_name}. Based on our conversation, I put together some thoughts that might be relevant to {company_name}. Would you be interested in a quick call to discuss?",
        conditions: ['ongoing_engagement']
      }
    ],
    settings: {
      daily_limit: 10,
      delay_between_steps_days: 3,
      prerequisites: ['group_membership_4plus_days', 'active_group_participation'],
      timing_restrictions: ['weekdays_only', 'respect_group_rules']
    },
    variables: ['first_name', 'company_name', 'group_name', 'group_topic', 'specific_comment', 'industry', 'resource_link'],
    use_cases: ['Thought Leadership', 'Community Building', 'Expert Positioning'],
    expected_response_rate: '30-40%'
  },

  {
    id: 'company_follow_campaign',
    name: 'Company Follow Campaign',
    description: 'Invite prospects to follow your company page with engaging follow-up',
    type: 'company_follow',
    approval_required: true,
    manual_oversight: true,
    experimental: false,
    steps: [
      {
        step_number: 1,
        type: 'company_follow',
        delay_days: 0,
        message_template: "Hi {first_name}, I noticed you're doing great work in {industry} at {company_name}. I thought you might be interested in following our company page where we share insights about {relevant_topics}. We regularly post about industry trends that might be relevant to your work.",
        conditions: ['profile_relevant', 'industry_match']
      },
      {
        step_number: 2,
        type: 'follow_up_message',
        delay_days: 5,
        message_template: "Hi {first_name}, hope you're having a great week! I wanted to share our latest post about {recent_company_post_topic} - thought it might resonate with the work you're doing at {company_name}. Would love to hear your perspective on this trend in {industry}.",
        conditions: ['company_page_followed']
      },
      {
        step_number: 3,
        type: 'follow_up_message',
        delay_days: 10,
        message_template: "Hi {first_name}, I saw your recent activity and thought you might find our upcoming {event_type} interesting. We're discussing {event_topic} which seems aligned with {company_name}'s focus. Would you be interested in joining?",
        conditions: ['engaged_with_content']
      },
      {
        step_number: 4,
        type: 'follow_up_message',
        delay_days: 20,
        message_template: "Hi {first_name}, thanks for following our company updates! I've really enjoyed seeing your engagement with our content. I'd love to learn more about how {company_name} is approaching {relevant_challenge}. Are you available for a brief conversation this week?",
        conditions: ['regular_engagement', 'content_interaction']
      }
    ],
    settings: {
      daily_limit: 25,
      delay_between_steps_days: 2,
      timing_restrictions: ['weekdays_only', 'business_hours'],
      prerequisites: ['company_page_active', 'regular_content_posting']
    },
    variables: ['first_name', 'company_name', 'industry', 'relevant_topics', 'recent_company_post_topic', 'event_type', 'event_topic', 'relevant_challenge'],
    use_cases: ['Brand Awareness', 'Lead Generation', 'Community Building'],
    expected_response_rate: '20-30%'
  }
];

// Helper function to get One-off template by ID
export const getOneoffTemplateById = (id: string): OneoffCampaignTemplate | undefined => {
  return ONEOFF_CAMPAIGN_TEMPLATES.find(template => template.id === id);
};

// Helper function to get templates by type
export const getOneoffTemplatesByType = (type: OneoffCampaignTemplate['type']): OneoffCampaignTemplate[] => {
  return ONEOFF_CAMPAIGN_TEMPLATES.filter(template => template.type === type);
};

// Helper function to get experimental templates only
export const getExperimentalTemplates = (): OneoffCampaignTemplate[] => {
  return ONEOFF_CAMPAIGN_TEMPLATES.filter(template => template.experimental === true);
};

// Helper function to validate template variables for One-off campaigns
export const validateOneoffVariables = (template: OneoffCampaignTemplate, prospectData: any): string[] => {
  const missingVariables: string[] = [];
  
  template.variables.forEach(variable => {
    if (!prospectData[variable] && !prospectData[variable.replace('_', '')]) {
      missingVariables.push(variable);
    }
  });
  
  return missingVariables;
};

// Helper function to populate One-off template with prospect data
export const populateOneoffTemplate = (messageTemplate: string, prospectData: any): string => {
  let populatedMessage = messageTemplate;
  
  // Replace all variables in the format {variable_name}
  Object.keys(prospectData).forEach(key => {
    const regex = new RegExp(`{${key}}`, 'g');
    populatedMessage = populatedMessage.replace(regex, prospectData[key] || `[${key}]`);
  });
  
  return populatedMessage;
};