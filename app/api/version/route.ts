import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'bbd432e2',
    commit: 'bbd432e2',
    branch: 'main',
    timestamp: new Date().toISOString()
  });
}
