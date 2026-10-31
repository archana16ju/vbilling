'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Product } from "@/lib/mock-data"
import { Package, Plus, Edit2, Trash2, RefreshCw, Trash } from "lucide-react"
import { useState, useEffect, useMemo } from "react"
import { createProduct, updateProduct, deleteProduct as deleteProductDb, getProducts, getCategories } from "@/lib/actions/db"
import { getRawMaterials } from "@/lib/actions/inventory"
import { RawMaterial, RecipeItem, ProductUnit } from "@/types/product"

export default function ProductsPage() {
  const { products, addProduct, editProduct, deleteProduct, categories, setProducts, setCategories } = useTerminalStore()
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)
  const [loading, setLoading] = useState(false)
  
  const [availableMaterials, setAvailableMaterials] = useState<RawMaterial[]>([])
  const [currentRecipe, setCurrentRecipe] = useState<RecipeItem[]>([])

  const fetchData = async () => {
    setLoading(true)
    try {
      const [dbProducts, dbCategories, dbMaterials] = await Promise.all([
        getProducts(),
        getCategories(),
        getRawMaterials().catch(() => [])
      ])
      setProducts(dbProducts)
      setCategories(dbCategories)
      setAvailableMaterials(dbMaterials)
    } catch (e) {
      console.error('Failed to load products from DB:', e)
    } finally {
      setLoading(false)
    }
  }

  // Always fetch fresh from DB on page load
  useEffect(() => {
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
    <div className="space-y-6">
      {/* Top Header with Dynamic Theme Gradient Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 shadow-xl border border-theme text-white">
        <div className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full bg-pink-500/10 blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
              <Package className="h-6 w-6 text-pink-300" />
              Products & Menu
            </h1>
            <p className="text-xs text-pink-100/70 mt-1">
              Manage menu items, recipes, pricing, ingredients, and inventory units.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={fetchData}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-xl border border-pink-400/30 bg-black/40 px-3.5 py-2 text-xs font-bold text-pink-200 hover:bg-black/60 hover:text-white transition shadow-sm cursor-pointer disabled:opacity-50"
              title="Refresh Products & Recipes"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              <span>Refresh</span>
            </button>
            <button 
              onClick={() => handleOpenForm()}
              style={{ color: '#0f172a' }}
              className="flex items-center gap-2 rounded-xl bg-white text-zinc-950 px-4 py-2 text-xs font-black uppercase tracking-wider shadow-lg hover:bg-pink-100 active:scale-95 transition cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[3]" /> Add Product
            </button>
          </div>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm animate-in fade-in duration-150">
          <div className="w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in zoom-in-95 duration-200 no-scrollbar">
            <h2 className="mb-4 text-xl font-bold text-white">
              {editingProduct ? "Edit Product" : "New Product"}
            </h2>
          <form onSubmit={handleSubmit} className="flex flex-col md:flex-row gap-6 w-full">
            {/* Left Column: Product Details (70%) */}
            <div className="w-full md:w-[65%] lg:w-[70%] grid grid-cols-2 gap-4 h-fit">
              <div>
                <label className="block text-xs font-bold text-zinc-300">Name</label>
                <input required defaultValue={editingProduct?.name} name="name" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">SKU</label>
                <input required defaultValue={editingProduct?.sku} name="sku" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Price (₹)</label>
                <input required defaultValue={editingProduct?.price} type="number" step="0.01" name="price" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Stock</label>
                <input required defaultValue={editingProduct?.stock} type="number" name="stock" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Unit</label>
                <input required defaultValue={editingProduct?.unit} name="unit" placeholder="e.g. piece, kg" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Step</label>
                <input required defaultValue={editingProduct?.quantityStep || 1} type="number" step="0.01" name="quantityStep" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Tax (%)</label>
                <input required defaultValue={editingProduct?.tax || 0} type="number" step="0.01" name="tax" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Discount (%)</label>
                <input required defaultValue={editingProduct?.discount || 0} type="number" step="0.01" name="discount" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:outline-none" />
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Category</label>
                <select defaultValue={editingProduct?.categoryId} name="categoryId" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-white focus:border-pink-500 focus:outline-none">
                  {categories.map(c => <option key={c.id} value={c.id} className="bg-zinc-900 text-white">{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-bold text-zinc-300">Image</label>
                <input type="file" accept="image/*" name="imageFile" className="mt-1 w-full rounded-xl border border-zinc-700 bg-zinc-950 p-1.5 text-xs text-zinc-400 file:mr-3 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1 file:text-xs file:font-semibold file:text-zinc-200 hover:file:bg-zinc-700 cursor-pointer" />
                {editingProduct?.image && <p className="mt-1 text-[11px] text-zinc-500">Leave blank to keep existing image</p>}
              </div>
              
              <div className="col-span-2 mt-4 flex gap-2">
                <button disabled={isUploading} type="submit" className="rounded-xl btn-theme-primary px-5 py-2 text-xs text-white shadow-lg disabled:opacity-50 font-bold cursor-pointer">
                  {isUploading ? "Saving..." : "Save Product"}
                </button>
                <button disabled={isUploading} type="button" onClick={handleCloseForm} className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 font-bold cursor-pointer">Cancel</button>
              </div>
            </div>

            {/* Right Column: Recipe / Ingredients (30%) */}
            <div className="w-full md:w-[35%] lg:w-[30%] rounded-2xl border border-zinc-800 bg-zinc-950/60 p-4 h-fit flex flex-col">
              <h3 className="font-bold text-pink-300 mb-3 text-xs uppercase tracking-wider">Recipe / Ingredients</h3>
              
              <div className="space-y-2 mb-3">
                {currentRecipe.map((item, index) => {
                  const material = availableMaterials.find(m => m.id === item.rawMaterialId);
                  return (
                    <div key={index} className="flex items-center gap-2 bg-zinc-900 p-2 rounded-xl border border-zinc-800">
                      <select 
                        value={item.rawMaterialId} 
                        onChange={(e) => {
                          const newR = [...currentRecipe];
                          newR[index].rawMaterialId = e.target.value;
                          const selectedMat = availableMaterials.find(m => m.id === e.target.value);
                          if(selectedMat) newR[index].unit = selectedMat.unit;
                          setCurrentRecipe(newR);
                        }}
                        className="flex-1 min-w-0 bg-transparent text-xs text-white focus:outline-none py-1"
                      >
                        <option value="" className="bg-zinc-900">Select...</option>
                        {availableMaterials
                          .filter(m => !currentRecipe.some((r, i) => i !== index && r.rawMaterialId === m.id))
                          .map(m => (
                          <option key={m.id} value={m.id} className="bg-zinc-900">{m.name} ({m.unit})</option>
                        ))}
                      </select>
                      
                      <div className="flex items-center bg-zinc-950 rounded-lg px-2 py-1 border border-zinc-800 w-20 shrink-0">
                        <input 
                          type="number" 
                          step="0.01"
                          value={item.quantity}
                          onChange={(e) => {
                            const newR = [...currentRecipe];
                            newR[index].quantity = Number(e.target.value);
                            setCurrentRecipe(newR);
                          }}
                          className="w-full bg-transparent text-xs text-right text-white focus:outline-none" 
                          placeholder="0" 
                        />
                        <span className="ml-1 text-xs font-semibold text-zinc-400">{item.unit || material?.unit || '-'}</span>
                      </div>
                      
                      <button type="button" onClick={() => {
                        const newR = [...currentRecipe];
                        newR.splice(index, 1);
                        setCurrentRecipe(newR);
                      }} className="text-zinc-500 hover:text-rose-400 transition-colors p-1 cursor-pointer">
                        <Trash className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  )
                })}
              </div>
              
              <button type="button" onClick={() => setCurrentRecipe([...currentRecipe, { rawMaterialId: '', quantity: 0, unit: 'kg' }])} className="text-xs font-bold text-pink-400 hover:text-pink-300 self-start cursor-pointer">
                + Add ingredient
              </button>

              {maxPlates !== null && (
                <div className="mt-4 pt-4 border-t border-zinc-800">
                  <div className="text-xs text-zinc-400 mb-1">Makes: <strong className="text-white">1 plate/unit</strong></div>
                  <div className={`text-xs px-2.5 py-1.5 rounded-xl font-bold border ${maxPlates > 0 ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-300' : 'bg-rose-950/60 border-rose-500/40 text-rose-300'}`}>
                    Available: {maxPlates} plates (stock)
                  </div>
                </div>
              )}
            </div>
          </form>
        </div>
      </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/90 shadow-lg overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-950/80 text-xs uppercase text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 font-bold">Product Name</th>
              <th className="px-6 py-4 font-bold">SKU</th>
              <th className="px-6 py-4 font-bold">Category</th>
              <th className="px-6 py-4 font-bold">Price</th>
              <th className="px-6 py-4 font-bold">Stock</th>
              <th className="px-6 py-4 font-bold text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800">
            {loading ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-400">
                  <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
                  Loading products...
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} className="p-8 text-center text-zinc-500">
                  <Package className="mx-auto mb-2 h-8 w-8 text-zinc-600" />
                  No products found. Add some to get started.
                </td>
              </tr>
            ) : products.map((p) => (
              <tr key={p.id} className="hover:bg-zinc-800/40 transition-colors">
                <td className="px-6 py-4 font-bold text-white">
                  <div className="flex items-center gap-3">
                    {p.image ? (
                      <img src={p.image} alt="" className="h-9 w-9 rounded-xl object-cover border border-zinc-700" />
                    ) : (
                      <div className="h-9 w-9 rounded-xl bg-zinc-800 border border-zinc-700 flex items-center justify-center text-xs text-zinc-500 font-bold">
                        {p.name.slice(0, 1)}
                      </div>
                    )}
                    {p.name}
                  </div>
                </td>
                <td className="px-6 py-4 font-mono text-xs text-zinc-400">{p.sku}</td>
                <td className="px-6 py-4 text-xs">
                  <span className="rounded-full bg-zinc-800 border border-zinc-700 px-2.5 py-0.5 text-zinc-300">
                    {categories.find(c => c.id === p.categoryId)?.name || p.categoryId}
                  </span>
                </td>
                <td className="px-6 py-4 font-black font-mono text-pink-300">₹{p.price}</td>
                <td className="px-6 py-4 text-zinc-300 font-medium">{p.stock} {p.unit}</td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleOpenForm(p)} className="mr-3 text-zinc-400 hover:text-white transition cursor-pointer">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={async () => { 
                    if(confirm('Delete this product?')) {
                      await deleteProductDb(p.id);
                      deleteProduct(p.id);
                    } 
                  }} className="text-zinc-500 hover:text-rose-400 transition cursor-pointer">
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
