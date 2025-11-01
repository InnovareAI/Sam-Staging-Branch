/**
 * Knowledge Base Completion Tracker
 * Calculates KB completeness score and identifies gaps for onboarding
 */

export interface KBCompletionScore {
  overall: number; // 0-100 percentage
  categories: {
    [key: string]: {
      score: number;
      weight: number;
      items_count: number;
      items_required: number;
      gaps: string[];
    };
  };
  tier: 'empty' | 'basic' | 'moderate' | 'complete';
  ready_for_campaigns: boolean;
  recommendations: string[];
}

/**
 * KB Category weights for completion calculation
 * Critical categories: 60% weight
 * Important categories: 30% weight
 * Supporting categories: 10% weight
 */
const CATEGORY_WEIGHTS = {
  // CRITICAL (60%) - Must have for campaigns
  'icp': { weight: 0.20, min_items: 1, required: true },
  'products': { weight: 0.20, min_items: 1, required: true },
  'messaging': { weight: 0.20, min_items: 1, required: true },

  // IMPORTANT (30%) - Strongly recommended
  'pricing': { weight: 0.10, min_items: 1, required: false },
  'objections': { weight: 0.10, min_items: 3, required: false },
  'success': { weight: 0.10, min_items: 1, required: false },

  // SUPPORTING (10%) - Nice to have
  'competitors': { weight: 0.05, min_items: 2, required: false },
  'use_cases': { weight: 0.05, min_items: 2, required: false },
};

const CAMPAIGN_READINESS_THRESHOLD = 50; // 50% minimum for campaigns

/**
 * Calculate KB completion score for a workspace
 */
export async function calculateKBCompleteness(
  supabase: any,
  workspaceId: string
): Promise<KBCompletionScore> {
  const categories: KBCompletionScore['categories'] = {};
  let totalScore = 0;
  const recommendations: string[] = [];

  // Get document counts by category
  for (const [category, config] of Object.entries(CATEGORY_WEIGHTS)) {
    const { data: items, error } = await supabase
      .from('knowledge_base')
      .select('id, title, category')
      .eq('workspace_id', workspaceId)
      .eq('category', category)
      .eq('is_active', true);

    if (error) {
      console.error(`[KB Completion] Error fetching ${category}:`, error);
      continue;
    }

    const itemCount = items?.length || 0;
    const itemScore = Math.min(itemCount / config.min_items, 1.0);
    const weightedScore = itemScore * config.weight * 100;

    totalScore += weightedScore;

    const gaps: string[] = [];
    if (itemCount === 0) {
      gaps.push(`No ${category} information provided`);
    } else if (itemCount < config.min_items) {
      gaps.push(`Only ${itemCount}/${config.min_items} ${category} items - add more`);
    }

    categories[category] = {
      score: Math.round(itemScore * 100),
      weight: config.weight,
      items_count: itemCount,
      items_required: config.min_items,
      gaps
    };

    // Generate recommendations
    if (config.required && itemCount === 0) {
      recommendations.push(`🔴 CRITICAL: Add ${category} information to your knowledge base`);
    } else if (config.required && itemCount < config.min_items) {
      recommendations.push(`⚠️ Add more ${category} content (need ${config.min_items - itemCount} more)`);
    }
  }

  // Check ICP configuration separately
  const { data: icpConfig } = await supabase
    .from('icp_configurations')
    .select('id')
    .eq('workspace_id', workspaceId)
    .limit(1)
    .maybeSingle();

  if (!icpConfig) {
    recommendations.push('🔴 CRITICAL: Define your Ideal Customer Profile (ICP)');
    totalScore = Math.max(0, totalScore - 20); // Penalty for missing ICP config
  }

  const overallScore = Math.round(totalScore);

  // Determine tier
  let tier: KBCompletionScore['tier'] = 'empty';
  if (overallScore >= 80) tier = 'complete';
  else if (overallScore >= 50) tier = 'moderate';
  else if (overallScore >= 20) tier = 'basic';

  const readyForCampaigns = overallScore >= CAMPAIGN_READINESS_THRESHOLD;

  if (!readyForCampaigns) {
    recommendations.unshift(
      `⏸️ Complete your Knowledge Base to ${CAMPAIGN_READINESS_THRESHOLD}% to unlock campaigns (currently ${overallScore}%)`
    );
  }

  return {
    overall: overallScore,
    categories,
    tier,
    ready_for_campaigns: readyForCampaigns,
    recommendations
  };
}

/**
 * Get specific gaps and suggestions for onboarding
 */
export async function getOnboardingGaps(
  supabase: any,
  workspaceId: string
): Promise<{
  missing_categories: string[];
  upload_suggestions: Array<{ category: string; description: string; examples: string[] }>;
  sam_can_help: string[];
}> {
  const completion = await calculateKBCompleteness(supabase, workspaceId);

  const missingCategories: string[] = [];
  const uploadSuggestions: Array<{ category: string; description: string; examples: string[] }> = [];
  const samCanHelp: string[] = [];

  // Identify missing critical categories
  for (const [category, data] of Object.entries(completion.categories)) {
    if (data.items_count === 0) {
      missingCategories.push(category);

      // Generate upload suggestions
      const suggestion = getCategoryUploadSuggestion(category);
      if (suggestion) {
        uploadSuggestions.push(suggestion);
      }

      // Check if SAM can help extract this
      if (['icp', 'products', 'messaging', 'objections'].includes(category)) {
        samCanHelp.push(category);
      }
    }
  }

  return {
    missing_categories: missingCategories,
    upload_suggestions: uploadSuggestions,
    sam_can_help: samCanHelp
  };
}

/**
 * Get upload suggestions for a specific category
 */
function getCategoryUploadSuggestion(category: string): {
  category: string;
  description: string;
  examples: string[];
} | null {
  const suggestions: Record<string, { description: string; examples: string[] }> = {
    'icp': {
      description: 'Define your Ideal Customer Profile',
      examples: [
        'Customer personas document',
        'Market research reports',
        'Sales team ICP guidelines'
      ]
    },
    'products': {
      description: 'Describe your products or services',
      examples: [
        'Product brochures and datasheets',
        'Service descriptions',
        'Feature comparison docs'
      ]
    },
    'messaging': {
      description: 'Add your value propositions and messaging',
      examples: [
        'Marketing messaging guide',
        'Value proposition documents',
        'Brand guidelines'
      ]
    },
    'pricing': {
      description: 'Upload pricing information',
      examples: [
        'Pricing sheets',
        'Proposal templates',
        'Discount and package info'
      ]
    },
    'objections': {
      description: 'Document common objections and responses',
      examples: [
        'Sales objection handling guide',
        'FAQ documents',
        'Competitive battle cards'
      ]
    },
    'success': {
      description: 'Share customer success stories',
      examples: [
        'Case studies',
        'Customer testimonials',
        'ROI reports'
      ]
    },
    'competitors': {
      description: 'Add competitive intelligence',
      examples: [
        'Competitive analysis docs',
        'Win/loss reports',
        'Market positioning guides'
      ]
    },
    'use_cases': {
      description: 'Document common use cases',
      examples: [
        'Use case library',
        'Industry-specific solutions',
        'Implementation guides'
      ]
    }
  };

  const suggestion = suggestions[category];
  return suggestion ? { category, ...suggestion } : null;
}

/**
 * Track KB completion progress over time
 */
export async function trackCompletionProgress(
  supabase: any,
  workspaceId: string
): Promise<void> {
  const completion = await calculateKBCompleteness(supabase, workspaceId);

  await supabase
    .from('workspace_metadata')
    .upsert({
      workspace_id: workspaceId,
      metadata: {
        kb_completion: {
          score: completion.overall,
          tier: completion.tier,
          ready_for_campaigns: completion.ready_for_campaigns,
          last_calculated: new Date().toISOString(),
          category_scores: Object.fromEntries(
            Object.entries(completion.categories).map(([cat, data]) => [cat, data.score])
          )
        }
      },
      updated_at: new Date().toISOString()
    });
}

/**
 * Get SAM prompt suggestions based on KB gaps
 */
export function getSAMPromptForGaps(missingCategories: string[]): string {
  const prompts: Record<string, string> = {
    'icp': 'Let\'s start by defining your Ideal Customer Profile. What industries do you target?',
    'products': 'Tell me about your products or services. What problems do they solve?',
    'messaging': 'What\'s your unique value proposition? How do you differentiate from competitors?',
    'pricing': 'What\'s your pricing structure? Are there different tiers or packages?',
    'objections': 'What are the most common objections you hear from prospects?',
    'success': 'Can you share a recent customer success story or case study?',
    'competitors': 'Who are your main competitors? How do you compare?',
    'use_cases': 'What are the most common use cases for your product/service?'
  };

  // Return prompt for first missing critical category
  const criticalMissing = missingCategories.find(cat => ['icp', 'products', 'messaging'].includes(cat));
  return prompts[criticalMissing || missingCategories[0]] || 'How can I help you build your knowledge base?';
}
