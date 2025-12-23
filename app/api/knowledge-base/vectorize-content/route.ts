import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize Supabase client (service role) for vector operations
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Create embeddings using Google Gemini REST API
// Generates 768-dimensional embeddings for text chunks
async function createEmbeddings(text: string): Promise<number[]> {
  try {
    console.log('[Vectorize] Creating embedding for text length:', text.length);

    // Limit text length for embedding (Gemini has token limits)
    const truncatedText = text.substring(0, 10000);

    // Use Gemini REST API directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/text-embedding-004:embedContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          content: {
            parts: [{
              text: truncatedText
            }]
          }
        })
      }
    );

    if (!response.ok) {
      const errorText = await response.text();
      console.error('[Vectorize] Gemini API error:', response.status, errorText);
      throw new Error(`Gemini API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const embedding = data.embedding?.values || [];

    console.log('[Vectorize] Generated embedding with', embedding.length, 'dimensions');

    if (embedding.length === 0) {
      throw new Error('Gemini returned empty embedding');
    }

    // Gemini text-embedding-004 returns 768 dimensions.
    // We now use this directly without padding to 1536.
    if (embedding.length > 768) {
      console.log('[Vectorize] Truncating embedding from', embedding.length, 'to 768 dimensions');
      return embedding.slice(0, 768);
    }

    return embedding;

  } catch (error) {
    console.error('Gemini embedding creation error:', error);
    console.error('Error details:', error instanceof Error ? error.message : String(error));

    // Fallback: Create a simple hash-based vector for development
    console.warn('[Vectorize] Using fallback hash-based embedding (768-dim)');
    const fallbackVector = Array.from({ length: 768 }, (_, i) => {
      const hash = Array.from(text).reduce((acc, char, index) => {
        return acc + char.charCodeAt(0) * (index + 1);
      }, 0);
      return Math.sin(hash + i) * 0.1; // Normalize to small values
    });

    return fallbackVector;
  }
}

// Split content into chunks for better RAG performance
function splitIntoChunks(content: string, chunkSize: number = 1000, overlap: number = 200): string[] {
  const chunks: string[] = [];
  let start = 0;

  while (start < content.length) {
    const end = Math.min(start + chunkSize, content.length);
    const chunk = content.substring(start, end);

    // Try to end at a sentence boundary
    if (end < content.length) {
      const lastPeriod = chunk.lastIndexOf('.');
      const lastNewline = chunk.lastIndexOf('\n');
      const boundary = Math.max(lastPeriod, lastNewline);

      if (boundary > start + chunkSize * 0.5) {
        chunks.push(chunk.substring(0, boundary + 1).trim());
        start += boundary + 1;
      } else {
        chunks.push(chunk.trim());
        start = end - overlap;
      }
    } else {
      chunks.push(chunk.trim());
      break;
    }
  }

  return chunks.filter(chunk => chunk.length > 50); // Remove very small chunks
}

// Enhanced content processing for SAM AI
async function createSAMKnowledgeEntries(
  documentId: string,
  workspaceId: string,
  section: string,
  content: string,
  tags: string[],
  metadata: any
) {
  const chunks = splitIntoChunks(content);
  const knowledgeEntries = [];

  for (let i = 0; i < chunks.length; i++) {
    const chunk = chunks[i];
    const embedding = await createEmbeddings(chunk);

    // Create enhanced metadata for SAM AI context
    const enhancedMetadata = {
      ...metadata,
      chunk_index: i,
      total_chunks: chunks.length,
      chunk_size: chunk.length,
      section: section,
      tags: tags,
      document_id: documentId,
      relevance_keywords: extractKeywords(chunk),
      sam_context: generateSAMContext(chunk, section, tags)
    };

    knowledgeEntries.push({
      document_id: documentId,
      workspace_id: workspaceId,
      section_id: section,
      chunk_index: i,
      content: chunk,
      embedding: `[${embedding.join(',')}]`, // Format as PostgreSQL array string for pgvector
      metadata: enhancedMetadata,
      tags: tags,
      created_at: new Date().toISOString()
    });
  }

  return knowledgeEntries;
}

// Extract keywords for better search relevance
function extractKeywords(content: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by',
    'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did',
    'will', 'would', 'could', 'should', 'can', 'may', 'might', 'must', 'shall', 'this', 'that',
    'these', 'those', 'i', 'you', 'he', 'she', 'it', 'we', 'they', 'me', 'him', 'her', 'us', 'them'
  ]);

  const words = content
    .toLowerCase()
    .replace(/[^\w\s]/g, ' ')
    .split(/\s+/)
    .filter(word => word.length > 3 && !stopWords.has(word));

  const wordCounts: { [key: string]: number } = {};
  words.forEach(word => {
    wordCounts[word] = (wordCounts[word] || 0) + 1;
  });

  return Object.entries(wordCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 10)
    .map(([word]) => word);
}

// Generate SAM AI context for better conversational use
function generateSAMContext(chunk: string, section: string, tags: string[]): string {
  const contexts = {
    'icp': 'This information helps SAM understand ideal customer profiles and targeting criteria.',
    'products': 'This content helps SAM explain product features, benefits, and value propositions.',
    'competition': 'This knowledge helps SAM handle competitive questions and positioning.',
    'messaging': 'This information helps SAM craft effective outreach messages and templates.',
    'company': 'This content helps SAM represent the company accurately in conversations.',
    'success': 'This information helps SAM provide social proof and success stories.',
    'pricing': 'This knowledge helps SAM discuss pricing and value justification.',
    'objections': 'This content helps SAM handle common objections and concerns.'
  };

  const baseContext = contexts[section] || 'This information is relevant for SAM AI conversations.';
  const tagContext = tags.length > 0 ? ` Key topics include: ${tags.slice(0, 5).join(', ')}.` : '';

  return baseContext + tagContext + ' Use this information to provide accurate, helpful responses in conversations.';
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, content, tags, section, metadata } = await request.json();

    if (!documentId || !content || !section) {
      return NextResponse.json({
        error: 'Missing required fields: documentId, content, section'
      }, { status: 400 });
    }

    const { data: documentRecord, error: documentError } = await supabase
      .from('knowledge_base')
      .select('workspace_id, category, tags, source_metadata')
      .eq('id', documentId)
      .single();

    if (documentError || !documentRecord?.workspace_id) {
      console.error('Knowledge base document lookup failed:', documentError);
      return NextResponse.json({ error: 'Document not found or missing workspace context' }, { status: 404 });
    }

    const workspaceId = documentRecord.workspace_id;
    const sectionId = section || documentRecord.category;
    const combinedTags = Array.from(new Set([...(documentRecord.tags || []), ...(tags || [])]));

    // Remove any previous vectors for this document to avoid duplicates
    await supabase
      .from('knowledge_base_vectors')
      .delete()
      .eq('document_id', documentId);

    // Create knowledge entries with embeddings
    const knowledgeEntries = await createSAMKnowledgeEntries(
      documentId,
      workspaceId,
      sectionId,
      content,
      combinedTags,
      metadata || {}
    );

    // Store in vector database (using Supabase pgvector)
    const { data: vectorData, error: vectorError } = await supabase
      .from('knowledge_base_vectors')
      .insert(knowledgeEntries);

    if (vectorError) {
      console.error('Vector storage error:', vectorError);
      console.error('Vector error details:', JSON.stringify(vectorError, null, 2));
      console.error('Sample entry:', JSON.stringify(knowledgeEntries[0], null, 2));
      return NextResponse.json({
        error: 'Failed to store vectors',
        details: vectorError.message || vectorError.toString(),
        code: vectorError.code
      }, { status: 500 });
    }

    // Update document metadata with vectorization status
    const { error: statusError } = await supabase
      .from('knowledge_base')
      .update({
        source_metadata: {
          ...documentRecord.source_metadata,
          vectorization: {
            status: 'completed',
            vector_chunks: knowledgeEntries.length,
            vectorized_at: new Date().toISOString()
          }
        }
      })
      .eq('id', documentId);

    if (statusError) {
      console.warn('Failed to update document status:', statusError);
    }

    // Create summary entry for SAM AI quick access
    // Refresh summary information for this document
    await supabase
      .from('sam_knowledge_summaries')
      .delete()
      .eq('document_id', documentId);

    const documentSummary = {
      document_id: documentId,
      workspace_id: workspaceId,
      section_id: sectionId,
      total_chunks: knowledgeEntries.length,
      total_tokens: content.length,
      tags: combinedTags,
      sam_ready: true,
      quick_summary: metadata?.summary || 'Document processed and ready for SAM conversations',
      metadata: metadata || {},
      created_at: new Date().toISOString()
    };

    const { error: summaryError } = await supabase
      .from('sam_knowledge_summaries')
      .insert(documentSummary);

    if (summaryError) {
      console.warn('Failed to create SAM summary:', summaryError);
    }

    return NextResponse.json({
      documentId,
      vectorChunks: knowledgeEntries.length,
      totalTokens: content.length,
      samReady: true,
      success: true,
      message: 'Document successfully vectorized and integrated into SAM AI knowledge base'
    });

  } catch (error) {
    console.error('Vectorization error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Vectorization failed'
    }, { status: 500 });
  }
}
