import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'advanced-search-filters',
    timestamp: new Date().toISOString()
  });
}
