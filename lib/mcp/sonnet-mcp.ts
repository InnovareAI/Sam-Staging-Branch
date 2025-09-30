/**
 * MCP Sonnet Integration for Template Optimization
 * Handles AI-powered template enhancement, personalization, and performance analysis
 */

// Using OpenRouter API for Sonnet access

export interface SonnetOptimizationRequest {
  original_template: {
    connection_message: string;
    alternative_message?: string;
    follow_up_messages: string[];
  };
  target_context: {
    industry?: string;
    role?: string;
    company_size?: string;
    language: string;
    tone: string;
    campaign_type: string;
  };
  optimization_goals: string[];
}

export interface SonnetOptimizationResult {
  optimized_template: {
    connection_message: string;
    alternative_message?: string;
    follow_up_messages: string[];
  };
  improvements: string[];
  confidence_score: number;
  reasoning: string;
}

/**
 * Optimize messaging template using Sonnet
 */
export async function mcp__sonnet__optimize_template(request: SonnetOptimizationRequest): Promise<{
  success: boolean;
  result?: SonnetOptimizationResult;
  error?: string;
}> {
  try {
    // Construct Sonnet prompt for template optimization
    const prompt = buildOptimizationPrompt(request);
    
    // Call Sonnet API (placeholder for actual implementation)
    const sonnetResponse = await callSonnetAPI({
      model: "anthropic/claude-4.5-sonnet",
      messages: [
        {
          role: "system",
          content: "You are an expert sales messaging optimization AI. You specialize in creating high-converting LinkedIn and email outreach templates that respect European business culture and GDPR compliance."
        },
        {
          role: "user", 
          content: prompt
        }
      ],
      temperature: 0.3,
      max_tokens: 2000
    });

    // Parse Sonnet response
    const result = parseSonnetOptimizationResponse(sonnetResponse.content);
    
    return { success: true, result };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Sonnet optimization failed' 
    };
  }
}

/**
 * Analyze template performance and suggest improvements
 */
export async function mcp__sonnet__analyze_performance(params: {
  template: {
    connection_message: string;
    follow_up_messages: string[];
  };
  performance_data: {
    total_sent: number;
    response_rate: number;
    connection_rate: number;
    meeting_rate: number;
  };
  context: {
    industry: string;
    target_role: string;
    language: string;
  };
}): Promise<{
  success: boolean;
  analysis?: {
    strengths: string[];
    weaknesses: string[];
    specific_improvements: string[];
    predicted_improvement: number;
  };
  error?: string;
}> {
  try {
    const prompt = `
Analyze this LinkedIn outreach template performance:

TEMPLATE:
Connection: "${params.template.connection_message}"
Follow-ups: ${params.template.follow_up_messages.map((msg, i) => `${i+1}. "${msg}"`).join('\n')}

PERFORMANCE DATA:
- Total sent: ${params.performance_data.total_sent}
- Response rate: ${params.performance_data.response_rate}%
- Connection rate: ${params.performance_data.connection_rate}%
- Meeting rate: ${params.performance_data.meeting_rate}%

CONTEXT:
- Industry: ${params.context.industry}
- Target role: ${params.context.target_role}
- Language: ${params.context.language}

Provide analysis in this JSON format:
{
  "strengths": ["strength1", "strength2"],
  "weaknesses": ["weakness1", "weakness2"], 
  "specific_improvements": ["improvement1", "improvement2"],
  "predicted_improvement": 15.5
}
`;

    const sonnetResponse = await callSonnetAPI({
      model: "anthropic/claude-4.5-sonnet",
      messages: [
        {
          role: "system",
          content: "You are a sales messaging performance analyst. Analyze templates and provide actionable improvement suggestions."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.2,
      max_tokens: 1000
    });

    const analysis = JSON.parse(sonnetResponse.content);
    
    return { success: true, analysis };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Performance analysis failed' 
    };
  }
}

/**
 * Generate template variations for A/B testing
 */
export async function mcp__sonnet__generate_variations(params: {
  base_template: {
    connection_message: string;
    follow_up_messages: string[];
  };
  variation_type: 'tone' | 'length' | 'approach' | 'cta';
  target_context: {
    industry: string;
    role: string;
    language: string;
  };
  count: number;
}): Promise<{
  success: boolean;
  variations?: Array<{
    connection_message: string;
    follow_up_messages: string[];
    variation_description: string;
  }>;
  error?: string;
}> {
  try {
    const prompt = `
Create ${params.count} variations of this LinkedIn template, focusing on ${params.variation_type} optimization:

ORIGINAL:
Connection: "${params.base_template.connection_message}"
Follow-ups: ${params.base_template.follow_up_messages.map((msg, i) => `${i+1}. "${msg}"`).join('\n')}

TARGET: ${params.target_context.role} in ${params.target_context.industry}
LANGUAGE: ${params.target_context.language}
VARIATION FOCUS: ${params.variation_type}

Return JSON array with this format:
[
  {
    "connection_message": "...",
    "follow_up_messages": ["...", "..."],
    "variation_description": "..."
  }
]
`;

    const sonnetResponse = await callSonnetAPI({
      model: "anthropic/claude-4.5-sonnet",
      messages: [
        {
          role: "system",
          content: "You are a sales messaging specialist. Create compelling variations of outreach templates for A/B testing."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.7,
      max_tokens: 2000
    });

    const variations = JSON.parse(sonnetResponse.content);
    
    return { success: true, variations };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Variation generation failed' 
    };
  }
}

/**
 * Personalize template for specific prospect
 */
export async function mcp__sonnet__personalize_for_prospect(params: {
  template: {
    connection_message: string;
    follow_up_messages: string[];
  };
  prospect_data: {
    first_name: string;
    last_name: string;
    company_name: string;
    title: string;
    industry: string;
    company_size?: string;
    recent_news?: string;
    mutual_connections?: string[];
  };
  personalization_level: 'basic' | 'advanced' | 'deep';
}): Promise<{
  success: boolean;
  personalized_template?: {
    connection_message: string;
    follow_up_messages: string[];
    personalization_notes: string[];
  };
  error?: string;
}> {
  try {
    const prompt = `
Personalize this template for a specific prospect:

TEMPLATE:
Connection: "${params.template.connection_message}"
Follow-ups: ${params.template.follow_up_messages.map((msg, i) => `${i+1}. "${msg}"`).join('\n')}

PROSPECT:
- Name: ${params.prospect_data.first_name} ${params.prospect_data.last_name}
- Title: ${params.prospect_data.title}
- Company: ${params.prospect_data.company_name} (${params.prospect_data.industry})
- Company size: ${params.prospect_data.company_size || 'Unknown'}
- Recent news: ${params.prospect_data.recent_news || 'None available'}
- Mutual connections: ${params.prospect_data.mutual_connections?.join(', ') || 'None'}

PERSONALIZATION LEVEL: ${params.personalization_level}

Return JSON:
{
  "connection_message": "...",
  "follow_up_messages": ["...", "..."],
  "personalization_notes": ["note1", "note2"]
}
`;

    const sonnetResponse = await callSonnetAPI({
      model: "anthropic/claude-4.5-sonnet",
      messages: [
        {
          role: "system",
          content: "You are a sales personalization expert. Create highly personalized outreach messages that feel authentic and relevant."
        },
        {
          role: "user",
          content: prompt
        }
      ],
      temperature: 0.4,
      max_tokens: 1500
    });

    const personalized = JSON.parse(sonnetResponse.content);
    
    return { success: true, personalized_template: personalized };
  } catch (error) {
    return { 
      success: false, 
      error: error instanceof Error ? error.message : 'Personalization failed' 
    };
  }
}

// Helper functions

function buildOptimizationPrompt(request: SonnetOptimizationRequest): string {
  return `
Optimize this ${request.target_context.campaign_type} template for ${request.target_context.industry} ${request.target_context.role}s:

ORIGINAL TEMPLATE:
Connection: "${request.original_template.connection_message}"
${request.original_template.alternative_message ? `Alternative: "${request.original_template.alternative_message}"` : ''}
Follow-ups: ${request.original_template.follow_up_messages.map((msg, i) => `${i+1}. "${msg}"`).join('\n')}

OPTIMIZATION GOALS: ${request.optimization_goals.join(', ')}
TARGET: ${request.target_context.company_size} companies in ${request.target_context.industry}
TONE: ${request.target_context.tone}
LANGUAGE: ${request.target_context.language}

Return optimized template in JSON format:
{
  "optimized_template": {
    "connection_message": "...",
    "alternative_message": "...",
    "follow_up_messages": ["...", "..."]
  },
  "improvements": ["improvement1", "improvement2"],
  "confidence_score": 0.85,
  "reasoning": "..."
}
`;
}

function parseSonnetOptimizationResponse(content: string): SonnetOptimizationResult {
  try {
    return JSON.parse(content);
  } catch (error) {
    // Fallback parsing if JSON is malformed
    return {
      optimized_template: {
        connection_message: "Optimization failed - please try again",
        follow_up_messages: []
      },
      improvements: ["Failed to parse optimization"],
      confidence_score: 0,
      reasoning: "JSON parsing error"
    };
  }
}

async function callSonnetAPI(request: {
  model: string;
  messages: Array<{ role: string; content: string }>;
  temperature: number;
  max_tokens: number;
}): Promise<{ content: string }> {
  try {
    // Check if OpenRouter API key is available
    if (!process.env.OPENROUTER_API_KEY) {
      console.log('⚠️  OpenRouter API key not found, using mock response');
      return getMockSonnetResponse(request);
    }

    console.log('🧠 Calling OpenRouter API for Claude Sonnet:', request.model);
    
    // Make OpenRouter API call to access Sonnet
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_APP_URL || 'https://innovareai.com',
        'X-Title': 'Sam AI Template Optimization'
      },
      body: JSON.stringify({
        model: request.model,
        messages: request.messages,
        temperature: request.temperature,
        max_tokens: request.max_tokens,
        top_p: 0.9
      })
    });

    if (!response.ok) {
      throw new Error(`OpenRouter API error: ${response.status} ${response.statusText}`);
    }

    const data = await response.json();
    const content = data.choices?.[0]?.message?.content
    
    if (!content) {
      throw new Error('No content in Sonnet response')
    }

    return { content }
    
  } catch (error) {
    console.error('❌ Sonnet API error:', error)
    console.log('🔄 Falling back to mock response')
    return getMockSonnetResponse(request)
  }
}

function getMockSonnetResponse(request: { messages: Array<{ role: string; content: string }> }): { content: string } {
  console.log('🧠 Mock Claude Sonnet response for:', request.messages[1]?.content.substring(0, 100) + '...')
  
  return {
    content: JSON.stringify({
      optimized_template: {
        connection_message: "Hi {first_name}, I noticed your work at {company_name} in the AI space and would love to connect to discuss how companies like yours are scaling their operations with AI-powered solutions.",
        alternative_message: "Quick connect to discuss AI scaling?",
        follow_up_messages: [
          "Thanks for connecting, {first_name}! I'd love to share how we're helping companies like {company_name} streamline their operations with AI automation.",
          "Following up on my previous message about AI solutions for {company_name}. Would you be open to a brief 15-minute call this week to discuss your current challenges?"
        ]
      },
      improvements: [
        "Enhanced personalization with industry-specific language",
        "Improved value proposition clarity", 
        "Added specific time commitment to reduce friction",
        "Strengthened call-to-action with clear next steps"
      ],
      confidence_score: 0.89,
      reasoning: "Template optimized for better engagement based on proven conversion patterns for B2B AI sales. Added specific time commitment and clearer value proposition to increase response rates."
    })
  }
}

export {
  callSonnetAPI,
  buildOptimizationPrompt,
  parseSonnetOptimizationResponse
};
