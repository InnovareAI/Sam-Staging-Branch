// Demo data for SAM AI application
export const demoData = {
  // User and workspace data
  user: {
    id: 'demo-user-1',
    email: 'demo@example.com',
    name: 'Demo User',
    avatar: null,
  },

  workspaces: [
    {
      id: 'demo-workspace-1',
      name: 'Demo Startup',
      slug: 'demo-startup',
      tier: 'startup',
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'demo-workspace-2', 
      name: 'Demo Enterprise',
      slug: 'demo-enterprise',
      tier: 'enterprise',
      created_at: '2024-02-01T10:00:00Z',
    },
  ],

  // Campaign data
  campaigns: [
    {
      id: 'demo-campaign-1',
      name: 'Q4 Outreach Campaign',
      type: 'multi_channel',
      status: 'active',
      prospects_contacted: 145,
      replies_received: 23,
      response_rate: 15.9,
      created_at: '2024-09-01T10:00:00Z',
      last_message_sent: '2024-09-18T08:30:00Z',
    },
    {
      id: 'demo-campaign-2',
      name: 'LinkedIn CEO Outreach',
      type: 'linkedin_only',
      status: 'paused',
      prospects_contacted: 87,
      replies_received: 12,
      response_rate: 13.8,
      created_at: '2024-08-15T10:00:00Z',
      last_message_sent: '2024-09-10T14:20:00Z',
    },
    {
      id: 'demo-campaign-3',
      name: 'Email Follow-up Series',
      type: 'email_only',
      status: 'completed',
      prospects_contacted: 234,
      replies_received: 41,
      response_rate: 17.5,
      created_at: '2024-07-01T10:00:00Z',
      last_message_sent: '2024-08-30T16:45:00Z',
    },
  ],

  // Prospect data
  prospects: [
    {
      id: 'demo-prospect-1',
      company_name: 'TechCorp Solutions',
      contact_name: 'Sarah Johnson',
      contact_email: 'sarah.johnson@techcorp.com',
      contact_linkedin_url: 'https://linkedin.com/in/sarahjohnson',
      contact_title: 'VP of Engineering',
      company_website: 'https://techcorp.com',
      company_industry: 'Software',
      company_size: '200-500',
      status: 'approved',
      approved_at: '2024-09-15T10:00:00Z',
      icp_match_score: 0.92,
      enrichment_status: 'completed',
    },
    {
      id: 'demo-prospect-2',
      company_name: 'InnovateLabs',
      contact_name: 'Michael Chen',
      contact_email: 'michael.chen@innovatelabs.io',
      contact_linkedin_url: 'https://linkedin.com/in/michaelchen',
      contact_title: 'CTO',
      company_website: 'https://innovatelabs.io',
      company_industry: 'AI/ML',
      company_size: '50-100',
      status: 'pending',
      icp_match_score: 0.87,
      enrichment_status: 'in_progress',
    },
    {
      id: 'demo-prospect-3',
      company_name: 'DataFlow Inc',
      contact_name: 'Lisa Rodriguez',
      contact_email: 'lisa.rodriguez@dataflow.com',
      contact_linkedin_url: 'https://linkedin.com/in/lisarodriguez',
      contact_title: 'Head of Data Science',
      company_website: 'https://dataflow.com',
      company_industry: 'Data Analytics',
      company_size: '100-200',
      status: 'approved',
      approved_at: '2024-09-14T10:00:00Z',
      icp_match_score: 0.85,
      enrichment_status: 'completed',
    },
  ],

  // Analytics data
  analytics: {
    overview: {
      total_prospects: 1247,
      total_campaigns: 8,
      active_campaigns: 3,
      total_messages_sent: 2156,
      total_replies: 287,
      overall_response_rate: 13.3,
      conversion_rate: 4.2,
    },
    monthly_stats: [
      { month: 'Jan', prospects: 95, campaigns: 2, response_rate: 12.1 },
      { month: 'Feb', prospects: 142, campaigns: 3, response_rate: 14.2 },
      { month: 'Mar', prospects: 178, campaigns: 2, response_rate: 11.8 },
      { month: 'Apr', prospects: 203, campaigns: 4, response_rate: 15.6 },
      { month: 'May', prospects: 189, campaigns: 3, response_rate: 13.9 },
      { month: 'Jun', prospects: 234, campaigns: 5, response_rate: 16.2 },
      { month: 'Jul', prospects: 198, campaigns: 2, response_rate: 12.4 },
      { month: 'Aug', prospects: 287, campaigns: 4, response_rate: 14.8 },
      { month: 'Sep', prospects: 321, campaigns: 3, response_rate: 15.1 },
    ],
    channel_performance: [
      { channel: 'LinkedIn', messages: 1245, replies: 167, rate: 13.4 },
      { channel: 'Email', messages: 911, replies: 120, rate: 13.2 },
    ],
    industry_breakdown: [
      { industry: 'Technology', count: 312, percentage: 35 },
      { industry: 'Healthcare', count: 187, percentage: 21 },
      { industry: 'Finance', count: 156, percentage: 18 },
      { industry: 'Manufacturing', count: 134, percentage: 15 },
      { industry: 'Other', count: 98, percentage: 11 },
    ],
  },

  // Messages and conversations
  messages: [
    {
      id: 'demo-msg-1',
      thread_id: 'demo-thread-1',
      content: 'Hi Sarah, I noticed TechCorp Solutions has been expanding rapidly. Would you be interested in learning how companies like yours are using AI to streamline their engineering workflows?',
      role: 'assistant',
      timestamp: '2024-09-18T08:30:00Z',
      channel: 'linkedin',
      prospect_id: 'demo-prospect-1',
      status: 'sent',
    },
    {
      id: 'demo-msg-2',
      thread_id: 'demo-thread-1',
      content: 'Thanks for reaching out! We are indeed looking at ways to improve our development efficiency. Could you send me some more details?',
      role: 'user',
      timestamp: '2024-09-18T14:20:00Z',
      channel: 'linkedin',
      prospect_id: 'demo-prospect-1',
      status: 'received',
    },
  ],

  // Knowledge base data
  knowledgeBase: [
    {
      id: 'demo-kb-1',
      title: 'Company Overview',
      content: 'SAM AI is a leading provider of AI-powered sales automation solutions...',
      type: 'company_info',
      category: 'about',
      tags: ['company', 'overview', 'mission'],
      created_at: '2024-01-01T10:00:00Z',
    },
    {
      id: 'demo-kb-2',
      title: 'Product Features',
      content: 'Our platform offers intelligent prospect scoring, automated outreach, and real-time analytics...',
      type: 'product_info',
      category: 'features',
      tags: ['product', 'features', 'capabilities'],
      created_at: '2024-01-15T10:00:00Z',
    },
    {
      id: 'demo-kb-3',
      title: 'Success Stories',
      content: 'TechCorp increased their response rates by 340% using SAM AI...',
      type: 'case_study',
      category: 'success_stories',
      tags: ['case_study', 'results', 'roi'],
      created_at: '2024-02-01T10:00:00Z',
    },
  ],

  // Account data
  accounts: [
    {
      id: 'demo-account-1',
      type: 'linkedin',
      name: 'Demo LinkedIn Account',
      identifier: 'demo@example.com',
      status: 'connected',
      daily_limit: 50,
      daily_usage: 23,
      usage_percentage: 0.46,
      last_message_sent: '2024-09-18T08:30:00Z',
      is_primary: true,
      is_selected: true,
    },
    {
      id: 'demo-account-2',
      type: 'email',
      name: 'Demo Email Account',
      identifier: 'outreach@demo.com',
      status: 'connected',
      daily_limit: 200,
      daily_usage: 87,
      usage_percentage: 0.435,
      last_message_sent: '2024-09-18T09:15:00Z',
      is_primary: false,
      is_selected: false,
    },
  ],

  // System stats for admin
  systemStats: {
    total_workspaces: 156,
    active_workspaces: 142,
    total_users: 298,
    active_users: 267,
    total_campaigns: 89,
    active_campaigns: 23,
    total_messages_sent: 45782,
    total_prospects: 12456,
    system_uptime: 99.97,
    last_deployment: '2024-09-17T22:30:00Z',
  },

  // Deployment results for admin
  deploymentResults: [
    {
      workspace_id: 'workspace-1',
      workspace_name: 'TechCorp Demo',
      status: 'success',
    },
    {
      workspace_id: 'workspace-2', 
      workspace_name: 'InnovateLabs Trial',
      status: 'success',
    },
    {
      workspace_id: 'workspace-3',
      workspace_name: 'DataFlow Inc',
      status: 'error',
      error: 'Authentication timeout',
    },
  ],

  // Unipile messages
  unipileMessages: [
    {
      id: 'unipile-msg-1',
      account_id: 'demo-account-1',
      messaging_product: 'LinkedIn',
      type: 'direct_message',
      text: 'Thanks for connecting! I noticed your recent post about scaling engineering teams...',
      timestamp: '2024-09-18T08:30:00Z',
      from: {
        name: 'Demo User',
        username: 'demo_user',
      },
      to: {
        name: 'Sarah Johnson',
        username: 'sarah_johnson',
      },
    },
    {
      id: 'unipile-msg-2',
      account_id: 'demo-account-2',
      messaging_product: 'Email',
      type: 'email',
      text: 'Hi Michael, I hope this email finds you well. I wanted to follow up on our previous conversation...',
      timestamp: '2024-09-18T09:15:00Z',
      from: {
        name: 'Demo User',
        email: 'demo@example.com',
      },
      to: {
        name: 'Michael Chen',
        email: 'michael.chen@innovatelabs.io',
      },
    },
  ],
}

// Helper function to get demo data based on type
export function getDemoData(type: keyof typeof demoData) {
  return demoData[type]
}

// Helper function to simulate API delay
export function simulateApiDelay(ms = 500): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}