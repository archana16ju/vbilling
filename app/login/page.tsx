'use client'
import { useState } from 'react'

export default function LoginPage() {
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    setIsLoading(true)
    setError('')

    const cleanUser = username.trim()
    const cleanPass = password.trim()

    if (!cleanUser || !cleanPass) {
      setError('Please enter both username and password.')
      setIsLoading(false)
      return
    }

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: cleanUser, password: cleanPass })
      })
      const data = await res.json()

      if (data.success) {
        try {
          document.cookie = `auth_role=${data.role}; path=/; max-age=604800; SameSite=Lax`;
          document.cookie = `auth_username=${data.username || cleanUser}; path=/; max-age=604800; SameSite=Lax`;
          if (data.companyId) {
            document.cookie = `auth_company_id=${data.companyId}; path=/; max-age=604800; SameSite=Lax`;
          }
          localStorage.removeItem('tables-storage');
          const termData = localStorage.getItem('terminal-storage');
          if (termData) {
            const parsed = JSON.parse(termData);
            if (parsed?.state) {
              parsed.state.cart = [];
              parsed.state.selectedCustomer = null;
              parsed.state.orderNote = '';
              parsed.state.activeCompanyId = data.companyId || '';
              localStorage.setItem('terminal-storage', JSON.stringify(parsed));
            }
          }
        } catch {}
        const dest = data.redirectUrl || (data.role === 'cashier' ? '/terminal' : data.role === 'super_admin' ? '/super-admin' : '/dashboard')
        window.location.href = dest
      } else {
        setError(data.error || 'Invalid credentials.')
      }
    } catch (err: any) {
      setError('Login failed due to a network connection error.')
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center bg-zinc-950 p-4 overflow-hidden">
      {/* Dynamic theme ambient glow */}
      <div 
        className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-20"
        style={{ backgroundColor: 'var(--theme-accent, #DB2777)' }}
      />
      <div 
        className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl pointer-events-none opacity-25"
        style={{ backgroundColor: 'var(--theme-gradient-mid, #701A3B)' }}
      />

      <div className="relative z-10 w-full max-w-md bg-zinc-900/90 rounded-2xl shadow-2xl border border-zinc-800 p-8 backdrop-blur-xl text-white">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center h-14 w-14 rounded-2xl bg-theme-bar p-0.5 shadow-lg shadow-theme-glow mb-4 border border-theme">
            <div className="h-full w-full bg-zinc-950/80 rounded-[14px] flex items-center justify-center font-black text-theme-accent text-xl tracking-wider">
              VB
            </div>
          </div>
          <h1 className="text-2xl font-black tracking-tight text-white">Vseyal Billing POS</h1>
          <p className="text-xs text-zinc-400 mt-1 font-medium">Sign in to your terminal or admin session</p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-xl bg-rose-950/50 border border-rose-800/60 text-rose-300 text-xs font-semibold text-center">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">Username</label>
            <input 
              type="text" 
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl focus:border-theme theme-input-focus bg-zinc-950 text-white placeholder-zinc-500 outline-none text-sm transition"
              placeholder="e.g. admin or cashier"
              name="username"
            />
          </div>

          <div>
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-300 mb-2">Password</label>
            <input 
              type="password" 
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 border border-zinc-700 rounded-xl focus:border-theme theme-input-focus bg-zinc-950 text-white placeholder-zinc-500 outline-none text-sm transition"
              placeholder="Enter your password"
              name="password"
            />
          </div>

          <button 
            type="submit" 
            disabled={isLoading}
            className="w-full btn-theme-primary text-white font-bold py-3 rounded-xl transition shadow-lg active:scale-95 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {isLoading ? "Signing in..." : "Sign in to Session"}
          </button>
        </form>
      </div>
    </div>
  )
}

