import { NextResponse } from 'next/server';

export async function GET() {
  return NextResponse.json({ 
    message: 'Sam API test working!',
    timestamp: new Date().toISOString()
  });
}