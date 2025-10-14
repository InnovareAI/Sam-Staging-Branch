import { NextRequest, NextResponse } from 'next/server';
import { createSupabaseRouteClient } from '@/lib/supabase-route-client';
import { v4 as uuidv4 } from 'uuid';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

// Document content extraction functions
async function extractContentFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    if (mimeType.includes('text/')) {
      return new TextDecoder().decode(buffer);
    } else if (mimeType.includes('application/pdf')) {
      const pdfParse = (await import('pdf-parse')).default;
      const pdfData = await pdfParse(buffer);
      return pdfData.text;
    } else if (mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      return `[DOCX Content Extraction] - Implement docx library for Word document processing`;
    } else if (mimeType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
      return `[PPTX Content Extraction] - Implement pptx library for PowerPoint processing`;
    } else {
      return new TextDecoder().decode(buffer);
    }
  } catch (error) {
    console.error('Content extraction error:', error);
    throw new Error('Failed to extract content from file');
  }
}

async function extractContentFromURL(url: string): Promise<string> {
  try {
    // Implement web scraping for URLs
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch URL: ${response.statusText}`);
    }
    
    const contentType = response.headers.get('content-type');
    
    if (contentType?.includes('text/html')) {
      // Basic HTML extraction - would implement proper HTML parser like cheerio
      const html = await response.text();
      // Strip HTML tags for basic text extraction
      const textContent = html.replace(/<[^>]*>/g, ' ').replace(/\s+/g, ' ').trim();
      return textContent;
    } else if (contentType?.includes('application/pdf')) {
      // PDF URL - would need to download and process
      return `[PDF URL Processing] - Implement PDF download and extraction`;
    } else {
      // Plain text or other formats
      return await response.text();
    }
  } catch (error) {
    console.error('URL extraction error:', error);
    throw new Error('Failed to extract content from URL');
  }
}

export async function POST(request: NextRequest) {
  try {
    const supabase = await createSupabaseRouteClient();
    const { data: { session }, error: authError } = await supabase.auth.getSession();

    if (authError || !session?.user) {
      return NextResponse.json({ error: 'Authentication required' }, { status: 401 });
    }

    const userId = session.user.id;

    const { data: userProfile, error: profileError } = await supabase
      .from('users')
      .select('current_workspace_id')
      .eq('id', userId)
      .single();

    if (profileError) {
      console.error('Failed to load user workspace profile:', profileError);
      return NextResponse.json({ error: 'Unable to determine workspace' }, { status: 500 });
    }

    const workspaceId = userProfile?.current_workspace_id;

    if (!workspaceId) {
      return NextResponse.json({ error: 'Please select a workspace before uploading knowledge base documents.' }, { status: 400 });
    }

    // Ensure KB sections are initialized for this workspace
    await supabase.rpc('initialize_knowledge_base_sections', {
      p_workspace_id: workspaceId
    });

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const section = formData.get('section') as string;
    const uploadMode = formData.get('uploadMode') as string;

    if (!section) {
      return NextResponse.json({ error: 'Section is required' }, { status: 400 });
    }

    if (uploadMode === 'file' && !file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    if (uploadMode === 'url' && !url) {
      return NextResponse.json({ error: 'No URL provided' }, { status: 400 });
    }

    let extractedContent: string;
    let filename: string;
    let mimeType: string;
    let fileSize: number = 0;

    if (uploadMode === 'file' && file) {
      // Handle file upload
      filename = file.name;
      mimeType = file.type;
      fileSize = file.size;

      if (fileSize > MAX_FILE_SIZE) {
        return NextResponse.json({
          error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
        }, { status: 400 });
      }

      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      extractedContent = await extractContentFromFile(buffer, mimeType);
    } else if (uploadMode === 'url' && url) {
      // Handle URL processing
      filename = new URL(url).pathname.split('/').pop() || 'web-content';
      mimeType = 'text/html';
      extractedContent = await extractContentFromURL(url);
      fileSize = extractedContent.length;
    } else {
      return NextResponse.json({ error: 'Invalid upload mode' }, { status: 400 });
    }

    // Generate document ID
    const documentId = uuidv4();

    // Store document metadata in Supabase
    const { data: document, error: dbError } = await supabase
      .from('knowledge_base_documents')
      .insert({
        id: documentId,
        workspace_id: workspaceId,
        section_id: section,
        filename,
        original_filename: filename,
        file_type: mimeType || 'text/plain',
        file_size: fileSize,
        storage_path: `inline://${documentId}`,
        extracted_content: extractedContent,
        metadata: {
          upload_mode: uploadMode,
          source_url: uploadMode === 'url' ? url : null,
          mime_type: mimeType || 'text/plain',
          status: 'extracted'
        },
        uploaded_by: userId
      })
      .select('id, workspace_id, section_id')
      .single();

    if (dbError) {
      console.error('Database error:', dbError);
      return NextResponse.json({ error: 'Failed to store document' }, { status: 500 });
    }

    return NextResponse.json({
      documentId,
      content: extractedContent,
      filename,
      section,
      extractedLength: extractedContent.length,
      workspaceId,
      success: true
    });

  } catch (error) {
    console.error('Upload error:', error);
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : 'Upload failed' 
    }, { status: 500 });
  }
}
