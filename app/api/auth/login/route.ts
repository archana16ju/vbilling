import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { getUsers } from '@/lib/users';

export async function POST(request: Request) {
  try {
    const { username, password } = await request.json();
    const users = await getUsers();
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
      const cookieStore = await cookies();
      cookieStore.set('auth_role', user.role, { httpOnly: false, path: '/' });
      return NextResponse.json({ success: true, role: user.role });
    } else {
      return NextResponse.json({ success: false, error: 'Invalid credentials' }, { status: 401 });
    }
  } catch (err) {
    return NextResponse.json({ success: false, error: 'System error' }, { status: 500 });
  }
}
