import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'fix-auth-loop-supabase-ssr',
    timestamp: new Date().toISOString()
  });
}
