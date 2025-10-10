import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'connection-degree-filter-fixed',
    timestamp: new Date().toISOString()
  });
}
