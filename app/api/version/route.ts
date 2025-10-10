import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'prospects-api-fix-ACTUALLY-CRITICAL',
    timestamp: new Date().toISOString()
  });
}
