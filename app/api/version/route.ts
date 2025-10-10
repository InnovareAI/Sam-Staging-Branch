import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'approval-apis-rls-bypass',
    timestamp: new Date().toISOString()
  });
}
