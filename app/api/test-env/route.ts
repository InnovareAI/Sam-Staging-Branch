/**
 * Test endpoint to verify environment variables
 */

export async function GET() {
  return Response.json({
    hasSigningKey: !!process.env.INNGEST_SIGNING_KEY,
    signingKeyPrefix: process.env.INNGEST_SIGNING_KEY?.substring(0, 20) || 'missing',
    hasEventKey: !!process.env.INNGEST_EVENT_KEY,
    eventKeyPrefix: process.env.INNGEST_EVENT_KEY?.substring(0, 20) || 'missing',
    nodeEnv: process.env.NODE_ENV,
    netlifyContext: process.env.CONTEXT || 'unknown',
  });
}
