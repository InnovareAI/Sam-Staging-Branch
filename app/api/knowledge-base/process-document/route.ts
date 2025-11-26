import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

// Initialize service-role Supabase client for background processing
const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// Claude Sonnet 4.5 processing using OpenRouter
async function processWithClaude(content: string, section: string, filename: string) {
  const systemPrompt = `You are an AI document analysis expert. Analyze the provided document content and extract structured information for a knowledge base system.

Your task is to:
1. Generate relevant tags and categories
2. Extract key insights and themes
3. Identify content type and purpose
4. Create a summary
5. Determine relevance to the specified knowledge base section

Return your analysis in this exact JSON format:
{
  "tags": ["tag1", "tag2", "tag3", ...],
  "categories": ["category1", "category2", ...],
  "content_type": "document_type",
  "key_insights": ["insight1", "insight2", ...],
  "summary": "Brief summary of the document",
  "relevance_score": 0.95,
  "suggested_section": "section_name",
  "metadata": {
    "language": "en",
    "complexity": "intermediate",
    "topics": ["topic1", "topic2"],
    "business_value": "high"
  }
}

Knowledge Base Section: ${section}
Filename: ${filename}`;

  const userPrompt = `Analyze this document content:

${content.substring(0, 100000)}${content.length > 100000 ? '...' : ''}`;

  try {
    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': process.env.NEXT_PUBLIC_SITE_URL || 'https://app.meet-sam.com',
        'X-Title': 'SAM AI Knowledge Base'
      },
      body: JSON.stringify({
        model: 'anthropic/claude-sonnet-4.5',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.3,
        max_tokens: 4000
      })
    });

    if (!response.ok) {
      throw new Error(`Claude API error: ${response.statusText}`);
    }

    const data = await response.json();
    const aiResponse = data.choices[0]?.message?.content;

    if (!aiResponse) {
      throw new Error('No response from Claude AI');
    }

    // Parse the JSON response
    const analysisMatch = aiResponse.match(/\{[\s\S]*\}/);
    if (!analysisMatch) {
      throw new Error('Invalid JSON response from Claude AI');
    }

    const analysis = JSON.parse(analysisMatch[0]);
    
    // Validate and ensure required fields
    return {
      tags: analysis.tags || [],
      categories: analysis.categories || [],
      content_type: analysis.content_type || 'document',
      key_insights: analysis.key_insights || [],
      summary: analysis.summary || 'Document processed successfully',
      relevance_score: analysis.relevance_score || 0.8,
      suggested_section: analysis.suggested_section || section,
      metadata: {
        language: analysis.metadata?.language || 'en',
        complexity: analysis.metadata?.complexity || 'intermediate',
        topics: analysis.metadata?.topics || [],
        business_value: analysis.metadata?.business_value || 'medium',
        processed_at: new Date().toISOString(),
        model_used: 'anthropic/claude-sonnet-4.5'
      }
    };

  } catch (error) {
    console.error('Claude processing error:', error);
    
    // Fallback: Generate basic tags from content
    const words = content.toLowerCase().split(/\s+/);
    const commonWords = new Set(['the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for', 'of', 'with', 'by', 'is', 'are', 'was', 'were', 'be', 'been', 'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'could', 'should']);
    
    const fallbackTags = words
      .filter(word => word.length > 3 && !commonWords.has(word))
      .reduce((acc: {[key: string]: number}, word) => {
        acc[word] = (acc[word] || 0) + 1;
        return acc;
      }, {});
    
    const topTags = Object.entries(fallbackTags)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10)
      .map(([word]) => word);

    return {
      tags: topTags,
      categories: [section],
      content_type: 'document',
      key_insights: ['Content processed with fallback method'],
      summary: `Document contains ${words.length} words and has been processed for the ${section} section.`,
      relevance_score: 0.7,
      suggested_section: section,
      metadata: {
        language: 'en',
        complexity: 'unknown',
        topics: topTags.slice(0, 5),
        business_value: 'medium',
        processed_at: new Date().toISOString(),
        model_used: 'fallback',
        error: error instanceof Error ? error.message : 'Processing error'
      }
    };
  }
}

export async function POST(request: NextRequest) {
  try {
    const { documentId, content, section, filename } = await request.json();

    if (!documentId || !content || !section) {
      return NextResponse.json({ 
        error: 'Missing required fields: documentId, content, section' 
      }, { status: 400 });
    }

    // Fetch document metadata to ensure workspace context exists
    const { data: documentRecord, error: documentError } = await supabase
      .from('knowledge_base')
      .select('workspace_id, category, source_metadata')
      .eq('id', documentId)
      .single();

    if (documentError || !documentRecord?.workspace_id) {
      console.error('Document lookup failed:', documentError);
      return NextResponse.json({ error: 'Document not found or missing workspace context' }, { status: 404 });
    }

    const resolvedSection = section || documentRecord.category;

    // Process content with Claude Sonnet 4.5
    const analysis = await processWithClaude(content, resolvedSection, filename);

    // Update document with AI analysis results
    const { data: updatedDocument, error: updateError } = await supabase
      .from('knowledge_base')
      .update({
        tags: analysis.tags,
        source_metadata: {
          ...documentRecord.source_metadata,
          ai_analysis: {
            categories: analysis.categories,
            content_type: analysis.content_type,
            key_insights: analysis.key_insights,
            summary: analysis.summary,
            relevance_score: analysis.relevance_score,
            suggested_section: analysis.suggested_section,
            metadata: analysis.metadata,
            processed_at: new Date().toISOString()
          }
        }
      })
      .eq('id', documentId)
      .select()
      .single();

    if (updateError) {
      console.error('Database update error:', updateError);
      return NextResponse.json({ error: 'Failed to update document' }, { status: 500 });
    }

    // Also store in a separate AI analysis table for tracking
    const { error: analysisError } = await supabase
      .from('document_ai_analysis')
      .insert({
        document_id: documentId,
        workspace_id: documentRecord.workspace_id,
        analysis_type: 'content_processing',
        model_used: analysis.metadata.model_used,
        tags: analysis.tags,
        categories: analysis.categories,
        key_insights: analysis.key_insights,
        summary: analysis.summary,
        relevance_score: analysis.relevance_score,
        metadata: analysis.metadata,
        created_at: new Date().toISOString()
      });

    if (analysisError) {
      console.warn('Failed to store AI analysis:', analysisError);
      // Don't fail the request, just log the warning
    }

    return NextResponse.json({
      documentId,
      tags: analysis.tags,
      categories: analysis.categories,
      summary: analysis.summary,
      relevance_score: analysis.relevance_score,
      metadata: analysis.metadata,
      success: true
    });

  } catch (error) {
    console.error('Processing error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Processing failed' 
    }, { status: 500 });
  }
}
