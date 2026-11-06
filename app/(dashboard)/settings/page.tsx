'use client'
import { useState, useEffect } from 'react'
import { useTerminalStore } from "@/store/useTerminalStore"
import { Monitor, Printer, Bluetooth, Wifi, Search, CheckCircle2, Network, LayoutGrid, Barcode, ArrowRight, ArrowLeft, X, ChevronUp, ChevronDown, Maximize2, Minimize2, SlidersHorizontal } from "lucide-react"
import KeyboardShortcutsSettingsPanel from "@/components/settings/KeyboardShortcutsSettingsPanel"
import StorageManager from "@/components/settings/StorageManager"
import PrinterDesignPanel from '@/components/settings/PrinterDesignPanel';
import TerminalDesignPanel from '@/components/settings/TerminalDesignPanel';
import SoftwareUpdatesPanel from "@/components/settings/SoftwareUpdatesPanel"
import CompanyPermissionsPanel from "@/components/settings/CompanyPermissionsPanel"
import CompanyThemePanel from "@/components/settings/CompanyThemePanel"
import TaxesChargesPanel from "@/components/settings/TaxesChargesPanel"
import WhatsAppSettingsPanel from "@/components/settings/WhatsAppSettingsPanel"
import BarcodePrinterSettingsSection from "@/components/settings/BarcodePrinterSettingsSection"
import { useBarcodePrinterStore } from "@/store/useBarcodePrinterStore"

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
  const [activeTab, setActiveTab] = useState('theme')

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

  // Printer Settings Overlay State
  const barcodeSettings = useBarcodePrinterStore()
  const [printerOverlay, setPrinterOverlay] = useState<'receipt' | 'barcode' | null>(null)
  const [overlayHeightMode, setOverlayHeightMode] = useState<'compact' | 'standard' | 'tall' | 'full'>('standard')

  // Close overlay on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && printerOverlay) {
        setPrinterOverlay(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [printerOverlay])

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
          <nav className="space-y-1.5 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-3 shadow-xl backdrop-blur-sm settings-nav-menu">
            {TABS.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`settings-nav-btn w-full flex items-center px-4 py-3 text-xs font-bold uppercase tracking-wider rounded-xl transition-all cursor-pointer ${activeTab === tab.id
                  ? 'active bg-theme-bar border border-theme text-white preserve-white shadow-md shadow-theme-glow font-black'
                  : 'text-zinc-400 hover:text-white border border-transparent'
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
                <div className="space-y-6">
                  {/* Printer Hub Overview Banner */}
                  <div className="rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl backdrop-blur-sm">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                      <div>
                        <h2 className="text-xl font-black text-white flex items-center gap-2.5">
                          <Printer className="h-6 w-6 text-pink-400" />
                          Printer Settings
                        </h2>
                        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                          Select a printer category below to manage hardware connections, printing formats, and configurations in an overlay.
                        </p>
                      </div>
                      <div className="flex items-center gap-2 text-xs font-semibold px-3 py-1.5 rounded-xl border border-zinc-800 bg-zinc-950/60 text-zinc-400 shrink-0">
                        <SlidersHorizontal className="h-3.5 w-3.5 text-pink-400" />
                        <span>2 Dedicated Printer Channels</span>
                      </div>
                    </div>
                  </div>

                  {/* Two Separate Grid Cards */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    {/* Card 1: Receipt Printer */}
                    <div
                      onClick={() => setPrinterOverlay('receipt')}
                      className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl hover:border-pink-500/50 hover:bg-zinc-900 transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-pink-500/10 hover:shadow-2xl"
                    >
                      <div className="space-y-4">
                        {/* Header with Icon & Active Status Badge */}
                        <div className="flex items-start justify-between">
                          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-pink-500/20 to-purple-500/10 text-pink-400 border border-pink-500/30 group-hover:scale-105 transition-transform duration-300 shadow-inner">
                            <Printer className="h-7 w-7" />
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border border-zinc-700/80 bg-zinc-950/70 text-zinc-300">
                            <span className={`h-2 w-2 rounded-full ${printerType === 'none' ? 'bg-zinc-500' : 'bg-emerald-400 animate-pulse'}`} />
                            {printerType === 'browser' && 'Browser Print'}
                            {printerType === 'wire' && 'Wired POS (USB)'}
                            {printerType === 'bluetooth' && (bluetoothPrinter ? `BT: ${bluetoothPrinter.name}` : 'Bluetooth POS')}
                            {printerType === 'wifi' && (wifiPrinter ? `WiFi: ${wifiPrinter.ip}` : 'WiFi Network')}
                            {printerType === 'none' && 'Disabled'}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-lg font-black text-white group-hover:text-pink-300 transition-colors flex items-center gap-2">
                            Receipt Printer
                          </h3>
                          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                            Configure customer bill receipts, thermal POS printers, cash drawer kicks, and network / Bluetooth receipt printers.
                          </p>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium">Browser & ESC/POS</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium">Auto-Cut</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium">USB / BT / WiFi</span>
                        </div>
                      </div>

                      {/* Card Footer Action */}
                      <div className="pt-6 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">
                          Configure Receipt Printer
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-pink-400 group-hover:translate-x-1 transition-transform">
                          <span>Open Overlay</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>

                    {/* Card 2: Barcode Label Printer */}
                    <div
                      onClick={() => setPrinterOverlay('barcode')}
                      className="group relative flex flex-col justify-between rounded-2xl border border-zinc-800 bg-zinc-900/90 p-6 shadow-xl hover:border-cyan-500/50 hover:bg-zinc-900 transition-all duration-300 cursor-pointer overflow-hidden hover:shadow-cyan-500/10 hover:shadow-2xl"
                    >
                      <div className="space-y-4">
                        {/* Header with Icon & Active Status Badge */}
                        <div className="flex items-start justify-between">
                          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-cyan-500/20 to-blue-500/10 text-cyan-400 border border-cyan-500/30 group-hover:scale-105 transition-transform duration-300 shadow-inner">
                            <Barcode className="h-7 w-7" />
                          </div>
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-bold border border-zinc-700/80 bg-zinc-950/70 text-zinc-300">
                            <span className="h-2 w-2 rounded-full bg-cyan-400 animate-pulse" />
                            {barcodeSettings.connectionType === 'network' && (barcodeSettings.networkIp ? `LAN: ${barcodeSettings.networkIp}` : 'Network IP')}
                            {barcodeSettings.connectionType === 'usb' && 'USB Printer'}
                            {barcodeSettings.connectionType === 'bluetooth' && (barcodeSettings.bluetoothDeviceName ? `BT: ${barcodeSettings.bluetoothDeviceName}` : 'Bluetooth')}
                            {barcodeSettings.connectionType === 'system' && 'Windows Driver'}
                          </span>
                        </div>

                        {/* Title & Description */}
                        <div>
                          <h3 className="text-lg font-black text-white group-hover:text-cyan-300 transition-colors flex items-center gap-2">
                            Barcode Label Printer
                          </h3>
                          <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
                            Configure adhesive barcode & SKU label printers, customizable mm dimensions, density, speed, ZPL / TSPL / EPL / CPCL languages.
                          </p>
                        </div>

                        {/* Feature Badges */}
                        <div className="flex flex-wrap gap-1.5 pt-1">
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium font-mono uppercase">{barcodeSettings.printerLanguage}</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium">{barcodeSettings.labelWidthMm}×{barcodeSettings.labelHeightMm} mm</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium font-mono">{barcodeSettings.defaultBarcodeFormat}</span>
                          <span className="text-[10px] px-2.5 py-1 rounded-lg bg-zinc-950/80 border border-zinc-800 text-zinc-400 font-medium">Live Preview</span>
                        </div>
                      </div>

                      {/* Card Footer Action */}
                      <div className="pt-6 mt-4 border-t border-zinc-800/80 flex items-center justify-between">
                        <span className="text-xs font-bold text-zinc-400 group-hover:text-white transition-colors">
                          Configure Barcode Printer
                        </span>
                        <div className="flex items-center gap-1.5 text-xs font-bold text-cyan-400 group-hover:translate-x-1 transition-transform">
                          <span>Open Overlay</span>
                          <ArrowRight className="h-4 w-4" />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Settings Overlay Modal */}
                  {printerOverlay && (
                    <div
                      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-5 bg-black/75 backdrop-blur-sm animate-in fade-in duration-200"
                      onClick={(e) => {
                        if (e.target === e.currentTarget) setPrinterOverlay(null);
                      }}
                    >
                      <div
                        className={`w-full max-w-4xl bg-zinc-900 text-white border border-zinc-800 rounded-2xl shadow-2xl flex flex-col overflow-hidden transition-all duration-200 animate-in zoom-in-95 ${
                          overlayHeightMode === 'compact'
                            ? 'h-[60vh] max-h-[600px]'
                            : overlayHeightMode === 'tall'
                            ? 'h-[90vh] max-h-[920px]'
                            : overlayHeightMode === 'full'
                            ? 'h-[96vh]'
                            : 'h-[78vh] max-h-[800px]'
                        }`}
                      >
                        {/* Overlay Sticky Header */}
                        <div className="px-6 py-4 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur shrink-0 flex items-center justify-between gap-4">
                          <div className="flex items-center gap-3 min-w-0">
                            <div className={`p-2.5 rounded-xl border shrink-0 ${
                              printerOverlay === 'receipt'
                                ? 'bg-pink-500/10 text-pink-400 border-pink-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border-cyan-500/20'
                            }`}>
                              {printerOverlay === 'receipt' ? <Printer className="h-5 w-5" /> : <Barcode className="h-5 w-5" />}
                            </div>
                            <div className="truncate">
                              <h3 className="text-base font-black text-white truncate">
                                {printerOverlay === 'receipt' ? 'Receipt Printer Settings' : 'Barcode Label Printer Settings'}
                              </h3>
                              <p className="text-[11px] text-zinc-400 truncate">
                                {printerOverlay === 'receipt' ? 'Configure bill printing, POS cut & cash drawer' : 'Configure adhesive label dimensions, formats & command languages'}
                              </p>
                            </div>
                          </div>

                          {/* Height Controls & Close Action */}
                          <div className="flex items-center gap-2 shrink-0">
                            {/* Height Adjuster Toolbar */}
                            <div className="hidden sm:flex items-center rounded-xl border border-zinc-800 bg-zinc-950/80 p-0.5 text-xs text-zinc-400">
                              <span className="px-2 text-[10px] uppercase font-bold text-zinc-500 tracking-wider">Height</span>
                              <button
                                type="button"
                                onClick={() => {
                                  const modes: ('compact' | 'standard' | 'tall' | 'full')[] = ['compact', 'standard', 'tall', 'full'];
                                  const idx = modes.indexOf(overlayHeightMode);
                                  if (idx > 0) setOverlayHeightMode(modes[idx - 1]);
                                }}
                                disabled={overlayHeightMode === 'compact'}
                                title="Decrease Overlay Height"
                                className="p-1 rounded-lg hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                              >
                                <ChevronDown className="h-4 w-4" />
                              </button>
                              <span className="px-2 text-[11px] font-mono font-bold text-zinc-300">
                                {overlayHeightMode === 'compact' && '60%'}
                                {overlayHeightMode === 'standard' && '78%'}
                                {overlayHeightMode === 'tall' && '90%'}
                                {overlayHeightMode === 'full' && '96%'}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  const modes: ('compact' | 'standard' | 'tall' | 'full')[] = ['compact', 'standard', 'tall', 'full'];
                                  const idx = modes.indexOf(overlayHeightMode);
                                  if (idx < modes.length - 1) setOverlayHeightMode(modes[idx + 1]);
                                }}
                                disabled={overlayHeightMode === 'full'}
                                title="Increase Overlay Height"
                                className="p-1 rounded-lg hover:bg-zinc-800 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent transition cursor-pointer"
                              >
                                <ChevronUp className="h-4 w-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => setOverlayHeightMode(prev => prev === 'full' ? 'standard' : 'full')}
                                title={overlayHeightMode === 'full' ? 'Restore Standard Height' : 'Maximize Height'}
                                className="p-1 ml-0.5 rounded-lg hover:bg-zinc-800 hover:text-white transition cursor-pointer"
                              >
                                {overlayHeightMode === 'full' ? <Minimize2 className="h-3.5 w-3.5 text-pink-400" /> : <Maximize2 className="h-3.5 w-3.5" />}
                              </button>
                            </div>

                            {/* Back to Printers Button */}
                            <button
                              type="button"
                              onClick={() => setPrinterOverlay(null)}
                              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white text-xs font-bold transition shadow-sm cursor-pointer"
                            >
                              <ArrowLeft className="h-3.5 w-3.5" />
                              <span className="hidden sm:inline">Back to Printers</span>
                            </button>

                            {/* Close Icon Button */}
                            <button
                              type="button"
                              onClick={() => setPrinterOverlay(null)}
                              className="p-1.5 rounded-xl text-zinc-400 hover:text-white hover:bg-zinc-800 transition cursor-pointer"
                              title="Close Overlay (Esc)"
                            >
                              <X className="h-5 w-5" />
                            </button>
                          </div>
                        </div>

                        {/* Overlay Scrollable Content Area */}
                        <div className="flex-1 overflow-y-auto p-6 space-y-6 [scrollbar-width:thin] [scrollbar-color:#3f3f46_transparent]">
                          {printerOverlay === 'receipt' && (
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
                        )}

                        {printerOverlay === 'barcode' && (
                          <div>
                            <BarcodePrinterSettingsSection />
                          </div>
                        )}
                      </div>

                      {/* Overlay Sticky Footer */}
                      <div className="px-6 py-3 border-t border-zinc-800 bg-zinc-950/80 backdrop-blur shrink-0 flex items-center justify-between text-xs text-zinc-400">
                        <div>
                          {printerOverlay === 'receipt' ? (
                            <span>Active Receipt Mode: <strong className="text-pink-300 font-mono">{printerType.toUpperCase()}</strong></span>
                          ) : (
                            <span>Active Barcode Mode: <strong className="text-cyan-300 font-mono">{barcodeSettings.connectionType.toUpperCase()} ({barcodeSettings.printerLanguage.toUpperCase()})</strong></span>
                          )}
                        </div>
                        <button
                          type="button"
                          onClick={() => setPrinterOverlay(null)}
                          className="px-4 py-1.5 rounded-xl border border-zinc-700 bg-zinc-800 hover:bg-zinc-700 text-zinc-200 hover:text-white font-bold transition cursor-pointer"
                        >
                          Close & Return
                        </button>
                      </div>
                    </div>
                  </div>
                )}
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
