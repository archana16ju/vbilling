'use client'
import { CartItemData, calculateItemSubtotal, calculateItemDiscount } from "@/lib/calculations"
import { useTerminalStore } from "@/store/useTerminalStore"
import { Trash2, Minus, Plus, Layers } from "lucide-react"
import { useState, useEffect } from "react"

interface CartItemProps {
  item: CartItemData;
  isSelected?: boolean;
  onSelect?: () => void;
}

export default function CartItem({ item, isSelected, onSelect }: CartItemProps) {
  if (!item || !item.product) return null;
  const product = item.product;
  const quantity = item.quantity ?? 1;
  const itemIdentifier = item.lineId || product.id;

  const updateQuantity = useTerminalStore((state) => state.updateQuantity)
  const removeFromCart = useTerminalStore((state) => state.removeFromCart)
  const updateItemNotes = useTerminalStore((state) => state.updateItemNotes)
  
  const [inputValue, setInputValue] = useState(quantity.toString())
  const [isEditingNote, setIsEditingNote] = useState(false)
  const [noteText, setNoteText] = useState(item.notes || '')

  useEffect(() => {
    setInputValue((item.quantity ?? 1).toString())
  }, [item.quantity])

  useEffect(() => {
    setNoteText(item.notes || '')
  }, [item.notes])

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputBlur = () => {
    const val = parseFloat(inputValue)
    if (!isNaN(val) && val >= 0) {
      updateQuantity(itemIdentifier, val)
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
  const discountAmount = calculateItemDiscount(item)

  return (
    <div
      onClick={onSelect}
      className={`flex items-start justify-between border-b p-3 transition text-white cursor-pointer ${
        isSelected
          ? 'border-theme bg-theme-badge ring-1 ring-theme shadow-sm'
          : 'border-zinc-800/80 bg-zinc-950 hover:bg-zinc-900/60'
      }`}
    >
      <div className="flex flex-1 flex-col">
        <div className="flex justify-between items-center">
          <div className="flex flex-col">
            <div className="flex items-center gap-2">
              {isSelected && (
                <span
                  className="h-1.5 w-1.5 rounded-full animate-pulse"
                  style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
                />
              )}
              <h4 className="text-xs font-bold text-white">{product.name}</h4>
            </div>

            {/* Selected Add-ons Display */}
            {item.selectedAddOns && item.selectedAddOns.length > 0 && (
              <div className="mt-1 space-y-0.5 border-l-2 border-theme/60 pl-2">
                {item.selectedAddOns.map((addon, aIdx) => (
                  <div key={aIdx} className="flex items-center gap-1.5 text-[11px] text-zinc-300">
                    <span className="text-theme-accent font-black">+</span>
                    <span className="font-medium text-zinc-200">{addon.name}</span>
                    {(addon.quantity || 1) > 1 && (
                      <span className="text-[10px] text-zinc-400 font-mono">×{addon.quantity}</span>
                    )}
                    <span className="text-[10px] font-mono text-zinc-400">
                      (₹{((addon.price || 0) * (addon.quantity || 1)).toFixed(2)})
                    </span>
                  </div>
                ))}
              </div>
            )}

            {/* Item note display & inline editor */}
            {isEditingNote ? (
              <div className="mt-1 flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                <input
                  type="text"
                  value={noteText}
                  onChange={(e) => setNoteText(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      updateItemNotes?.(itemIdentifier, noteText);
                      setIsEditingNote(false);
                    } else if (e.key === 'Escape') {
                      setIsEditingNote(false);
                    }
                  }}
                  onBlur={() => {
                    updateItemNotes?.(itemIdentifier, noteText);
                    setIsEditingNote(false);
                  }}
                  placeholder="Special instructions..."
                  autoFocus
                  className="rounded bg-zinc-900 border border-zinc-700 px-1.5 py-0.5 text-[11px] text-white outline-none w-40 placeholder:text-zinc-500"
                />
              </div>
            ) : (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setIsEditingNote(true);
                }}
                className="mt-0.5 text-[11px] text-zinc-500 hover:text-zinc-300 transition text-left flex items-center gap-1"
              >
                {item.notes ? (
                  <span className="text-amber-400/90 font-medium italic">Note: {item.notes}</span>
                ) : (
                  <span>+ note</span>
                )}
              </button>
            )}
          </div>
          <button 
            onClick={(e) => {
              e.stopPropagation();
              removeFromCart(itemIdentifier);
            }}
            className="text-zinc-500 hover:text-rose-400 transition cursor-pointer p-1"
            title="Remove item"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
        <div className="mt-1 flex items-center justify-between">
          <span className="text-[11px] text-zinc-400 flex items-center gap-1">
            {product.unit || 'pc'} × ₹{product.price || 0}
            {(product.discount || 0) > 0 && (
              <span className="text-[10px] bg-rose-950/60 border border-rose-800 text-rose-400 px-1 rounded font-bold">-{(product.discount || 0)}%</span>
            )}
          </span>
          <div className="flex flex-col items-end">
            {(product.discount || 0) > 0 && (
              <span className="text-[10px] text-zinc-500 line-through">₹{lineSubtotal.toFixed(2)}</span>
            )}
            <span className="font-black text-xs" style={{ color: 'var(--theme-accent, #DB2777)' }}>
              ₹{(lineSubtotal - discountAmount).toFixed(2)}
            </span>
          </div>
        </div>
        
        {/* Quantity Row */}
        <div className="mt-2 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div
              className="flex items-center rounded-xl border border-zinc-800 overflow-hidden bg-zinc-900"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                className="flex h-7 w-7 items-center justify-center bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white active:bg-zinc-600 cursor-pointer"
                onClick={() => updateQuantity(itemIdentifier, Math.max(0, quantity - (product.quantityStep || 1)))}
                title="Decrease quantity"
              >
                <Minus className="h-3 w-3" />
              </button>
              <input 
                type="text" 
                value={inputValue}
                onChange={handleInputChange}
                onBlur={handleInputBlur}
                onKeyDown={handleInputKeyDown}
                className="h-7 w-10 border-none bg-zinc-900 text-center text-xs font-bold text-white outline-none"
              />
              <button 
                className="flex h-7 w-7 items-center justify-center bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white active:bg-zinc-600 cursor-pointer"
                onClick={() => updateQuantity(itemIdentifier, quantity + (product.quantityStep || 1))}
                title="Increase quantity"
              >
                <Plus className="h-3 w-3" />
              </button>
            </div>
            <span className="text-[11px] text-zinc-500">{product.unit || 'pc'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}
