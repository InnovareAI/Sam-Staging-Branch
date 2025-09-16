/**
 * Enhanced Campaign Reply Detector
 * Intelligently identifies replies to campaign messages using multiple detection methods
 * Supports multiple campaigns per funnel with A/B testing and multi-ICP targeting
 */

import { supabaseAdmin } from '@/app/lib/supabase'

export interface CampaignReplyDetectionResult {
  is_campaign_reply: boolean
  campaign_id?: string
  campaign_name?: string
  campaign_message_id?: string
  confidence_score: number // 0.0 to 1.0
  detection_method: 'conversation_id' | 'thread_id' | 'prospect_matching' | 'time_window' | 'content_analysis'
  reply_priority: 'high' | 'medium' | 'low'
  reply_sentiment?: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested'
  requires_action: boolean
}

export interface UnipileMessage {
  id: string
  text?: string
  content?: string
  timestamp: string
  direction?: 'inbound' | 'outbound'
  chat_info?: {
    id?: string
    name?: string
    participants?: any[]
  }
  conversation_id?: string
  thread_id?: string
  sender_name?: string
  from?: string
  to?: string
  subject?: string
  platform?: string
}

export class EnhancedCampaignReplyDetector {
  private static readonly CONFIDENCE_THRESHOLDS = {
    HIGH: 0.85,
    MEDIUM: 0.65,
    LOW: 0.45
  }

  private static readonly TIME_WINDOW_DAYS = 30 // Look for campaign messages within 30 days

  /**
   * Main entry point - determines if a message is a reply to a campaign
   */
  static async isCampaignReply(
    message: UnipileMessage,
    workspace_id: string
  ): Promise<CampaignReplyDetectionResult> {
    // Skip outbound messages - we only want replies
    if (message.direction === 'outbound') {
      return {
        is_campaign_reply: false,
        confidence_score: 0,
        detection_method: 'conversation_id',
        reply_priority: 'low',
        requires_action: false
      }
    }

    const detectionMethods = [
      () => this.detectByConversationId(message, workspace_id),
      () => this.detectByThreadId(message, workspace_id),
      () => this.detectByProspectMatching(message, workspace_id),
      () => this.detectByTimeWindow(message, workspace_id),
    ]

    // Try each detection method, return the highest confidence result
    let bestResult: CampaignReplyDetectionResult = {
      is_campaign_reply: false,
      confidence_score: 0,
      detection_method: 'conversation_id',
      reply_priority: 'low',
      requires_action: false
    }

    for (const detect of detectionMethods) {
      try {
        const result = await detect()
        if (result && result.confidence_score > bestResult.confidence_score) {
          bestResult = result
        }
      } catch (error) {
        console.warn('Campaign reply detection method failed:', error)
      }
    }

    // Enhance the result with content analysis
    if (bestResult.is_campaign_reply) {
      bestResult = await this.enhanceWithContentAnalysis(message, bestResult)
    }

    return bestResult
  }

  /**
   * Method 1: Match by Unipile conversation_id (highest confidence)
   */
  private static async detectByConversationId(
    message: UnipileMessage,
    workspace_id: string
  ): Promise<CampaignReplyDetectionResult | null> {
    if (!message.conversation_id) return null

    const supabase = supabaseAdmin()

    const { data: campaignMessage, error } = await supabase
      .from('campaign_messages')
      .select(`
        id,
        campaign_id,
        campaigns(id, name),
        sent_at
      `)
      .eq('workspace_id', workspace_id)
      .eq('conversation_id', message.conversation_id)
      .eq('platform', this.getPlatformFromMessage(message))
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !campaignMessage) return null

    return {
      is_campaign_reply: true,
      campaign_id: campaignMessage.campaign_id,
      campaign_name: campaignMessage.campaigns?.name,
      campaign_message_id: campaignMessage.id,
      confidence_score: 0.95, // Very high confidence for conversation_id match
      detection_method: 'conversation_id',
      reply_priority: 'high',
      requires_action: true
    }
  }

  /**
   * Method 2: Match by thread_id (high confidence)
   */
  private static async detectByThreadId(
    message: UnipileMessage,
    workspace_id: string
  ): Promise<CampaignReplyDetectionResult | null> {
    if (!message.thread_id) return null

    const supabase = supabaseAdmin()

    const { data: campaignMessage, error } = await supabase
      .from('campaign_messages')
      .select(`
        id,
        campaign_id,
        campaigns(id, name),
        sent_at
      `)
      .eq('workspace_id', workspace_id)
      .eq('thread_id', message.thread_id)
      .eq('platform', this.getPlatformFromMessage(message))
      .order('sent_at', { ascending: false })
      .limit(1)
      .single()

    if (error || !campaignMessage) return null

    return {
      is_campaign_reply: true,
      campaign_id: campaignMessage.campaign_id,
      campaign_name: campaignMessage.campaigns?.name,
      campaign_message_id: campaignMessage.id,
      confidence_score: 0.85, // High confidence for thread_id match
      detection_method: 'thread_id',
      reply_priority: 'high',
      requires_action: true
    }
  }

  /**
   * Method 3: Match by prospect information (medium confidence)
   */
  private static async detectByProspectMatching(
    message: UnipileMessage,
    workspace_id: string
  ): Promise<CampaignReplyDetectionResult | null> {
    const senderEmail = this.extractSenderEmail(message)
    const senderLinkedIn = this.extractSenderLinkedIn(message)

    if (!senderEmail && !senderLinkedIn) return null

    const supabase = supabaseAdmin()

    let query = supabase
      .from('campaign_messages')
      .select(`
        id,
        campaign_id,
        campaigns(id, name),
        sent_at,
        recipient_email,
        recipient_linkedin_profile
      `)
      .eq('workspace_id', workspace_id)
      .eq('platform', this.getPlatformFromMessage(message))
      .gte('sent_at', new Date(Date.now() - this.TIME_WINDOW_DAYS * 24 * 60 * 60 * 1000).toISOString())
      .order('sent_at', { ascending: false })

    // Add email or LinkedIn profile filters
    if (senderEmail) {
      query = query.eq('recipient_email', senderEmail)
    } else if (senderLinkedIn) {
      query = query.eq('recipient_linkedin_profile', senderLinkedIn)
    }

    const { data: campaignMessages, error } = await query.limit(5)

    if (error || !campaignMessages || campaignMessages.length === 0) return null

    // Use the most recent campaign message
    const recentMessage = campaignMessages[0]

    return {
      is_campaign_reply: true,
      campaign_id: recentMessage.campaign_id,
      campaign_name: recentMessage.campaigns?.name,
      campaign_message_id: recentMessage.id,
      confidence_score: 0.75, // Medium-high confidence for prospect matching
      detection_method: 'prospect_matching',
      reply_priority: 'medium',
      requires_action: true
    }
  }

  /**
   * Method 4: Match by time window and platform (lower confidence)
   */
  private static async detectByTimeWindow(
    message: UnipileMessage,
    workspace_id: string
  ): Promise<CampaignReplyDetectionResult | null> {
    const messageTime = new Date(message.timestamp)
    const timeWindowStart = new Date(messageTime.getTime() - 24 * 60 * 60 * 1000) // 24 hours before

    const supabase = supabaseAdmin()

    const { data: recentCampaigns, error } = await supabase
      .from('campaign_messages')
      .select(`
        id,
        campaign_id,
        campaigns(id, name),
        sent_at
      `)
      .eq('workspace_id', workspace_id)
      .eq('platform', this.getPlatformFromMessage(message))
      .gte('sent_at', timeWindowStart.toISOString())
      .lt('sent_at', messageTime.toISOString())
      .order('sent_at', { ascending: false })
      .limit(10)

    if (error || !recentCampaigns || recentCampaigns.length === 0) return null

    // Use the most recent campaign message as a guess
    const recentMessage = recentCampaigns[0]

    return {
      is_campaign_reply: true,
      campaign_id: recentMessage.campaign_id,
      campaign_name: recentMessage.campaigns?.name,
      campaign_message_id: recentMessage.id,
      confidence_score: 0.55, // Lower confidence for time window matching
      detection_method: 'time_window',
      reply_priority: 'low',
      requires_action: true
    }
  }

  /**
   * Enhance results with content analysis for sentiment and priority
   */
  private static async enhanceWithContentAnalysis(
    message: UnipileMessage,
    result: CampaignReplyDetectionResult
  ): Promise<CampaignReplyDetectionResult> {
    const content = message.text || message.content || ''
    
    // Simple sentiment analysis keywords
    const positiveKeywords = [
      'interested', 'yes', 'sounds good', 'tell me more', 'when can we', 
      'schedule', 'call', 'meeting', 'demo', 'perfect', 'great', 'excellent'
    ]
    
    const negativeKeywords = [
      'not interested', 'no thanks', 'remove me', 'unsubscribe', 'stop', 
      'not looking', 'already have', 'busy', 'not now'
    ]

    const interestedKeywords = [
      'pricing', 'cost', 'how much', 'budget', 'proposal', 'quote',
      'more information', 'details', 'features', 'capabilities'
    ]

    const contentLower = content.toLowerCase()
    
    // Determine sentiment
    let sentiment: 'positive' | 'neutral' | 'negative' | 'interested' | 'not_interested' = 'neutral'
    
    if (positiveKeywords.some(keyword => contentLower.includes(keyword))) {
      sentiment = 'positive'
    } else if (interestedKeywords.some(keyword => contentLower.includes(keyword))) {
      sentiment = 'interested'
    } else if (negativeKeywords.some(keyword => contentLower.includes(keyword))) {
      sentiment = 'not_interested'
    }

    // Adjust priority based on sentiment
    let reply_priority = result.reply_priority
    if (sentiment === 'interested' || sentiment === 'positive') {
      reply_priority = 'high'
    } else if (sentiment === 'not_interested') {
      reply_priority = 'low'
    }

    // Determine if action is required
    const requires_action = sentiment !== 'not_interested'

    return {
      ...result,
      reply_sentiment: sentiment,
      reply_priority,
      requires_action
    }
  }

  /**
   * Extract platform from message
   */
  private static getPlatformFromMessage(message: UnipileMessage): string {
    if (message.platform) return message.platform
    
    // Try to infer from message structure
    if (message.subject) return 'email'
    if (message.chat_info) return 'linkedin'
    
    return 'unknown'
  }

  /**
   * Extract sender email from message
   */
  private static extractSenderEmail(message: UnipileMessage): string | null {
    if (message.from && message.from.includes('@')) {
      return message.from
    }
    return null
  }

  /**
   * Extract sender LinkedIn profile from message
   */
  private static extractSenderLinkedIn(message: UnipileMessage): string | null {
    // This would need to be implemented based on Unipile's LinkedIn message structure
    // For now, return null as we need to examine actual message data
    return null
  }

  /**
   * Batch process multiple messages for campaign reply detection
   */
  static async batchDetectCampaignReplies(
    messages: UnipileMessage[],
    workspace_id: string
  ): Promise<Map<string, CampaignReplyDetectionResult>> {
    const results = new Map<string, CampaignReplyDetectionResult>()

    // Process in parallel for better performance
    const detectionPromises = messages.map(async (message) => {
      const result = await this.isCampaignReply(message, workspace_id)
      return { messageId: message.id, result }
    })

    const detectionResults = await Promise.allSettled(detectionPromises)

    detectionResults.forEach((promiseResult, index) => {
      if (promiseResult.status === 'fulfilled') {
        const { messageId, result } = promiseResult.value
        results.set(messageId, result)
      } else {
        console.warn(`Campaign reply detection failed for message ${messages[index].id}:`, promiseResult.reason)
        // Set default non-campaign result for failed detections
        results.set(messages[index].id, {
          is_campaign_reply: false,
          confidence_score: 0,
          detection_method: 'conversation_id',
          reply_priority: 'low',
          requires_action: false
        })
      }
    })

    return results
  }

  /**
   * Track a new campaign reply in the database
   */
  static async trackCampaignReply(
    message: UnipileMessage,
    detectionResult: CampaignReplyDetectionResult,
    workspace_id: string
  ): Promise<string | null> {
    if (!detectionResult.is_campaign_reply || !detectionResult.campaign_message_id) {
      return null
    }

    const supabase = supabaseAdmin()

    const { data, error } = await supabase.rpc('track_campaign_reply', {
      p_platform: this.getPlatformFromMessage(message),
      p_platform_reply_id: message.id,
      p_conversation_id: message.conversation_id || `fallback_${message.id}`,
      p_thread_id: message.thread_id,
      p_reply_content: message.text || message.content || '',
      p_sender_email: this.extractSenderEmail(message),
      p_sender_linkedin_profile: this.extractSenderLinkedIn(message),
      p_sender_name: message.sender_name || message.from || 'Unknown',
      p_received_at: new Date(message.timestamp).toISOString()
    })

    if (error) {
      console.error('Failed to track campaign reply:', error)
      return null
    }

    // Update the reply with our enhanced analysis
    if (data) {
      await supabase
        .from('campaign_replies')
        .update({
          reply_sentiment: detectionResult.reply_sentiment,
          reply_priority: detectionResult.reply_priority,
          requires_action: detectionResult.requires_action
        })
        .eq('id', data)
    }

    return data
  }

  /**
   * Get campaign reply statistics for a workspace
   */
  static async getCampaignReplyStats(workspace_id: string): Promise<{
    total_replies: number
    unprocessed_replies: number
    high_priority_replies: number
    positive_sentiment_replies: number
    avg_response_time_hours: number
  }> {
    const supabase = supabaseAdmin()

    const { data, error } = await supabase
      .from('campaign_replies')
      .select('reply_priority, reply_sentiment, is_processed, response_time_hours')
      .eq('workspace_id', workspace_id)

    if (error || !data) {
      return {
        total_replies: 0,
        unprocessed_replies: 0,
        high_priority_replies: 0,
        positive_sentiment_replies: 0,
        avg_response_time_hours: 0
      }
    }

    const total_replies = data.length
    const unprocessed_replies = data.filter(r => !r.is_processed).length
    const high_priority_replies = data.filter(r => r.reply_priority === 'high').length
    const positive_sentiment_replies = data.filter(r => 
      r.reply_sentiment === 'positive' || r.reply_sentiment === 'interested'
    ).length
    
    const validResponseTimes = data
      .map(r => r.response_time_hours)
      .filter(t => t !== null && t !== undefined) as number[]
    
    const avg_response_time_hours = validResponseTimes.length > 0
      ? validResponseTimes.reduce((sum, time) => sum + time, 0) / validResponseTimes.length
      : 0

    return {
      total_replies,
      unprocessed_replies,
      high_priority_replies,
      positive_sentiment_replies,
      avg_response_time_hours: Math.round(avg_response_time_hours * 100) / 100
    }
  }
}