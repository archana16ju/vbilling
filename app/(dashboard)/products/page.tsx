'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Product } from "@/lib/mock-data"
import { Package, Plus, Edit2, Trash2 } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { createProduct, updateProduct, deleteProduct as deleteProductDb, getProducts, getCategories } from "@/lib/actions/db"
import { getRawMaterials } from "@/lib/actions/inventory"
import { RawMaterial, RecipeItem, ProductUnit } from "@/types/product"
import { Trash } from "lucide-react"

export default function ProductsPage() {
  const { products, addProduct, editProduct, deleteProduct, categories, setProducts, setCategories } = useTerminalStore()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([])
  const [currentRecipe, setCurrentRecipe] = useState<RecipeItem[]>([])

  // Always fetch fresh from DB on page load
  useEffect(() => {
    async function fetchData() {
      if (products.length === 0) setLoading(true)
      try {
        const [dbProducts, dbCategories, dbMaterials] = await Promise.all([getProducts(), getCategories(), getRawMaterials()])
        setProducts(dbProducts)
        setCategories(dbCategories)
        setAvailableMaterials(dbMaterials)
      } catch (e) {
        console.error('Failed to load products from DB:', e)
      } finally {
        setLoading(false)
      }
    }
    fetchData()
  }, [])

  const maxPlates = useMemo(() => {
    if (currentRecipe.length === 0) return null;
    let min = Infinity;
    
    const CONVERSION_RATES: Record<string, number> = { 
      'kg->g': 1000, 'g->kg': 0.001, 'liter->ml': 1000, 'ml->liter': 0.001,
      'tsp->ml': 5, 'ml->tsp': 0.2, 'tbsp->ml': 15, 'ml->tbsp': 1/15, 'cup->ml': 240, 'ml->cup': 1/240,
      'tbsp->tsp': 3, 'tsp->tbsp': 1/3, 'cup->tbsp': 16, 'tbsp->cup': 1/16, 'cup->tsp': 48, 'tsp->cup': 1/48 
    };

    for (const item of currentRecipe) {
      if (!item.rawMaterialId || !item.quantity) return 0; // Incomplete recipe
      const material = availableMaterials.find(m => m.id === item.rawMaterialId);
      if (!material) continue;
      
      let reqQty = item.quantity;
      if (item.unit !== material.unit) {
        const rate = CONVERSION_RATES[`${item.unit}->${material.unit}`];
        if (rate) reqQty = reqQty * rate;
      }
      
      const possible = material.currentStock / reqQty;
      if (possible < min) min = possible;
    }
    
    return min === Infinity ? 0 : Math.floor(min);
  }, [currentRecipe, availableMaterials]);

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product)
      setCurrentRecipe(product.rawMaterials || [])
    } else {
      setEditingProduct(null)
      setCurrentRecipe([])
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
        unit: formData.get("unit") as string as ProductUnit,
        quantityStep: Number(formData.get("quantityStep")),
        categoryId: formData.get("categoryId") as string,
        tax: Number(formData.get("tax")),
        discount: Number(formData.get("discount")),
        image: imageUrl,
        rawMaterials: currentRecipe,
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
        unit: formData.get("unit") as string as ProductUnit,
        quantityStep: Number(formData.get("quantityStep")),
        categoryId: formData.get("categoryId") as string,
        tax: Number(formData.get("tax")),
        discount: Number(formData.get("discount")),
        image: imageUrl,
        rawMaterials: currentRecipe,
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
        <h1 className="text-2xl font-bold text-zinc-900">Products</h1>
        <div className="flex gap-2">

          <button 
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
          >
            <Plus className="h-4 w-4" /> Add Product
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-zinc-900">
            {editingProduct ? "Edit Product" : "New Product"}
          </h2>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6 w-full">
            {/* Left Column: Product Details (70%) */}
            <div className="w-full md:w-[65%] lg:w-[70%] grid grid-cols-2 gap-4 h-fit">
              <div>
                <label className="block text-sm font-medium text-zinc-700">Name</label>
                <input required defaultValue={editingProduct?.name} name="name" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">SKU</label>
                <input required defaultValue={editingProduct?.sku} name="sku" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Price (₹)</label>
                <input required defaultValue={editingProduct?.price} type="number" step="0.01" name="price" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Stock</label>
                <input required defaultValue={editingProduct?.stock} type="number" name="stock" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Unit</label>
                <input required defaultValue={editingProduct?.unit} name="unit" placeholder="e.g. piece, kg" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900 placeholder:text-zinc-400" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Step</label>
                <input required defaultValue={editingProduct?.quantityStep || 1} type="number" step="0.01" name="quantityStep" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Tax (%)</label>
                <input required defaultValue={editingProduct?.tax || 0} type="number" step="0.01" name="tax" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Discount (%)</label>
                <input required defaultValue={editingProduct?.discount || 0} type="number" step="0.01" name="discount" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Category</label>
                <select defaultValue={editingProduct?.categoryId} name="categoryId" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900">
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-zinc-700">Image</label>
                <input type="file" accept="image/*" name="imageFile" className="mt-1 w-full rounded border border-zinc-300 bg-white p-1.5 text-zinc-900 file:mr-4 file:rounded file:border-0 file:bg-zinc-100 file:px-4 file:py-1 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200" />
                {editingProduct?.image && <p className="mt-1 text-xs text-zinc-500">Leave blank to keep existing image</p>}
              </div>
              
              <div className="col-span-2 mt-4 flex gap-2">
                <button disabled={isUploading} type="submit" className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50 font-medium">
                  {isUploading ? "Saving..." : "Save Product"}
                </button>
                <button disabled={isUploading} type="button" onClick={handleCloseForm} className="rounded bg-zinc-200 px-4 py-2 text-zinc-800 hover:bg-zinc-300 disabled:opacity-50 font-medium">Cancel</button>
              </div>
            </div>

            {/* Right Column: Recipe / Ingredients (30%) */}
            <div className="w-full md:w-[35%] lg:w-[30%] rounded-lg border border-zinc-200 bg-zinc-50 p-4 h-fit flex flex-col">
              <h3 className="font-bold text-zinc-900 mb-3 text-sm">Recipe / Ingredients</h3>
              
              <div className="space-y-2 mb-3">
                {currentRecipe.map((item, index) => {
                  const material = availableMaterials.find(m => m.id === item.rawMaterialId);
                  return (
                    <div key={index} className="flex items-center gap-2 bg-white p-1.5 rounded border border-zinc-200">
                      <select 
                        value={item.rawMaterialId} 
                        onChange={(e) => {
                          const newR = [...currentRecipe];
                          newR[index].rawMaterialId = e.target.value;
                          const selectedMat = availableMaterials.find(m => m.id === e.target.value);
                          if(selectedMat) newR[index].unit = selectedMat.unit;
                          setCurrentRecipe(newR);
                        }}
                        className="flex-1 min-w-0 bg-transparent text-xs text-zinc-900 focus:outline-none py-1"
                      >
                        <option value="">Select...</option>
                        {availableMaterials.map(m => (
                          <option key={m.id} value={m.id}>{m.name}</option>
                        ))}
                      </select>
                      
                      <div className="flex items-center bg-zinc-50 rounded px-1.5 py-1 border border-zinc-200 w-20 shrink-0">
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => {
                            const newR = [...currentRecipe];
                            newR[index].quantity = Number(e.target.value);
                            setCurrentRecipe(newR);
                          }}
                          className="w-full bg-transparent text-xs text-right text-zinc-900 focus:outline-none" 
                          placeholder="0" 
                        />
                        <span className="ml-1 text-[10px] font-medium text-zinc-500">{item.unit || material?.unit || '-'}</span>
                      </div>
                      
                      <button type="button" onClick={() => {
                        const newR = [...currentRecipe];
                        newR.splice(index, 1);
                        setCurrentRecipe(newR);
                      }} className="text-zinc-400 hover:text-red-500 transition-colors p-1">
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              
              <button type="button" onClick={() => setCurrentRecipe([...currentRecipe, { rawMaterialId: '', quantity: 0, unit: 'kg' }])} className="text-xs font-semibold text-blue-600 hover:text-blue-800 self-start">
                + Add ingredient
              </button>

              {maxPlates !== null && (
                <div className="mt-4 pt-4 border-t border-zinc-200">
                  <div className="text-xs text-zinc-500 mb-1">Makes: <strong className="text-zinc-800">1 plate/unit</strong></div>
                  <div className={`text-xs px-2 py-1.5 rounded font-medium ${maxPlates > 0 ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-800'}`}>
                    Available: {maxPlates} plates (stock)
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-6 py-4">Product Name</th>
              <th className="px-6 py-4">SKU</th>
              <th className="px-6 py-4">Category</th>
              <th className="px-6 py-4">Price</th>
              <th className="px-6 py-4">Stock</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-black border-t-transparent" />
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  <Package className="mx-auto mb-2 h-8 w-8" />
                  No products found. Add some to get started.
                </td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.id}>
                <td className="px-6 py-4 font-medium text-zinc-900">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-8 w-8 rounded-md object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-md bg-zinc-100" />
                    )}
                    {p.name}
                  </div>
                </td>
                <td className="px-6 py-4">{p.sku}</td>
                <td className="px-6 py-4">{categories.find(c => c.id === p.categoryId)?.name || p.categoryId}</td>
                <td className="px-6 py-4">₹{p.price}</td>
                <td className="px-6 py-4">{p.stock} {p.unit}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleOpenForm(p)} className="mr-3 text-black hover:text-black">
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
