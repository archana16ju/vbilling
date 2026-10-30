'use client'
import { Product } from "@/lib/mock-data"
import { useTerminalStore } from "@/store/useTerminalStore"

export default function ProductCard({ product }: { product: Product }) {
  const addToCart = useTerminalStore((state) => state.addToCart)
  
  if (!product) return null;
  const productName = product.name || 'Unknown Product';

  return (
    <div className="grid grid-cols-12 items-center gap-4 border-b border-zinc-800/60 bg-zinc-950 px-6 py-4 transition-colors hover:bg-zinc-900/60">
      <div className="col-span-7 flex items-center gap-4">
        {product.image ? (
          <img 
            src={product.image} 
            alt={productName}
            className="h-14 w-14 shrink-0 rounded-2xl object-cover shadow-md bg-zinc-900 border border-zinc-800"
          />
        ) : (
          <div 
            className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-zinc-900 border border-zinc-800 font-black text-base shadow-sm"
            style={{ color: 'var(--theme-accent, #DB2777)' }}
          >
            {productName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-bold text-white text-sm">{productName}</span>
          <span className="text-xs text-zinc-500 font-mono mt-0.5">SKU: {product.sku || 'N/A'}</span>
        </div>
      </div>
      
      <div className="col-span-2 text-right">
        <span className="text-lg font-black" style={{ color: 'var(--theme-accent, #DB2777)' }}>₹{product.price || 0}</span>
      </div>
      
      <div className="col-span-3 flex justify-end">
        <button 
          className="flex items-center gap-2 rounded-xl bg-theme-bar border border-theme shadow-theme-glow hover:opacity-95 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
          onClick={() => addToCart(product)}
        >
          <ShoppingCartIcon className="h-3.5 w-3.5" />
          <span>Add</span> <span className="hidden opacity-75 xl:inline-block">[↵]</span>
        </button>
      </div>
    </div>
  )
}

function ShoppingCartIcon(props: React.SVGProps<SVGSVGElement>) {
  return (
    <svg
      {...props}
      xmlns="http://www.w3.org/2000/svg"
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <circle cx="8" cy="21" r="1" />
      <circle cx="19" cy="21" r="1" />
      <path d="M2.05 2.05h2l2.66 12.42a2 2 0 0 0 2 1.58h9.78a2 2 0 0 0 1.95-1.57l1.65-7.43H5.12" />
    </svg>
  )
}
