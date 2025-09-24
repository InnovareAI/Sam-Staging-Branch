// Template Selection Algorithm for Cost-Controlled Personalization
// Zero-token execution with Claude Sonnet 4 created templates

export interface ProspectData {
  first_name: string;
  company_name: string;
  industry?: string;
  company_size?: number;
  job_title?: string;
  seniority_level?: 'ic' | 'manager' | 'director' | 'vp' | 'c_level';
  department?: 'sales' | 'marketing' | 'engineering' | 'operations' | 'hr';
  recent_funding?: boolean;
  funding_stage?: 'pre_seed' | 'seed' | 'series_a' | 'series_b' | 'series_c' | 'growth';
  growth_indicators?: string[];
  pain_points?: string[];
  recent_activity?: string;
}

export interface MessageTemplate {
  id: string;
  name: string;
  category: 'growth_stage' | 'enterprise' | 'industry_specific' | 'pain_point' | 'generic';
  subcategory: string;
  
  // Template components
  opening_template: string;
  body_template: string;
  cta_template: string;
  
  // Targeting criteria
  target_company_size?: { min?: number; max?: number };
  target_industries?: string[];
  target_seniority?: string[];
  target_pain_points?: string[];
  required_context?: string[];
  
  // Performance metrics
  usage_count: number;
  response_rate?: number;
  meeting_conversion_rate?: number;
  created_at: Date;
  updated_at: Date;
}

export interface PersonalizationConfig {
  personalization_tier: 'variable_only' | 'ai_enhanced';
  template_selection_strategy: 'best_match' | 'highest_performing' | 'a_b_test';
  fallback_behavior: 'generic_template' | 'ai_generation' | 'skip';
}

export class TemplateSelectionEngine {
  private templates: MessageTemplate[] = [];
  
  constructor(templates: MessageTemplate[]) {
    this.templates = templates;
  }

  /**
   * Select optimal template based on prospect profile
   * Uses rule-based algorithm for zero-token execution
   */
  selectOptimalTemplate(
    prospect: ProspectData, 
    config: PersonalizationConfig = { 
      personalization_tier: 'variable_only',
      template_selection_strategy: 'best_match',
      fallback_behavior: 'generic_template'
    }
  ): MessageTemplate | null {
    
    // Step 1: Score all templates against prospect profile
    const scoredTemplates = this.templates
      .map(template => ({
        template,
        score: this.calculateTemplateScore(template, prospect)
      }))
      .filter(item => item.score > 0)
      .sort((a, b) => b.score - a.score);

    if (scoredTemplates.length === 0) {
      return this.handleNoMatchFallback(prospect, config);
    }

    // Step 2: Apply selection strategy
    switch (config.template_selection_strategy) {
      case 'highest_performing':
        return this.selectHighestPerforming(scoredTemplates);
      
      case 'a_b_test':
        return this.selectForABTest(scoredTemplates);
      
      case 'best_match':
      default:
        return scoredTemplates[0].template;
    }
  }

  /**
   * Calculate template match score (0-100)
   */
  private calculateTemplateScore(template: MessageTemplate, prospect: ProspectData): number {
    let score = 0;
    let maxScore = 0;

    // Company size scoring (0-25 points)
    maxScore += 25;
    if (template.target_company_size) {
      const size = prospect.company_size || 0;
      const min = template.target_company_size.min || 0;
      const max = template.target_company_size.max || Infinity;
      
      if (size >= min && size <= max) {
        score += 25;
      } else if (size > 0) {
        // Partial credit for near misses
        const distance = Math.min(Math.abs(size - min), Math.abs(size - max));
        const maxDistance = Math.max(min, max - min);
        score += Math.max(0, 25 - (distance / maxDistance) * 25);
      }
    } else {
      score += 15; // Default score for templates without size requirements
    }

    // Industry scoring (0-20 points)
    maxScore += 20;
    if (template.target_industries?.length && prospect.industry) {
      if (template.target_industries.includes(prospect.industry)) {
        score += 20;
      } else {
        // Check for industry category matches (e.g., 'tech' matches 'saas', 'software')
        const industryMatch = this.checkIndustryCategory(prospect.industry, template.target_industries);
        if (industryMatch) score += 10;
      }
    } else if (!template.target_industries?.length) {
      score += 10; // Generic templates get partial credit
    }

    // Seniority scoring (0-15 points)
    maxScore += 15;
    if (template.target_seniority?.length && prospect.seniority_level) {
      if (template.target_seniority.includes(prospect.seniority_level)) {
        score += 15;
      }
    } else if (!template.target_seniority?.length) {
      score += 10;
    }

    // Pain point scoring (0-20 points)
    maxScore += 20;
    if (template.target_pain_points?.length && prospect.pain_points?.length) {
      const matches = template.target_pain_points.filter(tp => 
        prospect.pain_points!.some(pp => pp.toLowerCase().includes(tp.toLowerCase()))
      );
      score += (matches.length / template.target_pain_points.length) * 20;
    } else if (!template.target_pain_points?.length) {
      score += 10;
    }

    // Context requirements scoring (0-10 points)
    maxScore += 10;
    if (template.required_context?.length) {
      const contextAvailable = template.required_context.every(ctx => {
        switch (ctx) {
          case 'recent_funding': return prospect.recent_funding;
          case 'growth_indicators': return prospect.growth_indicators?.length > 0;
          case 'recent_activity': return !!prospect.recent_activity;
          default: return false;
        }
      });
      score += contextAvailable ? 10 : 0;
    } else {
      score += 5;
    }

    // Performance bonus (0-10 points)
    maxScore += 10;
    if (template.response_rate && template.usage_count > 10) {
      score += Math.min(10, template.response_rate * 100);
    } else {
      score += 5; // New templates get neutral score
    }

    // Return percentage score
    return (score / maxScore) * 100;
  }

  /**
   * Check if industry matches template categories
   */
  private checkIndustryCategory(prospectIndustry: string, targetIndustries: string[]): boolean {
    const industryCategories = {
      tech: ['saas', 'software', 'technology', 'fintech', 'edtech', 'healthtech'],
      finance: ['banking', 'insurance', 'fintech', 'investment', 'accounting'],
      healthcare: ['medical', 'pharmaceutical', 'healthtech', 'biotechnology'],
      manufacturing: ['automotive', 'aerospace', 'industrial', 'construction'],
      services: ['consulting', 'legal', 'marketing', 'advertising', 'recruiting']
    };

    for (const [category, industries] of Object.entries(industryCategories)) {
      if (targetIndustries.includes(category) && 
          industries.some(ind => prospectIndustry.toLowerCase().includes(ind))) {
        return true;
      }
    }
    return false;
  }

  /**
   * Select template with highest performance metrics
   */
  private selectHighestPerforming(scoredTemplates: Array<{template: MessageTemplate, score: number}>): MessageTemplate {
    return scoredTemplates
      .filter(item => item.template.usage_count > 10)
      .sort((a, b) => {
        const aPerf = (a.template.response_rate || 0) * (a.template.meeting_conversion_rate || 0);
        const bPerf = (b.template.response_rate || 0) * (b.template.meeting_conversion_rate || 0);
        return bPerf - aPerf;
      })[0]?.template || scoredTemplates[0].template;
  }

  /**
   * Select template for A/B testing
   */
  private selectForABTest(scoredTemplates: Array<{template: MessageTemplate, score: number}>): MessageTemplate {
    // Select from top 3 scoring templates randomly for A/B testing
    const topTemplates = scoredTemplates.slice(0, 3);
    const randomIndex = Math.floor(Math.random() * topTemplates.length);
    return topTemplates[randomIndex].template;
  }

  /**
   * Handle case when no templates match
   */
  private handleNoMatchFallback(prospect: ProspectData, config: PersonalizationConfig): MessageTemplate | null {
    switch (config.fallback_behavior) {
      case 'generic_template':
        return this.templates.find(t => t.category === 'generic') || this.templates[0] || null;
      
      case 'ai_generation':
        // Flag for AI generation - handled by calling system
        return null;
      
      case 'skip':
      default:
        return null;
    }
  }

  /**
   * Get template recommendations for prospect
   */
  getTemplateRecommendations(prospect: ProspectData, limit: number = 5): Array<{
    template: MessageTemplate;
    score: number;
    reasoning: string;
  }> {
    return this.templates
      .map(template => ({
        template,
        score: this.calculateTemplateScore(template, prospect),
        reasoning: this.generateRecommendationReasoning(template, prospect)
      }))
      .filter(item => item.score > 30)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  }

  /**
   * Generate explanation for template recommendation
   */
  private generateRecommendationReasoning(template: MessageTemplate, prospect: ProspectData): string {
    const reasons = [];
    
    if (template.target_company_size && prospect.company_size) {
      const size = prospect.company_size;
      const min = template.target_company_size.min || 0;
      const max = template.target_company_size.max || Infinity;
      if (size >= min && size <= max) {
        reasons.push(`Company size (${size}) matches template target`);
      }
    }
    
    if (template.target_industries?.includes(prospect.industry || '')) {
      reasons.push(`Industry (${prospect.industry}) directly targeted`);
    }
    
    if (template.target_seniority?.includes(prospect.seniority_level || '')) {
      reasons.push(`Seniority level (${prospect.seniority_level}) matches`);
    }
    
    if (template.target_pain_points?.some(tp => 
      prospect.pain_points?.some(pp => pp.toLowerCase().includes(tp.toLowerCase()))
    )) {
      reasons.push('Pain points align with template messaging');
    }
    
    if (template.response_rate && template.usage_count > 10) {
      reasons.push(`High performance (${(template.response_rate * 100).toFixed(1)}% response rate)`);
    }
    
    return reasons.join('; ') || 'General template suitable for broad audiences';
  }

  /**
   * Update template performance metrics
   */
  updateTemplatePerformance(
    templateId: string, 
    metrics: { 
      responses?: number; 
      meetings?: number; 
      sends: number 
    }
  ): void {
    const template = this.templates.find(t => t.id === templateId);
    if (!template) return;

    template.usage_count += metrics.sends;
    
    if (metrics.responses !== undefined) {
      const totalResponses = (template.response_rate || 0) * (template.usage_count - metrics.sends) + metrics.responses;
      template.response_rate = totalResponses / template.usage_count;
    }
    
    if (metrics.meetings !== undefined) {
      const totalMeetings = (template.meeting_conversion_rate || 0) * (template.usage_count - metrics.sends) + metrics.meetings;
      template.meeting_conversion_rate = totalMeetings / template.usage_count;
    }
    
    template.updated_at = new Date();
  }
}

/**
 * Variable replacement system for zero-token execution
 */
export class VariableReplacer {
  /**
   * Replace variables in template with prospect data
   */
  static replaceVariables(template: string, prospect: ProspectData): string {
    let result = template;
    
    // Basic replacements
    result = result.replace(/\{\{first_name\}\}/g, prospect.first_name || '[First Name]');
    result = result.replace(/\{\{company_name\}\}/g, prospect.company_name || '[Company]');
    result = result.replace(/\{\{industry\}\}/g, prospect.industry || 'your industry');
    result = result.replace(/\{\{job_title\}\}/g, prospect.job_title || 'your role');
    
    // Advanced replacements
    if (prospect.funding_stage) {
      result = result.replace(/\{\{funding_stage\}\}/g, this.formatFundingStage(prospect.funding_stage));
    }
    
    if (prospect.growth_indicators?.length) {
      result = result.replace(/\{\{growth_indicator\}\}/g, prospect.growth_indicators[0]);
    }
    
    if (prospect.pain_points?.length) {
      result = result.replace(/\{\{pain_point\}\}/g, prospect.pain_points[0]);
    }
    
    if (prospect.recent_activity) {
      result = result.replace(/\{\{recent_activity\}\}/g, prospect.recent_activity);
    }
    
    // Company size formatting
    if (prospect.company_size) {
      result = result.replace(/\{\{company_size\}\}/g, this.formatCompanySize(prospect.company_size));
    }
    
    // Department context
    if (prospect.department) {
      result = result.replace(/\{\{department\}\}/g, prospect.department);
    }
    
    return result;
  }
  
  private static formatFundingStage(stage: string): string {
    const stageMap = {
      'pre_seed': 'pre-seed funding',
      'seed': 'seed funding',
      'series_a': 'Series A funding',
      'series_b': 'Series B funding', 
      'series_c': 'Series C funding',
      'growth': 'growth-stage funding'
    };
    return stageMap[stage as keyof typeof stageMap] || stage;
  }
  
  private static formatCompanySize(size: number): string {
    if (size < 10) return 'early-stage startup';
    if (size < 50) return 'growing startup';
    if (size < 200) return 'scale-up company';
    if (size < 1000) return 'mid-market company';
    return 'enterprise organization';
  }
}

/**
 * Complete message assembly
 */
export interface AssembledMessage {
  opening: string;
  body: string;
  cta: string;
  full_message: string;
  template_used: string;
  personalization_cost: number; // In tokens
}

export class MessageAssembler {
  /**
   * Assemble complete message from template and prospect data
   */
  static assembleMessage(
    template: MessageTemplate,
    prospect: ProspectData,
    personalizationTier: 'variable_only' | 'ai_enhanced' = 'variable_only'
  ): AssembledMessage {
    
    const opening = VariableReplacer.replaceVariables(template.opening_template, prospect);
    const body = VariableReplacer.replaceVariables(template.body_template, prospect);
    const cta = VariableReplacer.replaceVariables(template.cta_template, prospect);
    
    const full_message = `${opening}\n\n${body}\n\n${cta}`;
    
    return {
      opening,
      body,
      cta,
      full_message,
      template_used: template.id,
      personalization_cost: personalizationTier === 'variable_only' ? 0 : 50
    };
  }
}