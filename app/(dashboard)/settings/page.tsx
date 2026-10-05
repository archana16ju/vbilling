'use client'
import { useState } from 'react'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Monitor, Printer, Bluetooth, Wifi, Search, CheckCircle2 } from "lucide-react"
import KeyboardShortcutsManager from "@/components/terminal/KeyboardShortcutsManager"
import StorageManager from "@/components/settings/StorageManager"
import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';
import SoftwareUpdatesPanel from "@/components/settings/SoftwareUpdatesPanel"

const TABS = [
  { id: 'printer', label: 'Printer Settings' }, { id: 'printer-design', label: 'Printer Design' },
  { id: 'terminal', label: 'Terminal Settings' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'storage', label: 'Local Storage' },
  { id: 'updates', label: 'Software Updates' }
]

export default function SettingsPage() {
  const { printerType, setPrinterType, enableCashChange, setEnableCashChange, syncInterval, setSyncInterval, enableDiscount, setEnableDiscount, bluetoothPrinter, setBluetoothPrinter, wifiPrinter, setWifiPrinter } = useTerminalStore()
  const [activeTab, setActiveTab] = useState(TABS[0].id)
  const [isScanning, setIsScanning] = useState(false)
  const [wifiIp, setWifiIp] = useState(wifiPrinter?.ip || '')
  const [wifiPort, setWifiPort] = useState(wifiPrinter?.port || '9100')
  const [wifiName, setWifiName] = useState(wifiPrinter?.name || 'Network Printer')

  const scanBluetooth = async () => {
    setIsScanning(true);
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        alert("Web Bluetooth API is not supported in this browser.");
        setIsScanning(false);
        return;
      }
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'] // generic printer service
      });
      if (device) {
        setBluetoothPrinter({
          name: device.name || 'Unknown Device',
          mac: device.id || 'Unknown ID'
        });
      }
    } catch (e: any) {
      console.error(e);
      if (e.name === 'NotFoundError' && e.message.includes('User cancelled')) {
        // Ignore user cancellation
      } else if (e.name === 'NotFoundError' && e.message.includes('adapter not available')) {
        alert("Bluetooth adapter is not available or turned off. Please check your system settings.");
      } else {
        alert("Error scanning for devices: " + e.message);
      }
    } finally {
      setIsScanning(false);
    }
  };

  const saveWifi = () => {
    if (!wifiIp) return alert("Please enter IP Address");
    setWifiPrinter({ name: wifiName, ip: wifiIp, port: wifiPort });
    alert("WiFi Printer Saved!");
  };

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-zinc-900">Settings</h1>
        <p className="text-zinc-500">Configure your application settings.</p>
      </div>

      <div className="flex flex-col md:flex-row gap-8">
        {/* Left Sidebar */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="space-y-1">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-sm font-medium rounded-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-black text-white'
                    : 'text-zinc-600 hover:bg-zinc-100 hover:text-zinc-900'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 max-w-4xl">
          {activeTab === 'printer-design' && <PrinterDesignPanel />}
          {activeTab === 'printer-design' && <PrinterDesignPanel />}
          {activeTab === 'printer' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-zinc-900 flex items-center gap-2">
                <Printer className="h-5 w-5" /> Printer Settings
              </h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Monitor className="h-6 w-6 text-zinc-400" />
                    <div>
                      <div className="font-semibold text-zinc-900">Browser Print (Default)</div>
                      <div className="text-sm text-zinc-500">Use standard browser print dialog</div>
                    </div>
                  </div>
                  <input 
                    type="radio" 
                    name="printerType" 
                    value="browser" 
                    checked={printerType === 'browser'} 
                    onChange={(e) => setPrinterType(e.target.value)}
                    className="h-5 w-5 text-black"
                  />
                </label>
                
                <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <Printer className="h-6 w-6 text-zinc-400" />
                    <div>
                      <div className="font-semibold text-zinc-900">Wired Printer (USB/POS)</div>
                      <div className="text-sm text-zinc-500">Print receipt directly to a connected wired printer</div>
                    </div>
                  </div>
                  <input 
                    type="radio" 
                    name="printerType" 
                    value="wire" 
                    checked={printerType === 'wire'} 
                    onChange={(e) => setPrinterType(e.target.value)}
                    className="h-5 w-5 text-black"
                  />
                </label>
                
                <label className="flex flex-col rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Bluetooth className="h-6 w-6 text-zinc-400" />
                      <div>
                        <div className="font-semibold text-zinc-900">Bluetooth Printer</div>
                        <div className="text-sm text-zinc-500">Print wirelessly to a nearby Bluetooth printer</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="printerType" 
                      value="bluetooth" 
                      checked={printerType === 'bluetooth'} 
                      onChange={(e) => setPrinterType(e.target.value)}
                      className="h-5 w-5 text-black"
                    />
                  </div>
                  {printerType === 'bluetooth' && (
                    <div className="mt-4 border-t border-zinc-100 pt-4 pl-9">
                      <div className="flex flex-col gap-3">
                        <button 
                          onClick={(e) => { e.preventDefault(); scanBluetooth(); }}
                          disabled={isScanning}
                          className="flex w-fit items-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800 disabled:opacity-50"
                        >
                          <Search className="h-4 w-4" />
                          {isScanning ? 'Scanning...' : 'Scan for Devices'}
                        </button>
                        {bluetoothPrinter ? (
                          <div className="flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-md border border-green-200 w-fit">
                            <CheckCircle2 className="h-4 w-4" />
                            Connected: <strong>{bluetoothPrinter.name}</strong>
                          </div>
                        ) : (
                          <div className="text-sm text-zinc-500">No Bluetooth printer selected.</div>
                        )}
                      </div>
                    </div>
                  )}
                </label>

                <label className="flex flex-col rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Wifi className="h-6 w-6 text-zinc-400" />
                      <div>
                        <div className="font-semibold text-zinc-900">WiFi / Network Printer</div>
                        <div className="text-sm text-zinc-500">Print to a network IP printer</div>
                      </div>
                    </div>
                    <input 
                      type="radio" 
                      name="printerType" 
                      value="wifi" 
                      checked={printerType === 'wifi'} 
                      onChange={(e) => setPrinterType(e.target.value)}
                      className="h-5 w-5 text-black"
                    />
                  </div>
                  {printerType === 'wifi' && (
                    <div className="mt-4 border-t border-zinc-100 pt-4 pl-9">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Device Name</label>
                          <input type="text" value={wifiName} onChange={e => setWifiName(e.target.value)} className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-black" placeholder="Network Printer" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">IP Address</label>
                          <input type="text" value={wifiIp} onChange={e => setWifiIp(e.target.value)} className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-black" placeholder="192.168.1.100" />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-zinc-700 mb-1">Port</label>
                          <input type="text" value={wifiPort} onChange={e => setWifiPort(e.target.value)} className="w-full rounded-md border border-zinc-300 p-2 text-sm outline-none focus:border-black" placeholder="9100" />
                        </div>
                        <div className="flex items-end">
                          <button 
                            onClick={(e) => { e.preventDefault(); saveWifi(); }}
                            className="flex w-full items-center justify-center gap-2 rounded-md bg-black px-4 py-2 text-sm font-medium text-white hover:bg-zinc-800"
                          >
                            Save WiFi Printer
                          </button>
                        </div>
                      </div>
                      {wifiPrinter && (
                        <div className="mt-3 flex items-center gap-2 text-sm text-green-700 bg-green-50 p-2 rounded-md border border-green-200 w-fit">
                          <CheckCircle2 className="h-4 w-4" />
                          Configured: <strong>{wifiPrinter.name} ({wifiPrinter.ip})</strong>
                        </div>
                      )}
                    </div>
                  )}
                </label>
                
                <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div className="flex h-6 w-6 items-center justify-center font-bold text-zinc-400 text-xl">Ø</div>
                    <div>
                      <div className="font-semibold text-zinc-900">No Printer</div>
                      <div className="text-sm text-zinc-500">Do not print bills automatically</div>
                    </div>
                  </div>
                  <input 
                    type="radio" 
                    name="printerType" 
                    value="none" 
                    checked={printerType === 'none'} 
                    onChange={(e) => setPrinterType(e.target.value)}
                    className="h-5 w-5 text-black"
                  />
                </label>
              </div>
            </div>
          )}

          {activeTab === 'terminal' && (
            <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
              <h2 className="mb-4 text-lg font-bold text-zinc-900 flex items-center gap-2">
                <span className="text-xl">⚙️</span> Terminal Settings
              </h2>
              
              <div className="space-y-4">
                <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold text-zinc-900">Cash Payment - Change Return Feature</div>
                      <div className="text-sm text-zinc-500">Enable the modal to calculate amount received and change returned during cash checkout</div>
                    </div>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${(enableCashChange ?? true) ? 'bg-black' : 'bg-gray-200'}`}>
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={enableCashChange ?? true} 
                      onChange={(e) => setEnableCashChange(e.target.checked)} 
                    />
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${(enableCashChange ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>

                <label className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 cursor-pointer hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold text-zinc-900">Apply Discount Option</div>
                      <div className="text-sm text-zinc-500">Enable or disable the discount button and field in the terminal cart panel</div>
                    </div>
                  </div>
                  <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none focus:ring-2 focus:ring-black focus:ring-offset-2 ${(enableDiscount ?? true) ? 'bg-black' : 'bg-gray-200'}`}>
                    <input 
                      type="checkbox" 
                      className="sr-only" 
                      checked={enableDiscount ?? true} 
                      onChange={(e) => setEnableDiscount(e.target.checked)} 
                    />
                    <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${(enableDiscount ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                  </div>
                </label>

                <div className="flex items-center justify-between rounded-lg border border-zinc-200 p-4 hover:bg-zinc-50 transition-colors">
                  <div className="flex items-center gap-3">
                    <div>
                      <div className="font-semibold text-zinc-900">Offline Sync Interval</div>
                      <div className="text-sm text-zinc-500">How often (in seconds) the terminal attempts to sync pending offline bills</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    <select
                      value={syncInterval ?? 30}
                      onChange={(e) => {
                        const val = parseInt(e.target.value);
                        if (!isNaN(val)) {
                          setSyncInterval(val);
                        }
                      }}
                      className="w-20 rounded-md border border-zinc-300 px-2 py-1.5 text-sm text-zinc-900 outline-none focus:border-black focus:ring-1 focus:ring-black"
                    >
                      {[5, 10, 15, 20, 25, 30].map(val => (
                        <option key={val} value={val}>{val}</option>
                      ))}
                    </select>
                    <span className="text-sm text-zinc-500 font-medium">sec</span>
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'shortcuts' && (
            <div className="-mt-6">
              <KeyboardShortcutsManager />
            </div>
          )}

          {activeTab === 'storage' && (
            <StorageManager />
          )}

          {activeTab === 'updates' && (
            <SoftwareUpdatesPanel />
          )}
        </div>
      </div>
    </div>
  )
}
