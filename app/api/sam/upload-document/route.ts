/**
 * SAM Document Upload API
 * Handles file uploads, text extraction, and AI-powered document intelligence
 * Updated Dec 31, 2025: Migrated to verifyAuth and pool.query
 */

import { NextRequest, NextResponse } from 'next/server'
import { verifyAuth, pool } from '@/lib/auth'
import { createClient } from '@supabase/supabase-js'
import { processDocumentWithContext } from '@/lib/document-intelligence'
import type { DocumentAnalysis } from '@/lib/document-intelligence'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'image/webp',
  'text/plain',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
]

// Initialize Supabase admin client for storage operations
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const user = auth.user;

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const threadId = formData.get('threadId') as string
    const messageId = formData.get('messageId') as string | null
    const attachmentType = (formData.get('attachmentType') as string) || 'other'
    const userNotes = formData.get('userNotes') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!threadId) {
      return NextResponse.json({ error: 'Thread ID required' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json({
        error: `File type ${file.type} not allowed. Allowed types: ${ALLOWED_TYPES.join(', ')}`
      }, { status: 400 })
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({
        error: `File too large. Maximum size: ${MAX_FILE_SIZE / 1024 / 1024}MB`
      }, { status: 400 })
    }

    // Verify user owns the thread
    const threadRes = await pool.query(
      'SELECT user_id, workspace_id FROM sam_conversation_threads WHERE id = $1',
      [threadId]
    );
    const thread = threadRes.rows[0];

    if (!thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    if (thread.user_id !== user.uid) {
      return NextResponse.json({ error: 'Unauthorized access to thread' }, { status: 403 })
    }

    // Generate storage path: user_id/thread_id/filename
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${user.uid}/${threadId}/${timestamp}-${sanitizedFilename}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage using admin client
    const { error: uploadError } = await supabaseAdmin
      .storage
      .from('sam-attachments')
      .upload(storagePath, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({
        error: 'Failed to upload file',
        details: uploadError.message
      }, { status: 500 })
    }

    // Extract text from PDF if applicable
    let extractedText: string | null = null
    let extractedMetadata: any = {}
    let processingStatus = 'completed'
    let errorMessage: string | null = null
    let documentAnalysis: DocumentAnalysis | null = null

    if (file.type === 'application/pdf') {
      try {
        const pdfParse = (await import('pdf-parse')).default
        const pdfData = await pdfParse(buffer)
        extractedText = pdfData.text
        extractedMetadata = {
          pageCount: pdfData.numpages,
          info: pdfData.info,
          metadata: pdfData.metadata,
          version: pdfData.version
        }
      } catch (pdfError) {
        console.error('PDF extraction error:', pdfError)
        processingStatus = 'failed'
        errorMessage = pdfError instanceof Error ? pdfError.message : 'PDF extraction failed'
      }
    } else if (file.type === 'text/plain') {
      try {
        extractedText = new TextDecoder().decode(buffer)
      } catch (textError) {
        console.error('Text extraction error:', textError)
        processingStatus = 'failed'
        errorMessage = textError instanceof Error ? textError.message : 'Text extraction failed'
      }
    } else if (file.type.startsWith('image/')) {
      extractedMetadata = {
        type: 'image',
        size: file.size,
        mimeType: file.type
      }
    }

    // Save attachment record to database
    const attachmentRes = await pool.query(
      `INSERT INTO sam_conversation_attachments (
        thread_id, message_id, user_id, workspace_id, file_name, 
        file_type, file_size, mime_type, storage_path, storage_bucket, 
        processing_status, extracted_text, extracted_metadata, 
        attachment_type, user_notes, error_message, processed_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, NOW())
      RETURNING *`,
      [
        threadId, messageId, user.uid, thread.workspace_id, file.name,
        file.type, file.size, file.type, storagePath, 'sam-attachments',
        processingStatus, extractedText, JSON.stringify(extractedMetadata),
        attachmentType, userNotes, errorMessage
      ]
    );
    const attachment = attachmentRes.rows[0];

    // AI-powered document intelligence analysis
    if (extractedText && extractedText.length > 50 && thread.workspace_id) {
      try {
        console.log(`🤖 Analyzing document with AI: ${file.name}`)
        documentAnalysis = await processDocumentWithContext({
          extractedText,
          fileName: file.name,
          fileType: file.type,
          workspaceId: thread.workspace_id,
          userId: user.uid,
          sessionId: threadId,
          userProvidedType: attachmentType !== 'other' ? attachmentType : undefined,
          attachmentId: attachment.id
        })

        // Update attachment metadata with analysis results
        const updatedMetadata = {
          ...extractedMetadata,
          documentAnalysis: {
            documentType: documentAnalysis.documentType,
            confidence: documentAnalysis.confidence,
            summary: documentAnalysis.summary,
            extractedData: documentAnalysis.extractedData,
            suggestedKBSections: documentAnalysis.suggestedKBSections,
            qaPairsCount: documentAnalysis.qaPairs.length
          }
        }

        // Update the attachment record
        await pool.query(
          'UPDATE sam_conversation_attachments SET extracted_metadata = $1 WHERE id = $2',
          [JSON.stringify(updatedMetadata), attachment.id]
        );

        extractedMetadata = updatedMetadata
        console.log(`✅ Document analysis complete: ${documentAnalysis.documentType}`)
      } catch (analysisError) {
        console.error('Document intelligence analysis failed:', analysisError)
        extractedMetadata = {
          ...extractedMetadata,
          analysisError: analysisError instanceof Error ? analysisError.message : 'Analysis failed'
        }
      }
    }

    // Get signed URL for temporary access
    const { data: signedUrlData } = await supabaseAdmin
      .storage
      .from('sam-attachments')
      .createSignedUrl(storagePath, 3600)

    return NextResponse.json({
      success: true,
      attachment: {
        id: attachment.id,
        file_name: attachment.file_name,
        file_type: attachment.file_type,
        file_size: attachment.file_size,
        attachment_type: attachment.attachment_type,
        processing_status: attachment.processing_status,
        extracted_text: attachment.extracted_text,
        extracted_metadata: extractedMetadata,
        error_message: attachment.error_message,
        created_at: attachment.created_at,
        url: signedUrlData?.signedUrl
      },
      documentAnalysis: documentAnalysis ? {
        documentType: documentAnalysis.documentType,
        confidence: documentAnalysis.confidence,
        summary: documentAnalysis.summary,
        extractedData: documentAnalysis.extractedData,
        suggestedKBSections: documentAnalysis.suggestedKBSections,
        qaPairsStored: documentAnalysis.qaPairs.length
      } : null
    })

  } catch (error) {
    console.error('Document upload error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// GET endpoint to retrieve attachment by ID
export async function GET(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    // Fetch attachment
    const attachmentRes = await pool.query(
      'SELECT * FROM sam_conversation_attachments WHERE id = $1',
      [attachmentId]
    );
    const attachment = attachmentRes.rows[0];

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify user has access (owner or workspace member)
    if (attachment.user_id !== auth.user.uid) {
      const memberRes = await pool.query(
        'SELECT 1 FROM workspace_members WHERE workspace_id = $1 AND user_id = $2',
        [attachment.workspace_id, auth.user.uid]
      );
      if (memberRes.rowCount === 0) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Get signed URL
    const { data: signedUrlData } = await supabaseAdmin
      .storage
      .from('sam-attachments')
      .createSignedUrl(attachment.storage_path, 3600)

    return NextResponse.json({
      success: true,
      attachment: {
        ...attachment,
        url: signedUrlData?.signedUrl
      }
    })

  } catch (error) {
    console.error('Get attachment error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}

// DELETE endpoint to remove attachment
export async function DELETE(request: NextRequest) {
  try {
    const auth = await verifyAuth(request);
    if (!auth.isAuthenticated || !auth.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    // Fetch attachment
    const attachmentRes = await pool.query(
      'SELECT * FROM sam_conversation_attachments WHERE id = $1 AND user_id = $2',
      [attachmentId, auth.user.uid]
    );
    const attachment = attachmentRes.rows[0];

    if (!attachment) {
      return NextResponse.json({ error: 'Attachment not found or unauthorized' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await supabaseAdmin
      .storage
      .from('sam-attachments')
      .remove([attachment.storage_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
    }

    // Delete from database
    await pool.query('DELETE FROM sam_conversation_attachments WHERE id = $1', [attachmentId]);

    return NextResponse.json({
      success: true,
      message: 'Attachment deleted successfully'
    })

  } catch (error) {
    console.error('Delete attachment error:', error)
    return NextResponse.json({
      error: 'Internal server error',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
