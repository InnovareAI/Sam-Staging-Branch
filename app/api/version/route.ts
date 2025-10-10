import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'data-input-reorganization',
    timestamp: new Date().toISOString()
  });
}
