'use server';
export async function testAction() { return 'HELLO WORLD'; }

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { getUsers, saveUsers, User, UserRole } from '@/lib/users';

export async function login(prevState: unknown, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;

  const users = await getUsers();
  const user = users.find(u => u.username === username && u.password === password);

  if (user) {
    const cookieStore = await cookies();
    cookieStore.set('auth_role', user.role, { httpOnly: true, path: '/' });
    
    if (user.role === 'admin') {
      redirect('/dashboard');
    } else {
      redirect('/terminal');
    }
  } else {
    return { error: 'Invalid username or password' };
  }
}

export async function logout() {
  const cookieStore = await cookies();
  cookieStore.delete('auth_role');
  redirect('/login');
}

export async function getUserRole() {
  const cookieStore = await cookies();
  return cookieStore.get('auth_role')?.value;
}

export async function getAllUsers() {
  try {
    const users = await getUsers();
    console.log('getAllUsers length:', users?.length);
    if (!users) return [];
    // Don't send passwords to the client
    return users.map(({ password, ...user }) => user);
  } catch(e) {
    console.error('getAllUsers ERROR:', e);
    return [];
  }
}

export async function createUser(prevState: unknown, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as UserRole;

  if (!username || !password || !role) {
    return { error: 'All fields are required' };
  }

  const users = await getUsers();
  if (users.find(u => u.username === username)) {
    return { error: 'Username already exists' };
  }

  const newUser: User = {
    id: 'u' + Date.now(),
    username,
    password,
    role,
    createdAt: Date.now()
  };

  await saveUsers([...users, newUser]);
  return { success: true };
}

export async function updateUser(id: string, prevState: unknown, formData: FormData) {
  const username = formData.get('username') as string;
  const password = formData.get('password') as string;
  const role = formData.get('role') as UserRole;

  if (!username || !role) {
    return { error: 'Username and role are required' };
  }

  const users = await getUsers();
  const userIndex = users.findIndex(u => u.id === id);
  
  if (userIndex === -1) {
    return { error: 'User not found' };
  }

  // Check if username is taken by another user
  if (users.find(u => u.username === username && u.id !== id)) {
    return { error: 'Username already exists' };
  }

  const updatedUser = { ...users[userIndex] };
  updatedUser.username = username;
  updatedUser.role = role;
  
  // Only update password if a new one was provided
  if (password && password.trim() !== '') {
    updatedUser.password = password;
  }

  users[userIndex] = updatedUser;
  await saveUsers(users);
  
  return { success: true };
}

export async function deleteUser(id: string) {
  const users = await getUsers();
  const filtered = users.filter(u => u.id !== id);
  if (filtered.length === users.length) return false;
  await saveUsers(filtered);
  return true;
}
