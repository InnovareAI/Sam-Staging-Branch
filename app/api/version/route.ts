import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || 'fix-thread-creation-error-logging',
    commit: '98152ca',
    timestamp: new Date().toISOString()
  });
}
