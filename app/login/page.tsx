'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'

export default function LoginPage() {
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const router = useRouter()

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')
    
    const formData = new FormData(e.currentTarget)
    const username = formData.get('username')
    const password = formData.get('password')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      })
      const data = await res.json()
      
      if (data.success) {
        if (data.role === 'cashier') {
          router.push('/terminal')
        } else {
          router.push('/dashboard')
        }
        router.refresh()
      } else {
        setError(data.error || 'Invalid credentials')
      }
    } catch (err) {
      setError('Login failed due to a network error.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-zinc-950 p-4">
      <div className="w-full max-w-md bg-white dark:bg-zinc-900 rounded-xl shadow-lg border border-gray-100 dark:border-zinc-800 p-8">
        <div className="text-center mb-8">
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Billing Software</h1>
          <p className="text-sm text-gray-500 dark:text-zinc-400 mt-2">Sign in to your account</p>
        </div>
        
        {error && (
          <div className="mb-6 p-4 rounded-lg bg-red-50 dark:bg-red-900/20 border border-red-100 dark:border-red-900/50">
            <p className="text-sm text-red-600 dark:text-red-400 text-center">{error}</p>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Username</label>
            <input 
              type="text" 
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
              placeholder="admin or cashier"
              name="username"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-zinc-300 mb-2">Password</label>
            <input 
              type="password" 
              required
              className="w-full px-4 py-2 border border-gray-300 dark:border-zinc-700 rounded-lg focus:ring-2 focus:ring-gray-600 focus:border-gray-600 bg-white dark:bg-zinc-950 text-gray-900 dark:text-white"
              placeholder="••••••••"
              name="password"
            />
          </div>
          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full bg-black hover:bg-gray-800 text-white font-medium py-2.5 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? "Signing in..." : "Sign in"}
          </button>
        </form>
      </div>
    </div>
  )
}
