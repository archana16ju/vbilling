'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Search } from "lucide-react"
import { useState, useEffect } from "react"

export default function CategoryPanel() {
  const { categories, selectedCategoryId, setCategory } = useTerminalStore()
  
  const safeCategories = categories || [];
  
  const [mounted, setMounted] = useState(false)
  useEffect(() => setMounted(true), [])

  if (!mounted) return <div className="flex h-full flex-col bg-zinc-950 pt-4" />

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white pt-4 border-r border-zinc-800">
      <div className="mb-4 px-4">
        <div className="flex items-center justify-between mb-3">
          <h2 className="flex items-center gap-2 text-sm font-black uppercase tracking-wider text-white">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--theme-accent, #DB2777)' }}><rect width="7" height="7" x="3" y="3" rx="1"/><rect width="7" height="7" x="14" y="3" rx="1"/><rect width="7" height="7" x="14" y="14" rx="1"/><rect width="7" height="7" x="3" y="14" rx="1"/></svg>
            Categories
          </h2>
          <span 
            className="rounded-full px-2 py-0.5 text-xs font-bold border"
            style={{ 
              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
              color: 'var(--theme-badge-text, #F472B6)',
              borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))'
            }}
          >
            {safeCategories.length}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-2.5 h-3.5 w-3.5 text-zinc-500" />
          <input
            type="text"
            placeholder="Filter categories..."
            className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2 pl-9 pr-3 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-theme transition"
          />
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto no-scrollbar px-2 pb-4">
        <div className="flex flex-col gap-1.5">
          <button
            onClick={() => setCategory('all')}
            className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer ${
              selectedCategoryId === 'all' || !selectedCategoryId
                ? "bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow font-bold" 
                : "text-zinc-400 hover:bg-zinc-900 hover:text-white border border-transparent"
            }`}
          >
            <div 
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border shadow-sm"
              style={{
                backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                color: 'var(--theme-accent, #DB2777)'
              }}
            >
              <span className="text-base">🥘</span>
            </div>
            <span className="text-xs font-bold">All Items</span>
          </button>
          
          {safeCategories.map((category) => {
            if (!category || category.id === 'all') return null;
            const isActive = selectedCategoryId === category.id
            
            return (
              <button
                key={category.id}
                onClick={() => setCategory(category.id)}
                className={`flex items-center gap-3 rounded-xl px-3 py-2 text-left transition cursor-pointer ${
                  isActive 
                    ? "bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow font-bold" 
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-white border border-transparent"
                }`}
              >
                {category.image ? (
                  <img 
                    src={category.image} 
                    alt={category.name} 
                    className="h-9 w-9 shrink-0 rounded-xl object-cover shadow-sm bg-zinc-900 border border-zinc-800"
                  />
                ) : (
                  <div 
                    className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-900 border border-zinc-800 font-black text-xs shadow-sm"
                    style={{ color: isActive ? 'var(--theme-badge-text, #F472B6)' : 'var(--theme-accent, #DB2777)' }}
                  >
                    {category.name.charAt(0).toUpperCase()}
                  </div>
                )}
                <span className="text-xs font-bold">{category.name}</span>
              </button>
            )
          })}
        </div>
      </div>
    </div>
  )
}