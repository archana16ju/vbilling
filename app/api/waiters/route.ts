import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getCompanyWaiters } from '@/lib/actions/staff';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const res = await getCompanyWaiters(session.companyId);
    if (!res.success) {
      return NextResponse.json({ error: res.error || 'Failed to fetch waiters' }, { status: 500 });
    }

    return NextResponse.json({ success: true, waiters: res.waiters });
  } catch (err: any) {
    console.error('GET /api/waiters error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
