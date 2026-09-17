'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Product } from "@/lib/mock-data"
import { Package, Plus, Edit2, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { createProduct, updateProduct, deleteProduct as deleteProductDb, getProducts, getCategories } from "@/lib/actions/db"

export default function ProductsPage() {
  const { products, addProduct, editProduct, deleteProduct, categories, setProducts, setCategories } = useTerminalStore()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(false)

  // Always fetch fresh from DB on page load
  useEffect(() => {
    async function fetchData() {
      setLoading(true)
      try {
        const [dbProducts, dbCategories] = await Promise.all([getProducts(), getCategories()])
        setProducts(dbProducts)
        setCategories(dbCategories)
      } catch (e) {
        console.error('Failed to load products from DB:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
    } else {
      setEditingProduct(null)
    }
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingProduct(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUploading(true)
    const formData = new FormData(e.currentTarget)
    
    let imageUrl = editingProduct?.image || ""
    const file = formData.get("imageFile") as File
    if (file && file.size > 0) {
      const uploadData = new FormData()
      uploadData.append("file", file)
      try {
        const res = await fetch("/api/upload", {
          method: "POST",
          body: uploadData,
        })
        const data = await res.json()
        if (data.url) {
          imageUrl = data.url
        }
      } catch (err) {
        console.error("Failed to upload image", err)
      }
    }

    if (editingProduct) {
      const updates = {
        name: formData.get("name") as string,
        sku: formData.get("sku") as string,
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        unit: formData.get("unit") as string,
        quantityStep: Number(formData.get("quantityStep")),
        categoryId: formData.get("categoryId") as string,
        tax: Number(formData.get("tax")),
        discount: Number(formData.get("discount")),
        image: imageUrl,
      };
      await updateProduct(editingProduct.id, updates);
      editProduct(editingProduct.id, updates);
    } else {
      const autoBarcode = Math.floor(100000000000 + Math.random() * 900000000000).toString()
      const newProductPayload = {
        name: formData.get("name") as string,
        sku: formData.get("sku") as string,
        barcode: autoBarcode,
        price: Number(formData.get("price")),
        stock: Number(formData.get("stock")),
        unit: formData.get("unit") as string,
        quantityStep: Number(formData.get("quantityStep")),
        categoryId: formData.get("categoryId") as string,
        tax: Number(formData.get("tax")),
        discount: Number(formData.get("discount")),
        image: imageUrl,
      }
      const created = await createProduct(newProductPayload);
      addProduct(created)
    }
    
    handleCloseForm()
    setIsUploading(false)
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-slate-900">Products</h1>
        <div className="flex gap-2">

          <button 
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="mb-6 rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-slate-900">
            {editingProduct ? "Edit Product" : "New Product"}
          </h2>
          <form onSubmit={handleSubmit} className="grid grid-cols-2 gap-4 md:grid-cols-4">
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">Name</label>
              <input required defaultValue={editingProduct?.name} name="name" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">SKU</label>
              <input required defaultValue={editingProduct?.sku} name="sku" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Price (₹)</label>
              <input required defaultValue={editingProduct?.price} type="number" step="0.01" name="price" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Stock</label>
              <input required defaultValue={editingProduct?.stock} type="number" name="stock" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Unit</label>
              <input required defaultValue={editingProduct?.unit} name="unit" placeholder="e.g. piece, kg" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900 placeholder:text-slate-400" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Step</label>
              <input required defaultValue={editingProduct?.quantityStep || 1} type="number" step="0.01" name="quantityStep" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Tax (%)</label>
              <input required defaultValue={editingProduct?.tax || 0} type="number" step="0.01" name="tax" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-slate-700">Discount (%)</label>
              <input required defaultValue={editingProduct?.discount || 0} type="number" step="0.01" name="discount" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900" />
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">Category</label>
              <select defaultValue={editingProduct?.categoryId} name="categoryId" className="mt-1 w-full rounded border border-slate-300 bg-white p-2 text-slate-900">
                {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="col-span-2">
              <label className="block text-sm font-medium text-slate-700">Image</label>
              <input type="file" accept="image/*" name="imageFile" className="mt-1 w-full rounded border border-slate-300 bg-white p-1.5 text-slate-900 file:mr-4 file:rounded file:border-0 file:bg-slate-100 file:px-4 file:py-1 file:text-sm file:font-semibold file:text-slate-700 hover:file:bg-slate-200" />
              {editingProduct?.image && <p className="mt-1 text-xs text-slate-500">Leave blank to keep existing image</p>}
            </div>
            <div className="col-span-4 mt-2 flex gap-2">
              <button disabled={isUploading} type="submit" className="rounded bg-blue-600 px-4 py-2 text-white hover:bg-blue-700 disabled:opacity-50">
                {isUploading ? "Saving..." : "Save"}
              </button>
              <button disabled={isUploading} type="button" onClick={handleCloseForm} className="rounded bg-slate-200 px-4 py-2 text-slate-800 hover:bg-slate-300 disabled:opacity-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4">Product Name</th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-blue-600 border-t-transparent" />
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-slate-400">
                  <Package className="mx-auto mb-2 h-8 w-8" />
                  No products found. Add some to get started.
                </td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 font-medium text-slate-900">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-slate-100" />
                    )}
                    {p.name}
                  </div>
                </td>
                <td className="px-6 py-4">{p.sku}</td>
                <td className="px-6 py-4">{categories.find(c => c.id === p.categoryId)?.name || p.categoryId}</td>
                <td className="px-6 py-4">₹{p.price}</td>
                <td className="px-6 py-4">{p.stock} {p.unit}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleOpenForm(p)} className="mr-3 text-blue-600 hover:text-blue-800">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={async () => { 
                    if(confirm('Delete this product?')) {
                      await deleteProductDb(p.id);
                      deleteProduct(p.id);
                    } 
                  }} className="text-red-600 hover:text-red-800">
                    <Trash2 className="h-4 w-4" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
