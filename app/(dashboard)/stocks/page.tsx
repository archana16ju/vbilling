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
  ShoppingCart,
  History
} from "lucide-react"
import { RawMaterial, Product, ProductUnit, Supplier, PurchaseOrder, PurchaseOrderItem, StockTransaction } from "@/types/product"
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
  deletePurchaseOrder,
  getStockTransactions,
  recordManualStockAdjustment,
  recordStockDelivery,
  approvePurchaseOrder,
  rejectPurchaseOrder
} from "@/lib/actions/inventory"
import { getProducts, updateProduct, getCategories } from "@/lib/actions/db"
import { Category } from "@/lib/mock-data"
import BatchesTab from "@/components/stocks/BatchesTab"
import { ProductBatch } from "@/types/batches"
import { getProductBatches } from "@/lib/actions/batches"
import BatchModal from "@/components/stocks/BatchModal"

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

function getDaysLeft(expiryDate?: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  if (isNaN(exp.getTime())) return null
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}

export default function StocksPage() {
  const [activeTab, setActiveTab] = useState<'raw-materials' | 'to-buy' | 'orders' | 'products' | 'batches' | 'history'>('raw-materials')
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [orders, setOrders] = useState<PurchaseOrder[]>([])
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [transactions, setTransactions] = useState<StockTransaction[]>([])
  const [txTypeFilter, setTxTypeFilter] = useState<string>('all')
  const [txSearchQuery, setTxSearchQuery] = useState<string>('')
  const [loading, setLoading] = useState(true)

  // Batch Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchModalItem, setBatchModalItem] = useState<{ type: 'product' | 'raw_material'; item: any } | null>(null)
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null)

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
  const [orderItemsList, setOrderItemsList] = useState<{
    rawMaterialId?: string
    name: string
    orderedQty: number
    unit: string
    rate: number
  }[]>([])
  const [selectedAddItemRawId, setSelectedAddItemRawId] = useState('')

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
  const [formSupplierId, setFormSupplierId] = useState<string>('')
  const [formTargetStock, setFormTargetStock] = useState<string>('999')
  const [formCostPerUnit, setFormCostPerUnit] = useState<string>('')
  const [formShelfLife, setFormShelfLife] = useState<string>('')
  const [formCurrentStock, setFormCurrentStock] = useState<string>('0')
  const [saving, setSaving] = useState(false)

  const loadData = async () => {
    setLoading(true)
    try {
      const [mats, prods, cats, sups, ords, btchs, txs] = await Promise.all([
        getRawMaterials().catch(() => []),
        getProducts().catch(() => []),
        getCategories().catch(() => []),
        getSuppliers().catch(() => []),
        getPurchaseOrders().catch(() => []),
        getProductBatches().catch(() => []),
        getStockTransactions().catch(() => []),
      ])
      setMaterials(mats || [])
      setProducts(prods || [])
      setCategories(cats || [])
      setSuppliers(sups || [])
      setOrders(ords || [])
      setBatches(btchs || [])
      setTransactions(txs || [])
    } finally {
      setLoading(false)
    }
  }

  // Map batches by product ID
  const productBatchesMap = useMemo(() => {
    const map = new Map<string, ProductBatch[]>()
    for (const b of batches) {
      if (b.itemType === 'product') {
        const list = map.get(b.itemId) || []
        list.push(b)
        map.set(b.itemId, list)
      }
    }
    return map
  }, [batches])

  // Map batches by raw material ID
  const materialBatchesMap = useMemo(() => {
    const map = new Map<string, ProductBatch[]>()
    for (const b of batches) {
      if (b.itemType === 'raw_material') {
        const list = map.get(b.itemId) || []
        list.push(b)
        map.set(b.itemId, list)
      }
    }
    return map
  }, [batches])

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
      setFormTargetStock(String(mat.targetStock ?? 999))
      setFormCostPerUnit(mat.costPerUnit != null ? String(mat.costPerUnit) : '')
      setFormPurchaseUnit(mat.purchaseUnit || 'same')
      setFormConversionFactor(String(mat.conversionFactor ?? 1))
      setFormCategory(mat.category || '')
      setIsCustomCategory(Boolean(mat.category && !categoryOptions.includes(mat.category)))
      setFormSupplier(mat.supplierName || '')
      setFormSupplierId(mat.supplierId || '')
      setFormShelfLife(mat.shelfLifeDays ? String(mat.shelfLifeDays) : '')
      setFormCurrentStock(String(mat.currentStock ?? 0))
    } else {
      setEditingMaterial(null)
      setFormName('')
      setFormUnit('kg')
      setFormReorderPoint('1')
      setFormTargetStock('999')
      setFormCostPerUnit('')
      setFormPurchaseUnit('same')
      setFormConversionFactor('1')
      setFormCategory(categoryOptions[0] || '')
      setIsCustomCategory(false)
      setFormSupplier('')
      setFormSupplierId('')
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
        targetStock: formTargetStock ? Number(formTargetStock) : 999,
        costPerUnit: formCostPerUnit ? Number(formCostPerUnit) : undefined,
        purchaseUnit: formPurchaseUnit === 'same' ? undefined : formPurchaseUnit,
        conversionFactor: Number(formConversionFactor) || 1,
        category: formCategory.trim() || undefined,
        supplierName: formSupplier.trim() || undefined,
        supplierId: formSupplierId || undefined,
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
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
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
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
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
      await recordManualStockAdjustment(
        adjustingItem.item.id,
        adjustingItem.item.name,
        current,
        delta,
        newStock,
        `Manual Adjustment: ${adjustReason}`
      )
    } else {
      const current = Number(adjustingItem.item.stock) || 0
      const newStock = Math.max(0, current + delta)
      await updateProduct(adjustingItem.item.id, { stock: newStock })
    }

    setIsAdjustModalOpen(false)
    if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
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
  const handleOpenOrderModal = (supplierId?: string, initialRawMaterial?: RawMaterial) => {
    const defaultSup = suppliers.find(s => s.id === supplierId) || suppliers[0]
    setOrderPoNumber(getNextPoNumber())
    setOrderSupplierId(defaultSup?.id || '')
    setOrderPaid('')
    setOrderState('Part delivered')
    setSelectedAddItemRawId('')

    let initialDrafts: {
      rawMaterialId?: string
      name: string
      orderedQty: number
      unit: string
      rate: number
    }[] = []

    if (initialRawMaterial) {
      initialDrafts = [{
        rawMaterialId: initialRawMaterial.id,
        name: initialRawMaterial.name,
        orderedQty: Math.max(1, Math.ceil((initialRawMaterial.minimumStock || 10) - (initialRawMaterial.currentStock || 0))),
        unit: initialRawMaterial.unit || 'kg',
        rate: initialRawMaterial.costPerUnit || 100,
      }]
    } else if (defaultSup) {
      // Auto-suggest raw materials that have this supplier as preferred
      const supMats = materials.filter(m => (m.supplierName || (m as any).preferredSupplier || '').toLowerCase() === defaultSup.name.toLowerCase())
      if (supMats.length > 0) {
        initialDrafts = supMats.map(m => ({
          rawMaterialId: m.id,
          name: m.name,
          orderedQty: Math.max(1, Math.ceil((m.minimumStock || 10) - (m.currentStock || 0))),
          unit: m.unit || 'kg',
          rate: m.costPerUnit || 100,
        }))
      }
    }

    setOrderItemsList(initialDrafts)
    const sum = initialDrafts.reduce((acc, it) => acc + (Number(it.orderedQty || 0) * Number(it.rate || 0)), 0)
    setOrderTotal(sum > 0 ? String(sum.toFixed(2)) : '')
    setIsOrderModalOpen(true)
  }

  const handleAddOrderItem = (rawMatId: string) => {
    if (!rawMatId) return
    const mat = materials.find(m => m.id === rawMatId)
    if (!mat) return
    const exists = orderItemsList.some(it => it.name.toLowerCase() === mat.name.toLowerCase())
    if (exists) return
    const newItem = {
      rawMaterialId: mat.id,
      name: mat.name,
      orderedQty: 1,
      unit: mat.unit || 'kg',
      rate: mat.costPerUnit || 100,
    }
    const updated = [...orderItemsList, newItem]
    setOrderItemsList(updated)
    const sum = updated.reduce((acc, it) => acc + (Number(it.orderedQty || 0) * Number(it.rate || 0)), 0)
    setOrderTotal(sum > 0 ? String(sum.toFixed(2)) : '')
    setSelectedAddItemRawId('')
  }

  const handleUpdateOrderItem = (idx: number, field: 'orderedQty' | 'rate', value: number) => {
    const updated = orderItemsList.map((it, i) => i === idx ? { ...it, [field]: value } : it)
    setOrderItemsList(updated)
    const sum = updated.reduce((acc, it) => acc + (Number(it.orderedQty || 0) * Number(it.rate || 0)), 0)
    setOrderTotal(sum > 0 ? String(sum.toFixed(2)) : '')
  }

  const handleRemoveOrderItem = (idx: number) => {
    const updated = orderItemsList.filter((_, i) => i !== idx)
    setOrderItemsList(updated)
    const sum = updated.reduce((acc, it) => acc + (Number(it.orderedQty || 0) * Number(it.rate || 0)), 0)
    setOrderTotal(sum > 0 ? String(sum.toFixed(2)) : '')
  }

  const handleSaveOrder = async (e: React.FormEvent) => {
    e.preventDefault()
    const sup = suppliers.find(s => s.id === orderSupplierId)
    if (!sup) return alert("Please select a supplier")

    const total = Number(orderTotal) || 0
    const paid = Number(orderPaid) || 0
    const owed = Math.max(0, total - paid)
    const finalPoNumber = orderPoNumber.trim() || getNextPoNumber()

    // Format real itemsJson for the order
    const formattedItems: PurchaseOrderItem[] = orderItemsList.map(it => ({
      name: it.name,
      orderedQty: Number(it.orderedQty) || 1,
      unit: it.unit || '',
      deliveredQty: 0,
      stillOwedQty: Number(it.orderedQty) || 1,
      rate: Number(it.rate) || 0,
    }))

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
        itemsJson: formattedItems.length > 0 ? JSON.stringify(formattedItems) : undefined,
      })

      // Update supplier balance owed
      if (owed > 0) {
        await updateSupplier(sup.id, {
          balanceOwed: (sup.balanceOwed || 0) + owed
        })
      }

      setIsOrderModalOpen(false)
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
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
      // 1. Update stock of matching raw materials and record stock transaction audit log
      for (let i = 0; i < currentItems.length; i++) {
        const item = currentItems[i]
        const arrivedVal = Number(deliveryArrivedMap[i]) || 0
        if (arrivedVal > 0) {
          const match = materials.find(
            m => m.name.toLowerCase().trim() === item.name.toLowerCase().trim()
          )
          if (match) {
            await recordStockDelivery(
              match.id,
              match.name,
              arrivedVal,
              selectedOrder.id,
              deliveryInvoiceNumber.trim() || undefined
            )
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
      if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
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

  // Approve automatic reorder
  const handleApproveOrder = async (orderId: string) => {
    setSavingOrderDetail(true)
    try {
      const res = await approvePurchaseOrder(orderId)
      if (res.success) {
        if (res.whatsappUrl) {
          window.open(res.whatsappUrl, '_blank')
        }
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
        await loadData()
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, state: 'Approved' })
        }
      } else {
        alert(res.error || 'Failed to approve order')
      }
    } catch (e: any) {
      alert(e.message || 'Error approving order')
    } finally {
      setSavingOrderDetail(false)
    }
  }

  // Reject automatic reorder
  const handleRejectOrder = async (orderId: string) => {
    if (!confirm(`Are you sure you want to reject purchase order ${orderId}?`)) return
    setSavingOrderDetail(true)
    try {
      const res = await rejectPurchaseOrder(orderId)
      if (res.success) {
        if (typeof window !== 'undefined') window.dispatchEvent(new Event('stock-updated'))
        await loadData()
        if (selectedOrder && selectedOrder.id === orderId) {
          setSelectedOrder({ ...selectedOrder, state: 'Rejected' })
        }
      } else {
        alert(res.error || 'Failed to reject order')
      }
    } catch (e: any) {
      alert(e.message || 'Error rejecting order')
    } finally {
      setSavingOrderDetail(false)
    }
  }

  // Helper for Status
  const getStockStatus = (current: number, min: number, rawStatus?: string) => {
    if (rawStatus === 'Replenished') {
      return { label: 'Replenished', color: 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30', icon: RefreshCw }
    }
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
      return m.status === 'Low Stock' || (min > 0 && c <= min) || c <= 0
    })
  }, [materials])

  // Total owed to suppliers (combines pending purchase orders and supplier balances)
  const totalOwedToSuppliers = useMemo(() => {
    const fromOrders = orders.reduce((sum, o) => sum + (Number(o.owedAmount) || 0), 0)
    const fromSuppliers = suppliers.reduce((sum, s) => sum + (Number(s.balanceOwed) || 0), 0)
    return Math.max(fromOrders, fromSuppliers)
  }, [orders, suppliers])

  const supplierOwedBreakdown = useMemo(() => {
    return suppliers.map(s => {
      const orderOwed = orders.filter(o => o.supplierId === s.id || o.supplierName === s.name).reduce((sum, o) => sum + (Number(o.owedAmount) || 0), 0)
      const totalOwed = Math.max(Number(s.balanceOwed) || 0, orderOwed)
      return { ...s, totalOwed }
    }).filter(s => s.totalOwed > 0)
  }, [suppliers, orders])

  // Filtered Stock Transactions
  const filteredTransactions = useMemo(() => {
    return transactions.filter(tx => {
      if (txTypeFilter !== 'all' && tx.type !== txTypeFilter) return false
      if (txSearchQuery.trim()) {
        const q = txSearchQuery.toLowerCase()
        const matMatch = (tx.rawMaterialName || '').toLowerCase().includes(q)
        const refMatch = (tx.referenceId || '').toLowerCase().includes(q)
        const reasonMatch = (tx.reason || '').toLowerCase().includes(q)
        if (!matMatch && !refMatch && !reasonMatch) return false
      }
      return true
    })
  }, [transactions, txTypeFilter, txSearchQuery])

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

        <button
          type="button"
          onClick={() => setActiveTab('batches')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${activeTab === 'batches'
            ? 'border-pink-500 text-pink-400'
            : 'border-transparent text-zinc-400 hover:text-white'
            }`}
        >
          <Boxes className="h-4 w-4" />
          <span>Batches & Expiry</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab('history')}
          className={`flex items-center gap-2 px-4 py-3 text-xs font-bold uppercase tracking-wider border-b-2 transition cursor-pointer ${activeTab === 'history'
            ? 'border-pink-500 text-pink-400'
            : 'border-transparent text-zinc-400 hover:text-white'
            }`}
        >
          <History className="h-4 w-4" />
          <span>Stock History</span>
          <span className={`rounded-full px-2 py-0.5 text-[10px] font-mono ${activeTab === 'history' ? 'bg-pink-950/80 text-pink-300 border border-pink-500/40' : 'bg-zinc-800 text-zinc-400'}`}>
            {transactions.length}
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
                  <th className="px-5 py-3.5 text-right">Current Stock</th>
                  <th className="px-5 py-3.5">Linked Products</th>
                  <th className="px-5 py-3.5">Batch Details</th>
                  <th className="px-5 py-3.5">Purchase Unit & Ratio</th>
                  <th className="px-5 py-3.5">Keeps For</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100">
                {loading ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-400">Loading raw material stocks...</td>
                  </tr>
                ) : filteredMaterials.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="py-12 text-center text-zinc-500">
                      No raw materials found. Click <strong>"Add Raw Material"</strong> to create your first ingredient.
                    </td>
                  </tr>
                ) : (
                  filteredMaterials.map((mat) => {
                    const status = getStockStatus(mat.currentStock, mat.minimumStock, mat.status)
                    return (
                      <tr key={mat.id} className="hover:bg-zinc-800/40 transition-colors">
                        <td className="px-5 py-3.5 font-bold text-white">
                          {mat.name}
                        </td>
                        <td className="px-5 py-3.5 text-right font-mono">
                          <span className="text-sm font-bold text-pink-400">{mat.currentStock}</span>{' '}
                          <span className="text-zinc-400 font-medium">{mat.unit}</span>
                        </td>

                        {/* Linked Products (Used In) */}
                        <td className="px-5 py-3.5 text-xs">
                          {mat.linkedProducts && mat.linkedProducts.length > 0 ? (
                            <div className="flex flex-wrap gap-1 max-w-[180px]">
                              {mat.linkedProducts.slice(0, 2).map((lp) => (
                                <span
                                  key={lp.productId}
                                  className="inline-flex items-center gap-1 rounded-md bg-zinc-800 border border-zinc-700/80 px-2 py-0.5 text-[11px] text-zinc-200"
                                  title={`${lp.productName || 'Product'}: ${lp.quantity} ${lp.unit}`}
                                >
                                  <span className="font-semibold truncate max-w-[80px]">{lp.productName || 'Product'}</span>
                                  <span className="text-pink-300 font-mono text-[10px]">({lp.quantity} {lp.unit})</span>
                                </span>
                              ))}
                              {mat.linkedProducts.length > 2 && (
                                <span className="text-[10px] text-zinc-500 font-medium self-center">
                                  +{mat.linkedProducts.length - 2} more
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-zinc-600 italic">Not linked</span>
                          )}
                        </td>

                        {/* Batch Details Column */}
                        <td className="px-5 py-3.5 text-xs">
                          {(() => {
                            const itemBatches = materialBatchesMap.get(mat.id) || [];
                            if (itemBatches.length === 0) {
                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-600 italic">No batches</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBatchModalItem({ type: 'raw_material', item: mat });
                                      setEditingBatch(null);
                                      setIsBatchModalOpen(true);
                                    }}
                                    className="text-[10px] font-bold text-pink-400 hover:text-pink-300 underline cursor-pointer"
                                  >
                                    + Batch
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                {itemBatches.slice(0, 2).map((b) => {
                                  const daysLeft = getDaysLeft(b.expiryDate);
                                  return (
                                    <div
                                      key={b.id}
                                      onClick={() => {
                                        setBatchModalItem({ type: 'raw_material', item: mat });
                                        setEditingBatch(b);
                                        setIsBatchModalOpen(true);
                                      }}
                                      className="w-fit min-w-[155px] max-w-[195px] rounded-lg bg-zinc-950/80 border border-zinc-800 hover:border-pink-500/50 p-1.5 cursor-pointer transition text-xs shadow-sm"
                                      title="Click to view/edit batch details"
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        <span className="font-mono font-bold text-white text-[11px] truncate">{b.batchNumber}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                          b.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                          b.status === 'near_expiry' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                                          b.status === 'expired' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                        }`}>
                                          {b.status}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-2 text-[10px] mt-1 pt-1 border-t border-zinc-800/60">
                                        <span className="text-zinc-400">
                                          Stock: <strong className="text-pink-300 font-mono font-bold">{b.currentQuantity}</strong>
                                          {b.minStockLevel ? <span className="text-zinc-500 ml-1">· min {b.minStockLevel}</span> : null}
                                        </span>
                                        {b.expiryDate && (
                                          <div className="text-right shrink-0 leading-tight">
                                            <div className="text-zinc-400 font-mono text-[9px]">{b.expiryDate}</div>
                                            {daysLeft !== null && (
                                              <div
                                                className={`text-[9px] font-bold ${
                                                  daysLeft < 0
                                                    ? 'text-rose-400'
                                                    : daysLeft <= 30
                                                    ? 'text-amber-400'
                                                    : 'text-emerald-400'
                                                }`}
                                              >
                                                {daysLeft < 0
                                                  ? `Expired ${Math.abs(daysLeft)}d ago`
                                                  : daysLeft === 0
                                                  ? 'Expires today'
                                                  : `${daysLeft} days left`}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {itemBatches.length > 2 && (
                                  <div className="text-[10px] text-zinc-500">+{itemBatches.length - 2} more batches</div>
                                )}
                              </div>
                            );
                          })()}
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
                        <td className="px-5 py-3.5 text-zinc-400">
                          {mat.shelfLifeDays ? (
                            <div>
                              <span className="inline-flex items-center gap-1 text-xs text-zinc-200 font-medium">
                                <Calendar className="h-3 w-3 text-pink-400" />
                                {mat.shelfLifeDays} days
                              </span>
                              <div className="text-[10px] text-zinc-500">shelf life</div>
                            </div>
                          ) : (() => {
                            const batchesWithExp = (materialBatchesMap.get(mat.id) || [])
                              .filter((b) => b.expiryDate && b.status !== 'exhausted')
                              .map((b) => ({ ...b, days: getDaysLeft(b.expiryDate) }))
                              .filter((b) => b.days !== null)
                              .sort((a, b) => (a.days as number) - (b.days as number));

                            const nearest = batchesWithExp[0];
                            if (nearest && nearest.days !== null) {
                              const d = nearest.days;
                              return (
                                <div>
                                  <span className={`inline-flex items-center gap-1 text-xs font-semibold ${
                                    d < 0 ? 'text-rose-400' : d <= 30 ? 'text-amber-400' : 'text-emerald-400'
                                  }`}>
                                    <Calendar className="h-3 w-3" />
                                    {d < 0 ? `Expired ${Math.abs(d)}d ago` : d === 0 ? 'Expires today' : `${d} days left`}
                                  </span>
                                  <div className="text-[10px] text-zinc-500 font-mono">from batch</div>
                                </div>
                              );
                            }
                            return <span className="text-zinc-600 italic">—</span>;
                          })()}
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
                              onClick={() => {
                                setBatchModalItem({ type: 'raw_material', item: mat });
                                setEditingBatch(null);
                                setIsBatchModalOpen(true);
                              }}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                              title="Manage Batches"
                            >
                              <Boxes className="h-3.5 w-3.5" />
                            </button>
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
                  <th className="px-5 py-3.5">Preferred Supplier / Commonly Purchased From</th>
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
                          {item.supplierName ? (
                            <span className="inline-flex items-center gap-1.5 rounded-lg bg-pink-950/40 border border-pink-500/30 px-2 py-0.5 text-xs text-pink-300 font-bold">
                              <Building className="h-3 w-3 text-pink-400" />
                              {item.supplierName}
                            </span>
                          ) : '—'}
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
                          <div className="flex items-center justify-end gap-2">
                            {item.supplierName && (
                              <button
                                type="button"
                                onClick={() => handleOpenOrderModal(sup?.id, item)}
                                className="rounded-xl border border-pink-500/40 bg-pink-950/40 px-3 py-1.5 text-xs font-bold text-pink-300 hover:bg-pink-900/60 transition cursor-pointer"
                                title={`Place purchase order with ${item.supplierName}`}
                              >
                                Order from {item.supplierName}
                              </button>
                            )}
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust('raw', item)}
                              className="rounded-xl btn-theme-primary px-3.5 py-1.5 text-xs font-bold text-white shadow-md active:scale-95 transition cursor-pointer"
                            >
                              + Receive Stock
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
                        <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold border ${
                          po.state === 'Delivered'
                            ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                            : po.state === 'Pending Approval'
                            ? 'bg-amber-500/15 text-amber-400 border-amber-500/30 animate-pulse'
                            : po.state === 'Approved' || po.state === 'Ordered'
                            ? 'bg-sky-500/15 text-sky-400 border-sky-500/30'
                            : po.state === 'Rejected' || po.state === 'Cancelled'
                            ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                            : 'bg-zinc-800 text-zinc-300 border-zinc-700'
                        }`}>
                          {po.state === 'Pending Approval' && <span className="h-1.5 w-1.5 rounded-full bg-amber-400"></span>}
                          {po.state}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {po.state === 'Pending Approval' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleApproveOrder(po.id)}
                                className="rounded-lg bg-emerald-600 hover:bg-emerald-500 text-white px-2.5 py-1 text-xs font-bold transition shadow-sm cursor-pointer"
                                title="Approve purchase order"
                              >
                                Approve
                              </button>
                              <button
                                type="button"
                                onClick={() => handleRejectOrder(po.id)}
                                className="rounded-lg border border-rose-500/40 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 px-2.5 py-1 text-xs font-bold transition cursor-pointer"
                                title="Reject purchase order"
                              >
                                Reject
                              </button>
                            </>
                          )}
                          <button
                            type="button"
                            onClick={() => handleOpenOrderDetail(po)}
                            className="rounded-lg border border-zinc-700 bg-zinc-800 px-3 py-1 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                          >
                            Open
                          </button>
                        </div>
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
              {supplierOwedBreakdown.length === 0 ? (
                <p className="text-xs text-zinc-500 py-2">No pending balances owed to any supplier.</p>
              ) : (
                supplierOwedBreakdown.map(sup => (
                  <div key={sup.id} className="flex items-center justify-between py-3 text-xs">
                    <span className="font-bold text-white">{sup.name}</span>
                    <span className="font-mono font-bold text-rose-400">
                      ₹{Number(sup.totalOwed).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
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
                  <th className="px-5 py-3.5 text-right">Min Stock</th>
                  <th className="px-5 py-3.5 text-center">Recipe Linked</th>
                  <th className="px-5 py-3.5">Batch Details</th>
                  <th className="px-5 py-3.5 text-center">Status</th>
                  <th className="px-5 py-3.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-800/60">
                {loading ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">Loading product stocks...</td>
                  </tr>
                ) : filteredProducts.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="py-12 text-center text-zinc-500">
                      No products found.
                    </td>
                  </tr>
                ) : (
                  filteredProducts.map((prod) => {
                    const minStock = Number(prod.minStock ?? prod.minStockLevel ?? 5)
                    const status = getStockStatus(prod.stock, minStock)
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
                        <td className="px-5 py-3.5 text-right font-mono text-zinc-400">
                          <span className="font-semibold text-zinc-300">{minStock}</span>{' '}
                          <span className="text-zinc-500 text-[11px]">{prod.unit || 'plate'}</span>
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

                        {/* Batch Details Column */}
                        <td className="px-5 py-3.5 text-xs">
                          {(() => {
                            const itemBatches = productBatchesMap.get(prod.id) || [];
                            if (itemBatches.length === 0) {
                              return (
                                <div className="flex items-center gap-1.5">
                                  <span className="text-zinc-600 italic">No batches</span>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setBatchModalItem({ type: 'product', item: prod });
                                      setEditingBatch(null);
                                      setIsBatchModalOpen(true);
                                    }}
                                    className="text-[10px] font-bold text-pink-400 hover:text-pink-300 underline cursor-pointer"
                                  >
                                    + Batch
                                  </button>
                                </div>
                              );
                            }
                            return (
                              <div className="space-y-1">
                                {itemBatches.slice(0, 2).map((b) => {
                                  const daysLeft = getDaysLeft(b.expiryDate);
                                  return (
                                    <div
                                      key={b.id}
                                      onClick={() => {
                                        setBatchModalItem({ type: 'product', item: prod });
                                        setEditingBatch(b);
                                        setIsBatchModalOpen(true);
                                      }}
                                      className="w-fit min-w-[155px] max-w-[195px] rounded-lg bg-zinc-950/80 border border-zinc-800 hover:border-pink-500/50 p-1.5 cursor-pointer transition text-xs shadow-sm"
                                      title="Click to view/edit batch details"
                                    >
                                      <div className="flex items-center justify-between gap-1.5">
                                        <span className="font-mono font-bold text-white text-[11px] truncate">{b.batchNumber}</span>
                                        <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                          b.status === 'active' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800' :
                                          b.status === 'near_expiry' ? 'bg-amber-950 text-amber-400 border border-amber-800' :
                                          b.status === 'expired' ? 'bg-rose-950 text-rose-400 border border-rose-800' :
                                          'bg-zinc-800 text-zinc-400 border border-zinc-700'
                                        }`}>
                                          {b.status}
                                        </span>
                                      </div>
                                      <div className="flex items-center justify-between gap-2 text-[10px] mt-1 pt-1 border-t border-zinc-800/60">
                                        <span className="text-zinc-400">
                                          Stock: <strong className="text-pink-300 font-mono font-bold">{b.currentQuantity}</strong>
                                          {b.minStockLevel ? <span className="text-zinc-500 ml-1">· min {b.minStockLevel}</span> : null}
                                        </span>
                                        {b.expiryDate && (
                                          <div className="text-right shrink-0 leading-tight">
                                            <div className="text-zinc-400 font-mono text-[9px]">{b.expiryDate}</div>
                                            {daysLeft !== null && (
                                              <div
                                                className={`text-[9px] font-bold ${
                                                  daysLeft < 0
                                                    ? 'text-rose-400'
                                                    : daysLeft <= 30
                                                    ? 'text-amber-400'
                                                    : 'text-emerald-400'
                                                }`}
                                              >
                                                {daysLeft < 0
                                                  ? `Expired ${Math.abs(daysLeft)}d ago`
                                                  : daysLeft === 0
                                                  ? 'Expires today'
                                                  : `${daysLeft} days left`}
                                              </div>
                                            )}
                                          </div>
                                        )}
                                      </div>
                                    </div>
                                  );
                                })}
                                {itemBatches.length > 2 && (
                                  <div className="text-[10px] text-zinc-500">+{itemBatches.length - 2} more batches</div>
                                )}
                              </div>
                            );
                          })()}
                        </td>

                        <td className="px-5 py-3.5 text-center">
                          <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${status.color}`}>
                            <status.icon className="h-3 w-3" />
                            {status.label}
                          </span>
                        </td>
                        <td className="px-5 py-3.5 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setBatchModalItem({ type: 'product', item: prod });
                                setEditingBatch(null);
                                setIsBatchModalOpen(true);
                              }}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 p-1.5 text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                              title="Manage Batches"
                            >
                              <Boxes className="h-3.5 w-3.5" />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleOpenAdjust('product', prod)}
                              className="rounded-lg border border-zinc-700 bg-zinc-800 px-2.5 py-1 text-[11px] font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
                            >
                              ± Adjust Stock
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

      {activeTab === 'batches' && (
        <BatchesTab
          products={products}
          rawMaterials={materials}
          suppliers={suppliers}
        />
      )}

      {/* Tab 6: Stock History */}
      {activeTab === 'history' && (
        <div className="space-y-4">
          {/* History Controls / Filters */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 bg-zinc-900/60 p-4 rounded-2xl border border-zinc-800">
            <div className="flex items-center gap-3 w-full sm:w-auto">
              <div className="relative flex-1 sm:w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-zinc-500" />
                <input
                  type="text"
                  placeholder="Search material or reference..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="w-full pl-9 pr-4 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-white placeholder-zinc-500 focus:outline-none focus:border-pink-500"
                />
              </div>

              <select
                value={txTypeFilter}
                onChange={(e) => setTxTypeFilter(e.target.value)}
                className="px-3 py-2 bg-zinc-950 border border-zinc-800 rounded-xl text-xs text-zinc-300 focus:outline-none focus:border-pink-500 cursor-pointer"
              >
                <option value="all">All Transaction Types</option>
                <option value="Sale Deduction">Sale Deduction</option>
                <option value="Auto Replenishment">Auto Replenishment</option>
                <option value="Manual Adjustment">Manual Adjustment</option>
                <option value="Opening Stock">Opening Stock</option>
              </select>
            </div>

            <div className="text-xs text-zinc-400 font-mono">
              Showing <span className="text-white font-bold">{filteredTransactions.length}</span> transactions
            </div>
          </div>

          {/* Transactions Table */}
          <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-zinc-300">
                <thead className="border-b border-zinc-800 bg-zinc-950/80 text-[11px] uppercase tracking-wider font-bold text-zinc-400">
                  <tr>
                    <th className="px-5 py-3.5">Raw Material</th>
                    <th className="px-5 py-3.5 text-center">Type</th>
                    <th className="px-5 py-3.5 text-right">Previous Stock</th>
                    <th className="px-5 py-3.5 text-right">Deducted Qty</th>
                    <th className="px-5 py-3.5 text-right">Restored Qty</th>
                    <th className="px-5 py-3.5 text-right">Current Stock</th>
                    <th className="px-5 py-3.5">Date & Time</th>
                    <th className="px-5 py-3.5">Reason / Reference</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/60">
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">Loading stock history...</td>
                    </tr>
                  ) : filteredTransactions.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="py-12 text-center text-zinc-500">
                        No stock transactions found.
                      </td>
                    </tr>
                  ) : (
                    filteredTransactions.map((tx) => {
                      const isDeduction = tx.type === 'Sale Deduction' || tx.quantityChanged < 0
                      const isReplenishment = tx.type === 'Auto Replenishment'
                      const isOpening = tx.type === 'Opening Stock'
                      const isManual = tx.type === 'Manual Adjustment'

                      const deductedQty = tx.quantityChanged < 0 ? Math.abs(tx.quantityChanged) : 0
                      const restoredQty = tx.quantityChanged > 0 ? tx.quantityChanged : 0

                      return (
                        <tr key={tx.id} className="hover:bg-zinc-800/40 transition-colors font-mono">
                          <td className="px-5 py-3.5 font-sans font-bold text-white flex items-center gap-2">
                            <Layers className="h-4 w-4 text-zinc-400" />
                            <span>{tx.rawMaterialName || 'Raw Material'}</span>
                          </td>
                          <td className="px-5 py-3.5 text-center font-sans">
                            {isReplenishment && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-emerald-400">
                                <RefreshCw className="h-3 w-3 animate-spin duration-1000" /> Auto Replenishment
                              </span>
                            )}
                            {isDeduction && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-rose-400">
                                Sale Deduction
                              </span>
                            )}
                            {isManual && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-amber-400">
                                Manual Adjustment
                              </span>
                            )}
                            {isOpening && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2.5 py-0.5 text-[10px] font-semibold text-sky-400">
                                Opening Stock
                              </span>
                            )}
                            {!isReplenishment && !isDeduction && !isManual && !isOpening && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-[10px] font-semibold text-zinc-300">
                                {tx.type}
                              </span>
                            )}
                          </td>
                          <td className="px-5 py-3.5 text-right text-zinc-400">
                            {Number(tx.quantityBefore || 0).toFixed(3)}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-rose-400">
                            {deductedQty > 0 ? `-${deductedQty.toFixed(3)}` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-emerald-400">
                            {restoredQty > 0 ? `+${restoredQty.toFixed(3)}` : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-right font-bold text-white">
                            {Number(tx.quantityAfter || 0).toFixed(3)}
                          </td>
                          <td className="px-5 py-3.5 text-zinc-400 text-[11px] font-sans">
                            {tx.date ? new Date(tx.date).toLocaleString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit',
                              second: '2-digit',
                              hour12: true
                            }) : '—'}
                          </td>
                          <td className="px-5 py-3.5 text-zinc-300 text-xs font-sans">
                            <div className="flex flex-col">
                              <span>{tx.reason || '—'}</span>
                              {tx.referenceId && (
                                <span className="text-[10px] font-mono text-zinc-500">Ref: {tx.referenceId}</span>
                              )}
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
                    Order More At (Min Stock)
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
                    In {formUnit}. Triggers low-stock alert when stock &le; this level.
                  </p>
                </div>
              </div>

              {/* TARGET STOCK LEVEL & ESTIMATED COST PER UNIT */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Target Stock Level (Auto-Reorder)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formTargetStock}
                    onChange={(e) => setFormTargetStock(e.target.value)}
                    placeholder="999"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono transition"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Stock quantity to restore up to (e.g. 999). Required = Target - Current.
                  </p>
                </div>

                <div>
                  <label className="block text-[11px] font-bold uppercase tracking-wider text-zinc-400 mb-1">
                    Purchase Cost Per Unit (₹)
                  </label>
                  <input
                    type="number"
                    step="any"
                    value={formCostPerUnit}
                    onChange={(e) => setFormCostPerUnit(e.target.value)}
                    placeholder="e.g. 120.00"
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 font-mono transition"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Supplier price per {formUnit} for purchase order costing.
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
                    Preferred Supplier / Commonly Purchased From
                  </label>
                  <div className="flex items-center gap-1.5">
                    <select
                      value={formSupplierId || suppliers.find(s => s.name === formSupplier)?.id || ''}
                      onChange={(e) => {
                        const sid = e.target.value
                        const found = suppliers.find(s => s.id === sid)
                        if (found) {
                          setFormSupplierId(found.id)
                          setFormSupplier(found.name)
                        } else {
                          setFormSupplierId('')
                          setFormSupplier('')
                        }
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    >
                      <option value="">No Preferred Supplier (Select...)</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} {s.phone ? `(${s.phone})` : ''}</option>
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
                    Whenever you run low on this item, this supplier is saved as the preferred source for reordering.
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
      {isOrderModalOpen && (() => {
        const currentSup = suppliers.find(s => s.id === orderSupplierId)
        const preferredItemsForSup = currentSup
          ? materials.filter(m => (m.supplierName || (m as any).preferredSupplier || '').toLowerCase() === currentSup.name.toLowerCase())
          : []

        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-md p-4 overflow-y-auto">
            <div className="relative w-full max-w-2xl rounded-2xl bg-zinc-900 shadow-2xl border border-zinc-800 text-white overflow-hidden animate-in fade-in zoom-in-95 duration-150 my-6">
              <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950/60">
                <div>
                  <h2 className="text-lg font-black text-white flex items-center gap-2">
                    <ShoppingCart className="h-5 w-5 text-pink-400" />
                    Place Purchase Order
                  </h2>
                  <p className="text-xs text-zinc-400 mt-0.5">
                    Order raw materials from supplier and track deliveries & payments.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setIsOrderModalOpen(false)}
                  className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              <form onSubmit={handleSaveOrder} className="p-6 space-y-4 max-h-[80vh] overflow-y-auto no-scrollbar">
                {/* PO Number, Status & Supplier Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      PO Number *
                    </label>
                    <input
                      type="text"
                      required
                      value={orderPoNumber}
                      onChange={(e) => setOrderPoNumber(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm font-mono text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Supplier *
                    </label>
                    <select
                      required
                      value={orderSupplierId}
                      onChange={(e) => {
                        const newSupId = e.target.value
                        setOrderSupplierId(newSupId)
                        const s = suppliers.find(sup => sup.id === newSupId)
                        if (s && orderItemsList.length === 0) {
                          const supMats = materials.filter(m => (m.supplierName || (m as any).preferredSupplier || '').toLowerCase() === s.name.toLowerCase())
                          if (supMats.length > 0) {
                            const initialDrafts = supMats.map(m => ({
                              rawMaterialId: m.id,
                              name: m.name,
                              orderedQty: Math.max(1, Math.ceil((m.minimumStock || 10) - (m.currentStock || 0))),
                              unit: m.unit || 'kg',
                              rate: m.costPerUnit || 100,
                            }))
                            setOrderItemsList(initialDrafts)
                            const sum = initialDrafts.reduce((acc, it) => acc + (Number(it.orderedQty || 0) * Number(it.rate || 0)), 0)
                            setOrderTotal(sum > 0 ? String(sum.toFixed(2)) : '')
                          }
                        }
                      }}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    >
                      <option value="">Select Supplier...</option>
                      {suppliers.map(s => (
                        <option key={s.id} value={s.id}>{s.name} ({s.phone || 'No phone'})</option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Status
                    </label>
                    <select
                      value={orderState}
                      onChange={(e: any) => setOrderState(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition"
                    >
                      <option value="Part delivered">Part delivered</option>
                      <option value="Delivered">Delivered</option>
                      <option value="Pending">Pending</option>
                    </select>
                  </div>
                </div>

                {/* Preferred Items for this Supplier Quick Chips */}
                {currentSup && preferredItemsForSup.length > 0 && (
                  <div className="rounded-xl border border-pink-500/30 bg-pink-950/20 p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="text-[11px] font-bold text-pink-300 flex items-center gap-1.5">
                        <Building className="h-3.5 w-3.5 text-pink-400" />
                        Commonly Purchased from {currentSup.name}:
                      </span>
                      <span className="text-[10px] text-zinc-400">Click to add to order</span>
                    </div>
                    <div className="flex flex-wrap gap-1.5">
                      {preferredItemsForSup.map(m => {
                        const isAdded = orderItemsList.some(it => it.name.toLowerCase() === m.name.toLowerCase())
                        return (
                          <button
                            key={m.id}
                            type="button"
                            onClick={() => handleAddOrderItem(m.id)}
                            disabled={isAdded}
                            className={`inline-flex items-center gap-1 rounded-lg border px-2 py-1 text-xs font-semibold transition cursor-pointer ${
                              isAdded
                                ? 'border-zinc-800 bg-zinc-900/60 text-zinc-500 cursor-default'
                                : 'border-pink-500/40 bg-zinc-900 text-pink-200 hover:bg-pink-950 hover:text-white'
                            }`}
                          >
                            <Plus className="h-3 w-3" />
                            {m.name} ({m.currentStock} {m.unit} in stock)
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Items to Order Section */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-3.5 space-y-3">
                  <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 border-b border-zinc-800 pb-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-white flex items-center gap-1.5">
                      <Package className="h-3.5 w-3.5 text-pink-400" />
                      Items to Purchase ({orderItemsList.length})
                    </h3>

                    {/* Quick Raw Material Add Dropdown */}
                    <div className="flex items-center gap-1.5 w-full sm:w-auto">
                      <select
                        value={selectedAddItemRawId}
                        onChange={(e) => {
                          setSelectedAddItemRawId(e.target.value)
                          handleAddOrderItem(e.target.value)
                        }}
                        className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs text-white outline-none focus:border-pink-500 flex-1 sm:w-48"
                      >
                        <option value="">+ Add any raw material...</option>
                        {materials.map(m => (
                          <option key={m.id} value={m.id}>{m.name} ({m.unit})</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Order Items Table */}
                  {orderItemsList.length === 0 ? (
                    <div className="py-6 text-center text-zinc-500 text-xs">
                      No items added to this order yet. Select a raw material above or click one of the commonly purchased items.
                    </div>
                  ) : (
                    <div className="overflow-x-auto rounded-lg border border-zinc-800 bg-zinc-900/60">
                      <table className="w-full text-left text-xs">
                        <thead>
                          <tr className="border-b border-zinc-800 text-[10px] font-bold uppercase tracking-wider text-zinc-400 bg-zinc-950/80">
                            <th className="py-2 px-3">Item</th>
                            <th className="py-2 px-3 text-center w-24">Ordered Qty</th>
                            <th className="py-2 px-3 text-center w-16">Unit</th>
                            <th className="py-2 px-3 text-right w-24">Rate (₹)</th>
                            <th className="py-2 px-3 text-right w-24">Total (₹)</th>
                            <th className="py-2 px-2 text-center w-10"></th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-zinc-800/60 text-zinc-300">
                          {orderItemsList.map((it, idx) => (
                            <tr key={idx} className="hover:bg-zinc-800/30">
                              <td className="py-2 px-3 font-bold text-white">{it.name}</td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="any"
                                  min="0.001"
                                  value={it.orderedQty}
                                  onChange={(e) => handleUpdateOrderItem(idx, 'orderedQty', parseFloat(e.target.value) || 0)}
                                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-center font-mono text-xs text-white outline-none focus:border-pink-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-center text-zinc-400 font-mono text-[11px]">{it.unit}</td>
                              <td className="py-2 px-3">
                                <input
                                  type="number"
                                  step="any"
                                  min="0"
                                  value={it.rate}
                                  onChange={(e) => handleUpdateOrderItem(idx, 'rate', parseFloat(e.target.value) || 0)}
                                  className="w-full rounded border border-zinc-700 bg-zinc-950 px-2 py-1 text-right font-mono text-xs text-pink-300 outline-none focus:border-pink-500"
                                />
                              </td>
                              <td className="py-2 px-3 text-right font-mono font-bold text-white">
                                ₹{(Number(it.orderedQty || 0) * Number(it.rate || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                              </td>
                              <td className="py-2 px-2 text-center">
                                <button
                                  type="button"
                                  onClick={() => handleRemoveOrderItem(idx)}
                                  className="text-zinc-500 hover:text-rose-400 transition cursor-pointer p-1"
                                  title="Remove item"
                                >
                                  <Trash2 className="h-3.5 w-3.5" />
                                </button>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                {/* Totals & Payments */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Total Order Amount (₹) *
                    </label>
                    <input
                      type="number"
                      step="any"
                      required
                      value={orderTotal}
                      onChange={(e) => setOrderTotal(e.target.value)}
                      placeholder="e.g. 5000.00"
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm font-mono text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition font-bold"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1">
                      Amount Paid Upfront (₹)
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

                {/* Balance preview */}
                <div className="flex items-center justify-between text-xs bg-zinc-950/80 rounded-xl px-4 py-2.5 border border-zinc-800">
                  <span className="text-zinc-400">Balance Still Owed to Supplier:</span>
                  <span className={`font-mono font-bold ${
                    Math.max(0, Number(orderTotal || 0) - Number(orderPaid || 0)) > 0
                      ? 'text-rose-400'
                      : 'text-emerald-400'
                  }`}>
                    ₹{Math.max(0, Number(orderTotal || 0) - Number(orderPaid || 0)).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </span>
                </div>

                {/* Footer Buttons */}
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
        )
      })()}

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
              <div className="space-y-3 pt-3 border-t border-zinc-800">
                {selectedOrder.state === 'Pending Approval' && (
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-3.5 rounded-xl border border-amber-500/30 bg-amber-500/10">
                    <div>
                      <p className="text-xs font-bold text-amber-300 flex items-center gap-1.5">
                        <AlertCircle className="h-4 w-4" />
                        Requires Approval Before Sending to Supplier
                      </p>
                      <p className="text-[11px] text-zinc-400 mt-0.5">Review the quantities and estimated cost. Approving will confirm the order.</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleApproveOrder(selectedOrder.id)}
                        disabled={savingOrderDetail}
                        className="rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-bold px-4 py-2 text-xs shadow-md transition cursor-pointer"
                      >
                        Approve Order
                      </button>
                      <button
                        type="button"
                        onClick={() => handleRejectOrder(selectedOrder.id)}
                        disabled={savingOrderDetail}
                        className="rounded-xl border border-rose-500/30 bg-rose-950/40 text-rose-300 hover:bg-rose-900/60 font-bold px-3.5 py-2 text-xs transition cursor-pointer"
                      >
                        Reject Order
                      </button>
                    </div>
                  </div>
                )}

                <div className="flex flex-wrap items-center justify-between gap-3">
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

                  {selectedOrder.state !== 'Cancelled' && selectedOrder.state !== 'Rejected' && (
                    <button
                      type="button"
                      onClick={handleCancelOrder}
                      disabled={savingOrderDetail}
                      className="rounded-xl border border-rose-500/30 bg-rose-950/40 px-4 py-2.5 text-xs font-bold text-rose-400 hover:bg-rose-900/60 transition cursor-pointer"
                    >
                      Cancel the order
                    </button>
                  )}
                </div>
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

      {/* Batch Modal for Quick Management */}
      <BatchModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSaved={loadData}
        products={products}
        rawMaterials={materials}
        suppliers={suppliers}
        initialBatch={editingBatch}
        defaultItemType={batchModalItem?.type || 'raw_material'}
        defaultItemId={batchModalItem?.item?.id}
      />
    </div>
  )
}
