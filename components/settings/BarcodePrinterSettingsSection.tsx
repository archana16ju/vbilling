'use client';

import React, { useState, useEffect } from 'react';
import {
  Printer,
  Barcode,
  Wifi,
  Bluetooth,
  Usb,
  Monitor,
  Settings2,
  CheckCircle2,
  AlertCircle,
  Eye,
  Play,
  RotateCcw,
  Save,
  Code2,
  X,
  Radio,
  Sliders,
  Maximize2,
  Sparkles,
} from 'lucide-react';
import { useBarcodePrinterStore } from '@/store/useBarcodePrinterStore';
import {
  BarcodeFormatType,
  PrinterCommandLanguage,
  generateRawCommands,
} from '@/lib/barcode-printer-languages';
import { generateBarcodeSvg } from '@/lib/barcode-generator';

const POPULAR_PRINTER_MODELS = [
  { name: 'Default Windows Driver / Spooler', lang: 'driver' as const, brand: 'Generic' },
  { name: 'Zebra ZD420 / ZD220 (ZPL)', lang: 'zpl' as const, brand: 'Zebra' },
  { name: 'Zebra GK420d / GX430t (ZPL)', lang: 'zpl' as const, brand: 'Zebra' },
  { name: 'Zebra LP 2844 (EPL)', lang: 'epl' as const, brand: 'Zebra' },
  { name: 'TSC TE244 / TE200 (TSPL)', lang: 'tspl' as const, brand: 'TSC' },
  { name: 'TSC TTP-244 Pro / DA210 (TSPL)', lang: 'tspl' as const, brand: 'TSC' },
  { name: 'Xprinter XP-365B / XP-420B (TSPL)', lang: 'tspl' as const, brand: 'Xprinter' },
  { name: 'Godex G500 / RT700 (EZPL/TSPL)', lang: 'tspl' as const, brand: 'Godex' },
  { name: 'Honeywell PC42d / PC42t (ZPL/DP)', lang: 'zpl' as const, brand: 'Honeywell' },
  { name: 'Citizen CL-S621 / CL-E300 (ZPL)', lang: 'zpl' as const, brand: 'Citizen' },
  { name: 'TVS Electronics LP 46 Lite (TSPL)', lang: 'tspl' as const, brand: 'TVS' },
  { name: 'Rongta / Gprinter / HPRT Label (TSPL)', lang: 'tspl' as const, brand: 'Other' },
  { name: 'Portable Bluetooth Mobile Printer (CPCL)', lang: 'cpcl' as const, brand: 'Mobile' },
];

const PRESET_LABEL_SIZES = [
  { id: '50x25', label: '50 × 25 mm', desc: 'Standard 2" × 1"', width: 50, height: 25, gap: 3 },
  { id: '38x25', label: '38 × 25 mm', desc: 'Compact 1.5" × 1"', width: 38, height: 25, gap: 2 },
  { id: '50x38', label: '50 × 38 mm', desc: 'Spacious 2" × 1.5"', width: 50, height: 38, gap: 3 },
  { id: '100x50', label: '100 × 50 mm', desc: 'Shipping / Box 4" × 2"', width: 100, height: 50, gap: 3 },
  { id: '100x150', label: '100 × 150 mm', desc: 'Logistics 4" × 6"', width: 100, height: 150, gap: 3 },
];

const BARCODE_FORMAT_OPTIONS: { id: BarcodeFormatType; label: string; desc: string }[] = [
  { id: 'CODE128', label: 'Code 128 (Universal)', desc: 'High density, alphanumeric, most widely used' },
  { id: 'EAN13', label: 'EAN-13 (Retail Standard)', desc: '13-digit standard for retail products' },
  { id: 'UPCA', label: 'UPC-A (North America)', desc: '12-digit standard for general commerce' },
  { id: 'CODE39', label: 'Code 39 (Industrial)', desc: 'Standard for inventory, automotive and defense' },
  { id: 'ITF', label: 'ITF (Interleaved 2 of 5)', desc: 'High density numeric for cartons and packaging' },
  { id: 'QR', label: 'QR Code (2D Matrix)', desc: 'High capacity 2D barcode for smartphones and POS' },
  { id: 'DATAMATRIX', label: 'Data Matrix (2D Compact)', desc: 'Compact 2D code for small labels and electronics' },
];

export default function BarcodePrinterSettingsSection() {
  const settings = useBarcodePrinterStore();
  const [mounted, setMounted] = useState(false);
  const [isScanningBluetooth, setIsScanningBluetooth] = useState(false);
  const [isTestingConnection, setIsTestingConnection] = useState(false);
  const [connectionStatus, setConnectionStatus] = useState<{ success: boolean; message: string } | null>(null);
  const [showRawCommandsModal, setShowRawCommandsModal] = useState(false);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [systemPrinters, setSystemPrinters] = useState<string[]>([]);
  const [customModelInput, setCustomModelInput] = useState('');

  useEffect(() => {
    setMounted(true);
    // Auto-load company name if empty
    if (!settings.companyName) {
      fetch('/api/companies/active')
        .then((res) => res.json())
        .then((data) => {
          if (data?.activeCompany?.name) {
            settings.updateSettings({ companyName: data.activeCompany.name });
          }
        })
        .catch(() => {});
    }

    // Detect system printers in Electron if available
    const win = window as any;
    if (win.electronAPI?.getPrinters || win.localMysqlBridge?.getSystemPrinters) {
      const getPrinters = win.electronAPI?.getPrinters || win.localMysqlBridge?.getSystemPrinters;
      try {
        getPrinters().then((printers: any[]) => {
          if (Array.isArray(printers) && printers.length > 0) {
            setSystemPrinters(printers.map((p: any) => p.name || p));
          }
        });
      } catch {}
    }
  }, []);

  if (!mounted) return null;

  const handleApplyPresetSize = (preset: typeof PRESET_LABEL_SIZES[0]) => {
    settings.updateSettings({
      labelWidthMm: preset.width,
      labelHeightMm: preset.height,
      labelGapMm: preset.gap,
    });
  };

  const handleSelectModel = (model: typeof POPULAR_PRINTER_MODELS[0]) => {
    settings.updateSettings({
      selectedPrinterName: model.name,
      printerLanguage: model.lang,
    });
  };

  // Test Network Connection (WiFi/Ethernet)
  const handleTestNetworkConnection = async () => {
    if (!settings.networkIp) {
      setConnectionStatus({ success: false, message: 'Please enter a valid Printer IP address.' });
      return;
    }
    setIsTestingConnection(true);
    setConnectionStatus(null);
    try {
      const res = await fetch('/api/printer/barcode-label', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'test-connection',
          ip: settings.networkIp,
          port: settings.networkPort || 9100,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setConnectionStatus({ success: true, message: data.message || 'Printer connected successfully!' });
      } else {
        setConnectionStatus({ success: false, message: data.error || 'Failed to connect to printer.' });
      }
    } catch (e: any) {
      setConnectionStatus({ success: false, message: e.message || 'Network connection failed.' });
    } finally {
      setIsTestingConnection(false);
    }
  };

  // Scan Web Bluetooth
  const handleScanBluetooth = async () => {
    setIsScanningBluetooth(true);
    try {
      const nav = navigator as any;
      if (!nav.bluetooth) {
        alert('Web Bluetooth API is not supported in this browser.');
        setIsScanningBluetooth(false);
        return;
      }
      const device = await nav.bluetooth.requestDevice({
        acceptAllDevices: true,
        optionalServices: ['000018f0-0000-1000-8000-00805f9b34fb'],
      });
      if (device) {
        settings.updateSettings({
          bluetoothDeviceName: device.name || 'Bluetooth Barcode Printer',
          bluetoothDeviceMac: device.id || 'Connected',
        });
      }
    } catch (e: any) {
      if (!e.message?.includes('User cancelled')) {
        alert('Bluetooth error: ' + e.message);
      }
    } finally {
      setIsScanningBluetooth(false);
    }
  };

  // Dummy test item
  const testItem = {
    name: 'Sample Item Premium',
    code: 'SKU-10042',
    barcode: settings.defaultBarcodeFormat === 'EAN13' ? '8901030383427' : settings.defaultBarcodeFormat === 'UPCA' ? '012345678905' : 'SKU-10042',
    price: 199.0,
    copies: 1,
  };

  const rawCommands = generateRawCommands(
    settings.printerLanguage,
    {
      widthMm: settings.labelWidthMm,
      heightMm: settings.labelHeightMm,
      gapMm: settings.labelGapMm,
      marginTopMm: settings.marginTopMm,
      marginLeftMm: settings.marginLeftMm,
      density: settings.density,
      speed: settings.speed,
      dpi: settings.dpi,
      orientation: settings.orientation,
      format: settings.defaultBarcodeFormat,
      showCompanyName: settings.showCompanyName,
      companyName: settings.companyName || 'MY COMPANY',
      showProductName: settings.showProductName,
      showProductCode: settings.showProductCode,
      showPrice: settings.showPrice,
      showBarcodeText: settings.showBarcodeText,
      currencySymbol: settings.currencySymbol || '₹',
    },
    [testItem]
  );

  // Test Print Execution
  const handleTestPrint = async () => {
    if (settings.connectionType === 'network') {
      try {
        const res = await fetch('/api/printer/barcode-label', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            action: 'send-raw',
            ip: settings.networkIp,
            port: settings.networkPort || 9100,
            rawCommands,
          }),
        });
        const data = await res.json();
        if (data.success) {
          alert(`Test label sent successfully to ${settings.networkIp}:${settings.networkPort}!`);
        } else {
          alert(`Print error: ${data.error}`);
        }
      } catch (err: any) {
        alert(`Network print error: ${err.message}`);
      }
    } else {
      // Driver / Browser Print
      const printWin = window.open('', '_blank', 'width=450,height=400');
      if (printWin) {
        const svg = generateBarcodeSvg({
          value: testItem.barcode,
          format: settings.defaultBarcodeFormat,
          width: 1.8,
          height: Math.max(30, Math.round(settings.labelHeightMm * 1.5)),
          displayValue: settings.showBarcodeText,
        });

        printWin.document.write(`<!DOCTYPE html>
<html>
<head>
  <title>Test Barcode Label Print</title>
  <style>
    @page {
      size: ${settings.labelWidthMm}mm ${settings.labelHeightMm}mm;
      margin: 1mm;
    }
    body {
      margin: 0;
      padding: ${settings.marginTopMm}mm ${settings.marginLeftMm}mm;
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      box-sizing: border-box;
      height: 98vh;
    }
    .company { font-size: 8pt; font-weight: 800; text-transform: uppercase; margin-bottom: 0.5mm; }
    .product { font-size: 9pt; font-weight: 700; margin-bottom: 0.5mm; }
    .code { font-size: 7.5pt; font-family: monospace; font-weight: 600; color: #222; margin-bottom: 0.5mm; }
    .price { font-size: 9.5pt; font-weight: 800; margin-top: 1mm; }
  </style>
</head>
<body>
  ${settings.showCompanyName && settings.companyName ? `<div class="company">${settings.companyName}</div>` : ''}
  ${settings.showProductName ? `<div class="product">${testItem.name}</div>` : ''}
  ${settings.showProductCode ? `<div class="code">Code: ${testItem.code}</div>` : ''}
  <div style="width: 100%; display: flex; justify-content: center;">${svg}</div>
  ${settings.showPrice ? `<div class="price">${settings.currencySymbol}${testItem.price.toFixed(2)}</div>` : ''}
  <script>
    window.onload = function() {
      window.print();
      setTimeout(function() { window.close(); }, 500);
    };
  </script>
</body>
</html>`);
        printWin.document.close();
      }
    }
  };

  const handleSave = () => {
    setSaveSuccess(true);
    setTimeout(() => setSaveSuccess(false), 2500);
  };

  return (
    <div className="mt-8 rounded-2xl border border-zinc-800 bg-zinc-900/80 p-6 shadow-xl text-white backdrop-blur-sm space-y-6">
      {/* Header Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between pb-5 border-b border-zinc-800 gap-3">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 rounded-xl bg-gradient-to-br from-pink-500/20 to-purple-600/20 border border-pink-500/30 flex items-center justify-center text-pink-400">
            <Barcode className="h-5 w-5" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-black text-white">Barcode Label Printer Settings</h2>
              <span className="rounded-full bg-pink-500/20 border border-pink-500/30 text-pink-400 text-[10px] font-black uppercase px-2 py-0.5">
                Independent
              </span>
            </div>
            <p className="text-xs text-zinc-400">
              Configure dedicated thermal label printers, command languages (ZPL, TSPL, EPL, CPCL), and paper dimensions.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => settings.resetSettings()}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-zinc-400 hover:text-white bg-zinc-950 border border-zinc-800 hover:border-zinc-700 rounded-xl transition cursor-pointer"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-white btn-theme-primary rounded-xl transition cursor-pointer active:scale-95 shadow-md shadow-pink-500/20"
          >
            <Save className="h-3.5 w-3.5" />
            {saveSuccess ? 'Saved!' : 'Save Configuration'}
          </button>
        </div>
      </div>

      {saveSuccess && (
        <div className="p-3 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 text-xs font-bold flex items-center gap-2 animate-in fade-in">
          <CheckCircle2 className="h-4 w-4 shrink-0" />
          Barcode Label Printer configuration saved successfully!
        </div>
      )}

      {/* Grid: Settings Columns & Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Left Columns: Configuration Settings */}
        <div className="lg:col-span-7 space-y-6">

          {/* 1. Connection Type */}
          <div className="space-y-3">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Printer Connection Interface
            </label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              {[
                { id: 'system' as const, label: 'Windows Driver', icon: Monitor, desc: 'Installed Driver / Spooler' },
                { id: 'usb' as const, label: 'USB Direct', icon: Usb, desc: 'USB Virtual COM / POS' },
                { id: 'network' as const, label: 'WiFi / LAN', icon: Wifi, desc: 'Raw Socket Port 9100' },
                { id: 'bluetooth' as const, label: 'Bluetooth', icon: Bluetooth, desc: 'Wireless Portable' },
              ].map((conn) => {
                const Icon = conn.icon;
                const isSelected = settings.connectionType === conn.id;
                return (
                  <button
                    key={conn.id}
                    type="button"
                    onClick={() => settings.updateSettings({ connectionType: conn.id })}
                    className={`flex flex-col items-center justify-center p-3 rounded-xl border text-center transition cursor-pointer ${
                      isSelected
                        ? 'border-pink-500 bg-pink-500/15 text-white ring-1 ring-pink-500/40 shadow-sm'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <Icon className={`h-5 w-5 mb-1.5 ${isSelected ? 'text-pink-400' : 'text-zinc-500'}`} />
                    <span className="text-xs font-bold">{conn.label}</span>
                    <span className="text-[10px] text-zinc-500 mt-0.5">{conn.desc}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* 1.1 Connection Specific Parameters */}
          {settings.connectionType === 'network' && (
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Wifi className="h-4 w-4 text-pink-400" /> Network Printer (Ethernet LAN / WiFi)
                </span>
                <span className="text-[10px] text-zinc-500">Port 9100 (Standard RAW)</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="sm:col-span-2">
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">Printer IP Address</label>
                  <input
                    type="text"
                    value={settings.networkIp}
                    onChange={(e) => settings.updateSettings({ networkIp: e.target.value })}
                    placeholder="192.168.1.200"
                    className="w-full text-xs font-mono h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none focus:border-pink-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-zinc-400 mb-1">RAW Port</label>
                  <input
                    type="text"
                    value={settings.networkPort}
                    onChange={(e) => settings.updateSettings({ networkPort: e.target.value })}
                    placeholder="9100"
                    className="w-full text-xs font-mono h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none focus:border-pink-500"
                  />
                </div>
              </div>
              <div className="flex items-center gap-3 pt-1">
                <button
                  type="button"
                  onClick={handleTestNetworkConnection}
                  disabled={isTestingConnection}
                  className="px-4 py-2 text-xs font-bold rounded-xl btn-theme-primary text-white shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isTestingConnection ? 'Testing...' : 'Test Network Connection'}
                </button>
                {connectionStatus && (
                  <span className={`text-xs font-bold flex items-center gap-1.5 ${connectionStatus.success ? 'text-emerald-400' : 'text-rose-400'}`}>
                    {connectionStatus.success ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                    {connectionStatus.message}
                  </span>
                )}
              </div>
            </div>
          )}

          {settings.connectionType === 'bluetooth' && (
            <div className="p-4 rounded-xl border border-zinc-800 bg-zinc-950/60 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-white flex items-center gap-1.5">
                  <Bluetooth className="h-4 w-4 text-pink-400" /> Bluetooth Wireless Printer
                </span>
              </div>
              <div className="flex flex-col sm:flex-row items-center gap-3">
                <button
                  type="button"
                  onClick={handleScanBluetooth}
                  disabled={isScanningBluetooth}
                  className="px-4 py-2 text-xs font-bold rounded-xl btn-theme-primary text-white shadow transition cursor-pointer active:scale-95 disabled:opacity-50"
                >
                  {isScanningBluetooth ? 'Scanning...' : 'Pair & Connect Bluetooth Printer'}
                </button>
                {settings.bluetoothDeviceName ? (
                  <span className="text-xs font-bold text-emerald-400 bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                    Connected: {settings.bluetoothDeviceName}
                  </span>
                ) : (
                  <span className="text-xs text-zinc-500">No Bluetooth printer paired yet.</span>
                )}
              </div>
            </div>
          )}

          {/* 2. Select Connected Printer & Command Language */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Printer Hardware Model Preset
              </label>
              <select
                value={settings.selectedPrinterName}
                onChange={(e) => {
                  const m = POPULAR_PRINTER_MODELS.find((p) => p.name === e.target.value);
                  if (m) handleSelectModel(m);
                  else settings.updateSettings({ selectedPrinterName: e.target.value });
                }}
                className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-white outline-none focus:border-pink-500 cursor-pointer"
              >
                {POPULAR_PRINTER_MODELS.map((p) => (
                  <option key={p.name} value={p.name}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Printer Command Language
              </label>
              <select
                value={settings.printerLanguage}
                onChange={(e) => settings.updateSettings({ printerLanguage: e.target.value as PrinterCommandLanguage })}
                className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-white outline-none focus:border-pink-500 cursor-pointer font-semibold"
              >
                <option value="driver">Windows Driver (HTML / Vector Print)</option>
                <option value="tspl">TSPL / TSPL2 (TSC, Xprinter, Gprinter)</option>
                <option value="zpl">ZPL II (Zebra, Citizen, Honeywell)</option>
                <option value="epl">EPL2 (Eltron, Zebra 2844)</option>
                <option value="cpcl">CPCL (Mobile / Portable Bluetooth)</option>
              </select>
            </div>
          </div>

          {/* Detected Windows Printers (in Electron) */}
          {systemPrinters.length > 0 && (
            <div className="p-3 rounded-xl border border-zinc-800 bg-zinc-950/40 text-xs">
              <span className="font-bold text-zinc-300 block mb-1.5">Detected Windows Installed Printers:</span>
              <div className="flex flex-wrap gap-1.5">
                {systemPrinters.map((pr) => (
                  <button
                    key={pr}
                    type="button"
                    onClick={() => settings.updateSettings({ selectedPrinterName: pr, connectionType: 'system' })}
                    className={`px-2.5 py-1 rounded-lg border text-[11px] font-semibold transition cursor-pointer ${
                      settings.selectedPrinterName === pr
                        ? 'bg-pink-500/20 text-pink-300 border-pink-500/40'
                        : 'bg-zinc-900 border-zinc-800 text-zinc-400 hover:text-white'
                    }`}
                  >
                    {pr}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* 3. Label Paper Size Presets & Geometry */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <div className="flex items-center justify-between">
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
                Label Dimensions (Width × Height)
              </label>
              <span className="text-[11px] text-pink-400 font-mono font-bold">
                {settings.labelWidthMm}mm × {settings.labelHeightMm}mm (Gap: {settings.labelGapMm}mm)
              </span>
            </div>

            {/* Quick Presets */}
            <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
              {PRESET_LABEL_SIZES.map((preset) => {
                const isActive = settings.labelWidthMm === preset.width && settings.labelHeightMm === preset.height;
                return (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handleApplyPresetSize(preset)}
                    className={`p-2 rounded-xl border text-center transition cursor-pointer ${
                      isActive
                        ? 'border-pink-500 bg-pink-500/15 text-white ring-1 ring-pink-500/40 font-bold'
                        : 'border-zinc-800 bg-zinc-950/60 text-zinc-400 hover:border-zinc-700 hover:text-white'
                    }`}
                  >
                    <div className="text-xs font-bold">{preset.label}</div>
                    <div className="text-[10px] text-zinc-500 truncate">{preset.desc}</div>
                  </button>
                );
              })}
            </div>

            {/* Custom Millimeter Adjustments */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 pt-1">
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Width (mm)</label>
                <input
                  type="number"
                  min={15}
                  max={150}
                  value={settings.labelWidthMm}
                  onChange={(e) => settings.updateSettings({ labelWidthMm: parseFloat(e.target.value) || 50 })}
                  className="w-full text-xs font-mono h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Height (mm)</label>
                <input
                  type="number"
                  min={10}
                  max={250}
                  value={settings.labelHeightMm}
                  onChange={(e) => settings.updateSettings({ labelHeightMm: parseFloat(e.target.value) || 25 })}
                  className="w-full text-xs font-mono h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Label Gap (mm)</label>
                <input
                  type="number"
                  min={0}
                  max={10}
                  value={settings.labelGapMm}
                  onChange={(e) => settings.updateSettings({ labelGapMm: parseFloat(e.target.value) || 2 })}
                  className="w-full text-xs font-mono h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none focus:border-pink-500"
                />
              </div>
              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Orientation</label>
                <select
                  value={settings.orientation}
                  onChange={(e) => settings.updateSettings({ orientation: e.target.value as 'portrait' | 'landscape' })}
                  className="w-full text-xs h-9 px-2 rounded-xl border border-zinc-700 bg-zinc-900 text-white outline-none focus:border-pink-500 cursor-pointer"
                >
                  <option value="portrait">Portrait</option>
                  <option value="landscape">Landscape</option>
                </select>
              </div>
            </div>
          </div>

          {/* 4. Hardware Calibration: Density, Speed, Resolution */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400">
              Hardware Calibration &amp; Performance
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-zinc-400">Print Darkness / Density</span>
                  <span className="text-xs font-mono font-bold text-pink-400">{settings.density}</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={15}
                  value={settings.density}
                  onChange={(e) => settings.updateSettings({ density: parseInt(e.target.value, 10) || 8 })}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-[11px] font-bold text-zinc-400">Print Speed</span>
                  <span className="text-xs font-mono font-bold text-pink-400">{settings.speed} ips</span>
                </div>
                <input
                  type="range"
                  min={1}
                  max={6}
                  value={settings.speed}
                  onChange={(e) => settings.updateSettings({ speed: parseInt(e.target.value, 10) || 3 })}
                  className="w-full accent-pink-500 cursor-pointer"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-zinc-400 mb-1">Print Resolution</label>
                <select
                  value={settings.dpi}
                  onChange={(e) => settings.updateSettings({ dpi: parseInt(e.target.value, 10) as any })}
                  className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-white outline-none focus:border-pink-500 cursor-pointer"
                >
                  <option value={203}>203 DPI (8 dots/mm - Standard)</option>
                  <option value={300}>300 DPI (12 dots/mm - High Res)</option>
                  <option value={600}>600 DPI (24 dots/mm - Ultra)</option>
                </select>
              </div>
            </div>
          </div>

          {/* 5. Barcode Formats & Label Elements */}
          <div className="space-y-3 pt-2 border-t border-zinc-800/80">
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-zinc-400 mb-1.5">
                Default Barcode Symbology Format
              </label>
              <select
                value={settings.defaultBarcodeFormat}
                onChange={(e) => settings.updateSettings({ defaultBarcodeFormat: e.target.value as BarcodeFormatType })}
                className="w-full text-xs h-9 px-3 rounded-xl border border-zinc-700 bg-zinc-950 text-white outline-none focus:border-pink-500 cursor-pointer font-bold"
              >
                {BARCODE_FORMAT_OPTIONS.map((fmt) => (
                  <option key={fmt.id} value={fmt.id}>
                    {fmt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Elements Checkboxes */}
            <div className="space-y-2 pt-1">
              <span className="block text-[11px] font-bold text-zinc-400 uppercase tracking-wider">
                Display Elements on Label
              </span>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5 p-3 rounded-xl border border-zinc-800 bg-zinc-950/60">
                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showCompanyName}
                    onChange={(e) => settings.updateSettings({ showCompanyName: e.target.checked })}
                    className="rounded border-zinc-700 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  />
                  Company Name
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showProductName}
                    onChange={(e) => settings.updateSettings({ showProductName: e.target.checked })}
                    className="rounded border-zinc-700 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  />
                  Product Name
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showProductCode}
                    onChange={(e) => settings.updateSettings({ showProductCode: e.target.checked })}
                    className="rounded border-zinc-700 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  />
                  Code (SKU)
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showPrice}
                    onChange={(e) => settings.updateSettings({ showPrice: e.target.checked })}
                    className="rounded border-zinc-700 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  />
                  Price ({settings.currencySymbol || '₹'})
                </label>

                <label className="flex items-center gap-2 text-xs font-medium cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.showBarcodeText}
                    onChange={(e) => settings.updateSettings({ showBarcodeText: e.target.checked })}
                    className="rounded border-zinc-700 text-pink-600 focus:ring-pink-500 h-4 w-4"
                  />
                  Barcode Digits
                </label>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Live Interactive Label Preview & Test Print */}
        <div className="lg:col-span-5 flex flex-col justify-between space-y-4">
          <div className="rounded-xl border border-zinc-800 bg-zinc-950/70 p-4 space-y-3">
            <div className="flex items-center justify-between pb-2 border-b border-zinc-800/60">
              <div className="flex items-center gap-2">
                <Eye className="h-4 w-4 text-pink-400" />
                <span className="text-xs font-black uppercase tracking-wider text-white">
                  Live Label Preview
                </span>
              </div>
              <span className="text-[10px] font-mono text-zinc-500">
                {settings.labelWidthMm}mm × {settings.labelHeightMm}mm
              </span>
            </div>

            {/* Simulated Physical Thermal Label */}
            <div className="py-6 flex items-center justify-center bg-zinc-900/50 rounded-xl border border-dashed border-zinc-800">
              <div
                className="bg-white text-gray-900 rounded-md shadow-md border border-gray-300 p-3 flex flex-col items-center justify-center text-center transition-all"
                style={{
                  width: `${Math.min(280, Math.max(160, settings.labelWidthMm * 4.2))}px`,
                  minHeight: `${Math.min(200, Math.max(100, settings.labelHeightMm * 4.2))}px`,
                }}
              >
                {settings.showCompanyName && (
                  <div className="text-[10px] font-extrabold uppercase tracking-wider text-gray-800 truncate w-full mb-0.5">
                    {settings.companyName || 'MY COMPANY'}
                  </div>
                )}

                {settings.showProductName && (
                  <div className="text-xs font-bold text-gray-900 truncate w-full mb-0.5">
                    {testItem.name}
                  </div>
                )}

                {settings.showProductCode && (
                  <div className="text-[9px] font-mono font-semibold text-gray-700 truncate w-full mb-1">
                    Code: {testItem.code}
                  </div>
                )}

                <div
                  className="w-full flex items-center justify-center my-0.5 overflow-hidden"
                  dangerouslySetInnerHTML={{
                    __html: generateBarcodeSvg({
                      value: testItem.barcode,
                      format: settings.defaultBarcodeFormat,
                      width: 1.6,
                      height: Math.max(26, Math.min(50, Math.round(settings.labelHeightMm * 1.5))),
                      displayValue: settings.showBarcodeText,
                      fontSize: 9,
                    }),
                  }}
                />

                {settings.showPrice && (
                  <div className="text-xs font-black text-gray-900 mt-1">
                    {settings.currencySymbol}{testItem.price.toFixed(2)}
                  </div>
                )}
              </div>
            </div>

            <div className="text-[11px] text-zinc-500 text-center">
              Real-time vector rendering based on your configured paper geometry ({settings.dpi} DPI).
            </div>
          </div>

          {/* Test Printing Action Buttons */}
          <div className="space-y-2">
            <button
              type="button"
              onClick={handleTestPrint}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl btn-theme-primary text-white font-bold text-xs shadow-lg active:scale-95 transition cursor-pointer"
            >
              <Printer className="h-4 w-4" />
              <span>Test Print Label</span>
            </button>

            <button
              type="button"
              onClick={() => setShowRawCommandsModal(true)}
              className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl border border-zinc-800 bg-zinc-950 text-zinc-400 hover:text-white hover:bg-zinc-900 font-bold text-xs transition cursor-pointer"
            >
              <Code2 className="h-4 w-4" />
              <span>View Generated {settings.printerLanguage.toUpperCase()} Code</span>
            </button>
          </div>
        </div>

      </div>

      {/* Raw Commands Modal */}
      {showRawCommandsModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-sm">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl p-6 max-w-2xl w-full max-h-[85vh] flex flex-col space-y-4">
            <div className="flex items-center justify-between pb-3 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Code2 className="h-5 w-5 text-pink-400" />
                <h3 className="font-bold text-sm text-white">
                  Generated {settings.printerLanguage.toUpperCase()} Command Stream
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setShowRawCommandsModal(false)}
                className="text-zinc-500 hover:text-white p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="text-xs text-zinc-400">
              Raw bytes transmitted to thermal printhead (Density: {settings.density}, Speed: {settings.speed} ips, Resolution: {settings.dpi} DPI):
            </div>
            <textarea
              readOnly
              rows={12}
              value={rawCommands}
              className="w-full font-mono text-xs p-3 rounded-xl border border-zinc-800 bg-zinc-950 text-emerald-400 outline-none select-all"
            />
            <div className="flex justify-end">
              <button
                type="button"
                onClick={() => {
                  navigator.clipboard.writeText(rawCommands);
                  alert('Commands copied to clipboard!');
                }}
                className="px-4 py-2 rounded-xl btn-theme-primary text-xs font-bold text-white shadow cursor-pointer active:scale-95"
              >
                Copy to Clipboard
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
