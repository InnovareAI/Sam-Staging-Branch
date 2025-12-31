/**
 * Knowledge Base Document Upload API
 *
 * Updated Nov 29, 2025: Migrated to Claude Direct API for GDPR compliance
 * Updated Dec 31, 2025: Migrated to Firebase auth
 */

import { NextRequest, NextResponse } from 'next/server';
import { verifyAuth, pool, AuthError } from '@/lib/auth';
import { v4 as uuidv4 } from 'uuid';
import { claudeClient } from '@/lib/llm/claude-client';

const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50MB

// Use shared Claude client for vision/PDF extraction
async function callClaudeVision(base64Data: string, mimeType: string, prompt: string): Promise<string> {
  return claudeClient.vision({
    imageBase64: base64Data,
    mimeType,
    prompt,
    maxTokens: 16000
  });
}

// Document content extraction functions
async function extractContentFromFile(buffer: Buffer, mimeType: string): Promise<string> {
  try {
    console.log('[Upload] Extracting content from file, mimeType:', mimeType, 'buffer size:', buffer.length);

    if (mimeType.includes('text/')) {
      return new TextDecoder().decode(buffer);
    } else if (mimeType.includes('image/')) {
      // Handle image files (PNG, JPG, GIF, WEBP, etc.)
      console.log('[Upload] Processing image file with Claude Vision...');

      try {
        const base64Image = buffer.toString('base64');
        const content = await callClaudeVision(
          base64Image,
          mimeType,
          'Extract all text from this image and describe its visual elements. Format your response as:\n\nText Content:\n[extracted text]\n\nVisual Elements:\n[describe key visual elements, diagrams, charts, etc.]'
        );

        console.log('[Upload] Image processed with Claude Vision - Content length:', content.length);
        return `[Visual Content]\n\n${content}`;

      } catch (error) {
        console.error('[Upload] Claude Vision API error for image:', error);
        return `[Image Uploaded]\n\nNote: Image analysis encountered an issue (${error instanceof Error ? error.message : 'Unknown error'}). The image has been stored and can be manually processed later.`;
      }
    } else if (mimeType.includes('application/pdf')) {
      console.log('[Upload] Attempting PDF extraction with Claude...');

      try {
        const base64Pdf = buffer.toString('base64');
        const extractedText = await callClaudeVision(
          base64Pdf,
          'application/pdf',
          'Extract all text content from this PDF document. Return only the text, preserving the original structure and formatting as much as possible.'
        );

        console.log('[Upload] PDF text extracted successfully with Claude, length:', extractedText.length);

        if (!extractedText || extractedText.trim().length === 0) {
          console.warn('[Upload] PDF appears to be empty or contains only images');
          return '[PDF Uploaded - No text content detected]\n\nThis PDF was processed but no extractable text was found. It may contain only images or be a scanned document.';
        }

        return extractedText;

      } catch (error) {
        console.error('[Upload] Claude PDF extraction error:', error);
        return `[PDF Document Uploaded]\n\nNote: Text extraction encountered an issue (${error instanceof Error ? error.message : 'Unknown error'}). The PDF has been stored and can be manually processed later.`;
      }
    } else if (mimeType.includes('application/vnd.openxmlformats-officedocument.wordprocessingml.document')) {
      return `[DOCX Content Extraction] - Implement docx library for Word document processing`;
    } else if (mimeType.includes('application/vnd.openxmlformats-officedocument.presentationml.presentation')) {
      return `[PPTX Content Extraction] - Implement pptx library for PowerPoint processing`;
    } else {
      console.log('[Upload] Unknown mime type, treating as text');
      return new TextDecoder().decode(buffer);
    }
  } catch (error) {
    console.error('[Upload] Content extraction error:', error);
    console.error('[Upload] Error details:', error instanceof Error ? error.message : String(error));
    console.error('[Upload] Error stack:', error instanceof Error ? error.stack : 'No stack trace');
    throw new Error(`Failed to extract content from file: ${error instanceof Error ? error.message : 'Unknown error'}`);
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
    // Firebase auth verification
    let userId: string;
    let workspaceId: string;

    try {
      const auth = await verifyAuth(request);
      userId = auth.userId;
      workspaceId = auth.workspaceId;
    } catch (error) {
      const authError = error as AuthError;
      return NextResponse.json({ error: authError.message || 'Authentication required' }, { status: authError.statusCode || 401 });
    }

    // Ensure KB sections are initialized for this workspace
    try {
      await pool.query('SELECT initialize_knowledge_base_sections($1)', [workspaceId]);
    } catch (rpcError) {
      console.error('RPC initialize_knowledge_base_sections error:', rpcError);
      // Continue anyway - sections might already exist
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;
    const url = formData.get('url') as string | null;
    const section = formData.get('section') as string;
    const uploadMode = formData.get('uploadMode') as string;
    const icpId = formData.get('icp_id') as string | null; // Optional ICP assignment

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

    // Store document in knowledge_base table (NOT knowledge_base_documents)
    // icp_id: null = global content (all ICPs), UUID = ICP-specific content
    const insertResult = await pool.query(
      `INSERT INTO knowledge_base (
        id, workspace_id, category, subcategory, title, content, tags, version, is_active, icp_id, source_attachment_id, source_type, source_metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
      RETURNING id, workspace_id, category, icp_id`,
      [
        documentId,
        workspaceId,
        section, // section maps to category
        null,
        filename,
        extractedContent,
        [],
        '1.0',
        true,
        icpId || null, // null = applies to all ICPs
        null,
        'document_upload',
        JSON.stringify({
          upload_mode: uploadMode,
          source_url: uploadMode === 'url' ? url : null,
          mime_type: mimeType || 'text/plain',
          file_size: fileSize,
          original_filename: filename,
          uploaded_by: userId,
          icp_id: icpId || null // Store in metadata for reference
        })
      ]
    );

    if (insertResult.rows.length === 0) {
      console.error('Document was not created - no data returned from INSERT');
      return NextResponse.json({
        error: 'Document creation failed - no data returned',
        details: 'INSERT succeeded but no document ID returned'
      }, { status: 500 });
    }

    const document = insertResult.rows[0];
    console.log('[Upload] Document created successfully:', document.id);

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
    console.error('Upload error stack:', error instanceof Error ? error.stack : 'No stack trace');
    return NextResponse.json({
      error: error instanceof Error ? error.message : 'Upload failed',
      details: error instanceof Error ? error.stack : String(error)
    }, { status: 500 });
  }
}
