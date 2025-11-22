import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const unipileDSN = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  console.log('🔵 Testing Unipile API Key');
  console.log('DSN:', unipileDSN);
  console.log('API Key (first 20 chars):', unipileApiKey?.substring(0, 20));

  if (!unipileDSN || !unipileApiKey) {
    return NextResponse.json({
      success: false,
      error: 'Missing Unipile config',
      hasDSN: !!unipileDSN,
      hasKey: !!unipileApiKey
    }, { status: 400 });
  }

  try {
    const url = `https://${unipileDSN}/api/v1/accounts`;
    console.log('🔵 Testing URL:', url);

    const response = await fetch(url, {
      headers: {
        'X-API-KEY': unipileApiKey,
        'Accept': 'application/json'
      }
    });

    console.log('🔵 Response status:', response.status);
    const responseText = await response.text();
    console.log('🔵 Response body (first 500 chars):', responseText.substring(0, 500));

    return NextResponse.json({
      success: response.ok,
      status: response.status,
      statusText: response.statusText,
      body: responseText.substring(0, 1000),
      keyValidation: {
        keyLength: unipileApiKey.length,
        keyPrefix: unipileApiKey.substring(0, 20),
        DSN: unipileDSN
      }
    });
  } catch (error) {
    console.error('❌ Error testing Unipile:', error);
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : String(error)
    }, { status: 500 });
  }
}
