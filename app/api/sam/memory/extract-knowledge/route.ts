/**
 * Memory Knowledge Extraction API
 * Automatically extracts important conversation snippets about product, ICP, etc. to knowledge base
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';

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
    const { userId } = await verifyAuth(request);
    const { conversation_id, force_extract = false } = await request.json();

    if (!conversation_id) {
      return NextResponse.json({ error: 'Conversation ID required' }, { status: 400 });
    }

    // Get conversation data
    const { rows: convRows } = await pool.query(
      'SELECT * FROM sam_conversations WHERE id = $1 AND user_id = $2',
      [conversation_id, userId]
    );

    if (convRows.length === 0) {
      return NextResponse.json({ error: 'Conversation not found' }, { status: 404 });
    }

    const conversation = convRows[0];

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
      await pool.query(
        `UPDATE sam_conversations SET
          knowledge_extracted = true,
          extraction_confidence = 0,
          updated_at = NOW()
        WHERE id = $1`,
        [conversation_id]
      );

      return NextResponse.json({
        message: 'No significant knowledge found in conversation',
        extracted_count: 0
      });
    }

    // Save to knowledge base
    const savedKnowledge = [];
    for (const knowledge of extractedKnowledge) {
      const { rows: savedRows } = await pool.query(
        `INSERT INTO knowledge_base_items (
          workspace_id, content, title, item_type, content_category,
          tags, source_type, source_metadata, importance_score,
          status, approved_by, approved_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())
        RETURNING *`,
        [
          conversation.organization_id || 'default',
          knowledge.content,
          knowledge.title,
          'conversation_extract',
          knowledge.category,
          knowledge.tags,
          'sam_conversation',
          JSON.stringify({
            conversation_id: conversation_id,
            extracted_at: new Date().toISOString(),
            importance_score: knowledge.importance,
            original_message: knowledge.snippet,
            extraction_method: 'automated'
          }),
          knowledge.importance,
          'approved',
          userId
        ]
      );

      if (savedRows.length > 0) {
        savedKnowledge.push(savedRows[0]);
      }
    }

    // Update conversation as processed
    await pool.query(
      `UPDATE sam_conversations SET
        knowledge_extracted = true,
        extraction_confidence = $1,
        updated_at = NOW()
      WHERE id = $2`,
      [Math.max(...extractedKnowledge.map(k => k.importance)) / 10, conversation_id]
    );

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
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
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
    const { userId } = await verifyAuth(request);
    const { max_conversations = 10 } = await request.json();

    // Get unprocessed conversations
    const { rows: conversations } = await pool.query(
      `SELECT * FROM sam_conversations
       WHERE user_id = $1 AND knowledge_extracted = false
       ORDER BY created_at DESC
       LIMIT $2`,
      [userId, max_conversations]
    );

    let totalExtracted = 0;
    const results = [];

    for (const conversation of conversations) {
      try {
        const extractedKnowledge = await extractKnowledgeFromConversation(conversation);

        if (extractedKnowledge.length > 0) {
          // Save to knowledge base
          for (const knowledge of extractedKnowledge) {
            const { rowCount } = await pool.query(
              `INSERT INTO knowledge_base_items (
                workspace_id, content, title, item_type, content_category,
                tags, source_type, source_metadata, importance_score,
                status, approved_by, approved_at
              ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, NOW())`,
              [
                conversation.organization_id || 'default',
                knowledge.content,
                knowledge.title,
                'conversation_extract',
                knowledge.category,
                knowledge.tags,
                'sam_conversation',
                JSON.stringify({
                  conversation_id: conversation.id,
                  extracted_at: new Date().toISOString(),
                  importance_score: knowledge.importance,
                  original_message: knowledge.snippet,
                  extraction_method: 'batch_automated'
                }),
                knowledge.importance,
                'approved',
                userId
              ]
            );

            if (rowCount && rowCount > 0) {
              totalExtracted++;
            }
          }
        }

        // Mark as processed
        await pool.query(
          `UPDATE sam_conversations SET
            knowledge_extracted = true,
            extraction_confidence = $1,
            updated_at = NOW()
          WHERE id = $2`,
          [
            extractedKnowledge.length > 0
              ? Math.max(...extractedKnowledge.map(k => k.importance)) / 10
              : 0,
            conversation.id
          ]
        );

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
      processed_conversations: conversations.length,
      total_extracted: totalExtracted,
      results
    });

  } catch (error) {
    if ((error as AuthError).code) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message }, { status: authError.statusCode });
    }
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
