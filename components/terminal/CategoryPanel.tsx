'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Search } from "lucide-react"

export default function CategoryPanel() {
  const { categories, selectedCategoryId, setCategory } = useTerminalStore()

  return (
    <div className="flex h-full flex-col bg-white pt-4">
      <div className="mb-4 px-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="flex items-center gap-2 text-xl font-bold text-slate-800">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="text-blue-600"><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            Categories
          </h2>
          <span className="rounded-full bg-blue-50 px-2 py-0.5 text-xs font-semibold text-blue-600">
            ({categories.length})
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-400" />
          <input
            type="text"
            placeholder="Filter categories..."
            className="w-full rounded-md border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm outline-none placeholder:text-slate-400 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto px-2 pb-4">
        <div className="flex flex-col gap-1">
          {categories.map((category) => {
            const isActive = selectedCategoryId === category.id
            
            return (
              <button
                key={category.id}
                onClick={() => setCategory(category.id)}
                className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors ${
                  isActive
                    ? "bg-indigo-100 font-semibold text-blue-900"
                    : "bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {category.image ? (
                  <img 
                    src={category.image} 
                    alt={category.name} 
                    className="h-10 w-10 shrink-0 rounded-full object-cover shadow-sm bg-white"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-slate-100 font-bold text-slate-400 shadow-sm">
                    {category.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-base">{category.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}