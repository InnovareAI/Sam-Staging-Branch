import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'workspace-auto-select-FINAL-FIX',
    timestamp: new Date().toISOString()
  });
}
