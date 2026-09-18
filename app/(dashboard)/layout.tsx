import Sidebar from "@/components/layout/Sidebar"
import Header from "@/components/layout/Header"
import { cookies } from "next/headers"
import { redirect } from "next/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies()
  const role = cookieStore.get('auth_role')?.value

  if (role !== 'admin') {
    redirect('/login')
  }

  return (
    <div className="flex h-screen bg-zinc-50">
      <Sidebar />
      <div className="ml-64 flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-8">
          {children}
        </main>
      </div>
    </div>
  )
}
