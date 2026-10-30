import { NextResponse } from 'next/server';
import { isLocalMySqlMode } from '@/lib/mysql';
import {
  getCompanyUsers,
  assignUserToCompany,
  removeUserFromCompany,
} from '@/lib/mysql-company';

export async function GET(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const companyId = searchParams.get('companyId');
    if (!companyId) {
      return NextResponse.json({ error: 'companyId is required.' }, { status: 400 });
    }

    const assignments = await getCompanyUsers(companyId);
    return NextResponse.json(assignments);
  } catch (err: any) {
    console.error('GET /api/companies/assignments error:', err);
    return NextResponse.json({ error: err.message || 'Failed to fetch assignments' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { userId, companyId, role } = await request.json();
    if (!userId || !companyId) {
      return NextResponse.json({ error: 'userId and companyId are required.' }, { status: 400 });
    }

    const success = await assignUserToCompany(userId, companyId, role || 'cashier');
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error('POST /api/companies/assignments error:', err);
    return NextResponse.json({ error: err.message || 'Failed to assign user' }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  if (!isLocalMySqlMode()) {
    return NextResponse.json({ error: 'Local MySQL mode is required.' }, { status: 403 });
  }

  try {
    const { searchParams } = new URL(request.url);
    const userId = searchParams.get('userId');
    const companyId = searchParams.get('companyId');

    if (!userId || !companyId) {
      return NextResponse.json({ error: 'userId and companyId are required.' }, { status: 400 });
    }

    const success = await removeUserFromCompany(userId, companyId);
    return NextResponse.json({ success });
  } catch (err: any) {
    console.error('DELETE /api/companies/assignments error:', err);
    return NextResponse.json({ error: err.message || 'Failed to remove user' }, { status: 400 });
  }
}
