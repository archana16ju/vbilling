import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getLoginActivities, updateLoginSessionStatus } from '@/lib/mysql-master';
import { recordAuditLog } from '@/lib/actions/audit';

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

    const { searchParams } = new URL(request.url);
    const requestedCompanyId = searchParams.get('companyId');
    const username = searchParams.get('username') || undefined;
    const deviceType = searchParams.get('deviceType') || undefined;
    const sessionStatus = searchParams.get('status') || undefined;
    const loginStatus = searchParams.get('loginStatus') || undefined;
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const limit = Number(searchParams.get('limit') || 250);

    // Multi-tenant boundary enforcement:
    // Non-super-admins can ONLY view their own company's activity
    let effectiveCompanyId: string | undefined = session.companyId;
    if (session.role === 'super_admin') {
      effectiveCompanyId = requestedCompanyId && requestedCompanyId !== 'all' ? requestedCompanyId : undefined;
    }

    const rows = await getLoginActivities({
      companyId: effectiveCompanyId,
      username,
      deviceType,
      sessionStatus,
      loginStatus,
      startDate,
      endDate,
      limit,
    });

    const now = Date.now();
    const INACTIVITY_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

    // Calculate real-time online/offline status
    const activities = rows.map((r: any) => {
      const lastAct = r.lastActivityAt ? new Date(r.lastActivityAt).getTime() : 0;
      let displayStatus = r.sessionStatus;

      if (r.sessionStatus === 'active') {
        if (now - lastAct > INACTIVITY_TIMEOUT_MS) {
          displayStatus = 'offline';
        } else {
          displayStatus = 'online';
        }
      }

      return {
        id: r.id,
        sessionId: r.sessionId,
        userId: r.userId,
        username: r.username,
        employeeName: r.employeeName || r.username,
        companyId: r.companyId,
        companyName: r.companyName || 'Master Administration',
        loginAt: r.loginAt,
        logoutAt: r.logoutAt,
        lastActivityAt: r.lastActivityAt,
        sessionStatus: r.sessionStatus,
        displayStatus,
        loginStatus: r.loginStatus,
        failureReason: r.failureReason,
        deviceType: r.deviceType || 'Browser',
        browserInfo: r.browserInfo || 'Standard Web Browser',
        ipAddress: r.ipAddress || '127.0.0.1',
        terminatedBy: r.terminatedBy,
        terminatedAt: r.terminatedAt,
      };
    });

    return NextResponse.json({ success: true, activities });
  } catch (err: any) {
    console.error('GET /api/login-activity error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    if (!['super_admin', 'company_admin'].includes(session.role)) {
      return NextResponse.json({ error: 'Forbidden: Only administrators can terminate active sessions' }, { status: 403 });
    }

    const { action, sessionId, targetUsername, targetCompanyId } = await request.json();

    if (action !== 'terminate' || !sessionId) {
      return NextResponse.json({ error: 'Invalid action or missing sessionId' }, { status: 400 });
    }

    // Company Admin cannot terminate sessions of other companies
    if (session.role === 'company_admin' && targetCompanyId && targetCompanyId !== session.companyId) {
      return NextResponse.json({ error: 'Unauthorized cross-company session termination' }, { status: 403 });
    }

    await updateLoginSessionStatus(sessionId, 'terminated', session.username);

    // Record termination in universal Audit Log
    await recordAuditLog({
      action: 'SESSION_TERMINATED',
      entityType: 'SECURITY_SESSION',
      entityId: sessionId,
      details: {
        sessionId,
        targetUsername: targetUsername || 'Unknown',
        targetCompanyId: targetCompanyId || session.companyId,
        terminatedBy: session.username,
        timestamp: new Date().toISOString(),
      },
    });

    return NextResponse.json({ success: true, message: `Session ${sessionId} terminated successfully` });
  } catch (err: any) {
    console.error('POST /api/login-activity error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
