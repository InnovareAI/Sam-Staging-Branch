import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '14bf8746',
    commit: '14bf8746',
    branch: 'main',
    timestamp: new Date().toISOString()
  });
}
