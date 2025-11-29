/**
 * Reply Agent MCP Server for SAM AI Platform
 *
 * Intelligent response generation using Claude Direct API
 * Specialized for sales conversations, support, and professional communication
 *
 * Updated Nov 29, 2025: Migrated to Claude Direct API for GDPR compliance
 */

import { MCPTool, MCPCallToolRequest, MCPCallToolResult } from './types'
import { claudeClient } from '@/lib/llm/claude-client'

export interface ReplyAgentMCPConfig {
  maxTokens?: number
  temperature?: number
  organizationId: string
  userId: string
}

export interface ConversationContext {
  messages: Array<{
    role: 'user' | 'assistant' | 'system'
    content: string
    timestamp: string
    platform?: string
    metadata?: Record<string, any>
  }>
  prospect_profile?: {
    name: string
    title: string
    company: string
    industry: string
    pain_points?: string[]
    interests?: string[]
  }
  conversation_stage: 'cold_outreach' | 'nurturing' | 'qualification' | 'demo_followup' | 'negotiation' | 'closing'
  sales_methodology: 'challenger' | 'spin' | 'meddic' | 'value_selling'
  tone: 'professional' | 'casual' | 'consultative' | 'urgent'
  objective: string
}

export interface ReplyOptions {
  response_types: Array<'question' | 'value_prop' | 'case_study' | 'next_step' | 'objection_handle'>
  include_personalization: boolean
  include_call_to_action: boolean
  max_length: number
  urgency_level: 'low' | 'medium' | 'high'
  compliance_check: boolean
}

export interface GeneratedReply {
  primary_response: string
  alternative_responses: string[]
  personalization_elements: string[]
  call_to_action?: string
  follow_up_questions: string[]
  confidence_score: number
  compliance_status: 'approved' | 'needs_review' | 'rejected'
  suggested_timing: string
  channel_optimizations: Record<string, string>
}

export class ReplyAgentMCPServer {
  private config: ReplyAgentMCPConfig

  constructor(config: ReplyAgentMCPConfig) {
    this.config = config
  }

  async listTools(): Promise<{ tools: MCPTool[] }> {
    return {
      tools: [
        {
          name: 'reply_agent_generate_response',
          description: 'Generate intelligent responses for sales conversations',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_context: {
                type: 'object',
                description: 'Full conversation context and prospect information',
                properties: {
                  messages: {
                    type: 'array',
                    items: {
                      type: 'object',
                      properties: {
                        role: { type: 'string', enum: ['user', 'assistant', 'system'] },
                        content: { type: 'string' },
                        timestamp: { type: 'string' },
                        platform: { type: 'string' }
                      },
                      required: ['role', 'content', 'timestamp']
                    }
                  },
                  conversation_stage: {
                    type: 'string',
                    enum: ['cold_outreach', 'nurturing', 'qualification', 'demo_followup', 'negotiation', 'closing']
                  },
                  sales_methodology: {
                    type: 'string',
                    enum: ['challenger', 'spin', 'meddic', 'value_selling']
                  },
                  tone: {
                    type: 'string', 
                    enum: ['professional', 'casual', 'consultative', 'urgent']
                  },
                  objective: { type: 'string' }
                },
                required: ['messages', 'conversation_stage', 'objective']
              },
              reply_options: {
                type: 'object',
                properties: {
                  response_types: {
                    type: 'array',
                    items: {
                      type: 'string',
                      enum: ['question', 'value_prop', 'case_study', 'next_step', 'objection_handle']
                    }
                  },
                  include_personalization: { type: 'boolean', default: true },
                  include_call_to_action: { type: 'boolean', default: true },
                  max_length: { type: 'integer', default: 150 },
                  urgency_level: { type: 'string', enum: ['low', 'medium', 'high'], default: 'medium' },
                  compliance_check: { type: 'boolean', default: true }
                }
              }
            },
            required: ['conversation_context']
          }
        },
        {
          name: 'reply_agent_analyze_sentiment',
          description: 'Analyze conversation sentiment and engagement signals',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_context: {
                type: 'object',
                description: 'Conversation messages to analyze'
              }
            },
            required: ['conversation_context']
          }
        },
        {
          name: 'reply_agent_suggest_next_steps',
          description: 'Suggest strategic next steps based on conversation analysis',
          inputSchema: {
            type: 'object',
            properties: {
              conversation_context: {
                type: 'object',
                description: 'Full conversation context'
              },
              current_objectives: {
                type: 'array',
                items: { type: 'string' },
                description: 'Current sales objectives'
              }
            },
            required: ['conversation_context']
          }
        },
        {
          name: 'reply_agent_handle_objection',
          description: 'Generate responses to handle specific objections',
          inputSchema: {
            type: 'object',
            properties: {
              objection_text: {
                type: 'string',
                description: 'The objection raised by the prospect'
              },
              objection_type: {
                type: 'string',
                enum: ['price', 'timing', 'authority', 'need', 'trust', 'competition'],
                description: 'Category of objection'
              },
              conversation_context: {
                type: 'object',
                description: 'Full conversation context for personalization'
              }
            },
            required: ['objection_text', 'objection_type']
          }
        },
        {
          name: 'reply_agent_generate_followup_sequence',
          description: 'Generate a sequence of follow-up messages for nurturing',
          inputSchema: {
            type: 'object',
            properties: {
              sequence_length: {
                type: 'integer',
                description: 'Number of follow-up messages to generate',
                default: 3
              },
              interval_days: {
                type: 'array',
                items: { type: 'integer' },
                description: 'Days between each follow-up',
                default: [3, 7, 14]
              },
              conversation_context: {
                type: 'object',
                description: 'Current conversation state'
              }
            },
            required: ['conversation_context']
          }
        },
        {
          name: 'reply_agent_optimize_for_platform',
          description: 'Optimize message for specific communication platform',
          inputSchema: {
            type: 'object',
            properties: {
              message: {
                type: 'string',
                description: 'Original message to optimize'
              },
              platform: {
                type: 'string',
                enum: ['linkedin', 'email', 'whatsapp', 'slack', 'twitter'],
                description: 'Target platform for optimization'
              },
              platform_constraints: {
                type: 'object',
                properties: {
                  character_limit: { type: 'integer' },
                  supports_formatting: { type: 'boolean' },
                  supports_links: { type: 'boolean' }
                }
              }
            },
            required: ['message', 'platform']
          }
        }
      ]
    }
  }

  async callTool(request: MCPCallToolRequest): Promise<MCPCallToolResult> {
    try {
      switch (request.params.name) {
        case 'reply_agent_generate_response':
          return await this.generateResponse(
            request.params.arguments?.conversation_context,
            request.params.arguments?.reply_options
          )
        
        case 'reply_agent_analyze_sentiment':
          return await this.analyzeSentiment(request.params.arguments?.conversation_context)
        
        case 'reply_agent_suggest_next_steps':
          return await this.suggestNextSteps(
            request.params.arguments?.conversation_context,
            request.params.arguments?.current_objectives
          )
        
        case 'reply_agent_handle_objection':
          return await this.handleObjection(
            request.params.arguments?.objection_text,
            request.params.arguments?.objection_type,
            request.params.arguments?.conversation_context
          )
        
        case 'reply_agent_generate_followup_sequence':
          return await this.generateFollowupSequence(
            request.params.arguments?.conversation_context,
            request.params.arguments?.sequence_length,
            request.params.arguments?.interval_days
          )
        
        case 'reply_agent_optimize_for_platform':
          return await this.optimizeForPlatform(
            request.params.arguments?.message,
            request.params.arguments?.platform,
            request.params.arguments?.platform_constraints
          )
        
        default:
          return {
            content: [{
              type: 'text',
              text: `Unknown Reply Agent tool: ${request.params.name}`
            }],
            isError: true
          }
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Reply Agent MCP error: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async generateResponse(
    conversationContext: ConversationContext,
    replyOptions: ReplyOptions = {
      response_types: ['question', 'value_prop'],
      include_personalization: true,
      include_call_to_action: true,
      max_length: 150,
      urgency_level: 'medium',
      compliance_check: true
    }
  ): Promise<MCPCallToolResult> {
    try {
      const prompt = this.buildResponsePrompt(conversationContext, replyOptions)
      const response = await this.callLLM(prompt)
      
      // Parse and structure the response
      const generatedReply: GeneratedReply = this.parseResponseFromLLM(response, replyOptions)

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(generatedReply, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to generate response: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private buildResponsePrompt(context: ConversationContext, options: ReplyOptions): string {
    return `
You are SAM AI, an expert B2B sales assistant. Generate an intelligent response based on this conversation context.

CONVERSATION CONTEXT:
Stage: ${context.conversation_stage}
Methodology: ${context.sales_methodology}
Tone: ${context.tone}
Objective: ${context.objective}

PROSPECT PROFILE:
${context.prospect_profile ? `
Name: ${context.prospect_profile.name}
Title: ${context.prospect_profile.title}
Company: ${context.prospect_profile.company}
Industry: ${context.prospect_profile.industry}
Pain Points: ${context.prospect_profile.pain_points?.join(', ') || 'Unknown'}
` : 'Limited prospect information available'}

RECENT MESSAGES:
${context.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

REPLY REQUIREMENTS:
- Response types: ${options.response_types.join(', ')}
- Max length: ${options.max_length} words
- Include personalization: ${options.include_personalization}
- Include CTA: ${options.include_call_to_action}
- Urgency: ${options.urgency_level}

Generate a response that:
1. Addresses the prospect's last message directly
2. Uses the specified sales methodology
3. Maintains the appropriate tone
4. Advances toward the objective
5. Includes relevant personalization

Return a JSON response with:
- primary_response: The main suggested reply
- alternative_responses: 2-3 alternative versions
- personalization_elements: Key personalization used
- call_to_action: Specific CTA if requested
- follow_up_questions: Suggested follow-up questions
- confidence_score: Your confidence in this response (0-1)
- compliance_status: 'approved' if compliant with professional standards
- suggested_timing: Best time to send this message
- channel_optimizations: Platform-specific versions
`
  }

  private async callLLM(prompt: string): Promise<any> {
    try {
      const response = await claudeClient.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: this.config.maxTokens || 1500,
        temperature: this.config.temperature || 0.7
      })

      const content = response.content || ''

      // Parse JSON response from Claude
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      if (jsonMatch) {
        return JSON.parse(jsonMatch[0])
      }

      // Fallback: return structured response from raw text
      return {
        primary_response: content,
        alternative_responses: [],
        personalization_elements: [],
        call_to_action: '',
        follow_up_questions: [],
        confidence_score: 0.7,
        compliance_status: 'approved',
        suggested_timing: 'Within business hours',
        channel_optimizations: {}
      }
    } catch (error) {
      console.error('Claude API error in Reply Agent MCP:', error)
      throw error
    }
  }

  private parseResponseFromLLM(response: any, options: ReplyOptions): GeneratedReply {
    // Apply compliance check if requested
    if (options.compliance_check) {
      response.compliance_status = this.checkCompliance(response.primary_response)
    }

    return response as GeneratedReply
  }

  private checkCompliance(message: string): 'approved' | 'needs_review' | 'rejected' {
    // Simple compliance checks
    const flaggedTerms = ['guarantee', 'promise', 'definitely', 'always works', 'risk-free']
    const hasFlags = flaggedTerms.some(term => message.toLowerCase().includes(term))
    
    return hasFlags ? 'needs_review' : 'approved'
  }

  private async analyzeSentiment(context: ConversationContext): Promise<MCPCallToolResult> {
    try {
      const prompt = `Analyze this B2B sales conversation for sentiment and engagement signals.

CONVERSATION:
${context.messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

PROSPECT PROFILE:
${context.prospect_profile ? `
Name: ${context.prospect_profile.name}
Title: ${context.prospect_profile.title}
Company: ${context.prospect_profile.company}
Industry: ${context.prospect_profile.industry}
` : 'Limited prospect information'}

Analyze and return a JSON object with:
- overall_sentiment: "positive", "neutral", or "negative"
- sentiment_score: 0-1 score
- engagement_indicators: { responsiveness, question_asking, detail_sharing, objection_level } (each: "low", "medium", "high")
- buying_signals: Array of detected buying signals
- conversation_momentum: "accelerating", "steady", "stalling", or "declining"
- next_best_action: Recommended next action
- confidence_assessment: { interest_level, decision_authority, timeline_urgency } (each: "low", "medium", "high")

Return ONLY valid JSON.`

      const response = await claudeClient.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.3
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const analysis = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' }

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

  private async suggestNextSteps(context: ConversationContext, objectives?: string[]): Promise<MCPCallToolResult> {
    try {
      const prompt = `Analyze this B2B sales conversation and suggest strategic next steps.

CONVERSATION:
${context.messages.slice(-10).map(m => `${m.role}: ${m.content}`).join('\n')}

CURRENT STAGE: ${context.conversation_stage}
SALES METHODOLOGY: ${context.sales_methodology || 'value_selling'}
OBJECTIVE: ${context.objective}
${objectives ? `ADDITIONAL OBJECTIVES: ${objectives.join(', ')}` : ''}

PROSPECT PROFILE:
${context.prospect_profile ? `
Name: ${context.prospect_profile.name}
Title: ${context.prospect_profile.title}
Company: ${context.prospect_profile.company}
Industry: ${context.prospect_profile.industry}
Pain Points: ${context.prospect_profile.pain_points?.join(', ') || 'Unknown'}
` : 'Limited prospect information'}

Suggest strategic next steps as JSON:
{
  "immediate_actions": [{ "action": "...", "priority": "high/medium/low", "timing": "...", "rationale": "..." }],
  "medium_term_actions": [{ "action": "...", "priority": "...", "timing": "...", "rationale": "..." }],
  "conversation_strategy": {
    "current_stage": "${context.conversation_stage}",
    "recommended_next_stage": "...",
    "key_questions_to_ask": ["..."],
    "potential_obstacles": ["..."],
    "success_probability": 0.0-1.0
  }
}

Return ONLY valid JSON.`

      const response = await claudeClient.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1200,
        temperature: 0.5
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const nextSteps = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(nextSteps, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to suggest next steps: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async handleObjection(objectionText: string, objectionType: string, context?: ConversationContext): Promise<MCPCallToolResult> {
    try {
      const prompt = `You are an expert B2B sales coach. Generate responses to handle this objection.

OBJECTION: "${objectionText}"
OBJECTION TYPE: ${objectionType}

${context ? `
CONVERSATION CONTEXT:
Stage: ${context.conversation_stage}
Prospect: ${context.prospect_profile?.name || 'Unknown'} at ${context.prospect_profile?.company || 'Unknown company'}
Industry: ${context.prospect_profile?.industry || 'Unknown'}
Recent messages: ${context.messages.slice(-3).map(m => `${m.role}: ${m.content}`).join('\n')}
` : ''}

Generate objection handling responses as JSON:
{
  "objection_analysis": {
    "type": "${objectionType}",
    "severity": "low/medium/high",
    "underlying_concern": "What they're really worried about",
    "response_strategy": "acknowledge_and_reframe/provide_evidence/ask_questions"
  },
  "suggested_responses": [
    { "approach": "acknowledge_and_understand", "response": "..." },
    { "approach": "provide_evidence", "response": "..." },
    { "approach": "reframe_value", "response": "..." }
  ],
  "follow_up_actions": ["..."],
  "success_probability": 0.0-1.0
}

Make responses specific, empathetic, and consultative. Return ONLY valid JSON.`

      const response = await claudeClient.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.6
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const objectionResponse = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(objectionResponse, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to handle objection: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async generateFollowupSequence(
    context: ConversationContext,
    sequenceLength: number = 3,
    intervalDays: number[] = [3, 7, 14]
  ): Promise<MCPCallToolResult> {
    try {
      const prompt = `Generate a personalized follow-up sequence for a B2B sales conversation.

CONVERSATION CONTEXT:
Stage: ${context.conversation_stage}
Objective: ${context.objective}
Tone: ${context.tone || 'professional'}

PROSPECT PROFILE:
${context.prospect_profile ? `
Name: ${context.prospect_profile.name}
Title: ${context.prospect_profile.title}
Company: ${context.prospect_profile.company}
Industry: ${context.prospect_profile.industry}
Pain Points: ${context.prospect_profile.pain_points?.join(', ') || 'Unknown'}
` : 'Limited prospect information'}

RECENT MESSAGES:
${context.messages.slice(-5).map(m => `${m.role}: ${m.content}`).join('\n')}

SEQUENCE REQUIREMENTS:
- Number of follow-ups: ${sequenceLength}
- Intervals (days): ${intervalDays.slice(0, sequenceLength).join(', ')}

Generate a follow-up sequence as JSON:
{
  "sequence_id": "followup-${Date.now()}",
  "total_messages": ${sequenceLength},
  "interval_days": ${JSON.stringify(intervalDays.slice(0, sequenceLength))},
  "messages": [
    {
      "sequence_number": 1,
      "send_after_days": ${intervalDays[0] || 3},
      "subject": "Subject line",
      "message": "Full follow-up message",
      "call_to_action": "Specific CTA",
      "personalization_notes": ["..."]
    }
  ],
  "sequence_strategy": {
    "approach": "value_first_nurturing/urgency_based/social_proof",
    "escalation_path": "Description of how urgency increases",
    "exit_criteria": "When to stop following up"
  }
}

Make each message unique, value-adding, and personalized. Return ONLY valid JSON.`

      const response = await claudeClient.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 2000,
        temperature: 0.7
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const followupSequence = jsonMatch ? JSON.parse(jsonMatch[0]) : { error: 'Failed to parse response' }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(followupSequence, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to generate followup sequence: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }

  private async optimizeForPlatform(
    message: string,
    platform: string,
    constraints?: any
  ): Promise<MCPCallToolResult> {
    try {
      const platformConstraints: Record<string, { charLimit: number; tone: string; features: string[] }> = {
        linkedin: { charLimit: 3000, tone: 'professional', features: ['hashtags', 'line breaks', 'connection references'] },
        email: { charLimit: 5000, tone: 'professional', features: ['subject line', 'signature', 'html formatting'] },
        whatsapp: { charLimit: 4096, tone: 'casual', features: ['emojis', 'short paragraphs', 'voice note option'] },
        slack: { charLimit: 4000, tone: 'casual', features: ['mentions', 'threading', 'reactions'] },
        twitter: { charLimit: 280, tone: 'concise', features: ['hashtags', 'mentions', 'thread'] }
      }

      const platformConfig = platformConstraints[platform] || { charLimit: 1000, tone: 'neutral', features: [] }

      const prompt = `Optimize this message for ${platform}.

ORIGINAL MESSAGE:
${message}

PLATFORM: ${platform}
CHARACTER LIMIT: ${constraints?.character_limit || platformConfig.charLimit}
TONE: ${platformConfig.tone}
PLATFORM FEATURES: ${platformConfig.features.join(', ')}

${constraints ? `ADDITIONAL CONSTRAINTS: ${JSON.stringify(constraints)}` : ''}

Return optimized message as JSON:
{
  "original_message": "${message.substring(0, 100)}...",
  "platform": "${platform}",
  "optimized_message": "The fully optimized message for ${platform}",
  "optimization_notes": ["What was changed and why"],
  "character_count": number,
  "platform_specific_features": ["Features used"]
}

Return ONLY valid JSON.`

      const response = await claudeClient.chat({
        messages: [{ role: 'user', content: prompt }],
        max_tokens: 1000,
        temperature: 0.5
      })

      const content = response.content || ''
      const jsonMatch = content.match(/\{[\s\S]*\}/)
      const optimizedMessage = jsonMatch ? JSON.parse(jsonMatch[0]) : {
        original_message: message,
        platform,
        optimized_message: message,
        optimization_notes: ['Failed to optimize'],
        character_count: message.length,
        platform_specific_features: []
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(optimizedMessage, null, 2)
        }]
      }
    } catch (error) {
      return {
        content: [{
          type: 'text',
          text: `Failed to optimize for platform: ${error instanceof Error ? error.message : 'Unknown error'}`
        }],
        isError: true
      }
    }
  }
}