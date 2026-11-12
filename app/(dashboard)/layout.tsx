import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"
import { getSession } from "@/lib/auth-session"
import { isLocalMySqlMode } from "@/lib/mysql"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  if (isLocalMySqlMode()) {
    // Local MySQL Mode: Strictly enforce cryptographically verified HMAC session
    const session = await getSession();

    if (!session) {
      redirect('/login');
    }

    if (session.role === 'cashier') {
      redirect('/terminal');
    }

    if (
      session.role !== 'super_admin' &&
      session.role !== 'company_admin' &&
      session.role !== 'manager' &&
      session.role !== 'chef' &&
      session.role !== 'waiter' &&
      session.role !== 'delivery_staff'
    ) {
      redirect('/login');
    }
  } else {
    // Production / Non-MySQL Mode: 100% preserve existing live website and installed Electron behavior
    const session = await getSession();
    const cookieStore = await cookies();
    const role = session?.role || cookieStore.get('auth_role')?.value;

    if (
      role !== 'admin' &&
      role !== 'super_admin' &&
      role !== 'company_admin' &&
      role !== 'manager' &&
      role !== 'chef' &&
      role !== 'waiter' &&
      role !== 'delivery_staff'
    ) {
      redirect('/login');
    }
  }

  return (
    <div className="flex h-screen bg-zinc-950 text-white">
      <Sidebar />
      <div className="ml-20 flex flex-1 flex-col overflow-hidden min-w-0">
        <Header />
        <main className="flex-1 overflow-y-auto p-4 sm:p-5 md:p-6 no-scrollbar bg-zinc-950 text-white min-w-0">
          {children}
        </main>
      </div>
    </div>
  )
}
