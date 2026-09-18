'use client'
import { useState, useEffect } from 'react'
import { getAllUsers, createUser, updateUser, deleteUser } from '@/app/login/actions'
import { User } from '@/lib/users'
import { UserPlus, Trash2, Shield, User as UserIcon, Edit2 } from 'lucide-react'

export default function UsersPage() {
  const [users, setUsers] = useState<Omit<User, 'password'>[]>([])
  const [editingUser, setEditingUser] = useState<Omit<User, 'password'> | null>(null)
  const [isFormOpen, setIsFormOpen] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')

  const fetchUsers = async () => {
    const data = await getAllUsers()
    setUsers(data)
  }

  useEffect(() => {
    fetchUsers()
  }, [])

  const handleOpenForm = (user?: Omit<User, 'password'>) => {
    setError('')
    if (user) {
      setEditingUser(user)
    } else {
      setEditingUser(null)
    }
    setIsFormOpen(true)
  }

  const handleCloseForm = () => {
    setIsFormOpen(false)
    setEditingUser(null)
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setError('')
    setIsSaving(true)
    
    const formData = new FormData(e.currentTarget)
    
    try {
      let result
      if (editingUser) {
        result = await updateUser(editingUser.id, null, formData)
      } else {
        result = await createUser(null, formData)
      }
      
      if (result?.error) {
        setError(result.error)
      } else {
        handleCloseForm()
        fetchUsers()
      }
    } catch (err: any) {
      console.error(err)
      setError(err.message || 'An unexpected error occurred')
    } finally {
      setIsSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    if (confirm("Are you sure you want to delete this user?")) {
      await deleteUser(id)
      fetchUsers()
    }
  }

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-bold text-zinc-900">User Management</h1>
        <button 
          onClick={() => handleOpenForm()}
          className="flex items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-gray-800"
        >
          <UserPlus className="h-4 w-4" /> Add User
        </button>
      </div>

      {isFormOpen && (
        <div className="mb-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-bold text-zinc-900">
            {editingUser ? "Edit User" : "New User"}
          </h2>
          {error && <p className="mb-4 text-sm text-red-600">{error}</p>}
          <form onSubmit={handleSubmit} className="flex max-w-md flex-col gap-4">
            <div>
              <label className="block text-sm font-medium text-zinc-700">Username</label>
              <input required defaultValue={editingUser?.username} name="username" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900" />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Password</label>
              <input 
                required={!editingUser} 
                type="password" 
                name="password" 
                placeholder={editingUser ? "Leave blank to keep unchanged" : ""}
                className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900 placeholder:text-zinc-400" 
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-zinc-700">Role</label>
              <select defaultValue={editingUser?.role || "cashier"} name="role" className="mt-1 w-full rounded border border-zinc-300 bg-white p-2 text-zinc-900">
                <option value="cashier">Cashier</option>
                <option value="admin">Admin</option>
              </select>
            </div>
            <div className="flex gap-2 mt-2">
              <button disabled={isSaving} type="submit" className="rounded bg-black px-4 py-2 text-white hover:bg-gray-800 disabled:opacity-50">
                {isSaving ? "Saving..." : (editingUser ? "Save Changes" : "Create User")}
              </button>
              <button disabled={isSaving} type="button" onClick={handleCloseForm} className="rounded bg-zinc-200 px-4 py-2 text-zinc-800 hover:bg-zinc-300 disabled:opacity-50">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-6 py-4 font-medium">Username</th>
              <th className="px-6 py-4 font-medium">Role</th>
              <th className="px-6 py-4 font-medium text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {users.map((user) => (
              <tr key={user.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium text-zinc-900">
                  <div className="flex items-center gap-2">
                    <div className="rounded-full bg-zinc-100 p-2">
                      <UserIcon className="h-4 w-4 text-zinc-600" />
                    </div>
                    {user.username}
                  </div>
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    user.role === 'admin' ? 'bg-purple-100 text-purple-800' : 'bg-emerald-100 text-emerald-800'
                  }`}>
                    {user.role === 'admin' ? <Shield className="h-3 w-3" /> : <UserIcon className="h-3 w-3" />}
                    {user.role === 'admin' ? 'Administrator' : 'Cashier'}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button 
                    onClick={() => handleOpenForm(user)}
                    className="mr-3 text-black hover:text-black transition-colors"
                    title="Edit User"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button 
                    onClick={() => handleDelete(user.id)}
                    className="text-red-600 hover:text-red-800 transition-colors"
                    title="Delete User"
                  >
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
