import { NextRequest, NextResponse } from 'next/server';
import { pool } from '@/lib/auth';
import { getStorageBucket } from '@/lib/firebase-admin';
import { generateSignedDpaPdf, generateDpaPdfFilename } from '@/lib/dpa/generate-signed-pdf';

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
    const { rows: workspaceRows } = await pool.query(
      'SELECT name FROM workspaces WHERE id = $1',
      [workspaceId]
    );
    const workspace = workspaceRows[0];

    // Generate PDF
    const pdfBuffer = await generateSignedDpaPdf({
      dpaVersion,
      dpaContent,
      signatureData,
      workspaceName: workspace?.name
    });

    // Generate filename
    const filename = generateDpaPdfFilename(workspaceId, dpaVersion);
    const storagePath = `legal-documents/${filename}`;

    // Upload to Firebase Storage
    const bucket = getStorageBucket();
    const fileRef = bucket.file(storagePath);

    await fileRef.save(pdfBuffer, {
      metadata: {
        contentType: 'application/pdf',
        cacheControl: 'private, max-age=31536000', // 1 year cache for legal docs
      },
    });

    // Generate signed URL (valid for 10 years for legal documents)
    const [signedUrl] = await fileRef.getSignedUrl({
      action: 'read',
      expires: Date.now() + 10 * 365 * 24 * 60 * 60 * 1000, // 10 years
    });

    // Update agreement record with PDF URL
    const { rowCount } = await pool.query(
      `UPDATE workspace_dpa_agreements
       SET signed_dpa_pdf_url = $1, updated_at = NOW()
       WHERE id = $2`,
      [signedUrl, agreementId]
    );

    if (rowCount === 0) {
      console.error('Failed to update agreement with PDF URL - no rows affected');
      return NextResponse.json(
        { error: 'Failed to update agreement record' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      pdfUrl: signedUrl,
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
