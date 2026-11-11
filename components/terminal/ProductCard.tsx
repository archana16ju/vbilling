'use client'
import { Product } from "@/lib/mock-data"
import { useTerminalStore } from "@/store/useTerminalStore"
import { useTerminalDesignStore } from "@/store/useTerminalDesignStore"
import { Layers, Tag } from "lucide-react"
import { getProductPromotionTag } from "@/lib/promotion-helper"

interface ProductCardProps {
  product: Product;
  onSelectProduct?: (product: Product) => void;
}

export default function ProductCard({ product, onSelectProduct }: ProductCardProps) {
  const addToCart = useTerminalStore((state) => state.addToCart)
  const promotions = useTerminalStore((state) => state.promotions)
  const design = useTerminalDesignStore()
  
  if (!product) return null;
  const productName = product.name || 'Unknown Product';
  const currency = design.currencySymbol || '₹';
  const accentColor = design.accentColor || 'var(--theme-accent, #DB2777)';
  const hasAddons = Boolean(product.addonGroupIds && product.addonGroupIds.length > 0);
  const promoTag = getProductPromotionTag(product, promotions);

  const handleAdd = () => {
    if (onSelectProduct) {
      onSelectProduct(product);
    } else {
      addToCart(product);
    }
  };

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
            style={{ color: accentColor }}
          >
            {productName.charAt(0).toUpperCase()}
          </div>
        )}
        <div className="flex flex-col">
          <div className="flex items-center gap-2">
            <span className="font-bold text-white text-sm">{productName}</span>
            {hasAddons && (
              <span className="inline-flex items-center gap-1 rounded bg-purple-950/80 border border-purple-800/60 px-1.5 py-0.2 text-[10px] font-bold text-purple-300">
                <Layers className="h-2.5 w-2.5" />
                Add-ons
              </span>
            )}
            {promoTag && (
              <span className="inline-flex items-center gap-1 rounded bg-amber-500/20 border border-amber-500/40 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                <Tag className="h-2.5 w-2.5 text-amber-400" />
                {promoTag.tag}
              </span>
            )}
          </div>
          <span className="text-xs text-zinc-500 font-mono mt-0.5">SKU: {product.sku || 'N/A'}</span>
        </div>
      </div>
      
      <div className="col-span-2 text-right">
        {promoTag?.promotionalPrice !== undefined && promoTag.promotionalPrice !== product.price ? (
          <div className="flex flex-col items-end">
            <span className="text-xs text-zinc-500 line-through font-mono">
              {currency}{Number(product.price || 0).toFixed(product.price % 1 === 0 ? 0 : 2)}
            </span>
            <span className="text-lg font-black text-emerald-400">
              {currency}{Number(promoTag.promotionalPrice).toFixed(promoTag.promotionalPrice % 1 === 0 ? 0 : 2)}
            </span>
          </div>
        ) : (
          <span className="text-lg font-black" style={{ color: accentColor }}>
            {currency}{Number(product.price || 0).toFixed(product.price % 1 === 0 ? 0 : 2)}
          </span>
        )}
      </div>
      
      <div className="col-span-3 flex justify-end">
        <button 
          className="flex items-center gap-2 rounded-xl bg-theme-bar border border-theme shadow-theme-glow hover:opacity-95 px-4 py-2 text-xs font-bold text-white transition-all cursor-pointer active:scale-95"
          onClick={handleAdd}
        >
          <ShoppingCartIcon className="h-3.5 w-3.5" />
          <span>{hasAddons ? 'Customize' : 'Add'}</span> <span className="hidden opacity-75 xl:inline-block">[↵]</span>
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
