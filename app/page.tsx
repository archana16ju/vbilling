import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';

export default async function Home() {
  const session = await getSession();

  if (session) {
    if (session.role === 'super_admin') {
      redirect('/super-admin');
    }
    if (session.role === 'company_admin') {
      redirect('/dashboard');
    }
    if (session.role === 'cashier') {
      redirect('/terminal');
    }
  }

  redirect('/login');
}
