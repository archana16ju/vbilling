import { usePrinterDesignStore } from './usePrinterDesignStore';
import { generateReceiptHtml } from '@/lib/printSystem';
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { Product, PRODUCTS, Category, CATEGORIES } from '@/lib/mock-data'
import { CartItemData, calculateRoundOff } from '@/lib/calculations'
import { RawMaterial } from '@/types/product'

export type HeldCart = {
  id: string
  items: CartItemData[]
  timestamp: number
  orderNote?: string
  selectedCustomer?: { id?: string; name: string; phone?: string; email?: string; address?: string } | null
}

export type Sale = {
  id: string
  items: CartItemData[]
  subtotal: number
  discount: number
  tax: number
  cgst?: number
  sgst?: number
  roundOff?: number
  total: number
  paymentMethod: string
  paymentStatus?: string
  timestamp: number
  amountReceived?: number
  changeAmount?: number
  discountValue?: number
  isDiscountPercentage?: boolean
  syncStatus?: 'COMPLETED' | 'PENDING_SYNC'
  createdBy?: string
  companyId?: string
  companyName?: string
  tableId?: string
  tableName?: string
  waiterId?: string
  waiterName?: string
  servingStatus?: string
  orderType?: 'Dine In' | 'Takeaway' | 'Delivery' | string
  orderSource?: 'Terminal' | 'Zomato' | 'Swiggy' | string
  onlineOrderId?: string
  customerName?: string
  customerPhone?: string
  deliveryAddress?: string
  deliveryNotes?: string
  orderNote?: string
  delivery?: {
    id?: string
    billId?: string
    deliveryStatus?: string
    assignmentStatus?: string
    deliveryAddress?: string
    deliveryNotes?: string
    deliveryPersonId?: string
    deliveryPersonName?: string
    [key: string]: any
  }
  createdAt?: string
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
  orderNote: string
  setOrderNote: (note: string) => void
  selectedCustomer: { id?: string; name: string; phone?: string; email?: string; address?: string } | null
  setSelectedCustomer: (customer: { id?: string; name: string; phone?: string; email?: string; address?: string } | null) => void
  
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
  updateItemNotes: (productId: string, notes: string) => void
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
  updateSalePayment: (billId: string, paymentMethod: string, cashReceived?: number, changeReturned?: number) => void
  refundSale: (billId: string) => void

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
  companySequences?: Record<string, { date: string, count: number }>
  activeCompanyId?: string
  setActiveCompanyId?: (id: string) => void
  generateNextBillId: (companyId?: string) => string
  reconcileBillSequence: (serverCount: number, companyId?: string, force?: boolean) => void
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
      companySequences: {},
      activeCompanyId: '',
      setActiveCompanyId: (id: string) => set({ activeCompanyId: id }),
      reconcileBillSequence: (serverCount: number, companyId?: string, force?: boolean) => {
        const state = get()
        const now = new Date()
        const dd = String(now.getDate()).padStart(2, '0')
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const yy = String(now.getFullYear()).slice(-2)
        const todayStr = `${dd}${mm}${yy}`
        const compKey = companyId || state.activeCompanyId || 'default'

        const existing = (state.companySequences || {})[compKey] || { date: '', count: 0 }
        let newCount = serverCount
        if (!force && existing.date === todayStr) {
          newCount = Math.max(serverCount, existing.count)
        }

        set({
          billSequence: { date: todayStr, count: newCount },
          companySequences: {
            ...(state.companySequences || {}),
            [compKey]: { date: todayStr, count: newCount }
          }
        })
      },
      generateNextBillId: (companyId?: string) => {
        const state = get()
        const now = new Date()
        const dd = String(now.getDate()).padStart(2, '0')
        const mm = String(now.getMonth() + 1).padStart(2, '0')
        const yy = String(now.getFullYear()).slice(-2)
        const todayStr = `${dd}${mm}${yy}`
        const compKey = companyId || state.activeCompanyId || 'default'

        const existing = (state.companySequences || {})[compKey] || { date: '', count: 0 }
        let nextCount = 1
        if (existing.date === todayStr) {
          nextCount = existing.count + 1
        }

        set({
          billSequence: { date: todayStr, count: nextCount },
          companySequences: {
            ...(state.companySequences || {}),
            [compKey]: { date: todayStr, count: nextCount }
          }
        })

        return `BILL-${todayStr}-${String(nextCount).padStart(3, '0')}`
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
      orderNote: '',
      setOrderNote: (note: string) => set({ orderNote: note }),
      selectedCustomer: null,
      setSelectedCustomer: (cust) => set({ selectedCustomer: cust }),

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
      timestamp: Date.now(),
      orderNote: state.orderNote,
      selectedCustomer: state.selectedCustomer
    };
    return {
      heldCarts: [newHeldCart, ...(state.heldCarts || [])],
      cart: [],
      discountValue: 0,
      orderNote: '',
      selectedCustomer: null
    }
  }),
  
  recallCart: (id) => set((state) => {
    const safeHeldCarts = state.heldCarts || [];
    const held = safeHeldCarts.find(h => h.id === id);
    if (!held) return state;
    return {
      cart: held.items,
      orderNote: held.orderNote || '',
      selectedCustomer: held.selectedCustomer || null,
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

  updateItemNotes: (productId, notes) => set((state) => ({
    cart: state.cart.map(i =>
      i.product.id === productId ? { ...i, notes } : i
    )
  })),
  
  clearCart: () => set({ cart: [], discountValue: 0, orderNote: '', selectedCustomer: null }),
  
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
        discountValue: 0,
        orderNote: '',
        selectedCustomer: null
      }
    })
    
    const state = useTerminalStore.getState();
    const formatLine = (left: any = '', right: any = '') => {
      const l = String(left ?? '');
      const r = String(right ?? '');
      const space = 48 - l.length - r.length;
      return l + ' '.repeat(Math.max(1, space)) + r;
    };
    
    const dateStr = new Date().toLocaleDateString('en-GB');
    const timeStr = new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }).toLowerCase();

    const design = usePrinterDesignStore.getState();

    let htmlContent = '';
    let jobId = '';

    try {
      // Calculate CGST and SGST divided equally from product tax rates
      const taxGroups: { rate: number; taxable: number; cgstAmount: number; sgstAmount: number }[] = [];
      if (Array.isArray(saleData.items) && saleData.items.length > 0) {
        const rateMap = new Map<number, number>();
        saleData.items.forEach((item: any) => {
          const fullTaxRate = (item?.product && typeof item.product.tax === 'number') ? item.product.tax : (typeof item?.tax === 'number' ? item.tax : 0);
          if (fullTaxRate > 0) {
            const qty = item?.quantity || 1;
            const price = parseFloat(item?.rate || (item?.product && item.product.price) || item?.price || 0);
            const itemSubtotal = price * qty;
            const discRate = (item?.product && item.product.discount) || item?.discount || 0;
            const itemDisc = itemSubtotal * (discRate / 100);
            const taxable = itemSubtotal - itemDisc;
            rateMap.set(fullTaxRate, (rateMap.get(fullTaxRate) || 0) + taxable);
          }
        });

        rateMap.forEach((taxable, fullTaxRate) => {
          const dividedRate = fullTaxRate / 2; // e.g. 2% -> 1%, 5.4% -> 2.7%
          taxGroups.push({
            rate: dividedRate,
            taxable,
            cgstAmount: taxable * (dividedRate / 100),
            sgstAmount: taxable * (dividedRate / 100),
          });
        });
      }

      if (taxGroups.length === 0 && (saleData.tax || 0) > 0 && (saleData.subtotal || 0) > 0) {
        const taxable = (saleData.subtotal || 0) - (saleData.discount || 0);
        const effectiveFullRate = taxable > 0 ? ((saleData.tax / taxable) * 100) : 0;
        const dividedRate = effectiveFullRate / 2;
        const halfTax = saleData.tax / 2;
        taxGroups.push({
          rate: dividedRate,
          taxable,
          cgstAmount: halfTax,
          sgstAmount: halfTax,
        });
      }

      const totalCgst = taxGroups.reduce((sum, g) => sum + g.cgstAmount, 0);
      const totalSgst = taxGroups.reduce((sum, g) => sum + g.sgstAmount, 0);
      const totalTaxAmount = totalCgst + totalSgst;
      const exactTotal = (saleData.subtotal || 0) - (saleData.discount || 0) + (design.showCgstSgst ? totalTaxAmount : (saleData.tax || 0));

      let roundOffAmount = 0;
      let finalGrandTotal = exactTotal;

      if (saleData.roundOff !== undefined && saleData.roundOff !== null) {
        roundOffAmount = saleData.roundOff;
        finalGrandTotal = parseFloat((exactTotal + roundOffAmount).toFixed(2));
      } else if (design.showRoundOff) {
        const ro = calculateRoundOff(exactTotal, true, design.roundOffMethod || 'nearest', design.roundOffBelow, design.roundOffAbove);
        roundOffAmount = ro.roundOffAmount;
        finalGrandTotal = ro.grandTotal;
      }

      const formatSummaryRight = (label: string, value: string) => {
        const line = `${label} ${value}`;
        return line.padStart(48);
      };

      const compName = String(design?.companyName || '');
      const loc = String(design?.location || '');
      const ph = String(design?.phoneNumber || '');
      const em = String(design?.email || '');
      const gst = String(design?.gstNumber || '');
      const header = String(design?.customHeaderText || '');

      const rawText = `
${design?.showCompanyName && compName ? formatLine(' '.repeat(Math.max(0, Math.floor((48 - compName.length) / 2))) + compName, '') : ''}
${design?.showLocation && loc ? formatLine(' '.repeat(Math.max(0, Math.floor((48 - loc.length) / 2))) + loc, '') : ''}
${design?.showPhoneNumber && ph ? formatLine(' '.repeat(Math.max(0, Math.floor((48 - ('Ph: ' + ph).length) / 2))) + 'Ph: ' + ph, '') : ''}
${design?.showEmail && em ? formatLine(' '.repeat(Math.max(0, Math.floor((48 - ('Email: ' + em).length) / 2))) + 'Email: ' + em, '') : ''}
${design?.showGstNumber && gst ? formatLine(' '.repeat(Math.max(0, Math.floor((48 - ('GST: ' + gst).length) / 2))) + 'GST: ' + gst, '') : ''}
${design?.showHeader && header ? formatLine(' '.repeat(Math.max(0, Math.floor((48 - header.length) / 2))) + header, '') : ''}
------------------------------------------------
${formatLine(`BILL NO-${seqPart}`, dateStr)}
${formatLine(`Payment: ${saleData.paymentMethod}`, timeStr)}
------------------------------------------------
${"ITEM".padEnd(15)} ${"PRICE".padStart(7)} ${"QTY".padStart(4)} ${"TAX".padStart(8)} ${"TOTAL".padStart(10)}
${(Array.isArray(saleData.items) ? saleData.items : []).map((item: any) => {
  let name = String(item?.product?.name || item?.name || 'Item');
  const priceVal = parseFloat(item?.rate || (item?.product && item.product.price) || item?.price || 0);
  const price = String(priceVal.toFixed(2)).padStart(7);
  const qtyVal = item?.quantity || 1;
  const qty = String(qtyVal).padStart(4);
  const itemSubtotal = priceVal * qtyVal;
  const discRate = (item?.product && item.product.discount) || item?.discount || 0;
  const itemDisc = itemSubtotal * (discRate / 100);
  const taxable = itemSubtotal - itemDisc;
  const fullTaxRate = (item?.product && typeof item.product.tax === 'number') ? item.product.tax : (typeof item?.tax === 'number' ? item.tax : 0);
  const itemTax = item?.tax !== undefined ? item.tax : taxable * (fullTaxRate / 100);
  const taxStr = String(itemTax.toFixed(2)).padStart(8);
  const amt = String((item?.total || (itemSubtotal - itemDisc + itemTax)).toFixed(2)).padStart(10);
  
  if (name.length <= 15) {
    return `${name.padEnd(15)} ${price} ${qty} ${taxStr} ${amt}`;
  } else {
    let lines = [];
    lines.push(`${name.substring(0, 15)} ${price} ${qty} ${taxStr} ${amt}`);
    let remaining = name.substring(15);
    while (remaining.length > 0) {
      lines.push(remaining.substring(0, 15).padEnd(15));
      remaining = remaining.substring(15);
    }
    return lines.join('\n');
  }
}).join('\n')}
------------------------------------------------
${design?.showSubtotal ? formatSummaryRight('Sub Total :', String((saleData.subtotal || 0).toFixed(2))) + '\n' : ''}${design?.showBillDiscount && (saleData.discount || 0) > 0 ? formatSummaryRight('Discount :', '-' + String((saleData.discount || 0).toFixed(2))) + '\n' : ''}${design?.showBillTax && !design?.showCgstSgst && (saleData.tax || 0) > 0 ? formatSummaryRight('Tax :', '+' + String((saleData.tax || 0).toFixed(2))) + '\n' : ''}${design?.showCgstSgst ? formatSummaryRight('CGST :', String(totalCgst.toFixed(2))) + '\n' + formatSummaryRight('SGST :', String(totalSgst.toFixed(2))) + '\n' : ''}${design?.showRoundOff ? formatSummaryRight('Round Off :', (roundOffAmount >= 0 ? '+' : '-') + 'Rs' + Math.abs(roundOffAmount).toFixed(2)) + '\n' : ''}------------------------------------------------
${design?.showGrandTotal ? formatLine('Grand Total :', String(finalGrandTotal.toFixed(2))) + '\n------------------------------------------------' : ''}
          *** Thank You, Visit Again! ***       
`.replace(/\n\n+/g, '\n');

      htmlContent = generateReceiptHtml({ ...saleData, roundOff: roundOffAmount, total: finalGrandTotal, id: fullBillId, timestamp: Date.now() }, design);

      // Always create a print job
      jobId = "PRINT-" + Date.now();
      state.addPrintJob({
        id: jobId,
        billId: fullBillId,
        htmlContent,
        rawText,
        status: 'PENDING',
        timestamp: Date.now()
      });
    } catch (printPrepErr) {
      console.warn("Print job generation warning (non-fatal):", printPrepErr);
    }

    if (state.printerType === 'wire' || state.printerType === 'browser') {
      if (htmlContent) {
        const printWindow = window.open('', '_blank', 'width=340,height=700');
        if (printWindow) {
          printWindow.document.write(htmlContent);
          printWindow.document.close();
          if (jobId) state.updatePrintJobStatus(jobId, 'PRINTED');
        } else {
          alert("Sale Completed! Please allow popups to print receipt.");
        }
      }
    } else if (state.printerType === 'wifi' || state.printerType === 'bluetooth') {
      // Background printing engine will automatically print this via the PrintJob queue
      if (jobId) state.updatePrintJobStatus(jobId, 'PENDING');
    } else {
      // None
      if (jobId) state.updatePrintJobStatus(jobId, 'PRINTED');
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
  })),

  updateSalePayment: (billId, paymentMethod, cashReceived, changeReturned) => set((state) => ({
    sales: state.sales.map((s) =>
      s.id === billId || (s as any).billNumber === billId
        ? {
            ...s,
            paymentMethod,
            amountReceived: cashReceived,
            changeAmount: changeReturned,
          }
        : s
    ),
    offlineQueue: state.offlineQueue.map((s) =>
      s.id === billId || (s as any).billNumber === billId
        ? {
            ...s,
            paymentMethod,
            amountReceived: cashReceived,
            changeAmount: changeReturned,
          }
        : s
    ),
  })),

  refundSale: (billId) => set((state) => ({
    sales: state.sales.map((s) =>
      s.id === billId || (s as any).billNumber === billId
        ? {
            ...s,
            paymentStatus: 'refunded',
          }
        : s
    ),
    offlineQueue: state.offlineQueue.map((s) =>
      s.id === billId || (s as any).billNumber === billId
        ? {
            ...s,
            paymentStatus: 'refunded',
          }
        : s
    ),
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

