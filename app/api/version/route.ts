import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'chat-scroll-into-view-fix',
    timestamp: new Date().toISOString()
  });
}
