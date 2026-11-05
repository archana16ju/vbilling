import { redirect } from 'next/navigation';
import { getSession } from '@/lib/auth-session';

export default async function Home() {
  const session = await getSession();

  if (session) {
    if (session.role === 'super_admin') {
      redirect('/super-admin');
    }
    if (session.role === 'company_admin' || session.role === 'manager') {
      redirect('/dashboard');
    }
    if (session.role === 'chef') {
      redirect('/kitchen');
    }
    if (session.role === 'waiter') {
      redirect('/assigned-orders');
    }
    if (session.role === 'delivery_staff') {
      redirect('/delivery');
    }
    if (session.role === 'cashier') {
      redirect('/terminal');
    }
  }

  redirect('/login');
}
