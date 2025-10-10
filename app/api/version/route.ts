import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'ae4fcc8-approval-fix',
    timestamp: new Date().toISOString()
  });
}
