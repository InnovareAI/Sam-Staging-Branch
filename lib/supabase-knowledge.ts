// Supabase-based persistent knowledge base service
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

// Use service role key for server-side operations
const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey);

export interface KnowledgeBaseItem {
  id: string;
  category: string;
  subcategory?: string;
  title: string;
  content: string;
  tags: string[];
  version: string;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface SearchResult extends KnowledgeBaseItem {
  rank: number;
}

export class SupabaseKnowledgeBase {
  
  // Get all knowledge base items by category
  async getByCategory(category?: string): Promise<KnowledgeBaseItem[]> {
    try {
      let query = supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (category) {
        query = query.eq('category', category);
      }
      
      const { data, error } = await query;
      
      if (error) {
        console.error('Error fetching knowledge base:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Knowledge base fetch error:', error);
      return [];
    }
  }
  
  // Search knowledge base with full text search
  async search(query: string, category?: string): Promise<SearchResult[]> {
    try {
      const { data, error } = await supabaseAdmin.rpc('search_knowledge_base', {
        search_query: query,
        category_filter: category || null
      });
      
      if (error) {
        console.error('Error searching knowledge base:', error);
        return [];
      }
      
      return data || [];
    } catch (error) {
      console.error('Knowledge base search error:', error);
      return [];
    }
  }
  
  // Get persona-specific guidance based on user input
  async getPersonaGuidance(userInput: string): Promise<string> {
    const personas = await this.search('personas founder sales marketing consultant coach agency recruiting financial legal pharma manufacturing');
    
    const input = userInput.toLowerCase();
    const personaKeywords = {
      'founder': 'Growth, fundraising, efficient GTM',
      'sales': 'Pipeline generation, conversion rates', 
      'marketing': 'Brand consistency, multi-channel campaigns',
      'consultant': 'High-value client acquisition',
      'coach': 'Personal connection, steady lead flow',
      'agency': 'Scalable results for clients',
      'recruiting': 'Faster placements, higher-quality pipelines',
      'financial': 'Trust, compliance, credibility',
      'legal': 'Client origination, credibility',
      'pharma': 'HCP engagement, compliant communications',
      'manufacturing': 'Supply chain efficiency, market expansion'
    };

    for (const [persona, focus] of Object.entries(personaKeywords)) {
      if (input.includes(persona)) {
        return `Based on your ${persona} role, I'll focus on: ${focus}`;
      }
    }

    return '';
  }
  
  // Get objection handling response
  async getObjectionResponse(objection: string): Promise<string> {
    const objectionData = await this.search('objections apollo sales nav hire sdr ai compliance');
    
    const input = objection.toLowerCase();
    const objectionMap: { [key: string]: string } = {
      'apollo': 'Great tools for data, but SAM orchestrates 14 agents across enrichment, personalization, outreach, replies, and analytics.',
      'sales nav': 'Great tools for data, but SAM orchestrates 14 agents across enrichment, personalization, outreach, replies, and analytics.',
      'hire sdr': 'SDRs take 3–6 months to ramp. SAM delivers ROI in weeks at 20% of the cost.',
      'ai': 'Every message is personalized with context from LinkedIn, websites, and case studies. Feels researched, not robotic.',
      'compliance': 'SAM includes HITL approvals, pre-approved disclaimers, and vertical-specific compliance libraries.'
    };

    for (const [keyword, response] of Object.entries(objectionMap)) {
      if (input.includes(keyword)) {
        return response;
      }
    }

    return '';
  }
  
  // Get industry-specific messaging
  async getIndustryBurst(industry: string): Promise<string> {
    const industryData = await this.search(`industry ${industry} vertical messaging`, 'verticals');
    
    if (industryData.length > 0) {
      return industryData[0].content;
    }
    
    return '';
  }
  
  // Get comprehensive system prompt with all knowledge
  async getSystemPrompt(): Promise<string> {
    try {
      const [identity, personas, conversationModes, errorHandling, objectionHandling, industryBursts] = await Promise.all([
        this.search('identity core capabilities', 'core'),
        this.search('personas library', 'core'), 
        this.search('conversation modes', 'conversational-design'),
        this.search('error handling', 'conversational-design'),
        this.search('objection handling', 'strategy'),
        this.search('industry messaging', 'verticals')
      ]);
      
      const systemPrompt = `You are Sam, an AI-powered B2B sales assistant with sophisticated training in automated outreach, lead scoring, and personalized messaging.

## Core Identity:
${identity[0]?.content || 'SAM AI specialized B2B sales assistant'}

## Conversation Modes:
${conversationModes[0]?.content || 'Four main modes: Onboarding, Product QA, Campaign Management, Repair'}

## Error Handling:
${errorHandling[0]?.content || 'Comprehensive error recovery strategies'}

## Objection Handling:
${objectionHandling[0]?.content || 'Proven responses to common objections'}

## Industry Intelligence:
${industryBursts[0]?.content || 'Industry-specific messaging and pain points'}

## Personas Library:
${personas[0]?.content || 'User personas for targeting and personalization'}

You are context-aware and adapt your responses based on the user's industry, role, and conversation history. Follow the consultant-style approach with professional warmth. Always be helpful, knowledgeable, and focused on delivering value through sales process optimization.`;

      return systemPrompt;
    } catch (error) {
      console.error('Error building system prompt:', error);
      return 'You are Sam, an AI-powered B2B sales assistant focused on helping optimize sales processes.';
    }
  }
  
  // Add new knowledge base item
  async addKnowledgeItem(item: Omit<KnowledgeBaseItem, 'id' | 'created_at' | 'updated_at'>): Promise<KnowledgeBaseItem | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .insert([item])
        .select()
        .single();
      
      if (error) {
        console.error('Error adding knowledge item:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Knowledge base add error:', error);
      return null;
    }
  }
  
  // Update knowledge base item
  async updateKnowledgeItem(id: string, updates: Partial<KnowledgeBaseItem>): Promise<KnowledgeBaseItem | null> {
    try {
      const { data, error } = await supabaseAdmin
        .from('knowledge_base')
        .update(updates)
        .eq('id', id)
        .select()
        .single();
      
      if (error) {
        console.error('Error updating knowledge item:', error);
        return null;
      }
      
      return data;
    } catch (error) {
      console.error('Knowledge base update error:', error);
      return null;
    }
  }
  
  // Soft delete knowledge base item
  async deleteKnowledgeItem(id: string): Promise<boolean> {
    try {
      const { error } = await supabaseAdmin
        .from('knowledge_base')
        .update({ is_active: false })
        .eq('id', id);
      
      if (error) {
        console.error('Error deleting knowledge item:', error);
        return false;
      }
      
      return true;
    } catch (error) {
      console.error('Knowledge base delete error:', error);
      return false;
    }
  }
}

// Export singleton instance
export const supabaseKnowledge = new SupabaseKnowledgeBase();