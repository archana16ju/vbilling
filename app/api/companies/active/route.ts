import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import { getAuthorizedCompanyContext, switchActiveCompany } from '@/lib/mysql-company';

export async function GET() {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ activeCompany: null, isLocalMySql: false });
  }

  try {
    const company = await getAuthorizedCompanyContext();
    return NextResponse.json({ activeCompany: company, isLocalMySql: true });
  } catch (err: any) {
    return NextResponse.json({ activeCompany: null, isLocalMySql: true, error: err.message }, { status: 400 });
  }
}

export async function POST(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { companyId } = await request.json();
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
    }

    const result = await switchActiveCompany(companyId);
    if (!result.success) {
      return NextResponse.json({ error: result.error || 'Failed to switch company' }, { status: 400 });
    }

    const response = NextResponse.json({ success: true, company: result.company });
    if (result.company?.id) {
      response.cookies.set('auth_company_id', result.company.id, {
        path: '/',
        maxAge: 60 * 60 * 24 * 7,
        sameSite: 'lax',
        secure: false,
        httpOnly: false,
      });
    }
    return response;
  } catch (err: any) {
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
