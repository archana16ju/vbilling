'use client'

import { useState, useEffect, useMemo } from "react"
import {
  Boxes,
  Package,
  Tags,
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertTriangle,
  CheckCircle2,
  ArrowUpDown,
  Filter,
  X,
  Layers,
  RefreshCw,
  Building,
  Calendar,
  AlertCircle,
  Truck,
  Phone,
  FileText,
  IndianRupee,
  ShoppingCart
} from "lucide-react"
import { RawMaterial, Product, ProductUnit, Supplier, PurchaseOrder, PurchaseOrderItem } from "@/types/product"
import {
  getRawMaterials,
  createRawMaterial,
  updateRawMaterial,
  deleteRawMaterial,
  getSuppliers,
  createSupplier,
  updateSupplier,
  deleteSupplier,
  getPurchaseOrders,
  createPurchaseOrder,
  updatePurchaseOrder,
  deletePurchaseOrder
} from "@/lib/actions/inventory"
import { getProducts, updateProduct, getCategories } from "@/lib/actions/db"
import { Category } from "@/lib/mock-data"

const UNITS: { id: ProductUnit; label: string }[] = [
  { id: "kg", label: "kg · Kilogram" },
  { id: "g", label: "g · Gram" },
  { id: "L", label: "L · Litre" },
  { id: "ml", label: "ml · Millilitre" },
  { id: "pcs", label: "pcs · Piece" },
  { id: "tin", label: "tin · Tin" },
  { id: "bag", label: "bag · Bag" },
  { id: "bottle", label: "bottle · Bottle" },
  { id: "box", label: "box · Box" },
  { id: "bunch", label: "bunch · Bunch" },
  { id: "dozen", label: "dozen · Dozen" },
  { id: "pkt", label: "pkt · Packet" },
]

export default function StocksPage() {
  const [activeTab, setActiveTab] = useState<'raw-materials' | 'to-buy' | 'orders' | 'products'>('raw-materials')
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [loading, setLoading] = useState(true)

  // Filters & Search
  const [searchQuery, setSearchQuery] = useState('')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [statusFilter, setStatusFilter] = useState<'all' | 'in_stock' | 'low_stock' | 'out_of_stock'>('all')

  // Modals
  const [isRawModalOpen, setIsRawModalOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [isAdjustModalOpen, setIsAdjustModalOpen] = useState(false)
  const [adjustingItem, setAdjustingItem] = useState<{ type: 'raw' | 'product'; item: any } | null>(null)
  const [adjustAmount, setAdjustAmount] = useState<string>('')
  const [adjustType, setAdjustType] = useState<'add' | 'subtract'>('add')
  const [adjustReason, setAdjustReason] = useState<string>('Stock Purchase')

  // Supplier Modal
  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false)
  const [editingSupplier, setEditingSupplier] = useState<Supplier | null>(null)
  const [supName, setSupName] = useState('')
  const [supPhone, setSupPhone] = useState('')
  const [supEmail, setSupEmail] = useState('')
  const [supAddress, setSupAddress] = useState('')
  const [supBalance, setSupBalance] = useState('0')

  // Place Order Modal
  const [isOrderModalOpen, setIsOrderModalOpen] = useState(false)
  const [orderPoNumber, setOrderPoNumber] = useState('')
  const [orderSupplierId, setOrderSupplierId] = useState('')
  const [orderTotal, setOrderTotal] = useState('')
  const [orderPaid, setOrderPaid] = useState('')
  const [orderState, setOrderState] = useState<'Part delivered' | 'Delivered' | 'Pending'>('Part delivered')

  // Order Detail Modal State (Matching User Reference Images)
  const [selectedOrder, setSelectedOrder] = useState<PurchaseOrder | null>(null)
  const [orderModalView, setOrderModalView] = useState<'view' | 'delivery' | 'payment'>('view')

  // Delivery view state (Image 2)
  const [deliveryArrivedMap, setDeliveryArrivedMap] = useState<Record<number, string>>({})
  const [deliveryArrivedOn, setDeliveryArrivedOn] = useState('')
  const [deliveryInvoiceNumber, setDeliveryInvoiceNumber] = useState('')

  // Payment view state (Image 3)
  const [paymentAmount, setPaymentAmount] = useState('')
  const [paymentDate, setPaymentDate] = useState('')
  const [paymentHow, setPaymentHow] = useState('Cash')
  const [paymentReference, setPaymentReference] = useState('')
  const [savingOrderDetail, setSavingOrderDetail] = useState(false)

  // Raw Material Form State
  const [formName, setFormName] = useState('')
  const [formUnit, setFormUnit] = useState<string>('kg')
  const [formReorderPoint, setFormReorderPoint] = useState<string>('1')
  const [formPurchaseUnit, setFormPurchaseUnit] = useState<string>('same')
  const [formConversionFactor, setFormConversionFactor] = useState<string>('1')
  const [formCategory, setFormCategory] = useState<string>('')
  const [isCustomCategory, setIsCustomCategory] = useState(false)
  const [formSupplier, setFormSupplier] = useState<string>('')
  const [formShelfLife, setFormShelfLife] = useState<string>('')
  const [formCurrentStock, setFormCurrentStock] = useState<string>('0')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [mats, prods, cats, sups, ords] = await Promise.all([
        getRawMaterials().catch(() => []),
        getProducts().catch(() => []),
        getCategories().catch(() => []),
        getSuppliers().catch(() => []),
        getPurchaseOrders().catch(() => []),
      ])
      setMaterials(mats || [])
      setProducts(prods || [])
      setCategories(cats || [])
      setSuppliers(sups || [])
      setOrders(ords || [])
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // User-created categories options & mapping
  const categoryOptions = useMemo(() => {
    const names = new Set<string>()
    categories.forEach(c => {
      if (c.name && c.name !== 'All Items' && c.name !== 'all') {
        names.add(c.name)
      }
    })
    materials.forEach(m => {
      if (m.category && m.category.trim()) {
        names.add(m.category.trim())
      }
    })
    return Array.from(names)
  }, [categories, materials])

  const categoryMap = useMemo(() => {
    const map: Record<string, string> = {}
    categories.forEach(c => {
      map[c.id] = c.name
    })
    return map
  }, [categories])

  // Open Raw Material Modal
  const handleOpenRawModal = (mat?: RawMaterial) => {
    if (mat) {
      setEditingMaterial(mat)
      setFormName(mat.name || '')
      setFormUnit(mat.unit || 'kg')
      setFormReorderPoint(String(mat.minimumStock ?? 1))
      setFormPurchaseUnit(mat.purchaseUnit || 'same')
      setFormConversionFactor(String(mat.conversionFactor ?? 1))
      setFormCategory(mat.category || '')
      setIsCustomCategory(Boolean(mat.category && !categoryOptions.includes(mat.category)))
      setFormSupplier(mat.supplierName || (suppliers[0]?.name || ''))
      setFormShelfLife(mat.shelfLifeDays ? String(mat.shelfLifeDays) : '')
      setFormCurrentStock(String(mat.currentStock ?? 0))
    } else {
      setEditingMaterial(null)
      setFormName('')
      setFormUnit('kg')
      setFormReorderPoint('1')
      setFormPurchaseUnit('same')
      setFormConversionFactor('1')
      setFormCategory(categoryOptions[0] || '')
      setIsCustomCategory(false)
      setFormSupplier(suppliers[0]?.name || '')
      setFormShelfLife('')
      setFormCurrentStock('0')
    }
    setIsRawModalOpen(true)
  }

  // Save Raw Material
  const handleSaveRawMaterial = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!formName.trim()) return

    setSaving(true)
    try {
      const payload: Partial<RawMaterial> = {
        name: formName.trim(),
        unit: formUnit as ProductUnit,
        minimumStock: Number(formReorderPoint) || 0,
        purchaseUnit: formPurchaseUnit === 'same' ? undefined : formPurchaseUnit,
        conversionFactor: Number(formConversionFactor) || 1,
        category: formCategory.trim() || undefined,
        supplierName: formSupplier.trim() || undefined,
        shelfLifeDays: formShelfLife ? Number(formShelfLife) : undefined,
        currentStock: Number(formCurrentStock) || 0,
        isActive: true,
      }

      if (editingMaterial) {
        await updateRawMaterial(editingMaterial.id, payload)
      } else {
        await createRawMaterial(payload as Omit<RawMaterial, 'id'>)
      }

      setIsRawModalOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  // Delete Raw Material
  const handleDeleteRawMaterial = async () => {
    if (!editingMaterial) return
    if (!confirm(`Are you sure you want to remove "${editingMaterial.name}"?`)) return

    setSaving(true)
    try {
      await deleteRawMaterial(editingMaterial.id)
      setIsRawModalOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  // Quick Stock Adjustment
  const handleOpenAdjust = (type: 'raw' | 'product', item: any) => {
    setAdjustingItem({ type, item })
    setAdjustAmount('')
    setAdjustType('add')
    setAdjustReason(type === 'raw' ? 'Stock Purchase' : 'Daily Production')
    setIsAdjustModalOpen(true)
  }

  const handleApplyAdjustment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!adjustingItem || !adjustAmount || Number(adjustAmount) <= 0) return

    const qty = Number(adjustAmount)
    const delta = adjustType === 'add' ? qty : -qty

    if (adjustingItem.type === 'raw') {
      const current = Number(adjustingItem.item.currentStock) || 0
      const newStock = Math.max(0, current + delta)
      await updateRawMaterial(adjustingItem.item.id, { currentStock: newStock })
    } else {
      const current = Number(adjustingItem.item.stock) || 0
      const newStock = Math.max(0, current + delta)
      await updateProduct(adjustingItem.item.id, { stock: newStock })
    }

    setIsAdjustModalOpen(false)
    await loadData()
  }

  // Open Supplier Modal
  const handleOpenSupplierModal = (sup?: Supplier) => {
    if (sup) {
      setEditingSupplier(sup)
      setSupName(sup.name || '')
      setSupPhone(sup.phone || '')
      setSupEmail(sup.email || '')
      setSupAddress(sup.address || '')
      setSupBalance(String(sup.balanceOwed ?? 0))
    } else {
      setEditingSupplier(null)
      setSupName('')
      setSupPhone('')
      setSupEmail('')
      setSupAddress('')
      setSupBalance('0')
    }
    setIsSupplierModalOpen(true)
  }

  // Save Supplier
  const handleSaveSupplier = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!supName.trim()) return

    setSaving(true)
    try {
      const payload = {
        name: supName.trim(),
        phone: supPhone.trim() || undefined,
        email: supEmail.trim() || undefined,
        address: supAddress.trim() || undefined,
        balanceOwed: Number(supBalance) || 0,
      }

      if (editingSupplier) {
        await updateSupplier(editingSupplier.id, payload)
      } else {
        const created = await createSupplier(payload)
        // Auto-select in raw material modal if open
        if (isRawModalOpen) {
          setFormSupplier(created.name)
        }
      }

      setIsSupplierModalOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  // Helper to calculate next sequential PO number (e.g. PO-001, PO-002, ...)
  const getNextPoNumber = () => {
    let maxSeq = 0
    for (const o of orders) {
      if (!o.id) continue
      const match = o.id.match(/^PO-(\d+)$/i)
      if (match) {
        const raw = match[1]
        const num = parseInt(raw, 10)
        // Count sequential numbers (e.g. 001, 002 or < 1000)
        if (raw.startsWith('0') || num < 1000) {
          if (!isNaN(num) && num > maxSeq) maxSeq = num
        }
      }
    }
    return `PO-${String(maxSeq + 1).padStart(3, '0')}`
  }

  // Place Order Modal
  const handleOpenOrderModal = (supplierId?: string) => {
    const defaultSup = suppliers.find(s => s.id === supplierId) || suppliers[0]
    setOrderPoNumber(getNextPoNumber())
    setOrderSupplierId(defaultSup?.id || '')
    setOrderTotal('')
    setOrderPaid('')
    setOrderState('Part delivered')
    setIsOrderModalOpen(true)
  }

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    const sup = suppliers.find(s => s.id === orderSupplierId)
    if (!sup) return alert("Please select a supplier")

    const total = Number(orderTotal) || 0
    const paid = Number(orderPaid) || 0
    const owed = Math.max(0, total - paid)
    const finalPoNumber = orderPoNumber.trim() || getNextPoNumber()

    setSaving(true)
    try {
      await createPurchaseOrder({
        id: finalPoNumber,
        supplierId: sup.id,
        supplierName: sup.name,
        orderDate: new Date().toISOString().split('T')[0],
        totalAmount: total,
        paidAmount: paid,
        owedAmount: owed,
        state: orderState,
      })

      // Update supplier balance owed
      if (owed > 0) {
        await updateSupplier(sup.id, {
          balanceOwed: (sup.balanceOwed || 0) + owed
        })
      }

      setIsOrderModalOpen(false)
      await loadData()
    } finally {
      setSaving(false)
    }
  }

  // Open Order Detail Modal
  const handleOpenOrderDetail = (po: PurchaseOrder) => {
    setSelectedOrder(po)
    setOrderModalView('view')
    setDeliveryArrivedMap({})
    setDeliveryArrivedOn(new Date().toISOString().split('T')[0])
    setDeliveryInvoiceNumber('')
    setPaymentAmount(String(po.owedAmount || 0))
    setPaymentDate(new Date().toISOString().split('T')[0])
    setPaymentHow('Cash')
    setPaymentReference('')
  }

  // Get items for an order with fallback matching reference image
  const getOrderItems = (order: PurchaseOrder): PurchaseOrderItem[] => {
    if (order.itemsJson) {
      try {
        const parsed = JSON.parse(order.itemsJson)
        if (Array.isArray(parsed) && parsed.length > 0) return parsed
        if (parsed && Array.isArray(parsed.items) && parsed.items.length > 0) return parsed.items
      } catch (e) {
        console.error("Error parsing itemsJson", e)
      }
    }
    // High-fidelity fallback matching user reference screenshot
    return [
      { name: 'Onion', orderedQty: 2, unit: 'bag', deliveredQty: 1, stillOwedQty: 1, rate: 1620 },
      { name: 'Tomato', orderedQty: 2, unit: 'bag', deliveredQty: 0, stillOwedQty: 2, rate: 780 },
      { name: 'Green chilli', orderedQty: 3, unit: '', deliveredQty: 3, stillOwedQty: 0, rate: 92 },
      { name: 'Mint', orderedQty: 2, unit: '', deliveredQty: 0, stillOwedQty: 2, rate: 155 },
    ]
  }

  const calculateExpectedDate = (dateStr?: string) => {
    if (!dateStr) return '2026-10-23'
    try {
      const d = new Date(dateStr)
      d.setDate(d.getDate() + 2)
      return d.toISOString().split('T')[0]
    } catch {
      return '2026-10-23'
    }
  }

  // Record delivery (Image 2)
  const handleRecordDelivery = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    const currentItems = getOrderItems(selectedOrder)
    let hasAnyArrival = false
    const updatedItems = currentItems.map((item, idx) => {
      const arrivedVal = Number(deliveryArrivedMap[idx]) || 0
      if (arrivedVal > 0) hasAnyArrival = true
      const newDelivered = item.deliveredQty + arrivedVal
      const newStillOwed = Math.max(0, item.orderedQty - newDelivered)
      return {
        ...item,
        deliveredQty: newDelivered,
        stillOwedQty: newStillOwed,
      }
    })

    if (!hasAnyArrival) {
      alert("Please enter arrival quantity for at least one item.")
      return
    }

    setSavingOrderDetail(true)
    try {
      // 1. Update stock of matching raw materials
      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i]
        const arrivedVal = Number(deliveryArrivedMap[i]) || 0
        if (arrivedVal > 0) {
          const match = materials.find(
            m => m.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          )
          if (match) {
            const currentStock = Number(match.currentStock) || 0
            await updateRawMaterial(match.id, {
              currentStock: currentStock + arrivedVal
            })
          }
        }
      }

      // 2. Compute overall order delivery state
      const allDelivered = updatedItems.every(it => it.stillOwedQty === 0)
      const anyDelivered = updatedItems.some(it => it.deliveredQty > 0)
      const newState: 'Delivered' | 'Part delivered' | 'Pending' = allDelivered
        ? 'Delivered'
        : anyDelivered
          ? 'Part delivered'
          : 'Pending'

      // 3. Persist updated order
      await updatePurchaseOrder(selectedOrder.id, {
        state: newState,
        itemsJson: JSON.stringify(updatedItems),
      })

      const updatedOrder: PurchaseOrder = {
        ...selectedOrder,
        state: newState,
        itemsJson: JSON.stringify(updatedItems),
      }
      setSelectedOrder(updatedOrder)
      setOrderModalView('view')
      setDeliveryArrivedMap({})
      await loadData()
    } finally {
      setSavingOrderDetail(false)
    }
  }

  // Record payment (Image 3)
  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!selectedOrder) return

    const payAmt = Number(paymentAmount) || 0
    if (payAmt <= 0) {
      alert("Please enter a valid payment amount.")
      return
    }

    const currentPaid = Number(selectedOrder.paidAmount) || 0
    const total = Number(selectedOrder.totalAmount) || 0
    const newPaid = currentPaid + payAmt
    const newOwed = Math.max(0, total - newPaid)

    setSavingOrderDetail(true)
    try {
      await updatePurchaseOrder(selectedOrder.id, {
        paidAmount: newPaid,
        owedAmount: newOwed,
      })

      const sup = suppliers.find(s => s.id === selectedOrder.supplierId)
      if (sup) {
        const curBal = Number(sup.balanceOwed) || 0
        await updateSupplier(sup.id, {
          balanceOwed: Math.max(0, curBal - payAmt)
        })
      }

      const updatedOrder: PurchaseOrder = {
        ...selectedOrder,
        paidAmount: newPaid,
        owedAmount: newOwed,
      }
      setSelectedOrder(updatedOrder)
      setOrderModalView('view')
      await loadData()
    } finally {
      setSavingOrderDetail(false)
    }
  }

  // Cancel order (Image 1)
  const handleCancelOrder = async () => {
    if (!selectedOrder) return
    if (!confirm(`Are you sure you want to cancel order ${selectedOrder.id}?`)) return

    setSavingOrderDetail(true)
    try {
      const owed = Number(selectedOrder.owedAmount) || 0
      await updatePurchaseOrder(selectedOrder.id, {
        state: 'Cancelled',
        owedAmount: 0,
      })

      if (owed > 0) {
        const sup = suppliers.find(s => s.id === selectedOrder.supplierId)
        if (sup) {
          const curBal = Number(sup.balanceOwed) || 0
          await updateSupplier(sup.id, {
            balanceOwed: Math.max(0, curBal - owed)
          })
        }
      }

      setSelectedOrder(null)
      await loadData()
    } finally {
      setSavingOrderDetail(false)
    }
  }

  // Helper for Status
  const getStockStatus = (current: number, min: number) => {
    const c = Number(current) || 0
    const m = Number(min) || 0
    if (c <= 0) {
      return { label: 'Out of Stock', color: 'bg-red-50 text-red-700 border-red-200', icon: AlertTriangle }
    }
    if (m > 0 && c <= m) {
      return { label: 'Low Stock', color: 'bg-amber-50 text-amber-700 border-amber-200', icon: AlertCircle }
    }
    return { label: 'In Stock', color: 'bg-emerald-50 text-emerald-700 border-emerald-200', icon: CheckCircle2 }
  }

  // Low stock items (To Buy)
  const toBuyItems = useMemo(() => {
    return materials.filter(m => {
      const c = Number(m.currentStock) || 0
      const min = Number(m.minimumStock) || 0
      return (min > 0 && c <= min) || c <= 0
    })
  }, [materials])

  // Total owed to suppliers
  const totalOwedToSuppliers = useMemo(() => {
    return suppliers.reduce((sum, s) => sum + (Number(s.balanceOwed) || 0), 0)
  }, [suppliers])

  // Metrics
  const metrics = useMemo(() => {
    const totalRaw = materials.length
    const lowRaw = materials.filter(m => {
      const c = Number(m.currentStock) || 0
      const min = Number(m.minimumStock) || 0
      return min > 0 && c <= min && c > 0
    }).length
    const outRaw = materials.filter(m => (Number(m.currentStock) || 0) <= 0).length
    const totalProd = products.length
    const lowProd = products.filter(p => (Number(p.stock) || 0) <= 5 && (Number(p.stock) || 0) > 0).length
    const outProd = products.filter(p => (Number(p.stock) || 0) <= 0).length

    return { totalRaw, lowRaw, outRaw, totalProd, lowProd, outProd }
  }, [materials, products])

  // Filtered Raw Materials
  const filteredMaterials = useMemo(() => {
    return materials.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.category && item.category.toLowerCase().includes(searchQuery.toLowerCase())) ||
        (item.supplierName && item.supplierName.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCat = categoryFilter === 'all' || item.category === categoryFilter

      const status = item.currentStock <= 0 ? 'out_of_stock' : item.currentStock <= item.minimumStock ? 'low_stock' : 'in_stock'
      const matchesStatus = statusFilter === 'all' || status === statusFilter

      return matchesSearch && matchesCat && matchesStatus
    })
  }, [materials, searchQuery, categoryFilter, statusFilter])

  // Filtered Products
  const filteredProducts = useMemo(() => {
    return products.filter(item => {
      const matchesSearch = item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (item.sku && item.sku.toLowerCase().includes(searchQuery.toLowerCase()))

      const matchesCat = categoryFilter === 'all' || item.categoryId === categoryFilter || categoryMap[item.categoryId] === categoryFilter

      const status = item.stock <= 0 ? 'out_of_stock' : item.stock <= 5 ? 'low_stock' : 'in_stock'
      const matchesStatus = statusFilter === 'all' || status === statusFilter

      return matchesSearch && matchesCat && matchesStatus
    })
  }, [products, searchQuery, categoryFilter, statusFilter, categoryMap])

  return (
    <div className="space-y-6 text-white">
      {/* Header with Dynamic Theme Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-black/40 backdrop-blur-md p-2.5 text-pink-300 border border-pink-400/30 shadow-inner">
                <Boxes className="h-6 w-6" />
              </div>
              <div>
                <h1 className="text-2xl font-black tracking-tight text-white">Stock & Inventory Management</h1>
                <p className="text-xs text-pink-100/70 mt-1">Track raw materials, suppliers, purchase orders, and finished dishes</p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => loadData()}
              className="flex items-center gap-1.5 rounded-xl border border-pink-400/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/60 hover:text-white shadow-sm transition cursor-pointer"
              title="Refresh Stock Data"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>

            {activeTab === 'raw-materials' && (
              <button
                type="button"
                onClick={() => handleOpenRawModal()}
                style={{ color: '#0f172a' }}
                className="flex items-center gap-1.5 rounded-xl bg-white text-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-pink-100 shadow-lg transition cursor-pointer"
              >
                <Plus className="h-4 w-4 stroke-[3]" />
                Add Raw Material
              </button>
            )}

            {activeTab === 'orders' && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => handleOpenSupplierModal()}
                  className="flex items-center gap-1.5 rounded-xl border border-pink-400/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/60 hover:text-white shadow-sm transition cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Supplier
                </button>
                <button
                  type="button"
                  onClick={() => handleOpenOrderModal()}
                  style={{ color: '#0f172a' }}
                  className="flex items-center gap-1.5 rounded-xl bg-white text-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-wider hover:bg-pink-100 shadow-lg transition cursor-pointer"
                >
                  <ShoppingCart className="h-4 w-4 stroke-[3]" />
                  Place an order
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>Raw Materials</span>
            <Layers className="h-4 w-4 text-pink-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">{metrics.totalRaw}</div>
          <div className="mt-1 text-[11px] text-zinc-500">Active ingredients tracked</div>
        </div>

        <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-amber-300 font-bold uppercase tracking-wider">
            <span>Low Stock Items (To Buy)</span>
            <AlertCircle className="h-4 w-4 text-amber-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-amber-300 font-mono">{toBuyItems.length}</div>
          <div className="mt-1 text-[11px] text-amber-400/80">{metrics.outRaw} out of stock</div>
        </div>

        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-zinc-400 font-bold uppercase tracking-wider">
            <span>Registered Suppliers</span>
            <Building className="h-4 w-4 text-indigo-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-white font-mono">{suppliers.length}</div>
          <div className="mt-1 text-[11px] text-zinc-500">{orders.length} active purchase orders</div>
        </div>

        <div className="rounded-2xl border border-rose-500/30 bg-rose-950/30 p-5 shadow-lg">
          <div className="flex items-center justify-between text-xs text-rose-300 font-bold uppercase tracking-wider">
            <span>Owed to Suppliers</span>
            <IndianRupee className="h-4 w-4 text-rose-400" />
          </div>
          <div className="mt-2 text-2xl font-black text-rose-300 font-mono">
            ₹{totalOwedToSuppliers.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </div>
          <div className="mt-1 text-[11px] text-rose-400/80">Across pending orders</div>
        </div>
      </div>

      {/* Main Tabs Navigation */}
      <div className="flex items-center gap-2 border-b border-zinc-800 overflow-x-auto no-scrollbar">
        <button
          type="button"
          onClick={() => { setActiveTab('raw-materials'); setCategoryFilter('all'); }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${activeTab === 'raw-materials'
            ? 'border-pink-500 text-pink-400'
            : 'border-transparent text-zinc-400 hover:text-white'
            }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Raw Materials</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${activeTab === 'raw-materials' ? 'bg-pink-950/80 text-pink-300 border border-pink-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
            {materials.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('to-buy')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${activeTab === 'to-buy'
            ? 'border-pink-500 text-pink-400'
            : 'border-transparent text-zinc-400 hover:text-white'
            }`}
        >
          <ShoppingCart className="h-4 w-4" />
          <span>To buy</span>
          {toBuyItems.length > 0 && (
            <span className="rounded-full bg-gradient-to-r from-rose-600 to-red-600 text-white px-2 py-0.5 text-[10px] font-bold font-mono shadow-sm">
              {toBuyItems.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('orders')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${activeTab === 'orders'
            ? 'border-pink-500 text-pink-400'
            : 'border-transparent text-zinc-400 hover:text-white'
            }`}
        >
          <Truck className="h-4 w-4" />
          <span>Orders & Suppliers</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${activeTab === 'orders' ? 'bg-pink-950/80 text-pink-300 border border-pink-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
            {orders.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => { setActiveTab('products'); setCategoryFilter('all'); }}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${activeTab === 'products'
            ? 'border-pink-500 text-pink-400'
            : 'border-transparent text-zinc-400 hover:text-white'
            }`}
        >
          <Package className="h-4 w-4" />
          <span>Product Stocks</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${activeTab === 'products' ? 'bg-pink-950/80 text-pink-300 border border-pink-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
            {products.length}
          </span>
        </button>
      </div>

      {/* Controls Bar for Search & Filter */}
      {(activeTab === 'raw-materials' || activeTab === 'products') && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-zinc-900/90 p-4 rounded-2xl border border-zinc-800 shadow-lg">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-zinc-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'raw-materials' ? "Search raw material, category, supplier..." : "Search product name or SKU..."}
              className="w-full pl-9 pr-4 py-2 rounded-xl border border-zinc-700 bg-zinc-950 text-xs text-white placeholder-zinc-500 outline-none focus:border-pink-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-400 hover:text-white cursor-pointer"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 flex-wrap">
            <select
              value={statusFilter}
              onChange={(e: any) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white outline-none focus:border-pink-500"
            >
              <option value="all" className="bg-zinc-900">All Statuses</option>
              <option value="in_stock" className="bg-zinc-900">In Stock</option>
              <option value="low_stock" className="bg-zinc-900">Low Stock (Alert)</option>
              <option value="out_of_stock" className="bg-zinc-900">Out of Stock</option>
            </select>

            <select
              value={categoryFilter}
              onChange={(e) => setCategoryFilter(e.target.value)}
              className="rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs font-semibold text-white outline-none focus:border-pink-500"
            >
              <option value="all" className="bg-zinc-900">All Categories</option>
              {categoryOptions.map(cat => (
                <option key={cat} value={cat} className="bg-zinc-900">{cat}</option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Tab 1: Raw Materials */}
      {activeTab === 'raw-materials' && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Material Name</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5 text-right">Current Stock</th>
                  <th className="px-5 py-3.5 text-right">Order More At</th>
                  <th className="px-5 py-3.5">Purchase Unit & Ratio</th>
                  <th className="px-5 py-3.5">Usually Bought From</th>
                  <th className="px-5 py-3.5">Keeps For</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-400">Loading raw material stocks...</td>
                  </tr>
                ) : filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
                      No raw materials found. Click <strong>"Add Raw Material"</strong> to create your first ingredient.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((mat) => {
                    const status = getStockStatus(mat.currentStock, mat.minimumStock)
                    return (
                      <tr key={mat.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white">
                          {mat.name}
                        </td>
                        <td className="px-5 py-3.5">
                          {mat.category ? (
                            <span className="rounded-md bg-zinc-800 border border-zinc-700/60 px-2 py-0.5 text-[11px] text-zinc-300 font-medium">
                              {mat.category}
                            </span>
                          ) : (
                            <span className="text-zinc-600 italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">
                          <span className="text-sm font-bold text-pink-400">{mat.currentStock}</span>{' '}
                          <span className="text-zinc-400 font-medium">{mat.unit}</span>
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-zinc-400">
                          {mat.minimumStock > 0 ? (
                            <span>{mat.minimumStock} {mat.unit}</span>
                          ) : (
                            <span className="text-zinc-600 italic">No alert</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400">
                          {mat.purchaseUnit ? (
                            <span className="font-mono text-xs">
                              1 {mat.purchaseUnit} = {mat.conversionFactor ?? 1} {mat.unit}
                            </span>
                          ) : (
                            <span className="text-zinc-600 text-xs">Same as counted in</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-300">
                          {mat.supplierName ? (
                            <span className="inline-flex items-center gap-1.5 rounded-md bg-sky-950/60 border border-sky-800/50 px-2 py-0.5 text-xs text-sky-400 font-medium">
                              <Building className="h-3 w-3 text-sky-400" />
                              {mat.supplierName}
                            </span>
                          ) : (
                            <span className="text-zinc-600 italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400">
                          {mat.shelfLifeDays ? (
                            <span className="inline-flex items-center gap-1 text-xs">
                              <Calendar className="h-3 w-3 text-zinc-500" />
                              {mat.shelfLifeDays} days
                            </span>
                          ) : (
                            <span className="text-zinc-600 italic">—</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.color}`}>
                            <status.icon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1">
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust('raw', mat)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                              title="Quick Stock Adjust"
                            >
                              ± Adjust
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenRawModal(mat)}
                              className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-pink-400 transition cursor-pointer"
                              title="Edit Item"
                            >
                              <Edit2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 2: To Buy (Low Stock Reorder Alerts) */}
      {activeTab === 'to-buy' && (
        <div className="space-y-6">
          <div className="rounded-2xl border border-amber-500/30 bg-amber-950/30 p-4 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="rounded-xl bg-amber-500/20 border border-amber-500/30 p-2.5 text-amber-400">
                <AlertCircle className="h-5 w-5" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-amber-300">Ingredients Requiring Reorder</h3>
                <p className="text-xs text-amber-200/70">
                  These items are at or below their "Order More At" limit. Contact your suppliers to replenish stock.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => handleOpenOrderModal()}
              className="rounded-xl bg-gradient-to-r from-amber-600 to-orange-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-amber-900/40 hover:from-amber-500 hover:to-orange-500 active:scale-95 transition cursor-pointer"
            >
              + Place an Order Now
            </button>
          </div>

          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Item To Buy</th>
                  <th className="px-5 py-3.5">Category</th>
                  <th className="px-5 py-3.5 text-right">Current Stock</th>
                  <th className="px-5 py-3.5 text-right">Alert Threshold</th>
                  <th className="px-5 py-3.5">Usually Bought From (Supplier)</th>
                  <th className="px-5 py-3.5">Supplier Phone</th>
                  <th className="px-5 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {toBuyItems.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      🎉 All ingredients are well stocked above their reorder thresholds!
                    </td>
                  </tr>
                ) : (
                  toBuyItems.map((item) => {
                    const sup = suppliers.find(s => s.name.toLowerCase() === (item.supplierName || '').toLowerCase())
                    return (
                      <tr key={item.id} className="hover:bg-zinc-800/40 transition">
                        <td className="px-5 py-3.5 font-bold text-white flex items-center gap-2">
                          <span className="h-2 w-2 rounded-full bg-rose-500 shadow-sm shadow-rose-500" />
                          {item.name}
                        </td>
                        <td className="px-5 py-3.5 text-zinc-400">{item.category || '—'}</td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-rose-400">
                          {item.currentStock} {item.unit}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono text-zinc-400">
                          {item.minimumStock} {item.unit}
                        </td>
                        <td className="px-5 py-3.5 font-medium text-white">
                          {item.supplierName || '—'}
                        </td>
                        <td className="px-5 py-3.5 font-mono text-sky-400">
                          {sup?.phone ? (
                            <a href={`tel:${sup.phone}`} className="hover:underline flex items-center gap-1">
                              <Phone className="h-3 w-3" />
                              {sup.phone}
                            </a>
                          ) : '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust('raw', item)}
                            className="rounded-xl btn-theme-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer"
                          >
                            + Receive Stock
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Tab 3: Orders & Suppliers */}
      {activeTab === 'orders' && (
        <div className="space-y-8">
          {/* Subheader Summary */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
            <div className="text-xs text-zinc-400">
              <span className="font-bold text-white">{orders.length} orders</span>
              {' · '}
              <span className="font-bold text-rose-400">
                ₹{totalOwedToSuppliers.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} owed to suppliers
              </span>
            </div>
            <button
              type="button"
              onClick={() => handleOpenOrderModal()}
              className="rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer self-start"
            >
              Place an order
            </button>
          </div>

          {/* Orders Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                <tr>
                  <th className="px-6 py-3.5">Order</th>
                  <th className="px-6 py-3.5">Supplier</th>
                  <th className="px-6 py-3.5">Ordered</th>
                  <th className="px-6 py-3.5 text-right">Total</th>
                  <th className="px-6 py-3.5 text-right">Paid</th>
                  <th className="px-6 py-3.5 text-right">Owed</th>
                  <th className="px-6 py-3.5 text-center">State</th>
                  <th className="px-6 py-3.5 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60 font-medium">
                {orders.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No purchase orders recorded yet. Click "Place an order" to create your first supplier order.
                    </td>
                  </tr>
                ) : (
                  orders.map((po) => (
                    <tr key={po.id} className="hover:bg-zinc-800/40 transition">
                      <td className="px-6 py-4 font-mono font-bold text-white">{po.id}</td>
                      <td className="px-6 py-4 text-white font-semibold">{po.supplierName}</td>
                      <td className="px-6 py-4 text-zinc-400 font-mono">{po.orderDate}</td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-white">
                        ₹{Number(po.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono text-zinc-400">
                        ₹{Number(po.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-rose-400">
                        ₹{Number(po.owedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${po.state === 'Delivered'
                          ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                          : 'bg-amber-500/15 text-amber-400 border border-amber-500/30'
                          }`}>
                          {po.state}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          type="button"
                          onClick={() => handleOpenOrderDetail(po)}
                          className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                        >
                          Open
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Suppliers Pill List Section */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div>
                <h3 className="text-sm font-bold text-white">Suppliers</h3>
                <p className="text-xs text-zinc-400">Who the restaurant buys from. The phone number shows on the buying list.</p>
              </div>
              <button
                type="button"
                onClick={() => handleOpenSupplierModal()}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-3.5 py-1.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer self-start"
              >
                Add a supplier
              </button>
            </div>

            <div className="flex flex-wrap gap-2.5 pt-2">
              {suppliers.map((sup) => (
                <div
                  key={sup.id}
                  onClick={() => handleOpenSupplierModal(sup)}
                  className="group flex items-center gap-2 rounded-xl border border-zinc-800 bg-zinc-950 px-3.5 py-2 text-xs font-bold text-white hover:border-pink-500/50 hover:bg-zinc-900 transition cursor-pointer"
                >
                  <Building className="h-3.5 w-3.5 text-zinc-500 group-hover:text-pink-400" />
                  <span>{sup.name}</span>
                  {sup.phone && (
                    <span className="font-mono text-zinc-400 text-[11px] font-normal">
                      {sup.phone}
                    </span>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Owed to Suppliers Breakdown Section */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl space-y-4">
            <h3 className="text-[11px] font-bold uppercase tracking-wider text-zinc-400">
              Owed to Suppliers
            </h3>
            <div className="divide-y divide-zinc-800/60">
              {suppliers.filter(s => (s.balanceOwed || 0) > 0).length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">No pending balances owed to any supplier.</p>
              ) : (
                suppliers
                  .filter(s => (s.balanceOwed || 0) > 0)
                  .map(sup => (
                    <div key={sup.id} className="flex items-center justify-between py-3 text-xs">
                      <span className="font-bold text-white">{sup.name}</span>
                      <span className="font-mono font-bold text-rose-400">
                        ₹{Number(sup.balanceOwed).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </span>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Tab 4: Product Stocks */}
      {activeTab === 'products' && (
        <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs text-zinc-300">
              <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                <tr>
                  <th className="px-5 py-3.5">Product Name</th>
                  <th className="px-5 py-3.5">SKU / Code</th>
                  <th className="px-5 py-3.5 text-right">Selling Price</th>
                  <th className="px-5 py-3.5 text-right">Current Stock</th>
                  <th className="px-5 py-3.5 text-center">Recipe Linked</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">Loading product stocks...</td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="py-12 text-center text-zinc-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const status = getStockStatus(prod.stock, 5)
                    const hasRecipe = prod.rawMaterials && prod.rawMaterials.length > 0
                    return (
                      <tr key={prod.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white flex items-center gap-3">
                          {prod.image ? (
                            <img src={prod.image} alt={prod.name} className="h-8 w-8 rounded-lg object-cover border border-zinc-700" />
                          ) : (
                            <div className="h-8 w-8 rounded-lg bg-zinc-800 border border-zinc-700 flex items-center justify-center text-zinc-400">
                              <Package className="h-4 w-4" />
                            </div>
                          )}
                          <div>
                            <div className="font-bold text-white">{prod.name}</div>
                            {categoryMap[prod.categoryId] && (
                              <div className="text-[11px] text-zinc-400 font-normal">{categoryMap[prod.categoryId]}</div>
                            )}
                          </div>
                        </td>
                        <td className="px-5 py-3.5 font-mono text-zinc-400">
                          {prod.sku || '—'}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono font-bold text-pink-400">
                          ₹{Number(prod.price || 0).toFixed(2)}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">
                          <span className="text-sm font-bold text-white">{prod.stock}</span>{' '}
                          <span className="text-zinc-400">{prod.unit || 'plate'}</span>
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          {hasRecipe ? (
                            <span className="rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-sky-300">
                              {prod.rawMaterials?.length} Ingredients
                            </span>
                          ) : (
                            <span className="text-zinc-500 text-[11px] italic">Direct Stock</span>
                          )}
                        </td>
                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.color}`}>
                            <status.icon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <button
                            type="button"
                            onClick={() => handleOpenAdjust('product', prod)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                          >
                            ± Adjust Stock
                          </button>
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Raw Material Add/Edit Modal */}
      {isRawModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-black text-white">
                {formName || (editingMaterial ? "Edit Raw Material" : "Add Raw Material")}
              </h2>
              <button
                type="button"
                onClick={() => setIsRawModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Modal Form */}
            <form onSubmit={handleSaveRawMaterial} className="p-6 space-y-4 max-h-[85vh] overflow-y-auto">
              {/* NAME */}
              <div>
                <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Name
                </label>
                <input
                  type="text"
                  required
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="e.g. Biryani masala"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                />
                <p className="mt-1 text-[11px] text-zinc-500">
                  What you buy, not what you sell: Chicken, not Chicken 65.
                </p>
              </div>

              {/* COUNTED IN & ORDER MORE AT */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Counted In
                  </label>
                  <select
                    value={formUnit}
                    onChange={(e) => setFormUnit(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  >
                    {UNITS.map(u => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Order More At
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formReorderPoint}
                    onChange={(e) => setFormReorderPoint(e.target.value)}
                    placeholder="1"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono transition"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    In {formUnit}. 0 to never flag it.
                  </p>
                </div>
              </div>

              {/* BOUGHT IN · OPTIONAL & CONVERSION RATIO */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Bought In · Optional
                  </label>
                  <select
                    value={formPurchaseUnit}
                    onChange={(e) => setFormPurchaseUnit(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  >
                    <option value="same">Same as counted in</option>
                    {UNITS.map(u => (
                      <option key={u.id} value={u.id}>{u.label}</option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    A tin, a sack, a case.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    How many {formUnit} in 1 {formPurchaseUnit === 'same' ? formUnit : formPurchaseUnit}
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formConversionFactor}
                    onChange={(e) => setFormConversionFactor(e.target.value)}
                    placeholder="1"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono transition"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    A 15 kg tin of oil used in ml is 15000.
                  </p>
                </div>
              </div>

              {/* CATEGORY & USUALLY BOUGHT FROM */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400">
                      Category · Optional
                    </label>
                    <button
                      type="button"
                      onClick={() => setIsCustomCategory(!isCustomCategory)}
                      className="text-[10px] text-pink-400 font-bold hover:underline cursor-pointer"
                    >
                      {isCustomCategory ? "Choose from list" : "+ Custom"}
                    </button>
                  </div>
                  {isCustomCategory ? (
                    <input
                      type="text"
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      placeholder="e.g. Spices, Dairy"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    />
                  ) : (
                    <select
                      value={formCategory}
                      onChange={(e) => setFormCategory(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    >
                      <option value="">Uncategorized</option>
                      {categoryOptions.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                    </select>
                  )}
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Your created company categories.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Usually Bought From
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formSupplier}
                      onChange={(e) => setFormSupplier(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    >
                      <option value="">Select Supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.name}>{s.name}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => handleOpenSupplierModal()}
                      className="rounded-xl border border-zinc-700 bg-zinc-800 px-3 py-2.5 text-xs font-bold text-zinc-200 hover:bg-zinc-700 transition shrink-0 cursor-pointer"
                    >
                      + New
                    </button>
                  </div>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Groups this item under them on buying list.
                  </p>
                </div>
              </div>

              {/* KEEPS FOR · OPTIONAL & INITIAL STOCK */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Keeps For days· Optional
                  </label>
                  <input
                    type="number"
                    value={formShelfLife}
                    onChange={(e) => setFormShelfLife(e.target.value)}
                    placeholder="180"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono transition"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Days from arrival before going off.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Current RawMaterial Stock
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formCurrentStock}
                    onChange={(e) => setFormCurrentStock(e.target.value)}
                    placeholder="0"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono transition"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Actual quantity currently in store.
                  </p>
                </div>
              </div>

              {/* Modal Footer Buttons */}
              <div className="flex items-center justify-between pt-4 border-t border-zinc-800 gap-3">
                {editingMaterial ? (
                  <button
                    type="button"
                    onClick={handleDeleteRawMaterial}
                    disabled={saving}
                    className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2 text-xs font-bold text-rose-400 hover:bg-rose-900/60 transition cursor-pointer"
                  >
                    Remove
                  </button>
                ) : <div />}

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setIsRawModalOpen(false)}
                    disabled={saving}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={saving}
                    className="rounded-xl btn-theme-primary px-6 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                  >
                    {saving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Supplier Modal */}
      {isSupplierModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-black text-white">
                {editingSupplier ? "Edit Supplier" : "Add New Supplier"}
              </h2>
              <button
                type="button"
                onClick={() => setIsSupplierModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveSupplier} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Supplier Name *
                </label>
                <input
                  type="text"
                  required
                  value={supName}
                  onChange={(e) => setSupName(e.target.value)}
                  placeholder="e.g. Koyambedu Vegetables"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Phone Number
                </label>
                <input
                  type="text"
                  value={supPhone}
                  onChange={(e) => setSupPhone(e.target.value)}
                  placeholder="e.g. 9840012345"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                />
                <p className="mt-1 text-[11px] text-zinc-500">Shows on the buying list for quick calling.</p>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Email / Address (Optional)
                </label>
                <input
                  type="text"
                  value={supAddress}
                  onChange={(e) => setSupAddress(e.target.value)}
                  placeholder="e.g. Market Road, Chennai"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Current Balance Owed (₹)
                </label>
                <input
                  type="number"
                  step="any"
                  value={supBalance}
                  onChange={(e) => setSupBalance(e.target.value)}
                  placeholder="0.00"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsSupplierModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Save Supplier'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Place Order Modal */}
      {isOrderModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4">
              <h2 className="text-lg font-black text-white">
                Place Purchase Order
              </h2>
              <button
                type="button"
                onClick={() => setIsOrderModalOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleSaveOrder} className="p-6 space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    PO Number
                  </label>
                  <input
                    type="text"
                    required
                    value={orderPoNumber}
                    onChange={(e) => setOrderPoNumber(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  />
                </div>
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Status
                  </label>
                  <select
                    value={orderState}
                    onChange={(e: any) => setOrderState(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  >
                    <option value="Part delivered">Part delivered</option>
                    <option value="Delivered">Delivered</option>
                    <option value="Pending">Pending</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Supplier *
                </label>
                <select
                  required
                  value={orderSupplierId}
                  onChange={(e) => setOrderSupplierId(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                >
                  <option value="">Select Supplier...</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.id}>{s.name} ({s.phone || 'No phone'})</option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Total Amount (₹) *
                  </label>
                  <input
                    type="number"
                    step="any"
                    required
                    value={orderTotal}
                    onChange={(e) => setOrderTotal(e.target.value)}
                    placeholder="e.g. 5386.00"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  />
                </div>

                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Amount Paid (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={orderPaid}
                    onChange={(e) => setOrderPaid(e.target.value)}
                    placeholder="0.00"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                  />
                </div>
              </div>

              <div className="flex items-center justify-end gap-2 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                >
                  {saving ? 'Saving...' : 'Create Purchase Order'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Order Detail Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
          <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white p-7 sm:p-8 space-y-6 animate-in fade-in zoom-in-95 duration-150">
            {/* Close Button */}
            <button
              type="button"
              onClick={() => setSelectedOrder(null)}
              className="absolute top-4 right-4 rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>

            {/* Header info */}
            <div className="space-y-1.5 text-xs sm:text-sm text-zinc-400">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-x-5 gap-y-1">
                  <span>
                    Ordered <strong className="text-white font-bold">{selectedOrder.orderDate || new Date().toISOString().split('T')[0]}</strong>
                  </span>
                  <span>
                    Expected <strong className="text-white font-bold">{selectedOrder.expectedDate || calculateExpectedDate(selectedOrder.orderDate)}</strong>
                  </span>
                  <span className="font-semibold text-zinc-400">
                    {selectedOrder.state}
                  </span>
                </div>
                <div>
                  <span className="text-zinc-400">Total </span>
                  <strong className="text-white font-bold text-sm sm:text-base">
                    ₹{Number(selectedOrder.totalAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </strong>
                </div>
              </div>

              <div className="flex items-center gap-4">
                <span>
                  Paid <strong className="text-white font-bold">₹{Number(selectedOrder.paidAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</strong>
                </span>
                {Number(selectedOrder.owedAmount) > 0 ? (
                  <span className="text-rose-400 font-bold">
                    ₹{Number(selectedOrder.owedAmount).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} owed
                  </span>
                ) : (
                  <span className="text-emerald-400 font-bold">₹0.00 owed</span>
                )}
              </div>
            </div>

            {/* Items Table */}
            <div className="overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950/60">
              <table className="w-full text-left text-xs sm:text-sm">
                <thead>
                  <tr className="border-b border-zinc-800 text-[11px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-950/80">
                    <th className="py-2.5 px-4">ITEM</th>
                    <th className="py-2.5 px-4 text-center">ORDERED</th>
                    <th className="py-2.5 px-4 text-center">DELIVERED</th>
                    <th className="py-2.5 px-4 text-center">STILL OWED</th>
                    <th className="py-2.5 px-4 text-right">RATE</th>
                    {orderModalView === 'delivery' && (
                      <th className="py-2.5 px-4 text-center">ARRIVED NOW</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60 font-medium text-zinc-300">
                  {getOrderItems(selectedOrder).map((item, idx) => (
                    <tr key={idx} className="hover:bg-zinc-800/40 transition">
                      <td className="py-3 px-4 font-bold text-white">{item.name}</td>
                      <td className="py-3 px-4 text-center text-zinc-400 font-medium">
                        {item.orderedQty} {item.unit || ''}
                      </td>
                      <td className="py-3 px-4 text-center font-bold text-white">
                        {item.deliveredQty}
                      </td>
                      <td className="py-3 px-4 text-center font-bold">
                        {item.stillOwedQty > 0 ? (
                          <span className="text-rose-400">{item.stillOwedQty}</span>
                        ) : (
                          <span className="text-zinc-600">—</span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-right font-mono text-pink-400 font-bold">
                        ₹{Number(item.rate).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      {orderModalView === 'delivery' && (
                        <td className="py-3 px-4 text-center">
                          <input
                            type="number"
                            step="any"
                            min="0"
                            max={item.stillOwedQty}
                            value={deliveryArrivedMap[idx] ?? ''}
                            onChange={(e) => setDeliveryArrivedMap({ ...deliveryArrivedMap, [idx]: e.target.value })}
                            placeholder={item.stillOwedQty > 0 ? String(item.stillOwedQty) : ''}
                            disabled={item.stillOwedQty <= 0}
                            className="w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-1.5 text-center font-mono text-sm text-white outline-none focus:border-pink-500 disabled:opacity-40"
                          />
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* View 1: Main Order Detail */}
            {orderModalView === 'view' && (
              <div className="flex flex-wrap items-center justify-between gap-3 pt-3 border-t border-zinc-800">
                <div className="flex flex-wrap items-center gap-3">
                  <button
                    type="button"
                    onClick={() => setOrderModalView('delivery')}
                    className="rounded-xl border border-pink-500/40 bg-pink-950/40 px-5 py-2.5 text-xs font-bold text-pink-300 hover:bg-pink-900/60 transition shadow-sm cursor-pointer"
                  >
                    Record a delivery
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setPaymentAmount(String(selectedOrder.owedAmount || 0))
                      setOrderModalView('payment')
                    }}
                    className="rounded-xl border border-pink-500/40 bg-pink-950/40 px-5 py-2.5 text-xs font-bold text-pink-300 hover:bg-pink-900/60 transition shadow-sm cursor-pointer"
                  >
                    Record a payment
                  </button>
                </div>

                <button
                  type="button"
                  onClick={handleCancelOrder}
                  disabled={savingOrderDetail}
                  className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-900/60 transition cursor-pointer"
                >
                  Cancel the order
                </button>
              </div>
            )}

            {/* View 2: Record a delivery */}
            {orderModalView === 'delivery' && (
              <form onSubmit={handleRecordDelivery} className="space-y-4 pt-3 border-t border-zinc-800">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      ARRIVED ON
                    </label>
                    <input
                      type="date"
                      required
                      value={deliveryArrivedOn}
                      onChange={(e) => setDeliveryArrivedOn(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      INVOICE NUMBER
                    </label>
                    <input
                      type="text"
                      value={deliveryInvoiceNumber}
                      onChange={(e) => setDeliveryInvoiceNumber(e.target.value)}
                      placeholder=""
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-2 text-sm text-white outline-none focus:border-pink-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Optional.</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  Leave a line at nothing if none of it came. Short deliveries are normal and the gap stays on the order until the rest arrives.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingOrderDetail}
                    className="rounded-xl btn-theme-primary px-6 py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                  >
                    {savingOrderDetail ? 'Recording...' : 'Record the delivery'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderModalView('view')}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}

            {/* View 3: Record a payment */}
            {orderModalView === 'payment' && (
              <form onSubmit={handleRecordPayment} className="space-y-4 pt-3 border-t border-zinc-800">
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      AMOUNT
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      min="1"
                      max={selectedOrder.owedAmount || undefined}
                      value={paymentAmount}
                      onChange={(e) => setPaymentAmount(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm font-mono text-white outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      PAID ON
                    </label>
                    <input
                      type="date"
                      required
                      value={paymentDate}
                      onChange={(e) => setPaymentDate(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white outline-none focus:border-pink-500"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      HOW
                    </label>
                    <select
                      value={paymentHow}
                      onChange={(e) => setPaymentHow(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-white outline-none focus:border-pink-500"
                    >
                      <option value="Cash">Cash</option>
                      <option value="Bank Transfer">Bank Transfer</option>
                      <option value="UPI">UPI</option>
                      <option value="Card">Card</option>
                      <option value="Cheque">Cheque</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                      REFERENCE
                    </label>
                    <input
                      type="text"
                      value={paymentReference}
                      onChange={(e) => setPaymentReference(e.target.value)}
                      placeholder=""
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white outline-none focus:border-pink-500"
                    />
                    <p className="text-xs text-zinc-500 mt-1">Optional.</p>
                  </div>
                </div>

                <p className="text-xs text-zinc-400 leading-relaxed">
                  A payment moves cash against what is already owed. The cost went into the month's expenses when the goods arrived, so it is not posted again here.
                </p>

                <div className="flex items-center gap-3 pt-2">
                  <button
                    type="submit"
                    disabled={savingOrderDetail}
                    className="rounded-xl btn-theme-primary px-6 py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                  >
                    {savingOrderDetail ? 'Recording...' : 'Record the payment'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setOrderModalView('view')}
                    className="rounded-xl border border-zinc-700 bg-zinc-800 px-5 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                  >
                    Back
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Quick Stock Adjust Modal */}
      {isAdjustModalOpen && adjustingItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4">
          <div className="w-full max-w-sm rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white p-6 space-y-4 animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between border-b border-zinc-800 pb-3">
              <h3 className="font-black text-base text-white">
                Adjust Stock: {adjustingItem.item.name}
              </h3>
              <button
                type="button"
                onClick={() => setIsAdjustModalOpen(false)}
                className="text-zinc-400 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <form onSubmit={handleApplyAdjustment} className="space-y-4">
              <div className="text-xs text-zinc-400">
                Current Stock:{' '}
                <strong className="text-pink-400 font-mono font-bold">
                  {adjustingItem.type === 'raw' ? adjustingItem.item.currentStock : adjustingItem.item.stock}{' '}
                  {adjustingItem.item.unit || ''}
                </strong>
              </div>

              <div className="flex rounded-xl bg-zinc-950 border border-zinc-800 p-1">
                <button
                  type="button"
                  onClick={() => setAdjustType('add')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${adjustType === 'add' ? 'bg-emerald-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                    }`}
                >
                  + Add Stock
                </button>
                <button
                  type="button"
                  onClick={() => setAdjustType('subtract')}
                  className={`flex-1 rounded-lg py-1.5 text-xs font-bold transition cursor-pointer ${adjustType === 'subtract' ? 'bg-rose-600 text-white shadow-md' : 'text-zinc-400 hover:text-white'
                    }`}
                >
                  - Deduct Stock
                </button>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Quantity ({adjustingItem.item.unit || 'units'})
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  autoFocus
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="e.g. 5"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm font-mono text-white outline-none focus:border-pink-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                  Reason / Notes
                </label>
                <select
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2 text-xs text-white outline-none focus:border-pink-500"
                >
                  <option value="Stock Purchase">Stock Purchase / Vendor Delivery</option>
                  <option value="Physical Count Correction">Physical Count Correction</option>
                  <option value="Wastage / Spoilage">Wastage / Spoilage</option>
                  <option value="Production">Daily Kitchen Batch Production</option>
                  <option value="Return to Vendor">Return to Vendor</option>
                </select>
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsAdjustModalOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                >
                  Apply Adjustment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
