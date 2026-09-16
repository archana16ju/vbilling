'use client'
import { CartItemData, calculateItemTotal } from "@/lib/calculations"
import { useTerminalStore } from "@/store/useTerminalStore"
import { Trash2, Minus, Plus } from "lucide-react"
import { useState, useEffect } from "react"

export default function CartItem({ item }: { item: CartItemData }) {
  const { product, quantity } = item
  const updateQuantity = useTerminalStore((state) => state.updateQuantity)
  const removeFromCart = useTerminalStore((state) => state.removeFromCart)
  
  const [inputValue, setInputValue] = useState(quantity.toString())

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setInputValue(quantity.toString())
  }, [quantity])

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

  const lineTotal = calculateItemTotal(item)

  return (
    <div className="flex items-start justify-between border-b border-slate-100 bg-white p-3 hover:bg-slate-50">
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between">
          <h4 className="text-sm font-semibold text-slate-800">{product.name}</h4>
          <button 
            onClick={() => removeFromCart(product.id)}
            className="text-slate-400 hover:text-red-500"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-xs text-slate-500">
            {product.unit} × ₹{product.price}
          </span>
          <span className="font-semibold text-slate-900">₹{lineTotal.toFixed(2)}</span>
        </div>
        
        <div className="mt-2 flex items-center gap-2">
          <div className="flex items-center rounded-md border border-slate-200">
            <button 
              className="flex h-7 w-7 items-center justify-center rounded-l-md bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              onClick={() => updateQuantity(product.id, quantity - product.quantityStep)}
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
              className="flex h-7 w-7 items-center justify-center rounded-r-md bg-slate-50 text-slate-600 hover:bg-slate-100 active:bg-slate-200"
              onClick={() => updateQuantity(product.id, quantity + product.quantityStep)}
            >
              <Plus className="h-3 w-3" />
            </button>
          </div>
          <span className="text-xs text-slate-500">{product.unit}</span>
        </div>
      </div>
    </div>
  )
}
