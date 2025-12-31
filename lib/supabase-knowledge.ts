// Postgres-based persistent knowledge base service
import { pool } from '@/lib/auth';

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

export class PostgresKnowledgeBase {

  // Get all knowledge base items by category
  async getByCategory(options: {
    category?: string;
    workspaceId?: string;
    includeGlobal?: boolean;
  } = {}): Promise<KnowledgeBaseItem[]> {
    const { category, workspaceId, includeGlobal = true } = options;
    try {
      let query = `SELECT * FROM knowledge_base WHERE is_active = true`;
      const params: any[] = [];

      if (category) {
        params.push(category);
        query += ` AND category = $${params.length}`;
      }

      if (workspaceId) {
        if (includeGlobal) {
          params.push(workspaceId);
          query += ` AND (workspace_id = $${params.length} OR workspace_id IS NULL)`;
        } else {
          params.push(workspaceId);
          query += ` AND workspace_id = $${params.length}`;
        }
      }

      query += ` ORDER BY created_at DESC`;

      const { rows } = await pool.query(query, params);
      return rows;
    } catch (error) {
      console.error('Knowledge base fetch error:', error);
      return [];
    }
  }

  // Search knowledge base with full text search (ilike)
  async search(
    queryText: string,
    options: {
      category?: string;
      workspaceId?: string;
      includeGlobal?: boolean;
    } = {}
  ): Promise<SearchResult[]> {
    const { category, workspaceId, includeGlobal = true } = options;
    try {
      let sql = `SELECT * FROM knowledge_base WHERE is_active = true`;
      const params: any[] = [];

      if (category) {
        params.push(category);
        sql += ` AND category = $${params.length}`;
      }

      if (workspaceId) {
        if (includeGlobal) {
          params.push(workspaceId);
          sql += ` AND (workspace_id = $${params.length} OR workspace_id IS NULL)`;
        } else {
          params.push(workspaceId);
          sql += ` AND workspace_id = $${params.length}`;
        }
      }

      if (queryText) {
        params.push(`%${queryText}%`);
        sql += ` AND (content ILIKE $${params.length} OR title ILIKE $${params.length})`;
      }

      sql += ` ORDER BY updated_at DESC`;

      const { rows } = await pool.query(sql, params);
      return rows.map(item => ({ ...item, rank: 1 }));
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
    // Just cache warm-up, no logical impact
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
      const keys = Object.keys(item);
      const values = Object.values(item);
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');

      const { rows } = await pool.query(`
        INSERT INTO knowledge_base (${keys.join(', ')}, workspace_id)
        VALUES (${placeholders}, $${keys.length + 1})
        RETURNING *
      `, [...values, item.workspace_id || null]);

      return rows[0];
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
      const keys = Object.keys(updates);
      const values = Object.values(updates);

      if (keys.length === 0) return null;

      let setQuery = keys.map((key, i) => `${key} = $${i + 2}`).join(', ');
      const params = [id, ...values];
      let whereQuery = 'WHERE id = $1';

      if (workspaceId) {
        whereQuery += ` AND workspace_id = $${params.length + 1}`;
        params.push(workspaceId);
      }

      const { rows } = await pool.query(`
        UPDATE knowledge_base SET ${setQuery}
        ${whereQuery}
        RETURNING *
      `, params);

      return rows[0] || null;
    } catch (error) {
      console.error('Knowledge base update error:', error);
      return null;
    }
  }

  // Soft delete knowledge base item
  async deleteKnowledgeItem(id: string, workspaceId?: string | null): Promise<boolean> {
    try {
      const params = [id];
      let sql = `UPDATE knowledge_base SET is_active = false WHERE id = $1`;

      if (workspaceId) {
        params.push(workspaceId);
        sql += ` AND workspace_id = $2`;
      }

      await pool.query(sql, params);
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
      let sql = `SELECT * FROM knowledge_base_documents WHERE workspace_id = $1`;
      const params: any[] = [workspaceId];

      if (!includeInactive) {
        sql += ` AND is_active = true`;
      }

      if (sectionId) {
        params.push(sectionId);
        sql += ` AND section_id = $${params.length}`;
      }

      sql += ` ORDER BY created_at DESC LIMIT $${params.length + 1}`;
      params.push(limit);

      const { rows } = await pool.query(sql, params);
      return rows;
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
      let sql = `SELECT * FROM knowledge_base_icps WHERE workspace_id = $1`;
      if (!includeInactive) {
        sql += ` AND is_active = true`;
      }
      sql += ` ORDER BY created_at DESC`;

      const { rows: structuredICPs } = await pool.query(sql, [workspaceId]);

      // ALSO count ICP documents from knowledge_base_documents table
      const docSql = `
        SELECT id, filename, created_at 
        FROM knowledge_base_documents
        WHERE workspace_id = $1
        AND (
          section_id IN ('icp', 'ideal-customer') 
          OR filename ILIKE '%ideal%client%' 
          OR filename ILIKE '%icp%'
        )
        ORDER BY created_at DESC
      `;
      const { rows: icpDocs } = await pool.query(docSql, [workspaceId]);

      const documentICPs = icpDocs.map((doc: any) => ({
        id: doc.id,
        workspace_id: workspaceId,
        name: doc.filename,
        company_size_min: null,
        company_size_max: null,
        industries: null,
        job_titles: null,
        locations: null,
        technologies: null,
        pain_points: null,
        qualification_criteria: null,
        messaging_framework: null,
        is_active: true,
        created_by: null,
        created_at: doc.created_at,
        updated_at: doc.created_at
      })) as KnowledgeBaseICP[];

      return [...structuredICPs, ...documentICPs];
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
      let sql = `SELECT * FROM knowledge_base_products WHERE workspace_id = $1`;
      if (!includeInactive) {
        sql += ` AND is_active = true`;
      }
      sql += ` ORDER BY created_at DESC`;

      const { rows: structuredProducts } = await pool.query(sql, [workspaceId]);

      // ALSO count product documents
      const { rows: productDocs } = await pool.query(`
        SELECT id, filename, created_at, extracted_content
        FROM knowledge_base_documents
        WHERE workspace_id = $1 AND section_id = 'products'
        ORDER BY created_at DESC
      `, [workspaceId]);

      const documentProducts = productDocs.map((doc: any) => ({
        id: doc.id,
        workspace_id: workspaceId,
        name: doc.filename,
        description: doc.extracted_content?.substring(0, 500) || null,
        category: null,
        pricing: null,
        features: null,
        benefits: null,
        use_cases: null,
        competitive_advantages: null,
        target_segments: null,
        is_active: true,
        created_by: null,
        created_at: doc.created_at,
        updated_at: doc.created_at
      })) as KnowledgeBaseProduct[];

      return [...structuredProducts, ...documentProducts];
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
      let sql = `SELECT * FROM knowledge_base_competitors WHERE workspace_id = $1`;
      if (!includeInactive) {
        sql += ` AND is_active = true`;
      }
      sql += ` ORDER BY created_at DESC`;

      const { rows: structuredCompetitors } = await pool.query(sql, [workspaceId]);

      // ALSO count competitor documents
      const { rows: competitorDocs } = await pool.query(`
        SELECT id, filename, created_at, extracted_content
        FROM knowledge_base_documents
        WHERE workspace_id = $1 AND section_id = 'competition'
        ORDER BY created_at DESC
      `, [workspaceId]);

      const documentCompetitors = competitorDocs.map((doc: any) => ({
        id: doc.id,
        workspace_id: workspaceId,
        name: doc.filename,
        website: null,
        description: doc.extracted_content?.substring(0, 500) || null,
        strengths: null,
        weaknesses: null,
        pricing_model: null,
        key_features: null,
        target_market: null,
        competitive_positioning: null,
        is_active: true,
        created_by: null,
        created_at: doc.created_at,
        updated_at: doc.created_at
      })) as KnowledgeBaseCompetitor[];

      return [...structuredCompetitors, ...documentCompetitors];
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
      let sql = `SELECT * FROM knowledge_base_personas WHERE workspace_id = $1`;
      const params: any[] = [workspaceId];

      if (icpId) {
        params.push(icpId);
        sql += ` AND icp_id = $${params.length}`;
      }

      if (!includeInactive) {
        sql += ` AND is_active = true`;
      }

      sql += ` ORDER BY created_at DESC`;

      const { rows } = await pool.query(sql, params);
      return rows;
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
      const sections = {
        products: { category: 'products', weight: 15, minEntries: 2 },
        icp: { category: 'icp-intelligence', weight: 15, minEntries: 3 },
        messaging: { category: 'messaging', weight: 15, minEntries: 3 },
        pricing: { category: 'pricing', weight: 15, minEntries: 1 },
        objections: { category: 'objection-handling', weight: 10, minEntries: 3 },
        success_stories: { category: 'case-studies', weight: 10, minEntries: 2 },
        competition: { category: 'competitive-intelligence', weight: 10, minEntries: 2 },
        company_info: { category: 'company-info', weight: 2, minEntries: 1 },
        buying_process: { category: 'sales-process', weight: 2, minEntries: 1 },
        personas: { category: 'personas', weight: 2, minEntries: 2 },
        compliance: { category: 'compliance', weight: 2, minEntries: 1 },
        tone_of_voice: { category: 'tone-of-voice', weight: 2, minEntries: 1 },
        overview: { category: 'business-model', weight: 0, minEntries: 0 },
        success_metrics: { category: 'success-metrics', weight: 0, minEntries: 0 },
        documents: { category: 'documents', weight: 0, minEntries: 0 }
      };

      const sectionResults: Record<string, { percentage: number; entries: number; depth: number }> = {};
      const missingCritical: string[] = [];
      let totalWeightedScore = 0;
      let totalWeight = 0;

      // Query all KB sources concurrently
      const [kbEntries, icpEntries, icps, products, competitors, personas] = await Promise.all([
        this.getByCategory({ workspaceId, includeGlobal: false }),
        pool.query(`
          SELECT category FROM sam_icp_knowledge_entries 
          WHERE workspace_id = $1 AND is_active = true
        `, [workspaceId]).then(res => res.rows),
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
          const icpKnowledgeCount = icpEntries.filter((e: any) =>
            e.category === 'icp' || e.category?.includes('target')
          ).length || 0;
          entries += icpKnowledgeCount;
          entries += icps.length * 2;
        }

        // Count structured data
        if (sectionName === 'products') entries += products.length;
        if (sectionName === 'competition') entries += competitors.length;
        if (sectionName === 'personas') entries += personas.length;

        const avgContentLength = entries > 0 ? totalContentLength / entries : 0;
        const depth = Math.min(100, Math.round((avgContentLength / 500) * 100)); // 500 chars = 100% depth

        const percentage = config.minEntries > 0
          ? Math.min(100, Math.round((entries / config.minEntries) * 100))
          : entries > 0 ? 100 : 0;

        sectionResults[sectionName] = { percentage, entries, depth };

        if (config.weight === 15 && percentage < 70) {
          missingCritical.push(sectionName);
        }

        totalWeightedScore += percentage * config.weight;
        totalWeight += config.weight;
      }

      const overallCompleteness = Math.round(totalWeightedScore / totalWeight);

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

// Export singleton instance - renamed from SupabaseKnowledgeBase to supabaseKnowledge to maintain compatibility
export const supabaseKnowledge = new PostgresKnowledgeBase();
