import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getDuplicateWarnings, resolveDuplicateWarning } from '@/lib/duplicate-detector';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['super_admin', 'company_admin', 'manager'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const company = await getAuthorizedCompanyContext();
    const { searchParams } = new URL(request.url);
    const statusParam = (searchParams.get('status') || 'unresolved') as any;

    const warnings = await getDuplicateWarnings(company.id, statusParam);

    return NextResponse.json({ success: true, warnings });
  } catch (err: any) {
    console.error('GET /api/duplicates error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const allowedRoles = ['super_admin', 'company_admin', 'manager'];
    if (!allowedRoles.includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const company = await getAuthorizedCompanyContext();
    const body = await request.json();
    const { warningId, status, action, notes } = body;

    if (!warningId) {
      return NextResponse.json({ error: 'Missing warningId' }, { status: 400 });
    }

    const resolved = await resolveDuplicateWarning(company.id, warningId, {
      status: status || 'resolved',
      action: action || 'dismissed',
      notes: notes || '',
      resolvedBy: session.username,
    });

    if (!resolved) {
      return NextResponse.json({ error: 'Warning not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Warning updated' });
  } catch (err: any) {
    console.error('PATCH /api/duplicates error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
