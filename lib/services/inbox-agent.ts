/**
 * Inbox Agent Service
 *
 * Handles AI-powered message categorization and intent detection
 */

import { createClient } from '@supabase/supabase-js';
import Anthropic from '@anthropic-ai/sdk';

const getSupabase = () => createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface Message {
  id: string;
  content: string;
  sender_name?: string;
  sender_email?: string;
  subject?: string;
  source: 'linkedin' | 'email' | 'gmail' | 'outlook';
  received_at?: string;
}

interface CategorizationResult {
  category_slug: string;
  category_name: string;
  detected_intent: string;
  confidence_score: number;
  ai_reasoning: string;
  suggested_response?: string;
}

interface InboxAgentConfig {
  enabled: boolean;
  categorization_enabled: boolean;
  auto_categorize_new_messages: boolean;
  response_suggestions_enabled: boolean;
  suggest_for_categories: string[];
  ai_model: string;
  categorization_instructions: string;
}

const SYSTEM_CATEGORIES = [
  { slug: 'interested', name: 'Interested', action: 'reply' },
  { slug: 'question', name: 'Question', action: 'reply' },
  { slug: 'objection', name: 'Objection', action: 'reply' },
  { slug: 'meeting_request', name: 'Meeting Request', action: 'reply' },
  { slug: 'not_interested', name: 'Not Interested', action: 'archive' },
  { slug: 'out_of_office', name: 'Out of Office', action: 'follow_up' },
  { slug: 'referral', name: 'Referral', action: 'reply' },
  { slug: 'follow_up', name: 'Follow Up', action: 'follow_up' },
  { slug: 'spam', name: 'Spam/Irrelevant', action: 'ignore' },
  { slug: 'uncategorized', name: 'Uncategorized', action: 'reply' },
];

export async function categorizeMessage(
  workspaceId: string,
  message: Message,
  config: InboxAgentConfig
): Promise<CategorizationResult> {
  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY,
  });

  const categoryList = SYSTEM_CATEGORIES
    .map(c => `- ${c.slug}: ${c.name}`)
    .join('\n');

  const systemPrompt = `You are an AI assistant that categorizes incoming sales/business messages.

Available categories:
${categoryList}

${config.categorization_instructions || ''}

Analyze the message and respond with a JSON object containing:
{
  "category_slug": "one of the category slugs above",
  "detected_intent": "brief description of the sender's intent",
  "confidence_score": 0.0-1.0,
  "reasoning": "brief explanation of your categorization"
}

Be accurate and consistent. Consider the full context of the message.`;

  const userPrompt = `Categorize this message:

From: ${message.sender_name || 'Unknown'} ${message.sender_email ? `<${message.sender_email}>` : ''}
${message.subject ? `Subject: ${message.subject}` : ''}
Source: ${message.source}

Message:
${message.content}`;

  try {
    const response = await anthropic.messages.create({
      model: mapModelName(config.ai_model),
      max_tokens: 500,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      throw new Error('Unexpected response type');
    }

    // Parse JSON from response
    const jsonMatch = content.text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('No JSON found in response');
    }

    const result = JSON.parse(jsonMatch[0]);
    const category = SYSTEM_CATEGORIES.find(c => c.slug === result.category_slug)
      || SYSTEM_CATEGORIES.find(c => c.slug === 'uncategorized')!;

    return {
      category_slug: result.category_slug || 'uncategorized',
      category_name: category.name,
      detected_intent: result.detected_intent || 'Unknown',
      confidence_score: Math.min(1, Math.max(0, result.confidence_score || 0.5)),
      ai_reasoning: result.reasoning || '',
      suggested_response: undefined, // Will be generated separately if enabled
    };
  } catch (error) {
    console.error('Categorization failed:', error);
    return {
      category_slug: 'uncategorized',
      category_name: 'Uncategorized',
      detected_intent: 'Could not determine intent',
      confidence_score: 0,
      ai_reasoning: `Categorization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export async function generateResponseSuggestion(
  workspaceId: string,
  message: Message,
  category: CategorizationResult,
  config: InboxAgentConfig
): Promise<string | null> {
  if (!config.response_suggestions_enabled) {
    return null;
  }

  if (!config.suggest_for_categories.includes(category.category_slug)) {
    return null;
  }

  const anthropic = new Anthropic({
    apiKey: process.env.ANTHROPIC_API_KEY || process.env.OPENROUTER_API_KEY,
  });

  const systemPrompt = `You are an AI assistant helping craft professional responses to incoming messages.

The message has been categorized as: ${category.category_name}
Detected intent: ${category.detected_intent}

Generate a brief, professional response suggestion that:
1. Addresses the sender's intent directly
2. Maintains a professional yet friendly tone
3. Is concise (2-4 sentences max)
4. Includes a clear next step or call to action

Do not include placeholders like [Name] - write the response ready to send.`;

  const userPrompt = `Original message from ${message.sender_name || 'the sender'}:
${message.content}

Generate a response suggestion:`;

  try {
    const response = await anthropic.messages.create({
      model: mapModelName(config.ai_model),
      max_tokens: 300,
      system: systemPrompt,
      messages: [
        { role: 'user', content: userPrompt }
      ],
    });

    const content = response.content[0];
    if (content.type !== 'text') {
      return null;
    }

    return content.text.trim();
  } catch (error) {
    console.error('Response suggestion failed:', error);
    return null;
  }
}

export async function saveCategorizationResult(
  workspaceId: string,
  message: Message,
  result: CategorizationResult,
  aiModel: string
): Promise<void> {
  const supabase = getSupabase();

  // Get category ID from slug
  const { data: categoryData } = await supabase
    .from('inbox_message_categories')
    .select('id')
    .eq('slug', result.category_slug)
    .or(`is_system.eq.true,workspace_id.eq.${workspaceId}`)
    .single();

  await supabase
    .from('inbox_message_tags')
    .upsert({
      workspace_id: workspaceId,
      message_id: message.id,
      message_source: message.source,
      category_id: categoryData?.id || null,
      detected_intent: result.detected_intent,
      confidence_score: result.confidence_score,
      ai_reasoning: result.ai_reasoning,
      ai_model: aiModel,
      suggested_response: result.suggested_response,
      is_manual_override: false,
    }, {
      onConflict: 'workspace_id,message_id,message_source'
    });
}

export async function getInboxAgentConfig(workspaceId: string): Promise<InboxAgentConfig | null> {
  const supabase = getSupabase();

  const { data, error } = await supabase
    .from('workspace_inbox_agent_config')
    .select('*')
    .eq('workspace_id', workspaceId)
    .single();

  if (error || !data) {
    return null;
  }

  return data as InboxAgentConfig;
}

export async function processIncomingMessage(
  workspaceId: string,
  message: Message
): Promise<CategorizationResult | null> {
  const config = await getInboxAgentConfig(workspaceId);

  if (!config || !config.enabled || !config.categorization_enabled) {
    return null;
  }

  // Categorize the message
  const result = await categorizeMessage(workspaceId, message, config);

  // Generate response suggestion if enabled
  if (config.response_suggestions_enabled) {
    result.suggested_response = await generateResponseSuggestion(
      workspaceId,
      message,
      result,
      config
    ) || undefined;
  }

  // Save the result
  await saveCategorizationResult(workspaceId, message, result, config.ai_model);

  return result;
}

function mapModelName(model: string): string {
  const modelMap: Record<string, string> = {
    'claude-3-5-sonnet': 'claude-sonnet-4-20250514',
    'claude-opus-4-5-20251101': 'claude-opus-4-5-20251101',
    'gpt-4': 'gpt-4',
    'gpt-3.5-turbo': 'gpt-3.5-turbo',
  };

  return modelMap[model] || 'claude-sonnet-4-20250514';
}
