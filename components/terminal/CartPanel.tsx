'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { calculateSubtotal, calculateDiscount, calculateTax, calculateGlobalTotal } from "@/lib/calculations"
import CartItem from "./CartItem"
import { Trash2, CreditCard, Banknote, Wallet, PauseCircle } from "lucide-react"
import { useState } from "react"
import { recordSale, getNextBillId } from "@/lib/actions/db"

export default function CartPanel() {
  const { cart, clearCart, completeSale, discountValue, isDiscountPercentage, setDiscount, setProducts } = useTerminalStore()
  const [paymentMethod, setPaymentMethod] = useState<string>("Cash")

  const subtotal = calculateSubtotal(cart)
  const discountAmount = calculateDiscount(subtotal, discountValue, isDiscountPercentage)
  const afterDiscount = subtotal - discountAmount
  const taxAmount = calculateTax(afterDiscount)
  const total = calculateGlobalTotal(subtotal, discountAmount, taxAmount)

  return (
    <div className="flex h-full flex-col border-l border-slate-200 bg-white">
      <div className="border-b border-slate-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-800">Order #POS-4892</h2>
          <div className="flex gap-2">
            <button 
              className="flex items-center gap-1 text-sm text-slate-500 hover:text-red-600"
              onClick={clearCart}
            >
              <Trash2 className="h-4 w-4" />
              Clear
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto bg-slate-50/50">
        {cart.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-slate-400">
            <ShoppingCartIcon className="mb-2 h-12 w-12 text-slate-200" />
            <p>Cart is empty</p>
          </div>
        ) : (
          cart.map((item) => (
            <CartItem key={item.product.id} item={item} />
          ))
        )}
      </div>

      <div className="border-t border-slate-200 bg-white p-4">
        <div className="space-y-2 text-sm">
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          
          <div className="flex items-center justify-between text-slate-600">
            <span>Product Discounts</span>
            <span className="text-red-500">-₹{discountAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-slate-600">
            <span>Tax</span>
            <span>₹{taxAmount.toFixed(2)}</span>
          </div>
          
          <div className="my-2 border-t border-dashed border-slate-200 pt-2">
            <div className="flex items-end justify-between">
              <span className="text-base font-bold text-slate-900">TOTAL</span>
              <span className="text-3xl font-black text-blue-600">₹{total.toFixed(2)}</span>
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-3 gap-2">
          <PaymentBtn icon={Banknote} label="Cash" active={paymentMethod === "Cash"} onClick={() => setPaymentMethod("Cash")} />
          <PaymentBtn icon={CreditCard} label="Card" active={paymentMethod === "Card"} onClick={() => setPaymentMethod("Card")} />
          <PaymentBtn icon={Wallet} label="UPI" active={paymentMethod === "UPI"} onClick={() => setPaymentMethod("UPI")} />
        </div>

        <div className="mt-3 flex gap-2">
          <button className="flex items-center justify-center gap-1 rounded-lg border border-slate-300 bg-white px-4 py-3 font-medium text-slate-700 hover:bg-slate-50">
            <PauseCircle className="h-5 w-5" />
            Hold
          </button>
          <button 
            className="flex-1 rounded-lg bg-blue-600 py-3 font-bold text-white hover:bg-blue-700 disabled:opacity-50"
            onClick={async () => {
              const saleData = {
                items: cart,
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
                // Fallback — complete sale without DB sync
                completeSale(saleData);
              }
            }}
            disabled={cart.length === 0}
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
          ? "border-blue-600 bg-blue-50 text-blue-700" 
          : "border-slate-200 bg-white text-slate-600 hover:border-blue-300 hover:bg-blue-50/50"
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