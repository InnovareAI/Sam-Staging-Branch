import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@supabase/auth-helpers-nextjs';
import { cookies } from 'next/headers';
import fs from 'fs';
import path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Document content extraction functions
async function extractContentFromFile(filePath: string, mimeType: string): Promise<string> {
  try {
    if (mimeType.includes('text/')) {
      // Text files
      return fs.readFileSync(filePath, 'utf-8');
    } else if (mimeType.includes('application/pdf')) {
      // PDF files - would need PDF parser library like pdf-parse
      // For now, return placeholder - implement pdf-parse integration
      return `[PDF Content Extraction] - Implement pdf-parse library for PDF processing`;
    } else if (mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      // DOCX files - would need docx parser
      return `[DOCX Content Extraction] - Implement docx library for Word document processing`;
    } else if (mimeType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
      // PPTX files - would need pptx parser
      return `[PPTX Content Extraction] - Implement pptx library for PowerPoint processing`;
    } else {
      // Generic text extraction
      return fs.readFileSync(filePath, 'utf-8');
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
    const supabase = createRouteHandlerClient({ cookies: cookies });
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

      // Create temporary file
      const tempDir = path.join(process.cwd(), 'temp');
      if (!fs.existsSync(tempDir)) {
        fs.mkdirSync(tempDir, { recursive: true });
      }

      const tempFilePath = path.join(tempDir, `${uuidv4()}-${filename}`);
      
      // Save file to temp location
      const bytes = await file.arrayBuffer();
      const buffer = Buffer.from(bytes);
      fs.writeFileSync(tempFilePath, buffer);

      try {
        extractedContent = await extractContentFromFile(tempFilePath, mimeType);
      } finally {
        // Clean up temp file
        if (fs.existsSync(tempFilePath)) {
          fs.unlinkSync(tempFilePath);
        }
      }
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
        section,
        filename,
        original_filename: filename,
        file_type: mimeType || 'text/plain',
        file_size: fileSize,
        storage_path: `inline://${documentId}`,
        extracted_content: extractedContent,
        metadata: {
          upload_mode: uploadMode,
          source_url: uploadMode === 'url' ? url : null
        },
        mime_type: mimeType || 'text/plain',
        upload_mode: uploadMode,
        source_url: uploadMode === 'url' ? url : null,
        uploaded_by: userId,
        created_at: new Date().toISOString(),
        status: 'extracted'
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
