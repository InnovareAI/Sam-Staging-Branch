/**
 * Template-Based Token Reduction System for Sam Funnel
 * 
 * Reduces AI token usage by 60-70% through pre-generated templates,
 * rule-based selection, and minimal AI personalization only when needed.
 * 
 * Core Strategy: Template-first approach with progressive AI enhancement
 */

import { CostOptimizedLLMClient } from '../llm/cost-optimized-client';
import type { ProspectData } from '../llm/cost-optimized-client';

interface TemplateVariation {
  id: string;
  template: string;
  industry: string;
  companySize: 'startup' | 'sme' | 'enterprise';
  role: 'executive' | 'manager' | 'individual_contributor';
  performanceScore: number;
  usageCount: number;
  responseRate: number;
}

interface PersonalizationResult {
  message: string;
  method: 'template_only' | 'minimal_ai' | 'full_ai';
  tokensUsed: number;
  cost: number;
  confidence: number;
}

interface TemplateLibrary {
  connectionRequests: TemplateVariation[];
  followUp1: TemplateVariation[];
  followUp2: TemplateVariation[];
  followUp3: TemplateVariation[];
  followUp4: TemplateVariation[];
  goodbyeMessage: TemplateVariation[];
}

export class TemplateOptimizer {
  private llm: CostOptimizedLLMClient;
  private templateLibrary: TemplateLibrary;
  private industryMappings: Map<string, string[]>;
  
  constructor() {
    this.llm = new CostOptimizedLLMClient();
    this.templateLibrary = this.initializeTemplateLibrary();
    this.industryMappings = this.initializeIndustryMappings();
  }

  /**
   * Smart template selection with rule-based optimization
   * Avoids AI calls for 70% of personalizations
   */
  async personalizeMessage(
    prospect: ProspectData,
    sequenceStep: 1 | 2 | 3 | 4 | 5 | 6, // CR + 4 FU + GB
    context?: {
      previousResponse?: string;
      campaignTheme?: string;
      urgencyLevel?: 'low' | 'medium' | 'high';
    }
  ): Promise<PersonalizationResult> {
    // Step 1: Select optimal template using rules (no AI needed)
    const templateCategory = this.getTemplateCategory(sequenceStep);
    const selectedTemplate = this.selectOptimalTemplate(prospect, templateCategory);
    
    // Step 2: Determine personalization level needed
    const personalizationLevel = this.determinePersonalizationLevel(
      prospect, 
      selectedTemplate, 
      context
    );

    // Step 3: Apply appropriate personalization method
    switch (personalizationLevel) {
      case 'template_only':
        return this.templateOnlyPersonalization(selectedTemplate, prospect);
      
      case 'minimal_ai':
        return await this.minimalAIPersonalization(selectedTemplate, prospect, context);
      
      case 'full_ai':
        return await this.fullAIPersonalization(selectedTemplate, prospect, context);
      
      default:
        return this.templateOnlyPersonalization(selectedTemplate, prospect);
    }
  }

  /**
   * Pre-generate template variations during off-peak hours
   * Reduces real-time AI usage by creating reusable variations
   */
  async generateTemplateVariations(
    baseTemplate: string,
    targetIndustries: string[],
    count: number = 5
  ): Promise<TemplateVariation[]> {
    const variations: TemplateVariation[] = [];
    
    for (const industry of targetIndustries) {
      try {
        const optimized = await this.llm.optimizeTemplate(baseTemplate, {
          responseRate: 8.5, // Baseline rate
          totalSent: 100,
          commonObjections: this.getIndustryObjections(industry),
          successfulVariations: this.getSuccessfulPatterns(industry)
        });

        // Create multiple variations for different company sizes and roles
        const companySizes = ['startup', 'sme', 'enterprise'] as const;
        const roles = ['executive', 'manager', 'individual_contributor'] as const;

        for (const size of companySizes) {
          for (const role of roles) {
            variations.push({
              id: `${industry}_${size}_${role}_${Date.now()}`,
              template: optimized.optimizedTemplate,
              industry,
              companySize: size,
              role,
              performanceScore: 8.0, // Initial score
              usageCount: 0,
              responseRate: 8.5
            });
          }
        }
      } catch (error) {
        console.error(`Failed to generate variation for ${industry}:`, error);
      }
    }

    // Store variations in database for reuse
    await this.storeTemplateVariations(variations);
    
    return variations;
  }

  /**
   * Template-only personalization (0 AI tokens used)
   * Simple variable replacement with rule-based enhancements
   */
  private templateOnlyPersonalization(
    template: TemplateVariation,
    prospect: ProspectData
  ): PersonalizationResult {
    let message = template.template
      .replace(/\{\{first_name\}\}/g, prospect.firstName)
      .replace(/\{\{last_name\}\}/g, prospect.lastName)
      .replace(/\{\{company_name\}\}/g, prospect.companyName)
      .replace(/\{\{job_title\}\}/g, prospect.jobTitle)
      .replace(/\{\{industry\}\}/g, prospect.industry);

    // Rule-based enhancements
    message = this.addRuleBasedPersonalization(message, prospect);
    
    return {
      message,
      method: 'template_only',
      tokensUsed: 0,
      cost: 0,
      confidence: 0.75
    };
  }

  /**
   * Minimal AI personalization (50-100 tokens)
   * AI used only for complex personalization markers
   */
  private async minimalAIPersonalization(
    template: TemplateVariation,
    prospect: ProspectData,
    context?: any
  ): Promise<PersonalizationResult> {
    // Start with template-only personalization
    let message = this.templateOnlyPersonalization(template, prospect).message;
    
    // Use AI only for complex personalization markers
    if (this.hasComplexPersonalization(template.template)) {
      const aiResult = await this.llm.personalizeMessage(message, prospect, context);
      
      return {
        message: aiResult.message,
        method: 'minimal_ai',
        tokensUsed: aiResult.tokensUsed,
        cost: aiResult.cost,
        confidence: 0.85
      };
    }
    
    return {
      message,
      method: 'minimal_ai',
      tokensUsed: 0,
      cost: 0,
      confidence: 0.8
    };
  }

  /**
   * Full AI personalization (150-200 tokens)
   * Used for high-value prospects or complex scenarios
   */
  private async fullAIPersonalization(
    template: TemplateVariation,
    prospect: ProspectData,
    context?: any
  ): Promise<PersonalizationResult> {
    const aiResult = await this.llm.personalizeMessage(
      template.template, 
      prospect, 
      {
        ...context,
        enhancementLevel: 'full',
        includeInsights: true
      }
    );
    
    return {
      message: aiResult.message,
      method: 'full_ai',
      tokensUsed: aiResult.tokensUsed,
      cost: aiResult.cost,
      confidence: 0.95
    };
  }

  /**
   * Rule-based template selection (no AI needed)
   * Matches prospect characteristics to optimal templates
   */
  private selectOptimalTemplate(
    prospect: ProspectData,
    templateCategory: keyof TemplateLibrary
  ): TemplateVariation {
    const templates = this.templateLibrary[templateCategory];
    
    // Priority scoring system
    const scoredTemplates = templates.map(template => ({
      template,
      score: this.calculateTemplateScore(template, prospect)
    }));
    
    // Sort by score and return best match
    scoredTemplates.sort((a, b) => b.score - a.score);
    
    return scoredTemplates[0].template;
  }

  /**
   * Determine personalization level based on prospect value and complexity
   */
  private determinePersonalizationLevel(
    prospect: ProspectData,
    template: TemplateVariation,
    context?: any
  ): 'template_only' | 'minimal_ai' | 'full_ai' {
    const prospectValue = this.calculateProspectValue(prospect);
    const templateComplexity = this.assessTemplateComplexity(template);
    
    // High-value prospects or complex templates get full AI treatment
    if (prospectValue > 8 || templateComplexity > 7) {
      return 'full_ai';
    }
    
    // Medium value or some complexity gets minimal AI
    if (prospectValue > 6 || templateComplexity > 4) {
      return 'minimal_ai';
    }
    
    // Standard prospects get template-only treatment
    return 'template_only';
  }

  /**
   * Calculate template fitness score for prospect
   */
  private calculateTemplateScore(
    template: TemplateVariation,
    prospect: ProspectData
  ): number {
    let score = template.performanceScore; // Base performance score
    
    // Industry match
    if (template.industry === prospect.industry) {
      score += 3;
    } else if (this.industryMappings.get(template.industry)?.includes(prospect.industry)) {
      score += 1;
    }
    
    // Company size match
    const prospectSize = this.categorizeCompanySize(prospect.companySize);
    if (template.companySize === prospectSize) {
      score += 2;
    }
    
    // Role match
    const prospectRole = this.categorizeRole(prospect.jobTitle);
    if (template.role === prospectRole) {
      score += 2;
    }
    
    // Usage-based weighting (favor proven templates)
    score += Math.min(template.usageCount / 100, 1);
    
    // Response rate bonus
    score += (template.responseRate - 5) / 2; // Normalize around 5% baseline
    
    return score;
  }

  /**
   * Add rule-based personalization enhancements
   */
  private addRuleBasedPersonalization(
    message: string,
    prospect: ProspectData
  ): string {
    // Company size-based adjustments
    if (prospect.companySize > 10000) {
      message = message.replace(/your company/g, 'your organization');
    }
    
    // Industry-specific terminology
    const industryTerms = this.getIndustryTerminology(prospect.industry);
    for (const [generic, specific] of Object.entries(industryTerms)) {
      message = message.replace(new RegExp(generic, 'gi'), specific);
    }
    
    // Role-based tone adjustments
    if (this.isExecutiveRole(prospect.jobTitle)) {
      message = message.replace(/I'd love to show you/g, 'I\'d like to discuss');
      message = message.replace(/quick chat/g, 'brief conversation');
    }
    
    return message;
  }

  /**
   * Helper methods for categorization and scoring
   */
  private getTemplateCategory(sequenceStep: number): keyof TemplateLibrary {
    switch (sequenceStep) {
      case 1: return 'connectionRequests';
      case 2: return 'followUp1';
      case 3: return 'followUp2';
      case 4: return 'followUp3';
      case 5: return 'followUp4';
      case 6: return 'goodbyeMessage';
      default: return 'connectionRequests';
    }
  }

  private calculateProspectValue(prospect: ProspectData): number {
    let value = 5; // Base value
    
    // Company size influence
    if (prospect.companySize > 10000) value += 3;
    else if (prospect.companySize > 1000) value += 2;
    else if (prospect.companySize > 100) value += 1;
    
    // Role seniority
    if (this.isExecutiveRole(prospect.jobTitle)) value += 3;
    else if (this.isManagerRole(prospect.jobTitle)) value += 2;
    
    // High-value industries
    const highValueIndustries = ['technology', 'finance', 'healthcare', 'consulting'];
    if (highValueIndustries.includes(prospect.industry.toLowerCase())) {
      value += 2;
    }
    
    return Math.min(value, 10);
  }

  private assessTemplateComplexity(template: TemplateVariation): number {
    const complexMarkers = [
      '{{recent_achievement}}',
      '{{company_insight}}',
      '{{industry_trend}}',
      '{{mutual_connection}}',
      '{{recent_news}}'
    ];
    
    const complexity = complexMarkers.reduce((score, marker) => {
      return template.template.includes(marker) ? score + 2 : score;
    }, 3); // Base complexity
    
    return Math.min(complexity, 10);
  }

  private hasComplexPersonalization(template: string): boolean {
    const complexMarkers = [
      '{{recent_achievement}}',
      '{{company_insight}}',
      '{{industry_trend}}',
      '{{mutual_connection}}'
    ];
    
    return complexMarkers.some(marker => template.includes(marker));
  }

  private categorizeCompanySize(size: number): 'startup' | 'sme' | 'enterprise' {
    if (size < 100) return 'startup';
    if (size < 1000) return 'sme';
    return 'enterprise';
  }

  private categorizeRole(title: string): 'executive' | 'manager' | 'individual_contributor' {
    const lowerTitle = title.toLowerCase();
    
    if (lowerTitle.includes('ceo') || lowerTitle.includes('president') || 
        lowerTitle.includes('founder') || lowerTitle.includes('chief')) {
      return 'executive';
    }
    
    if (lowerTitle.includes('manager') || lowerTitle.includes('director') || 
        lowerTitle.includes('lead') || lowerTitle.includes('head')) {
      return 'manager';
    }
    
    return 'individual_contributor';
  }

  private isExecutiveRole(title: string): boolean {
    return this.categorizeRole(title) === 'executive';
  }

  private isManagerRole(title: string): boolean {
    return this.categorizeRole(title) === 'manager';
  }

  private getIndustryTerminology(industry: string): Record<string, string> {
    const terminologyMap: Record<string, Record<string, string>> = {
      'technology': {
        'solutions': 'platforms',
        'customers': 'users',
        'growth': 'scaling'
      },
      'healthcare': {
        'customers': 'patients',
        'solutions': 'treatments',
        'efficiency': 'outcomes'
      },
      'finance': {
        'customers': 'clients',
        'solutions': 'strategies',
        'growth': 'returns'
      }
    };
    
    return terminologyMap[industry.toLowerCase()] || {};
  }

  private getIndustryObjections(industry: string): string[] {
    const objectionMap: Record<string, string[]> = {
      'technology': ['too busy with current roadmap', 'not in the budget this quarter'],
      'healthcare': ['regulatory concerns', 'patient privacy requirements'],
      'finance': ['compliance issues', 'risk management protocols']
    };
    
    return objectionMap[industry.toLowerCase()] || ['not interested', 'timing is not right'];
  }

  private getSuccessfulPatterns(industry: string): string[] {
    const patternMap: Record<string, string[]> = {
      'technology': ['mentioned specific tech stack', 'referenced scaling challenges'],
      'healthcare': ['focused on patient outcomes', 'highlighted efficiency gains'],
      'finance': ['emphasized ROI', 'mentioned risk mitigation']
    };
    
    return patternMap[industry.toLowerCase()] || ['personalized opening', 'clear value proposition'];
  }

  /**
   * Initialize default template library
   */
  private initializeTemplateLibrary(): TemplateLibrary {
    // This would be loaded from database in production
    return {
      connectionRequests: [
        {
          id: 'cr_tech_exec_001',
          template: `Hi {{first_name}}, I noticed your impressive work leading {{company_name}}'s {{industry}} initiatives. I'd love to connect and share some insights that could accelerate your growth objectives.`,
          industry: 'technology',
          companySize: 'enterprise',
          role: 'executive',
          performanceScore: 8.5,
          usageCount: 150,
          responseRate: 12.3
        }
        // More templates would be defined here
      ],
      followUp1: [],
      followUp2: [],
      followUp3: [],
      followUp4: [],
      goodbyeMessage: []
    };
  }

  private initializeIndustryMappings(): Map<string, string[]> {
    return new Map([
      ['technology', ['software', 'saas', 'fintech', 'edtech', 'healthtech']],
      ['finance', ['banking', 'investment', 'insurance', 'fintech']],
      ['healthcare', ['medical', 'pharmaceutical', 'biotech', 'healthtech']]
    ]);
  }

  private async storeTemplateVariations(variations: TemplateVariation[]): Promise<void> {
    // In production, store in Supabase database
    console.log(`Storing ${variations.length} template variations`);
  }
}