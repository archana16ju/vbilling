'use client';
import StatCard from "@/components/dashboard/StatCard"
import QuickActions from "@/components/dashboard/QuickActions"
import { Package } from "lucide-react"
import { useTerminalStore } from "@/store/useTerminalStore"

export default function DashboardPage() {
  const products = useTerminalStore((state) => state.products)
  const categories = useTerminalStore((state) => state.categories)

  return (
    <div className="space-y-6">
      <div className="flex flex-col mb-8">
        <h1 className="text-3xl font-bold text-zinc-800">Welcome back!</h1>
        <p className="text-zinc-500">Here is an overview of your current inventory.</p>
      </div>
      
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <div className="xl:col-span-2">
          <StatCard 
            title="Total Products" 
            value={products.length.toString()} 
            comparison={`${categories.length} categories active`} 
            icon={Package} 
          />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-1">
          <QuickActions />
        </div>
      </div>
    </div>
  )
}
