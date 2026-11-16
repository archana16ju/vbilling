import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import {
  getUserNotifications,
  markNotificationAsRead,
  markAllNotificationsAsRead,
} from '@/lib/notifications';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await getAuthorizedCompanyContext();
    const { notifications, unreadCount } = await getUserNotifications(
      company.id,
      session.role,
      session.userId
    );

    return NextResponse.json({ success: true, notifications, unreadCount });
  } catch (err: any) {
    console.error('GET /api/notifications error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await getAuthorizedCompanyContext();
    const body = await request.json();
    const { notificationId, markAll } = body;

    if (markAll) {
      await markAllNotificationsAsRead(company.id, session.role);
      return NextResponse.json({ success: true, message: 'All notifications marked as read' });
    }

    if (!notificationId) {
      return NextResponse.json({ error: 'Missing notificationId' }, { status: 400 });
    }

    await markNotificationAsRead(company.id, notificationId);
    return NextResponse.json({ success: true, message: 'Notification marked as read' });
  } catch (err: any) {
    console.error('PATCH /api/notifications error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
