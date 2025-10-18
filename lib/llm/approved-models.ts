/**
 * Curated list of approved LLM models for customer selection
 * Limited to top-tier models from approved providers
 */

export interface ApprovedModel {
  id: string; // OpenRouter model ID or 'custom' for enterprise
  name: string;
  provider: 'openai' | 'anthropic' | 'mistral' | 'meta' | 'google' | 'deepseek' | 'qwen' | 'xai' | 'cohere' | 'custom';
  tier: 'flagship' | 'premium' | 'standard' | 'efficient' | 'enterprise';
  description: string;
  contextLength: number;
  maxOutputTokens: number;
  pricing: {
    input: number; // $ per million tokens
    output: number; // $ per million tokens
  };
  capabilities: string[];
  euHosted: boolean;
  recommended: boolean;
  requiresCustomSetup?: boolean; // For enterprise custom LLMs
  features: {
    reasoning: boolean;
    vision: boolean;
    toolUse: boolean;
    coding: boolean;
  };
}

export const APPROVED_MODELS: ApprovedModel[] = [
  // ============================================
  // ANTHROPIC (Claude) - Your Current Default
  // ============================================
  {
    id: 'anthropic/claude-haiku-4.5',
    name: 'Claude Haiku 4.5',
    provider: 'anthropic',
    tier: 'flagship',
    description: 'Anthropic\'s fastest and most efficient model with near-frontier intelligence at a fraction of the cost and latency.',
    contextLength: 200000,
    maxOutputTokens: 8192,
    pricing: {
      input: 1,
      output: 5
    },
    capabilities: ['Extended thinking', 'Coding excellence', 'Sub-agent workflows', 'Real-time applications'],
    euHosted: false,
    recommended: true, // Current default
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // OPENAI (GPT-5)
  // ============================================
  {
    id: 'openai/gpt-5',
    name: 'GPT-5',
    provider: 'openai',
    tier: 'flagship',
    description: 'OpenAI\'s most advanced model with major improvements in reasoning and code quality.',
    contextLength: 400000,
    maxOutputTokens: 128000,
    pricing: {
      input: 1.25,
      output: 10
    },
    capabilities: ['Step-by-step reasoning', 'Advanced coding', 'Reduced hallucination', 'Health tasks'],
    euHosted: false,
    recommended: true,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'openai/gpt-5-mini',
    name: 'GPT-5 Mini',
    provider: 'openai',
    tier: 'efficient',
    description: 'Compact GPT-5 for lighter reasoning tasks with reduced latency and cost.',
    contextLength: 400000,
    maxOutputTokens: 128000,
    pricing: {
      input: 0.25,
      output: 2
    },
    capabilities: ['Fast responses', 'Cost-effective', 'Instruction following', 'Basic reasoning'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'openai/gpt-5-codex',
    name: 'GPT-5 Codex',
    provider: 'openai',
    tier: 'premium',
    description: 'Specialized for software engineering and coding workflows.',
    contextLength: 400000,
    maxOutputTokens: 128000,
    pricing: {
      input: 1.25,
      output: 10
    },
    capabilities: ['Software engineering', 'Code review', 'Debugging', 'Refactoring'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // COHERE (EU-Deployable)
  // ============================================
  {
    id: 'cohere/command-a',
    name: 'Cohere Command A',
    provider: 'cohere',
    tier: 'premium',
    description: 'Open-weights 111B model with 256K context. Strong multilingual and agentic capabilities. Can be deployed in EU regions.',
    contextLength: 256000,
    maxOutputTokens: 8192,
    pricing: {
      input: 2.5,
      output: 10
    },
    capabilities: ['Multilingual', 'Agentic workflows', 'EU deployment', 'Open-weights'],
    euHosted: true, // When deployed in EU regions
    recommended: false,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // MISTRAL AI (EU-Hosted)
  // ============================================
  {
    id: 'mistralai/mistral-large',
    name: 'Mistral Large',
    provider: 'mistral',
    tier: 'flagship',
    description: 'Mistral\'s flagship model with strong multilingual capabilities. EU-hosted.',
    contextLength: 131072,
    maxOutputTokens: 4096,
    pricing: {
      input: 2,
      output: 6
    },
    capabilities: ['Multilingual', 'EU compliance', 'Reasoning', 'Code generation'],
    euHosted: true, // ✅ EU
    recommended: true,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'mistralai/mistral-medium-3.1',
    name: 'Mistral Medium 3.1',
    provider: 'mistral',
    tier: 'standard',
    description: 'Cost-effective enterprise model with frontier capabilities. EU-hosted.',
    contextLength: 131072,
    maxOutputTokens: 4096,
    pricing: {
      input: 0.4,
      output: 2
    },
    capabilities: ['Cost-efficient', 'STEM reasoning', 'EU compliance', 'Multimodal'],
    euHosted: true, // ✅ EU
    recommended: false,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // META (LLaMA)
  // ============================================
  {
    id: 'meta-llama/llama-4-scout-17b-16e',
    name: 'Llama 4 Scout 17B',
    provider: 'meta',
    tier: 'efficient',
    description: 'Efficient MoE model with strong performance for its size.',
    contextLength: 131072,
    maxOutputTokens: 8192,
    pricing: {
      input: 0.15,
      output: 0.75
    },
    capabilities: ['Cost-efficient', 'Fast inference', 'Reasoning', 'Coding'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // GOOGLE (Gemini)
  // ============================================
  {
    id: 'google/gemini-2.5-flash-preview-09-2025',
    name: 'Gemini 2.5 Flash',
    provider: 'google',
    tier: 'premium',
    description: 'Google\'s workhorse model with advanced reasoning and long context support.',
    contextLength: 1048576,
    maxOutputTokens: 65536,
    pricing: {
      input: 0.3,
      output: 2.5
    },
    capabilities: ['Ultra-long context', 'Multimodal', 'Thinking mode', 'Math & science'],
    euHosted: false,
    recommended: true,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'google/gemini-2.5-flash-lite-preview-09-2025',
    name: 'Gemini 2.5 Flash Lite',
    provider: 'google',
    tier: 'efficient',
    description: 'Lightweight reasoning model optimized for ultra-low latency.',
    contextLength: 1048576,
    maxOutputTokens: 65536,
    pricing: {
      input: 0.1,
      output: 0.4
    },
    capabilities: ['Low latency', 'Cost-efficient', 'Optional reasoning', 'Multimodal'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // DEEPSEEK
  // ============================================
  {
    id: 'deepseek/deepseek-chat-v3.1',
    name: 'DeepSeek V3.1',
    provider: 'deepseek',
    tier: 'premium',
    description: 'Large hybrid reasoning model with excellent cost/performance ratio.',
    contextLength: 163840,
    maxOutputTokens: 163840,
    pricing: {
      input: 0.2,
      output: 0.8
    },
    capabilities: ['Hybrid reasoning', 'Code generation', 'Tool use', 'Search agents'],
    euHosted: false,
    recommended: true,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'deepseek/deepseek-v3.1-terminus',
    name: 'DeepSeek V3.1 Terminus',
    provider: 'deepseek',
    tier: 'premium',
    description: 'Optimized version with improved agent capabilities and coding.',
    contextLength: 163840,
    maxOutputTokens: 163840,
    pricing: {
      input: 0.23,
      output: 0.9
    },
    capabilities: ['Agent optimization', 'Coding excellence', 'Search agents', 'Tool use'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // QWEN (Alibaba)
  // ============================================
  {
    id: 'qwen/qwen3-max',
    name: 'Qwen3 Max',
    provider: 'qwen',
    tier: 'flagship',
    description: 'Qwen\'s most capable model with strong multilingual support and reasoning.',
    contextLength: 256000,
    maxOutputTokens: 32768,
    pricing: {
      input: 1.2,
      output: 6
    },
    capabilities: ['Multilingual', 'RAG optimized', 'Tool calling', 'Reasoning'],
    euHosted: false,
    recommended: true,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'qwen/qwen3-coder-plus',
    name: 'Qwen3 Coder Plus',
    provider: 'qwen',
    tier: 'premium',
    description: 'Specialized coding agent model with excellent agentic capabilities.',
    contextLength: 128000,
    maxOutputTokens: 65536,
    pricing: {
      input: 1,
      output: 5
    },
    capabilities: ['Autonomous coding', 'Tool calling', 'Environment interaction', 'Agent workflows'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // xAI (Grok)
  // ============================================
  {
    id: 'x-ai/grok-4-fast',
    name: 'Grok 4 Fast',
    provider: 'xai',
    tier: 'premium',
    description: 'xAI\'s latest multimodal model with 2M context and cost-efficiency.',
    contextLength: 2000000,
    maxOutputTokens: 30000,
    pricing: {
      input: 0.2,
      output: 0.5
    },
    capabilities: ['Massive context', 'Reasoning mode', 'Multimodal', 'Cost-efficient'],
    euHosted: false,
    recommended: true,
    features: {
      reasoning: true,
      vision: true,
      toolUse: true,
      coding: true
    }
  },
  {
    id: 'x-ai/grok-code-fast-1',
    name: 'Grok Code Fast 1',
    provider: 'xai',
    tier: 'standard',
    description: 'Fast reasoning model specialized for agentic coding workflows.',
    contextLength: 256000,
    maxOutputTokens: 10000,
    pricing: {
      input: 0.2,
      output: 1.5
    },
    capabilities: ['Agentic coding', 'Reasoning traces', 'Fast responses', 'Developer workflows'],
    euHosted: false,
    recommended: false,
    features: {
      reasoning: true,
      vision: false,
      toolUse: true,
      coding: true
    }
  },

  // ============================================
  // ENTERPRISE CUSTOM LLM (Placeholder)
  // ============================================
  {
    id: 'custom/enterprise-llm',
    name: 'Custom Enterprise LLM',
    provider: 'custom',
    tier: 'enterprise',
    description: 'Bring your own LLM endpoint. Supports Azure OpenAI, AWS Bedrock, self-hosted models, or any OpenAI-compatible API.',
    contextLength: 0, // Varies by customer deployment
    maxOutputTokens: 0, // Varies by customer deployment
    pricing: {
      input: 0, // Customer pays their provider directly
      output: 0
    },
    capabilities: ['Custom endpoint', 'Full data control', 'Any LLM provider', 'Private deployment'],
    euHosted: false, // Depends on customer deployment
    recommended: false,
    requiresCustomSetup: true,
    features: {
      reasoning: true, // Depends on model
      vision: false, // Depends on model
      toolUse: true, // Depends on model
      coding: true // Depends on model
    }
  }
];

/**
 * Get models filtered by provider
 */
export function getModelsByProvider(provider: string): ApprovedModel[] {
  return APPROVED_MODELS.filter(m => m.provider === provider);
}

/**
 * Get EU-hosted models only (for compliance)
 */
export function getEUModels(): ApprovedModel[] {
  return APPROVED_MODELS.filter(m => m.euHosted);
}

/**
 * Get recommended models
 */
export function getRecommendedModels(): ApprovedModel[] {
  return APPROVED_MODELS.filter(m => m.recommended);
}

/**
 * Get model by ID
 */
export function getModelById(id: string): ApprovedModel | undefined {
  return APPROVED_MODELS.find(m => m.id === id);
}

/**
 * Get default model (current platform default)
 */
export function getDefaultModel(): ApprovedModel {
  return APPROVED_MODELS[0]; // Claude Haiku 4.5
}

/**
 * Provider display names
 */
export const PROVIDER_NAMES: Record<string, string> = {
  openai: 'OpenAI',
  anthropic: 'Anthropic',
  mistral: 'Mistral AI',
  meta: 'Meta',
  google: 'Google',
  deepseek: 'DeepSeek',
  qwen: 'Qwen',
  xai: 'xAI',
  cohere: 'Cohere',
  custom: 'Custom Enterprise'
};

/**
 * Provider descriptions
 */
export const PROVIDER_DESCRIPTIONS: Record<string, string> = {
  openai: 'Leading AI research lab. GPT models excel at reasoning and code generation.',
  anthropic: 'Constitutional AI pioneer. Claude models are safe, helpful, and harmless.',
  mistral: 'European AI champion. Models hosted in EU for data sovereignty.',
  meta: 'Open-source leader. LLaMA models offer strong performance with cost efficiency.',
  google: 'Search giant. Gemini models feature ultra-long context and multimodal capabilities.',
  deepseek: 'Chinese AI lab. Excellent cost/performance ratio with hybrid reasoning.',
  qwen: 'Alibaba AI. Strong multilingual support and tool-calling capabilities.',
  xai: 'Elon Musk\'s AI company. Grok models offer massive context windows.',
  cohere: 'Canadian AI company. Strong multilingual and agentic capabilities with EU deployment options.',
  custom: 'Bring your own LLM. Azure OpenAI, AWS Bedrock, self-hosted, or any compatible API.'
};
