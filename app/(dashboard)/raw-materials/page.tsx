'use client'

import { useState, useEffect } from "react"
import { Tags, Plus, Edit2, Trash2, AlertTriangle, CheckCircle2 } from "lucide-react"
import { RawMaterial, ProductUnit } from "@/types/product"
import { getRawMaterials, createRawMaterial, updateRawMaterial } from "@/lib/actions/inventory"

export default function RawMaterialsPage() {
  const [materials, setMaterials] = useState<RawMaterial[]>([])
  const [loading, setLoading] = useState(true)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [editingMaterial, setEditingMaterial] = useState<RawMaterial | null>(null)

  const loadData = async () => {
    setLoading(true)
    const data = await getRawMaterials()
    setMaterials(data)
    setLoading(false)
  }

  useEffect(() => {
    loadData()
  }, [])

  const handleOpenForm = (material?: RawMaterial) => {
    setEditingMaterial(material || null)
    setIsFormOpen(true)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const formData = new FormData(e.currentTarget)
    
    const payload = {
      name: formData.get("name") as string,
      unit: formData.get("unit") as ProductUnit,
      currentStock: Number(formData.get("currentStock")),
      minimumStock: Number(formData.get("minimumStock")),
      isActive: formData.get("isActive") === "on",
    }

    if (editingMaterial) {
      await updateRawMaterial(editingMaterial.id, payload)
    } else {
      await createRawMaterial(payload)
    }
    
    setIsFormOpen(false)
    loadData()
  }

  const getStatus = (current: number, min: number) => {
    if (current <= 0) return { label: 'Out of Stock', color: 'bg-rose-500/15 border border-rose-500/30 text-rose-400', icon: AlertTriangle }
    if (current <= min) return { label: 'Low Stock', color: 'bg-amber-500/15 border border-amber-500/30 text-amber-400', icon: AlertTriangle }
    return { label: 'In Stock', color: 'bg-emerald-500/15 border border-emerald-500/30 text-emerald-400', icon: CheckCircle2 }
  }

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
                Manage recipe ingredients and track inventory levels
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
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

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden backdrop-blur-sm">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-300">
            <thead className="border-b border-zinc-800 bg-zinc-950/80 text-xs uppercase tracking-wider text-zinc-400">
              <tr>
                <th className="px-6 py-4 font-bold">Material Name</th>
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
                  <td colSpan={6} className="py-12 text-center text-zinc-500 animate-pulse">Loading materials...</td>
                </tr>
              ) : materials.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-12 text-center text-zinc-500">No raw materials found. Add your first ingredient!</td>
                </tr>
              ) : (
                materials.map((item) => {
                  const status = getStatus(item.currentStock, item.minimumStock)
                  return (
                    <tr key={item.id} className="hover:bg-zinc-800/40 transition-colors">
                      <td className="px-6 py-4 font-bold text-white">{item.name}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-bold text-pink-400">{item.currentStock}</span> <span className="text-zinc-400 text-xs">{item.unit}</span>
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-400">{item.minimumStock} {item.unit}</td>
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
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="inline-flex items-center justify-center rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-pink-400 transition-colors border border-transparent hover:border-zinc-700"
                        >
                          <Edit2 className="h-4 w-4" />
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

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 backdrop-blur-md p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-zinc-900 border border-zinc-800 p-6 shadow-2xl text-white">
            <h2 className="mb-6 text-xl font-black text-white">
              {editingMaterial ? "Edit Raw Material" : "Add Raw Material"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Name</label>
                <input
                  name="name"
                  required
                  defaultValue={editingMaterial?.name}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                  placeholder="e.g. Rice, Chicken"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Unit</label>
                  <select
                    name="unit"
                    defaultValue={editingMaterial?.unit || "kg"}
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
                <div>
                  <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Minimum Stock</label>
                  <input
                    name="minimumStock"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingMaterial?.minimumStock || 0}
                    className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1.5 block text-xs font-bold uppercase tracking-wider text-zinc-400">Current Stock</label>
                <input
                  name="currentStock"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editingMaterial?.currentStock || 0}
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3 py-2.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition-all"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
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
    </div>
  )
}

