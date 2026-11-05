import React, { useState, useEffect, useRef } from "react"
import { useTerminalStore } from "@/store/useTerminalStore"
import { useTerminalDesignStore } from "@/store/useTerminalDesignStore"
import { UtensilsCrossed, Search, X, LayoutGrid } from "lucide-react"

export default function CategoryPanel() {
  const { categories, selectedCategoryId, setCategory, terminalModeOverride, terminalThemeMode } = useTerminalStore()
  const design = useTerminalDesignStore()

  const safeCategories = categories || []
  const [mounted, setMounted] = useState(false)
  const [categorySearchQuery, setCategorySearchQuery] = useState('')
  const [hoveredTip, setHoveredTip] = useState<{ text: string; top: number; left: number } | null>(null)

  const searchInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => setMounted(true), [])

  // Clear hover tooltip when scrolling
  const handleScroll = () => {
    if (hoveredTip) setHoveredTip(null)
  }

  const showTooltip = (e: React.MouseEvent<HTMLElement>, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect()
    setHoveredTip({
      text,
      top: rect.top + rect.height / 2,
      left: rect.right + 10,
    })
  }

  const hideTooltip = () => {
    setHoveredTip(null)
  }

  if (!mounted) {
    return <div className="flex h-full w-full flex-col bg-zinc-950 pt-3" />
  }

  const isLight = terminalModeOverride === 'light' || terminalThemeMode === 'light'
  const isAllActive = selectedCategoryId === 'all' || !selectedCategoryId

  const filteredCategories = safeCategories.filter((category) => {
    if (!category || category.id === 'all') return false
    if (!categorySearchQuery.trim()) return true
    return category.name.toLowerCase().includes(categorySearchQuery.toLowerCase().trim())
  })

  // Design config options from store
  const categoryStyle = design.categoryStyle || 'card-tile'
  const cardHeight = design.categoryCardHeight || 'h-24'
  const thumbShape = design.categoryThumbnailShape || 'rounded-full'
  const showCategoryCount = design.showCategoryCount ?? true
  const searchPlaceholder = design.categorySearchPlaceholder || (categoryStyle === 'compact-list' ? 'Filter categories...' : 'Search category...')

  return (
    <div
      className={`relative flex h-full w-full flex-col select-none transition-colors duration-150 border-r ${
        isLight
          ? 'bg-slate-100/90 text-zinc-900 border-zinc-200'
          : 'bg-zinc-950 text-white border-zinc-800'
      }`}
    >
      {/* ── DESIGN STYLE 2 (COMPACT ROW LIST - REF IMAGE 3) HEADER ── */}
      {categoryStyle === 'compact-list' && (
        <div className={`px-3 py-2.5 border-b shrink-0 flex items-center justify-between ${
          isLight ? 'border-zinc-200/80 bg-slate-50/60' : 'border-zinc-800/80 bg-zinc-950/60'
        }`}>
          <div className="flex items-center gap-2">
            <LayoutGrid className="h-4 w-4" style={{ color: 'var(--theme-accent, #EA580C)' }} />
            <span
              className="font-black text-xs tracking-wider uppercase"
              style={{ color: 'var(--theme-accent, #EA580C)' }}
            >
              Categories
            </span>
          </div>

          {showCategoryCount && (
            <span
              className="rounded-full px-2 py-0.5 text-[10px] font-black border tracking-tight"
              style={{
                color: 'var(--theme-accent, #EA580C)',
                borderColor: 'var(--theme-accent, #EA580C)',
                backgroundColor: 'var(--theme-badge-bg, rgba(234,88,12,0.15))',
              }}
            >
              {safeCategories.length}
            </span>
          )}
        </div>
      )}

      {/* ── Search Bar Toolbar ── */}
      <div className={`p-2.5 pb-2 shrink-0 ${categoryStyle === 'compact-list' ? 'pt-2' : ''}`}>
        <div className="relative flex items-center">
          <Search className={`absolute left-2.5 h-3.5 w-3.5 pointer-events-none ${isLight ? 'text-zinc-400' : 'text-zinc-500'}`} />
          <input
            ref={searchInputRef}
            type="text"
            placeholder={searchPlaceholder}
            value={categorySearchQuery}
            onChange={(e) => setCategorySearchQuery(e.target.value)}
            className={`w-full rounded-xl border py-1.5 pl-8 pr-7 text-xs outline-none transition shadow-inner ${
              isLight
                ? 'border-zinc-300 bg-white text-zinc-900 placeholder-zinc-400 focus:border-theme'
                : 'border-zinc-800 bg-zinc-900/90 text-white placeholder-zinc-500 focus:border-theme'
            }`}
          />
          {categorySearchQuery && (
            <button
              type="button"
              onClick={() => setCategorySearchQuery('')}
              className={`absolute right-1.5 flex h-5 w-5 items-center justify-center rounded-lg transition ${
                isLight ? 'text-zinc-400 hover:text-zinc-700' : 'text-zinc-500 hover:text-white'
              }`}
              title="Clear search"
            >
              <X className="h-3 w-3" />
            </button>
          )}
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          STYLE 1: VISUAL CARD TILES (MATCHING REFERENCE IMAGE 2)
      ────────────────────────────────────────────────────────────── */}
      {categoryStyle === 'card-tile' && (
        <div
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto no-scrollbar px-2.5 pb-4 space-y-2.5"
        >
          {/* "ALL ITEMS" Visual Card */}
          <button
            type="button"
            onClick={() => setCategory('all')}
            onMouseEnter={(e) => showTooltip(e, 'All Items')}
            onMouseLeave={hideTooltip}
            className={`group relative flex w-full flex-col justify-end rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 shadow-md ${cardHeight} ${
              isAllActive
                ? "border-theme shadow-lg shadow-theme-glow ring-2 ring-[var(--theme-accent,#DB2777)]"
                : isLight
                  ? "bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-lg"
                  : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850"
            }`}
            aria-label="All Items"
          >
            {/* Card Visual Background */}
            <div
              className="absolute inset-0 flex items-center justify-center transition-transform duration-300 group-hover:scale-105"
              style={{
                background: isAllActive
                  ? 'linear-gradient(135deg, var(--theme-gradient-start, #1F0715) 0%, var(--theme-gradient-mid, #701A3B) 50%, var(--theme-gradient-end, #DB2777) 100%)'
                  : isLight
                    ? 'linear-gradient(135deg, #f1f5f9 0%, #e2e8f0 100%)'
                    : 'linear-gradient(135deg, #18181b 0%, #27272a 100%)',
              }}
            >
              <UtensilsCrossed
                className={`h-8 w-8 transition-transform duration-200 group-hover:scale-110 ${
                  isAllActive
                    ? 'text-white drop-shadow-[0_2px_4px_rgba(0,0,0,0.5)]'
                    : isLight
                      ? 'text-zinc-600'
                      : 'text-zinc-400'
                }`}
              />
            </div>

            {/* Active selection dot indicator */}
            {isAllActive && (
              <span
                className="absolute top-2 right-2 h-2.5 w-2.5 rounded-full border border-black shadow"
                style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
              />
            )}

            {/* Bottom Overlay Category Name */}
            <div className="relative z-10 w-full bg-gradient-to-t from-black/90 via-black/55 to-transparent pt-6 pb-2 px-2.5 flex items-end">
              <span className="font-extrabold text-xs text-white tracking-wide uppercase truncate w-full text-left drop-shadow-[0_1px_2px_rgba(0,0,0,0.9)]">
                All Items
              </span>
            </div>
          </button>

          {/* Dynamic Category Cards */}
          {filteredCategories.length === 0 && categorySearchQuery ? (
            <div className="text-center py-8 px-2 text-xs text-zinc-500">
              No category found for &quot;{categorySearchQuery}&quot;
            </div>
          ) : (
            filteredCategories.map((category) => {
              const isActive = selectedCategoryId === category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategory(category.id)}
                  onMouseEnter={(e) => showTooltip(e, category.name)}
                  onMouseLeave={hideTooltip}
                  className={`group relative flex w-full flex-col justify-end rounded-2xl border overflow-hidden transition-all duration-200 cursor-pointer active:scale-95 shadow-md ${cardHeight} ${
                    isActive
                      ? "border-theme shadow-lg shadow-theme-glow ring-2 ring-[var(--theme-accent,#DB2777)]"
                      : isLight
                        ? "bg-white border-zinc-200 hover:border-zinc-400 hover:shadow-lg"
                        : "bg-zinc-900 border-zinc-800 hover:border-zinc-700 hover:bg-zinc-850"
                  }`}
                  aria-label={category.name}
                >
                  {/* Category Image or Fallback */}
                  {category.image ? (
                    <img
                      src={category.image}
                      alt={category.name}
                      className="absolute inset-0 h-full w-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  ) : (
                    <div
                      className={`absolute inset-0 flex items-center justify-center font-black text-2xl uppercase ${
                        isLight ? 'bg-zinc-200 text-zinc-600' : 'bg-zinc-800 text-zinc-300'
                      }`}
                    >
                      {category.name.charAt(0)}
                    </div>
                  )}

                  {/* Active indicator dot */}
                  {isActive && (
                    <span
                      className="absolute top-2 right-2 z-20 h-2.5 w-2.5 rounded-full border border-black shadow"
                      style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
                    />
                  )}

                  {/* Bottom Overlay with Category Name inside the image */}
                  <div className="relative z-10 w-full bg-gradient-to-t from-black/95 via-black/60 to-transparent pt-6 pb-2 px-2.5 flex items-end">
                    <span className="font-extrabold text-xs text-white tracking-wide line-clamp-2 leading-tight w-full text-left drop-shadow-[0_1px_2px_rgba(0,0,0,0.95)]">
                      {category.name}
                    </span>
                  </div>
                </button>
              )
            })
          )}
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────────
          STYLE 2: COMPACT ROW LIST (MATCHING REFERENCE IMAGE 3)
      ────────────────────────────────────────────────────────────── */}
      {categoryStyle === 'compact-list' && (
        <div
          onScroll={handleScroll}
          className="flex-1 overflow-y-auto no-scrollbar px-2 pb-4 space-y-1"
        >
          {/* "ALL ITEMS" Row */}
          <button
            type="button"
            onClick={() => setCategory('all')}
            onMouseEnter={(e) => showTooltip(e, 'All Items')}
            onMouseLeave={hideTooltip}
            className={`group relative flex w-full items-center gap-2.5 p-2 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 text-left ${
              isAllActive
                ? 'border-2 shadow-md shadow-theme-glow'
                : isLight
                  ? 'hover:bg-zinc-200/80 text-zinc-800'
                  : 'hover:bg-zinc-900 text-zinc-300 hover:text-white'
            }`}
            style={
              isAllActive
                ? {
                    borderColor: 'var(--theme-accent, #EA580C)',
                    background: 'linear-gradient(135deg, var(--theme-gradient-start, #260B03) 0%, var(--theme-gradient-end, #EA580C) 100%)',
                  }
                : undefined
            }
            aria-label="All Items"
          >
            {/* Left Circular Icon Badge */}
            <div
              className={`h-7 w-7 rounded-full flex items-center justify-center shrink-0 border transition-all ${
                isAllActive
                  ? 'bg-black/35 border-white/25 text-amber-400 shadow-inner'
                  : isLight
                    ? 'bg-zinc-200 border-zinc-300 text-zinc-600'
                    : 'bg-zinc-850 border-zinc-700 text-zinc-400 group-hover:text-white'
              }`}
            >
              <UtensilsCrossed className="h-3.5 w-3.5" />
            </div>

            {/* Label */}
            <span
              className={`text-xs font-bold truncate flex-1 ${
                isAllActive
                  ? 'text-white font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                  : isLight
                    ? 'text-zinc-800'
                    : 'text-zinc-300 group-hover:text-white'
              }`}
            >
              All Items
            </span>

            {/* Active Pill Indicator */}
            {isAllActive && (
              <span
                className="h-2 w-2 rounded-full shrink-0 mr-1 shadow-xs"
                style={{ backgroundColor: '#ffffff' }}
              />
            )}
          </button>

          {/* Dynamic Category Rows */}
          {filteredCategories.length === 0 && categorySearchQuery ? (
            <div className="text-center py-8 px-2 text-xs text-zinc-500">
              No category found for &quot;{categorySearchQuery}&quot;
            </div>
          ) : (
            filteredCategories.map((category) => {
              const isActive = selectedCategoryId === category.id

              return (
                <button
                  key={category.id}
                  type="button"
                  onClick={() => setCategory(category.id)}
                  onMouseEnter={(e) => showTooltip(e, category.name)}
                  onMouseLeave={hideTooltip}
                  className={`group relative flex w-full items-center gap-2.5 p-2 rounded-xl transition-all duration-150 cursor-pointer active:scale-95 text-left ${
                    isActive
                      ? 'border-2 shadow-md shadow-theme-glow'
                      : isLight
                        ? 'hover:bg-zinc-200/80 text-zinc-800'
                        : 'hover:bg-zinc-900 text-zinc-300 hover:text-white'
                  }`}
                  style={
                    isActive
                      ? {
                          borderColor: 'var(--theme-accent, #EA580C)',
                          background: 'linear-gradient(135deg, var(--theme-gradient-start, #260B03) 0%, var(--theme-gradient-end, #EA580C) 100%)',
                        }
                      : undefined
                  }
                  aria-label={category.name}
                >
                  {/* Left Thumbnail Image / Letter Fallback */}
                  <div
                    className={`h-7 w-7 ${thumbShape} overflow-hidden border shrink-0 flex items-center justify-center transition-all ${
                      isActive
                        ? 'border-white/30 shadow-xs'
                        : isLight
                          ? 'border-zinc-300 bg-zinc-200'
                          : 'border-zinc-700/60 bg-zinc-800'
                    }`}
                  >
                    {category.image ? (
                      <img
                        src={category.image}
                        alt={category.name}
                        className="h-full w-full object-cover"
                      />
                    ) : (
                      <span
                        className={`font-black text-[10px] uppercase ${
                          isActive
                            ? 'text-white'
                            : isLight
                              ? 'text-zinc-600'
                              : 'text-zinc-400 group-hover:text-white'
                        }`}
                      >
                        {category.name.charAt(0)}
                      </span>
                    )}
                  </div>

                  {/* Category Name Label */}
                  <span
                    className={`text-xs font-semibold truncate flex-1 ${
                      isActive
                        ? 'text-white font-black drop-shadow-[0_1px_2px_rgba(0,0,0,0.8)]'
                        : isLight
                          ? 'text-zinc-800 group-hover:text-zinc-950'
                          : 'text-zinc-300 group-hover:text-white'
                    }`}
                  >
                    {category.name}
                  </span>

                  {/* Active Indicator Dot */}
                  {isActive && (
                    <span
                      className="h-2 w-2 rounded-full shrink-0 mr-1 shadow-xs"
                      style={{ backgroundColor: '#ffffff' }}
                    />
                  )}
                </button>
              )
            })
          )}
        </div>
      )}

      {/* ── Fixed Floating Tooltip: NEVER clipped by scrollbars or products ── */}
      {hoveredTip && (
        <div
          style={{
            position: 'fixed',
            top: hoveredTip.top,
            left: hoveredTip.left,
            transform: 'translateY(-50%)',
            zIndex: 99999,
          }}
          className="pointer-events-none whitespace-nowrap rounded-lg border border-zinc-700 bg-zinc-900/95 backdrop-blur-sm px-2.5 py-1 text-[11px] font-bold text-white shadow-xl animate-in fade-in zoom-in-95 duration-100"
        >
          {hoveredTip.text}
          <span className="absolute right-full top-1/2 -translate-y-1/2 border-4 border-transparent border-r-zinc-700" />
        </div>
      )}
    </div>
  )
}
