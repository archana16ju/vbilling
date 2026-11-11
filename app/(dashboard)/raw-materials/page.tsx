'use client'

import { useState, useEffect, useMemo } from "react"
import { Tags, Plus, Edit2, AlertTriangle, CheckCircle2, Boxes, Layers, Package, Calendar, Clock, RefreshCw, History, X, Building2 } from "lucide-react"
import { RawMaterial, Product, ProductUnit, Supplier, LinkedProductRef, StockTransaction } from "@/types/product"
import { ProductBatch } from "@/types/batches"
import { getRawMaterials, createRawMaterial, updateRawMaterial, getSuppliers, getStockTransactions } from "@/lib/actions/inventory"
import { getProducts } from "@/lib/actions/db"
import { getProductBatches } from "@/lib/actions/batches"
import BatchModal from "@/components/stocks/BatchModal"

function getDaysLeft(expiryDate?: string | null): number | null {
  if (!expiryDate) return null
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const exp = new Date(expiryDate)
  exp.setHours(0, 0, 0, 0)
  if (isNaN(exp.getTime())) return null
  return Math.ceil((exp.getTime() - today.getTime()) / 86400000)
}

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [products, setProducts] = useState<Product[]>([])
  const [batches, setBatches] = useState<ProductBatch[]>([])
  const [suppliers, setSuppliers] = useState<Supplier[]>([])
  const [loading, setLoading] = useState(true)

  // Stock History Modal State
  const [historyModalItem, setHistoryModalItem] = useState<RawMaterial | null>(null)
  const [historyTransactions, setHistoryTransactions] = useState<StockTransaction[]>([])
  const [isHistoryOpen, setIsHistoryOpen] = useState(false)
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Edit / Create Form State
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)
  const [currentLinkedProducts, setCurrentLinkedProducts] = useState<LinkedProductRef[]>([])
  const [selectedProductId, setSelectedProductId] = useState('')
  const [linkQty, setLinkQty] = useState('1')
  const [linkUnit, setLinkUnit] = useState<ProductUnit>('kg')
  const [formSupplier, setFormSupplier] = useState('')

  // Batch Modal State
  const [isBatchModalOpen, setIsBatchModalOpen] = useState(false)
  const [batchModalTarget, setBatchModalTarget] = useState<RawMaterial | null>(null)
  const [editingBatch, setEditingBatch] = useState<ProductBatch | null>(null)

  const loadData = async () => {
    setLoading(true)
    try {
      const [rmData, prodData, batchData, supData] = await Promise.all([
        getRawMaterials(),
        getProducts().catch(() => []),
        getProductBatches().catch(() => []),
        getSuppliers().catch(() => []),
      ])
      setMaterials(rmData)
      setProducts(prodData)
      setBatches(batchData)
      setSuppliers(supData)
    } catch (err) {
      console.error('Failed to load raw materials data:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenForm = (material?: RawMaterial) => {
    if (material) {
      setEditingMaterial(material)
      setCurrentLinkedProducts(material.linkedProducts || [])
      setLinkUnit(material.unit || 'kg')
      setFormSupplier(material.supplierName || material.preferredSupplier || '')
    } else {
      setEditingMaterial(null)
      setCurrentLinkedProducts([])
      setLinkUnit('kg')
      setFormSupplier('')
    }
    setSelectedProductId(products[0]?.id || '')
    setLinkQty('1')
    setIsFormOpen(true)
  }

  const handleAddLinkedProduct = () => {
    if (!selectedProductId) return
    const prod = products.find((p) => p.id === selectedProductId)
    if (!prod) return

    const qty = parseFloat(linkQty) || 1
    const exists = currentLinkedProducts.some((lp) => lp.productId === selectedProductId)
    if (exists) {
      setCurrentLinkedProducts((prev) =>
        prev.map((lp) =>
          lp.productId === selectedProductId ? { ...lp, quantity: qty, unit: linkUnit } : lp
        )
      )
    } else {
      setCurrentLinkedProducts((prev) => [
        ...prev,
        {
          productId: prod.id,
          productName: prod.name,
          quantity: qty,
          unit: linkUnit,
        },
      ])
    }
  }

  const handleRemoveLinkedProduct = (productId: string) => {
    setCurrentLinkedProducts((prev) => prev.filter((lp) => lp.productId !== productId))
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    const supObj = suppliers.find((s) => s.name === formSupplier.trim() || s.id === formSupplier.trim())
    const payload = {
      name: formData.get("name") as string,
      unit: formData.get("unit") as ProductUnit,
      currentStock: Number(formData.get("currentStock")),
      minimumStock: Number(formData.get("minimumStock")),
      targetStock: Number(formData.get("targetStock")) || 999,
      costPerUnit: Number(formData.get("costPerUnit")) || 0,
      isActive: formData.get("isActive") === "on",
      supplierId: supObj?.id || undefined,
      supplierName: formSupplier.trim() || undefined,
      preferredSupplier: formSupplier.trim() || undefined,
      linkedProducts: currentLinkedProducts,
    }

    if (editingMaterial) {
      await updateRawMaterial(editingMaterial.id, payload)
    } else {
      await createRawMaterial(payload)
    }

    setIsFormOpen(false)
    await loadData()
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('stock-updated'));
    }
  }

  const openAddBatchForMaterial = (material: RawMaterial) => {
    setBatchModalTarget(material)
    setEditingBatch(null)
    setIsBatchModalOpen(true)
  }

  const openEditBatch = (batch: ProductBatch) => {
    const mat = materials.find((m) => m.id === batch.itemId) || null
    setBatchModalTarget(mat)
    setEditingBatch(batch)
    setIsBatchModalOpen(true)
  }

  const handleOpenHistory = async (material: RawMaterial) => {
    setHistoryModalItem(material)
    setIsHistoryOpen(true)
    setLoadingHistory(true)
    try {
      const txs = await getStockTransactions(material.id)
      setHistoryTransactions(txs)
    } catch (e) {
      console.error('Failed to load stock history:', e)
      setHistoryTransactions([])
    } finally {
      setLoadingHistory(false)
    }
  }

  const getStatus = (current: number, min: number, rawStatus?: string) => {
    if (rawStatus === 'Replenished') {
      return { label: 'Replenished', color: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400', icon: RefreshCw }
    }
    if (current <= 0) return { label: 'Out of Stock', color: 'bg-rose-500/15 border border-rose-500/30 text-rose-400', icon: AlertTriangle }
    if (current <= min) return { label: 'Low Stock', color: 'bg-amber-500/15 border border-amber-500/30 text-amber-400', icon: AlertTriangle }
    return { label: 'In Stock', color: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400', icon: CheckCircle2 }
  }

  // Map batches by material ID
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

  return (
    <div className="p-8 space-y-6">
      {/* Dynamic Theme Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 text-white shadow-xl border border-theme">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-pink-300 shadow-inner">
              <Tags className="h-6 w-6 text-pink-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Raw Materials
              </h1>
              <p className="text-sm font-medium text-pink-100/80">
                Manage recipe ingredients, two-way linked products, inventory levels and batch tracking
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={loadData}
              disabled={loading}
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/30 backdrop-blur-md px-4 py-2.5 text-sm font-bold text-white hover:bg-black/50 transition shadow-sm cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <a
              href="/stocks"
              className="flex items-center gap-2 rounded-xl border border-white/20 bg-black/30 backdrop-blur-md px-4 py-2.5 text-sm font-bold text-white hover:bg-black/50 transition shadow-sm"
            >
              Switch to Full Stock Manager →
            </a>
            <button
              onClick={() => handleOpenForm()}
              className="flex items-center gap-2 rounded-xl btn-theme-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              Add Material
            </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-bold">Material Name</th>
                <th className="px-6 py-4 font-bold">Linked Products</th>
                <th className="px-6 py-4 font-bold">Batch Details</th>
                <th className="px-6 py-4 font-bold text-right">Current Stock</th>
                <th className="px-6 py-4 font-bold text-right">Min Stock</th>
                <th className="px-6 py-4 font-bold text-center">Status</th>
                <th className="px-6 py-4 font-bold text-center">Active</th>
                <th className="px-6 py-4 font-bold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-800/60">
              {loading ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500 animate-pulse">Loading materials and batches...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-12 text-center text-zinc-500">No raw materials found. Add your first ingredient!</td>
                </tr>
              ) : (
                materials.map((item) => {
                  const status = getStatus(item.currentStock, item.minimumStock, item.status)
                  const itemBatches = materialBatchesMap.get(item.id) || []
                  const linkedProds = item.linkedProducts || []

                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">
                        <div className="flex items-center gap-2">
                          <Package className="h-4 w-4 text-pink-400 shrink-0" />
                          <span>{item.name}</span>
                        </div>
                        {(item.supplierName || item.preferredSupplier) && (
                          <div className="text-[11px] text-zinc-400 font-medium flex items-center gap-1.5 mt-1 ml-6">
                            <Building2 className="h-3 w-3 text-pink-400 shrink-0" />
                            <span>Preferred:</span>
                            <span className="text-pink-300 font-semibold">{item.supplierName || item.preferredSupplier}</span>
                          </div>
                        )}
                      </td>

                      {/* Linked Products Column */}
                      <td className="px-6 py-4">
                        {linkedProds.length === 0 ? (
                          <span className="text-zinc-500 text-xs italic">No linked products</span>
                        ) : (
                          <div className="flex flex-wrap gap-1.5 max-w-xs">
                            {linkedProds.map((lp) => (
                              <span
                                key={lp.productId}
                                className="inline-flex items-center gap-1 rounded-md bg-zinc-800/90 border border-zinc-700/80 px-2 py-0.5 text-[11px] font-medium text-pink-200"
                                title={`Used in ${lp.productName || 'Product'}: ${lp.quantity} ${lp.unit}`}
                              >
                                <span className="font-semibold">{lp.productName || 'Product'}</span>
                                <span className="text-zinc-400 font-mono text-[10px]">({lp.quantity} {lp.unit})</span>
                              </span>
                            ))}
                          </div>
                        )}
                      </td>

                      {/* Batch Details Column */}
                      <td className="px-6 py-4">
                        {itemBatches.length === 0 ? (
                          <div className="flex items-center gap-2">
                            <span className="text-zinc-500 text-xs">No batches</span>
                            <button
                              onClick={() => openAddBatchForMaterial(item)}
                              className="text-[11px] text-pink-400 hover:text-pink-300 font-semibold hover:underline"
                            >
                              + Add Batch
                            </button>
                          </div>
                        ) : (
                          <div className="space-y-1">
                            {itemBatches.slice(0, 2).map((b) => {
                              const daysLeft = getDaysLeft(b.expiryDate);
                              return (
                                <div
                                  key={b.id}
                                  onClick={() => openEditBatch(b)}
                                  className="w-fit min-w-[155px] max-w-[195px] rounded-lg bg-zinc-950/80 border border-zinc-800 hover:border-pink-500/50 p-1.5 cursor-pointer transition text-xs shadow-sm"
                                  title="Click to view/edit batch details"
                                >
                                  <div className="flex items-center justify-between gap-1.5">
                                    <span className="font-mono font-bold text-white text-[11px] truncate">{b.batchNumber}</span>
                                    <span className={`px-1.5 py-0.5 rounded text-[9px] font-bold uppercase shrink-0 ${
                                      b.status === 'active'
                                        ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                                        : b.status === 'near_expiry'
                                        ? 'bg-amber-950 text-amber-400 border border-amber-800'
                                        : 'bg-rose-950 text-rose-400 border border-rose-800'
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
                              <div className="text-[10px] text-zinc-400">
                                +{itemBatches.length - 2} more batches ({itemBatches.reduce((acc, curr) => acc + curr.currentQuantity, 0)} total stock)
                              </div>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-pink-400">{item.currentStock}</span> <span className="text-zinc-400 text-xs">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-400">
                        <div>{item.minimumStock} {item.unit}</div>
                        <div className="text-[10px] text-zinc-500 font-mono">Target: {item.targetStock || 999} {item.unit}</div>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-semibold ${status.color}`}>
                          <status.icon className="w-3 h-3" /> {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${item.isActive ? 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400' : 'bg-rose-500/15 border border-rose-500/30 text-rose-400'}`}>
                          {item.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            onClick={() => handleOpenHistory(item)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-emerald-400 transition-colors border border-transparent hover:border-zinc-700 cursor-pointer"
                            title="View Stock History & Replenishments"
                          >
                            <History className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => openAddBatchForMaterial(item)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-pink-400 transition-colors border border-transparent hover:border-zinc-700 cursor-pointer"
                            title="Add or Manage Batches"
                          >
                            <Boxes className="h-4 w-4" />
                          </button>
                          <button
                            onClick={() => handleOpenForm(item)}
                            className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-pink-400 transition-colors border border-transparent hover:border-zinc-700 cursor-pointer"
                            title="Edit Material & Linked Products"
                          >
                            <Edit2 className="h-4 w-4" />
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

      {/* Add / Edit Raw Material Modal */}
      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4 animate-in fade-in duration-150">
          <div className="w-full max-w-3xl max-h-[92vh] overflow-y-auto rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
            <h2 className="mb-6 text-xl font-black text-white flex items-center gap-2">
              <Tags className="h-5 w-5 text-pink-400" />
              <span>{editingMaterial ? "Edit Raw Material" : "Add Raw Material"}</span>
            </h2>

            <form onSubmit={handleSubmit} className="space-y-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Material Name *</label>
                  <input
                    name="name"
                    required
                    defaultValue={editingMaterial?.name}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                    placeholder="e.g. Rice, Chicken, Oil"
                  />
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Unit *</label>
                  <select
                    name="unit"
                    defaultValue={editingMaterial?.unit || "kg"}
                    onChange={(e) => setLinkUnit(e.target.value as ProductUnit)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                  >
                    <option value="kg">kg</option>
                    <option value="g">g</option>
                    <option value="liter">liter</option>
                    <option value="ml">ml</option>
                    <option value="piece">piece</option>
                    <option value="pack">pack</option>
                    <option value="box">box</option>
                    <option value="dozen">dozen</option>
                    <option value="tsp">tsp</option>
                    <option value="tbsp">tbsp</option>
                    <option value="cup">cup</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Current Stock *</label>
                  <input
                    name="currentStock"
                    type="number"
                    step="any"
                    required
                    defaultValue={editingMaterial?.currentStock || 0}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Live available quantity.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Minimum Stock Level *</label>
                  <input
                    name="minimumStock"
                    type="number"
                    step="any"
                    required
                    defaultValue={editingMaterial?.minimumStock || 0}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Triggers low-stock alert & reorder.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Target Stock Level *</label>
                  <input
                    name="targetStock"
                    type="number"
                    step="any"
                    required
                    defaultValue={editingMaterial?.targetStock ?? 999}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Target replenishment qty.
                  </p>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Linked Supplier
                  </label>
                  <select
                    value={formSupplier}
                    onChange={(e) => setFormSupplier(e.target.value)}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                  >
                    <option value="">No Supplier Selected</option>
                    {suppliers.map((s) => (
                      <option key={s.id} value={s.name}>
                        {s.name} {s.phone ? `(${s.phone})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Supplier linked to automatic purchase orders.
                  </p>
                </div>

                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">
                    Estimated Cost Per Unit (₹)
                  </label>
                  <input
                    name="costPerUnit"
                    type="number"
                    step="0.01"
                    defaultValue={editingMaterial?.costPerUnit ?? 0}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all font-mono"
                    placeholder="0.00"
                  />
                  <p className="mt-1 text-[11px] text-zinc-500">
                    Used to calculate purchase order total.
                  </p>
                </div>
              </div>

              <div className="flex items-center gap-2">
                <input 
                  type="checkbox" 
                  name="isActive" 
                  id="isActive"
                  defaultChecked={editingMaterial ? editingMaterial.isActive : true}
                  className="h-4 w-4 rounded border-zinc-700 bg-zinc-950 text-pink-600 focus:ring-pink-500"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-zinc-300">
                  Active
                </label>
              </div>

              {/* Two-Way Linked Products Section */}
              <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                  <div>
                    <h3 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                      <Layers className="h-4 w-4 text-pink-400" />
                      Associated Products (Used In)
                    </h3>
                    <p className="text-[11px] text-zinc-400 mt-0.5">
                      Link which finished products use this raw material in their recipe. Changes reflect in both collections.
                    </p>
                  </div>
                </div>

                {/* Add Product Link Bar */}
                <div className="flex flex-col sm:flex-row gap-2 items-end">
                  <div className="flex-1 w-full">
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Select Product</label>
                    <select
                      value={selectedProductId}
                      onChange={(e) => setSelectedProductId(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-pink-500"
                    >
                      {products.length === 0 ? (
                        <option value="" disabled>No products available</option>
                      ) : (
                        products.map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))
                      )}
                    </select>
                  </div>

                  <div className="w-28">
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Quantity</label>
                    <input
                      type="number"
                      step="any"
                      min="0.001"
                      value={linkQty}
                      onChange={(e) => setLinkQty(e.target.value)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-pink-500"
                    />
                  </div>

                  <div className="w-28">
                    <label className="block text-[11px] font-semibold text-zinc-400 mb-1">Unit</label>
                    <select
                      value={linkUnit}
                      onChange={(e) => setLinkUnit(e.target.value as ProductUnit)}
                      className="w-full rounded-xl border border-zinc-700 bg-zinc-900 px-3 py-2 text-xs text-white outline-none focus:border-pink-500"
                    >
                      <option value="kg">kg</option>
                      <option value="g">g</option>
                      <option value="liter">liter</option>
                      <option value="ml">ml</option>
                      <option value="piece">piece</option>
                      <option value="pack">pack</option>
                      <option value="box">box</option>
                      <option value="dozen">dozen</option>
                      <option value="tsp">tsp</option>
                      <option value="tbsp">tbsp</option>
                      <option value="cup">cup</option>
                    </select>
                  </div>

                  <button
                    type="button"
                    onClick={handleAddLinkedProduct}
                    className="rounded-xl border border-pink-500/40 bg-pink-950/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-pink-900/60 hover:text-white transition cursor-pointer shrink-0"
                  >
                    + Link Product
                  </button>
                </div>

                {/* List of currently linked products */}
                <div className="space-y-1.5 pt-2">
                  {currentLinkedProducts.length === 0 ? (
                    <p className="text-xs text-zinc-500 italic py-2">
                      No products linked yet. Select a product above to establish two-way linking.
                    </p>
                  ) : (
                    currentLinkedProducts.map((lp) => (
                      <div
                        key={lp.productId}
                        className="flex items-center justify-between bg-zinc-900/90 border border-zinc-800 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2">
                          <Package className="h-3.5 w-3.5 text-pink-400" />
                          <span className="font-bold text-white">{lp.productName || 'Product'}</span>
                          <span className="text-zinc-400 font-mono text-[11px]">
                            ({lp.quantity} {lp.unit} per item)
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleRemoveLinkedProduct(lp.productId)}
                          className="text-xs text-rose-400 hover:text-rose-300 font-semibold cursor-pointer"
                        >
                          Unlink
                        </button>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* Batch Overview in Edit Material Form */}
              {editingMaterial && (
                <div className="rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 space-y-3">
                  <div className="flex items-center justify-between border-b border-zinc-800 pb-2">
                    <div>
                      <h3 className="text-xs font-bold uppercase tracking-wider text-pink-300 flex items-center gap-1.5">
                        <Boxes className="h-4 w-4 text-pink-400" />
                        Batch Details
                      </h3>
                      <p className="text-[11px] text-zinc-400 mt-0.5">
                        Track lot numbers, expiry dates, quantities, and minimum stock levels for this ingredient.
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => openAddBatchForMaterial(editingMaterial)}
                      className="rounded-lg border border-pink-500/40 bg-pink-950/40 px-3 py-1.5 text-xs font-bold text-pink-200 hover:bg-pink-900/60 hover:text-white transition cursor-pointer"
                    >
                      + Add Batch
                    </button>
                  </div>

                  <div className="space-y-1.5">
                    {(materialBatchesMap.get(editingMaterial.id) || []).length === 0 ? (
                      <p className="text-xs text-zinc-500 italic py-1">No batches recorded for this material.</p>
                    ) : (
                      (materialBatchesMap.get(editingMaterial.id) || []).map((b) => (
                        <div
                          key={b.id}
                          className="flex items-center justify-between bg-zinc-900/80 border border-zinc-800 rounded-xl px-3 py-2 text-xs"
                        >
                          <div>
                            <span className="font-mono font-bold text-white">{b.batchNumber}</span>
                            <div className="text-[11px] text-zinc-400">
                              Stock: <strong className="text-pink-300">{b.currentQuantity}</strong> (Initial: {b.initialQuantity})
                              {b.minStockLevel ? ` · Min: ${b.minStockLevel}` : ''}
                            </div>
                          </div>
                          <div className="flex items-center gap-3">
                            <div className="text-right">
                              <span className="text-[10px] text-zinc-400">Expires: {b.expiryDate}</span>
                            </div>
                            <button
                              type="button"
                              onClick={() => openEditBatch(b)}
                              className="text-pink-400 hover:text-pink-300 font-bold"
                            >
                              Edit
                            </button>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2.5 text-sm font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition-all cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-xl btn-theme-primary px-6 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
                >
                  Save Material
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Raw Material Stock History Modal */}
      {isHistoryOpen && historyModalItem && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-3xl rounded-2xl bg-zinc-900 border border-zinc-800 shadow-2xl overflow-hidden flex flex-col max-h-[85vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="flex items-center justify-between border-b border-zinc-800 px-6 py-4 bg-zinc-950/50">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-xl bg-pink-500/10 border border-pink-500/20 text-pink-400">
                  <History className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-bold text-white flex items-center gap-2">
                    <span>{historyModalItem.name}</span>
                    <span className="text-xs font-mono px-2 py-0.5 rounded-full bg-zinc-800 text-zinc-300">
                      Stock: {historyModalItem.currentStock} {historyModalItem.unit}
                    </span>
                    {historyModalItem.status === 'Replenished' && (
                      <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                        <RefreshCw className="h-3 w-3" /> Replenished
                      </span>
                    )}
                  </h3>
                  <p className="text-xs text-zinc-400">Stock deductions, automated restorations, and adjustments log</p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-lg p-1.5 text-zinc-400 hover:bg-zinc-800 hover:text-white transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {/* Content Table */}
            <div className="flex-1 overflow-y-auto p-4">
              {loadingHistory ? (
                <div className="py-12 text-center text-zinc-500 text-xs animate-pulse">Loading stock transactions...</div>
              ) : historyTransactions.length === 0 ? (
                <div className="py-12 text-center text-zinc-500 text-xs">No transactions recorded for this material yet.</div>
              ) : (
                <table className="w-full text-left text-xs font-mono text-zinc-300">
                  <thead className="border-b border-zinc-800 text-[10px] uppercase font-bold text-zinc-500 sticky top-0 bg-zinc-900">
                    <tr>
                      <th className="pb-2">Type</th>
                      <th className="pb-2 text-right">Before</th>
                      <th className="pb-2 text-right">Deducted</th>
                      <th className="pb-2 text-right">Restored</th>
                      <th className="pb-2 text-right">After</th>
                      <th className="pb-2 font-sans pl-3">Date</th>
                      <th className="pb-2 font-sans">Reason / Ref</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-zinc-800/50">
                    {historyTransactions.map((tx) => {
                      const isDeduction = tx.type === 'Sale Deduction' || tx.quantityChanged < 0
                      const isReplenishment = tx.type === 'Auto Replenishment'
                      const isOpening = tx.type === 'Opening Stock'
                      const isManual = tx.type === 'Manual Adjustment'

                      const deductedQty = tx.quantityChanged < 0 ? Math.abs(tx.quantityChanged) : 0
                      const restoredQty = tx.quantityChanged > 0 ? tx.quantityChanged : 0

                      return (
                        <tr key={tx.id} className="hover:bg-zinc-800/30">
                          <td className="py-2.5 font-sans">
                            {isReplenishment && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-[9px] font-semibold text-emerald-400">
                                <RefreshCw className="h-2.5 w-2.5" /> Auto Replenish
                              </span>
                            )}
                            {isDeduction && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-rose-500/15 border border-rose-500/30 px-2 py-0.5 text-[9px] font-semibold text-rose-400">
                                Sale Deduction
                              </span>
                            )}
                            {isManual && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[9px] font-semibold text-amber-400">
                                Manual Adj
                              </span>
                            )}
                            {isOpening && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-sky-500/15 border border-sky-500/30 px-2 py-0.5 text-[9px] font-semibold text-sky-400">
                                Opening
                              </span>
                            )}
                            {!isReplenishment && !isDeduction && !isManual && !isOpening && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-zinc-800 px-2 py-0.5 text-[9px] font-semibold text-zinc-300">
                                {tx.type}
                              </span>
                            )}
                          </td>
                          <td className="py-2.5 text-right text-zinc-400">{Number(tx.quantityBefore || 0).toFixed(3)}</td>
                          <td className="py-2.5 text-right font-bold text-rose-400">{deductedQty > 0 ? `-${deductedQty.toFixed(3)}` : '—'}</td>
                          <td className="py-2.5 text-right font-bold text-emerald-400">{restoredQty > 0 ? `+${restoredQty.toFixed(3)}` : '—'}</td>
                          <td className="py-2.5 text-right font-bold text-white">{Number(tx.quantityAfter || 0).toFixed(3)}</td>
                          <td className="py-2.5 font-sans pl-3 text-zinc-400 text-[10px]">
                            {tx.date ? new Date(tx.date).toLocaleDateString('en-IN', {
                              day: '2-digit',
                              month: 'short',
                              hour: '2-digit',
                              minute: '2-digit'
                            }) : '—'}
                          </td>
                          <td className="py-2.5 font-sans text-zinc-300 text-[11px]">
                            <div className="truncate max-w-[200px]" title={tx.reason}>
                              {tx.reason || '—'}
                            </div>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Footer */}
            <div className="border-t border-zinc-800 px-6 py-3 bg-zinc-950/50 flex justify-end">
              <button
                type="button"
                onClick={() => setIsHistoryOpen(false)}
                className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-1.5 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white transition cursor-pointer"
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Batch Modal */}
      <BatchModal
        isOpen={isBatchModalOpen}
        onClose={() => setIsBatchModalOpen(false)}
        onSaved={loadData}
        products={products}
        rawMaterials={materials}
        suppliers={suppliers}
        initialBatch={editingBatch}
        defaultItemType="raw_material"
        defaultItemId={batchModalTarget?.id}
      />
    </div>
  )
}
