import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'guide-me-interactive-search',
    timestamp: new Date().toISOString()
  });
}
