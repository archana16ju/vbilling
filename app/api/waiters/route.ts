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

    let waiters = res.waiters || [];
    const isWaiter = session.role === 'waiter';

    if (isWaiter) {
      const uId = session.userId;
      const uName = (session.username || '').toLowerCase();
      waiters = waiters.filter(
        (w: any) =>
          (w.userId && w.userId === uId) ||
          (w.id && w.id === uId) ||
          (w.username && w.username.toLowerCase() === uName) ||
          (w.name && w.name.toLowerCase() === uName)
      );

      // Fallback if staff table hasn't synced the user's name
      if (waiters.length === 0) {
        waiters = [
          {
            id: uId,
            userId: uId,
            name: session.username || 'Waiter',
            username: session.username,
            phone: null,
            activeOrdersCount: 0,
          },
        ];
      }
    }

    return NextResponse.json({
      success: true,
      waiters,
      isWaiterRole: isWaiter,
      currentUserId: session.userId,
      currentUsername: session.username,
    });
  } catch (err: any) {
    console.error('GET /api/waiters error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
