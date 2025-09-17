/**
 * SAM Prospect Research & Lead Scoring Service
 * Researches prospects via LinkedIn, company websites, and scores against our ICP
 * Provides intelligent context for SAM's response generation
 */

export interface ProspectProfile {
  name: string;
  email?: string;
  linkedinUrl?: string;
  company: string;
  title: string;
  location?: string;
  industry?: string;
  companySize?: string;
  websiteUrl?: string;
  bio?: string;
  recentActivity?: string[];
}

export interface CompanyProfile {
  name: string;
  website?: string;
  linkedinUrl?: string;
  industry?: string;
  size?: string;
  location?: string;
  description?: string;
  technologies?: string[];
  fundingStage?: string;
  recentNews?: string[];
  painPoints?: string[];
}

export interface LeadScore {
  overall: number; // 0-100
  fitScore: number; // How well they match our ICP
  intentScore: number; // Level of buying intent
  timingScore: number; // Timing likelihood
  breakdown: {
    company_size: number;
    industry_match: number;
    technology_stack: number;
    growth_signals: number;
    engagement_level: number;
    budget_indicators: number;
    lead_source_quality: number; // New: quality of lead source
  };
  reasoning: string[];
  redFlags: string[];
  opportunities: string[];
  leadSource: 'inbound' | 'campaign' | 'referral' | 'organic';
  sourceQuality: 'high' | 'medium' | 'low';
}

export interface ResearchResult {
  prospect: ProspectProfile;
  company: CompanyProfile;
  leadScore: LeadScore;
  keyInsights: string[];
  suggestedApproach: string;
  personalizedHooks: string[];
  confidence: number; // 0-1 research confidence
  researchedAt: string;
}

export class ProspectResearcher {
  private researchSources = {
    linkedin: true,
    website: true,
    apollo: false, // TODO: Add Apollo integration
    clearbit: false, // TODO: Add Clearbit integration
    publicNews: true
  };

  /**
   * Conduct comprehensive prospect research for any lead source
   */
  async researchProspect(
    senderName: string,
    senderEmail?: string,
    originalMessage?: string,
    platform?: string,
    leadSource?: 'inbound' | 'campaign' | 'referral' | 'organic'
  ): Promise<ResearchResult> {
    console.log('🔍 Starting comprehensive prospect research for:', senderName, { leadSource, platform });

    try {
      // 1. Determine lead source and quality
      const detectedSource = leadSource || this.detectLeadSource(platform, originalMessage);
      const sourceQuality = this.assessSourceQuality(detectedSource, platform, originalMessage);
      
      // 2. Extract basic information with source context
      const basicInfo = this.extractBasicInfo(senderName, senderEmail, originalMessage, detectedSource);
      
      // 3. Research prospect profile
      const prospectProfile = await this.researchProspectProfile(basicInfo);
      
      // 4. Research company profile
      const companyProfile = await this.researchCompanyProfile(prospectProfile.company);
      
      // 5. Score the lead against our ICP with source weighting
      const leadScore = await this.scoreProspect(prospectProfile, companyProfile, originalMessage, sourceQuality);
      
      // 6. Generate insights and personalized approach
      const insights = this.generateInsights(prospectProfile, companyProfile, leadScore);
      
      const result: ResearchResult = {
        prospect: prospectProfile,
        company: companyProfile,
        leadScore,
        keyInsights: insights.keyInsights,
        suggestedApproach: insights.suggestedApproach,
        personalizedHooks: insights.personalizedHooks,
        confidence: insights.confidence,
        researchedAt: new Date().toISOString()
      };

      console.log('✅ Prospect research completed:', {
        name: senderName,
        company: prospectProfile.company,
        overallScore: leadScore.overall,
        leadSource: detectedSource,
        sourceQuality,
        confidence: result.confidence
      });

      return result;

    } catch (error) {
      console.error('❌ Prospect research failed:', error);
      
      // Return minimal fallback data
      return this.createFallbackResult(senderName, senderEmail, originalMessage);
    }
  }

  /**
   * Research inbound website leads (contact forms, chat, etc.)
   */
  async researchInboundLead(
    contactData: {
      name: string;
      email?: string;
      company?: string;
      message?: string;
      source?: string; // 'contact-form', 'chat', 'demo-request', etc.
      phone?: string;
      website?: string;
    }
  ): Promise<ResearchResult> {
    console.log('📞 Researching inbound lead:', contactData.name, { source: contactData.source });
    
    return this.researchProspect(
      contactData.name,
      contactData.email,
      contactData.message,
      contactData.source,
      'inbound'
    );
  }

  /**
   * Extract basic information from available data with source context
   */
  private extractBasicInfo(name: string, email?: string, message?: string, leadSource?: string) {
    console.log('📊 Extracting basic prospect information...', { leadSource });
    
    const company = this.extractCompanyFromEmail(email) || this.extractCompanyFromMessage(message) || 'Unknown Company';
    const title = this.extractTitleFromMessage(message) || 'Unknown Title';
    const industry = this.extractIndustryHints(message, company);
    
    return {
      name,
      email,
      company,
      title,
      industry,
      message,
      leadSource
    };
  }

  /**
   * Detect lead source from platform and message context
   */
  private detectLeadSource(platform?: string, message?: string): 'inbound' | 'campaign' | 'referral' | 'organic' {
    if (!platform) return 'organic';
    
    // Inbound sources
    if (['contact-form', 'chat', 'demo-request', 'website', 'calendar'].includes(platform)) {
      return 'inbound';
    }
    
    // Campaign sources  
    if (['linkedin', 'email', 'gmail', 'outlook'].includes(platform)) {
      return 'campaign';
    }
    
    // Check message content for referral indicators
    if (message && (message.includes('referred') || message.includes('recommended'))) {
      return 'referral';
    }
    
    return 'organic';
  }

  /**
   * Assess quality of lead source
   */
  private assessSourceQuality(
    leadSource: 'inbound' | 'campaign' | 'referral' | 'organic',
    platform?: string,
    message?: string
  ): 'high' | 'medium' | 'low' {
    
    // Inbound leads are generally higher quality (they came to us)
    if (leadSource === 'inbound') {
      if (platform === 'demo-request' || platform === 'calendar') return 'high';
      if (platform === 'contact-form') return 'medium';
      if (platform === 'chat') return 'medium';
      return 'medium';
    }
    
    // Referrals are highest quality
    if (leadSource === 'referral') {
      return 'high';
    }
    
    // Campaign responses vary by engagement
    if (leadSource === 'campaign') {
      const messageLength = message?.length || 0;
      if (messageLength > 100) return 'medium'; // Detailed response
      if (messageLength > 50) return 'low'; // Brief response
      return 'low'; // Very brief or no response
    }
    
    // Organic is variable
    return 'medium';
  }

  /**
   * Research prospect's LinkedIn profile and professional background
   */
  private async researchProspectProfile(basicInfo: any): Promise<ProspectProfile> {
    console.log('👤 Researching prospect profile...');
    
    // TODO: Integrate with LinkedIn API or Apollo
    // For now, return enhanced mock data based on available information
    
    return {
      name: basicInfo.name,
      email: basicInfo.email,
      company: basicInfo.company,
      title: basicInfo.title,
      industry: basicInfo.industry,
      location: 'Unknown', // TODO: Extract from LinkedIn
      bio: 'Professional in ' + basicInfo.industry, // TODO: Get real bio
      recentActivity: [
        'Posted about digital transformation',
        'Shared article on AI automation',
        'Updated job title recently'
      ]
    };
  }

  /**
   * Research company profile, website, and LinkedIn company page
   */
  private async researchCompanyProfile(companyName: string): Promise<CompanyProfile> {
    console.log('🏢 Researching company profile for:', companyName);
    
    // TODO: Integrate with website scraping and company databases
    // For now, return intelligent mock data
    
    const industryGuess = this.guessIndustryFromName(companyName);
    const sizeGuess = this.guessSizeFromName(companyName);
    
    return {
      name: companyName,
      industry: industryGuess,
      size: sizeGuess,
      description: `${companyName} is a ${industryGuess} company`,
      technologies: this.guessTechStack(industryGuess),
      painPoints: this.identifyPainPoints(industryGuess),
      recentNews: [
        'Expanding digital initiatives',
        'Looking for automation solutions',
        'Hiring for tech roles'
      ]
    };
  }

  /**
   * Score prospect against our Ideal Customer Profile (ICP)
   */
  private async scoreProspect(
    prospect: ProspectProfile, 
    company: CompanyProfile, 
    originalMessage?: string,
    leadSourceQuality?: 'high' | 'medium' | 'low'
  ): Promise<LeadScore> {
    console.log('🎯 Scoring prospect against ICP...');
    
    // Define our ICP criteria (should be configurable)
    const icpCriteria = {
      targetIndustries: ['technology', 'saas', 'fintech', 'healthcare', 'manufacturing'],
      targetCompanySizes: ['startup', 'small', 'medium', 'enterprise'],
      targetTitles: ['ceo', 'cto', 'vp', 'director', 'head', 'founder'],
      buyingSignals: ['automation', 'ai', 'efficiency', 'scale', 'digital transformation']
    };

    // Calculate component scores
    const companySize = this.scoreCompanySize(company.size, icpCriteria.targetCompanySizes);
    const industryMatch = this.scoreIndustryMatch(company.industry, icpCriteria.targetIndustries);
    const technologyStack = this.scoreTechStack(company.technologies);
    const growthSignals = this.scoreGrowthSignals(company.recentNews);
    const engagementLevel = this.scoreEngagement(originalMessage);
    const budgetIndicators = this.scoreBudgetIndicators(company.size, company.fundingStage);
    const leadSourceQualityScore = this.scoreLeadSourceQuality(leadSourceQuality);

    const breakdown = {
      company_size: companySize,
      industry_match: industryMatch,
      technology_stack: technologyStack,
      growth_signals: growthSignals,
      engagement_level: engagementLevel,
      budget_indicators: budgetIndicators,
      lead_source_quality: leadSourceQualityScore
    };

    // Calculate weighted overall score (give higher weight to lead source quality for inbound leads)
    const weights = { 
      company_size: 0.18, 
      industry_match: 0.22, 
      technology_stack: 0.13, 
      growth_signals: 0.13, 
      engagement_level: 0.13, 
      budget_indicators: 0.08,
      lead_source_quality: 0.13  // Higher weight for inbound leads
    };
    
    const overall = Math.round(
      Object.entries(breakdown).reduce((sum, [key, score]) => 
        sum + (score * weights[key as keyof typeof weights]), 0)
    );

    // Generate reasoning and insights
    const reasoning = this.generateScoreReasoning(breakdown, prospect, company);
    const redFlags = this.identifyRedFlags(prospect, company, breakdown);
    const opportunities = this.identifyOpportunities(prospect, company, breakdown);

    return {
      overall,
      fitScore: Math.round((industryMatch + companySize) / 2),
      intentScore: Math.round((engagementLevel + growthSignals) / 2),
      timingScore: Math.round((budgetIndicators + growthSignals + engagementLevel) / 3),
      breakdown,
      reasoning,
      redFlags,
      opportunities,
      leadSource: 'inbound',
      sourceQuality: 'high'
    };
  }

  /**
   * Generate insights and personalized approach
   */
  private generateInsights(prospect: ProspectProfile, company: CompanyProfile, score: LeadScore) {
    console.log('💡 Generating insights and personalized approach...');
    
    const keyInsights = [
      `${prospect.name} is a ${prospect.title} at ${company.name} (${company.industry})`,
      `Company size: ${company.size} - ${score.overall >= 70 ? 'Strong' : score.overall >= 50 ? 'Moderate' : 'Low'} ICP fit`,
      `Lead score: ${score.overall}/100 - ${this.getScoreCategory(score.overall)}`,
      ...score.opportunities.slice(0, 2)
    ];

    const suggestedApproach = this.getSuggestedApproach(score.overall, prospect, company);
    
    const personalizedHooks = [
      `Industry expertise in ${company.industry}`,
      `Solutions for ${company.size} companies`,
      ...company.painPoints.slice(0, 2).map(pain => `Addressing ${pain}`)
    ];

    const confidence = this.calculateConfidence(prospect, company);

    return {
      keyInsights,
      suggestedApproach,
      personalizedHooks,
      confidence
    };
  }

  // Helper methods for scoring and analysis
  private scoreCompanySize(size?: string, targets: string[] = []): number {
    if (!size) return 50;
    const normalized = size.toLowerCase();
    if (targets.some(target => normalized.includes(target))) return 85;
    if (normalized.includes('enterprise') || normalized.includes('large')) return 90;
    if (normalized.includes('medium') || normalized.includes('mid')) return 80;
    if (normalized.includes('small') || normalized.includes('startup')) return 75;
    return 60;
  }

  private scoreIndustryMatch(industry?: string, targets: string[] = []): number {
    if (!industry) return 50;
    const normalized = industry.toLowerCase();
    return targets.some(target => normalized.includes(target)) ? 90 : 60;
  }

  private scoreTechStack(technologies?: string[]): number {
    if (!technologies) return 50;
    const modernTech = ['cloud', 'api', 'saas', 'ai', 'automation', 'digital'];
    const hasModernTech = technologies.some(tech => 
      modernTech.some(modern => tech.toLowerCase().includes(modern))
    );
    return hasModernTech ? 80 : 60;
  }

  private scoreGrowthSignals(news?: string[]): number {
    if (!news) return 50;
    const growthSignals = ['expansion', 'hiring', 'funding', 'growth', 'scaling'];
    const hasGrowthSignals = news.some(item => 
      growthSignals.some(signal => item.toLowerCase().includes(signal))
    );
    return hasGrowthSignals ? 85 : 55;
  }

  private scoreEngagement(message?: string): number {
    if (!message) return 40;
    const messageLength = message.length;
    const hasSpecifics = message.toLowerCase().includes('specific') || 
                       message.toLowerCase().includes('custom') ||
                       message.toLowerCase().includes('integration');
    
    let score = 50;
    if (messageLength > 100) score += 20;
    if (hasSpecifics) score += 20;
    if (message.includes('?')) score += 10; // They asked questions
    
    return Math.min(score, 100);
  }

  private scoreBudgetIndicators(size?: string, funding?: string): number {
    if (funding && funding.includes('funded')) return 85;
    if (size && (size.includes('enterprise') || size.includes('large'))) return 80;
    if (size && size.includes('medium')) return 70;
    return 60;
  }

  private scoreLeadSourceQuality(quality?: 'high' | 'medium' | 'low'): number {
    // Score lead source quality - inbound leads get higher scores
    switch (quality) {
      case 'high':   return 85; // Demo requests, referrals, calendar bookings
      case 'medium': return 70; // Contact forms, chat inquiries, organic LinkedIn
      case 'low':    return 55; // Campaign responses, cold outbound
      default:       return 65; // Unknown source - neutral score
    }
  }

  // Utility methods
  private extractCompanyFromEmail(email?: string): string | null {
    if (!email || !email.includes('@')) return null;
    const domain = email.split('@')[1];
    if (['gmail.com', 'outlook.com', 'yahoo.com', 'hotmail.com'].includes(domain)) return null;
    return domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1);
  }

  private extractCompanyFromMessage(message?: string): string | null {
    if (!message) return null;
    // Simple pattern matching for company mentions
    const companyPattern = /(?:at|from|with)\s+([A-Z][a-zA-Z0-9\s&]+?)(?:\.|,|\s+(?:and|where|that|which))/;
    const match = message.match(companyPattern);
    return match ? match[1].trim() : null;
  }

  private extractTitleFromMessage(message?: string): string | null {
    if (!message) return null;
    const titlePatterns = [
      /I'm\s+(?:a|an|the)\s+([A-Z][a-zA-Z\s]+?)(?:\s+at|\s+with|\.)/,
      /as\s+(?:a|an|the)\s+([A-Z][a-zA-Z\s]+?)(?:\s+at|\s+with|\.)/
    ];
    
    for (const pattern of titlePatterns) {
      const match = message.match(pattern);
      if (match) return match[1].trim();
    }
    return null;
  }

  private extractIndustryHints(message?: string, company?: string): string {
    const techKeywords = ['software', 'tech', 'digital', 'ai', 'automation', 'saas'];
    const financeKeywords = ['finance', 'fintech', 'banking', 'investment'];
    const healthKeywords = ['health', 'medical', 'pharma', 'biotech'];
    
    const text = `${message || ''} ${company || ''}`.toLowerCase();
    
    if (techKeywords.some(kw => text.includes(kw))) return 'technology';
    if (financeKeywords.some(kw => text.includes(kw))) return 'finance';
    if (healthKeywords.some(kw => text.includes(kw))) return 'healthcare';
    
    return 'business services';
  }

  private guessIndustryFromName(company: string): string {
    const name = company.toLowerCase();
    if (name.includes('tech') || name.includes('soft') || name.includes('digital')) return 'technology';
    if (name.includes('health') || name.includes('med') || name.includes('bio')) return 'healthcare';
    if (name.includes('fin') || name.includes('bank') || name.includes('capital')) return 'finance';
    return 'business services';
  }

  private guessSizeFromName(company: string): string {
    const name = company.toLowerCase();
    if (name.includes('enterprise') || name.includes('corp') || name.includes('inc')) return 'large';
    if (name.includes('startup') || name.includes('labs')) return 'startup';
    return 'medium';
  }

  private guessTechStack(industry: string): string[] {
    const stacks = {
      technology: ['cloud', 'api', 'microservices', 'docker', 'kubernetes'],
      finance: ['blockchain', 'api', 'security', 'compliance', 'cloud'],
      healthcare: ['compliance', 'security', 'api', 'data analytics'],
      default: ['web', 'mobile', 'api', 'cloud']
    };
    return stacks[industry as keyof typeof stacks] || stacks.default;
  }

  private identifyPainPoints(industry: string): string[] {
    const painPoints = {
      technology: ['scaling challenges', 'technical debt', 'team productivity'],
      finance: ['regulatory compliance', 'security concerns', 'operational efficiency'],
      healthcare: ['patient data management', 'compliance requirements', 'workflow optimization'],
      default: ['operational efficiency', 'growth challenges', 'resource constraints']
    };
    return painPoints[industry as keyof typeof painPoints] || painPoints.default;
  }

  private generateScoreReasoning(breakdown: any, prospect: ProspectProfile, company: CompanyProfile): string[] {
    const reasoning = [];
    
    if (breakdown.industry_match >= 80) reasoning.push(`Strong industry fit (${company.industry})`);
    if (breakdown.company_size >= 80) reasoning.push(`Good company size match (${company.size})`);
    if (breakdown.engagement_level >= 70) reasoning.push('High engagement in initial message');
    if (breakdown.technology_stack >= 75) reasoning.push('Modern technology stack indicates readiness');
    if (breakdown.growth_signals >= 80) reasoning.push('Strong growth signals detected');
    
    return reasoning;
  }

  private identifyRedFlags(prospect: ProspectProfile, company: CompanyProfile, breakdown: any): string[] {
    const redFlags = [];
    
    if (breakdown.budget_indicators < 50) redFlags.push('Limited budget indicators');
    if (breakdown.company_size < 40) redFlags.push('Company size may be too small');
    if (breakdown.industry_match < 50) redFlags.push('Industry not in primary target market');
    if (breakdown.engagement_level < 40) redFlags.push('Low engagement in initial contact');
    
    return redFlags;
  }

  private identifyOpportunities(prospect: ProspectProfile, company: CompanyProfile, breakdown: any): string[] {
    const opportunities = [];
    
    if (breakdown.growth_signals >= 70) opportunities.push('Company in growth phase - good timing');
    if (breakdown.technology_stack >= 70) opportunities.push('Tech-forward company - likely to adopt AI');
    if (breakdown.engagement_level >= 70) opportunities.push('Highly engaged prospect - warm lead');
    if (company.painPoints.length > 0) opportunities.push(`Address key pain point: ${company.painPoints[0]}`);
    
    return opportunities;
  }

  private getScoreCategory(score: number): string {
    if (score >= 80) return 'Hot Lead';
    if (score >= 65) return 'Warm Lead';
    if (score >= 50) return 'Qualified Lead';
    return 'Cold Lead';
  }

  private getSuggestedApproach(score: number, prospect: ProspectProfile, company: CompanyProfile): string {
    if (score >= 80) {
      return `High-priority lead: Personalized approach focusing on ${company.industry} expertise and ${company.size} company solutions. Schedule demo quickly.`;
    } else if (score >= 65) {
      return `Warm lead: Educational approach with case studies from ${company.industry}. Build relationship before proposing solution.`;
    } else if (score >= 50) {
      return `Qualified lead: Nurture with valuable content. Focus on pain points like ${company.painPoints[0] || 'operational efficiency'}.`;
    } else {
      return `Cold lead: Long-term nurture campaign. Provide educational content and build trust over time.`;
    }
  }

  private calculateConfidence(prospect: ProspectProfile, company: CompanyProfile): number {
    let confidence = 0.5; // Base confidence
    
    if (prospect.email) confidence += 0.1;
    if (company.industry !== 'business services') confidence += 0.15; // We identified specific industry
    if (company.size !== 'medium') confidence += 0.1; // We identified specific size
    if (company.painPoints.length > 0) confidence += 0.15;
    
    return Math.min(confidence, 1.0);
  }

  private createFallbackResult(name: string, email?: string, message?: string): ResearchResult {
    return {
      prospect: {
        name,
        email,
        company: 'Unknown Company',
        title: 'Unknown Title',
        industry: 'business services'
      },
      company: {
        name: 'Unknown Company',
        industry: 'business services',
        size: 'medium',
        description: 'Company information not available',
        technologies: [],
        painPoints: ['operational efficiency']
      },
      leadScore: {
        overall: 50,
        fitScore: 50,
        intentScore: 40,
        timingScore: 45,
        breakdown: {
          company_size: 50,
          industry_match: 50,
          technology_stack: 50,
          growth_signals: 40,
          engagement_level: 40,
          budget_indicators: 50,
          lead_source_quality: 65
        },
        reasoning: ['Limited information available for scoring'],
        redFlags: ['Insufficient data for proper qualification'],
        opportunities: ['Need more research to identify opportunities'],
        leadSource: 'inbound',
        sourceQuality: 'low'
      },
      keyInsights: ['Limited prospect information available'],
      suggestedApproach: 'Gather more information before proceeding with outreach',
      personalizedHooks: ['General business solutions'],
      confidence: 0.3,
      researchedAt: new Date().toISOString()
    };
  }
}

// Singleton instance
export const prospectResearcher = new ProspectResearcher();