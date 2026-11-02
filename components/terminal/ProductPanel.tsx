'use client';

import { useTerminalStore } from '@/store/useTerminalStore';
import ProductCard from './ProductCard';
import { Search, SlidersHorizontal, Barcode, CornerDownLeft, Sparkles, Check, Plus, Package } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';

import { useTerminalDesignStore } from '@/store/useTerminalDesignStore';
import { useShortcutsStore } from '@/store/useShortcutsStore';
import ProductGridCard from './ProductGridCard';
import { Product } from '@/lib/mock-data';

export default function ProductPanel() {
  const {
    products,
    selectedCategoryId = 'all',
    categories,
    searchQuery,
    setSearchQuery,
    addToCart,
    setCategory,
  } = useTerminalStore();

  const design = useTerminalDesignStore();
  const shortcutsStore = useShortcutsStore();

  const safeProducts = products || [];
  const safeCategories = categories || [];

  const selectedCategory = safeCategories.find((c) => c?.id === selectedCategoryId);
  const safeSearchQuery = (searchQuery || '').toLowerCase().trim();

  const isSearchBased = design.displayStyle === 'search-based';
  const isImageGrid = design.displayStyle === 'image-grid' || design.displayStyle === 'compact-grid';

  const filteredProducts = safeProducts.filter((p) => {
    if (!p) return false;
    const matchesCategory =
      selectedCategoryId === 'all' || p.categoryId === selectedCategoryId;

    // In search-based design, if query is empty, filteredProducts is empty
    if (isSearchBased && !safeSearchQuery) {
      return false;
    }

    if (!safeSearchQuery) {
      return matchesCategory;
    }

    const matchesSearch =
      (p.name || '').toLowerCase().includes(safeSearchQuery) ||
      (p.sku || '').toLowerCase().includes(safeSearchQuery) ||
      (p.barcode || '').includes(searchQuery || '');

    return matchesCategory && matchesSearch;
  });

  const [mounted, setMounted] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Reset highlighted index when search results change
  useEffect(() => {
    setHighlightedIndex(0);
  }, [searchQuery, selectedCategoryId]);

  // Load authoritative company terminal design on mount
  useEffect(() => {
    design.fetchCompanyTerminalDesign(undefined, true);
  }, []);

  useEffect(() => {
    setMounted(true);

    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      // Jump to product search: '/' or registered shortcut (e.g. F1)
      if (shortcutsStore.isActionTriggered('product_search', e) && !isInput) {
        e.preventDefault();
        searchInputRef.current?.focus();
        searchInputRef.current?.select();
        return;
      }

      // Close / Clear search: Esc
      if (e.key === 'Escape') {
        if (searchQuery) {
          e.preventDefault();
          setSearchQuery('');
          searchInputRef.current?.blur();
        }
        return;
      }

      // Previous Category: Ctrl + ←
      if (shortcutsStore.isActionTriggered('product_prev_category', e)) {
        e.preventDefault();
        const catList = ['all', ...safeCategories.map((c) => c.id)];
        const curIdx = catList.indexOf(selectedCategoryId);
        const prevIdx = (curIdx - 1 + catList.length) % catList.length;
        setCategory(catList[prevIdx]);
        return;
      }

      // Next Category: Ctrl + →
      if (shortcutsStore.isActionTriggered('product_next_category', e)) {
        e.preventDefault();
        const catList = ['all', ...safeCategories.map((c) => c.id)];
        const curIdx = catList.indexOf(selectedCategoryId);
        const nextIdx = (curIdx + 1) % catList.length;
        setCategory(catList[nextIdx]);
        return;
      }

      // Product navigation in search results or grid
      if (filteredProducts.length > 0) {
        if (shortcutsStore.isActionTriggered('product_down', e) || (isInput && e.key === 'ArrowDown')) {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev + 1) % filteredProducts.length);
          return;
        }

        if (shortcutsStore.isActionTriggered('product_up', e) || (isInput && e.key === 'ArrowUp')) {
          e.preventDefault();
          setHighlightedIndex((prev) => (prev - 1 + filteredProducts.length) % filteredProducts.length);
          return;
        }

        // Add selected product on Enter (when not submitting other dialogs)
        if (
          shortcutsStore.isActionTriggered('product_add', e) &&
          !isInput &&
          highlightedIndex >= 0 &&
          highlightedIndex < filteredProducts.length
        ) {
          e.preventDefault();
          handleSelectProduct(filteredProducts[highlightedIndex]);
          return;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    filteredProducts,
    highlightedIndex,
    safeCategories,
    selectedCategoryId,
    searchQuery,
    setSearchQuery,
    setCategory,
    shortcutsStore,
  ]);

  const handleSelectProduct = (product: Product) => {
    addToCart(product);
    // In search-based design, if cashier typed a specific barcode/SKU or item, can clear search for rapid next scan
    if (isSearchBased) {
      // Keep search focused for the next barcode scan or product search
      if (searchInputRef.current) {
        searchInputRef.current.focus();
        searchInputRef.current.select();
      }
    }
  };

  if (!mounted) return <div className="flex h-full flex-col bg-zinc-950" />;

  const getGridColsClass = (cols: number) => {
    switch (cols) {
      case 2:
        return 'grid-cols-2';
      case 3:
        return 'grid-cols-2 sm:grid-cols-3';
      case 5:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';
      case 4:
      default:
        return 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4';
    }
  };

  const showShortcutBadges = shortcutsStore.config.showKeysOnButtons;
  const searchShortcutBadge = shortcutsStore.getActionDisplayKey('product_search') || '/';

  return (
    <div className="flex h-full flex-col bg-zinc-950 text-white">
      {/* Top Search & Filter Bar */}
      <div className="px-6 pt-5 pb-2">
        <div className="flex items-center justify-between mb-4 gap-3">
  {/* LEFT SIDE: Heading and Item Count */}
  <div className="flex items-center gap-5 min-w-0">
    <h2 className="text-xl font-black text-white">
      {isSearchBased
        ? 'Search-Based Billing'
        : selectedCategory?.name || 'All Products'}
    </h2>

    <span
      className="rounded-full border px-2.5 py-0.5 text-xs font-bold"
      style={{
        backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
        color: 'var(--theme-badge-text, #F472B6)',
        borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
      }}
    >
      {isSearchBased && !safeSearchQuery
        ? 'Standby'
        : `${filteredProducts.length} items`}
    </span>
  </div>

  {/* RIGHT SIDE: Tap Mode Banner */}
  {!isSearchBased && isImageGrid && design.showTapBanner && (
    <span
      className="hidden sm:inline-flex items-center gap-2 rounded-2xl border px-3 py-1 text-xs font-bold shrink-0 ml-auto"
      style={{
        backgroundColor: design.bannerBgColor || '#1F0715',
        color: design.bannerTextColor || '#f4f4f5',
        borderColor: design.activeBorderColor || 'var(--theme-active-border, #DB2777)',
      }}
    >
      <span className="text-sm select-none">👆</span>

      <span>
        {design.tapBannerText || 'Tap to Add • Double-Tap +1 Qty'}
      </span>

      <span
        className="inline-flex items-center gap-1 text-[10px] font-black tracking-wider font-mono px-2 py-0.5 rounded-full border"
        style={{
          backgroundColor: 'rgba(0,0,0,0.45)',
          color: design.accentColor || 'var(--theme-accent, #DB2777)',
          borderColor: design.activeBorderColor || 'var(--theme-active-border, #DB2777)',
        }}
      >
        <span
          className="h-1.5 w-1.5 rounded-full animate-pulse"
          style={{
            backgroundColor: design.accentColor || 'var(--theme-accent, #DB2777)',
          }}
        />
        {design.tapBannerBadgeText || 'TAP MODE ACTIVE'}
      </span>
    </span>
  )}

  {isSearchBased && (
    <span className="hidden sm:inline-flex items-center gap-1.5 text-[11px] font-mono text-zinc-400 bg-zinc-900 border border-zinc-800 px-2.5 py-1 rounded-xl ml-auto">
      <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse"></span>
      Fast Scan Terminal
    </span>
  )}
</div>

        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div
              className="absolute left-3.5 top-3 flex items-center"
              style={{ color: 'var(--theme-accent, #DB2777)' }}
            >
              <Barcode className="h-4 w-4" />
            </div>

            <input
              ref={searchInputRef}
              type="text"
              placeholder="Scan barcode, enter SKU or search product title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProducts.length > 0) {
                    const targetProduct =
                      filteredProducts[highlightedIndex] || filteredProducts[0];
                    handleSelectProduct(targetProduct);
                    if (filteredProducts.length === 1) {
                      setSearchQuery('');
                    }
                  }
                } else if (e.key === 'Escape') {
                  e.preventDefault();
                  setSearchQuery('');
                  searchInputRef.current?.blur();
                }
              }}
              className="w-full rounded-xl border border-zinc-800 bg-zinc-900/90 py-2.5 pl-11 pr-28 text-xs text-white outline-none placeholder:text-zinc-500 focus:border-theme transition shadow-inner"
            />

            <div className="absolute right-2.5 top-2 flex items-center gap-1.5">
              {showShortcutBadges && searchShortcutBadge && (
                <kbd
                  className="rounded-md border border-zinc-700 bg-zinc-800 px-1.5 py-0.5 text-[10px] font-mono font-bold text-zinc-400"
                  title="Press to jump to search"
                >
                  {searchShortcutBadge}
                </kbd>
              )}
              <div
                className="rounded-lg bg-zinc-800 border border-zinc-700 px-2 py-1 text-[10px] font-mono font-bold"
                style={{ color: 'var(--theme-badge-text, #F472B6)' }}
              >
                Enter ↵ to Add
              </div>
            </div>
          </div>

          <button
            onClick={() => setCategory('all')}
            className={`rounded-xl px-4 py-2.5 text-xs font-black transition cursor-pointer ${selectedCategoryId === 'all'
                ? 'bg-theme-bar border border-theme text-white shadow-lg shadow-theme-glow'
                : 'bg-zinc-900 border border-zinc-800 text-zinc-400 hover:text-white hover:bg-zinc-800'
              }`}
          >
            ALL
          </button>
        </div>
      </div>

      {/* Tap Mode Banner removed from here — now shown inline beside the heading */}

      {/* Main Center Display Section */}
      <div className="flex-1 overflow-y-auto no-scrollbar flex flex-col">
        {/* DESIGN 1: NEW SEARCH-BASED FAST BILLING */}
        {isSearchBased ? (
          !safeSearchQuery ? (
            /* Empty State by default when terminal opens or search is cleared */
            <div className="flex-1 flex flex-col items-center justify-center p-8 text-center select-none animate-in fade-in duration-200">
              <div
                className="flex h-20 w-20 items-center justify-center rounded-3xl bg-zinc-900/90 border border-zinc-800 shadow-2xl mb-4 transition-transform hover:scale-105"
                style={{ color: 'var(--theme-accent, #DB2777)' }}
              >
                <Barcode className="h-10 w-10 animate-pulse" />
              </div>
              <h3 className="text-lg font-black text-white">
                Scan Barcode or Search Product
              </h3>
              <p className="text-xs text-zinc-400 max-w-md mt-1.5 leading-relaxed">
                Center product display stays clean and empty until you scan a barcode, type SKU, or search an item name. Matching products will appear here instantly.
              </p>

              <div className="mt-6 flex flex-wrap items-center justify-center gap-2.5">
                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-mono text-zinc-300 shadow-sm">
                  <kbd className="font-bold text-pink-400 font-mono text-[11px]">/</kbd>
                  <span>Focus Search</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-mono text-zinc-300 shadow-sm">
                  <kbd className="font-bold text-emerald-400 font-mono text-[11px]">Enter ↵</kbd>
                  <span>Select & Add to Cart</span>
                </div>
                <div className="flex items-center gap-1.5 rounded-xl border border-zinc-800 bg-zinc-900/80 px-3 py-1.5 text-xs font-mono text-zinc-300 shadow-sm">
                  <kbd className="font-bold text-amber-400 font-mono text-[11px]">Esc</kbd>
                  <span>Clear & Return to Standby</span>
                </div>
              </div>
            </div>
          ) : filteredProducts.length === 0 ? (
            /* No search match */
            <div className="flex-1 flex flex-col items-center justify-center p-12 text-zinc-500">
              <Package className="h-12 w-12 text-zinc-700 mb-3" />
              <p className="text-base font-bold text-zinc-300">
                No matching product for &quot;{searchQuery}&quot;
              </p>
              <p className="text-xs text-zinc-500 mt-1">
                Check barcode scanner or try searching by SKU or product name
              </p>
            </div>
          ) : (
            /* Search Results Display: Fast interactive rows */
            <div className="p-6 space-y-2.5">
              <div className="flex items-center justify-between text-xs text-zinc-400 pb-2 border-b border-zinc-800 px-2 font-bold uppercase tracking-wider">
                <span>Matching Products ({filteredProducts.length})</span>
                <span className="text-[11px] text-zinc-500 font-mono">
                  Use ↑ ↓ to navigate • Click or press Enter to add
                </span>
              </div>

              <div className="space-y-2">
                {filteredProducts.map((product, idx) => {
                  const isHighlighted = idx === highlightedIndex;

                  return (
                    <div
                      key={product.id}
                      onClick={() => handleSelectProduct(product)}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex items-center justify-between rounded-2xl border p-4 transition-all cursor-pointer ${isHighlighted
                          ? 'border-theme bg-theme-badge ring-2 ring-theme shadow-lg shadow-theme-glow'
                          : 'border-zinc-800 bg-zinc-900/60 hover:border-zinc-700 hover:bg-zinc-800/40'
                        }`}
                    >
                      <div className="flex items-center gap-3.5">
                        {product.image ? (
                          <img
                            src={product.image}
                            alt={product.name}
                            className="h-12 w-12 rounded-xl object-cover border border-zinc-800 shrink-0"
                          />
                        ) : (
                          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-zinc-800 border border-zinc-700 text-zinc-400 shrink-0 font-bold text-sm">
                            {product.name.charAt(0)}
                          </div>
                        )}

                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-bold text-sm text-white">
                              {product.name}
                            </span>
                            {product.sku && (
                              <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                SKU: {product.sku}
                              </span>
                            )}
                            {product.barcode && (
                              <span className="rounded-md border border-zinc-700 bg-zinc-800/80 px-1.5 py-0.5 text-[10px] font-mono text-zinc-400">
                                #{product.barcode}
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-3 mt-1 text-xs text-zinc-400">
                            <span>
                              Stock:{' '}
                              <strong
                                className={
                                  product.stock > 5 ? 'text-emerald-400' : 'text-amber-400'
                                }
                              >
                                {product.stock} {product.unit || 'pcs'}
                              </strong>
                            </span>
                            {(product.discount || 0) > 0 && (
                              <span className="rounded bg-rose-500/20 text-rose-300 border border-rose-500/30 px-1.5 py-0.2 text-[10px] font-bold">
                                -{product.discount}% OFF
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-4">
                        <div className="text-right">
                          <div
                            className="text-base font-black font-mono"
                            style={{ color: 'var(--theme-accent, #DB2777)' }}
                          >
                            {design.currencySymbol}
                            {Number(product.price).toFixed(2)}
                          </div>
                          <div className="text-[10px] text-zinc-500">
                            per {product.unit || 'pc'}
                          </div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleSelectProduct(product);
                          }}
                          className="flex items-center gap-1.5 rounded-xl btn-theme-primary px-3.5 py-2 text-xs font-bold text-white shadow-theme-glow active:scale-95 transition cursor-pointer"
                        >
                          <Plus className="h-3.5 w-3.5" />
                          <span>Add</span>
                          {isHighlighted && (
                            <kbd className="hidden sm:inline-block ml-1 rounded bg-black/30 px-1 py-0.2 text-[9px] font-mono">
                              ↵
                            </kbd>
                          )}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )
        ) : !isImageGrid ? (
          /* DESIGN 2: CLASSIC LIST (PRESERVED) */
          <div>
            <div className="grid grid-cols-12 gap-4 border-y border-zinc-800 bg-zinc-900/90 px-6 py-2.5 text-[11px] font-bold tracking-wider text-zinc-400 uppercase">
              <div className="col-span-7">PRODUCT</div>
              <div className="col-span-2 text-right">PRICE</div>
              <div className="col-span-3 text-right">QUICK TENDER</div>
            </div>
            <div className="flex flex-col">
              {filteredProducts.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </div>
        ) : (
          /* DESIGN 3: VISUAL IMAGE GRID (PRESERVED) */
          <div
            className={`p-6 grid ${getGridColsClass(design.gridColumns)} ${design.cardGap || 'gap-4'
              }`}
          >
            {filteredProducts.map((product) => (
              <ProductGridCard key={product.id} product={product} />
            ))}
          </div>
        )}

        {!isSearchBased && filteredProducts.length === 0 && (
          <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
            <p className="text-base font-bold text-zinc-300">No products found</p>
            <p className="text-xs text-zinc-500 mt-1">
              Try adjusting your search or category filter
            </p>
          </div>
        )}
      </div>
    </div>
  );
}