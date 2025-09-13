// SAM AI Knowledge Classification Service
// Classifies conversation content into personal vs team-shareable knowledge

import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

export interface KnowledgeClassification {
  personal_data: Record<string, any>;
  team_shareable: Record<string, any>;
  classification_confidence: number;
  patterns_matched: string[];
}

export interface ExtractedKnowledge {
  id: string;
  conversation_id: string;
  user_id: string;
  organization_id?: string;
  knowledge_type: 'personal' | 'team_shareable';
  category: string;
  subcategory?: string;
  content: Record<string, any>;
  confidence_score: number;
  sharing_scope: 'user' | 'team' | 'organization' | 'cross_tenant';
  data_sensitivity: 'low' | 'medium' | 'high' | 'critical';
  is_active: boolean;
  created_at: string;
}

export interface UserPrivacyPreferences {
  user_id: string;
  communication_style_sharing: 'user' | 'team' | 'organization';
  professional_context_sharing: 'user' | 'team' | 'organization';
  customer_intelligence_sharing: 'user' | 'team' | 'organization';
  market_insights_sharing: 'user' | 'team' | 'organization';
  auto_knowledge_extraction: boolean;
  require_extraction_confirmation: boolean;
  data_retention_days: number;
}

export class KnowledgeClassifier {
  
  // Classify conversation content using pattern matching and ML
  async classifyConversation(
    conversationText: string,
    userContext: Record<string, any> = {}
  ): Promise<KnowledgeClassification> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('classify_conversation_content', {
          conversation_text: conversationText,
          user_context: userContext
        });

      if (error) {
        console.error('Error classifying conversation:', error);
        return this.getFallbackClassification(conversationText);
      }

      return data as KnowledgeClassification;
    } catch (error) {
      console.error('Classification error:', error);
      return this.getFallbackClassification(conversationText);
    }
  }

  // Enhanced classification with additional ML patterns
  async enhancedClassification(
    message: string,
    response: string,
    metadata: Record<string, any> = {}
  ): Promise<KnowledgeClassification> {
    const fullText = `${message} ${response}`;
    const baseClassification = await this.classifyConversation(fullText, metadata);
    
    // Add advanced pattern matching
    const enhancedClassification = this.applyAdvancedPatterns(
      fullText,
      baseClassification,
      metadata
    );
    
    return enhancedClassification;
  }

  // Apply advanced pattern matching logic
  private applyAdvancedPatterns(
    text: string,
    baseClassification: KnowledgeClassification,
    metadata: Record<string, any>
  ): KnowledgeClassification {
    const lowerText = text.toLowerCase();
    const enhanced = { ...baseClassification };
    
    // Personal communication style detection
    const communicationStyle = this.detectCommunicationStyle(lowerText);
    if (communicationStyle.confidence > 0.5) {
      enhanced.personal_data.communication_style = {
        ...enhanced.personal_data.communication_style,
        ...communicationStyle
      };
    }

    // Professional context extraction
    const professionalContext = this.extractProfessionalContext(lowerText);
    if (professionalContext.confidence > 0.6) {
      enhanced.personal_data.professional_context = {
        ...enhanced.personal_data.professional_context,
        ...professionalContext
      };
    }

    // Customer intelligence detection
    const customerIntelligence = this.extractCustomerIntelligence(lowerText);
    if (customerIntelligence.confidence > 0.5) {
      enhanced.team_shareable.customer_intelligence = {
        ...enhanced.team_shareable.customer_intelligence,
        ...customerIntelligence
      };
    }

    // Market insights detection
    const marketInsights = this.extractMarketInsights(lowerText);
    if (marketInsights.confidence > 0.5) {
      enhanced.team_shareable.market_insights = {
        ...enhanced.team_shareable.market_insights,
        ...marketInsights
      };
    }

    // Competitive intelligence
    const competitiveIntel = this.extractCompetitiveIntelligence(lowerText);
    if (competitiveIntel.confidence > 0.6) {
      enhanced.team_shareable.competitive_intelligence = {
        ...enhanced.team_shareable.competitive_intelligence,
        ...competitiveIntel
      };
    }

    // Update overall confidence
    const personalKeys = Object.keys(enhanced.personal_data).length;
    const teamKeys = Object.keys(enhanced.team_shareable).length;
    enhanced.classification_confidence = Math.min(
      0.95,
      baseClassification.classification_confidence + ((personalKeys + teamKeys) * 0.05)
    );

    return enhanced;
  }

  // Detect communication style patterns
  private detectCommunicationStyle(text: string): any {
    const patterns = {
      formal: {
        keywords: ['please', 'thank you', 'appreciate', 'kindly', 'respectfully', 'sincerely'],
        phrases: ['i would appreciate', 'could you please', 'thank you for', 'i am writing to'],
        weight: 0
      },
      casual: {
        keywords: ['hey', 'cool', 'awesome', 'sounds good', 'no worries', 'thanks'],
        phrases: ['sounds good', 'no worries', 'hey there', 'cool, thanks'],
        weight: 0
      },
      direct: {
        keywords: ['need', 'want', 'require', 'must', 'should', 'will'],
        phrases: ['i need', 'we want', 'this must', 'you should', 'let me know'],
        weight: 0
      },
      consultative: {
        keywords: ['suggest', 'recommend', 'consider', 'explore', 'evaluate', 'assess'],
        phrases: ['i suggest', 'you might consider', 'let\'s explore', 'what do you think'],
        weight: 0
      }
    };

    // Calculate weights for each style
    Object.keys(patterns).forEach(style => {
      const pattern = patterns[style as keyof typeof patterns];
      
      // Check keywords
      pattern.keywords.forEach(keyword => {
        if (text.includes(keyword)) {
          pattern.weight += 1;
        }
      });
      
      // Check phrases (weighted higher)
      pattern.phrases.forEach(phrase => {
        if (text.includes(phrase)) {
          pattern.weight += 2;
        }
      });
    });

    // Find dominant style
    const dominantStyle = Object.keys(patterns).reduce((a, b) =>
      patterns[a as keyof typeof patterns].weight > patterns[b as keyof typeof patterns].weight ? a : b
    );

    const maxWeight = patterns[dominantStyle as keyof typeof patterns].weight;
    const confidence = Math.min(0.9, maxWeight * 0.1);

    if (confidence < 0.3) {
      return { confidence: 0 };
    }

    return {
      tone: dominantStyle,
      confidence,
      indicators: patterns[dominantStyle as keyof typeof patterns].weight,
      detected_at: new Date().toISOString()
    };
  }

  // Extract professional context
  private extractProfessionalContext(text: string): any {
    const rolePatterns = {
      sales: ['sales', 'quota', 'pipeline', 'deals', 'prospects', 'leads', 'close', 'revenue'],
      marketing: ['marketing', 'campaigns', 'brand', 'content', 'demand gen', 'mql', 'attribution'],
      executive: ['ceo', 'cto', 'vp', 'director', 'head of', 'chief', 'founder', 'president'],
      operations: ['operations', 'process', 'efficiency', 'workflow', 'automation', 'systems']
    };

    const experienceIndicators = [
      'years of experience', 'worked at', 'previously at', 'background in', 
      'experience with', 'familiar with', 'used to work'
    ];

    let detectedRole = '';
    let maxMatches = 0;
    let experienceLevel = '';

    // Detect role
    Object.entries(rolePatterns).forEach(([role, keywords]) => {
      const matches = keywords.filter(keyword => text.includes(keyword)).length;
      if (matches > maxMatches) {
        maxMatches = matches;
        detectedRole = role;
      }
    });

    // Detect experience level
    experienceIndicators.forEach(indicator => {
      if (text.includes(indicator)) {
        // Simple heuristic for experience extraction
        const match = text.match(new RegExp(`(\\d+)\\+?\\s*years?\\s*${indicator}`, 'i'));
        if (match) {
          const years = parseInt(match[1]);
          if (years >= 10) experienceLevel = 'senior';
          else if (years >= 5) experienceLevel = 'mid';
          else experienceLevel = 'junior';
        }
      }
    });

    const confidence = maxMatches > 0 ? Math.min(0.9, maxMatches * 0.15) : 0;

    if (confidence < 0.3) {
      return { confidence: 0 };
    }

    return {
      role: detectedRole,
      experience_level: experienceLevel,
      confidence,
      role_indicators: maxMatches,
      detected_at: new Date().toISOString()
    };
  }

  // Extract customer intelligence
  private extractCustomerIntelligence(text: string): any {
    const painPointKeywords = [
      'problem', 'challenge', 'struggle', 'difficult', 'issue', 'pain point',
      'bottleneck', 'obstacle', 'frustration', 'concern', 'worry'
    ];

    const buyingTriggers = [
      'growth', 'scaling', 'expansion', 'funding', 'budget approved',
      'new team', 'hiring', 'deadline', 'compliance', 'audit'
    ];

    const successMetrics = [
      'increase', 'improve', 'reduce', 'save', 'roi', 'efficiency',
      'conversion', 'performance', 'productivity', 'revenue'
    ];

    const painPoints: string[] = [];
    const triggers: string[] = [];
    const metrics: string[] = [];

    // Extract pain points
    painPointKeywords.forEach(keyword => {
      if (text.includes(keyword)) {
        // Try to extract the full context around the keyword
        const regex = new RegExp(`([^.!?]*${keyword}[^.!?]*)`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          painPoints.push(...matches.map(m => m.trim()));
        }
      }
    });

    // Extract buying triggers
    buyingTriggers.forEach(trigger => {
      if (text.includes(trigger)) {
        triggers.push(trigger);
      }
    });

    // Extract success metrics
    successMetrics.forEach(metric => {
      if (text.includes(metric)) {
        metrics.push(metric);
      }
    });

    const totalIndicators = painPoints.length + triggers.length + metrics.length;
    const confidence = totalIndicators > 0 ? Math.min(0.9, totalIndicators * 0.2) : 0;

    if (confidence < 0.3) {
      return { confidence: 0 };
    }

    return {
      pain_points: painPoints.slice(0, 5), // Limit to top 5
      buying_triggers: triggers,
      success_metrics: metrics,
      confidence,
      total_indicators: totalIndicators,
      detected_at: new Date().toISOString()
    };
  }

  // Extract market insights
  private extractMarketInsights(text: string): any {
    const industryKeywords = [
      'saas', 'software', 'technology', 'healthcare', 'finance', 'fintech',
      'manufacturing', 'retail', 'e-commerce', 'education', 'real estate',
      'consulting', 'agency', 'startup', 'enterprise'
    ];

    const marketConditions = [
      'market trends', 'industry standards', 'competitive landscape',
      'market share', 'growth rate', 'market size', 'regulation', 'compliance'
    ];

    const companySize = [
      'startup', 'small business', 'mid-market', 'enterprise', 'fortune',
      '1-10 employees', '10-50 employees', '50-200 employees', '200+ employees'
    ];

    const detectedIndustry: string[] = [];
    const detectedConditions: string[] = [];
    const detectedSize: string[] = [];

    industryKeywords.forEach(industry => {
      if (text.includes(industry)) {
        detectedIndustry.push(industry);
      }
    });

    marketConditions.forEach(condition => {
      if (text.includes(condition)) {
        detectedConditions.push(condition);
      }
    });

    companySize.forEach(size => {
      if (text.includes(size)) {
        detectedSize.push(size);
      }
    });

    const totalIndicators = detectedIndustry.length + detectedConditions.length + detectedSize.length;
    const confidence = totalIndicators > 0 ? Math.min(0.8, totalIndicators * 0.25) : 0;

    if (confidence < 0.3) {
      return { confidence: 0 };
    }

    return {
      industry: detectedIndustry,
      market_conditions: detectedConditions,
      company_size: detectedSize,
      confidence,
      total_indicators: totalIndicators,
      detected_at: new Date().toISOString()
    };
  }

  // Extract competitive intelligence
  private extractCompetitiveIntelligence(text: string): any {
    const competitorIndicators = [
      'competitor', 'competition', 'alternative', 'vs ', 'versus', 'compare',
      'instead of', 'better than', 'different from', 'similar to'
    ];

    const comparisonPhrases = [
      'compared to', 'in comparison', 'unlike', 'whereas', 'however',
      'on the other hand', 'alternatively', 'but', 'rather than'
    ];

    const detectedCompetitors: string[] = [];
    const comparisonPoints: string[] = [];
    let competitiveContext = 0;

    competitorIndicators.forEach(indicator => {
      if (text.includes(indicator)) {
        competitiveContext++;
        // Try to extract competitor names after indicators
        const regex = new RegExp(`${indicator}\\s+([A-Za-z0-9\\s]{2,30})`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          detectedCompetitors.push(...matches);
        }
      }
    });

    comparisonPhrases.forEach(phrase => {
      if (text.includes(phrase)) {
        const regex = new RegExp(`([^.!?]*${phrase}[^.!?]*)`, 'gi');
        const matches = text.match(regex);
        if (matches) {
          comparisonPoints.push(...matches.map(m => m.trim()));
        }
      }
    });

    const confidence = competitiveContext > 0 ? Math.min(0.85, competitiveContext * 0.3) : 0;

    if (confidence < 0.4) {
      return { confidence: 0 };
    }

    return {
      competitor_mentions: detectedCompetitors.slice(0, 3),
      comparison_points: comparisonPoints.slice(0, 3),
      competitive_context_strength: competitiveContext,
      confidence,
      detected_at: new Date().toISOString()
    };
  }

  // Fallback classification when DB classification fails
  private getFallbackClassification(text: string): KnowledgeClassification {
    const lowerText = text.toLowerCase();
    
    return {
      personal_data: {
        communication_style: this.detectCommunicationStyle(lowerText)
      },
      team_shareable: {
        customer_intelligence: this.extractCustomerIntelligence(lowerText)
      },
      classification_confidence: 0.5,
      patterns_matched: ['fallback_classification']
    };
  }

  // Extract knowledge from conversation and store it
  async extractAndStoreKnowledge(conversationId: string): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('extract_knowledge_from_conversation', {
          p_conversation_id: conversationId
        });

      if (error) {
        console.error('Error extracting knowledge:', error);
        return { success: false, error: error.message };
      }

      return { success: true, result: data };
    } catch (error) {
      console.error('Knowledge extraction error:', error);
      return { success: false, error: 'Failed to extract knowledge' };
    }
  }

  // Get user's knowledge context for RAG
  async getUserKnowledgeContext(
    userId: string,
    organizationId?: string,
    knowledgeTypes: ('personal' | 'team_shareable')[] = ['personal', 'team_shareable'],
    limit: number = 50
  ): Promise<any> {
    try {
      const { data, error } = await supabaseAdmin
        .rpc('get_user_knowledge_context', {
          p_user_id: userId,
          p_organization_id: organizationId,
          p_knowledge_types: knowledgeTypes,
          p_limit: limit
        });

      if (error) {
        console.error('Error getting knowledge context:', error);
        return { personal_knowledge: {}, team_knowledge: {} };
      }

      return data;
    } catch (error) {
      console.error('Knowledge context error:', error);
      return { personal_knowledge: {}, team_knowledge: {} };
    }
  }

  // Get user's privacy preferences
  async getUserPrivacyPreferences(userId: string): Promise<UserPrivacyPreferences | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('sam_user_privacy_preferences')
        .select('*')
        .eq('user_id', userId)
        .single();

      if (error) {
        // Return default preferences if none found
        return {
          user_id: userId,
          communication_style_sharing: 'user',
          professional_context_sharing: 'team',
          customer_intelligence_sharing: 'organization',
          market_insights_sharing: 'organization',
          auto_knowledge_extraction: true,
          require_extraction_confirmation: false,
          data_retention_days: 365
        };
      }

      return data as UserPrivacyPreferences;
    } catch (error) {
      console.error('Error getting privacy preferences:', error);
      return null;
    }
  }

  // Update user's privacy preferences
  async updatePrivacyPreferences(
    userId: string,
    preferences: Partial<UserPrivacyPreferences>
  ): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('sam_user_privacy_preferences')
        .upsert({
          user_id: userId,
          ...preferences,
          updated_at: new Date().toISOString()
        });

      if (error) {
        console.error('Error updating privacy preferences:', error);
        return false;
      }

      return true;
    } catch (error) {
      console.error('Privacy preferences update error:', error);
      return false;
    }
  }

  // Get extracted knowledge for a user/organization
  async getExtractedKnowledge(
    userId?: string,
    organizationId?: string,
    knowledgeType?: 'personal' | 'team_shareable',
    category?: string,
    limit: number = 100
  ): Promise<ExtractedKnowledge[]> {
    try {
      let query = supabaseAdmin
        .from('sam_extracted_knowledge')
        .select('*')
        .eq('is_active', true)
        .order('updated_at', { ascending: false })
        .limit(limit);

      if (userId) {
        query = query.eq('user_id', userId);
      }

      if (organizationId) {
        query = query.eq('organization_id', organizationId);
      }

      if (knowledgeType) {
        query = query.eq('knowledge_type', knowledgeType);
      }

      if (category) {
        query = query.eq('category', category);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error getting extracted knowledge:', error);
        return [];
      }

      return data as ExtractedKnowledge[];
    } catch (error) {
      console.error('Extracted knowledge retrieval error:', error);
      return [];
    }
  }
}

// Export singleton instance
export const knowledgeClassifier = new KnowledgeClassifier();