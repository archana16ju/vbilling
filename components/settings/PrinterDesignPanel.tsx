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
    <div className="flex justify-center h-[calc(100vh-140px)] gap-6 w-full max-w-4xl mx-auto">
      {/* Settings Panel */}
      <div className="flex-1 flex flex-col bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <h2 className="text-lg font-semibold text-zinc-800">Receipt Design Settings</h2>
          <div className="flex gap-2">
            <button onClick={() => setShowPreview(true)} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-indigo-600 bg-indigo-50 hover:bg-indigo-100 border border-indigo-200 rounded-md transition-colors">
              <Eye className="w-4 h-4" /> Live Preview
            </button>
            <button onClick={handleReset} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-red-600 bg-red-50 hover:bg-red-100 rounded-md transition-colors">
              <RotateCcw className="w-4 h-4" /> Reset
            </button>
            <button onClick={handleSave} className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-md transition-colors">
              <Save className="w-4 h-4" /> Save Design
            </button>
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Tabs */}
          <div className="w-48 bg-zinc-50 border-r border-zinc-200 p-2 overflow-y-auto">
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
                className={`w-full text-left px-3 py-2 rounded-md text-sm mb-1 ${activeTab === tab.id ? 'bg-indigo-100 text-indigo-700 font-medium' : 'text-zinc-600 hover:bg-zinc-100'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Form Content */}
          <div className="flex-1 p-6 overflow-y-auto">
            {activeTab === "company" && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Company Details</h3>
                
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">Show Company Name</label>
                  <input type="checkbox" checked={design.showCompanyName} onChange={e => design.updateDesign({ showCompanyName: e.target.checked })} className="w-4 h-4 text-indigo-600 rounded border-zinc-300" />
                </div>
                {design.showCompanyName && (
                  <div className="pl-6 space-y-3 border-l-2 border-indigo-100 pb-2">
                    <div>
                      <label className="block text-xs text-zinc-500 mb-1">Company / Shop Name</label>
                      <input type="text" value={design.companyName} onChange={e => design.updateDesign({ companyName: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400" />
                    </div>
                    <div className="flex items-center gap-2">
                      <input type="checkbox" checked={design.companyNameBold} onChange={e => design.updateDesign({ companyNameBold: e.target.checked })} />
                      <label className="text-xs text-zinc-700">Bold Name</label>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-between mt-4">
                  <label className="text-sm font-medium text-zinc-700">Show Location / Address</label>
                  <input type="checkbox" checked={design.showLocation} onChange={e => design.updateDesign({ showLocation: e.target.checked })} className="w-4 h-4" />
                </div>
                {design.showLocation && (
                  <div className="pl-6">
                    <textarea value={design.location} onChange={e => design.updateDesign({ location: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400" rows={2} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-zinc-900">Show Phone</label>
                      <input type="checkbox" checked={design.showPhoneNumber} onChange={e => design.updateDesign({ showPhoneNumber: e.target.checked })} />
                    </div>
                    {design.showPhoneNumber && <input type="text" value={design.phoneNumber} onChange={e => design.updateDesign({ phoneNumber: e.target.value })} className="w-full px-2 py-1 border rounded text-sm text-black placeholder:text-zinc-400" />}
                  </div>
                  
                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-zinc-900">Show GST No</label>
                      <input type="checkbox" checked={design.showGstNumber} onChange={e => design.updateDesign({ showGstNumber: e.target.checked })} />
                    </div>
                    {design.showGstNumber && <input type="text" value={design.gstNumber} onChange={e => design.updateDesign({ gstNumber: e.target.value })} className="w-full px-2 py-1 border rounded text-sm text-black placeholder:text-zinc-400" />}
                  </div>

                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-zinc-900">Show Email</label>
                      <input type="checkbox" checked={design.showEmail} onChange={e => design.updateDesign({ showEmail: e.target.checked })} />
                    </div>
                    {design.showEmail && <input type="text" value={design.email} onChange={e => design.updateDesign({ email: e.target.value })} className="w-full px-2 py-1 border rounded text-sm text-black placeholder:text-zinc-400" />}
                  </div>

                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium text-zinc-900">Show Website</label>
                      <input type="checkbox" checked={design.showWebsite} onChange={e => design.updateDesign({ showWebsite: e.target.checked })} />
                    </div>
                    {design.showWebsite && <input type="text" value={design.website} onChange={e => design.updateDesign({ website: e.target.value })} className="w-full px-2 py-1 border rounded text-sm text-black placeholder:text-zinc-400" />}
                  </div>
                </div>

                <div className="flex items-center justify-between mt-4 border-t pt-4">
                </div>
              </div>
            )}

            {activeTab === "header" && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Receipt Header</h3>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">Show Header</label>
                  <input type="checkbox" checked={design.showHeader} onChange={e => design.updateDesign({ showHeader: e.target.checked })} className="w-4 h-4" />
                </div>
                {design.showHeader && (
                  <div>
                    <label className="block text-xs text-zinc-500 mb-1">Custom Header Text</label>
                    <input type="text" value={design.customHeaderText} onChange={e => design.updateDesign({ customHeaderText: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400" />
                  </div>
                )}
              </div>
            )}

            {activeTab === "bill" && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Bill Information</h3>
                {[
                  { key: 'showBillId', label: 'Bill ID' },
                  { key: 'showDate', label: 'Date' },
                  { key: 'showTime', label: 'Time' }
                ].map(item => (
                  <div key={item.key} className="flex items-center justify-between border-b pb-2">
                    <label className="text-sm text-zinc-700">{item.label}</label>
                    <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === "datetime" && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Date & Time Formats</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Date Format</label>
                  <select value={design.dateFormat} onChange={e => design.updateDesign({ dateFormat: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Time Format</label>
                  <select value={design.timeFormat} onChange={e => design.updateDesign({ timeFormat: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400">
                    <option value="12-hour">12-hour (e.g. 03:30 PM)</option>
                    <option value="24-hour">24-hour (e.g. 15:30)</option>
                  </select>
                </div>
              </div>
            )}

            {activeTab === "items" && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Item Information</h3>
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
                  <div key={item.key} className="flex items-center justify-between border-b pb-2">
                    <label className="text-sm text-zinc-700">{item.label}</label>
                    <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4" />
                  </div>
                ))}
              </div>
            )}

            {activeTab === "totals" && (
              <div className="space-y-6">
                <div className="space-y-4">
                  <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Bill Totals</h3>
                  {[
                    { key: 'showSubtotal', label: 'Subtotal' },
                    { key: 'showBillDiscount', label: 'Discount' },
                    { key: 'showBillTax', label: 'Tax' },
                    { key: 'showCgstSgst', label: 'Split CGST & SGST (Auto-calculated)' },
                    { key: 'showRoundOff', label: 'Round Off' },
                    { key: 'showGrandTotal', label: 'Grand Total' }
                  ].map(item => (
                    <div key={item.key} className="border-b pb-2">
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-700">{item.label}</label>
                        <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4" />
                      </div>
                      {item.key === 'showRoundOff' && design.showRoundOff && (
                        <div className="mt-3 pl-3 border-l-2 border-indigo-200 space-y-3 pb-1">
                          <div>
                            <label className="block text-xs font-medium text-zinc-700 mb-1">Round-Off Method</label>
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
                              className="w-full px-3 py-1.5 border border-zinc-300 rounded-md text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                                <label className="block text-xs font-medium text-zinc-700 mb-1">
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
                                    className="w-full pl-6 pr-2 py-1.5 border border-zinc-300 rounded-md text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
                                    placeholder="0.49"
                                  />
                                </div>
                                <span className="text-[10px] text-zinc-500 block mt-0.5">Rounds down (₹0.00 - ₹{(design.roundOffBelow ?? 0.49).toFixed(2)})</span>
                              </div>

                              <div>
                                <label className="block text-xs font-medium text-zinc-700 mb-1">
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
                                    className="w-full pl-6 pr-2 py-1.5 border border-zinc-300 rounded-md text-sm text-black bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
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
                  <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Payment Information</h3>
                  {[
                    { key: 'showPaymentMethod', label: 'Payment Method' }
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between border-b pb-2">
                      <label className="text-sm text-zinc-700">{item.label}</label>
                      <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4" />
                    </div>
                  ))}
                </div>
              </div>
            )}

            {activeTab === "footer" && (
              <div className="space-y-4">
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Footer</h3>
                <div className="flex items-center justify-between">
                  <label className="text-sm font-medium text-zinc-700">Show Footer</label>
                  <input type="checkbox" checked={design.showFooter} onChange={e => design.updateDesign({ showFooter: e.target.checked })} className="w-4 h-4" />
                </div>
                {design.showFooter && (
                  <div>
                    <label className="block text-sm font-medium text-zinc-700 mb-2">Custom Footer Text</label>
                    <textarea value={design.footerText} onChange={e => design.updateDesign({ footerText: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400" rows={3} />
                    <div className="flex gap-2 mt-2">
                      {["Thank You!", "Visit Again", "Thank You for Shopping"].map(t => (
                        <button key={t} onClick={() => design.updateDesign({ footerText: t })} className="px-2 py-1 bg-zinc-100 border text-xs rounded hover:bg-zinc-200">
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
                <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Receipt Size / Layout</h3>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Paper Size</label>
                  <select value={design.paperSize} onChange={e => design.updateDesign({ paperSize: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400">
                    <option value="58mm">58mm Thermal</option>
                    <option value="80mm">80mm Thermal</option>
                    <option value="A4">A4 Size</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Base Font Size (px)</label>
                  <input type="number" value={design.fontSize} onChange={e => design.updateDesign({ fontSize: parseInt(e.target.value) || 14 })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm text-black placeholder:text-zinc-400" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Overlay Modal for Live Preview */}
      {showPreview && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
          <div className="bg-white rounded-xl shadow-2xl w-full max-w-md overflow-hidden flex flex-col max-h-[90vh]">
            <div className="px-4 py-3 border-b flex justify-between items-center bg-zinc-50">
              <h3 className="font-bold text-zinc-800">Receipt Live Preview</h3>
              <button onClick={() => setShowPreview(false)} className="p-1 hover:bg-zinc-200 rounded-md transition-colors text-zinc-500">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-6 bg-zinc-100 flex-1 overflow-y-auto flex justify-center">
              <div className="bg-white shadow-md border" style={{ width: design.paperSize === '58mm' ? '58mm' : design.paperSize === '80mm' ? '80mm' : '210mm', minHeight: '100px' }}>
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
