'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import ProductCard from "./ProductCard"
import { Search, SlidersHorizontal } from "lucide-react"

export default function ProductPanel() {
  const { products, selectedCategoryId, categories, searchQuery, setSearchQuery } = useTerminalStore()
  
  const selectedCategory = categories.find(c => c.id === selectedCategoryId)
  
  const filteredProducts = products.filter(p => {
    const matchesCategory = selectedCategoryId === 'all' || p.categoryId === selectedCategoryId
    const matchesSearch = p.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          p.sku.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          p.barcode.includes(searchQuery)
    return matchesCategory && matchesSearch
  })

  return (
    <div className="flex h-full flex-col bg-white">
      <div className="px-6 pt-6 pb-2">
        <div className="flex items-center gap-3 mb-4">
          <h2 className="text-2xl font-bold text-zinc-900">
            {selectedCategory?.name || 'All Products'}
          </h2>
          <span className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-semibold text-gray-900">
            {filteredProducts.length} items
          </span>
        </div>
        
        <div className="flex items-center gap-3">
          <div className="relative flex-1">
            <div className="absolute left-3 top-2.5 flex items-center text-black">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M3 7V5a2 2 0 0 1 2-2h2"/><path d="M17 3h2a2 2 0 0 1 2 2v2"/><path d="M21 17v2a2 2 0 0 1-2 2h-2"/><path d="M7 21H5a2 2 0 0 1-2-2v-2"/><path d="M8 7v10"/><path d="M12 7v10"/><path d="M16 7v10"/></svg>
            </div>
            <input
              type="text"
              placeholder="Scan barcode, enter SKU or search item title..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  if (filteredProducts.length === 1) {
                    useTerminalStore.getState().addToCart(filteredProducts[0]);
                    setSearchQuery('');
                  }
                }
              }}
              className="w-full rounded-md border border-zinc-200 bg-white py-2.5 pl-11 pr-20 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-gray-600 focus:ring-1 focus:ring-gray-600"
            />
            <div className="absolute right-2 top-2 rounded bg-gray-100 px-2 py-1 text-xs font-semibold text-gray-900">
              Enter ↵ to Add
            </div>
          </div>
          
          <button className="rounded-md bg-zinc-800 px-5 py-2.5 text-sm font-bold text-white hover:bg-zinc-900">
            ALL
          </button>
        </div>
      </div>
      
      <div className="flex-1 overflow-y-auto">
        <div className="grid grid-cols-12 gap-4 border-y border-zinc-100 bg-gray-100/30 px-6 py-3 text-xs font-bold tracking-wider text-zinc-500 uppercase">
          <div className="col-span-7">PRODUCT</div>
          <div className="col-span-2 text-right">PRICE</div>
          <div className="col-span-3 text-right">QUICK TENDER</div>
        </div>
        <div className="flex flex-col">
          {filteredProducts.map((product) => (
            <ProductCard key={product.id} product={product} />
          ))}
          {filteredProducts.length === 0 && (
            <div className="flex flex-col items-center justify-center p-12 text-zinc-500">
              <p className="text-lg font-medium">No products found</p>
              <p className="text-sm">Try adjusting your search or category filter</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}