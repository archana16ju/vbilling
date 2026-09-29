import { NextResponse } from 'next/server';
import { getUsers, saveUsers, User } from '@/lib/users';

export async function GET() {
  try {
    const users = await getUsers();
    return NextResponse.json(users.map(({ password, ...user }) => user));
  } catch (e) {
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 });
  }
}

export async function POST(request: Request) {
  try {
    const data = await request.json();
    const users = await getUsers();
    
    if (users.find(u => u.username === data.username)) {
      return NextResponse.json({ error: 'Username exists' }, { status: 400 });
    }
    
    const newUser: User = {
      id: 'u' + Date.now(),
      username: data.username,
      password: data.password,
      role: data.role,
      createdAt: Date.now()
    };
    
    users.push(newUser);
    await saveUsers(users);
    
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 });
  }
}

export async function PUT(request: Request) {
  try {
    const data = await request.json();
    const users = await getUsers();
    
    const index = users.findIndex(u => u.id === data.id);
    if (index === -1) return NextResponse.json({ error: 'User not found' }, { status: 404 });
    
    if (data.username !== users[index].username && users.find(u => u.username === data.username)) {
      return NextResponse.json({ error: 'Username exists' }, { status: 400 });
    }
    
    users[index] = {
      ...users[index],
      username: data.username,
      role: data.role,
      password: data.password || users[index].password
    };
    
    await saveUsers(users);
    
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 });
  }
}

export async function DELETE(request: Request) {
  try {
    const url = new URL(request.url);
    const id = url.searchParams.get('id');
    const users = await getUsers();
    
    const filtered = users.filter(u => u.id !== id);
    if (filtered.length === users.length) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    
    await saveUsers(filtered);
    
    return NextResponse.json({ success: true });
  } catch (e) {
    return NextResponse.json({ error: 'Failed' }, { status: 500 });
  }
}
