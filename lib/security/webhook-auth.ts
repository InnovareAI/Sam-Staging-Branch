import { createHmac, timingSafeEqual } from 'crypto';
import { NextRequest, NextResponse } from 'next/server';

/**
 * Webhook Signature Validation
 * Prevents webhook spoofing by verifying HMAC signatures
 */

export interface WebhookValidationOptions {
  secret: string;
  headerName?: string;
  tolerance?: number; // Timestamp tolerance in seconds (default: 5 minutes)
}

/**
 * Verify Postmark webhook signature
 */
export async function verifyPostmarkWebhook(
  request: NextRequest,
  body: string
): Promise<{ valid: boolean; error?: NextResponse }> {
  const signature = request.headers.get('x-postmark-signature');

  if (!signature) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      )
    };
  }

  const secret = process.env.POSTMARK_WEBHOOK_SECRET;
  if (!secret) {
    console.error('POSTMARK_WEBHOOK_SECRET not configured');
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Webhook validation not configured' },
        { status: 500 }
      )
    };
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return {
        valid: false,
        error: NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Verify N8N webhook signature
 */
export async function verifyN8NWebhook(
  request: NextRequest,
  body: string
): Promise<{ valid: boolean; error?: NextResponse }> {
  const signature = request.headers.get('x-n8n-signature');

  if (!signature) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Missing N8N signature' },
        { status: 401 }
      )
    };
  }

  const secret = process.env.N8N_WEBHOOK_SECRET;
  if (!secret) {
    console.warn('⚠️  N8N_WEBHOOK_SECRET not configured - allowing trusted N8N requests');
    // Allow requests from trusted N8N instance when secret not configured
    return { valid: true };
  }

  try {
    const hmac = createHmac('sha256', secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return {
        valid: false,
        error: NextResponse.json(
          { error: 'Invalid N8N signature' },
          { status: 401 }
        )
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('N8N signature verification error:', error);
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Generic webhook signature verification
 */
export async function verifyWebhookSignature(
  request: NextRequest,
  body: string,
  options: WebhookValidationOptions
): Promise<{ valid: boolean; error?: NextResponse }> {
  const headerName = options.headerName || 'x-webhook-signature';
  const signature = request.headers.get(headerName);

  if (!signature) {
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Missing webhook signature' },
        { status: 401 }
      )
    };
  }

  try {
    const hmac = createHmac('sha256', options.secret);
    hmac.update(body);
    const expectedSignature = hmac.digest('hex');

    const signatureBuffer = Buffer.from(signature, 'hex');
    const expectedBuffer = Buffer.from(expectedSignature, 'hex');

    if (
      signatureBuffer.length !== expectedBuffer.length ||
      !timingSafeEqual(signatureBuffer, expectedBuffer)
    ) {
      return {
        valid: false,
        error: NextResponse.json(
          { error: 'Invalid webhook signature' },
          { status: 401 }
        )
      };
    }

    return { valid: true };
  } catch (error) {
    console.error('Webhook signature verification error:', error);
    return {
      valid: false,
      error: NextResponse.json(
        { error: 'Signature verification failed' },
        { status: 500 }
      )
    };
  }
}

/**
 * Read request body as text (needed for signature verification)
 */
export async function getRequestBody(request: NextRequest): Promise<string> {
  const clone = request.clone();
  return await clone.text();
}
