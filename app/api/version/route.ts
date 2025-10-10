import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '259e0f7-load-sessions',
    timestamp: new Date().toISOString()
  });
}
