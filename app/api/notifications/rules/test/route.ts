import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { triggerSmartNotification } from '@/lib/notifications';

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const company = await getAuthorizedCompanyContext();
    const { eventType, ruleName } = await request.json();

    const result = await triggerSmartNotification(company.id, {
      eventType: eventType || 'low_stock',
      title: `Test Notification: ${ruleName || eventType}`,
      message: `This is a verification test of the notification rule "${ruleName || eventType}" for ${company.name}.`,
      actionUrl: '/notification-rules',
      dedupKey: `test_${Date.now()}`,
    });

    return NextResponse.json({
      success: true,
      message: result.triggered
        ? 'Test notification successfully generated and dispatched'
        : 'Rule was checked, but conditions or muted settings prevented alert',
      result,
    });
  } catch (err: any) {
    console.error('POST /api/notifications/rules/test error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
