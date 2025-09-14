/**
 * Think Tool Integration for SAM AI Platform
 * 
 * Enhanced reasoning for complex sales workflows using step-by-step thinking
 * Based on Anthropic's Think tool best practices
 */

export interface ThinkingStep {
  step: number
  thought: string
  reasoning: string
  confidence: number
  dependencies: string[]
  next_steps: string[]
}

export interface ThinkingContext {
  problem: string
  constraints: string[]
  available_data: Record<string, any>
  success_criteria: string[]
  stakeholders: string[]
}

export interface ThinkingResult {
  final_recommendation: string
  reasoning_chain: ThinkingStep[]
  confidence_score: number
  risk_assessment: {
    high_risk_factors: string[]
    mitigation_strategies: string[]
  }
  implementation_plan: {
    phase: string
    actions: string[]
    timeline: string
    resources_needed: string[]
  }[]
  alternative_approaches: string[]
}

export class SalesThinkTool {
  private thinkingHistory: ThinkingResult[] = []

  /**
   * Complex prospect qualification using step-by-step thinking
   */
  async qualifyProspect(prospectData: any, salesContext: any): Promise<ThinkingResult> {
    const context: ThinkingContext = {
      problem: 'Determine if this prospect is qualified and ready for sales engagement',
      constraints: [
        'Limited prospect data available',
        'Sales team capacity constraints',
        'Budget and timeline requirements'
      ],
      available_data: {
        prospect: prospectData,
        sales_context: salesContext,
        market_conditions: 'current market analysis',
        company_fit: 'ICP scoring results'
      },
      success_criteria: [
        'High probability of closing (>60%)',
        'Fits ideal customer profile',
        'Has budget and authority',
        'Timeline aligns with sales cycles'
      ],
      stakeholders: ['Sales Rep', 'Sales Manager', 'Marketing', 'Customer Success']
    }

    const reasoningSteps: ThinkingStep[] = []

    // Step 1: Analyze prospect fit
    reasoningSteps.push({
      step: 1,
      thought: 'Analyzing prospect fit against ideal customer profile',
      reasoning: `Looking at company size (${prospectData.company?.size || 'unknown'}), industry (${prospectData.company?.industry || 'unknown'}), and role (${prospectData.title || 'unknown'}). Need to determine if this matches our successful customer patterns.`,
      confidence: 0.8,
      dependencies: ['ICP scoring', 'historical customer data'],
      next_steps: ['Calculate ICP score', 'Compare to successful deals']
    })

    // Step 2: Evaluate buying signals
    reasoningSteps.push({
      step: 2,
      thought: 'Evaluating buying signals and intent',
      reasoning: `Examining prospect behavior: website visits, content engagement, response patterns. Strong buying signals include: active research, stakeholder involvement, timeline discussions.`,
      confidence: 0.75,
      dependencies: ['behavioral data', 'engagement metrics'],
      next_steps: ['Score buying intent', 'Identify decision-making unit']
    })

    // Step 3: Assess MEDDIC criteria
    reasoningSteps.push({
      step: 3,
      thought: 'Applying MEDDIC qualification framework',
      reasoning: `Metrics: Can we quantify business impact? Economic Buyer: Is this person or can they access decision maker? Decision Criteria: Do we understand evaluation process? Decision Process: Timeline and stakeholders clear? Identify Pain: Problem urgency validated? Champion: Do we have internal advocate?`,
      confidence: 0.7,
      dependencies: ['conversation history', 'stakeholder mapping'],
      next_steps: ['Complete MEDDIC scorecard', 'Identify gaps']
    })

    // Step 4: Risk assessment
    reasoningSteps.push({
      step: 4,
      thought: 'Identifying risks and red flags',
      reasoning: `Potential risks: budget uncertainty, long decision cycles, multiple stakeholders, competitive pressure, unclear ROI, regulatory concerns. Each risk needs mitigation strategy.`,
      confidence: 0.85,
      dependencies: ['risk matrix', 'competitive analysis'],
      next_steps: ['Prioritize risks', 'Develop mitigation plans']
    })

    // Step 5: Final qualification decision
    reasoningSteps.push({
      step: 5,
      thought: 'Synthesizing all factors for qualification decision',
      reasoning: `Weighing ICP fit, buying signals, MEDDIC score, and risk factors. Need to balance opportunity size against probability of success and resource investment required.`,
      confidence: 0.9,
      dependencies: ['all previous steps'],
      next_steps: ['Make go/no-go decision', 'Define engagement strategy']
    })

    // Calculate overall confidence and recommendation
    const avgConfidence = reasoningSteps.reduce((sum, step) => sum + step.confidence, 0) / reasoningSteps.length
    const icpScore = this.calculateICPScore(prospectData)
    const buyingSignalStrength = this.assessBuyingSignals(prospectData)
    
    const qualification = icpScore > 0.7 && buyingSignalStrength > 0.6 ? 'QUALIFIED' : 'NOT_QUALIFIED'

    const result: ThinkingResult = {
      final_recommendation: qualification === 'QUALIFIED' 
        ? `QUALIFIED: High-potential prospect with ${Math.round(icpScore * 100)}% ICP fit and strong buying signals. Recommend immediate sales engagement with focus on ${this.identifyPrimaryPainPoint(prospectData)}.`
        : `NOT_QUALIFIED: Prospect does not meet qualification threshold. ICP Score: ${Math.round(icpScore * 100)}%, Buying Signals: ${Math.round(buyingSignalStrength * 100)}%. Consider nurturing campaign instead.`,
      reasoning_chain: reasoningSteps,
      confidence_score: avgConfidence,
      risk_assessment: {
        high_risk_factors: this.identifyRiskFactors(prospectData, qualification),
        mitigation_strategies: this.generateMitigationStrategies(prospectData, qualification)
      },
      implementation_plan: this.generateImplementationPlan(qualification, prospectData),
      alternative_approaches: this.suggestAlternativeApproaches(qualification, prospectData)
    }

    this.thinkingHistory.push(result)
    return result
  }

  /**
   * Complex deal strategy using step-by-step thinking
   */
  async developDealStrategy(dealData: any, competitiveContext: any): Promise<ThinkingResult> {
    const context: ThinkingContext = {
      problem: 'Develop winning strategy for complex B2B deal',
      constraints: [
        'Competitive environment',
        'Multiple stakeholders with different priorities',
        'Budget and timeline pressures',
        'Technical and business requirements'
      ],
      available_data: {
        deal: dealData,
        competition: competitiveContext,
        stakeholders: dealData.stakeholders || [],
        requirements: dealData.requirements || {}
      },
      success_criteria: [
        'Win probability >70%',
        'Profitable deal structure',
        'Strategic account value',
        'Reference-worthy implementation'
      ],
      stakeholders: ['Sales Rep', 'Sales Engineer', 'Account Manager', 'Executive Sponsor']
    }

    const reasoningSteps: ThinkingStep[] = []

    // Step 1: Stakeholder analysis
    reasoningSteps.push({
      step: 1,
      thought: 'Mapping decision-making unit and stakeholder influence',
      reasoning: `Identifying all stakeholders, their priorities, influence levels, and decision criteria. Economic buyer vs technical evaluators vs end users have different success metrics.`,
      confidence: 0.85,
      dependencies: ['stakeholder interviews', 'org chart analysis'],
      next_steps: ['Create influence map', 'Identify champions and detractors']
    })

    // Step 2: Competitive positioning
    reasoningSteps.push({
      step: 2,
      thought: 'Analyzing competitive landscape and differentiation',
      reasoning: `Understanding competitor strengths/weaknesses, customer perception, and our unique value proposition. Need to position against alternatives, not just competition.`,
      confidence: 0.8,
      dependencies: ['competitive intelligence', 'customer feedback'],
      next_steps: ['Develop battle cards', 'Craft differentiation story']
    })

    // Step 3: Value proposition alignment
    reasoningSteps.push({
      step: 3,
      thought: 'Aligning value proposition with business outcomes',
      reasoning: `Connecting our solution capabilities to specific business outcomes the customer cares about. ROI, risk reduction, operational efficiency, revenue impact.`,
      confidence: 0.9,
      dependencies: ['business case development', 'ROI modeling'],
      next_steps: ['Quantify business impact', 'Build compelling ROI story']
    })

    // Step 4: Risk mitigation strategy
    reasoningSteps.push({
      step: 4,
      thought: 'Identifying and mitigating deal risks',
      reasoning: `Deal risks include: competitive threats, budget changes, stakeholder changes, technical concerns, implementation risks, timeline pressures.`,
      confidence: 0.75,
      dependencies: ['risk assessment framework', 'historical deal data'],
      next_steps: ['Prioritize risks', 'Develop specific mitigation tactics']
    })

    // Step 5: Closing strategy
    reasoningSteps.push({
      step: 5,
      thought: 'Developing tactical closing approach',
      reasoning: `Sequence of events to drive decision: pilot programs, executive alignment, contract negotiations, implementation planning. Timeline and momentum management.`,
      confidence: 0.8,
      dependencies: ['customer decision process', 'legal/procurement requirements'],
      next_steps: ['Create closing timeline', 'Secure executive sponsorship']
    })

    const avgConfidence = reasoningSteps.reduce((sum, step) => sum + step.confidence, 0) / reasoningSteps.length
    const winProbability = this.calculateWinProbability(dealData, competitiveContext)

    const result: ThinkingResult = {
      final_recommendation: `Deal Strategy: ${winProbability > 0.7 ? 'HIGH CONFIDENCE' : 'MODERATE RISK'} - Win probability ${Math.round(winProbability * 100)}%. Focus on ${this.identifyKeySuccessFactors(dealData)} while mitigating ${this.identifyTopRisks(dealData, competitiveContext)}.`,
      reasoning_chain: reasoningSteps,
      confidence_score: avgConfidence,
      risk_assessment: {
        high_risk_factors: this.identifyDealRisks(dealData, competitiveContext),
        mitigation_strategies: this.generateDealMitigations(dealData, competitiveContext)
      },
      implementation_plan: this.generateDealPlan(dealData, winProbability),
      alternative_approaches: this.suggestDealAlternatives(dealData, winProbability)
    }

    this.thinkingHistory.push(result)
    return result
  }

  /**
   * Complex objection handling using step-by-step thinking
   */
  async handleComplexObjection(objection: string, context: any): Promise<ThinkingResult> {
    const thinkingContext: ThinkingContext = {
      problem: `Address complex sales objection: "${objection}"`,
      constraints: [
        'Maintain relationship trust',
        'Address underlying concerns',
        'Move deal forward',
        'Competitive pressure'
      ],
      available_data: {
        objection_text: objection,
        prospect_context: context,
        conversation_history: context.history || [],
        competitive_intel: context.competition || {}
      },
      success_criteria: [
        'Objection fully resolved',
        'Trust maintained or strengthened',
        'Deal momentum preserved',
        'Next steps agreed'
      ],
      stakeholders: ['Sales Rep', 'Prospect', 'Sales Manager', 'Subject Matter Expert']
    }

    const reasoningSteps: ThinkingStep[] = []

    // Step 1: Objection classification and root cause analysis
    reasoningSteps.push({
      step: 1,
      thought: 'Classifying objection type and identifying root cause',
      reasoning: `Objection "${objection}" appears to be ${this.classifyObjection(objection)}. Need to understand if this is the real concern or surface-level symptom of deeper issue.`,
      confidence: 0.85,
      dependencies: ['objection taxonomy', 'conversation context'],
      next_steps: ['Probe for underlying concerns', 'Validate objection authenticity']
    })

    // Step 2: Stakeholder impact analysis  
    reasoningSteps.push({
      step: 2,
      thought: 'Analyzing how objection affects different stakeholders',
      reasoning: `This objection may resonate differently with technical evaluators vs economic buyers vs end users. Need to understand impact on each decision maker.`,
      confidence: 0.8,
      dependencies: ['stakeholder mapping', 'decision criteria'],
      next_steps: ['Map objection to stakeholder concerns', 'Identify allies and detractors']
    })

    // Step 3: Evidence and proof point assembly
    reasoningSteps.push({
      step: 3,
      thought: 'Gathering relevant evidence to address objection',
      reasoning: `Need specific proof points: case studies, references, data, expert opinions, third-party validation that directly refute the objection with credible evidence.`,
      confidence: 0.9,
      dependencies: ['proof point library', 'customer references', 'competitive analysis'],
      next_steps: ['Select most relevant proof points', 'Prepare supporting materials']
    })

    // Step 4: Response strategy formulation
    reasoningSteps.push({
      step: 4,
      thought: 'Formulating multi-layered response strategy',
      reasoning: `Response should: 1) Acknowledge concern validity, 2) Provide counter-evidence, 3) Reframe perspective, 4) Offer concrete next steps. Avoid being defensive.`,
      confidence: 0.85,
      dependencies: ['objection handling framework', 'communication best practices'],
      next_steps: ['Craft response message', 'Plan follow-up actions']
    })

    // Step 5: Momentum recovery planning
    reasoningSteps.push({
      step: 5,
      thought: 'Planning to recover and maintain deal momentum',
      reasoning: `After addressing objection, need to refocus on value proposition and next steps. Cannot let objection handling become the entire conversation focus.`,
      confidence: 0.8,
      dependencies: ['sales process framework', 'momentum management tactics'],
      next_steps: ['Define immediate next steps', 'Set follow-up timeline']
    })

    const avgConfidence = reasoningSteps.reduce((sum, step) => sum + step.confidence, 0) / reasoningSteps.length
    const objectionType = this.classifyObjection(objection)
    const responseStrategy = this.generateResponseStrategy(objection, objectionType, context)

    const result: ThinkingResult = {
      final_recommendation: `Objection Handling Strategy: Address ${objectionType} objection with ${responseStrategy.approach}. Use ${responseStrategy.primary_tactic} supported by ${responseStrategy.proof_points.join(', ')}. Follow up with ${responseStrategy.next_step}.`,
      reasoning_chain: reasoningSteps,
      confidence_score: avgConfidence,
      risk_assessment: {
        high_risk_factors: this.identifyObjectionRisks(objection, context),
        mitigation_strategies: this.generateObjectionMitigations(objection, context)
      },
      implementation_plan: this.generateObjectionHandlingPlan(objection, responseStrategy),
      alternative_approaches: this.suggestObjectionAlternatives(objection, context)
    }

    this.thinkingHistory.push(result)
    return result
  }

  // Helper methods for calculations and analysis

  private calculateICPScore(prospectData: any): number {
    // Simplified ICP scoring logic
    let score = 0.5 // baseline

    if (prospectData.company?.size === 'enterprise') score += 0.2
    if (prospectData.title?.toLowerCase().includes('vp') || prospectData.title?.toLowerCase().includes('director')) score += 0.15
    if (prospectData.company?.industry === 'technology' || prospectData.company?.industry === 'saas') score += 0.15

    return Math.min(score, 1.0)
  }

  private assessBuyingSignals(prospectData: any): number {
    // Simplified buying signal assessment
    let strength = 0.4 // baseline

    if (prospectData.engagement?.websiteVisits > 5) strength += 0.2
    if (prospectData.engagement?.emailOpens > 3) strength += 0.1
    if (prospectData.engagement?.responseTime < 24) strength += 0.2
    if (prospectData.conversation?.mentionedBudget) strength += 0.1

    return Math.min(strength, 1.0)
  }

  private identifyPrimaryPainPoint(prospectData: any): string {
    const commonPainPoints = [
      'operational efficiency',
      'cost reduction', 
      'revenue growth',
      'digital transformation',
      'customer satisfaction'
    ]
    return commonPainPoints[0] // Simplified - would use NLP in practice
  }

  private identifyRiskFactors(prospectData: any, qualification: string): string[] {
    const risks = []
    if (qualification === 'NOT_QUALIFIED') {
      risks.push('Low ICP fit', 'Weak buying signals', 'Resource allocation inefficiency')
    } else {
      risks.push('Competitive pressure', 'Budget approval delays', 'Stakeholder alignment')
    }
    return risks
  }

  private generateMitigationStrategies(prospectData: any, qualification: string): string[] {
    const strategies = []
    if (qualification === 'NOT_QUALIFIED') {
      strategies.push('Move to nurturing campaign', 'Quarterly check-ins', 'Value-add content sharing')
    } else {
      strategies.push('Multi-threading strategy', 'Executive alignment', 'Proof of concept proposal')
    }
    return strategies
  }

  private generateImplementationPlan(qualification: string, prospectData: any): { phase: string; actions: string[]; timeline: string; resources_needed: string[] }[] {
    if (qualification === 'QUALIFIED') {
      return [
        {
          phase: 'Discovery',
          actions: ['Schedule stakeholder interviews', 'Technical requirements gathering', 'Business case development'],
          timeline: '2 weeks',
          resources_needed: ['Sales Rep', 'Sales Engineer', 'Solution Consultant']
        },
        {
          phase: 'Proposal',
          actions: ['ROI analysis', 'Custom demo', 'Proposal presentation'],
          timeline: '1 week',
          resources_needed: ['Sales Rep', 'Technical Team', 'Pricing Specialist']
        }
      ]
    } else {
      return [
        {
          phase: 'Nurturing',
          actions: ['Add to nurture campaign', 'Quarterly value-add touchpoints'],
          timeline: 'Ongoing',
          resources_needed: ['Marketing Automation', 'Content Library']
        }
      ]
    }
  }

  private suggestAlternativeApproaches(qualification: string, prospectData: any): string[] {
    return [
      'Partner channel introduction',
      'Event-based re-engagement',
      'Referral from existing customer',
      'Industry conference meetup'
    ]
  }

  private calculateWinProbability(dealData: any, competitiveContext: any): number {
    // Simplified win probability calculation
    let probability = 0.5 // baseline

    if (dealData.champion) probability += 0.15
    if (dealData.budget_confirmed) probability += 0.1
    if (dealData.timeline_defined) probability += 0.1
    if (competitiveContext.preferred_vendor) probability += 0.2
    if (dealData.technical_fit === 'strong') probability += 0.15

    return Math.min(probability, 0.95) // Cap at 95%
  }

  private identifyKeySuccessFactors(dealData: any): string {
    return 'executive sponsorship and technical validation'
  }

  private identifyTopRisks(dealData: any, competitiveContext: any): string {
    return 'competitive pressure and budget approval timing'
  }

  private identifyDealRisks(dealData: any, competitiveContext: any): string[] {
    return [
      'Competitive displacement risk',
      'Budget approval delays',
      'Stakeholder changes',
      'Technical evaluation concerns',
      'Implementation timeline pressures'
    ]
  }

  private generateDealMitigations(dealData: any, competitiveContext: any): string[] {
    return [
      'Multi-threading across organization',
      'Executive alignment sessions',
      'Proof of concept with quick wins',
      'Technical validation checkpoints',
      'Phased implementation approach'
    ]
  }

  private generateDealPlan(dealData: any, winProbability: number): { phase: string; actions: string[]; timeline: string; resources_needed: string[] }[] {
    return [
      {
        phase: 'Stakeholder Alignment',
        actions: ['Executive briefings', 'Technical workshops', 'ROI validation'],
        timeline: '3 weeks',
        resources_needed: ['Account Executive', 'Sales Engineer', 'Customer Success']
      },
      {
        phase: 'Proposal & Negotiation',
        actions: ['Custom proposal', 'Contract negotiations', 'Implementation planning'],
        timeline: '2 weeks',  
        resources_needed: ['Sales Team', 'Legal', 'Implementation Team']
      }
    ]
  }

  private suggestDealAlternatives(dealData: any, winProbability: number): string[] {
    if (winProbability < 0.6) {
      return [
        'Pilot program approach',
        'Phased implementation',
        'Partnership model',
        'Competitive displacement timing'
      ]
    }
    return [
      'Accelerated timeline incentives',
      'Multi-year contract benefits',
      'Strategic partnership opportunities'
    ]
  }

  private classifyObjection(objection: string): string {
    const lowerObjection = objection.toLowerCase()
    
    if (lowerObjection.includes('price') || lowerObjection.includes('cost') || lowerObjection.includes('budget')) {
      return 'price'
    } else if (lowerObjection.includes('time') || lowerObjection.includes('timing') || lowerObjection.includes('later')) {
      return 'timing'
    } else if (lowerObjection.includes('authority') || lowerObjection.includes('decision') || lowerObjection.includes('boss')) {
      return 'authority'
    } else if (lowerObjection.includes('need') || lowerObjection.includes('priority') || lowerObjection.includes('important')) {
      return 'need'
    } else if (lowerObjection.includes('trust') || lowerObjection.includes('proven') || lowerObjection.includes('reference')) {
      return 'trust'
    } else if (lowerObjection.includes('competitor') || lowerObjection.includes('alternative') || lowerObjection.includes('comparing')) {
      return 'competition'
    }
    
    return 'general'
  }

  private generateResponseStrategy(objection: string, objectionType: string, context: any): any {
    const strategies: Record<string, any> = {
      price: {
        approach: 'value-based reframing',
        primary_tactic: 'ROI demonstration',
        proof_points: ['cost savings analysis', 'productivity gains', 'risk reduction value'],
        next_step: 'schedule ROI review session'
      },
      timing: {
        approach: 'urgency creation',
        primary_tactic: 'opportunity cost analysis', 
        proof_points: ['competitive advantage timing', 'implementation lead times', 'quarterly impact'],
        next_step: 'propose pilot program'
      },
      authority: {
        approach: 'stakeholder engagement',
        primary_tactic: 'decision maker introduction',
        proof_points: ['executive briefing materials', 'peer references', 'industry validation'],
        next_step: 'schedule stakeholder meeting'
      }
    }
    
    return strategies[objectionType] || strategies['price']
  }

  private identifyObjectionRisks(objection: string, context: any): string[] {
    return [
      'Lost momentum in sales cycle',
      'Competitive opportunity for alternatives', 
      'Stakeholder confidence erosion',
      'Deal timeline extension'
    ]
  }

  private generateObjectionMitigations(objection: string, context: any): string[] {
    return [
      'Address objection with specific evidence',
      'Involve subject matter experts',
      'Provide customer references',
      'Offer risk mitigation guarantees'
    ]
  }

  private generateObjectionHandlingPlan(objection: string, strategy: any): { phase: string; actions: string[]; timeline: string; resources_needed: string[] }[] {
    return [
      {
        phase: 'Immediate Response',
        actions: ['Acknowledge concern', 'Provide counter-evidence', 'Reframe perspective'],
        timeline: 'Same conversation',
        resources_needed: ['Sales Rep', 'Proof points library']
      },
      {
        phase: 'Follow-up Validation',
        actions: ['Send supporting materials', 'Arrange customer reference call', 'Schedule next meeting'],
        timeline: '24-48 hours',
        resources_needed: ['Marketing materials', 'Customer references', 'Calendar coordination']
      }
    ]
  }

  private suggestObjectionAlternatives(objection: string, context: any): string[] {
    return [
      'Third-party validation approach',
      'Pilot program with limited risk',
      'Phased implementation option',
      'Executive sponsor engagement'
    ]
  }

  /**
   * Get thinking history for analysis and learning
   */
  getThinkingHistory(): ThinkingResult[] {
    return this.thinkingHistory
  }

  /**
   * Analyze thinking patterns for improvement
   */
  analyzeThinkingPatterns(): {
    average_confidence: number
    most_common_risks: string[]
    success_rate_by_confidence: Record<string, number>
    improvement_opportunities: string[]
  } {
    if (this.thinkingHistory.length === 0) {
      return {
        average_confidence: 0,
        most_common_risks: [],
        success_rate_by_confidence: {},
        improvement_opportunities: ['Insufficient thinking history for analysis']
      }
    }

    const avgConfidence = this.thinkingHistory.reduce((sum, result) => sum + result.confidence_score, 0) / this.thinkingHistory.length

    const allRisks = this.thinkingHistory.flatMap(result => result.risk_assessment.high_risk_factors)
    const riskCounts = allRisks.reduce((counts, risk) => {
      counts[risk] = (counts[risk] || 0) + 1
      return counts
    }, {} as Record<string, number>)
    const mostCommonRisks = Object.entries(riskCounts)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5)
      .map(([risk]) => risk)

    return {
      average_confidence: avgConfidence,
      most_common_risks: mostCommonRisks,
      success_rate_by_confidence: {
        'high (>0.8)': this.thinkingHistory.filter(r => r.confidence_score > 0.8).length / this.thinkingHistory.length,
        'medium (0.6-0.8)': this.thinkingHistory.filter(r => r.confidence_score >= 0.6 && r.confidence_score <= 0.8).length / this.thinkingHistory.length,
        'low (<0.6)': this.thinkingHistory.filter(r => r.confidence_score < 0.6).length / this.thinkingHistory.length
      },
      improvement_opportunities: [
        'Increase data gathering for higher confidence scores',
        'Develop more specific risk mitigation strategies',
        'Improve stakeholder analysis depth',
        'Enhance competitive intelligence integration'
      ]
    }
  }
}

// Export singleton instance
export const salesThinkTool = new SalesThinkTool()