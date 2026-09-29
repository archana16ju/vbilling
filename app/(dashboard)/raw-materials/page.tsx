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
    if (current <= 0) return { label: 'Out of Stock', color: 'bg-red-100 text-red-700', icon: AlertTriangle }
    if (current <= min) return { label: 'Low Stock', color: 'bg-yellow-100 text-yellow-700', icon: AlertTriangle }
    return { label: 'In Stock', color: 'bg-green-100 text-green-700', icon: CheckCircle2 }
  }

  return (
    <div className="p-8">
      <div className="mb-8 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900">Raw Materials</h1>
          <p className="text-zinc-500">Manage recipe ingredients and track inventory</p>
        </div>
        <button
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 transition-colors shadow-sm"
        >
          <Plus className="h-4 w-4" />
          Add Material
        </button>
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm text-zinc-600">
            <thead className="border-b border-zinc-200 bg-zinc-50/50 text-xs uppercase text-zinc-500">
              <tr>
                <th className="px-6 py-4 font-semibold">Material Name</th>
                <th className="px-6 py-4 font-semibold text-right">Current Stock</th>
                <th className="px-6 py-4 font-semibold text-right">Min Stock</th>
                <th className="px-6 py-4 font-semibold text-center">Status</th>
                <th className="px-6 py-4 font-semibold text-center">Active</th>
                <th className="px-6 py-4 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-100">
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
                    <tr key={item.id} className="hover:bg-zinc-50/50 transition-colors">
                      <td className="px-6 py-4 font-medium text-zinc-900">{item.name}</td>
                      <td className="px-6 py-4 text-right">
                        <span className="font-semibold text-zinc-900">{item.currentStock}</span> {item.unit}
                      </td>
                      <td className="px-6 py-4 text-right text-zinc-500">{item.minimumStock} {item.unit}</td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${status.color}`}>
                          <status.icon className="w-3 h-3" /> {status.label}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-center">
                        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${item.isActive ? 'bg-zinc-100 text-zinc-800' : 'bg-red-50 text-red-600'}`}>
                          {item.isActive ? 'Yes' : 'No'}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-right">
                        <button
                          onClick={() => handleOpenForm(item)}
                          className="inline-flex items-center justify-center rounded-md p-2 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 transition-colors"
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <h2 className="mb-6 text-xl font-bold text-zinc-900">
              {editingMaterial ? "Edit Raw Material" : "Add Raw Material"}
            </h2>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Name</label>
                <input
                  name="name"
                  required
                  defaultValue={editingMaterial?.name}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black"
                  placeholder="e.g. Rice, Chicken"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Unit</label>
                  <select
                    name="unit"
                    defaultValue={editingMaterial?.unit || "kg"}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black"
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
                  <label className="mb-1 block text-sm font-medium text-zinc-700">Minimum Stock</label>
                  <input
                    name="minimumStock"
                    type="number"
                    step="0.01"
                    required
                    defaultValue={editingMaterial?.minimumStock || 0}
                    className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-sm font-medium text-zinc-700">Current Stock</label>
                <input
                  name="currentStock"
                  type="number"
                  step="0.01"
                  required
                  defaultValue={editingMaterial?.currentStock || 0}
                  className="w-full rounded-md border border-zinc-300 px-3 py-2 outline-none focus:border-black focus:ring-1 focus:ring-black"
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <input 
                  type="checkbox" 
                  name="isActive" 
                  id="isActive"
                  defaultChecked={editingMaterial ? editingMaterial.isActive : true}
                  className="h-4 w-4 rounded border-gray-300 text-black focus:ring-black"
                />
                <label htmlFor="isActive" className="text-sm font-medium text-zinc-700">
                  Active
                </label>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-4 border-t border-zinc-100">
                <button
                  type="button"
                  onClick={() => setIsFormOpen(false)}
                  className="rounded-md px-4 py-2 text-sm font-medium text-zinc-600 hover:bg-zinc-100"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="rounded-md bg-black px-6 py-2 text-sm font-medium text-white hover:bg-zinc-800"
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
