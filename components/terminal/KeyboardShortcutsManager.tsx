'use client'
import { useState, useEffect } from 'react'
import { useTerminalStore, DEFAULT_SHORTCUTS } from '@/store/useTerminalStore'
import { Keyboard } from 'lucide-react'
import { saveUserShortcuts } from '@/app/login/actions'

const SHORTCUT_LABELS: Record<string, string> = {
  searchProduct: 'Search Product',
  holdBill: 'Hold Bill',
  recallBill: 'Recall Bill',
  cashPayment: 'Cash Payment',
  upiPayment: 'UPI Payment',
  cardPayment: 'Card Payment',
  printBill: 'Print Bill',
  completeBill: 'Complete Bill',
  cancel: 'Cancel / Close'
}

export default function KeyboardShortcutsManager() {
  const { activeShortcuts, setActiveShortcuts } = useTerminalStore()
  const [editingKey, setEditingKey] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [saveStatus, setSaveStatus] = useState<string | null>(null)

  useEffect(() => {
    if (!editingKey) return

    const handleKeyDown = (e: KeyboardEvent) => {
      e.preventDefault()
      e.stopPropagation()

      // Create string representation
      const parts = []
      if (e.ctrlKey) parts.push('Ctrl')
      if (e.altKey) parts.push('Alt')
      if (e.shiftKey) parts.push('Shift')
      
      let key = e.key
      // Ignore bare modifiers
      if (['Control', 'Alt', 'Shift', 'Meta'].includes(key)) return

      if (key === ' ') key = 'Space'
      if (key.length === 1) key = key.toUpperCase()
      
      parts.push(key)
      const newShortcut = parts.join(' + ')

      // Check for duplicates only against active/visible labels
      const isDuplicate = Object.entries(activeShortcuts || DEFAULT_SHORTCUTS).some(
        ([actionKey, shortcut]) => Object.keys(SHORTCUT_LABELS).includes(actionKey) && actionKey !== editingKey && shortcut === newShortcut
      )

      if (isDuplicate) {
        setErrorMsg(`Shortcut '${newShortcut}' is already assigned to another action.`)
        setTimeout(() => setErrorMsg(null), 3000)
      } else {
        setActiveShortcuts({
          ...(activeShortcuts || DEFAULT_SHORTCUTS),
          [editingKey]: newShortcut
        })
        setEditingKey(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown, { capture: true })
    return () => window.removeEventListener('keydown', handleKeyDown, { capture: true })
  }, [editingKey, activeShortcuts, setActiveShortcuts])

  const handleSave = async () => {
    setSaveStatus('Saving...')
    try {
      const res = await saveUserShortcuts(activeShortcuts || DEFAULT_SHORTCUTS)
      if (res && res.success) {
        setSaveStatus('Saved successfully!')
      } else {
        setSaveStatus('Error saving shortcuts.')
      }
    } catch(e) {
      setSaveStatus('Error saving shortcuts.')
    }
    setTimeout(() => setSaveStatus(null), 3000)
  }

  const handleReset = (key: string) => {
    setActiveShortcuts({
      ...(activeShortcuts || DEFAULT_SHORTCUTS),
      [key]: DEFAULT_SHORTCUTS[key]
    })
  }

  const handleResetAll = () => {
    setActiveShortcuts({ ...DEFAULT_SHORTCUTS })
  }

  return (
    <div className="mt-6 rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl max-w-2xl text-white">
      <div className="flex items-center justify-between mb-5 pb-3 border-b border-zinc-800">
        <h2 className="text-lg font-bold text-white flex items-center gap-2">
          <div 
            className="p-1.5 rounded-lg border"
            style={{
              backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
              borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
              color: 'var(--theme-accent, #DB2777)'
            }}
          >
            <Keyboard className="h-4 w-4" />
          </div>
          Keyboard Shortcuts
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handleResetAll}
            className="text-xs font-bold text-rose-400 hover:text-rose-300 px-3 py-1.5 rounded-xl border border-rose-500/30 bg-rose-950/40 hover:bg-rose-900/50 transition cursor-pointer"
          >
            Reset All
          </button>
          <button 
            onClick={handleSave}
            className="rounded-xl bg-theme-bar hover:opacity-95 px-4 py-1.5 text-xs font-bold text-white shadow-lg shadow-theme-glow border border-theme transition cursor-pointer active:scale-95"
          >
            {saveStatus || 'Save Changes'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-xl bg-rose-950/50 p-3 text-xs font-semibold text-rose-300 border border-rose-800/60">
          {errorMsg}
        </div>
      )}

      <div className="space-y-1.5">
        {Object.entries(SHORTCUT_LABELS).map(([key, label]) => {
          const currentShortcut = (activeShortcuts || DEFAULT_SHORTCUTS)[key]
          const isEditing = editingKey === key

          return (
            <div key={key} className="flex items-center justify-between rounded-xl border border-zinc-800/60 bg-zinc-950/60 p-3 hover:bg-zinc-800/40 transition">
              <div className="font-semibold text-zinc-300 text-sm w-1/3">{label}</div>
              
              <div className="flex-1 flex justify-center">
                {isEditing ? (
                  <span 
                    className="animate-pulse rounded-lg border px-3 py-1 text-xs font-bold shadow-md"
                    style={{
                      backgroundColor: 'var(--theme-badge-bg, rgba(219,39,119,0.15))',
                      borderColor: 'var(--theme-active-border, rgba(219,39,119,0.3))',
                      color: 'var(--theme-badge-text, #F472B6)'
                    }}
                  >
                    Press any key combination...
                  </span>
                ) : (
                  <kbd 
                    className="rounded-lg border border-zinc-700 bg-zinc-900 px-2.5 py-1 text-xs font-mono font-bold shadow-inner"
                    style={{ color: 'var(--theme-accent, #DB2777)' }}
                  >
                    {currentShortcut}
                  </kbd>
                )}
              </div>

              <div className="flex justify-end gap-2 w-1/3">
                {isEditing ? (
                  <button 
                    onClick={() => setEditingKey(null)}
                    className="text-xs font-bold text-zinc-400 hover:text-white px-2 cursor-pointer"
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setEditingKey(key)}
                      className="rounded-xl border border-zinc-700 bg-zinc-800/80 px-3 py-1 text-xs font-bold text-zinc-200 hover:bg-zinc-700 hover:text-white shadow-sm transition cursor-pointer"
                    >
                      Change
                    </button>
                    {currentShortcut !== DEFAULT_SHORTCUTS[key] && (
                      <button 
                        onClick={() => handleReset(key)}
                        className="rounded-xl px-2.5 py-1 text-xs font-bold text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                      >
                        Reset
                      </button>
                    )}
                  </>
                )}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
