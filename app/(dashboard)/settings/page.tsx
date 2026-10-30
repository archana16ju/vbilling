'use client'
import { useState, useEffect } from 'react'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Monitor, Printer, Bluetooth, Wifi, Search, CheckCircle2, Network, LayoutGrid } from "lucide-react"
import KeyboardShortcutsSettingsPanel from "@/components/settings/KeyboardShortcutsSettingsPanel"
import StorageManager from "@/components/settings/StorageManager"
import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';
import TerminalDesignPanel from '@/components/settings/TerminalDesignPanel';
import SoftwareUpdatesPanel from "@/components/settings/SoftwareUpdatesPanel"
import CompanyPermissionsPanel from "@/components/settings/CompanyPermissionsPanel"
import CompanyThemePanel from "@/components/settings/CompanyThemePanel"
import TaxesChargesPanel from "@/components/settings/TaxesChargesPanel"
import WhatsAppSettingsPanel from "@/components/settings/WhatsAppSettingsPanel"

const BASE_TABS = [
  { id: 'theme', label: '🎨 Company Theme' },
  { id: 'taxes-charges', label: 'Taxes & Charges' },
  { id: 'whatsapp', label: '💬 WhatsApp' },
  { id: 'printer', label: 'Printer Settings' },
  { id: 'printer-design', label: 'Receipt Design' },
  { id: 'terminal-design', label: 'Terminal Design' },
  { id: 'terminal', label: 'Terminal Settings' },
  { id: 'shortcuts', label: 'Keyboard Shortcuts' },
  { id: 'storage', label: 'Local Storage' },
  { id: 'updates', label: 'Software Updates' }
]

export default function SettingsPage() {
  const [mounted, setMounted] = useState(false);
  const [role, setRole] = useState<string | null>(null);
  const [isSettingsDisabled, setIsSettingsDisabled] = useState(false);
  const [lanUrl, setLanUrl] = useState<string | null>(null);
  const [copiedLan, setCopiedLan] = useState(false);
  const isLocalMode = process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql';

  useEffect(() => {
    setMounted(true);
    const match = document.cookie.match(/(^| )auth_role=([^;]+)/);
    const r = match ? match[2] : null;
    setRole(r);

    // Check company module permissions for company_admin
    const compMatch = document.cookie.match(/(^| )auth_company_id=([^;]+)/);
    const compId = compMatch ? compMatch[2] : null;
    if (r !== 'super_admin' && compId) {
      fetch(`/api/companies/permissions?companyId=${compId}`)
        .then(res => res.json())
        .then(data => {
          if (data && data.settings === false) {
            setIsSettingsDisabled(true);
          }
        })
        .catch(() => { });
    }

    if (process.env.NEXT_PUBLIC_LOCAL_DB_MODE === 'mysql') {
      fetch('/api/system/network')
        .then(res => res.json())
        .then(data => {
          if (data && data.primaryUrl) {
            setLanUrl(data.primaryUrl);
          }
        })
        .catch(() => { });
    }
  }, []);

  const TABS = role === 'super_admin'
    ? [
      { id: 'theme', label: '🎨 System Theme' },
      { id: 'company-permissions', label: 'Company Permissions' },
      ...BASE_TABS.filter((t) => t.id !== 'theme'),
    ]
    : BASE_TABS;

  const { printerType, setPrinterType, enableCashChange, setEnableCashChange, syncInterval, setSyncInterval, enableDiscount, setEnableDiscount, bluetoothPrinter, setBluetoothPrinter, wifiPrinter, setWifiPrinter } = useTerminalStore()
  const [activeTab, setActiveTab] = useState(role === 'super_admin' ? 'company-permissions' : 'printer')

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      const tab = params.get('tab');
      if (tab) {
        setActiveTab(tab);
      }
    }
  }, []);
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
    <div className="space-y-6">
      {/* Dynamic Theme Hero Banner */}
      <div className="relative overflow-hidden rounded-2xl bg-theme-bar p-6 text-white shadow-xl border border-theme">
        <div className="relative z-10 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-black/30 backdrop-blur-md border border-white/10 text-white shadow-inner">
              <Monitor className="h-6 w-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-black tracking-tight text-white">Settings</h1>
              <p className="text-sm font-medium text-white/80">Configure terminal hardware, design, permissions and local settings</p>
            </div>
          </div>

          {isLocalMode && lanUrl && (
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) {
                  navigator.clipboard.writeText(lanUrl);
                  setCopiedLan(true);
                  setTimeout(() => setCopiedLan(false), 2000);
                }
              }}
              className="inline-flex items-center gap-2 rounded-xl bg-black/30 border border-white/20 backdrop-blur-md px-4 py-2.5 text-xs font-bold text-white shadow-sm transition-all hover:bg-black/50 active:scale-95 cursor-pointer shrink-0"
              title="Host LAN Address • Click to copy address"
            >
              <Network className="h-4 w-4 text-white" />
              <span>Host LAN: <strong className="font-mono text-white">{lanUrl}</strong></span>
              {copiedLan ? (
                <span className="rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 text-[10px] font-bold">Copied!</span>
              ) : (
                <span className="rounded-full bg-white/10 text-white px-2 py-0.5 text-[10px] border border-white/10">Copy</span>
              )}
            </button>
          )}
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-6">
        {/* Left Sidebar Navigation */}
        <div className="w-full md:w-64 shrink-0">
          <nav className="space-y-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-xl backdrop-blur-sm">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full flex items-center px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${activeTab === tab.id
                  ? 'bg-theme-bar border border-theme text-white preserve-white shadow-md shadow-theme-glow font-black'
                  : 'text-zinc-400 hover:bg-zinc-800 hover:text-white border border-transparent'
                  }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Right Content Area */}
        <div className="flex-1 max-w-4xl">
          {isSettingsDisabled && role !== 'super_admin' ? (
            <div className="rounded-2xl border border-rose-500/30 bg-rose-950/20 p-8 text-center text-white">
              <h3 className="text-lg font-black text-rose-400 mb-2">Settings Module Disabled</h3>
              <p className="text-sm text-zinc-300">
                The Settings module has been disabled for your company by the Super Admin. You are not authorized to view or configure terminal, receipt, or store settings.
              </p>
            </div>
          ) : (
            <>
              {activeTab === 'company-permissions' && <CompanyPermissionsPanel />}
              {activeTab === 'theme' && <CompanyThemePanel />}
              {activeTab === 'taxes-charges' && <TaxesChargesPanel />}
              {activeTab === 'whatsapp' && <WhatsAppSettingsPanel />}
              {activeTab === 'printer-design' && <PrinterDesignPanel />}
              {activeTab === 'terminal-design' && <TerminalDesignPanel />}
              {activeTab === 'printer' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl text-white backdrop-blur-sm">
                  <h2 className="mb-5 text-lg font-black text-white flex items-center gap-2">
                    <Printer className="h-5 w-5 text-pink-400" /> Printer Settings
                  </h2>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <Monitor className="h-6 w-6 text-pink-400" />
                        <div>
                          <div className="font-bold text-white">Browser Print (Default)</div>
                          <div className="text-xs text-zinc-400">Use standard browser print dialog</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="printerType"
                        value="browser"
                        checked={printerType === 'browser'}
                        onChange={(e) => setPrinterType(e.target.value)}
                        className="h-5 w-5 text-pink-600 focus:ring-pink-500"
                      />
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <Printer className="h-6 w-6 text-pink-400" />
                        <div>
                          <div className="font-bold text-white">Wired Printer (USB/POS)</div>
                          <div className="text-xs text-zinc-400">Print receipt directly to a connected wired printer</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="printerType"
                        value="wire"
                        checked={printerType === 'wire'}
                        onChange={(e) => setPrinterType(e.target.value)}
                        className="h-5 w-5 text-pink-600 focus:ring-pink-500"
                      />
                    </label>

                    <label className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Bluetooth className="h-6 w-6 text-pink-400" />
                          <div>
                            <div className="font-bold text-white">Bluetooth Printer</div>
                            <div className="text-xs text-zinc-400">Print wirelessly to a nearby Bluetooth printer</div>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="printerType"
                          value="bluetooth"
                          checked={printerType === 'bluetooth'}
                          onChange={(e) => setPrinterType(e.target.value)}
                          className="h-5 w-5 text-pink-600 focus:ring-pink-500"
                        />
                      </div>
                      {printerType === 'bluetooth' && (
                        <div className="mt-4 border-t border-zinc-800 pt-4 pl-9">
                          <div className="flex flex-col gap-3">
                            <button
                              onClick={(e) => { e.preventDefault(); scanBluetooth(); }}
                              disabled={isScanning}
                              className="flex w-fit items-center gap-2 rounded-xl btn-theme-primary px-5 py-2 text-xs font-bold text-white shadow-lg active:scale-95 disabled:opacity-50 transition cursor-pointer"
                            >
                              <Search className="h-4 w-4" />
                              {isScanning ? 'Scanning...' : 'Scan for Devices'}
                            </button>
                            {bluetoothPrinter ? (
                              <div className="flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/15 p-2.5 rounded-xl border border-emerald-500/30 w-fit">
                                <CheckCircle2 className="h-4 w-4" />
                                Connected: <strong>{bluetoothPrinter.name}</strong>
                              </div>
                            ) : (
                              <div className="text-xs text-zinc-500">No Bluetooth printer selected.</div>
                            )}
                          </div>
                        </div>
                      )}
                    </label>

                    <label className="flex flex-col rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Wifi className="h-6 w-6 text-pink-400" />
                          <div>
                            <div className="font-bold text-white">WiFi / Network Printer</div>
                            <div className="text-xs text-zinc-400">Print to a network IP printer</div>
                          </div>
                        </div>
                        <input
                          type="radio"
                          name="printerType"
                          value="wifi"
                          checked={printerType === 'wifi'}
                          onChange={(e) => setPrinterType(e.target.value)}
                          className="h-5 w-5 text-pink-600 focus:ring-pink-500"
                        />
                      </div>
                      {printerType === 'wifi' && (
                        <div className="mt-4 border-t border-zinc-800 pt-4 pl-9">
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Device Name</label>
                              <input type="text" value={wifiName} onChange={e => setWifiName(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2.5 text-sm text-white outline-none focus:border-pink-500" placeholder="Network Printer" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">IP Address</label>
                              <input type="text" value={wifiIp} onChange={e => setWifiIp(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2.5 text-sm text-white font-mono outline-none focus:border-pink-500" placeholder="192.168.1.100" />
                            </div>
                            <div>
                              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">Port</label>
                              <input type="text" value={wifiPort} onChange={e => setWifiPort(e.target.value)} className="w-full rounded-xl border border-zinc-700 bg-zinc-950 p-2.5 text-sm text-white font-mono outline-none focus:border-pink-500" placeholder="9100" />
                            </div>
                            <div className="flex items-end">
                              <button
                                onClick={(e) => { e.preventDefault(); saveWifi(); }}
                                className="flex w-full items-center justify-center gap-2 rounded-xl btn-theme-primary px-5 py-2.5 text-xs font-bold text-white shadow-lg active:scale-95 transition cursor-pointer"
                              >
                                Save WiFi Printer
                              </button>
                            </div>
                          </div>
                          {wifiPrinter && (
                            <div className="mt-3 flex items-center gap-2 text-xs text-emerald-400 bg-emerald-500/15 p-2.5 rounded-xl border border-emerald-500/30 w-fit">
                              <CheckCircle2 className="h-4 w-4" />
                              Configured: <strong>{wifiPrinter.name} ({wifiPrinter.ip})</strong>
                            </div>
                          )}
                        </div>
                      )}
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div className="flex h-6 w-6 items-center justify-center font-bold text-zinc-500 text-xl">Ø</div>
                        <div>
                          <div className="font-bold text-white">No Printer</div>
                          <div className="text-xs text-zinc-400">Do not print bills automatically</div>
                        </div>
                      </div>
                      <input
                        type="radio"
                        name="printerType"
                        value="none"
                        checked={printerType === 'none'}
                        onChange={(e) => setPrinterType(e.target.value)}
                        className="h-5 w-5 text-pink-600 focus:ring-pink-500"
                      />
                    </label>
                  </div>
                </div>
              )}

              {activeTab === 'terminal' && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl text-white backdrop-blur-sm">
                  <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-xl border border-theme bg-theme-badge p-4 gap-3">
                    <div className="flex items-center gap-3">
                      <div className="rounded-xl theme-icon-box p-2.5">
                        <LayoutGrid className="h-5 w-5" />
                      </div>
                      <div>
                        <h3 className="font-bold text-sm text-theme-accent">Terminal Layout & Design Customization</h3>
                        <p className="text-xs text-zinc-400">Customize the center product grid, theme colors, card images, and touch banners.</p>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setActiveTab('terminal-design')}
                      className="rounded-xl btn-theme-primary px-4 py-2 text-xs font-bold text-white shadow-lg active:scale-95 transition shrink-0 cursor-pointer"
                    >
                      Configure Terminal Design →
                    </button>
                  </div>

                  <h2 className="mb-5 text-lg font-black text-white flex items-center gap-2">
                    <Monitor className="h-5 w-5 text-pink-400" /> Terminal Settings
                  </h2>

                  <div className="space-y-4">
                    <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-bold text-white">Cash Payment - Change Return Feature</div>
                          <div className="text-xs text-zinc-400">Enable the modal to calculate amount received and change returned during cash checkout</div>
                        </div>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${(enableCashChange ?? true) ? 'bg-theme-bar shadow-theme-glow' : 'bg-zinc-800'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={enableCashChange ?? true}
                          onChange={(e) => setEnableCashChange(e.target.checked)}
                        />
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${(enableCashChange ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </label>

                    <label className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 cursor-pointer hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-bold text-white">Apply Discount Option</div>
                          <div className="text-xs text-zinc-400">Enable or disable the discount button and field in the terminal cart panel</div>
                        </div>
                      </div>
                      <div className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 border-transparent transition-colors focus:outline-none ${(enableDiscount ?? true) ? 'bg-theme-bar shadow-theme-glow' : 'bg-zinc-800'}`}>
                        <input
                          type="checkbox"
                          className="sr-only"
                          checked={enableDiscount ?? true}
                          onChange={(e) => setEnableDiscount(e.target.checked)}
                        />
                        <span className={`pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${(enableDiscount ?? true) ? 'translate-x-5' : 'translate-x-0'}`} />
                      </div>
                    </label>

                    <div className="flex items-center justify-between rounded-xl border border-zinc-800 bg-zinc-950/60 p-4 hover:bg-zinc-800/40 transition-colors">
                      <div className="flex items-center gap-3">
                        <div>
                          <div className="font-bold text-white">Offline Sync Interval</div>
                          <div className="text-xs text-zinc-400">How often (in seconds) the terminal attempts to sync pending offline bills</div>
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
                          className="w-20 rounded-xl border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-sm text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500"
                        >
                          {[5, 10, 15, 20, 25, 30].map(val => (
                            <option key={val} value={val}>{val}</option>
                          ))}
                        </select>
                        <span className="text-xs text-zinc-400 font-bold">sec</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'shortcuts' && (
                <KeyboardShortcutsSettingsPanel />
              )}

              {activeTab === 'storage' && (
                <StorageManager />
              )}

              {activeTab === 'updates' && (
                <SoftwareUpdatesPanel />
              )}
            </>
          )}
        </div>
      </div>
    </div>
  )
}
