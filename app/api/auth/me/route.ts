import { NextResponse } from 'next/server';
import { getSession } from '@/lib/auth-session';

export async function GET() {
  try {
    const session = await getSession();
    if (!session) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }

    return NextResponse.json({
      authenticated: true,
      userId: session.userId,
      username: session.username,
      role: session.role,
      companyId: session.companyId,
      companyName: session.companyName,
    });
  } catch (err: any) {
    return NextResponse.json({ authenticated: false, error: err.message }, { status: 500 });
  }
}
