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
    <div className="mt-6 rounded-xl border border-zinc-200 bg-white p-6 shadow-sm max-w-2xl">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-zinc-900 flex items-center gap-2">
          <Keyboard className="h-5 w-5" /> Keyboard Shortcuts
        </h2>
        <div className="flex gap-2">
          <button 
            onClick={handleResetAll}
            className="text-sm font-medium text-red-600 hover:text-red-700 hover:underline px-2 py-1"
          >
            Reset All
          </button>
          <button 
            onClick={handleSave}
            className="rounded bg-black px-4 py-1.5 text-sm font-bold text-white hover:bg-gray-800 transition-colors"
          >
            {saveStatus || 'Save Changes'}
          </button>
        </div>
      </div>

      {errorMsg && (
        <div className="mb-4 rounded-md bg-red-50 p-3 text-sm font-medium text-red-800 border border-red-200">
          {errorMsg}
        </div>
      )}

      <div className="space-y-1">
        {Object.entries(SHORTCUT_LABELS).map(([key, label]) => {
          const currentShortcut = (activeShortcuts || DEFAULT_SHORTCUTS)[key]
          const isEditing = editingKey === key

          return (
            <div key={key} className="flex items-center justify-between rounded-lg border-b border-zinc-100 p-3 hover:bg-zinc-50">
              <div className="font-medium text-zinc-700 w-1/3">{label}</div>
              
              <div className="flex-1 flex justify-center">
                {isEditing ? (
                  <span className="animate-pulse rounded border border-blue-300 bg-blue-50 px-3 py-1 text-sm font-bold text-blue-700">
                    Press any key combination...
                  </span>
                ) : (
                  <kbd className="rounded border border-zinc-300 bg-zinc-100 px-2.5 py-1 text-sm font-bold font-sans shadow-sm text-zinc-900">
                    {currentShortcut}
                  </kbd>
                )}
              </div>

              <div className="flex justify-end gap-2 w-1/3">
                {isEditing ? (
                  <button 
                    onClick={() => setEditingKey(null)}
                    className="text-xs font-medium text-zinc-500 hover:text-zinc-800 px-2"
                  >
                    Cancel
                  </button>
                ) : (
                  <>
                    <button 
                      onClick={() => setEditingKey(key)}
                      className="rounded border border-zinc-200 bg-white px-3 py-1 text-xs font-medium text-zinc-700 hover:bg-zinc-100 shadow-sm transition-colors"
                    >
                      Change
                    </button>
                    {currentShortcut !== DEFAULT_SHORTCUTS[key] && (
                      <button 
                        onClick={() => handleReset(key)}
                        className="rounded px-3 py-1 text-xs font-medium text-zinc-500 hover:text-zinc-800 hover:bg-zinc-200 transition-colors"
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
