'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Category } from "@/lib/mock-data"
import { Tags, Plus, Edit2, Trash2 } from "lucide-react"
import { useState } from "react"
import { createCategory, updateCategory, deleteCategory as deleteCategoryDb } from "@/lib/actions/db"

export default function CategoriesPage() {
  const { categories, addCategory, editCategory, deleteCategory } = useTerminalStore()
  const [editingCategory, setEditingCategory] = useState<Category | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isUploading, setIsUploading] = useState(false)

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">Categories</h1>
        <button 
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <Plus className="h-4 w-4" /> Add Category
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-zinc-900">
            {editingCategory ? "Edit Category" : "New Category"}
          </h2>
          <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Name</label>
              <input required defaultValue={editingCategory?.name} name="name" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Image</label>
              <input type="file" accept="image/*" name="imageFile" className="mt-1 w-full rounded border border-zinc-300 bg-white p-1.5 text-zinc-900 file:mr-4 file:rounded file:border-0 file:bg-zinc-100 file:px-4 file:py-1 file:text-sm file:font-semibold file:text-zinc-700 hover:file:bg-zinc-200" />
              {editingCategory?.image && <p className="mt-1 text-xs text-zinc-500">Leave blank to keep existing image</p>}
            </div>
            <div className="flex gap-2">
              <button disabled={isUploading} type="submit" className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50">
                {isUploading ? "Saving..." : "Save"}
              </button>
              <button disabled={isUploading} type="button" onClick={handleCloseForm} className="rounded bg-zinc-200 px-4 py-2 text-zinc-800 hover:bg-zinc-300 disabled:opacity-50">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-6 py-4">ID</th>
              <th className="px-6 py-4">Category Name</th>
              <th className="px-6 py-4 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {categories.map((c) => (
              <tr key={c.id}>
                <td className="px-6 py-4">{c.id}</td>
                <td className="px-6 py-4 font-medium text-zinc-900">
                  <div className="flex items-center gap-3">
                    {c.image ? (
                      <img src={c.image} alt="" className="h-8 w-8 rounded-full object-cover" />
                    ) : (
                      <div className="h-8 w-8 rounded-full bg-zinc-100" />
                    )}
                    {c.name}
                  </div>
                </td>
                <td className="px-6 py-4 text-right">
                  <button onClick={() => handleOpenForm(c)} className="mr-3 text-black hover:text-black">
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button onClick={async () => { 
                    if(confirm('Delete this category?')) {
                      await deleteCategoryDb(c.id);
                      deleteCategory(c.id);
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
