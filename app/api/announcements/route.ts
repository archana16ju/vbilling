import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import {
  getEmployeeAnnouncements,
  getAdminAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement,
} from '@/lib/announcements';

export async function GET(request: Request) {
  try {
    const session = await getSession();
    if (!session || !session.role) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const company = await getAuthorizedCompanyContext();
    const { searchParams } = new URL(request.url);
    const isAdminView = searchParams.get('admin') === 'true';

    if (isAdminView && ['super_admin', 'company_admin', 'manager'].includes(session.role)) {
      const announcements = await getAdminAnnouncements(company.id);
      return NextResponse.json({ success: true, announcements });
    }

    const { announcements, unreadCount } = await getEmployeeAnnouncements(
      company.id,
      session.userId,
      session.role
    );

    return NextResponse.json({ success: true, announcements, unreadCount });
  } catch (err: any) {
    console.error('GET /api/announcements error:', err);
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

    if (!body.title || !body.description) {
      return NextResponse.json({ error: 'Title and description are required' }, { status: 400 });
    }

    const id = await createAnnouncement(
      company.id,
      {
        title: body.title,
        description: body.description,
        imageUrl: body.imageUrl || null,
        priority: body.priority || 'normal',
        targetAudienceType: body.targetAudienceType || 'everyone',
        targetRoles: body.targetRoles,
        targetUserIds: body.targetUserIds,
        publishAt: body.publishAt,
        expiresAt: body.expiresAt,
        isActive: body.isActive !== undefined ? body.isActive : true,
      },
      session.username
    );

    return NextResponse.json({ success: true, id, message: 'Announcement published successfully' });
  } catch (err: any) {
    console.error('POST /api/announcements error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
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
    const { id, ...updates } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing announcement ID' }, { status: 400 });
    }

    const updated = await updateAnnouncement(company.id, id, updates, session.username);
    if (!updated) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Announcement updated successfully' });
  } catch (err: any) {
    console.error('PUT /api/announcements error:', err);
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

    const company = await getAuthorizedCompanyContext();
    const { searchParams } = new URL(request.url);
    const id = searchParams.get('id');

    if (!id) {
      return NextResponse.json({ error: 'Missing announcement ID' }, { status: 400 });
    }

    const deleted = await deleteAnnouncement(company.id, id, session.username);
    if (!deleted) {
      return NextResponse.json({ error: 'Announcement not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Announcement deleted successfully' });
  } catch (err: any) {
    console.error('DELETE /api/announcements error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
