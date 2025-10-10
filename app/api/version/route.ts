import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'typescript-import-fix-THE-REAL-BUG',
    timestamp: new Date().toISOString()
  });
}
