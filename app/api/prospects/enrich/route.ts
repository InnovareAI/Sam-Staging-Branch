import { NextRequest, NextResponse } from 'next/server';

// Configure this API route to have maximum timeout
export const maxDuration = 60; // 60 seconds (max for Pro plan)
export const dynamic = 'force-dynamic';

/**
 * Data Enrichment API - DISABLED
 *
 * This endpoint has been permanently disabled.
 * Users must now import prospects with email addresses already included.
 *
 * Recommended third-party enrichment services:
 * - Apollo.io
 * - ZoomInfo
 * - Hunter.io
 * - Clearbit
 */

export async function POST(request: NextRequest) {
  // ENRICHMENT DISABLED: Users must bring their own enriched data
  return NextResponse.json({
    error: 'Data enrichment is no longer available',
    message: 'Please upload prospects with email addresses already included in your CSV file',
    hint: 'Use a third-party enrichment service (Apollo.io, ZoomInfo, etc.) before importing to SAM'
  }, { status: 410 }); // 410 Gone - feature permanently removed
}
