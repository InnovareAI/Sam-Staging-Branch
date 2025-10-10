import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({
    version: 'c205b17-complete-fix-FORCE-REBUILD',
    timestamp: new Date().toISOString()
  });
}
