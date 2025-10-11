import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'profile-language-and-tenure-filters',
    timestamp: new Date().toISOString()
  });
}
