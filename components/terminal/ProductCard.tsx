'use client'
import { Product } from "@/lib/mock-data"
import { useTerminalStore } from "@/store/useTerminalStore"

export default function ProductCard({ product }: { product: Product }) {
  const addToCart = useTerminalStore((state) => state.addToCart)

  return (
    <div className="grid grid-cols-12 items-center gap-4 border-b border-slate-100 bg-white px-6 py-4 transition-colors hover:bg-slate-50">
      <div className="col-span-8 flex items-center gap-4">
        {product.image ? (
          <img 
            src={product.image} 
            alt={product.name}
            className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm bg-white"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-slate-100 font-bold text-slate-400 shadow-sm">
            {product.name.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-bold text-slate-900">{product.name}</span>
          <span className="text-xs text-slate-500">SKU: {product.sku}</span>
        </div>
      </div>
      
      <div className="col-span-2 text-right">
        <span className="text-lg font-bold text-slate-800">₹{product.price}</span>
      </div>
      
      <div className="col-span-2 flex justify-end">
        <button 
          className="flex items-center gap-2 rounded-md bg-blue-700 px-4 py-2 font-bold text-white transition-colors hover:bg-blue-800 active:scale-95"
          onClick={() => addToCart(product)}
        >
          <ShoppingCartIcon className="h-4 w-4" />
          Add <span className="hidden opacity-60 xl:inline-block">[↵]</span>
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
