import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';
import { getAuthorizedCompanyContext } from '@/lib/mysql-company';
import { markAnnouncementAsRead } from '@/lib/announcements';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await getSession();
    if (!session || !session.userId) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { id } = await params;
    if (!id) {
      return NextResponse.json({ error: 'Missing announcement ID' }, { status: 400 });
    }

    const company = await getAuthorizedCompanyContext();
    await markAnnouncementAsRead(company.id, id, session.userId);

    return NextResponse.json({ success: true, message: 'Marked as read' });
  } catch (err: any) {
    console.error('POST /api/announcements/[id]/read error:', err);
    return NextResponse.json({ error: err.message || 'Server error' }, { status: 500 });
  }
}
