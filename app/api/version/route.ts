import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'chat-auto-scroll-fix',
    timestamp: new Date().toISOString()
  });
}
