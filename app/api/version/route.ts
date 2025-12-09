import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '8fae3342',
    commit: '8fae3342',
    branch: 'main',
    timestamp: new Date().toISOString()
  });
}
