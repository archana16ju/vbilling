import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, PRODUCTS, Category, CATEGORIES } from '@/lib/mock-data'
import { CartItemData } from '@/lib/calculations'

export type HeldCart = {
  id: string
  items: CartItemData[]
  timestamp: number
}

export type Sale = {
  id: string
  items: CartItemData[]
  subtotal: number
  discount: number
  tax: number
  total: number
  paymentMethod: string
  timestamp: number
}

type TerminalState = {
  products: Product[]
  categories: Category[]
  sales: Sale[]
  selectedCategoryId: string
  searchQuery: string
  cart: CartItemData[]
  discountValue: number
  isDiscountPercentage: boolean
  heldCarts: HeldCart[]
  
  setCategory: (id: string) => void
  setSearchQuery: (query: string) => void
  
  holdCart: () => void
  recallCart: (id: string) => void
  deleteHeldCart: (id: string) => void
  
  addCategory: (category: Category) => void
  editCategory: (id: string, category: Partial<Category>) => void
  deleteCategory: (id: string) => void
  
  addProduct: (product: Product) => void
  editProduct: (id: string, product: Partial<Product>) => void
  deleteProduct: (id: string) => void
  
  addToCart: (product: Product) => void
  removeFromCart: (productId: string) => void
  updateQuantity: (productId: string, quantity: number) => void
  clearCart: () => void
  
  setDiscount: (value: number, isPercentage: boolean) => void
  completeSale: (sale: Omit<Sale, 'id' | 'timestamp'>, billId?: string) => void
  resetData: () => void
  setProducts: (products: Product[]) => void
  setCategories: (categories: Category[]) => void
  clearSales: () => void
  printerType: string
  setPrinterType: (type: string) => void
}

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set) => ({
  products: PRODUCTS,
  categories: CATEGORIES,
  sales: [],
  selectedCategoryId: 'all',
  searchQuery: '',
  cart: [],
  discountValue: 0,
  isDiscountPercentage: false,
  printerType: 'browser',
  heldCarts: [],

  setPrinterType: (type) => set({ printerType: type }),

  setCategory: (id) => set({ selectedCategoryId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
  holdCart: () => set((state) => {
    if (state.cart.length === 0) return state;
    const newHeldCart: HeldCart = {
      id: "HOLD-" + Date.now(),
      items: state.cart,
      timestamp: Date.now()
    };
    return {
      heldCarts: [newHeldCart, ...state.heldCarts],
      cart: [],
      discountValue: 0
    }
  }),
  
  recallCart: (id) => set((state) => {
    const held = state.heldCarts.find(h => h.id === id);
    if (!held) return state;
    return {
      cart: held.items,
      heldCarts: state.heldCarts.filter(h => h.id !== id),
      discountValue: 0
    }
  }),
  
  deleteHeldCart: (id) => set((state) => ({
    heldCarts: state.heldCarts.filter(h => h.id !== id)
  })),

  addCategory: (category) => set((state) => ({ categories: [...state.categories, category] })),
  editCategory: (id, categoryUpdate) => set((state) => ({
    categories: state.categories.map(c => c.id === id ? { ...c, ...categoryUpdate } : c)
  })),
  deleteCategory: (id) => set((state) => ({
    categories: state.categories.filter(c => c.id !== id)
  })),
  
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
  editProduct: (id, productUpdate) => set((state) => ({
    products: state.products.map(p => p.id === id ? { ...p, ...productUpdate } : p),
    cart: state.cart.map(item => item.product.id === id ? { ...item, product: { ...item.product, ...productUpdate } } : item)
  })),
  deleteProduct: (id) => set((state) => ({
    products: state.products.filter(p => p.id !== id),
    cart: state.cart.filter(item => item.product.id !== id)
  })),
  
  addToCart: (product) => set((state) => {
    const existing = state.cart.find(i => i.product.id === product.id)
    if (existing) {
      const newQuantity = existing.quantity + product.quantityStep
      const finalQuantity = Math.min(newQuantity, product.stock)
      return {
        cart: state.cart.map(i => 
          i.product.id === product.id ? { ...i, quantity: finalQuantity } : i
        )
      }
    } else {
      return { cart: [...state.cart, { product, quantity: product.quantityStep }] }
    }
  }),
  
  removeFromCart: (productId) => set((state) => ({
    cart: state.cart.filter(i => i.product.id !== productId)
  })),
  
  updateQuantity: (productId, quantity) => set((state) => {
    const item = state.cart.find(i => i.product.id === productId)
    if (!item) return state
    
    // Clamp quantity between 0 and stock
    let newQuantity = Math.max(0, quantity)
    newQuantity = Math.min(newQuantity, item.product.stock)
    
    if (newQuantity === 0) {
      return { cart: state.cart.filter(i => i.product.id !== productId) }
    }
    
    return {
      cart: state.cart.map(i => 
        i.product.id === productId ? { ...i, quantity: newQuantity } : i
      )
    }
  }),
  
  clearCart: () => set({ cart: [], discountValue: 0 }),
  
  setDiscount: (value, isPercentage) => set({ discountValue: value, isDiscountPercentage: isPercentage }),
  
  completeSale: (saleData, billId?) => {
    // Use the passed billId (DDMMYY-NNN) or fallback
    const fullBillId = billId || ("INV-" + Date.now());
    // Extract only the sequence part (e.g. "001") for the printed receipt
    const seqPart = fullBillId.includes('-') ? fullBillId.split('-').pop()! : fullBillId;
    set((state) => {
      const newSale: Sale = {
        ...saleData,
        id: fullBillId,
        timestamp: Date.now()
      }
      
      const updatedProducts = state.products.map(p => {
        const cartItem = saleData.items.find(i => i.product.id === p.id);
        if (cartItem) {
          return { ...p, stock: p.stock - cartItem.quantity };
        }
        return p;
      });

      return { 
        sales: [newSale, ...state.sales],
        products: updatedProducts,
        cart: [], 
        discountValue: 0 
      }
    })
    
    const state = useTerminalStore.getState();
    if (state.printerType === 'wire' || state.printerType === 'browser') {
      const now = new Date();
      const dateStr = now.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
      const timeStr = now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
      const printWindow = window.open('', '_blank', 'width=340,height=700');
      if (printWindow) {
        printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Courier New', Courier, monospace;
      font-size: 12px;
      width: 80mm;
      max-width: 80mm;
      padding: 4mm 4mm;
      color: #000;
      background: #fff;
    }
    .center { text-align: center; }
    .right { text-align: right; }
    .bold { font-weight: bold; }
    .restaurant-name {
      font-size: 18px;
      font-weight: bold;
      text-align: center;
      letter-spacing: 1px;
      margin-bottom: 2px;
    }
    .sub-title {
      font-size: 10px;
      text-align: center;
      margin-bottom: 6px;
      color: #333;
    }
    .divider {
      border: none;
      border-top: 1px dashed #000;
      margin: 5px 0;
    }
    .divider-solid {
      border: none;
      border-top: 1px solid #000;
      margin: 5px 0;
    }
    .row {
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
      font-size: 12px;
    }
    .row .name {
      flex: 1;
      padding-right: 4px;
      word-break: break-word;
    }
    .row .qty {
      width: 24px;
      text-align: center;
    }
    .row .price {
      width: 56px;
      text-align: right;
    }
    .header-row {
      display: flex;
      justify-content: space-between;
      font-size: 10px;
      font-weight: bold;
      border-bottom: 1px solid #000;
      padding-bottom: 3px;
      margin-bottom: 3px;
    }
    .totals-row {
      display: flex;
      justify-content: space-between;
      padding: 2px 0;
      font-size: 12px;
    }
    .grand-total {
      display: flex;
      justify-content: space-between;
      font-size: 16px;
      font-weight: bold;
      padding: 4px 0;
      margin-top: 2px;
    }
    .payment-method {
      font-size: 11px;
      text-align: center;
      margin-top: 4px;
    }
    .footer {
      font-size: 10px;
      text-align: center;
      margin-top: 8px;
      color: #333;
    }
    .inv-info {
      font-size: 10px;
      display: flex;
      justify-content: space-between;
      margin: 2px 0;
    }
    @media print {
      body { width: 80mm; }
      @page { margin: 0; size: 80mm auto; }
    }
  </style>
</head>
<body>
  <div class="restaurant-name">SK BIRYANI</div>
  <div class="sub-title">Restaurant & Fast Food</div>
  <hr class="divider-solid">
  <div class="inv-info"><span>BILL NO-${seqPart}</span><span>${dateStr}</span></div>
  <div class="inv-info"><span>Payment: ${saleData.paymentMethod}</span><span>${timeStr}</span></div>
  <hr class="divider">
  <div class="header-row">
    <span style="flex:1">ITEM</span>
    <span style="width:24px;text-align:center">QTY</span>
    <span style="width:56px;text-align:right">AMT</span>
  </div>
  ${saleData.items.map(item => `
  <div class="row">
    <span class="name">${item.product.name}</span>
    <span class="qty">${item.quantity}</span>
    <span class="price">₹${(item.quantity * item.product.price).toFixed(2)}</span>
  </div>`).join('')}
  <hr class="divider">
  <div class="totals-row"><span>Subtotal</span><span>₹${saleData.subtotal.toFixed(2)}</span></div>
  ${saleData.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-₹${saleData.discount.toFixed(2)}</span></div>` : ''}
  ${saleData.tax > 0 ? `<div class="totals-row"><span>Tax</span><span>₹${saleData.tax.toFixed(2)}</span></div>` : ''}
  <hr class="divider-solid">
  <div class="grand-total"><span>TOTAL</span><span>₹${saleData.total.toFixed(2)}</span></div>
  <hr class="divider">
  <div class="footer">
    *** Thank You, Visit Again! ***<br>
  </div>
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 1000);
    }
  </script>
</body>
</html>`);
        printWindow.document.close();
      } else {
        alert("Sale Completed! Please allow popups to print receipt.");
      }
    } else {
      alert("Sale Completed!");
    }
  },
  
  resetData: () => set({ products: PRODUCTS, categories: CATEGORIES }),
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  clearSales: () => set({ sales: [] })
}),
{
  name: 'terminal-storage',
}
))
