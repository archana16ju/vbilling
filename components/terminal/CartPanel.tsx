'use client'
import { useTerminalStore, DEFAULT_SHORTCUTS } from "@/store/useTerminalStore"
import { calculateSubtotal, calculateDiscount, calculateTotalTax, calculateGlobalTotal, calculateTotalDiscount } from "@/lib/calculations"
import CartItem from "./CartItem"
import { Trash2, CreditCard, Banknote, Wallet, PauseCircle, X } from "lucide-react"
import { useState, useEffect } from "react"

export default function CartPanel() {
  const { 
    cart, clearCart, completeSale, discountValue, isDiscountPercentage, 
    setDiscount, setProducts, heldCarts = [], holdCart, recallCart, deleteHeldCart,
    addOfflineSale, enableCashChange, activeShortcuts, generateNextBillId, isBackendOnline,
    enableDiscount, completedBillHtml, setCompletedBillHtml, rawMaterials
  } = useTerminalStore()
  
  const shortcuts = activeShortcuts || DEFAULT_SHORTCUTS;
  
  const [isDiscountModalOpen, setIsDiscountModalOpen] = useState(false)
  const [tempDiscount, setTempDiscount] = useState("")
  const [tempIsPercentage, setTempIsPercentage] = useState(true)
  const [paymentMethod, setPaymentMethod] = useState<'Cash' | 'Card' | 'UPI'>('Cash')
  const [mounted, setMounted] = useState(false)
  const [showHoldModal, setShowHoldModal] = useState(false)
  
  // Payment variables
  const [isProcessing, setIsProcessing] = useState(false)
  const [showCashModal, setShowCashModal] = useState(false)
  const [amountReceivedStr, setAmountReceivedStr] = useState("")

  const cartSafe = Array.isArray(cart) ? cart : [];
  const subtotal = calculateSubtotal(cartSafe)
  const itemDiscounts = calculateTotalDiscount(cartSafe)
  const globalDiscountAmount = calculateDiscount(subtotal, discountValue, isDiscountPercentage)
  const totalDiscountAmount = itemDiscounts + globalDiscountAmount
  const totalTax = calculateTotalTax(cartSafe)
  const total = calculateGlobalTotal(subtotal, totalDiscountAmount, totalTax)

  const handlePaymentSubmit = async (opts: { isCashModal?: boolean, finalAmount?: number } = {}) => {
    if (cartSafe.length === 0) return;
    if (isProcessing) return;
    
    // Validate Raw Materials before checkout
    const CONVERSION_RATES: Record<string, number> = { 
      'kg->g': 1000, 'g->kg': 0.001, 'liter->ml': 1000, 'ml->liter': 0.001,
      'tsp->ml': 5, 'ml->tsp': 0.2, 'tbsp->ml': 15, 'ml->tbsp': 1/15, 'cup->ml': 240, 'ml->cup': 1/240,
      'tbsp->tsp': 3, 'tsp->tbsp': 1/3, 'cup->tbsp': 16, 'tbsp->cup': 1/16, 'cup->tsp': 48, 'tsp->cup': 1/48 
    };
    let insufficientItems: string[] = [];
    
    const requiredMaterials: Record<string, number> = {};
    for (const item of cartSafe) {
      if (item.product.rawMaterials && item.product.rawMaterials.length > 0) {
        for (const rm of item.product.rawMaterials) {
          const material = rawMaterials?.find(m => m.id === rm.rawMaterialId);
          if (material) {
            const requiredInRecipeUnit = rm.quantity * item.quantity;
            let finalQty = requiredInRecipeUnit;
            if (rm.unit !== material.unit) {
              const rate = CONVERSION_RATES[`${rm.unit}->${material.unit}`];
              if (rate) finalQty = requiredInRecipeUnit * rate;
            }
            requiredMaterials[material.id] = (requiredMaterials[material.id] || 0) + finalQty;
          }
        }
      }
    }
    
    for (const [matId, requiredQty] of Object.entries(requiredMaterials)) {
      const material = rawMaterials?.find(m => m.id === matId);
      if (material && material.currentStock < requiredQty) {
        insufficientItems.push(`${material.name} (Need: ${requiredQty.toFixed(2)} ${material.unit}, Have: ${material.currentStock.toFixed(2)} ${material.unit})`);
      }
    }
    
    if (insufficientItems.length > 0) {
      alert(`Cannot process checkout. Insufficient Raw Materials:\n\n${insufficientItems.join('\n')}`);
      return;
    }

    setIsProcessing(true);
    const isOnline = navigator.onLine;

    const fullSaleData = {
      items: cartSafe,
      subtotal,
      discount: totalDiscountAmount,
      discountValue: discountValue,
      isDiscountPercentage,
      tax: totalTax,
      total,
      paymentMethod: opts.isCashModal ? 'Cash' : paymentMethod,
      cashReceived: opts.finalAmount || total,
      changeReturned: opts.isCashModal ? ((opts.finalAmount || total) - total) : 0,
    };

    try {
      const withTimeout = <T,>(promise: Promise<T>, ms: number) => {
        return Promise.race([
          promise,
          new Promise<never>((_, reject) => setTimeout(() => reject(new Error("Timeout")), ms))
        ]);
      };

      const billId = generateNextBillId();

      let isOnlineFlowFailed = false;

      if (isOnline && isBackendOnline) {
        try {
          const liveApiUrl = process.env.NEXT_PUBLIC_API_URL || 'https://skbriyani.vseyal.com';
          const res = await withTimeout(fetch(`${liveApiUrl}/api/db/recordSale`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ...fullSaleData, id: billId, timestamp: Date.now() })
          }), 10000);
          if (!res.ok) {
            isOnlineFlowFailed = true;
          } else {
            const resText = await res.text();
            let result;
            try {
              result = JSON.parse(resText);
            } catch (parseError) {
              isOnlineFlowFailed = true;
            }

            if (!isOnlineFlowFailed && result && result.success) {
              const completedSale = { ...result.sale, syncStatus: 'COMPLETED' };
              completeSale(completedSale, billId);
              setShowCashModal(false);
              setAmountReceivedStr("");
              return;
            } else if (!isOnlineFlowFailed) {
              console.warn("Backend rejected or failed, falling back to offline", result);
              isOnlineFlowFailed = true;
            }
          }
        } catch (networkError: any) {
          console.warn("Network error during recordSale, falling back to offline:", networkError);
          isOnlineFlowFailed = true;
        }
      }

      // --- OFFLINE PATH (Runs if offline or online network failed) ---
      if (!isOnline || !isBackendOnline || isOnlineFlowFailed) {
        const offlineSale = {
          ...fullSaleData,
          id: billId,
          timestamp: Date.now(),
          syncStatus: 'PENDING_SYNC' as const
        };
        
        addOfflineSale(offlineSale);
        fetch((typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron') ? 'http://localhost:3015/api/storage/' : '/api/storage/') + 'pendingBills', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(offlineSale)
        }).catch(console.error);
        
        completeSale(offlineSale, billId);
        
        setShowCashModal(false);
        setAmountReceivedStr("");
      }
      
    } catch (e) {
      console.error("Critical failure during payment:", e);
      alert("Transaction failed! System error.");
    } finally {
      setIsProcessing(false);
    }
  };

  useEffect(() => {
    setMounted(true)
    
    const handleKeyDown = (e: KeyboardEvent) => {
      // Helper function to match shortcut
      const matchesShortcut = (shortcutDef: string) => {
        if (!shortcutDef) return false;
        const parts = shortcutDef.split('+').map(p => p.trim());
        const key = parts[parts.length - 1].toLowerCase();
        
        const needsCtrl = parts.includes('Ctrl');
        const needsAlt = parts.includes('Alt');
        const needsShift = parts.includes('Shift');
        
        if (e.ctrlKey !== needsCtrl) return false;
        if (e.altKey !== needsAlt) return false;
        if (e.shiftKey !== needsShift) return false;
        
        if (e.key.toLowerCase() === key) return true;
        return false;
      };

      // Only trigger if we aren't in an input field (unless it's a function key or global shortcut)
      const target = e.target as HTMLElement;
      const isInput = target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT';
      
      if (matchesShortcut(shortcuts.paymentCash) && !isInput) {
        e.preventDefault();
        setPaymentMethod('Cash');
        handleCheckout();
      } else if (matchesShortcut(shortcuts.paymentCard) && !isInput) {
        e.preventDefault();
        setPaymentMethod('Card');
        handleCheckout();
      } else if (matchesShortcut(shortcuts.paymentUPI) && !isInput) {
        e.preventDefault();
        setPaymentMethod('UPI');
        handleCheckout();
      } else if (matchesShortcut(shortcuts.holdBill) && !isInput) {
        e.preventDefault();
        handleHoldBill();
      }
    }
    
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [cartSafe, subtotal, discountValue, isDiscountPercentage, totalTax, paymentMethod, isProcessing, shortcuts])

  const handleCheckout = () => {
    if (paymentMethod === 'Cash' && enableCashChange) {
      setShowCashModal(true);
      return;
    }
    handlePaymentSubmit();
  }

  const handleHoldBill = () => {
    if (cartSafe.length === 0) return
    holdCart()
  }

  if (!mounted) return null

  return (
    <div className="flex h-[calc(100vh-64px)] w-96 flex-col border-l border-zinc-200 bg-white">
      <div className="border-b border-zinc-200 p-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-zinc-800">Order</h2>
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

      <div className="flex-1 overflow-y-auto p-4 no-scrollbar">
        {cartSafe.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center text-zinc-400">
            <CreditCard className="mb-4 h-12 w-12 opacity-20" />
            <p>Cart is empty</p>
          </div>
        ) : (
          <div className="space-y-4">
            {cartSafe.map((item) => (
              <CartItem key={item.product.id} item={item} />
            ))}
          </div>
        )}
      </div>

      <div className="border-t border-zinc-200 bg-zinc-50 p-4">
        <div className="mb-4 space-y-2 text-sm">
          <div className="flex justify-between text-zinc-600">
            <span>Subtotal</span>
            <span>₹{subtotal.toFixed(2)}</span>
          </div>
          
          <div 
            className={`flex justify-between text-zinc-600 p-1 -mx-1 rounded ${enableDiscount ? 'cursor-pointer hover:bg-zinc-200' : ''}`}
            onClick={() => {
              if (!enableDiscount) return;
              setTempDiscount(discountValue.toString())
              setTempIsPercentage(isDiscountPercentage)
              setIsDiscountModalOpen(true)
            }}
          >
            <span>Product Discounts</span>
            <span className="text-red-500">-₹{totalDiscountAmount.toFixed(2)}</span>
          </div>

          <div className="flex justify-between text-zinc-600">
            <span>Tax</span>
            <span>₹{totalTax.toFixed(2)}</span>
          </div>
          <div className="my-2 border-t border-zinc-200 border-dashed" />
          <div className="flex justify-between text-xl font-bold text-zinc-900">
            <span>TOTAL</span>
            <span>₹{total.toFixed(2)}</span>
          </div>
        </div>

        <div className="mb-4 grid grid-cols-3 gap-2">
          <button 
            onClick={() => setPaymentMethod('Cash')}
            className={`flex flex-col items-center rounded-lg border p-2 transition-all ${
              paymentMethod === 'Cash' 
                ? 'border-black bg-black text-white' 
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
            }`}
          >
            <Banknote className="mb-1 h-5 w-5" />
            <span className="text-xs font-medium">Cash</span>
          </button>
          
          <button 
            onClick={() => setPaymentMethod('Card')}
            className={`flex flex-col items-center rounded-lg border p-2 transition-all ${
              paymentMethod === 'Card' 
                ? 'border-black bg-black text-white' 
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
            }`}
          >
            <CreditCard className="mb-1 h-5 w-5" />
            <span className="text-xs font-medium">Card</span>
          </button>
          
          <button 
            onClick={() => setPaymentMethod('UPI')}
            className={`flex flex-col items-center rounded-lg border p-2 transition-all ${
              paymentMethod === 'UPI' 
                ? 'border-black bg-black text-white' 
                : 'border-zinc-200 bg-white text-zinc-600 hover:border-zinc-300'
            }`}
          >
            <Wallet className="mb-1 h-5 w-5" />
            <span className="text-xs font-medium">UPI</span>
          </button>
        </div>

        <div className="flex gap-2">
          <button 
            onClick={() => {
              if (cartSafe.length > 0) {
                handleHoldBill();
              } else if (heldCarts && heldCarts.length > 0) {
                setShowHoldModal(true);
              }
            }}
            disabled={cartSafe.length === 0 && (!heldCarts || heldCarts.length === 0)}
            className="relative flex items-center justify-center gap-2 rounded-lg border border-zinc-200 bg-white px-5 py-3 font-medium text-zinc-700 transition-colors hover:bg-zinc-50 disabled:opacity-50"
            title={`Hold Bill (${shortcuts.holdBill})`}
          >
            {heldCarts && heldCarts.length > 0 && (
              <span className="absolute -top-2 -right-2 flex h-5 w-5 items-center justify-center rounded-full bg-orange-500 text-[10px] font-bold text-white shadow-sm ring-2 ring-white">
                {heldCarts.length}
              </span>
            )}
            <PauseCircle className="h-5 w-5" />
            Hold
          </button>
          <button 
            onClick={handleCheckout}
            disabled={cartSafe.length === 0 || isProcessing}
            className="flex-1 rounded-lg bg-zinc-500 px-4 py-3 font-medium text-white transition-colors hover:bg-zinc-600 disabled:opacity-50 relative overflow-hidden"
          >
            <div className={`absolute inset-0 bg-black transition-transform duration-300 ease-out ${
              paymentMethod === 'Cash' ? (shortcuts.paymentCash ? 'translate-y-0' : 'translate-y-full') :
              paymentMethod === 'Card' ? (shortcuts.paymentCard ? 'translate-y-0' : 'translate-y-full') :
              paymentMethod === 'UPI' ? (shortcuts.paymentUPI ? 'translate-y-0' : 'translate-y-full') : 'translate-y-full'
            }`}></div>
            <span className="relative z-10 flex items-center justify-center gap-2">
              {isProcessing ? "PROCESSING..." : (
                <>
                  CHECKOUT
                  <span className="text-xs opacity-75">
                    ({paymentMethod === 'Cash' ? shortcuts.paymentCash : 
                      paymentMethod === 'Card' ? shortcuts.paymentCard : 
                      shortcuts.paymentUPI})
                  </span>
                </>
              )}
            </span>
          </button>
        </div>
      </div>

      {isDiscountModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[400px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Apply Discount</h2>
              <button onClick={() => setIsDiscountModalOpen(false)} className="rounded-full p-2 hover:bg-zinc-100 text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="mb-2 flex rounded-lg border border-zinc-200 p-1">
                <button
                  className={`flex-1 rounded-md py-2 text-sm font-medium ${tempIsPercentage ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                  onClick={() => setTempIsPercentage(true)}
                >
                  Percentage (%)
                </button>
                <button
                  className={`flex-1 rounded-md py-2 text-sm font-medium ${!tempIsPercentage ? 'bg-black text-white' : 'text-zinc-600 hover:bg-zinc-100'}`}
                  onClick={() => setTempIsPercentage(false)}
                >
                  Amount (₹)
                </button>
              </div>
              
              <div className="relative mt-4">
                <input
                  type="number"
                  value={tempDiscount}
                  onChange={(e) => setTempDiscount(e.target.value)}
                  className="w-full rounded-lg border border-zinc-300 p-3 pl-8 text-zinc-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="0.00"
                />
                <span className="absolute left-3 top-3.5 text-zinc-500">
                  {tempIsPercentage ? '%' : '₹'}
                </span>
              </div>
            </div>

            <div className="flex gap-3">
              <button
                onClick={() => {
                  setDiscount(0, true)
                  setIsDiscountModalOpen(false)
                }}
                className="flex-1 rounded-lg border border-red-200 bg-red-50 py-3 font-medium text-red-600 hover:bg-red-100"
              >
                Clear
              </button>
              <button
                onClick={() => {
                  setDiscount(parseFloat(tempDiscount) || 0, tempIsPercentage)
                  setIsDiscountModalOpen(false)
                }}
                className="flex-[2] rounded-lg bg-black py-3 font-medium text-white hover:bg-zinc-800"
              >
                Apply Discount
              </button>
            </div>
          </div>
        </div>
      )}

      {showHoldModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[500px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Held Bills ({heldCarts.length})</h2>
              <button onClick={() => setShowHoldModal(false)} className="rounded-full p-2 hover:bg-zinc-100 text-zinc-600">
                <X className="h-5 w-5" />
              </button>
            </div>
            
            {heldCarts.length === 0 ? (
              <div className="py-8 text-center text-zinc-500">
                No bills currently on hold
              </div>
            ) : (
              <div className="max-h-[400px] overflow-y-auto space-y-3">
                {heldCarts.map((cart) => (
                  <div key={cart.id} className="flex items-center justify-between rounded-lg border border-zinc-200 p-4">
                    <div>
                      <div className="font-medium text-zinc-900">{cart.id}</div>
                      <div className="text-sm text-zinc-500">
                        {cart.items.length} items • {new Date(cart.timestamp).toLocaleTimeString()}
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button 
                        onClick={() => {
                          recallCart(cart.id);
                          setShowHoldModal(false);
                        }}
                        className="rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                      >
                        Recall
                      </button>
                      <button 
                        onClick={() => deleteHeldCart(cart.id)}
                        className="rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-600 hover:bg-red-100"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Cash Payment Modal */}
      {showCashModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[400px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-zinc-900">Cash Payment</h2>
              <button 
                onClick={() => {
                  setShowCashModal(false);
                  setAmountReceivedStr("");
                  setIsProcessing(false);
                }} 
                className="rounded-full p-2 hover:bg-zinc-100 text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <div className="mb-6">
              <div className="mb-4">
                <div className="text-sm text-zinc-500 mb-1">Total Amount Due</div>
                <div className="text-3xl font-bold text-zinc-900">₹{total.toFixed(2)}</div>
              </div>
              
              <div className="relative mt-4">
                <label className="text-sm font-medium text-zinc-700 block mb-2">Cash Received</label>
                <div className="relative">
                  <input
                    type="number"
                    value={amountReceivedStr}
                    onChange={(e) => setAmountReceivedStr(e.target.value)}
                    className="w-full rounded-lg border border-zinc-300 p-3 pl-8 text-xl font-medium text-zinc-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
                    placeholder="0.00"
                    autoFocus
                  />
                  <span className="absolute left-3 top-3.5 text-zinc-500 text-lg">₹</span>
                </div>
              </div>

              {Number(amountReceivedStr || 0) >= total && (
                <div className="mt-4 p-4 rounded-lg bg-green-50 border border-green-200">
                  <div className="text-sm text-green-700 mb-1">Change to Return</div>
                  <div className="text-2xl font-bold text-green-700">
                    ₹{(Number(amountReceivedStr || 0) - total).toFixed(2)}
                  </div>
                </div>
              )}
            </div>

            <button
              onClick={() => handlePaymentSubmit({ isCashModal: true, finalAmount: Number(amountReceivedStr || 0) })}
              disabled={Number(amountReceivedStr || 0) < total || isProcessing}
              className="w-full rounded-lg bg-black py-4 font-bold text-white hover:bg-zinc-800 disabled:opacity-50 transition-colors"
            >
              {isProcessing ? "PROCESSING..." : "COMPLETE SALE"}
            </button>
          </div>
        </div>
      )}

      {/* Completed Bill Action Modal for WiFi/Bluetooth fallback */}
      {completedBillHtml && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-[400px] rounded-2xl bg-white p-6 shadow-xl">
            <div className="mb-6 flex items-center justify-between">
              <h2 className="text-xl font-bold text-green-700">Sale Completed!</h2>
              <button 
                onClick={() => setCompletedBillHtml(null)} 
                className="rounded-full p-2 hover:bg-zinc-100 text-zinc-600"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            
            <p className="mb-6 text-zinc-600">
              Your sale was successfully completed and the receipt has been queued for printing.
            </p>

            <div className="flex gap-3">
              <button
                onClick={() => setCompletedBillHtml(null)}
                className="flex-[1] rounded-lg border border-zinc-200 bg-white py-3 font-medium text-zinc-700 hover:bg-zinc-50"
              >
                OK
              </button>
              <button
                onClick={() => {
                  const printWindow = window.open('', '_blank', 'width=340,height=700');
                  if (printWindow) {
                    printWindow.document.write(completedBillHtml);
                    printWindow.document.close();
                  } else {
                    alert("Please allow popups to print receipt manually.");
                  }
                  setCompletedBillHtml(null);
                }}
                className="flex-[1] rounded-lg bg-black py-3 font-medium text-white hover:bg-zinc-800"
              >
                Print Receipt
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

