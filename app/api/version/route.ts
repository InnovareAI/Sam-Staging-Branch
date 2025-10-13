import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: process.env.VERCEL_GIT_COMMIT_SHA || process.env.COMMIT_REF || 'de154f8',
    commit: 'de154f8',
    branch: process.env.HEAD || process.env.BRANCH || 'main',
    timestamp: new Date().toISOString()
  });
}
