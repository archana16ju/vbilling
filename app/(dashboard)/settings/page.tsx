'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Monitor, Printer } from "lucide-react"

export default function SettingsPage() {
  const { printerType, setPrinterType } = useTerminalStore()

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500">Configure your application settings.</p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm max-w-2xl">
        <h2 className="mb-4 text-lg font-bold text-slate-900 flex items-center gap-2">
          <Printer className="h-5 w-5" /> Printer Settings
        </h2>
        
        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <Monitor className="h-6 w-6 text-slate-400" />
              <div>
                <div className="font-semibold text-slate-900">Browser Print (Default)</div>
                <div className="text-sm text-slate-500">Use standard browser print dialog</div>
              </div>
            </div>
            <input 
              type="radio" 
              name="printerType" 
              value="browser" 
              checked={printerType === 'browser'} 
              onChange={(e) => setPrinterType(e.target.value)}
              className="h-5 w-5 text-blue-600"
            />
          </label>
          
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <Printer className="h-6 w-6 text-slate-400" />
              <div>
                <div className="font-semibold text-slate-900">Wired Printer (USB/POS)</div>
                <div className="text-sm text-slate-500">Print receipt directly to a connected wired printer</div>
              </div>
            </div>
            <input 
              type="radio" 
              name="printerType" 
              value="wire" 
              checked={printerType === 'wire'} 
              onChange={(e) => setPrinterType(e.target.value)}
              className="h-5 w-5 text-blue-600"
            />
          </label>
          
          <label className="flex items-center justify-between rounded-lg border border-slate-200 p-4 cursor-pointer hover:bg-slate-50 transition-colors">
            <div className="flex items-center gap-3">
              <div className="flex h-6 w-6 items-center justify-center font-bold text-slate-400 text-xl">Ø</div>
              <div>
                <div className="font-semibold text-slate-900">No Printer</div>
                <div className="text-sm text-slate-500">Do not print bills automatically</div>
              </div>
            </div>
            <input 
              type="radio" 
              name="printerType" 
              value="none" 
              checked={printerType === 'none'} 
              onChange={(e) => setPrinterType(e.target.value)}
              className="h-5 w-5 text-blue-600"
            />
          </label>
        </div>
      </div>
    </div>
  )
}
