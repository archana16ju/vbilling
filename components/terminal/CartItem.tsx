'use client'
import { CartItemData, calculateItemSubtotal } from "@/lib/calculations"
import { useTerminalStore } from "@/store/useTerminalStore"
import { Trash2, Minus, Plus } from "lucide-react"
import { useState, useEffect } from "react"

export default function CartItem({ item }: { item: CartItemData }) {
  if (!item || !item.product) return null;
  const product = item.product;
  const quantity = item.quantity ?? 1;

  const updateQuantity = useTerminalStore((state) => state.updateQuantity)
  const removeFromCart = useTerminalStore((state) => state.removeFromCart)
  
  const [inputValue, setInputValue] = useState(quantity.toString())

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue((item.quantity ?? 1).toString())
  }, [item.quantity])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const val = parseFloat(inputValue)
    if (!isNaN(val) && val >= 0) {
      updateQuantity(product.id, val)
    } else {
      setInputValue(quantity.toString())
    }
  }

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleInputBlur()
    }
  }

  const lineSubtotal = calculateItemSubtotal(item)

  return (
    <div className="flex items-start justify-between border-b border-zinc-100 bg-white p-3 hover:bg-zinc-50">
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <h4 className="text-sm font-semibold text-zinc-800">{product.name}</h4>
          <button 
            onClick={() => removeFromCart(product.id)}
            className="text-zinc-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-zinc-500">
            {product.unit || 'pc'} × ₹{product.price || 0}
          </span>
          <span className="font-semibold text-zinc-900">₹{lineSubtotal.toFixed(2)}</span>
        </div>
        
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center rounded-md border border-zinc-200">
            <button 
              className="flex h-7 w-7 items-center justify-center rounded-l-md bg-zinc-50 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200"
              onClick={() => updateQuantity(product.id, Math.max(0, quantity - (product.quantityStep || 1)))}
            >
              <Minus className="h-3 w-3" />
            </button>
            <input 
              type="text" 
              value={inputValue}
              onChange={handleInputChange}
              onBlur={handleInputBlur}
              onKeyDown={handleInputKeyDown}
              className="h-7 w-12 border-x-0 border-y-0 bg-white text-center text-sm font-medium outline-none focus:ring-0"
            />
            <button 
              className="flex h-7 w-7 items-center justify-center rounded-r-md bg-zinc-50 text-zinc-600 hover:bg-zinc-100 active:bg-zinc-200"
              onClick={() => updateQuantity(product.id, quantity + (product.quantityStep || 1))}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-zinc-500">{product.unit || 'pc'}</span>
        </div>
      </div>
    </div>
  )
}
