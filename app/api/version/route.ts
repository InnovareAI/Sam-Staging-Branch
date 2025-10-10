import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'workspace-rls-bypass-FIX',
    timestamp: new Date().toISOString()
  });
}
