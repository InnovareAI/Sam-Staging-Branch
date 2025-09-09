// SAM AI Knowledge Base Integration
// Version: v4.4 | Last Updated: 2025-09-09

import { readFileSync } from 'fs';
import { join } from 'path';

export interface SamKnowledge {
  identity: string;
  personas: string;
  conversationModes: string;
  errorHandling: string;
  objectionHandling: string;
  caseStudies: string;
  industryBursts: string;
  onboardingFlow: string;
  styleGuide: string;
  detailedOnboarding: string;
}

export interface PersonaProfile {
  name: string;
  priorities: string[];
  painPoints: string[];
  approach: string;
}

export interface ConversationMode {
  name: string;
  purpose: string;
  sampleDialogue: string;
}

export interface CaseStudy {
  industry: string;
  result: string;
}

export interface IndustryBurst {
  industry: string;
  phrases: string[];
}

export class SamKnowledgeBase {
  private knowledgeBasePath: string;
  private knowledge: SamKnowledge | null = null;

  constructor() {
    this.knowledgeBasePath = join(process.cwd(), 'knowledge-base');
  }

  private loadKnowledgeFile(category: string, filename: string): string {
    try {
      const filePath = join(this.knowledgeBasePath, category, filename);
      return readFileSync(filePath, 'utf-8');
    } catch (error) {
      console.warn(`Warning: Could not load knowledge file: ${category}/${filename}`);
      return '';
    }
  }

  public loadKnowledge(): SamKnowledge {
    if (this.knowledge) {
      return this.knowledge;
    }

    this.knowledge = {
      identity: this.loadKnowledgeFile('core', 'sam-identity.md'),
      personas: this.loadKnowledgeFile('core', 'personas-library.md'),
      conversationModes: this.loadKnowledgeFile('conversational-design', 'conversation-modes.md'),
      errorHandling: this.loadKnowledgeFile('conversational-design', 'error-handling.md'),
      objectionHandling: this.loadKnowledgeFile('strategy', 'objection-handling.md'),
      caseStudies: this.loadKnowledgeFile('strategy', 'case-studies.md'),
      industryBursts: this.loadKnowledgeFile('verticals', 'industry-bursts.md'),
      onboardingFlow: this.loadKnowledgeFile('conversational-design', 'onboarding-flow.md'),
      styleGuide: this.loadKnowledgeFile('conversational-design', 'style-guide.md'),
      detailedOnboarding: this.loadKnowledgeFile('conversational-design', 'detailed-onboarding.md')
    };

    return this.knowledge;
  }

  public getPersonaGuidance(userInput: string): string {
    const knowledge = this.loadKnowledge();
    
    // Simple keyword matching for persona detection
    const personas = {
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

    const input = userInput.toLowerCase();
    for (const [persona, focus] of Object.entries(personas)) {
      if (input.includes(persona)) {
        return `Based on your ${persona} role, I'll focus on: ${focus}`;
      }
    }

    return '';
  }

  public getIndustryBurst(industry: string): string {
    const knowledge = this.loadKnowledge();
    const bursts = knowledge.industryBursts;
    
    // Extract industry-specific conversation starters
    if (bursts.includes(industry)) {
      const lines = bursts.split('\n');
      const industrySection = lines.findIndex(line => line.includes(`## ${industry}`));
      if (industrySection !== -1) {
        const nextSection = lines.findIndex((line, index) => index > industrySection && line.startsWith('##'));
        const endIndex = nextSection === -1 ? lines.length : nextSection;
        
        return lines.slice(industrySection + 1, endIndex)
          .filter(line => line.startsWith('- "'))
          .map(line => line.replace('- "', '').replace('"', ''))
          .join('\n');
      }
    }

    return '';
  }

  public getObjectionResponse(objection: string): string {
    const knowledge = this.loadKnowledge();
    const objections = knowledge.objectionHandling;
    
    // Simple keyword matching for objection handling
    const objectionMap: { [key: string]: string } = {
      'apollo': 'Great tools for data, but SAM orchestrates 14 agents across enrichment, personalization, outreach, replies, and analytics.',
      'sales nav': 'Great tools for data, but SAM orchestrates 14 agents across enrichment, personalization, outreach, replies, and analytics.',
      'hire sdr': 'SDRs take 3–6 months to ramp. SAM delivers ROI in weeks at 20% of the cost.',
      'ai': 'Every message is personalized with context from LinkedIn, websites, and case studies. Feels researched, not robotic.',
      'compliance': 'SAM includes HITL approvals, pre-approved disclaimers, and vertical-specific compliance libraries.'
    };

    const input = objection.toLowerCase();
    for (const [keyword, response] of Object.entries(objectionMap)) {
      if (input.includes(keyword)) {
        return response;
      }
    }

    return '';
  }

  public getCaseStudyForIndustry(industry: string): string {
    const knowledge = this.loadKnowledge();
    const caseStudies = knowledge.caseStudies;
    
    // Extract relevant case study
    if (caseStudies.includes(industry)) {
      const lines = caseStudies.split('\n');
      const studyLine = lines.find(line => line.includes(`## ${industry}`));
      if (studyLine) {
        const nextLine = lines[lines.indexOf(studyLine) + 1];
        return nextLine?.replace('- ', '') || '';
      }
    }

    return '';
  }

  public getSystemPrompt(): string {
    const knowledge = this.loadKnowledge();
    
    return `You are Sam, an AI-powered B2B sales assistant with sophisticated training in automated outreach, lead scoring, and personalized messaging.

${knowledge.identity}

## Conversational Style & Flow:
${knowledge.styleGuide}

## Onboarding Process:
${knowledge.onboardingFlow}

## Detailed Onboarding (7-Stage):
${knowledge.detailedOnboarding}

## Conversation Modes:
${knowledge.conversationModes}

## Error Handling:
${knowledge.errorHandling}

## Objection Handling:
${knowledge.objectionHandling}

## Industry Intelligence:
${knowledge.industryBursts}

## Success Stories:
${knowledge.caseStudies}

## Personas Library:
${knowledge.personas}

You are context-aware and adapt your responses based on the user's industry, role, and conversation history. Follow the consultant-style approach with microbursts, acknowledge-value-ask patterns, and professional warmth. Always be helpful, knowledgeable, and focused on delivering value through sales process optimization.`;
  }
}

// Export singleton instance
export const samKnowledge = new SamKnowledgeBase();