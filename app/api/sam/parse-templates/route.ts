/**
 * SAM AI Template Parsing API
 * Analyzes and parses user-provided outreach templates
 * Updated Dec 31, 2025: Migrated to verifyAuth
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool } from '@/lib/auth';
import {
  detectLanguageFromContent,
  getPersonalizationGuidelines,
  getLanguageSpecificRecommendations
} from '@/utils/linkedin-personalization-languages';

interface TemplateParseRequest {
  user_input: string;
  conversation_context?: {
    thread_id: string;
    campaign_type?: string;
    target_audience?: string;
    campaign_goals?: string[];
  };
  parse_options?: {
    auto_optimize?: boolean;
    suggest_improvements?: boolean;
    include_performance_data?: boolean;
  };
}

interface ParsedTemplate {
  type: 'connection_request' | 'follow_up_1' | 'follow_up_2' | 'follow_up_3' | 'email' | 'other';
  content: string;
  variables: string[];
  estimated_length: number;
  platform_compliance: {
    linkedin: boolean;
    email: boolean;
    character_count: number;
  };
  optimization_suggestions: string[];
  confidence_score: number;
}

export async function POST(req: NextRequest) {
  try {
    const auth = await verifyAuth(req);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;

    // Parse and validate request body
    let requestBody;
    try {
      requestBody = await req.json();
    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid JSON in request body' },
        { status: 400 }
      );
    }

    const {
      user_input,
      conversation_context,
      parse_options = {}
    }: TemplateParseRequest = requestBody;

    // Input validation and sanitization
    const validationErrors = validateTemplateParseInput({
      user_input,
      conversation_context,
      parse_options
    });

    if (validationErrors.length > 0) {
      return NextResponse.json(
        {
          error: 'Invalid input data',
          validation_errors: validationErrors
        },
        { status: 400 }
      );
    }

    // Sanitize user input
    const sanitizedInput = sanitizeUserInput(user_input);

    // Parse the user input for templates
    const parseResult = await parseTemplatesFromInput(sanitizedInput, {
      conversation_context,
      parse_options,
      user_id: user.uid
    });

    // Generate Sam's intelligent response
    const samResponse = await generateSamTemplateResponse(parseResult, user_input);

    return NextResponse.json({
      success: true,
      sam_response: samResponse,
      parsed_templates: parseResult.templates,
      template_sequence: parseResult.sequence,
      suggestions: parseResult.suggestions,
      performance_insights: parseResult.performance_insights,
      metadata: {
        parsed_at: new Date().toISOString(),
        templates_count: parseResult.templates.length,
        optimization_applied: parse_options.auto_optimize || false
      }
    });

  } catch (error: any) {
    console.error('Template parsing error:', error);
    return NextResponse.json(
      { error: 'Failed to parse templates', details: error.message },
      { status: 500 }
    );
  }
}

async function parseTemplatesFromInput(input: string, context: any) {
  const templates: ParsedTemplate[] = [];
  const suggestions: string[] = [];
  let sequence: string[] = [];

  // Detect if user is pasting multiple messages or a sequence
  const sections = splitIntoTemplates(input);

  for (let i = 0; i < sections.length; i++) {
    const section = sections[i];
    const templateType = detectTemplateType(section, i);
    const variables = extractVariables(section);
    const optimizationSuggestions = generateOptimizationSuggestions(section, templateType);

    const template: ParsedTemplate = {
      type: templateType,
      content: section.trim(),
      variables,
      estimated_length: section.length,
      platform_compliance: {
        linkedin: section.length <= 300,
        email: section.length <= 2000,
        character_count: section.length
      },
      optimization_suggestions: optimizationSuggestions,
      confidence_score: calculateConfidenceScore(section, templateType)
    };

    templates.push(template);
    sequence.push(templateType);
  }

  // Add intelligent suggestions based on context
  if (context.conversation_context?.campaign_type) {
    suggestions.push(...generateContextualSuggestions(templates, context.conversation_context));
  }

  // Get performance insights if requested
  let performance_insights: any = null;
  if (context.parse_options.include_performance_data) {
    performance_insights = await getPerformanceInsights(templates, context.user_id);
  }

  return {
    templates,
    sequence,
    suggestions,
    performance_insights
  };
}

function splitIntoTemplates(input: string): string[] {
  // Handle various common separators users might use
  const separators = [
    /\n\s*---+\s*\n/g,           // --- separators
    /\n\s*===+\s*\n/g,           // === separators
    /\n\s*\d+\.\s*\n/g,          // 1. 2. 3. numbering
    /\n\s*Message\s*\d+:?\s*\n/gi, // Message 1: Message 2:
    /\n\s*Follow[- ]?up\s*\d*:?\s*\n/gi, // Follow-up 1: Follow up:
    /\n\s*Connection:?\s*\n/gi,   // Connection:
    /\n\s*Email:?\s*\n/gi         // Email:
  ];

  let sections = [input];

  // Try each separator pattern
  for (const separator of separators) {
    const newSections: string[] = [];
    for (const section of sections) {
      const parts = section.split(separator);
      newSections.push(...parts);
    }
    sections = newSections;
  }

  // Filter out empty sections and clean up
  return sections
    .filter(section => section.trim().length > 10)
    .map(section => section.trim());
}

function detectTemplateType(content: string, index: number): ParsedTemplate['type'] {
  const lowerContent = content.toLowerCase();

  // Check for explicit indicators
  if (lowerContent.includes('connect') && lowerContent.includes('request') ||
    lowerContent.includes('connection') ||
    (index === 0 && content.length <= 300)) {
    return 'connection_request';
  }

  if (lowerContent.includes('follow') && lowerContent.includes('up') ||
    lowerContent.includes('follow-up')) {
    if (index === 1) return 'follow_up_1';
    if (index === 2) return 'follow_up_2';
    if (index === 3) return 'follow_up_3';
    return 'follow_up_1';
  }

  if (lowerContent.includes('email') || content.length > 500) {
    return 'email';
  }

  // Default based on position in sequence
  if (index === 0) return 'connection_request';
  if (index === 1) return 'follow_up_1';
  if (index === 2) return 'follow_up_2';
  if (index === 3) return 'follow_up_3';

  return 'other';
}

function extractVariables(content: string): string[] {
  const variables: string[] = [];

  // Common variable patterns
  const patterns = [
    /\{([^}]+)\}/g,                    // {first_name}
    /\[\[([^\]]+)\]\]/g,               // [[first_name]]
    /\$\{([^}]+)\}/g,                  // ${first_name}
    /\[([A-Z_][A-Z0-9_]*)\]/g,        // [FIRST_NAME]
  ];

  for (const pattern of patterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const variable = match[1].toLowerCase().replace(/\s+/g, '_');
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }
  }

  // Also detect implicit variables (words that should be personalized)
  const implicitPatterns = [
    /\b(first name|last name|company name|job title|industry)\b/gi,
    /\b(name|company|role|position|title)\b/gi
  ];

  for (const pattern of implicitPatterns) {
    const matches = content.matchAll(pattern);
    for (const match of matches) {
      const variable = match[0].toLowerCase().replace(/\s+/g, '_');
      if (!variables.includes(variable)) {
        variables.push(variable);
      }
    }
  }

  return variables;
}

function generateOptimizationSuggestions(content: string, type: string): string[] {
  const suggestions: string[] = [];

  // Length optimization
  if (type === 'connection_request' && content.length > 275) {
    suggestions.push('Connection request is too long for LinkedIn (275 char limit). Consider shortening.');
  }

  if (type.startsWith('follow_up') && content.length > 8000) {
    suggestions.push('Message is quite long. Consider breaking into multiple shorter messages.');
  }

  // Personalization suggestions
  if (!content.includes('{') && !content.includes('[')) {
    suggestions.push('Add personalization variables like {first_name} or {company_name} to increase response rates.');
  }

  // Call-to-action suggestions
  if (!content.match(/\?|call|chat|meet|discuss|connect|schedule/i)) {
    suggestions.push('Consider adding a clear call-to-action or question to encourage responses.');
  }

  // Tone analysis
  if (content.split('.').length < 2) {
    suggestions.push('Consider breaking long sentences into shorter, more readable ones.');
  }

  return suggestions;
}

function calculateConfidenceScore(content: string, type: string): number {
  let score = 0.7; // Base score

  // Length appropriateness
  if (type === 'connection_request') {
    if (content.length >= 50 && content.length <= 275) score += 0.2;
    else score -= 0.1;
  } else if (type.startsWith('follow_up')) {
    if (content.length >= 100 && content.length <= 1000) score += 0.1;
    else score -= 0.05;
  }

  // Personalization presence
  if (content.includes('{') || content.includes('[')) score += 0.1;

  // Professional tone indicators
  if (content.match(/\b(Hi|Hello|Dear|Thank you|Thanks|Best regards|Sincerely)\b/i)) score += 0.05;

  // Call-to-action presence
  if (content.match(/\?|would you|are you|call|chat|meet|discuss/i)) score += 0.1;

  return Math.min(1.0, Math.max(0.0, score));
}

function generateContextualSuggestions(templates: ParsedTemplate[], context: any): string[] {
  const suggestions: string[] = [];

  if (context.campaign_type === 'sales' && templates.length === 1) {
    suggestions.push('For sales campaigns, consider adding 2-3 follow-up messages to increase conversion rates.');
  }

  if (context.campaign_type === 'recruitment' && !templates.some(t => t.content.includes('opportunit'))) {
    suggestions.push('For recruitment, emphasize career growth opportunities in your messaging.');
  }

  if (context.target_audience === 'executives' && templates.some(t => t.content.length < 100)) {
    suggestions.push('Executive outreach often performs better with more substantial, value-focused messages.');
  }

  return suggestions;
}

async function getPerformanceInsights(templates: ParsedTemplate[], userId: string): Promise<any> {
  // This would query historical performance data
  // For now, return mock insights based on template characteristics
  return {
    estimated_response_rates: {
      connection_request: templates.find(t => t.type === 'connection_request') ?
        calculateResponseRate(templates.find(t => t.type === 'connection_request')!) : null,
      follow_ups: templates.filter(t => t.type.startsWith('follow_up')).map(t =>
        calculateResponseRate(t)
      )
    },
    optimization_potential: 'medium',
    similar_templates_performance: 'Above average',
    recommended_improvements: [
      'Add more specific value propositions',
      'Include industry-specific language',
      'Consider A/B testing different CTAs'
    ]
  };
}

function calculateResponseRate(template: ParsedTemplate): number {
  let baseRate = 0.15; // 15% base response rate

  // Adjust based on template characteristics
  if (template.variables.length > 2) baseRate += 0.05; // Personalization bonus
  if (template.content.includes('?')) baseRate += 0.03; // Question bonus
  if (template.platform_compliance.linkedin) baseRate += 0.02; // Compliance bonus
  if (template.confidence_score > 0.8) baseRate += 0.04; // Quality bonus

  return Math.min(0.40, baseRate); // Cap at 40%
}

function validateTemplateParseInput(data: any): string[] {
  const errors: string[] = [];

  // Validate user_input
  if (!data.user_input || typeof data.user_input !== 'string') {
    errors.push('user_input is required and must be a string');
  } else if (data.user_input.trim().length < 5) {
    errors.push('user_input must be at least 5 characters long');
  } else if (data.user_input.length > 50000) {
    errors.push('user_input cannot exceed 50,000 characters');
  }

  // Validate conversation_context if provided
  if (data.conversation_context) {
    if (typeof data.conversation_context !== 'object') {
      errors.push('conversation_context must be an object');
    } else {
      if (data.conversation_context.thread_id && typeof data.conversation_context.thread_id !== 'string') {
        errors.push('conversation_context.thread_id must be a string');
      }
      if (data.conversation_context.campaign_type && typeof data.conversation_context.campaign_type !== 'string') {
        errors.push('conversation_context.campaign_type must be a string');
      }
    }
  }

  // Validate parse_options if provided
  if (data.parse_options) {
    if (typeof data.parse_options !== 'object') {
      errors.push('parse_options must be an object');
    } else {
      if (data.parse_options.auto_optimize !== undefined && typeof data.parse_options.auto_optimize !== 'boolean') {
        errors.push('parse_options.auto_optimize must be a boolean');
      }
      if (data.parse_options.suggest_improvements !== undefined && typeof data.parse_options.suggest_improvements !== 'boolean') {
        errors.push('parse_options.suggest_improvements must be a boolean');
      }
    }
  }

  return errors;
}

function sanitizeUserInput(input: string): string {
  if (!input || typeof input !== 'string') {
    return '';
  }

  // Remove potentially dangerous characters and scripts
  let sanitized = input
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '') // Remove script tags
    .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '') // Remove style tags
    .replace(/javascript:/gi, '') // Remove javascript: protocols
    .replace(/on\w+\s*=/gi, '') // Remove event handlers
    .replace(/\0/g, ''); // Remove null bytes

  // Limit length and normalize whitespace
  sanitized = sanitized.slice(0, 50000).trim();

  // Normalize line endings
  sanitized = sanitized.replace(/\r\n/g, '\n').replace(/\r/g, '\n');

  return sanitized;
}

async function generateSamTemplateResponse(parseResult: any, originalInput: string): Promise<string> {
  const { templates, suggestions, sequence } = parseResult;

  // Language detection and cultural guidance
  const detectedLanguage = detectLanguageFromContent(originalInput);
  const guidelines = getPersonalizationGuidelines(detectedLanguage);
  const languageRecommendations = getLanguageSpecificRecommendations(originalInput, detectedLanguage);

  let response = `Great! I've analyzed your message templates and here's what I found:\n\n`;

  // Language and cultural context
  if (detectedLanguage !== 'en') {
    response += `🌍 **Language Detected: ${guidelines.language}** (${guidelines.formality} communication style)\n`;
    if (languageRecommendations.length > 0) {
      response += `⚠️ **Cultural Notes:** ${languageRecommendations.slice(0, 2).join('; ')}\n\n`;
    }
  }

  // Template analysis
  response += `📝 **Parsed ${templates.length} template${templates.length > 1 ? 's' : ''}:**\n`;
  templates.forEach((template: ParsedTemplate, index: number) => {
    const typeLabel = template.type.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase());
    response += `${index + 1}. **${typeLabel}** (${template.content.length} chars, ${Math.round(template.confidence_score * 100)}% confidence)\n`;

    if (template.variables.length > 0) {
      response += `   • Variables detected: ${template.variables.join(', ')}\n`;
    }

    if (template.optimization_suggestions.length > 0) {
      response += `   • Suggestions: ${template.optimization_suggestions[0]}\n`;
    }
  });

  // Language-specific personalization guidance
  if (detectedLanguage !== 'en') {
    response += `\n🎯 **${guidelines.language} Personalization Variables:**\n`;
    response += `• Essential: ${guidelines.commonVariables.slice(0, 4).join(', ')}\n`;
    response += `• Addressing: ${guidelines.addressingStyle}\n`;

    if (guidelines.culturalNotes.length > 0) {
      response += `\n💼 **${guidelines.language} Business Culture:**\n`;
      guidelines.culturalNotes.slice(0, 3).forEach(note => {
        response += `• ${note}\n`;
      });
    }
  }

  // Sequence analysis
  if (templates.length > 1) {
    response += `\n🔄 **Template Sequence:** ${sequence.join(' → ')}\n`;
  }

  // Performance insights
  if (parseResult.performance_insights) {
    response += `\n📊 **Performance Insights:**\n`;
    response += `• Estimated response rate: ${Math.round(parseResult.performance_insights.estimated_response_rates.connection_request * 100)}%\n`;
    response += `• Optimization potential: ${parseResult.performance_insights.optimization_potential}\n`;
  }

  // Combined suggestions (template + language)
  const allSuggestions = [...suggestions];
  if (languageRecommendations.length > 0) {
    allSuggestions.push(...languageRecommendations.map(rec => `${guidelines.language}: ${rec}`));
  }

  if (allSuggestions.length > 0) {
    response += `\n💡 **My Suggestions:**\n`;
    allSuggestions.slice(0, 4).forEach(suggestion => {
      response += `• ${suggestion}\n`;
    });
  }

  // Language-specific character efficiency tips
  if (detectedLanguage !== 'en' && guidelines.characterEfficiency.tips.length > 0) {
    response += `\n⚡ **${guidelines.language} Character Efficiency:**\n`;
    guidelines.characterEfficiency.tips.slice(0, 2).forEach(tip => {
      response += `• ${tip}\n`;
    });
  }

  response += `\n✨ **Next Steps:**\n`;
  response += `• Save these templates to your campaign\n`;
  response += `• Apply optimizations I've suggested\n`;
  if (detectedLanguage !== 'en') {
    response += `• Follow ${guidelines.language} cultural guidelines\n`;
  }
  response += `• Test with A/B variations\n`;
  response += `• I can help you refine any of these templates further!\n`;

  if (detectedLanguage !== 'en') {
    response += `\nWould you like me to help optimize these templates for ${guidelines.language} business culture or create variations for A/B testing?`;
  } else {
    response += `\nWould you like me to optimize any specific template or create variations for A/B testing?`;
  }

  return response;
}