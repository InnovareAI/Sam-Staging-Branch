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
  workspace_id?: string | null;
  source_attachment_id?: string | null;
  source_type?: 'manual' | 'document_upload' | 'sam_discovery' | 'api_import';
  source_metadata?: Record<string, any>;
}

export interface SearchResult extends KnowledgeBaseItem {
  rank: number;
}

export interface KnowledgeBaseDocument {
  id: string;
  workspace_id: string | null;
  section_id: string;
  filename: string;
  original_filename?: string | null;
  file_type?: string | null;
  file_size?: number | null;
  storage_path?: string | null;
  extracted_content?: string | null;
  metadata?: Record<string, unknown> | null;
  tags?: string[] | null;
  summary?: string | null;
  vector_chunks?: number | null;
  processed_at?: string | null;
  vectorized_at?: string | null;
  uploaded_by?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseICP {
  id: string;
  workspace_id: string;
  name: string;
  icp_name?: string | null;
  company_size_min?: number | null;
  company_size_max?: number | null;
  industries?: string[] | null;
  job_titles?: string[] | null;
  locations?: string[] | null;
  technologies?: string[] | null;
  pain_points?: string[] | null;
  qualification_criteria?: Record<string, unknown> | null;
  messaging_framework?: Record<string, unknown> | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseProduct {
  id: string;
  workspace_id: string;
  name: string;
  description?: string | null;
  category?: string | null;
  pricing?: Record<string, unknown> | null;
  features?: string[] | null;
  benefits?: string[] | null;
  use_cases?: string[] | null;
  competitive_advantages?: string[] | null;
  target_segments?: string[] | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBaseCompetitor {
  id: string;
  workspace_id: string;
  name: string;
  website?: string | null;
  description?: string | null;
  strengths?: string[] | null;
  weaknesses?: string[] | null;
  pricing_model?: string | null;
  key_features?: string[] | null;
  target_market?: string | null;
  competitive_positioning?: Record<string, unknown> | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface KnowledgeBasePersona {
  id: string;
  workspace_id: string;
  name: string;
  job_title?: string | null;
  department?: string | null;
  seniority_level?: string | null;
  decision_making_role?: string | null;
  pain_points?: string[] | null;
  goals?: string[] | null;
  communication_preferences?: Record<string, unknown> | null;
  objections?: string[] | null;
  messaging_approach?: Record<string, unknown> | null;
  icp_id?: string | null;
  is_active: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export class SupabaseKnowledgeBase {
  
  // Get all knowledge base items by category
  async getByCategory(options: {
    category?: string;
    workspaceId?: string;
    includeGlobal?: boolean;
  } = {}): Promise<KnowledgeBaseItem[]> {
    const { category, workspaceId, includeGlobal = true } = options;
    try {
      let query = supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      
      if (category) {
        query = query.eq('category', category);
      }
      
       if (workspaceId) {
         const filters = includeGlobal
           ? `workspace_id.eq.${workspaceId},workspace_id.is.null`
           : `workspace_id.eq.${workspaceId}`;
         query = query.or(filters);
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
  async search(
    query: string,
    options: {
      category?: string;
      workspaceId?: string;
      includeGlobal?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { category, workspaceId, includeGlobal = true } = options;
    try {
      let builder = supabaseAdmin
        .from('knowledge_base')
        .select('*')
        .eq('is_active', true);

      if (category) {
        builder = builder.eq('category', category);
      }

      if (workspaceId) {
        const filters = includeGlobal
          ? `workspace_id.eq.${workspaceId},workspace_id.is.null`
          : `workspace_id.eq.${workspaceId}`;
        builder = builder.or(filters);
      }

      if (query) {
        builder = builder.or(`content.ilike.%${query}%,title.ilike.%${query}%`);
      }

      const { data, error } = await builder.order('updated_at', { ascending: false });

      if (error) {
        console.error('Error searching knowledge base:', error);
        return [];
      }

      return (data || []).map(item => ({ ...item, rank: 1 }));
    } catch (error) {
      console.error('Knowledge base search error:', error);
      return [];
    }
  }
  
  // Get persona-specific guidance based on user input
  async getPersonaGuidance(userInput: string, workspaceId?: string): Promise<string> {
    await this.search('personas founder sales marketing consultant coach agency recruiting financial legal pharma manufacturing', {
      workspaceId,
      includeGlobal: true
    });
    
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
  async getObjectionResponse(objection: string, workspaceId?: string): Promise<string> {
    await this.search('objections apollo sales nav hire sdr ai compliance', {
      workspaceId,
      includeGlobal: true
    });
    
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
  async getIndustryBurst(industry: string, workspaceId?: string): Promise<string> {
    const industryData = await this.search(`industry ${industry} vertical messaging`, {
      category: 'verticals',
      workspaceId,
      includeGlobal: true
    });
    
    if (industryData.length > 0) {
      return industryData[0].content;
    }
    
    return '';
  }
  
  // Get comprehensive system prompt with all knowledge
  async getSystemPrompt(workspaceId?: string): Promise<string> {
    try {
      const [identity, personas, conversationModes, errorHandling, objectionHandling, industryBursts] = await Promise.all([
        this.search('identity core capabilities', { category: 'core', workspaceId, includeGlobal: true }),
        this.search('personas library', { category: 'core', workspaceId, includeGlobal: true }),
        this.search('conversation modes', { category: 'conversational-design', workspaceId, includeGlobal: true }),
        this.search('error handling', { category: 'conversational-design', workspaceId, includeGlobal: true }),
        this.search('objection handling', { category: 'strategy', workspaceId, includeGlobal: true }),
        this.search('industry messaging', { category: 'verticals', workspaceId, includeGlobal: true })
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
        .insert([{ ...item, workspace_id: item.workspace_id ?? null }])
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
  async updateKnowledgeItem(
    id: string,
    updates: Partial<KnowledgeBaseItem>,
    workspaceId?: string | null
  ): Promise<KnowledgeBaseItem | null> {
    try {
      let query = supabaseAdmin
        .from('knowledge_base')
        .update(updates)
        .eq('id', id);

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { data, error } = await query
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
  async deleteKnowledgeItem(id: string, workspaceId?: string | null): Promise<boolean> {
    try {
      let query = supabaseAdmin
        .from('knowledge_base')
        .update({ is_active: false })
        .eq('id', id);

      if (workspaceId) {
        query = query.eq('workspace_id', workspaceId);
      }

      const { error } = await query;
      
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

  async getDocuments(options: {
    workspaceId: string;
    sectionId?: string;
    includeInactive?: boolean;
    limit?: number;
  }): Promise<KnowledgeBaseDocument[]> {
    const { workspaceId, sectionId, includeInactive = false, limit = 50 } = options;
    try {
      let query = supabaseAdmin
        .from('knowledge_base_documents')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false })
        .limit(limit);

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      if (sectionId) {
        query = query.eq('section_id', sectionId);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching knowledge base documents:', error);
        return [];
      }

      return (data || []) as KnowledgeBaseDocument[];
    } catch (error) {
      console.error('Knowledge base documents fetch error:', error);
      return [];
    }
  }

  async getICPs(options: {
    workspaceId: string;
    includeInactive?: boolean;
  }): Promise<KnowledgeBaseICP[]> {
    const { workspaceId, includeInactive = false } = options;
    try {
      let query = supabaseAdmin
        .from('knowledge_base_icps')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching knowledge base ICPs:', error);
        return [];
      }

      return (data || []) as KnowledgeBaseICP[];
    } catch (error) {
      console.error('Knowledge base ICP fetch error:', error);
      return [];
    }
  }

  async getProducts(options: {
    workspaceId: string;
    includeInactive?: boolean;
  }): Promise<KnowledgeBaseProduct[]> {
    const { workspaceId, includeInactive = false } = options;
    try {
      let query = supabaseAdmin
        .from('knowledge_base_products')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching knowledge base products:', error);
        return [];
      }

      return (data || []) as KnowledgeBaseProduct[];
    } catch (error) {
      console.error('Knowledge base products fetch error:', error);
      return [];
    }
  }

  async getCompetitors(options: {
    workspaceId: string;
    includeInactive?: boolean;
  }): Promise<KnowledgeBaseCompetitor[]> {
    const { workspaceId, includeInactive = false } = options;
    try {
      let query = supabaseAdmin
        .from('knowledge_base_competitors')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching knowledge base competitors:', error);
        return [];
      }

      return (data || []) as KnowledgeBaseCompetitor[];
    } catch (error) {
      console.error('Knowledge base competitors fetch error:', error);
      return [];
    }
  }

  async getPersonas(options: {
    workspaceId: string;
    icpId?: string;
    includeInactive?: boolean;
  }): Promise<KnowledgeBasePersona[]> {
    const { workspaceId, icpId, includeInactive = false } = options;
    try {
      let query = supabaseAdmin
        .from('knowledge_base_personas')
        .select('*')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: false });

      if (icpId) {
        query = query.eq('icp_id', icpId);
      }

      if (!includeInactive) {
        query = query.eq('is_active', true);
      }

      const { data, error } = await query;

      if (error) {
        console.error('Error fetching knowledge base personas:', error);
        return [];
      }

      return (data || []) as KnowledgeBasePersona[];
    } catch (error) {
      console.error('Knowledge base personas fetch error:', error);
      return [];
    }
  }

  // Check KB completeness for a workspace
  async checkKBCompleteness(workspaceId: string): Promise<{
    overallCompleteness: number;
    sections: Record<string, { percentage: number; entries: number; depth: number }>;
    missingCritical: string[];
  }> {
    try {
      // Define KB sections and their importance (critical, important, valuable)
      const sections = {
        overview: { category: 'business-model', weight: 3, minEntries: 2 },
        icp: { category: 'icp-intelligence', weight: 3, minEntries: 3 },
        products: { category: 'products', weight: 3, minEntries: 2 },
        messaging: { category: 'messaging', weight: 2, minEntries: 3 },
        success_stories: { category: 'case-studies', weight: 2, minEntries: 2 },
        objections: { category: 'objection-handling', weight: 2, minEntries: 3 },
        competition: { category: 'competitive-intelligence', weight: 2, minEntries: 2 },
        personas: { category: 'personas', weight: 2, minEntries: 2 },
        pricing: { category: 'pricing', weight: 1, minEntries: 1 },
        tone_of_voice: { category: 'tone-of-voice', weight: 1, minEntries: 1 },
        company_info: { category: 'company-info', weight: 1, minEntries: 1 },
        buying_process: { category: 'sales-process', weight: 1, minEntries: 1 },
        compliance: { category: 'compliance', weight: 1, minEntries: 1 },
        success_metrics: { category: 'success-metrics', weight: 1, minEntries: 1 },
        documents: { category: 'documents', weight: 1, minEntries: 0 }
      };

      const sectionResults: Record<string, { percentage: number; entries: number; depth: number }> = {};
      const missingCritical: string[] = [];
      let totalWeightedScore = 0;
      let totalWeight = 0;

      // Query all KB sources
      const [kbEntries, icpEntries, icps, products, competitors, personas] = await Promise.all([
        this.getByCategory({ workspaceId, includeGlobal: false }),
        supabaseAdmin
          .from('sam_icp_knowledge_entries')
          .select('category')
          .eq('workspace_id', workspaceId)
          .eq('is_active', true),
        this.getICPs({ workspaceId }),
        this.getProducts({ workspaceId }),
        this.getCompetitors({ workspaceId }),
        this.getPersonas({ workspaceId })
      ]);

      // Calculate section completeness
      for (const [sectionName, config] of Object.entries(sections)) {
        let entries = 0;
        let totalContentLength = 0;

        // Count entries from knowledge_base
        const categoryEntries = kbEntries.filter(e => 
          e.category === config.category || 
          e.category?.includes(sectionName.replace('_', '-'))
        );
        entries += categoryEntries.length;
        totalContentLength += categoryEntries.reduce((sum, e) => sum + (e.content?.length || 0), 0);

        // Count from ICP knowledge entries
        if (sectionName === 'icp') {
          const icpKnowledgeCount = icpEntries.data?.filter((e: any) => 
            e.category === 'icp' || e.category?.includes('target')
          ).length || 0;
          entries += icpKnowledgeCount;
          entries += icps.length * 2; // Each ICP config counts as 2 entries
        }

        // Count structured data
        if (sectionName === 'products') entries += products.length;
        if (sectionName === 'competition') entries += competitors.length;
        if (sectionName === 'personas') entries += personas.length;

        // Calculate depth score (0-100 based on content richness)
        const avgContentLength = entries > 0 ? totalContentLength / entries : 0;
        const depth = Math.min(100, Math.round((avgContentLength / 500) * 100)); // 500 chars = 100% depth

        // Calculate percentage (based on entries vs. minEntries)
        const percentage = config.minEntries > 0 
          ? Math.min(100, Math.round((entries / config.minEntries) * 100))
          : entries > 0 ? 100 : 0;

        sectionResults[sectionName] = { percentage, entries, depth };

        // Track critical missing sections
        if (config.weight === 3 && percentage < 70) {
          missingCritical.push(sectionName);
        }

        // Calculate weighted score
        totalWeightedScore += percentage * config.weight;
        totalWeight += config.weight * 100;
      }

      const overallCompleteness = Math.round(totalWeightedScore / totalWeight * 100);

      return {
        overallCompleteness,
        sections: sectionResults,
        missingCritical
      };
    } catch (error) {
      console.error('Error checking KB completeness:', error);
      return {
        overallCompleteness: 0,
        sections: {},
        missingCritical: []
      };
    }
  }
}

// Export singleton instance
export const supabaseKnowledge = new SupabaseKnowledgeBase();
