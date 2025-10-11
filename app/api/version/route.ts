import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'chat-ui-improvements',
    timestamp: new Date().toISOString()
  });
}
