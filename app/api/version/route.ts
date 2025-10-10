import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'campaign-names-at-search',
    timestamp: new Date().toISOString()
  });
}
