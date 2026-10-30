import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  getAllCompanies,
  createCompany,
  updateCompany,
  deleteCompany,
  getAuthorizedCompanyContext,
} from '@/lib/mysql-company';

export async function GET() {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Company management is only enabled in local MySQL mode.' }, { status: 403 });
  }

  try {
    const cookieStore = await cookies();
    const role = cookieStore.get('auth_role')?.value;

    if (role === 'admin' || role === 'super_admin') {
      const companies = await getAllCompanies();
      return NextResponse.json(companies);
    } else {
      const active = await getAuthorizedCompanyContext();
      return NextResponse.json([active]);
    }
  } catch (err: any) {
    console.error('GET /api/companies error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch companies' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const body = await request.json();
    const company = await createCompany(body);
    return NextResponse.json({ success: true, company });
  } catch (err: any) {
    console.error('POST /api/companies error:', err);
    return NextResponse.json({ error: err.message || 'Failed to create company' }, { status: 400 });
  }
}

export async function PUT(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { id, ...updates } = await request.json();
    if (!id) {
      return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
    }
    const success = await updateCompany(id, updates);
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error('PUT /api/companies error:', err);
    return NextResponse.json({ error: err.message || 'Failed to update company' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');
    if (!id) {
      return NextResponse.json({ error: 'Company ID is required.' }, { status: 400 });
    }

    const success = await deleteCompany(id);
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error('DELETE /api/companies error:', err);
    return NextResponse.json({ error: err.message || 'Failed to delete company' }, { status: 400 });
  }
}
