import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: '5dd5803-schema-fix',
    timestamp: new Date().toISOString()
  });
}
