/**
 * Link Tracking Redirect Endpoint
 *
 * GET /t/{code}
 *
 * Records the click and redirects to destination URL.
 * This is the core of our link tracking system.
 *
 * Created: December 20, 2025
 */

import { NextRequest, NextResponse } from 'next/server';
import { recordLinkClick } from '@/lib/services/link-tracking';

export async function GET(
  request: NextRequest,
  { params }: { params: { code: string } }
) {
  const { code } = params;

  if (!code || code.length < 6) {
    return NextResponse.redirect(new URL('/', request.url));
  }

  try {
    // Extract request metadata
    const ipAddress = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ||
                      request.headers.get('x-real-ip') ||
                      'unknown';
    const userAgent = request.headers.get('user-agent') || undefined;
    const referrer = request.headers.get('referer') || undefined;

    // Record the click and get destination
    const result = await recordLinkClick({
      shortCode: code,
      ipAddress: ipAddress !== 'unknown' ? ipAddress : undefined,
      userAgent,
      referrer,
    });

    if (!result) {
      // Link not found - redirect to home
      console.log(`Link not found: ${code}`);
      return NextResponse.redirect(new URL('/', request.url));
    }

    // Log for debugging
    console.log(`Link click: ${code} → ${result.destinationUrl} (${result.linkClickEvent.linkType})`);

    // Redirect to destination
    return NextResponse.redirect(result.destinationUrl);

  } catch (error) {
    console.error('Link tracking error:', error);
    // On error, try to redirect to destination anyway
    return NextResponse.redirect(new URL('/', request.url));
  }
}
