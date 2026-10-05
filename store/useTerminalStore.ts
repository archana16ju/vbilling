import { usePrinterDesignStore } from './usePrinterDesignStore';
import { generateReceiptHtml } from '@/lib/printSystem';
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, PRODUCTS, Category, CATEGORIES } from '@/lib/mock-data'
import { CartItemData } from '@/lib/calculations'
import { RawMaterial } from '@/types/product'

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
  amountReceived?: number
  changeAmount?: number
  discountValue?: number
  isDiscountPercentage?: boolean
  syncStatus?: 'COMPLETED' | 'PENDING_SYNC'
}

export type PrintJob = {
  id: string
  billId: string
  htmlContent: string
  rawText: string
  status: 'PENDING' | 'PRINTED' | 'FAILED'
  timestamp: number
}

type TerminalState = {
  products: Product[]
  categories: Category[]
  rawMaterials: RawMaterial[]
  sales: Sale[]
  offlineQueue: Sale[]
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
  setRawMaterials: (materials: RawMaterial[]) => void
  clearSales: () => void
  
  addOfflineSale: (sale: Sale) => void
  removeOfflineSale: (id: string) => void
  updateOfflineSaleStatus: (id: string, status: 'COMPLETED' | 'PENDING_SYNC') => void
  markSaleCompleted: (id: string) => void

  printerType: string
  setPrinterType: (type: string) => void

  bluetoothPrinter: { name: string, mac: string } | null
  setBluetoothPrinter: (printer: { name: string, mac: string } | null) => void

  wifiPrinter: { name: string, ip: string, port: string } | null
  setWifiPrinter: (printer: { name: string, ip: string, port: string } | null) => void

  printJobs: PrintJob[]
  addPrintJob: (job: PrintJob) => void
  updatePrintJobStatus: (id: string, status: 'PENDING' | 'PRINTED' | 'FAILED') => void
  removePrintJob: (id: string) => void

  enableCashChange: boolean
  setEnableCashChange: (enabled: boolean) => void

  syncInterval: number
  setSyncInterval: (interval: number) => void

  enableDiscount: boolean
  setEnableDiscount: (enabled: boolean) => void

  activeShortcuts: Record<string, string>
  setActiveShortcuts: (shortcuts: Record<string, string>) => void
  
  isBackendOnline: boolean
  setIsBackendOnline: (status: boolean) => void
  
  completedBillHtml: string | null
  setCompletedBillHtml: (html: string | null) => void

  billSequence: { date: string, count: number }
  generateNextBillId: () => string
}

export const DEFAULT_SHORTCUTS: Record<string, string> = {
  searchProduct: 'F1',
  holdBill: 'F3',
  recallBill: 'F4',
  cashPayment: 'F6',
  upiPayment: 'F7',
  cardPayment: 'F8',
  printBill: 'F9',
  completeBill: 'F10',
  cancel: 'Escape'
};

export const useTerminalStore = create<TerminalState>()(
  persist(
    (set, get) => ({
      billSequence: { date: '', count: 0 },
      generateNextBillId: () => {
        const state = get()
        const now = new Date()
        const dd = String(now.getDate()).padStart(2, '0')
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const yy = String(now.getFullYear()).slice(-2)
        const todayStr = `${dd}${mm}${yy}`
        
        let nextCount = 1
        if (state.billSequence.date === todayStr) {
          nextCount = state.billSequence.count + 1
        }
        
        set({ billSequence: { date: todayStr, count: nextCount } })
        
        const randomSuffix = Math.random().toString(36).substring(2, 6).toUpperCase();
        return `BILL-${todayStr}-${String(nextCount).padStart(3, '0')}-${randomSuffix}`
      },
      products: PRODUCTS,
      categories: CATEGORIES,
      rawMaterials: [],
      sales: [],
      offlineQueue: [],
      selectedCategoryId: 'all',
      searchQuery: '',
      cart: [],
      discountValue: 0,
      isDiscountPercentage: false,
      printerType: 'browser',
      enableCashChange: true,
      syncInterval: 30,
      activeShortcuts: DEFAULT_SHORTCUTS,
      heldCarts: [],
      isBackendOnline: true,
      enableDiscount: true,
      bluetoothPrinter: null,
      wifiPrinter: null,
      printJobs: [],
      completedBillHtml: null,

      setIsBackendOnline: (status) => set({ isBackendOnline: status }),
      setCompletedBillHtml: (html) => set({ completedBillHtml: html }),
      setPrinterType: (type) => set({ printerType: type }),
      setBluetoothPrinter: (printer) => set({ bluetoothPrinter: printer }),
      setWifiPrinter: (printer) => set({ wifiPrinter: printer }),
      addPrintJob: (job) => set((state) => ({ printJobs: [...state.printJobs, job] })),
      updatePrintJobStatus: (id, status) => set((state) => ({
        printJobs: state.printJobs.map(j => j.id === id ? { ...j, status } : j)
      })),
      removePrintJob: (id) => set((state) => ({
        printJobs: state.printJobs.filter(j => j.id !== id)
      })),
      setEnableCashChange: (enabled) => set({ enableCashChange: enabled }),
      setEnableDiscount: (enabled) => set({ enableDiscount: enabled }),
      setSyncInterval: (interval) => set({ syncInterval: interval }),
      setActiveShortcuts: (shortcuts) => set({ activeShortcuts: shortcuts }),

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
      heldCarts: [newHeldCart, ...(state.heldCarts || [])],
      cart: [],
      discountValue: 0
    }
  }),
  
  recallCart: (id) => set((state) => {
    const safeHeldCarts = state.heldCarts || [];
    const held = safeHeldCarts.find(h => h.id === id);
    if (!held) return state;
    return {
      cart: held.items,
      heldCarts: safeHeldCarts.filter(h => h.id !== id),
      discountValue: 0
    }
  }),
  
  deleteHeldCart: (id) => set((state) => ({
    heldCarts: (state.heldCarts || []).filter(h => h.id !== id)
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
    const formatLine = (left: string, right: string) => {
      const space = 48 - left.length - right.length;
      return left + ' '.repeat(Math.max(1, space)) + right;
    };
    
    const dateStr = new Date().toLocaleDateString('en-GB');
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase();

    const rawText = `
                  SK BIRYANI                  
            Restaurant & Fast Food            
------------------------------------------------
${formatLine(`BILL NO-${seqPart}`, dateStr)}
${formatLine(`Payment: ${saleData.paymentMethod}`, timeStr)}
------------------------------------------------
${"ITEM".padEnd(30)} ${"QTY".padStart(5)} ${"AMT".padStart(11)}
${saleData.items.map(item => {
  const name = item.product.name.substring(0, 30).padEnd(30);
  const qty = String(item.quantity).padStart(5);
  const amt = String((item.quantity * item.product.price).toFixed(2)).padStart(11);
  return `${name} ${qty} ${amt}`;
}).join('\n')}
------------------------------------------------
${formatLine('Subtotal', String(saleData.subtotal.toFixed(2)))}
${saleData.discount > 0 ? formatLine('Discount', '-' + String(saleData.discount.toFixed(2))) + '\n' : ''}${saleData.tax > 0 ? formatLine('Tax', String(saleData.tax.toFixed(2))) + '\n' : ''}------------------------------------------------
${formatLine('TOTAL', String(saleData.total.toFixed(2)))}
------------------------------------------------
          *** Thank You, Visit Again! ***       
`;

    const design = usePrinterDesignStore.getState();
    const htmlContent = generateReceiptHtml({ ...saleData, id: fullBillId, timestamp: Date.now() }, design);

    // Always create a print job
    const jobId = "PRINT-" + Date.now();
    state.addPrintJob({
      id: jobId,
      billId: fullBillId,
      htmlContent,
      rawText,
      status: 'PENDING',
      timestamp: Date.now()
    });

    if (state.printerType === 'wire' || state.printerType === 'browser') {
      const printWindow = window.open('', '_blank', 'width=340,height=700');
      if (printWindow) {
        printWindow.document.write(htmlContent);
        printWindow.document.close();
        state.updatePrintJobStatus(jobId, 'PRINTED');
      } else {
        alert("Sale Completed! Please allow popups to print receipt.");
      }
    } else if (state.printerType === 'wifi' || state.printerType === 'bluetooth') {
      // Background printing engine will automatically print this via the PrintJob queue
      state.updatePrintJobStatus(jobId, 'PENDING');
    } else {
      // None
      state.updatePrintJobStatus(jobId, 'PRINTED');
    }
  },
  
  resetData: () => set({ products: PRODUCTS, categories: CATEGORIES, rawMaterials: [] }),
  setProducts: (products) => set({ products }),
  setCategories: (categories) => set({ categories }),
  setRawMaterials: (rawMaterials) => set({ rawMaterials }),
  clearSales: () => set({ sales: [], offlineQueue: [] }),
  
  addOfflineSale: (sale) => set((state) => ({ 
    offlineQueue: [...state.offlineQueue, sale] 
  })),
  
  removeOfflineSale: (id) => set((state) => ({
    offlineQueue: state.offlineQueue.filter(s => s.id !== id)
  })),
  
  updateOfflineSaleStatus: (id, status) => set((state) => ({
    offlineQueue: state.offlineQueue.map(s => 
      s.id === id ? { ...s, syncStatus: status } : s
    )
  })),

  markSaleCompleted: (id) => set((state) => ({
    sales: state.sales.filter(s => s.id !== id)
  }))
}),
{
  name: 'terminal-storage',
  version: 2,
  migrate: (persistedState: any, version: number) => {
    if (version < 2 || version === undefined) {
      // One-time migration: force all stuck pending sales to COMPLETED
      if (persistedState && Array.isArray(persistedState.sales)) {
        persistedState.sales = persistedState.sales.map((s: any) => ({
          ...s,
          syncStatus: 'COMPLETED'
        }));
      }
      // Force wipe the broken offline queue
      if (persistedState && Array.isArray(persistedState.offlineQueue)) {
        persistedState.offlineQueue = [];
      }
    }
    return persistedState;
  }
}
))

