
import { NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/security/route-auth';

async function callUnipileAPI(endpoint: string) {
  const unipileDsn = process.env.UNIPILE_DSN;
  const unipileApiKey = process.env.UNIPILE_API_KEY;

  const url = `https://${unipileDsn}/api/v1/${endpoint}`;
  const response = await fetch(url, {
    headers: {
      'X-API-KEY': unipileApiKey!,
      'Accept': 'application/json'
    }
  });

  return await response.json();
}

export async function GET(request: Request) {

  // Require admin authentication
  const { error: authError } = await requireAdmin(request);
  if (authError) return authError;
  const data = await callUnipileAPI('accounts');
  const allAccounts = Array.isArray(data) ? data : (data.items || data.accounts || []);

  const emailAccounts = allAccounts.filter((account: any) => {
    const type = account.type?.toUpperCase() || '';
    return type.includes('GOOGLE') || type.includes('OUTLOOK') || type === 'MESSAGING';
  });

  return NextResponse.json({
    total: allAccounts.length,
    email_accounts: emailAccounts.length,
    accounts: emailAccounts.map(acc => ({
      id: acc.id,
      type: acc.type,
      name: acc.name,
      connection_params: acc.connection_params,
      sources: acc.sources,
      full_account: acc
    }))
  }, { status: 200 });
}
