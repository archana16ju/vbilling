'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { calculateSubtotal, calculateDiscount, calculateTotalTax, calculateGlobalTotal } from "@/lib/calculations"
import CartItem from "./CartItem"
import { Trash2, CreditCard, Banknote, Wallet, PauseCircle, X } from "lucide-react"
import { useState, useEffect } from "react"
import { recordSale, getNextBillId } from "@/lib/actions/db"

export default function CartPanel() {
  const { 
    cart, clearCart, completeSale, discountValue, isDiscountPercentage, 
    setDiscount, setProducts, heldCarts = [], holdCart, recallCart, deleteHeldCart 
  } = useTerminalStore()
  
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash")
  const [showHeldCarts, setShowHeldCarts] = useState(false)
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  const cartSafe = cart || []
  const subtotal = calculateSubtotal(cartSafe)
  const discountAmount = calculateDiscount(subtotal, discountValue, isDiscountPercentage)
  // Sum up all the individual product taxes
  const taxAmount = calculateTotalTax(cartSafe)
  const total = calculateGlobalTotal(subtotal, discountAmount, taxAmount)

  if (!mounted) {
    return <div className="flex h-full flex-col border-l border-zinc-200 bg-white" />
  }

  return (
    <div className="flex h-full flex-col border-l border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-800">Order #POS-4892</h2>
          <div className="flex gap-2">
            <button 
              className="flex items-center gap-1 text-sm text-zinc-500 hover:text-red-600"
              onClick={clearCart}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto no-scrollbar bg-zinc-50/50">
        {cartSafe.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-400">
            <ShoppingCartIcon className="mb-2 h-12 w-12 text-zinc-200" />
            <p>Cart is empty</p>
          </div>
        ) : (
          cartSafe.map((item) => (
            <CartItem key={item.product.id} item={item} />
          ))
        )}
      </div>

      <div className="border-t border-zinc-200 bg-white p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-zinc-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center justify-between text-zinc-600">
            <span>Product Discounts</span>
            <span className="text-red-500">-₹{discountAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-zinc-600">
            <span>Tax</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
          
          <div className="my-2 border-t border-dashed border-zinc-200 pt-2">
            <div className="flex items-end justify-between">
              <span className="text-base font-bold text-zinc-900">TOTAL</span>
              <span className="text-3xl font-black text-black">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <PaymentBtn icon={Banknote} label="Cash" active={paymentMethod === "Cash"} onClick={() => setPaymentMethod("Cash")} />
          <PaymentBtn icon={CreditCard} label="Card" active={paymentMethod === "Card"} onClick={() => setPaymentMethod("Card")} />
          <PaymentBtn icon={Wallet} label="UPI" active={paymentMethod === "UPI"} onClick={() => setPaymentMethod("UPI")} />
        </div>

        <div className="mt-3 flex gap-2 relative">
          <button 
            className={`flex items-center justify-center gap-1 rounded-lg border px-4 py-3 font-medium transition-colors ${
              cartSafe.length > 0
                ? "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                : heldCarts.length > 0
                ? "border-amber-500 bg-amber-50 text-amber-700 hover:bg-amber-100"
                : "border-zinc-300 bg-zinc-100 text-zinc-400 cursor-not-allowed"
            }`}
            onClick={() => {
              if (cartSafe.length > 0) {
                holdCart()
              } else if (heldCarts.length > 0) {
                setShowHeldCarts(!showHeldCarts)
              }
            }}
            disabled={cartSafe.length === 0 && heldCarts.length === 0}
          >
            <PauseCircle className="h-5 w-5" />
            {cartSafe.length > 0 ? "Hold" : `Recall (${heldCarts.length})`}
          </button>
          
          {showHeldCarts && heldCarts.length > 0 && (
            <div className="absolute bottom-full left-0 mb-2 w-64 rounded-lg border border-zinc-200 bg-white p-2 shadow-xl z-10">
              <div className="mb-2 flex items-center justify-between px-2 text-sm font-bold text-zinc-800">
                Hold Carts
                <button onClick={() => setShowHeldCarts(false)} className="text-zinc-400 hover:text-zinc-600">
                  <X className="h-4 w-4" />
                </button>
              </div>
              <div className="max-h-48 overflow-y-auto space-y-2 no-scrollbar">
                {heldCarts.map((h, idx) => (
                  <div key={h.id} className="flex flex-col gap-1 rounded border border-zinc-100 p-2 hover:bg-zinc-50">
                    <div className="flex justify-between text-xs text-zinc-500">
                      <span>{new Date(h.timestamp).toLocaleTimeString()}</span>
                      <span className="font-semibold text-zinc-700">₹{calculateSubtotal(h.items).toFixed(2)}</span>
                    </div>
                    <div className="flex justify-between mt-1">
                      <button 
                        onClick={() => { recallCart(h.id); setShowHeldCarts(false); }}
                        className="rounded bg-black px-3 py-1 text-xs font-medium text-white hover:bg-gray-800"
                      >
                        Recall
                      </button>
                      <button 
                        onClick={() => deleteHeldCart(h.id)}
                        className="text-xs text-red-500 hover:text-red-700"
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button 
            className="flex-1 rounded-lg bg-black py-3 font-bold text-white hover:bg-gray-800 disabled:opacity-50"
            onClick={async () => {
              const saleData = {
                items: cartSafe,
                subtotal,
                discount: discountAmount,
                tax: taxAmount,
                total,
                paymentMethod
              };
              try {
                // Get a proper DDMMYY-NNN bill ID from the server
                const billId = await getNextBillId();
                // Pass it to both the local store (for receipt) and the DB
                completeSale(saleData, billId);
                await recordSale({ ...saleData, id: billId, timestamp: Date.now() });
                // Reload fresh stock from DB
                const { getProducts } = await import("@/lib/actions/db");
                const freshProducts = await getProducts();
                setProducts(freshProducts);
              } catch (e) {
                console.error("Failed to record sale in DB:", e);
                // Fallback – complete sale without DB sync
                completeSale(saleData);
              }
            }}
            disabled={cartSafe.length === 0}
          >
            BILL
          </button>
        </div>
      </div>
    </div>
  )
}

function PaymentBtn({ icon: Icon, label, active, onClick }: { icon: React.ElementType, label: string, active: boolean, onClick: () => void }) {
  return (
    <button 
      onClick={onClick}
      className={`flex flex-col items-center justify-center gap-1 rounded-lg border py-2 transition-colors ${
        active 
          ? "border-black bg-gray-100 text-black" 
          : "border-zinc-200 bg-white text-zinc-600 hover:border-gray-400 hover:bg-gray-100/50"
      }`}
    >
      <Icon className="h-5 w-5" />
      <span className="text-xs font-medium">{label}</span>
    </button>
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