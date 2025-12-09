import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '6f098b57',
    commit: '6f098b57',
    branch: 'main',
    timestamp: new Date().toISOString()
  });
}
