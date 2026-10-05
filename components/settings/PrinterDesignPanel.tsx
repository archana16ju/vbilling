"use client"

import { useState } from "react"
import { Save, RotateCcw } from "lucide-react"
import { usePrinterDesignStore } from "@/store/usePrinterDesignStore"
import { generateReceiptHtml } from "@/lib/printSystem"
import { useTerminalStore } from "@/store/useTerminalStore"

export default function PrinterDesignPanel() {
  const design = usePrinterDesignStore()
  const [activeTab, setActiveTab] = useState("company")
  const state = useTerminalStore()
  const role = (state as any).role // for preview data

  const handleSave = () => {
    alert("Printer Design Settings Saved successfully!");
  }

  const handleReset = () => {
    if (confirm("Are you sure you want to reset all printer design settings to default?")) {
      design.resetDesign()
    }
  }

  // Dummy data for preview
  const previewData = {
    billId: "BILL-051026-003",
    timestamp: Date.now(),
    cashierName: role === 'admin' ? 'Admin' : 'Cashier',
    items: [
      { product: { id: "p1", name: "Biryani" }, quantity: 2, rate: 150, discount: 0, tax: 0, total: 300 }
    ],
    subtotal: 300,
    discountValue: 0,
    taxAmount: 0,
    roundOff: 0,
    total: 300,
    paymentMethod: "Cash",
    amountReceived: 500
  }

  const previewHtml = generateReceiptHtml(previewData, design)

  return (
    <div className="flex h-[calc(100vh-140px)] gap-6">
      {/* Settings Panel */}
      <div className="flex-1 flex flex-col bg-white border border-zinc-200 rounded-lg shadow-sm overflow-hidden">
        <div className="p-4 border-b border-zinc-200 flex items-center justify-between bg-zinc-50">
          <h2 className="text-lg font-semibold text-zinc-800">Printer Design Settings</h2>
          <div className="flex gap-2">
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
                      <input type="text" value={design.companyName} onChange={e => design.updateDesign({ companyName: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
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
                    <textarea value={design.location} onChange={e => design.updateDesign({ location: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" rows={2} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Show Phone</label>
                      <input type="checkbox" checked={design.showPhoneNumber} onChange={e => design.updateDesign({ showPhoneNumber: e.target.checked })} />
                    </div>
                    {design.showPhoneNumber && <input type="text" value={design.phoneNumber} onChange={e => design.updateDesign({ phoneNumber: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />}
                  </div>
                  
                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Show GST No</label>
                      <input type="checkbox" checked={design.showGstNumber} onChange={e => design.updateDesign({ showGstNumber: e.target.checked })} />
                    </div>
                    {design.showGstNumber && <input type="text" value={design.gstNumber} onChange={e => design.updateDesign({ gstNumber: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />}
                  </div>

                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Show Email</label>
                      <input type="checkbox" checked={design.showEmail} onChange={e => design.updateDesign({ showEmail: e.target.checked })} />
                    </div>
                    {design.showEmail && <input type="text" value={design.email} onChange={e => design.updateDesign({ email: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />}
                  </div>

                  <div className="space-y-2 border p-3 rounded-md">
                    <div className="flex justify-between items-center">
                      <label className="text-sm font-medium">Show Website</label>
                      <input type="checkbox" checked={design.showWebsite} onChange={e => design.updateDesign({ showWebsite: e.target.checked })} />
                    </div>
                    {design.showWebsite && <input type="text" value={design.website} onChange={e => design.updateDesign({ website: e.target.value })} className="w-full px-2 py-1 border rounded text-sm" />}
                  </div>
                </div>

                {/* Logo placeholder */}
                <div className="flex items-center justify-between mt-4 border-t pt-4">
                  <label className="text-sm font-medium text-zinc-700">Show Company Logo</label>
                  <input type="checkbox" checked={design.showLogo} onChange={e => design.updateDesign({ showLogo: e.target.checked })} className="w-4 h-4" />
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
                    <input type="text" value={design.customHeaderText} onChange={e => design.updateDesign({ customHeaderText: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
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
                  { key: 'showTime', label: 'Time' },
                  { key: 'showCashierName', label: 'Cashier / User Name' },
                  { key: 'showTableNumber', label: 'Table Number' },
                  { key: 'showOrderNumber', label: 'Order Number' }
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
                  <select value={design.dateFormat} onChange={e => design.updateDesign({ dateFormat: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm">
                    <option value="DD/MM/YYYY">DD/MM/YYYY</option>
                    <option value="DD-MM-YYYY">DD-MM-YYYY</option>
                    <option value="YYYY-MM-DD">YYYY-MM-DD</option>
                    <option value="DD MMM YYYY">DD MMM YYYY</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Time Format</label>
                  <select value={design.timeFormat} onChange={e => design.updateDesign({ timeFormat: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm">
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
                    { key: 'showRoundOff', label: 'Round Off' },
                    { key: 'showGrandTotal', label: 'Grand Total' }
                  ].map(item => (
                    <div key={item.key} className="flex items-center justify-between border-b pb-2">
                      <label className="text-sm text-zinc-700">{item.label}</label>
                      <input type="checkbox" checked={design[item.key as keyof typeof design] as boolean} onChange={e => design.updateDesign({ [item.key]: e.target.checked })} className="w-4 h-4" />
                    </div>
                  ))}
                </div>

                <div className="space-y-4 pt-4">
                  <h3 className="text-md font-semibold text-zinc-800 border-b pb-2">Payment Information</h3>
                  {[
                    { key: 'showPaymentMethod', label: 'Payment Method' },
                    { key: 'showAmountPaid', label: 'Amount Paid' },
                    { key: 'showChange', label: 'Change / Balance' },
                    { key: 'showTransactionId', label: 'Transaction ID' }
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
                    <textarea value={design.footerText} onChange={e => design.updateDesign({ footerText: e.target.value })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" rows={3} />
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
                  <select value={design.paperSize} onChange={e => design.updateDesign({ paperSize: e.target.value as any })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm">
                    <option value="58mm">58mm Thermal</option>
                    <option value="80mm">80mm Thermal</option>
                    <option value="A4">A4 Size</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-zinc-700 mb-2">Base Font Size (px)</label>
                  <input type="number" value={design.fontSize} onChange={e => design.updateDesign({ fontSize: parseInt(e.target.value) || 14 })} className="w-full px-3 py-2 border border-zinc-300 rounded-md text-sm" />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Live Preview Panel */}
      <div className="w-[400px] bg-white border border-zinc-200 rounded-lg shadow-sm flex flex-col overflow-hidden">
        <div className="p-4 border-b border-zinc-200 bg-zinc-50">
          <h2 className="text-lg font-semibold text-zinc-800">Live Preview</h2>
        </div>
        <div className="flex-1 bg-zinc-100 p-6 flex justify-center overflow-y-auto">
          {/* Paper container */}
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
  )
}
