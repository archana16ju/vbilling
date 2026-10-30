import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { createCompanyCashier } from '@/lib/mysql-company';

export async function POST(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { companyId, username, password } = await request.json();
    if (!companyId || !username || !password) {
      return NextResponse.json(
        { error: 'Company ID, username, and password are required.' },
        { status: 400 }
      );
    }

    const cashier = await createCompanyCashier({ companyId, username, password });
    return NextResponse.json({ success: true, cashier });
  } catch (err: any) {
    console.error('POST /api/companies/cashiers error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create cashier' }, { status: 400 });
  }
}
