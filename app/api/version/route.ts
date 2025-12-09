import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '92daed1e',
    commit: '92daed1e',
    branch: 'main',
    timestamp: new Date().toISOString()
  });
}
