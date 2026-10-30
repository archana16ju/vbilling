'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Category } from "@/lib/mock-data"
import { Tags, Plus, Edit2, Trash2, LayoutGrid, CheckCircle } from "lucide-react"
import { useState, useEffect } from "react"
import { createCategory, updateCategory, deleteCategory as deleteCategoryDb, getCategories } from "@/lib/actions/db"

export default function CategoriesPage() {
  const { categories, addCategory, editCategory, deleteCategory } = useTerminalStore()
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

  // Fetch fresh categories from database on mount
  useEffect(() => {
    getCategories().then((dbCategories) => {
      if (Array.isArray(dbCategories)) {
        const customCats = dbCategories.filter((c) => c && c.id !== 'all');
        useTerminalStore.setState({ categories: customCats });
      }
    }).catch((err) => {
      console.error("Failed to load categories:", err);
    });
  }, []);

  const handleOpenForm = (category?: Category) => {
    if (category) {
      setEditingCategory(category)
    } else {
      setEditingCategory(null)
    }
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingCategory(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsUploading(true)
    const formData = new FormData(e.currentTarget)
    
    let imageUrl = editingCategory?.image || ""
    const file = formData.get("imageFile") as File
    if (file && file.size > 0) {
      const uploadData = new FormData()
      uploadData.append("file", file)
      uploadData.append("type", "category")
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

    if (editingCategory) {
      const updatePayload = {
        name: formData.get("name") as string,
        image: imageUrl,
      };
      await updateCategory(editingCategory.id, updatePayload);
      editCategory(editingCategory.id, updatePayload);
    } else {
      const newCategoryPayload = {
        name: formData.get("name") as string,
        image: imageUrl,
      };
      const created = await createCategory(newCategoryPayload);
      addCategory(created);
    }
    
    handleCloseForm()
    setIsUploading(false)
  }

  // Filter out any stray 'all' items from custom categories list
  const customCategories = (categories || []).filter((c) => c && c.id !== 'all');

  return (
    <div className="space-y-6">
      {/* Dynamic Theme Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 text-white shadow-xl">
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-pink-300 shadow-inner">
              <Tags className="h-6 w-6 text-pink-300" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white flex items-center gap-2">
                Categories
              </h1>
              <p className="text-sm font-medium text-pink-100/80">
                Organize products and menu items into display categories
              </p>
            </div>
          </div>
          <button 
            onClick={() => handleOpenForm()}
            className="flex items-center gap-2 rounded-xl btn-theme-primary px-5 py-2.5 text-sm font-bold text-white shadow-lg active:scale-95 transition-all cursor-pointer"
          >
            <Plus className="h-4 w-4" /> Add Category
          </button>
        </div>
      </div>

      {isFormOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-md">
          <div className="w-full max-w-md rounded-2xl bg-zinc-900 p-6 shadow-2xl border border-zinc-800 text-white animate-in fade-in zoom-in-95 duration-150">
            <h2 className="mb-4 text-xl font-black text-white">
              {editingCategory ? "Edit Category" : "Add Category"}
            </h2>
            <form onSubmit={handleSubmit} className="flex flex-col gap-4">
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Category Name *</label>
                <input 
                  required 
                  defaultValue={editingCategory?.name} 
                  name="name" 
                  placeholder="e.g. Biryani, Starters, Beverages"
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 px-3.5 py-2.5 text-sm text-white placeholder-zinc-500 outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500 transition" 
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Image</label>
                <input 
                  type="file" 
                  accept="image/*" 
                  name="imageFile" 
                  className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2 text-xs text-zinc-300 file:mr-4 file:rounded-lg file:border-0 file:bg-zinc-800 file:px-3 file:py-1.5 file:text-xs file:font-bold file:text-zinc-200 hover:file:bg-zinc-700 transition" 
                />
                {editingCategory?.image && (
                  <p className="mt-1 text-xs text-zinc-500">Leave blank to keep existing image</p>
                )}
              </div>
              <div className="flex justify-end gap-2 pt-4 border-t border-zinc-800">
                <button 
                  disabled={isUploading} 
                  type="button" 
                  onClick={handleCloseForm} 
                  className="rounded-xl border border-zinc-700 bg-zinc-800 px-4 py-2 text-xs font-bold text-zinc-300 hover:bg-zinc-700 hover:text-white disabled:opacity-50 transition cursor-pointer"
                >
                  Cancel
                </button>
                <button 
                  disabled={isUploading} 
                  type="submit" 
                  className="rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 disabled:opacity-50 transition cursor-pointer"
                >
                  {isUploading ? "Saving..." : editingCategory ? "Save Changes" : "Create Category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 shadow-xl overflow-hidden backdrop-blur-sm">
        <table className="w-full text-left text-sm text-zinc-300">
          <thead className="bg-zinc-950/80 text-xs uppercase tracking-wider font-bold text-zinc-400 border-b border-zinc-800">
            <tr>
              <th className="px-6 py-4 w-32">Category ID</th>
              <th className="px-6 py-4">Category Name</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/60">
            {/* 1. All Items Category at the Top */}
            <tr className="bg-pink-950/20 hover:bg-pink-950/30 transition">
              <td className="px-6 py-4">
                <span className="inline-flex items-center justify-center font-mono text-xs font-bold text-pink-300 bg-pink-950/60 border border-pink-500/40 px-2.5 py-1 rounded-lg">
                  ALL
                </span>
              </td>
              <td className="px-6 py-4 font-semibold text-white">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-theme-gradient text-white shadow-md shadow-theme-glow">
                    <LayoutGrid className="h-4 w-4" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-bold">All Items</span>
                      <span className="rounded-full bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 text-[10px] font-semibold text-amber-300">
                        System Default
                      </span>
                    </div>
                    <p className="text-xs text-zinc-400 font-normal mt-0.5">
                      Master category displaying all catalog items in terminal
                    </p>
                  </div>
                </div>
              </td>
              <td className="px-6 py-4 text-right">
                <span className="inline-flex items-center gap-1 text-xs font-medium text-zinc-500 italic">
                  Default
                </span>
              </td>
            </tr>

            {/* 2. Custom Categories with clean C-01, C-02, C-03 IDs */}
            {customCategories.length === 0 ? (
              <tr>
                <td colSpan={3} className="px-6 py-8 text-center text-xs text-zinc-500">
                  No custom categories added yet. Click &quot;Add Category&quot; to create one.
                </td>
              </tr>
            ) : (
              customCategories.map((c, index) => {
                const formattedId = `C-${String(index + 1).padStart(2, '0')}`;
                return (
                  <tr key={c.id} className="hover:bg-zinc-800/40 transition">
                    <td className="px-6 py-4">
                      <span className="inline-flex items-center justify-center font-mono text-xs font-bold text-zinc-300 bg-zinc-800 border border-zinc-700 px-2.5 py-1 rounded-lg">
                        {formattedId}
                      </span>
                    </td>
                    <td className="px-6 py-4 font-medium text-white">
                      <div className="flex items-center gap-3">
                        {c.image ? (
                          <img 
                            src={c.image} 
                            alt={c.name} 
                            className="h-9 w-9 rounded-xl object-cover border border-zinc-700 shadow-sm" 
                          />
                        ) : (
                          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-zinc-800 text-pink-400 border border-zinc-700">
                            <Tags className="h-4 w-4" />
                          </div>
                        )}
                        <span className="font-bold text-white">{c.name}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button 
                          onClick={() => handleOpenForm(c)} 
                          className="rounded-lg p-2 text-zinc-400 hover:bg-zinc-800 hover:text-pink-400 transition cursor-pointer border border-transparent hover:border-zinc-700"
                          title="Edit Category"
                        >
                          <Edit2 className="h-4 w-4" />
                        </button>
                        <button 
                          onClick={async () => { 
                            if (confirm(`Are you sure you want to delete category "${c.name}"?`)) {
                              await deleteCategoryDb(c.id);
                              deleteCategory(c.id);
                            }
                          }} 
                          className="rounded-lg p-2 text-zinc-400 hover:bg-rose-950/40 hover:text-rose-400 transition cursor-pointer border border-transparent hover:border-rose-900/50"
                          title="Delete Category"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  )
}
