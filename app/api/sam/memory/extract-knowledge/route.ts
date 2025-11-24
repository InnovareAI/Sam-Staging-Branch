/**
 * Memory Knowledge Extraction API
 * Automatically extracts important conversation snippets about product, ICP, etc. to knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';

// Knowledge categories for extraction - mapped to your knowledge base sections
const KNOWLEDGE_CATEGORIES = {
  INQUIRY_RESPONSES: {
    keywords: ['inquiry', 'question', 'ask', 'request', 'help', 'information', 'clarify', 'explain'],
    importance: 8,
    section: 'inquiry_responses'
  },
  OVERVIEW: {
    keywords: ['overview', 'summary', 'general', 'about', 'introduction', 'what is', 'description'],
    importance: 7,
    section: 'overview'
  },
  ICP_CONFIG: {
    keywords: ['ideal customer', 'target customer', 'customer profile', 'buyer persona', 'target audience', 'customer segment', 'icp'],
    importance: 10,
    section: 'icp_config'
  },
  PRODUCTS: {
    keywords: ['product', 'service', 'offering', 'solution', 'platform', 'feature', 'functionality', 'capability', 'specification'],
    importance: 9,
    section: 'products'
  },
  COMPETITION: {
    keywords: ['competitor', 'competition', 'alternative', 'versus', 'compared to', 'competitive', 'battlecard', 'differentiation'],
    importance: 8,
    section: 'competition'
  },
  MESSAGING: {
    keywords: ['message', 'messaging', 'template', 'email', 'sequence', 'script', 'framework', 'outreach'],
    importance: 8,
    section: 'messaging'
  },
  TONE_OF_VOICE: {
    keywords: ['tone', 'voice', 'style', 'brand voice', 'communication style', 'voice guidelines', 'brand personality'],
    importance: 7,
    section: 'tone_of_voice'
  },
  COMPANY_INFO: {
    keywords: ['company', 'team', 'background', 'partnership', 'corporate', 'organization', 'about us'],
    importance: 6,
    section: 'company_info'
  },
  SUCCESS_STORIES: {
    keywords: ['success', 'case study', 'testimonial', 'customer story', 'roi', 'results', 'outcome', 'achievement'],
    importance: 9,
    section: 'success_stories'
  },
  BUYING_PROCESS: {
    keywords: ['buying process', 'purchase', 'decision maker', 'procurement', 'stakeholder', 'approval', 'buying journey'],
    importance: 9,
    section: 'buying_process'
  },
  COMPLIANCE: {
    keywords: ['compliance', 'regulatory', 'guideline', 'approval', 'review', 'governance', 'policy', 'legal'],
    importance: 8,
    section: 'compliance'
  },
  PERSONAS_ROLES: {
    keywords: ['persona', 'role', 'job title', 'responsibility', 'pain point', 'motivation', 'decision criteria'],
    importance: 9,
    section: 'personas_roles'
  },
  OBJECTIONS: {
    keywords: ['objection', 'pushback', 'concern', 'hesitation', 'rebuttal', 'handle', 'overcome', 'resistance'],
    importance: 9,
    section: 'objections'
  },
  PRICING: {
    keywords: ['price', 'pricing', 'cost', 'budget', 'plan', 'tier', 'subscription', 'payment', 'roi calculator'],
    importance: 8,
    section: 'pricing'
  },
  SUCCESS_METRICS: {
    keywords: ['metric', 'benchmark', 'kpi', 'performance', 'indicator', 'goal', 'target', 'measurement', 'timeline'],
    importance: 7,
    section: 'success_metrics'
  },
  DOCUMENTS: {
    keywords: ['document', 'file', 'attachment', 'upload', 'resource', 'material', 'asset'],
    importance: 5,
    section: 'documents'
  }
};

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { conversation_id, force_extract = false } = await request.json();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!conversation_id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    // Get conversation data
    const { data: conversation, error: convError } = await supabase
      .from('sam_conversations')
      .select('*')
      .eq('id', conversation_id)
      .eq('user_id', session.user.id)
      .single();

    if (convError || !conversation) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    // Skip if already extracted (unless forced)
    if (conversation.knowledge_extracted && !force_extract) {
      return NextResponse.json({ 
        message: 'Knowledge already extracted from this conversation' 
      });
    }

    // Extract knowledge snippets
    const extractedKnowledge = await extractKnowledgeFromConversation(conversation);

    if (extractedKnowledge.length === 0) {
      // Mark as processed even if no knowledge found
      await supabase
        .from('sam_conversations')
        .update({ 
          knowledge_extracted: true,
          extraction_confidence: 0,
          updated_at: new Date().toISOString()
        })
        .eq('id', conversation_id);

      return NextResponse.json({ 
        message: 'No significant knowledge found in conversation',
        extracted_count: 0
      });
    }

    // Save to knowledge base
    const savedKnowledge = [];
    for (const knowledge of extractedKnowledge) {
      const { data: saved, error: saveError } = await supabase
        .from('knowledge_base_items')
        .insert({
          workspace_id: conversation.organization_id || 'default',
          content: knowledge.content,
          title: knowledge.title,
          item_type: 'conversation_extract',
          content_category: knowledge.category,
          tags: knowledge.tags,
          source_type: 'sam_conversation',
          source_metadata: {
            conversation_id: conversation_id,
            extracted_at: new Date().toISOString(),
            importance_score: knowledge.importance,
            original_message: knowledge.snippet,
            extraction_method: 'automated'
          },
          importance_score: knowledge.importance,
          status: 'approved', // Auto-approve conversation extracts
          approved_by: session.user.id,
          approved_at: new Date().toISOString()
        })
        .select()
        .single();

      if (!saveError && saved) {
        savedKnowledge.push(saved);
      }
    }

    // Update conversation as processed
    await supabase
      .from('sam_conversations')
      .update({
        knowledge_extracted: true,
        extraction_confidence: Math.max(...extractedKnowledge.map(k => k.importance)) / 10,
        updated_at: new Date().toISOString()
      })
      .eq('id', conversation_id);

    return NextResponse.json({
      success: true,
      extracted_count: savedKnowledge.length,
      knowledge_items: savedKnowledge.map(k => ({
        id: k.id,
        title: k.title,
        category: k.content_category,
        importance: k.importance_score
      })),
      message: `Extracted ${savedKnowledge.length} knowledge items from conversation`
    });

  } catch (error) {
    console.error('Knowledge extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to extract knowledge' },
      { status: 500 }
    );
  }
}

// Batch process multiple conversations
export async function PUT(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { max_conversations = 10 } = await request.json();

    // Check authentication
    const { data: { session }, error: authError } = await supabase.auth.getSession();
    if (authError || !session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Get unprocessed conversations
    const { data: conversations, error: convError } = await supabase
      .from('sam_conversations')
      .select('*')
      .eq('user_id', session.user.id)
      .eq('knowledge_extracted', false)
      .order('created_at', { ascending: false })
      .limit(max_conversations);

    if (convError) {
      return NextResponse.json({ error: convError.message }, { status: 500 });
    }

    let totalExtracted = 0;
    const results = [];

    for (const conversation of conversations || []) {
      try {
        const extractedKnowledge = await extractKnowledgeFromConversation(conversation);
        
        if (extractedKnowledge.length > 0) {
          // Save to knowledge base
          for (const knowledge of extractedKnowledge) {
            const { data: saved, error: saveError } = await supabase
              .from('knowledge_base_items')
              .insert({
                workspace_id: conversation.organization_id || 'default',
                content: knowledge.content,
                title: knowledge.title,
                item_type: 'conversation_extract',
                content_category: knowledge.category,
                tags: knowledge.tags,
                source_type: 'sam_conversation',
                source_metadata: {
                  conversation_id: conversation.id,
                  extracted_at: new Date().toISOString(),
                  importance_score: knowledge.importance,
                  original_message: knowledge.snippet,
                  extraction_method: 'batch_automated'
                },
                importance_score: knowledge.importance,
                status: 'approved',
                approved_by: session.user.id,
                approved_at: new Date().toISOString()
              })
              .select()
              .single();

            if (!saveError) {
              totalExtracted++;
            }
          }
        }

        // Mark as processed
        await supabase
          .from('sam_conversations')
          .update({
            knowledge_extracted: true,
            extraction_confidence: extractedKnowledge.length > 0 
              ? Math.max(...extractedKnowledge.map(k => k.importance)) / 10 
              : 0,
            updated_at: new Date().toISOString()
          })
          .eq('id', conversation.id);

        results.push({
          conversation_id: conversation.id,
          extracted_count: extractedKnowledge.length
        });

      } catch (error) {
        console.error(`Failed to process conversation ${conversation.id}:`, error);
        results.push({
          conversation_id: conversation.id,
          error: 'Processing failed'
        });
      }
    }

    return NextResponse.json({
      success: true,
      processed_conversations: conversations?.length || 0,
      total_extracted: totalExtracted,
      results
    });

  } catch (error) {
    console.error('Batch knowledge extraction error:', error);
    return NextResponse.json(
      { error: 'Failed to batch extract knowledge' },
      { status: 500 }
    );
  }
}

// Extract knowledge from a conversation
async function extractKnowledgeFromConversation(conversation: any): Promise<any[]> {
  const extractedItems = [];
  const fullText = `${conversation.message} ${conversation.response}`.toLowerCase();
  
  // Analyze each knowledge category
  for (const [categoryName, category] of Object.entries(KNOWLEDGE_CATEGORIES)) {
    const matchedKeywords = category.keywords.filter(keyword => 
      fullText.includes(keyword.toLowerCase())
    );

    if (matchedKeywords.length > 0) {
      // Extract relevant snippets
      const snippets = extractRelevantSnippets(
        conversation.message, 
        conversation.response, 
        matchedKeywords
      );

      for (const snippet of snippets) {
        if (snippet.length > 50) { // Only meaningful snippets
          extractedItems.push({
            content: generateKnowledgeContent(snippet, categoryName),
            title: generateKnowledgeTitle(snippet, categoryName),
            category: category.section,
            importance: category.importance,
            tags: [categoryName.toLowerCase(), ...matchedKeywords],
            snippet: snippet
          });
        }
      }
    }
  }

  // Remove duplicates and sort by importance
  return extractedItems
    .filter((item, index, arr) => 
      arr.findIndex(other => other.content === item.content) === index
    )
    .sort((a, b) => b.importance - a.importance)
    .slice(0, 5); // Limit to top 5 items per conversation
}

// Extract relevant text snippets around keywords
function extractRelevantSnippets(userMessage: string, response: string, keywords: string[]): string[] {
  const snippets = [];
  const sentences = (userMessage + ' ' + response).split(/[.!?]+/);

  for (const sentence of sentences) {
    const lowerSentence = sentence.toLowerCase();
    if (keywords.some(keyword => lowerSentence.includes(keyword.toLowerCase()))) {
      const trimmed = sentence.trim();
      if (trimmed.length > 20) {
        snippets.push(trimmed);
      }
    }
  }

  return snippets;
}

// Generate structured knowledge content
function generateKnowledgeContent(snippet: string, category: string): string {
  const timestamp = new Date().toISOString().split('T')[0];
  
  return `## ${category} Information (Extracted from Conversation)

**Date:** ${timestamp}

**Content:**
${snippet}

**Source:** SAM AI Conversation
**Extraction Method:** Automated keyword analysis
**Category:** ${category}

---
*This information was automatically extracted from a conversation and may require review for accuracy and completeness.*`;
}

// Generate knowledge title
function generateKnowledgeTitle(snippet: string, category: string): string {
  const words = snippet.split(' ').slice(0, 8).join(' ');
  return `${category}: ${words}${snippet.split(' ').length > 8 ? '...' : ''}`;
}