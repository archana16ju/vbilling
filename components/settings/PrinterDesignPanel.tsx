"use client"

import { useState } from "react"
import { Save, RotateCcw, Eye, X } from "lucide-react"
import { usePrinterDesignStore } from "@/store/usePrinterDesignStore"
import { generateReceiptHtml } from "@/lib/printSystem"
import { calculateRoundOff } from "@/lib/calculations"
import { useTerminalStore } from "@/store/useTerminalStore"

export default function PrinterDesignPanel() {
  const design = usePrinterDesignStore()
  const [activeTab, setActiveTab] = useState("company")
  const [showPreview, setShowPreview] = useState(false)
  const state = useTerminalStore()
  const role = (state as any).role // for preview data

  const handleSave = () => {
    alert("Receipt Design Settings Saved successfully!");
  }

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all Receipt Design Settings to default?")) {
      design.resetDesign()
    }
  }

  // Dummy data for preview demonstrating round-off
  const previewExactTotal = 34.57;
  const previewRound = calculateRoundOff(
    previewExactTotal,
    design.showRoundOff,
    design.roundOffMethod,
    design.roundOffBelow,
    design.roundOffAbove
  );

  const previewData = {
    billId: "BILL-051026-003",
    timestamp: Date.now(),
    cashierName: role === 'admin' ? 'Admin' : 'Cashier',
    items: [
      { product: { id: "p1", name: "Biryani", tax: 4.76, price: 33 }, quantity: 1, rate: 33, discount: 0, tax: 1.57, total: 34.57 }
    ],
    subtotal: 33,
    discountValue: 0,
    taxAmount: 1.57,
    tax: 1.57,
    roundOff: previewRound.roundOffAmount,
    total: previewRound.grandTotal,
    paymentMethod: "Cash",
    amountReceived: 50
  }

  const previewHtml = generateReceiptHtml(previewData, design)

  return (
    <div className="flex justify-center h-[calc(100vh-140px)] gap-6 w-full max-w-4xl mx-auto text-white">
      {/* Settings Panel */}
      <div className="flex-1 flex flex-col bg-zinc-900/90 border border-zinc-800 rounded-2xl shadow-xl overflow-hidden">
        <div className="p-4 border-b border-zinc-800 flex items-center justify-between bg-zinc-950/60">
          <h2 className="text-base font-bold text-white">Receipt Design Settings</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview(true)} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-purple-300 bg-purple-950/40 hover:bg-purple-900/50 border border-purple-500/30 rounded-xl transition cursor-pointer">
              <Eye className="w-3.5 h-3.5" /> Live Preview
            </button>
            <button onClick={handleReset} className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-bold text-rose-400 bg-rose-950/40 hover:bg-rose-900/50 border border-rose-500/30 rounded-xl transition cursor-pointer">
              <RotateCcw className="w-3.5 h-3.5" /> Reset
            </button>
            <button onClick={handleSave} className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-bold text-white btn-theme-primary rounded-xl transition cursor-pointer active:scale-95">
              <Save className="w-3.5 h-3.5" /> Save Design
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-48 bg-zinc-950/60 border-r border-zinc-800 p-2 overflow-y-auto space-y-1">
            {[
              { id: "company", label: "Company Details" },
              { id: "header", label: "Receipt Header" },
              { id: "bill", label: "Bill Info" },
              { id: "datetime", label: "Date & Time" },
              { id: "items", label: "Item Info" },
              { id: "totals", label: "Totals & Payment" },
              { id: "footer", label: "Footer" },
              { id: "layout", label: "Layout" }
            ].map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`w-full text-left px-3 py-2 rounded-xl text-xs font-bold transition cursor-pointer ${
                  activeTab === tab.id 
                    ? 'bg-gradient-to-r from-pink-950/60 to-zinc-900 text-white border border-pink-500/40' 
                    : 'text-zinc-400 hover:bg-zinc-800/60 hover:text-white'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto bg-zinc-900/40">
            {activeTab === "company" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Company Details</h3>
                
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Show Company Name</label>
                  <input type="checkbox" checked={design.showCompanyName} onChange={e => design.updateDesign({ showCompanyName: e.target.checked })} className="w-4 h-4 accent-pink-600 rounded" />
                </div>
                {design.showCompanyName && (
                  <div className="pl-4 space-y-3 border-l-2 border-pink-500/40 pb-2">
                    <div>
                      <label className="block text-xs text-zinc-400 mb-1">Company / Shop Name</label>
                      <input type="text" value={design.companyName} onChange={e => design.updateDesign({ companyName: e.target.value })} className="w-full px-3 py-2 border border-zinc-700 rounded-xl text-xs bg-zinc-950 text-white placeholder-zinc-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={design.companyNameBold} onChange={e => design.updateDesign({ companyNameBold: e.target.checked })} className="accent-pink-600" />
                      <label className="text-xs text-zinc-300">Bold Name</label>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <label className="text-xs font-semibold text-zinc-300">Show Location / Address</label>
                  <input type="checkbox" checked={design.showLocation} onChange={e => design.updateDesign({ showLocation: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                </div>
                {design.showLocation && (
                  <div className="pl-4">
                    <textarea value={design.location} onChange={e => design.updateDesign({ location: e.target.value })} className="w-full px-3 py-2 border border-zinc-700 rounded-xl text-xs bg-zinc-950 text-white placeholder-zinc-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none" rows={2} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 border border-zinc-800 bg-zinc-950/60 p-3.5 rounded-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Show Phone</label>
                      <input type="checkbox" checked={design.showPhoneNumber} onChange={e => design.updateDesign({ showPhoneNumber: e.target.checked })} className="accent-pink-600" />
                    </div>
                    {design.showPhoneNumber && <input type="text" value={design.phoneNumber} onChange={e => design.updateDesign({ phoneNumber: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-700 bg-zinc-950 rounded-lg text-xs text-white placeholder-zinc-500 focus:border-pink-500 outline-none" />}
                  </div>
                  
                  <div className="space-y-2 border border-zinc-800 bg-zinc-950/60 p-3.5 rounded-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Show GST No</label>
                      <input type="checkbox" checked={design.showGstNumber} onChange={e => design.updateDesign({ showGstNumber: e.target.checked })} className="accent-pink-600" />
                    </div>
                    {design.showGstNumber && <input type="text" value={design.gstNumber} onChange={e => design.updateDesign({ gstNumber: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-700 bg-zinc-950 rounded-lg text-xs text-white placeholder-zinc-500 focus:border-pink-500 outline-none" />}
                  </div>

                  <div className="space-y-2 border border-zinc-800 bg-zinc-950/60 p-3.5 rounded-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Show Email</label>
                      <input type="checkbox" checked={design.showEmail} onChange={e => design.updateDesign({ showEmail: e.target.checked })} className="accent-pink-600" />
                    </div>
                    {design.showEmail && <input type="text" value={design.email} onChange={e => design.updateDesign({ email: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-700 bg-zinc-950 rounded-lg text-xs text-white placeholder-zinc-500 focus:border-pink-500 outline-none" />}
                  </div>

                  <div className="space-y-2 border border-zinc-800 bg-zinc-950/60 p-3.5 rounded-xl">
                    <div className="flex justify-between items-center">
                      <label className="text-xs font-semibold text-zinc-300">Show Website</label>
                      <input type="checkbox" checked={design.showWebsite} onChange={e => design.updateDesign({ showWebsite: e.target.checked })} className="accent-pink-600" />
                    </div>
                    {design.showWebsite && <input type="text" value={design.website} onChange={e => design.updateDesign({ website: e.target.value })} className="w-full px-2.5 py-1.5 border border-zinc-700 bg-zinc-950 rounded-lg text-xs text-white placeholder-zinc-500 focus:border-pink-500 outline-none" />}
                  </div>
                </div>
              </div>
            )}

            {activeTab === "header" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Receipt Header</h3>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Show Header</label>
                  <input type="checkbox" checked={design.showHeader} onChange={e => design.updateDesign({ showHeader: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                </div>
                {design.showHeader && (
                  <div>
                    <label className="block text-xs text-zinc-400 mb-1">Custom Header Text</label>
                    <input type="text" value={design.customHeaderText} onChange={e => design.updateDesign({ customHeaderText: e.target.value })} className="w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none" />
                  </div>
                )}
              </div>
            )}

            {activeTab === "bill" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Bill Information</h3>
                {[
                  { key: 'showBillId', label: 'Bill ID' },
                  { key: 'showDate', label: 'Date' },
                  { key: 'showTime', label: 'Time' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                    <label className="text-xs font-semibold text-zinc-300">{item.label}</label>
                    <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === "datetime" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Date & Time Formats</h3>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Date Format</label>
                  <select value={design.dateFormat} onChange={e => design.updateDesign({ dateFormat: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Time Format</label>
                  <select value={design.timeFormat} onChange={e => design.updateDesign({ timeFormat: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500">
                    <option value="12-hour">12-hour (e.g. 03:30 PM)</option>
                    <option value="24-hour">24-hour (e.g. 15:30)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === "items" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Item Information</h3>
                {[
                  { key: 'showItemName', label: 'Item Name' },
                  { key: 'showSku', label: 'SKU' },
                  { key: 'showQuantity', label: 'Quantity' },
                  { key: 'showUnit', label: 'Unit' },
                  { key: 'showRate', label: 'Rate' },
                  { key: 'showItemDiscount', label: 'Discount' },
                  { key: 'showItemTax', label: 'Tax' },
                  { key: 'showItemTotal', label: 'Item Total' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                    <label className="text-xs font-semibold text-zinc-300">{item.label}</label>
                    <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === "totals" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Bill Totals</h3>
                  {[
                    { key: 'showSubtotal', label: 'Subtotal' },
                    { key: 'showBillDiscount', label: 'Discount' },
                    { key: 'showBillTax', label: 'Tax' },
                    { key: 'showCgstSgst', label: 'Split CGST & SGST (Auto-calculated)' },
                    { key: 'showRoundOff', label: 'Round Off' },
                    { key: 'showGrandTotal', label: 'Grand Total' }
                  ].map(item => (
                    <div key={item.key} className="border-b border-zinc-800/60 pb-2.5">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-semibold text-zinc-300">{item.label}</label>
                        <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                      </div>
                      {item.key === 'showRoundOff' && design.showRoundOff && (
                        <div className="mt-3 pl-3 border-l-2 border-pink-500/40 space-y-3 pb-1">
                          <div>
                            <label className="block text-xs font-semibold text-zinc-300 mb-1">Round-Off Method</label>
                            <select 
                              value={design.roundOffMethod || 'nearest'} 
                              onChange={e => {
                                const method = e.target.value as any;
                                if (method === 'nearest') {
                                  design.updateDesign({ roundOffMethod: method, roundOffBelow: 0.49, roundOffAbove: 0.50 });
                                } else {
                                  design.updateDesign({ roundOffMethod: method });
                                }
                              }}
                              className="w-full px-3 py-1.5 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                            >
                              <option value="nearest">Nearest Whole Rupee</option>
                              <option value="custom">Custom Threshold</option>
                              <option value="down">Always Round Down</option>
                              <option value="up">Always Round Up</option>
                              <option value="none">No Round-Off</option>
                            </select>
                          </div>

                          {(design.roundOffMethod === 'nearest' || design.roundOffMethod === 'custom') && (
                            <div className="grid grid-cols-2 gap-3 pt-1">
                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                                  Below Round-Off (₹)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1.5 text-zinc-400 text-xs font-semibold">₹</span>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    min="0.00"
                                    max="0.99"
                                    value={design.roundOffBelow !== undefined ? design.roundOffBelow : 0.49}
                                    onChange={e => {
                                      const rawVal = parseFloat(e.target.value);
                                      const below = isNaN(rawVal) ? 0 : Math.max(0, Math.min(0.99, parseFloat(rawVal.toFixed(2))));
                                      const above = parseFloat(Math.min(1.00, Math.max(0.01, below + 0.01)).toFixed(2));
                                      design.updateDesign({ 
                                        roundOffBelow: below, 
                                        roundOffAbove: above,
                                        roundOffMethod: (below !== 0.49 || above !== 0.50) ? 'custom' : design.roundOffMethod
                                      });
                                    }}
                                    className="w-full pl-6 pr-2 py-1.5 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                                    placeholder="0.49"
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Rounds down (₹0.00 - ₹{(design.roundOffBelow ?? 0.49).toFixed(2)})</span>
                              </div>

                              <div>
                                <label className="block text-xs font-semibold text-zinc-400 mb-1">
                                  Above Round-Off (₹)
                                </label>
                                <div className="relative">
                                  <span className="absolute left-2.5 top-1.5 text-zinc-400 text-xs font-semibold">₹</span>
                                  <input 
                                    type="number"
                                    step="0.01"
                                    min="0.01"
                                    max="1.00"
                                    value={design.roundOffAbove !== undefined ? design.roundOffAbove : 0.50}
                                    onChange={e => {
                                      const rawVal = parseFloat(e.target.value);
                                      const above = isNaN(rawVal) ? 0.01 : Math.max(0.01, Math.min(1.00, parseFloat(rawVal.toFixed(2))));
                                      const below = parseFloat(Math.max(0.00, Math.min(0.99, above - 0.01)).toFixed(2));
                                      design.updateDesign({ 
                                        roundOffAbove: above, 
                                        roundOffBelow: below,
                                        roundOffMethod: (below !== 0.49 || above !== 0.50) ? 'custom' : design.roundOffMethod
                                      });
                                    }}
                                    className="w-full pl-6 pr-2 py-1.5 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white focus:outline-none focus:ring-1 focus:ring-pink-500"
                                    placeholder="0.50"
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Rounds up (₹{(design.roundOffAbove ?? 0.50).toFixed(2)} - ₹0.99)</span>
                              </div>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Payment Information</h3>
                  {[
                    { key: 'showPaymentMethod', label: 'Payment Method' }
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between border-b border-zinc-800/60 pb-2.5">
                      <label className="text-xs font-semibold text-zinc-300">{item.label}</label>
                      <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "footer" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Footer</h3>
                <div className="flex items-center justify-between">
                  <label className="text-xs font-semibold text-zinc-300">Show Footer</label>
                  <input type="checkbox" checked={design.showFooter} onChange={e => design.updateDesign({ showFooter: e.target.checked })} className="w-4 h-4 accent-pink-600" />
                </div>
                {design.showFooter && (
                  <div>
                    <label className="block text-xs font-semibold text-zinc-300 mb-2">Custom Footer Text</label>
                    <textarea value={design.footerText} onChange={e => design.updateDesign({ footerText: e.target.value })} className="w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white placeholder-zinc-500 focus:border-pink-500 focus:ring-1 focus:ring-pink-500 outline-none" rows={3} />
                    <div className="flex gap-2 mt-2">
                      {["Thank You!", "Visit Again", "Thank You for Shopping"].map(t => (
                        <button key={t} onClick={() => design.updateDesign({ footerText: t })} className="px-2.5 py-1 bg-zinc-800 border border-zinc-700 text-[11px] font-bold text-zinc-300 rounded-lg hover:bg-zinc-700 hover:text-white transition cursor-pointer">
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {activeTab === "layout" && (
              <div className="space-y-4">
                <h3 className="text-sm font-bold text-white border-b border-zinc-800 pb-2">Receipt Size / Layout</h3>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Paper Size</label>
                  <select value={design.paperSize} onChange={e => design.updateDesign({ paperSize: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500">
                    <option value="58mm">58mm Thermal</option>
                    <option value="80mm">80mm Thermal</option>
                    <option value="A4">A4 Size</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-zinc-300 mb-2">Base Font Size (px)</label>
                  <input type="number" value={design.fontSize} onChange={e => design.updateDesign({ fontSize: parseInt(e.target.value) || 14 })} className="w-full px-3 py-2 border border-zinc-700 bg-zinc-950 rounded-xl text-xs text-white outline-none focus:border-pink-500 focus:ring-1 focus:ring-pink-500" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay Modal for Live Preview */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md p-4">
          <div className="bg-zinc-900 border border-zinc-800 rounded-2xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh] text-white">
            <div className="px-4 py-3 border-b border-zinc-800 flex justify-between items-center bg-zinc-950/60">
              <h3 className="font-bold text-white text-sm">Receipt Live Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-zinc-800 rounded-lg transition-colors text-zinc-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-zinc-950/80 flex-1 overflow-y-auto flex justify-center">
              <div className="bg-white shadow-2xl border border-zinc-300 rounded" style={{ width: design.paperSize === '58mm' ? '58mm' : design.paperSize === '80mm' ? '80mm' : '210mm', minHeight: '100px' }}>
                <iframe
                  title="Receipt Preview"
                  srcDoc={previewHtml}
                  className="w-full h-full border-0"
                  style={{ minHeight: '500px' }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
