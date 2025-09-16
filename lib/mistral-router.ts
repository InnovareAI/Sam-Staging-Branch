// Mistral Model Router for SAM AI Agents
// Routes different agent types to optimal Mistral models based on task complexity

export type AgentType = 
  | 'content_generation'
  | 'personalization' 
  | 'response_drafting'
  | 'campaign_strategy'
  | 'lead_scoring'
  | 'reply_classification'
  | 'data_enrichment'
  | 'performance_monitoring'
  | 'code_integration'
  | 'content_moderation'
  | 'general_chat';

export type CustomerTier = 'startup' | 'sme' | 'enterprise';

interface MistralModelConfig {
  model: string;
  maxTokens: number;
  temperature: number;
  costPer1MTokens: {
    input: number;
    output: number;
  };
}

const MISTRAL_MODELS: Record<string, MistralModelConfig> = {
  // High creativity & complex reasoning
  medium: {
    model: 'mistralai/mistral-medium-3',
    maxTokens: 2000,
    temperature: 0.7,
    costPer1MTokens: { input: 0.4, output: 2.0 }
  },
  
  // Analytical & classification tasks
  small: {
    model: 'mistralai/mistral-small-3.2',
    maxTokens: 1000,
    temperature: 0.3,
    costPer1MTokens: { input: 0.1, output: 0.3 }
  },
  
  // Code & technical tasks
  devstral: {
    model: 'mistralai/devstral-small-2507',
    maxTokens: 1500,
    temperature: 0.2,
    costPer1MTokens: { input: 0.1, output: 0.3 }
  },
  
  // Ultra-lightweight for high volume
  ministral: {
    model: 'mistralai/ministral-3b-24.10',
    maxTokens: 800,
    temperature: 0.5,
    costPer1MTokens: { input: 0.04, output: 0.04 }
  }
};

// Agent type to model mapping
const AGENT_MODEL_MAP: Record<AgentType, keyof typeof MISTRAL_MODELS> = {
  // High creativity tasks → Mistral Medium 3
  content_generation: 'medium',
  personalization: 'medium', 
  response_drafting: 'medium',
  campaign_strategy: 'medium',
  
  // Analytical tasks → Mistral Small 3.2
  lead_scoring: 'small',
  reply_classification: 'small',
  data_enrichment: 'small',
  performance_monitoring: 'small',
  
  // Technical tasks → Devstral Small
  code_integration: 'devstral',
  
  // Moderation → Mistral Small
  content_moderation: 'small',
  
  // General chat → depends on customer tier
  general_chat: 'small'
};

// Customer tier model override for cost optimization
const TIER_MODEL_OVERRIDE: Record<CustomerTier, Partial<Record<AgentType, keyof typeof MISTRAL_MODELS>>> = {
  startup: {
    // Use ultra-lightweight for all tasks to maximize margins
    content_generation: 'small',
    personalization: 'small',
    response_drafting: 'small',
    campaign_strategy: 'small',
    general_chat: 'ministral'
  },
  sme: {
    // Balanced approach - keep medium for key creative tasks
    general_chat: 'small'
  },
  enterprise: {
    // Use premium models for best quality
    general_chat: 'medium'
  }
};

export function getMistralModelForAgent(
  agentType: AgentType, 
  customerTier: CustomerTier = 'startup'
): MistralModelConfig {
  // Check for tier-specific override first
  const tierOverride = TIER_MODEL_OVERRIDE[customerTier][agentType];
  const modelKey = tierOverride || AGENT_MODEL_MAP[agentType];
  
  return MISTRAL_MODELS[modelKey];
}

export function estimateCost(
  agentType: AgentType,
  customerTier: CustomerTier,
  inputTokens: number,
  outputTokens: number
): number {
  const model = getMistralModelForAgent(agentType, customerTier);
  
  const inputCost = (inputTokens / 1_000_000) * model.costPer1MTokens.input;
  const outputCost = (outputTokens / 1_000_000) * model.costPer1MTokens.output;
  
  return inputCost + outputCost;
}

// Helper to get all available models for debugging
export function getAllMistralModels() {
  return MISTRAL_MODELS;
}

// Cost comparison vs Claude 3.5 Sonnet
export function calculateSavings(
  agentType: AgentType,
  customerTier: CustomerTier,
  inputTokens: number,
  outputTokens: number
): {
  mistralCost: number;
  claudeCost: number;
  savings: number;
  savingsPercentage: number;
} {
  const mistralCost = estimateCost(agentType, customerTier, inputTokens, outputTokens);
  
  // Claude 3.5 Sonnet pricing
  const claudeInputCost = (inputTokens / 1_000_000) * 3;
  const claudeOutputCost = (outputTokens / 1_000_000) * 15;
  const claudeCost = claudeInputCost + claudeOutputCost;
  
  const savings = claudeCost - mistralCost;
  const savingsPercentage = (savings / claudeCost) * 100;
  
  return {
    mistralCost,
    claudeCost,
    savings,
    savingsPercentage
  };
}