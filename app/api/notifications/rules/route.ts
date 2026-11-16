import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { getCompanyNotificationRules, saveNotificationRule, deleteNotificationRule } from '@/lib/notifications';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await getAuthorizedCompanyContext();
    const rules = await getCompanyNotificationRules(company.id);

    return NextResponse.json({ success: true, rules });
  } catch (err: any) {
    console.error('GET /api/notifications/rules error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

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
    const body = await request.json();

    if (!body.name || !body.eventType || !Array.isArray(body.roles)) {
      return NextResponse.json({ error: 'Rule name, event type, and recipient roles are required' }, { status: 400 });
    }

    const ruleId = await saveNotificationRule(
      company.id,
      {
        id: body.id,
        name: body.name,
        eventType: body.eventType,
        isEnabled: body.isEnabled !== undefined ? body.isEnabled : true,
        roles: body.roles,
        userIds: body.userIds,
        priority: body.priority || 'normal',
        channels: body.channels || ['in_app', 'sound'],
        quietHoursEnabled: body.quietHoursEnabled || false,
        quietHoursStart: body.quietHoursStart,
        quietHoursEnd: body.quietHoursEnd,
        thresholdValue: body.thresholdValue,
      },
      session.username
    );

    return NextResponse.json({ success: true, ruleId, message: 'Notification rule saved successfully' });
  } catch (err: any) {
    console.error('POST /api/notifications/rules error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['super_admin', 'company_admin', 'manager'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden: Insufficient privileges' }, { status: 403 });
    }

    const { searchParams } = new URL(request.url);
    const ruleId = searchParams.get('id');

    if (!ruleId) {
      return NextResponse.json({ error: 'Rule ID is required' }, { status: 400 });
    }

    const company = await getAuthorizedCompanyContext();
    const deleted = await deleteNotificationRule(company.id, ruleId, session.username);

    if (!deleted) {
      return NextResponse.json({ error: 'Rule not found or could not be deleted' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Notification rule deleted successfully' });
  } catch (err: any) {
    console.error('DELETE /api/notifications/rules error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
