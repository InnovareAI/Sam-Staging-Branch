import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { generateSignedDpaPdf, generateDpaPdfFilename } from '@/lib/dpa/generate-signed-pdf';

// Use service role for file uploads
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * POST /api/dpa/generate-pdf
 *
 * Generate and store signed DPA PDF with signature certificate
 * Called asynchronously after DPA signature
 */
export async function POST(request: NextRequest) {
  try {
    // Parse request body
    const body = await request.json();
    const {
      agreementId,
      workspaceId,
      dpaVersion,
      dpaContent,
      signatureData
    } = body;

    // Validate required fields
    if (!agreementId || !workspaceId || !dpaVersion || !dpaContent || !signatureData) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Get workspace name for PDF
    const { data: workspace } = await supabaseAdmin
      .from('workspaces')
      .select('name')
      .eq('id', workspaceId)
      .single();

    // Generate PDF
    const pdfBuffer = await generateSignedDpaPdf({
      dpaVersion,
      dpaContent,
      signatureData,
      workspaceName: workspace?.name
    });

    // Generate filename
    const filename = generateDpaPdfFilename(workspaceId, dpaVersion);

    // Upload to Supabase Storage
    const { data: upload, error: uploadError } = await supabaseAdmin.storage
      .from('legal-documents')
      .upload(filename, pdfBuffer, {
        contentType: 'application/pdf',
        upsert: false
      });

    if (uploadError) {
      console.error('Failed to upload signed DPA PDF:', uploadError);
      return NextResponse.json(
        { error: 'Failed to upload PDF' },
        { status: 500 }
      );
    }

    // Get public URL
    const { data: { publicUrl } } = supabaseAdmin.storage
      .from('legal-documents')
      .getPublicUrl(upload.path);

    // Update agreement record with PDF URL
    const { error: updateError } = await supabaseAdmin
      .from('workspace_dpa_agreements')
      .update({
        signed_dpa_pdf_url: publicUrl,
        updated_at: new Date().toISOString()
      })
      .eq('id', agreementId);

    if (updateError) {
      console.error('Failed to update agreement with PDF URL:', updateError);
      return NextResponse.json(
        { error: 'Failed to update agreement record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pdfUrl: publicUrl,
      filename
    });

  } catch (error) {
    console.error('PDF generation error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    );
  }
}
