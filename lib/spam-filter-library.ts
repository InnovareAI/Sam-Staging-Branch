// SAM AI Spam Word Filter Library
// Comprehensive spam detection and prevention for professional B2B messaging
// Words to AVOID in all messaging

export interface SpamFilterConfig {
  category: string;
  severity: 'high' | 'medium' | 'low';
  words: string[];
  context?: string;
  alternatives?: string[];
}

// High-risk words that almost always trigger spam filters
export const HIGH_RISK_SPAM_WORDS: SpamFilterConfig[] = [
  {
    category: 'urgency_manipulation',
    severity: 'high',
    words: [
      'URGENT', 'IMMEDIATE', 'ACT NOW', 'LIMITED TIME', 'EXPIRES TODAY',
      'FINAL NOTICE', 'LAST CHANCE', 'DEADLINE', 'HURRY', 'RUSH',
      'TIME SENSITIVE', 'IMMEDIATE RESPONSE REQUIRED', 'ASAP'
    ],
    context: 'Creates false urgency and pressure',
    alternatives: ['timely', 'current opportunity', 'worth exploring']
  },
  
  {
    category: 'money_promises',
    severity: 'high', 
    words: [
      'FREE MONEY', 'CASH BONUS', 'GET PAID', 'MAKE MONEY FAST',
      'EARN EXTRA CASH', 'FINANCIAL FREEDOM', 'GET RICH', 'INSTANT WEALTH',
      '100% FREE', 'NO COST', 'ABSOLUTELY FREE', 'ZERO COST'
    ],
    context: 'Unrealistic financial promises',
    alternatives: ['complimentary consultation', 'no initial investment', 'included at no charge']
  },

  {
    category: 'excessive_claims',
    severity: 'high',
    words: [
      'GUARANTEED', '100% GUARANTEED', 'PROMISE', 'GUARANTEED SUCCESS',
      'RISK FREE', 'NO RISK', 'CERTAIN', 'FOOLPROOF', 'MIRACLE',
      'AMAZING', 'INCREDIBLE', 'UNBELIEVABLE', 'FANTASTIC'
    ],
    context: 'Overpromising and unrealistic guarantees',
    alternatives: ['confident in our approach', 'proven track record', 'demonstrated results']
  },

  {
    category: 'aggressive_sales',
    severity: 'high',
    words: [
      'BUY NOW', 'ORDER NOW', 'PURCHASE TODAY', 'SIGN UP NOW',
      'CLICK HERE NOW', 'CALL NOW', 'DONT WAIT', 'ACT IMMEDIATELY',
      'LIMITED OFFER', 'SPECIAL PROMOTION', 'EXCLUSIVE DEAL'
    ],
    context: 'Pushy sales language',
    alternatives: ['explore our solution', 'learn more', 'discuss your needs']
  }
];

// Medium-risk words that can trigger filters in certain contexts
export const MEDIUM_RISK_SPAM_WORDS: SpamFilterConfig[] = [
  {
    category: 'promotional_language',
    severity: 'medium',
    words: [
      'SALE', 'DISCOUNT', 'SPECIAL OFFER', 'PROMOTION', 'DEAL',
      'BARGAIN', 'CHEAP', 'LOWEST PRICE', 'BEST PRICE', 'SAVE',
      'PERCENT OFF', 'REDUCED PRICE', 'CLEARANCE'
    ],
    context: 'Commercial language that can seem spammy',
    alternatives: ['cost-effective solution', 'competitive pricing', 'value proposition']
  },

  {
    category: 'winner_language', 
    severity: 'medium',
    words: [
      'WINNER', 'SELECTED', 'CHOSEN', 'PICKED', 'CONGRATULATIONS',
      'YOUVE WON', 'PRIZE', 'REWARD', 'GIFT', 'BONUS'
    ],
    context: 'False winner notifications',
    alternatives: ['opportunity', 'invitation', 'consideration']
  },

  {
    category: 'financial_terms',
    severity: 'medium', 
    words: [
      'INVESTMENT', 'PROFIT', 'INCOME', 'REVENUE', 'EARNINGS',
      'RETURN ON INVESTMENT', 'ROI', 'PAYBACK', 'COST SAVINGS'
    ],
    context: 'Can be legitimate in B2B but overuse triggers filters',
    alternatives: ['business value', 'operational efficiency', 'performance improvement']
  },

  {
    category: 'attention_grabbers',
    severity: 'medium',
    words: [
      'ATTENTION', 'NOTICE', 'IMPORTANT', 'ALERT', 'WARNING',
      'ANNOUNCEMENT', 'NEWS', 'UPDATE', 'BREAKING'
    ],
    context: 'Overused attention-seeking words',
    alternatives: ['regarding', 'update on', 'information about']
  }
];

// Low-risk words that should be used carefully in professional contexts
export const LOW_RISK_SPAM_WORDS: SpamFilterConfig[] = [
  {
    category: 'casual_exclamations',
    severity: 'low',
    words: [
      'WOW', 'AWESOME', 'COOL', 'SWEET', 'NICE', 'GREAT DEAL',
      'SUPER', 'MEGA', 'ULTRA', 'EXTREME', 'MAXIMUM'
    ],
    context: 'Too casual for professional B2B communication',
    alternatives: ['impressive', 'noteworthy', 'significant', 'substantial']
  },

  {
    category: 'excessive_punctuation',
    severity: 'low', 
    words: [
      '!!!', '???', '!!', '$$', '***', '>>>', '<<<'
    ],
    context: 'Multiple punctuation marks look unprofessional',
    alternatives: ['single punctuation', 'professional formatting']
  }
];

// Subject line specific spam words
export const SUBJECT_LINE_SPAM_WORDS: SpamFilterConfig[] = [
  {
    category: 'subject_spam',
    severity: 'high',
    words: [
      'FWD:', 'RE:', 'URGENT:', 'IMPORTANT:', 'NOTICE:',
      'FREE:', 'SAVE:', 'WIN:', 'CASH:', 'MONEY:'
    ],
    context: 'Common subject line spam patterns',
    alternatives: ['Quick question about', 'Regarding your', 'Following up on']
  }
];

// Industry-specific professional alternatives
export const PROFESSIONAL_ALTERNATIVES = {
  // Instead of "FREE"
  free_alternatives: [
    'complimentary consultation',
    'no-charge assessment', 
    'included in the package',
    'part of our service',
    'at no additional cost'
  ],
  
  // Instead of "GUARANTEED"
  guarantee_alternatives: [
    'confident in our approach',
    'proven methodology',
    'track record shows',
    'demonstrated results',
    'evidence-based solution'
  ],

  // Instead of "URGENT" 
  urgency_alternatives: [
    'timely opportunity',
    'time-sensitive matter',
    'current market conditions',
    'worth exploring soon',
    'while positions are available'
  ],

  // Instead of "AMAZING/INCREDIBLE"
  superlative_alternatives: [
    'significant improvement',
    'meaningful impact', 
    'substantial results',
    'notable outcomes',
    'measurable benefits'
  ]
};

// Spam detection functions
export class SpamFilterAnalyzer {
  
  static analyzeContent(content: string): SpamAnalysisResult {
    const lowerContent = content.toLowerCase();
    const spamFlags: SpamFlag[] = [];
    let totalScore = 0;

    // Check all spam word categories
    const allSpamWords = [
      ...HIGH_RISK_SPAM_WORDS,
      ...MEDIUM_RISK_SPAM_WORDS, 
      ...LOW_RISK_SPAM_WORDS,
      ...SUBJECT_LINE_SPAM_WORDS
    ];

    allSpamWords.forEach(category => {
      category.words.forEach(word => {
        if (lowerContent.includes(word.toLowerCase())) {
          const score = this.getSeverityScore(category.severity);
          totalScore += score;
          
          spamFlags.push({
            word: word,
            category: category.category,
            severity: category.severity,
            score: score,
            alternatives: category.alternatives || []
          });
        }
      });
    });

    return {
      totalSpamScore: totalScore,
      riskLevel: this.getRiskLevel(totalScore),
      spamFlags: spamFlags,
      recommendations: this.getRecommendations(spamFlags),
      isAcceptable: totalScore < 10 // Acceptable threshold
    };
  }

  static analyzeSubjectLine(subject: string): SubjectLineAnalysis {
    const analysis = this.analyzeContent(subject);
    
    return {
      ...analysis,
      characterCount: subject.length,
      isOptimalLength: subject.length >= 30 && subject.length <= 50,
      containsPersonalization: subject.includes('{') && subject.includes('}'),
      startsWithRe: subject.toLowerCase().startsWith('re:'),
      startsWithFwd: subject.toLowerCase().startsWith('fwd:')
    };
  }

  private static getSeverityScore(severity: 'high' | 'medium' | 'low'): number {
    switch(severity) {
      case 'high': return 5;
      case 'medium': return 3;
      case 'low': return 1;
      default: return 0;
    }
  }

  private static getRiskLevel(score: number): 'low' | 'medium' | 'high' {
    if (score >= 10) return 'high';
    if (score >= 5) return 'medium';
    return 'low';
  }

  private static getRecommendations(flags: SpamFlag[]): string[] {
    const recommendations: string[] = [];
    
    if (flags.some(f => f.severity === 'high')) {
      recommendations.push('Remove high-risk spam words immediately');
    }
    
    if (flags.length > 3) {
      recommendations.push('Reduce overall promotional language');
    }

    if (flags.some(f => f.category === 'urgency_manipulation')) {
      recommendations.push('Remove artificial urgency and pressure tactics');
    }

    if (flags.some(f => f.category === 'money_promises')) {
      recommendations.push('Focus on value rather than financial promises');
    }

    return recommendations;
  }
}

// Types for spam analysis
export interface SpamFlag {
  word: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  score: number;
  alternatives: string[];
}

export interface SpamAnalysisResult {
  totalSpamScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  spamFlags: SpamFlag[];
  recommendations: string[];
  isAcceptable: boolean;
}

export interface SubjectLineAnalysis extends SpamAnalysisResult {
  characterCount: number;
  isOptimalLength: boolean;
  containsPersonalization: boolean;
  startsWithRe: boolean;
  startsWithFwd: boolean;
}

// Real-time validation for template enhancement
export function validateMessageContent(content: string): ValidationResult {
  const spamAnalysis = SpamFilterAnalyzer.analyzeContent(content);
  
  return {
    isValid: spamAnalysis.isAcceptable,
    spamScore: spamAnalysis.totalSpamScore,
    riskLevel: spamAnalysis.riskLevel,
    issues: spamAnalysis.spamFlags.map(flag => ({
      text: flag.word,
      reason: `${flag.category} (${flag.severity} risk)`,
      suggestions: flag.alternatives
    })),
    recommendations: spamAnalysis.recommendations
  };
}

export interface ValidationResult {
  isValid: boolean;
  spamScore: number;
  riskLevel: 'low' | 'medium' | 'high';
  issues: {
    text: string;
    reason: string;
    suggestions: string[];
  }[];
  recommendations: string[];
}

// B2B Professional messaging guidelines
export const B2B_MESSAGING_BEST_PRACTICES = {
  tone_guidelines: [
    'Use professional, conversational tone',
    'Avoid exclamation points and ALL CAPS',
    'Focus on business benefits, not personal gains',
    'Use industry-specific terminology appropriately',
    'Maintain respect for recipient\'s time and expertise'
  ],
  
  structure_guidelines: [
    'Clear, concise subject lines (30-50 characters)',
    'Brief, scannable paragraphs (2-3 sentences max)',
    'Single, clear call-to-action',
    'Professional signature with contact info',
    'Personalization without over-familiarity'
  ],
  
  content_guidelines: [
    'Lead with recipient benefits, not your needs',
    'Use specific metrics and outcomes when possible',
    'Avoid superlatives and hyperbolic language',
    'Include relevant social proof or case studies',
    'Respect professional boundaries and privacy'
  ]
};