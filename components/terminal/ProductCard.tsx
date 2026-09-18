'use client'
import { Product } from "@/lib/mock-data"
import { useTerminalStore } from "@/store/useTerminalStore"

export default function ProductCard({ product }: { product: Product }) {
  const addToCart = useTerminalStore((state) => state.addToCart)
  
  if (!product) return null;
  const productName = product.name || 'Unknown Product';

  return (
    <div className="grid grid-cols-12 items-center gap-4 border-b border-zinc-100 bg-white px-6 py-4 transition-colors hover:bg-zinc-50">
      <div className="col-span-7 flex items-center gap-4">
        {product.image ? (
          <img 
            src={product.image} 
            alt={productName}
            className="h-16 w-16 shrink-0 rounded-xl object-cover shadow-sm bg-white"
          />
        ) : (
          <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-xl bg-zinc-100 font-bold text-zinc-400 shadow-sm">
            {productName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          <span className="font-bold text-zinc-900">{productName}</span>
          <span className="text-xs text-zinc-500">SKU: {product.sku || 'N/A'}</span>
        </div>
      </div>
      
      <div className="col-span-2 text-right">
        <span className="text-lg font-bold text-zinc-800">₹{product.price || 0}</span>
      </div>
      
      <div className="col-span-3 flex justify-end">
        <button 
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 font-bold text-white transition-colors hover:bg-gray-800 active:scale-95"
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
