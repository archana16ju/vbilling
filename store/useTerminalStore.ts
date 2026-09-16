import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, PRODUCTS, Category, CATEGORIES } from '@/lib/mock-data'
import { CartItemData } from '@/lib/calculations'

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
  
  setCategory: (id: string) => void
  setSearchQuery: (query: string) => void
  
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
  completeSale: (sale: Omit<Sale, 'id' | 'timestamp'>) => void
  resetData: () => void
  setProducts: (products: Product[]) => void
  setCategories: (categories: Category[]) => void
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

  setPrinterType: (type) => set({ printerType: type }),

  setCategory: (id) => set({ selectedCategoryId: id }),
  setSearchQuery: (query) => set({ searchQuery: query }),
  
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
  
  completeSale: (saleData) => {
    let newSaleId = "INV-" + Date.now();
    set((state) => {
      const newSale: Sale = {
        ...saleData,
        id: newSaleId,
        timestamp: Date.now()
      }
      
      return { 
        sales: [newSale, ...state.sales],
        cart: [], 
        discountValue: 0 
      }
    })
    
    const state = useTerminalStore.getState();
    if (state.printerType === 'wire' || state.printerType === 'browser') {
      // Simulate printing by opening print dialog or opening a receipt window
      const printWindow = window.open('', '_blank', 'width=400,height=600');
      if (printWindow) {
        printWindow.document.write(`
          <html>
            <head>
              <title>Receipt ${newSaleId}</title>
              <style>
                body { font-family: monospace; padding: 20px; }
                h1 { text-align: center; }
                .item { display: flex; justify-content: space-between; margin-bottom: 5px; }
                .total { border-top: 1px solid #000; margin-top: 10px; padding-top: 10px; font-weight: bold; }
              </style>
            </head>
            <body>
              <h1>QuickBill Receipt</h1>
              <p>Invoice: ${newSaleId}</p>
              <p>Date: ${new Date().toLocaleString()}</p>
              <hr />
              ${saleData.items.map(item => `
                <div class="item">
                  <span>${item.quantity}x ${item.product.name}</span>
                  <span>₹${(item.quantity * item.product.price).toFixed(2)}</span>
                </div>
              `).join('')}
              <div class="total item">
                <span>Subtotal:</span>
                <span>₹${saleData.subtotal.toFixed(2)}</span>
              </div>
              <div class="item">
                <span>Discount:</span>
                <span>-₹${saleData.discount.toFixed(2)}</span>
              </div>
              <div class="item">
                <span>Tax:</span>
                <span>₹${saleData.tax.toFixed(2)}</span>
              </div>
              <div class="total item" style="font-size: 1.2em;">
                <span>Total:</span>
                <span>₹${saleData.total.toFixed(2)}</span>
              </div>
              <p style="text-align: center; margin-top: 20px;">Thank you for shopping!</p>
              <script>
                window.onload = function() { window.print(); window.close(); }
              </script>
            </body>
          </html>
        `);
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
  setCategories: (categories) => set({ categories })
}),
{
  name: 'terminal-storage',
}
))
