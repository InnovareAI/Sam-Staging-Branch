import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

/**
 * POST /api/admin/reprocess-pdfs
 *
 * Re-processes failed PDF documents using OpenRouter Gemini API
 *
 * Body: { workspace_id: string }
 */

export const maxDuration = 300; // 5 minutes for processing multiple PDFs

// OpenRouter API for vision/PDF extraction using Gemini
async function callOpenRouterVision(base64Data: string, mimeType: string, prompt: string): Promise<string> {
  const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.OPENROUTER_API_KEY}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://app.meet-sam.com',
      'X-Title': 'SAM AI Platform'
    },
    body: JSON.stringify({
      model: 'google/gemini-flash-1.5',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: {
                url: `data:${mimeType};base64,${base64Data}`
              }
            },
            {
              type: 'text',
              text: prompt
            }
          ]
        }
      ],
      max_tokens: 16000
    })
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(`OpenRouter API error: ${JSON.stringify(error)}`);
  }

  const result = await response.json();
  return result.choices?.[0]?.message?.content || '';
}

export async function POST(request: NextRequest) {
  try {
    const { workspace_id } = await request.json();

    if (!workspace_id) {
      return NextResponse.json({ error: 'workspace_id is required' }, { status: 400 });
    }

    // Create service-role client
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    // Find all failed PDFs (content contains the error message)
    const { data: failedDocs, error: fetchError } = await supabase
      .from('knowledge_base')
      .select('id, title, source_metadata')
      .eq('workspace_id', workspace_id)
      .like('content', '%GoogleGenerativeAI Error%');

    if (fetchError) {
      console.error('Error fetching failed documents:', fetchError);
      return NextResponse.json({ error: 'Failed to fetch documents' }, { status: 500 });
    }

    if (!failedDocs || failedDocs.length === 0) {
      return NextResponse.json({
        message: 'No failed PDFs found to reprocess',
        processed: 0
      });
    }

    console.log(`📄 Found ${failedDocs.length} failed PDFs to reprocess`);

    const results = {
      total: failedDocs.length,
      success: 0,
      failed: 0,
      details: [] as any[]
    };

    // Process each failed document
    for (const doc of failedDocs) {
      try {
        console.log(`\n📝 Processing: ${doc.title}`);

        // Check if we have the original file stored in Supabase Storage
        const sourceMetadata = doc.source_metadata as any;

        // For now, we'll mark these as needing re-upload since we don't have the original files
        // The original PDF binary wasn't stored, only metadata

        // Update the document to indicate it needs re-upload
        const { error: updateError } = await supabase
          .from('knowledge_base')
          .update({
            content: `[PDF Needs Re-upload]\n\nThis document was uploaded on ${sourceMetadata?.uploaded_at || 'unknown date'} but the text extraction failed.\n\nOriginal filename: ${doc.title}\nFile size: ${sourceMetadata?.file_size || 'unknown'} bytes\n\nPlease re-upload this document to extract its content using the new OpenRouter Gemini API.`,
            updated_at: new Date().toISOString()
          })
          .eq('id', doc.id);

        if (updateError) {
          console.error(`❌ Failed to update ${doc.title}:`, updateError);
          results.failed++;
          results.details.push({ id: doc.id, title: doc.title, status: 'failed', error: updateError.message });
        } else {
          console.log(`✅ Marked ${doc.title} for re-upload`);
          results.success++;
          results.details.push({ id: doc.id, title: doc.title, status: 'needs_reupload' });
        }

      } catch (error) {
        console.error(`❌ Error processing ${doc.title}:`, error);
        results.failed++;
        results.details.push({
          id: doc.id,
          title: doc.title,
          status: 'error',
          error: error instanceof Error ? error.message : 'Unknown error'
        });
      }
    }

    console.log(`\n📊 Reprocessing complete: ${results.success} marked for re-upload, ${results.failed} errors`);

    return NextResponse.json({
      message: `Processed ${results.total} documents. ${results.success} marked for re-upload.`,
      note: 'Original PDF files were not stored. Documents have been marked for re-upload.',
      results
    });

  } catch (error) {
    console.error('Reprocess PDFs error:', error);
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
