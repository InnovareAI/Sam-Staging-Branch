import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/utils/supabase/server'
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

export async function POST(request: NextRequest) {
  try {
    const supabase = createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

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
    const { data: thread, error: threadError } = await supabase
      .from('sam_conversation_threads')
      .select('user_id, workspace_id')
      .eq('id', threadId)
      .single()

    if (threadError || !thread) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    if (thread.user_id !== user.id) {
      return NextResponse.json({ error: 'Unauthorized access to thread' }, { status: 403 })
    }

    // Generate storage path: user_id/thread_id/filename
    const timestamp = Date.now()
    const sanitizedFilename = file.name.replace(/[^a-zA-Z0-9.-]/g, '_')
    const storagePath = `${user.id}/${threadId}/${timestamp}-${sanitizedFilename}`

    // Convert file to buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = Buffer.from(arrayBuffer)

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase
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
        // Dynamic import to avoid build issues with pdf-parse in Next.js
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
      // Extract text from plain text files
      try {
        extractedText = new TextDecoder().decode(buffer)
      } catch (textError) {
        console.error('Text extraction error:', textError)
        processingStatus = 'failed'
        errorMessage = textError instanceof Error ? textError.message : 'Text extraction failed'
      }
    } else if (file.type.startsWith('image/')) {
      // For images, just store metadata
      extractedMetadata = {
        type: 'image',
        size: file.size,
        mimeType: file.type
      }
    }

    // Save attachment record to database FIRST (so we have an ID for source tracking)
    const { data: attachment, error: dbError } = await supabase
      .from('sam_conversation_attachments')
      .insert({
        thread_id: threadId,
        message_id: messageId,
        user_id: user.id,
        workspace_id: thread.workspace_id,
        file_name: file.name,
        file_type: file.type,
        file_size: file.size,
        mime_type: file.type,
        storage_path: storagePath,
        storage_bucket: 'sam-attachments',
        processing_status: processingStatus,
        extracted_text: extractedText,
        extracted_metadata: extractedMetadata,
        attachment_type: attachmentType,
        user_notes: userNotes,
        error_message: errorMessage,
        processed_at: new Date().toISOString()
      })
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      // Try to clean up uploaded file
      await supabase.storage.from('sam-attachments').remove([storagePath])
      return NextResponse.json({
        error: 'Failed to save attachment',
        details: dbError.message
      }, { status: 500 })
    }

    // AI-powered document intelligence analysis (AFTER attachment created for source tracking)
    if (extractedText && extractedText.length > 50 && thread.workspace_id) {
      try {
        console.log(`🤖 Analyzing document with AI: ${file.name}`)
        documentAnalysis = await processDocumentWithContext({
          extractedText,
          fileName: file.name,
          fileType: file.type,
          workspaceId: thread.workspace_id,
          userId: user.id,
          sessionId: threadId,
          userProvidedType: attachmentType !== 'other' ? attachmentType : undefined,
          attachmentId: attachment.id // Link Q&A pairs to source document
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

        // Update the attachment record with analysis metadata
        await supabase
          .from('sam_conversation_attachments')
          .update({ extracted_metadata: updatedMetadata })
          .eq('id', attachment.id)

        // Update local metadata for response
        extractedMetadata = updatedMetadata

        console.log(`✅ Document analysis complete: ${documentAnalysis.documentType} (${Math.round(documentAnalysis.confidence * 100)}% confidence)`)
        console.log(`📊 Extracted ${documentAnalysis.qaPairs.length} Q&A pairs, auto-stored in dual storage system with source link`)
      } catch (analysisError) {
        console.error('Document intelligence analysis failed:', analysisError)
        // Don't fail the upload if analysis fails
        extractedMetadata = {
          ...extractedMetadata,
          analysisError: analysisError instanceof Error ? analysisError.message : 'Analysis failed'
        }
      }
    }

    // Get signed URL for temporary access
    const { data: signedUrlData } = await supabase
      .storage
      .from('sam-attachments')
      .createSignedUrl(storagePath, 3600) // 1 hour expiry

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
        extracted_metadata: attachment.extracted_metadata,
        error_message: attachment.error_message,
        created_at: attachment.created_at,
        url: signedUrlData?.signedUrl
      },
      // Include document intelligence analysis if available
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
    const supabase = createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    // Fetch attachment
    const { data: attachment, error } = await supabase
      .from('sam_conversation_attachments')
      .select('*')
      .eq('id', attachmentId)
      .single()

    if (error || !attachment) {
      return NextResponse.json({ error: 'Attachment not found' }, { status: 404 })
    }

    // Verify user has access (owner or workspace member)
    if (attachment.user_id !== user.id) {
      const { data: member } = await supabase
        .from('workspace_members')
        .select('workspace_id')
        .eq('workspace_id', attachment.workspace_id)
        .eq('user_id', user.id)
        .single()

      if (!member) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
      }
    }

    // Get signed URL
    const { data: signedUrlData } = await supabase
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
    const supabase = createClient()

    // Authenticate user
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const attachmentId = searchParams.get('id')

    if (!attachmentId) {
      return NextResponse.json({ error: 'Attachment ID required' }, { status: 400 })
    }

    // Fetch attachment
    const { data: attachment, error: fetchError } = await supabase
      .from('sam_conversation_attachments')
      .select('*')
      .eq('id', attachmentId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !attachment) {
      return NextResponse.json({ error: 'Attachment not found or unauthorized' }, { status: 404 })
    }

    // Delete from storage
    const { error: storageError } = await supabase
      .storage
      .from('sam-attachments')
      .remove([attachment.storage_path])

    if (storageError) {
      console.error('Storage deletion error:', storageError)
    }

    // Delete from database (cascade will handle)
    const { error: dbError } = await supabase
      .from('sam_conversation_attachments')
      .delete()
      .eq('id', attachmentId)

    if (dbError) {
      return NextResponse.json({
        error: 'Failed to delete attachment',
        details: dbError.message
      }, { status: 500 })
    }

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
