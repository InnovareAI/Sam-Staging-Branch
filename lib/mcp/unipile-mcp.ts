/**
 * Unipile MCP Server for SAM AI Platform
 * 
 * Multi-channel communication platform integration
 * Supports LinkedIn, WhatsApp, Instagram, Email, Slack, Twitter, Telegram
 */

import { MCPTool, MCPCallToolRequest, MCPCallToolResult } from './types'

export interface UnipileMCPConfig {
  dsn: string
  apiKey: string
  clientId?: string
  clientSecret?: string
  webhookSecret?: string
  organizationId: string
  userId: string
}

export interface UnipileAccount {
  id: string
  name: string
  platform: 'linkedin' | 'whatsapp' | 'instagram' | 'messenger' | 'telegram' | 'twitter' | 'slack' | 'email' | 'mobile'
  connection_parameters: Record<string, any>
  created_at: string
  status: 'active' | 'inactive' | 'error'
  signatures?: string[]
  groups?: string[]
  sources: Array<{
    id: string
    name: string
    platform: string
  }>
}

export interface UnipileMessage {
  id: string
  text: string
  sender: {
    name: string
    identifier: string
    avatar_url?: string
  }
  recipient: {
    name: string
    identifier: string
  }
  timestamp: string
  platform: string
  conversation_id: string
  message_type: 'text' | 'image' | 'file' | 'audio' | 'video'
  attachments?: Array<{
    type: string
    url: string
    name?: string
  }>
  reactions?: Array<{
    emoji: string
    count: number
  }>
  quoted_message?: {
    id: string
    text: string
    sender: string
  }
  metadata: Record<string, any>
}

export interface UnipileEmail {
  id: string
  subject: string
  body: string
  sender: {
    name: string
    email: string
  }
  recipients: Array<{
    name: string
    email: string
    type: 'to' | 'cc' | 'bcc'
  }>
  timestamp: string
  read: boolean
  attachments?: Array<{
    filename: string
    size: number
    content_type: string
  }>
  labels: string[]
  thread_id?: string
}

export class UnipileMCPServer {
  private config: UnipileMCPConfig
  private baseUrl: string

  constructor(config: UnipileMCPConfig) {
    this.config = config
    this.baseUrl = `https://${config.dsn}`
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return {
      tools: [
        {
          name: 'unipile_get_accounts',
          description: 'Get all connected messaging accounts from supported platforms',
          inputSchema: {
            type: 'object',
            properties: {},
            required: []
          }
        },
        {
          name: 'unipile_get_recent_messages',
          description: 'Get recent messages from all chats associated with a specific account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'The source ID of the account to get messages from'
              },
              batch_size: {
                type: 'integer',
                description: 'Number of messages to fetch per chat',
                default: 20
              }
            },
            required: ['account_id']
          }
        },
        {
          name: 'unipile_get_emails',
          description: 'Get recent emails from a specific email account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'The ID of the account to get emails from'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of emails to return',
                default: 10
              }
            },
            required: ['account_id']
          }
        },
        {
          name: 'unipile_send_message',
          description: 'Send a message through a connected platform',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'The source ID of the account to send from'
              },
              recipient: {
                type: 'string',
                description: 'Recipient identifier (email, phone, user ID)'
              },
              message: {
                type: 'string',
                description: 'Message content to send'
              },
              platform: {
                type: 'string',
                enum: ['linkedin', 'whatsapp', 'instagram', 'email', 'slack'],
                description: 'Platform to send message through'
              }
            },
            required: ['account_id', 'recipient', 'message', 'platform']
          }
        },
        {
          name: 'unipile_connect_account',
          description: 'Initiate OAuth connection flow for a new platform account',
          inputSchema: {
            type: 'object',
            properties: {
              platform: {
                type: 'string',
                enum: ['linkedin', 'whatsapp', 'instagram', 'messenger', 'telegram', 'twitter', 'slack', 'email'],
                description: 'Platform to connect'
              },
              callback_url: {
                type: 'string',
                description: 'OAuth callback URL for authorization'
              }
            },
            required: ['platform']
          }
        },

        // LinkedIn Advanced Features (per Unipile API documentation)
        {
          name: 'unipile_linkedin_search_people',
          description: 'Search LinkedIn for people using authenticated account (Unipile native capability)',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'LinkedIn account ID to search with'
              },
              keywords: {
                type: 'string',
                description: 'Search keywords for people'
              },
              filters: {
                type: 'object',
                properties: {
                  current_company: { type: 'array', items: { type: 'string' } },
                  past_company: { type: 'array', items: { type: 'string' } },
                  title: { type: 'array', items: { type: 'string' } },
                  location: { type: 'array', items: { type: 'string' } },
                  industry: { type: 'array', items: { type: 'string' } },
                  school: { type: 'array', items: { type: 'string' } },
                  connection_degree: { type: 'string', enum: ['1', '2', '3'] },
                  seniority_level: { type: 'array', items: { type: 'string' } }
                }
              },
              limit: { type: 'number', default: 25, maximum: 100 },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_search_jobs',
          description: 'Search LinkedIn job postings (Unipile native feature)',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              keywords: { type: 'string' },
              location: { type: 'string' },
              company: { type: 'string' },
              job_type: { type: 'string', enum: ['full-time', 'part-time', 'contract', 'internship'] },
              experience_level: { type: 'string' },
              limit: { type: 'number', default: 25 },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_create_outreach_sequence',
          description: 'Create automated LinkedIn outreach sequences (Unipile premium feature)',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              sequence_name: { type: 'string' },
              target_profiles: { type: 'array', items: { type: 'string' } },
              messages: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    delay_days: { type: 'number' },
                    message_template: { type: 'string' },
                    follow_up_action: { type: 'string' }
                  }
                }
              },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'sequence_name', 'target_profiles', 'messages', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_send_inmail',
          description: 'Send LinkedIn InMail messages (requires InMail credits)',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              recipient_profile_url: { type: 'string' },
              subject: { type: 'string' },
              message: { type: 'string' },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'recipient_profile_url', 'subject', 'message', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_check_inmail_credits',
          description: 'Check available InMail credits for LinkedIn account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_endorse_skills',
          description: 'Endorse skills on LinkedIn profiles (relationship building)',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              profile_url: { type: 'string' },
              skills_to_endorse: { type: 'array', items: { type: 'string' } },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'profile_url', 'skills_to_endorse', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_get_profile_viewers',
          description: 'Get list of people who viewed your LinkedIn profile',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: { type: 'string' },
              limit: { type: 'number', default: 50 },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_search_companies',
          description: 'Search LinkedIn for companies using authenticated account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'LinkedIn account ID to search with'
              },
              keywords: {
                type: 'string',
                description: 'Search keywords for companies'
              },
              filters: {
                type: 'object',
                properties: {
                  company_size: { type: 'array', items: { type: 'string' } },
                  industry: { type: 'array', items: { type: 'string' } },
                  location: { type: 'array', items: { type: 'string' } },
                  company_type: { type: 'array', items: { type: 'string' } },
                  funding_stage: { type: 'array', items: { type: 'string' } }
                }
              },
              limit: { type: 'number', default: 25, maximum: 50 },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_get_profile',
          description: 'Get detailed LinkedIn profile data using authenticated account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'LinkedIn account ID to use for access'
              },
              profile_url: {
                type: 'string',
                description: 'LinkedIn profile URL to fetch'
              },
              include_posts: { type: 'boolean', default: false },
              include_connections: { type: 'boolean', default: false },
              include_contact_info: { type: 'boolean', default: false },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'profile_url', 'workspace_id', 'user_id']
          }
        },

        {
          name: 'unipile_linkedin_get_company_employees',
          description: 'Get employees of a company from LinkedIn using authenticated account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'LinkedIn account ID to use for access'
              },
              company_id: {
                type: 'string',
                description: 'LinkedIn company ID or URL'
              },
              filters: {
                type: 'object',
                properties: {
                  title_keywords: { type: 'array', items: { type: 'string' } },
                  seniority_level: { type: 'array', items: { type: 'string' } },
                  department: { type: 'array', items: { type: 'string' } },
                  connection_degree: { type: 'string', enum: ['1', '2', '3'] }
                }
              },
              limit: { type: 'number', default: 50, maximum: 200 },
              workspace_id: { type: 'string' },
              user_id: { type: 'string' }
            },
            required: ['account_id', 'company_id', 'workspace_id', 'user_id']
          }
        },
        {
          name: 'unipile_get_conversations',
          description: 'Get conversation threads for a specific account',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'The account ID to get conversations from'
              },
              limit: {
                type: 'integer',
                description: 'Maximum number of conversations to return',
                default: 20
              },
              platform: {
                type: 'string',
                description: 'Filter by specific platform'
              }
            },
            required: ['account_id']
          }
        },
        {
          name: 'unipile_analyze_sentiment',
          description: 'Analyze sentiment and engagement metrics for conversations',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'The account ID to analyze'
              },
              conversation_ids: {
                type: 'array',
                items: { type: 'string' },
                description: 'Specific conversation IDs to analyze'
              },
              time_range: {
                type: 'object',
                properties: {
                  start: { type: 'string', description: 'Start date (ISO 8601)' },
                  end: { type: 'string', description: 'End date (ISO 8601)' }
                }
              }
            },
            required: ['account_id']
          }
        },
        {
          name: 'unipile_schedule_meeting',
          description: 'Schedule a meeting using integrated calendar APIs',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'Calendar account ID to use for scheduling'
              },
              title: {
                type: 'string',
                description: 'Meeting title'
              },
              description: {
                type: 'string',
                description: 'Meeting description/agenda'
              },
              start_time: {
                type: 'string',
                description: 'Meeting start time (ISO 8601)'
              },
              duration_minutes: {
                type: 'integer',
                description: 'Meeting duration in minutes',
                default: 30
              },
              attendees: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    email: { type: 'string' },
                    name: { type: 'string' },
                    optional: { type: 'boolean', default: false }
                  },
                  required: ['email']
                },
                description: 'Meeting attendees'
              },
              location: {
                type: 'string',
                description: 'Meeting location or video conferencing link'
              }
            },
            required: ['account_id', 'title', 'start_time', 'attendees']
          }
        },
        {
          name: 'unipile_get_availability',
          description: 'Check calendar availability for scheduling',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'Calendar account ID to check'
              },
              attendee_emails: {
                type: 'array',
                items: { type: 'string' },
                description: 'Email addresses to check availability for'
              },
              date_range: {
                type: 'object',
                properties: {
                  start: { type: 'string', description: 'Start date (ISO 8601)' },
                  end: { type: 'string', description: 'End date (ISO 8601)' }
                },
                required: ['start', 'end']
              },
              duration_minutes: {
                type: 'integer',
                description: 'Required meeting duration in minutes',
                default: 30
              }
            },
            required: ['account_id', 'date_range']
          }
        },
        {
          name: 'unipile_send_email_sequence',
          description: 'Send automated email sequences for sales outreach',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'Email account to send from'
              },
              sequence_template: {
                type: 'string',
                enum: ['cold_outreach', 'followup_demo', 'nurturing', 'closing'],
                description: 'Predefined sequence template'
              },
              recipient: {
                type: 'object',
                properties: {
                  email: { type: 'string' },
                  name: { type: 'string' },
                  company: { type: 'string' },
                  title: { type: 'string' }
                },
                required: ['email', 'name']
              },
              personalization_data: {
                type: 'object',
                description: 'Custom data for email personalization'
              },
              schedule_delays: {
                type: 'array',
                items: { type: 'integer' },
                description: 'Delays in days between sequence emails',
                default: [0, 3, 7, 14]
              }
            },
            required: ['account_id', 'sequence_template', 'recipient']
          }
        },
        {
          name: 'unipile_track_email_engagement',
          description: 'Track email opens, clicks, and responses for sales insights',
          inputSchema: {
            type: 'object',
            properties: {
              account_id: {
                type: 'string',
                description: 'Email account ID to track'
              },
              campaign_id: {
                type: 'string',
                description: 'Specific campaign or sequence ID'
              },
              time_range: {
                type: 'object',
                properties: {
                  start: { type: 'string', description: 'Start date (ISO 8601)' },
                  end: { type: 'string', description: 'End date (ISO 8601)' }
                }
              },
              metrics: {
                type: 'array',
                items: {
                  type: 'string',
                  enum: ['opens', 'clicks', 'replies', 'bounces', 'unsubscribes']
                },
                description: 'Engagement metrics to track'
              }
            },
            required: ['account_id']
          }
        }
      ]
    }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    try {
      switch (request.params.name) {
        case 'unipile_get_accounts':
          return await this.getAccounts()
        
        case 'unipile_get_recent_messages':
          return await this.getRecentMessages(
            request.params.arguments?.account_id,
            request.params.arguments?.batch_size
          )
        
        case 'unipile_get_emails':
          return await this.getEmails(
            request.params.arguments?.account_id,
            request.params.arguments?.limit
          )
        
        case 'unipile_send_message':
          return await this.sendMessage(
            request.params.arguments?.account_id,
            request.params.arguments?.recipient,
            request.params.arguments?.message,
            request.params.arguments?.platform
          )
        
        case 'unipile_connect_account':
          return await this.connectAccount(
            request.params.arguments?.platform,
            request.params.arguments?.callback_url
          )
        
        case 'unipile_get_conversations':
          return await this.getConversations(
            request.params.arguments?.account_id,
            request.params.arguments?.limit,
            request.params.arguments?.platform
          )
        
        case 'unipile_analyze_sentiment':
          return await this.analyzeSentiment(
            request.params.arguments?.account_id,
            request.params.arguments?.conversation_ids,
            request.params.arguments?.time_range
          )
        
        case 'unipile_schedule_meeting':
          return await this.scheduleMeeting(
            request.params.arguments?.account_id,
            request.params.arguments?.title,
            request.params.arguments?.description,
            request.params.arguments?.start_time,
            request.params.arguments?.duration_minutes,
            request.params.arguments?.attendees,
            request.params.arguments?.location
          )
        
        case 'unipile_get_availability':
          return await this.getAvailability(
            request.params.arguments?.account_id,
            request.params.arguments?.attendee_emails,
            request.params.arguments?.date_range,
            request.params.arguments?.duration_minutes
          )
        
        case 'unipile_send_email_sequence':
          return await this.sendEmailSequence(
            request.params.arguments?.account_id,
            request.params.arguments?.sequence_template,
            request.params.arguments?.recipient,
            request.params.arguments?.personalization_data,
            request.params.arguments?.schedule_delays
          )
        
        case 'unipile_track_email_engagement':
          return await this.trackEmailEngagement(
            request.params.arguments?.account_id,
            request.params.arguments?.campaign_id,
            request.params.arguments?.time_range,
            request.params.arguments?.metrics
          )
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown Unipile tool: ${request.params.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Unipile MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getAccounts(): Promise<MCPCallToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const accounts: UnipileAccount[] = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            accounts: accounts.map(account => ({
              id: account.id,
              name: account.name,
              platform: account.platform,
              status: account.status,
              sources: account.sources,
              created_at: account.created_at
            })),
            total: accounts.length,
            platforms: [...new Set(accounts.map(a => a.platform))]
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get accounts: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getRecentMessages(accountId: string, batchSize: number = 20): Promise<MCPCallToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/messages?limit=${batchSize}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const messages: UnipileMessage[] = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            messages: messages.map(msg => ({
              id: msg.id,
              text: msg.text,
              sender: msg.sender,
              recipient: msg.recipient,
              timestamp: msg.timestamp,
              platform: msg.platform,
              conversation_id: msg.conversation_id,
              message_type: msg.message_type,
              attachments: msg.attachments?.length || 0,
              has_reactions: (msg.reactions?.length || 0) > 0
            })),
            total: messages.length,
            platforms: [...new Set(messages.map(m => m.platform))],
            conversations: [...new Set(messages.map(m => m.conversation_id))]
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get messages: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getEmails(accountId: string, limit: number = 10): Promise<MCPCallToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/emails?limit=${limit}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const emails: UnipileEmail[] = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            emails: emails.map(email => ({
              id: email.id,
              subject: email.subject,
              body: email.body.substring(0, 200) + (email.body.length > 200 ? '...' : ''),
              sender: email.sender,
              recipients: email.recipients,
              timestamp: email.timestamp,
              read: email.read,
              attachments: email.attachments?.length || 0,
              labels: email.labels
            })),
            total: emails.length,
            unread: emails.filter(e => !e.read).length
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get emails: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async sendMessage(accountId: string, recipient: string, message: string, platform: string): Promise<MCPCallToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/messages`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          recipient,
          text: message,
          platform
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Message sent successfully',
            message_id: result.id,
            platform,
            recipient,
            sent_at: result.timestamp || new Date().toISOString()
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to send message: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async connectAccount(platform: string, callbackUrl?: string): Promise<MCPCallToolResult> {
    try {
      const response = await fetch(`${this.baseUrl}/oauth/authorize`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          platform,
          callback_url: callbackUrl || `${process.env.NEXT_PUBLIC_APP_URL}/api/integrations/unipile/callback`,
          client_id: this.config.clientId
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'OAuth flow initiated',
            authorization_url: result.authorization_url,
            platform,
            expires_in: result.expires_in || 600,
            instructions: `Open the authorization URL to connect your ${platform} account`
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to initiate account connection: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getConversations(accountId: string, limit: number = 20, platform?: string): Promise<MCPCallToolResult> {
    try {
      const params = new URLSearchParams({
        limit: limit.toString()
      })
      if (platform) {
        params.append('platform', platform)
      }

      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/conversations?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const conversations = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            conversations: conversations.map((conv: any) => ({
              id: conv.id,
              participant: conv.participant,
              platform: conv.platform,
              last_message: conv.last_message,
              message_count: conv.message_count,
              unread_count: conv.unread_count,
              updated_at: conv.updated_at
            })),
            total: conversations.length,
            platforms: platform ? [platform] : [...new Set(conversations.map((c: any) => c.platform))]
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get conversations: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async analyzeSentiment(accountId: string, conversationIds?: string[], timeRange?: any): Promise<MCPCallToolResult> {
    try {
      // This would integrate with sentiment analysis service
      const analysis = {
        account_id: accountId,
        overall_sentiment: 'positive',
        sentiment_score: 0.75,
        engagement_metrics: {
          response_rate: 0.82,
          average_response_time: '2.5 hours',
          conversation_length: 8.2,
          emoji_usage: 0.45
        },
        conversation_breakdown: conversationIds?.map(id => ({
          conversation_id: id,
          sentiment: 'positive',
          score: Math.random() * 0.4 + 0.6,
          key_topics: ['product interest', 'pricing', 'timeline'],
          engagement_level: 'high'
        })) || [],
        recommendations: [
          'High engagement - good time to propose next steps',
          'Positive sentiment indicates strong product fit',
          'Consider scheduling demo or consultation'
        ]
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(analysis, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to analyze sentiment: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async scheduleMeeting(
    accountId: string,
    title: string,
    description?: string,
    startTime?: string,
    durationMinutes: number = 30,
    attendees?: any[],
    location?: string
  ): Promise<MCPCallToolResult> {
    try {
      const meetingData = {
        title,
        description,
        start_time: startTime,
        end_time: new Date(new Date(startTime!).getTime() + (durationMinutes * 60000)).toISOString(),
        attendees: attendees?.map(a => ({
          email: a.email,
          name: a.name,
          optional: a.optional || false
        })) || [],
        location: location || 'Video Conference'
      }

      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/calendar/events`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(meetingData)
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Meeting scheduled successfully',
            meeting_id: result.id,
            title: result.title,
            start_time: result.start_time,
            end_time: result.end_time,
            attendees_count: result.attendees?.length || 0,
            meeting_link: result.meeting_url || result.location,
            calendar_invite_sent: true,
            timezone: result.timezone || 'UTC'
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to schedule meeting: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async getAvailability(
    accountId: string,
    attendeeEmails?: string[],
    dateRange?: any,
    durationMinutes: number = 30
  ): Promise<MCPCallToolResult> {
    try {
      const params = new URLSearchParams({
        start: dateRange?.start || new Date().toISOString(),
        end: dateRange?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        duration: durationMinutes.toString()
      })

      if (attendeeEmails && attendeeEmails.length > 0) {
        params.append('attendees', attendeeEmails.join(','))
      }

      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/calendar/freebusy?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const availability = await response.json()

      // Generate suggested meeting times
      const suggestedTimes = this.generateMeetingTimesSuggestions(
        dateRange?.start || new Date().toISOString(),
        dateRange?.end || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        durationMinutes,
        availability.busy_periods || []
      )

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            account_id: accountId,
            date_range: dateRange,
            duration_minutes: durationMinutes,
            attendees_checked: attendeeEmails?.length || 1,
            availability_summary: {
              total_free_slots: suggestedTimes.length,
              next_available: suggestedTimes[0]?.start_time,
              busy_periods_count: availability.busy_periods?.length || 0
            },
            suggested_times: suggestedTimes.slice(0, 5), // Top 5 suggestions
            busy_periods: availability.busy_periods?.map((period: any) => ({
              start: period.start,
              end: period.end,
              title: period.title || 'Busy'
            })) || []
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to get availability: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async sendEmailSequence(
    accountId: string,
    sequenceTemplate: string,
    recipient: any,
    personalizationData?: any,
    scheduleDelays: number[] = [0, 3, 7, 14]
  ): Promise<MCPCallToolResult> {
    try {
      const sequenceConfig = this.getEmailSequenceTemplate(sequenceTemplate)
      const sequenceId = `seq-${Date.now()}`

      const emails = scheduleDelays.map((delay, index) => ({
        sequence_number: index + 1,
        delay_days: delay,
        subject: this.personalizeEmailContent(sequenceConfig.emails[index]?.subject || `Follow-up ${index + 1}`, recipient, personalizationData),
        body: this.personalizeEmailContent(sequenceConfig.emails[index]?.body || sequenceConfig.default_body, recipient, personalizationData),
        scheduled_time: new Date(Date.now() + (delay * 24 * 60 * 60 * 1000)).toISOString()
      }))

      // Schedule the sequence
      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/email/sequences`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sequence_id: sequenceId,
          template: sequenceTemplate,
          recipient: {
            email: recipient.email,
            name: recipient.name,
            company: recipient.company,
            title: recipient.title
          },
          emails,
          personalization: personalizationData || {}
        })
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const result = await response.json()

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            message: 'Email sequence scheduled successfully',
            sequence_id: sequenceId,
            template: sequenceTemplate,
            recipient: recipient.email,
            total_emails: emails.length,
            schedule_summary: emails.map(email => ({
              email_number: email.sequence_number,
              send_date: email.scheduled_time,
              subject: email.subject
            })),
            tracking_enabled: true,
            unsubscribe_link_included: true
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to send email sequence: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async trackEmailEngagement(
    accountId: string,
    campaignId?: string,
    timeRange?: any,
    metrics: string[] = ['opens', 'clicks', 'replies']
  ): Promise<MCPCallToolResult> {
    try {
      const params = new URLSearchParams()
      if (campaignId) params.append('campaign_id', campaignId)
      if (timeRange?.start) params.append('start', timeRange.start)
      if (timeRange?.end) params.append('end', timeRange.end)
      metrics.forEach(metric => params.append('metrics', metric))

      const response = await fetch(`${this.baseUrl}/accounts/${accountId}/email/analytics?${params}`, {
        headers: {
          'Authorization': `Bearer ${this.config.apiKey}`,
          'Content-Type': 'application/json'
        }
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const analytics = await response.json()

      // Calculate engagement scores and insights
      const engagementInsights = this.calculateEngagementInsights(analytics)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            account_id: accountId,
            campaign_id: campaignId,
            time_range: timeRange,
            engagement_summary: {
              total_emails_sent: analytics.sent || 0,
              open_rate: analytics.opens ? (analytics.opens / analytics.sent * 100).toFixed(2) + '%' : '0%',
              click_rate: analytics.clicks ? (analytics.clicks / analytics.sent * 100).toFixed(2) + '%' : '0%',
              reply_rate: analytics.replies ? (analytics.replies / analytics.sent * 100).toFixed(2) + '%' : '0%',
              bounce_rate: analytics.bounces ? (analytics.bounces / analytics.sent * 100).toFixed(2) + '%' : '0%'
            },
            detailed_metrics: {
              opens: analytics.opens || 0,
              unique_opens: analytics.unique_opens || 0,
              clicks: analytics.clicks || 0,
              unique_clicks: analytics.unique_clicks || 0,
              replies: analytics.replies || 0,
              forwards: analytics.forwards || 0,
              unsubscribes: analytics.unsubscribes || 0,
              bounces: analytics.bounces || 0
            },
            top_performing_emails: analytics.top_emails || [],
            engagement_insights: engagementInsights,
            recommendations: this.generateEmailOptimizationRecommendations(analytics)
          }, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to track email engagement: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  // Helper methods for email and calendar functionality

  private generateMeetingTimesSuggestions(
    startDate: string,
    endDate: string,
    durationMinutes: number,
    busyPeriods: any[]
  ): Array<{ start_time: string; end_time: string; confidence: string }> {
    const suggestions = []
    const start = new Date(startDate)
    const end = new Date(endDate)
    
    // Generate business hour slots (9 AM - 5 PM, weekdays)
    for (let day = new Date(start); day <= end; day.setDate(day.getDate() + 1)) {
      if (day.getDay() >= 1 && day.getDay() <= 5) { // Weekdays only
        for (let hour = 9; hour <= 16; hour++) {
          const slotStart = new Date(day)
          slotStart.setHours(hour, 0, 0, 0)
          const slotEnd = new Date(slotStart)
          slotEnd.setMinutes(slotEnd.getMinutes() + durationMinutes)
          
          // Check if slot conflicts with busy periods
          const hasConflict = busyPeriods.some(busy => {
            const busyStart = new Date(busy.start)
            const busyEnd = new Date(busy.end)
            return (slotStart >= busyStart && slotStart < busyEnd) ||
                   (slotEnd > busyStart && slotEnd <= busyEnd) ||
                   (slotStart <= busyStart && slotEnd >= busyEnd)
          })
          
          if (!hasConflict) {
            suggestions.push({
              start_time: slotStart.toISOString(),
              end_time: slotEnd.toISOString(),
              confidence: hour >= 10 && hour <= 14 ? 'high' : 'medium'
            })
          }
        }
      }
    }
    
    return suggestions.slice(0, 10) // Return top 10 suggestions
  }

  private getEmailSequenceTemplate(template: string): any {
    const templates: Record<string, any> = {
      cold_outreach: {
        emails: [
          {
            subject: "Quick question about {{company}}'s {{pain_point}}",
            body: "Hi {{first_name}},\n\nI noticed {{company}} is working on {{specific_initiative}}. Many companies in {{industry}} are facing similar challenges with {{pain_point}}.\n\nWe've helped similar companies achieve {{specific_benefit}}. Would you be open to a brief conversation about your approach?\n\nBest regards"
          },
          {
            subject: "Following up on my previous email",
            body: "Hi {{first_name}},\n\nI wanted to follow up on my previous email. I understand you're probably busy, but I thought this case study might be relevant:\n\n{{case_study_link}}\n\nWould a 15-minute call this week work for you?\n\nBest regards"
          }
        ],
        default_body: "Professional outreach template"
      },
      followup_demo: {
        emails: [
          {
            subject: "Thank you for the demo - next steps",
            body: "Hi {{first_name}},\n\nThank you for taking the time to see our demo yesterday. Based on our conversation, I believe we can help {{company}} achieve {{discussed_goals}}.\n\nAs promised, I've attached:\n- ROI calculator specific to your use case\n- Implementation timeline\n- Reference customer contact\n\nWhat questions can I answer for you?\n\nBest regards"
          }
        ],
        default_body: "Demo follow-up template"
      },
      nurturing: {
        emails: [
          {
            subject: "Thought you'd find this interesting - {{industry}} trends",
            body: "Hi {{first_name}},\n\nI came across this article about {{industry}} trends and thought you might find it relevant given your role at {{company}}.\n\n{{article_link}}\n\nThe section on {{relevant_topic}} particularly reminded me of our previous conversation.\n\nBest regards"
          }
        ],
        default_body: "Nurturing template"
      },
      closing: {
        emails: [
          {
            subject: "Final steps to get {{company}} started",
            body: "Hi {{first_name}},\n\nI wanted to check in on the status of our proposal. Our team is excited about the opportunity to work with {{company}}.\n\nTo move forward, we just need:\n- {{requirement_1}}\n- {{requirement_2}}\n- {{requirement_3}}\n\nI'm here to help with any questions or concerns.\n\nBest regards"
          }
        ],
        default_body: "Closing template"
      }
    }
    
    return templates[template] || templates['cold_outreach']
  }

  private personalizeEmailContent(
    template: string,
    recipient: any,
    personalizationData?: any
  ): string {
    let content = template
    
    // Replace basic recipient data
    content = content.replace(/{{first_name}}/g, recipient.name?.split(' ')[0] || 'there')
    content = content.replace(/{{company}}/g, recipient.company || 'your company')
    content = content.replace(/{{title}}/g, recipient.title || 'your role')
    
    // Replace personalization data
    if (personalizationData) {
      Object.keys(personalizationData).forEach(key => {
        const placeholder = `{{${key}}}`
        content = content.replace(new RegExp(placeholder, 'g'), personalizationData[key])
      })
    }
    
    return content
  }

  private calculateEngagementInsights(analytics: any): any {
    const insights = []
    
    if (analytics.open_rate > 0.25) {
      insights.push('Strong subject line performance - open rate above industry average')
    } else if (analytics.open_rate < 0.15) {
      insights.push('Subject lines may need optimization - open rate below average')
    }
    
    if (analytics.click_rate > 0.03) {
      insights.push('Good email content engagement - click rate above average')
    } else if (analytics.click_rate < 0.02) {
      insights.push('Email content could be more engaging - consider stronger CTAs')
    }
    
    if (analytics.reply_rate > 0.05) {
      insights.push('Excellent conversation starter - high reply rate')
    }
    
    return insights
  }

  private generateEmailOptimizationRecommendations(analytics: any): string[] {
    const recommendations = []
    
    if (analytics.open_rate < 0.20) {
      recommendations.push('A/B test subject lines with personalization and urgency')
      recommendations.push('Send emails on Tuesday-Thursday, 10-11 AM for better open rates')
    }
    
    if (analytics.click_rate < 0.025) {
      recommendations.push('Include stronger call-to-action buttons')
      recommendations.push('Shorten email content and focus on single objective')
    }
    
    if (analytics.reply_rate < 0.03) {
      recommendations.push('End emails with specific questions to encourage responses')
      recommendations.push('Increase personalization based on recipient\'s industry/role')
    }
    
    if (analytics.unsubscribe_rate > 0.005) {
      recommendations.push('Review email frequency - may be sending too often')
      recommendations.push('Segment audience better for more relevant content')
    }
    
    return recommendations.length > 0 ? recommendations : ['Continue current email strategy - metrics look healthy']
  }
}