'use client'
import { usePrinterDesignStore } from '@/store/usePrinterDesignStore';
import { generateReceiptHtml } from '@/lib/printSystem';
import { useTerminalStore, Sale } from "@/store/useTerminalStore"
import { IndianRupee, CreditCard, Banknote, Wallet, Receipt, X, Printer, Trash2 } from "lucide-react"
import { useState, useEffect } from "react"
import { clearAllSales, getLiveSales } from "@/lib/actions/db"

export default function SalesPage() {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  const { sales, offlineQueue = [], clearSales } = useTerminalStore()
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [resetting, setResetting] = useState(false)
  const [liveSales, setLiveSales] = useState<Sale[]>([])

  useEffect(() => {
    const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
    if (!isElectron) {
      getLiveSales().then(res => setLiveSales(res as Sale[]));
    }
  }, []);

  const isElectron = typeof navigator !== 'undefined' && navigator.userAgent.toLowerCase().includes('electron');
  const baseSales = isElectron ? sales : liveSales;

  // Use only sales, because offline bills are already pushed to sales with syncStatus = 'PENDING_SYNC'
  const allSales = [...baseSales].sort((a, b) => b.timestamp - a.timestamp)

  const totalSales = allSales.reduce((sum, sale) => sum + sale.total, 0)
  const cashSales = allSales.filter(s => s.paymentMethod === 'Cash').reduce((sum, sale) => sum + sale.total, 0)
  const cardSales = allSales.filter(s => s.paymentMethod === 'Card').reduce((sum, sale) => sum + sale.total, 0)
  const upiSales = allSales.filter(s => s.paymentMethod === 'UPI').reduce((sum, sale) => sum + sale.total, 0)

  const handlePrint = (sale: Sale) => {
    const saleDate = new Date(sale.timestamp)
    const dateStr = saleDate.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })
    const timeStr = saleDate.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })
    const seqPart = sale.id.includes('-') ? sale.id.split('-').pop()! : sale.id

    const printWindow = window.open('', '_blank', 'width=340,height=700')
    if (printWindow) {
      printWindow.document.write(`
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Receipt</title>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Courier New', Courier, monospace; font-size: 12px; width: 80mm; max-width: 80mm; padding: 4mm 4mm; color: #000; background: #fff; }
    .restaurant-name { font-size: 18px; font-weight: bold; text-align: center; letter-spacing: 1px; margin-bottom: 2px; }
    .sub-title { font-size: 10px; text-align: center; margin-bottom: 6px; color: #333; }
    .divider { border: none; border-top: 1px dashed #000; margin: 5px 0; }
    .divider-solid { border: none; border-top: 1px solid #000; margin: 5px 0; }
    .row { display: flex; justify-content: space-between; margin: 2px 0; font-size: 12px; }
    .row .name { flex: 1; padding-right: 4px; word-break: break-word; }
    .row .qty { width: 24px; text-align: center; }
    .row .price { width: 56px; text-align: right; }
    .header-row { display: flex; justify-content: space-between; font-size: 10px; font-weight: bold; border-bottom: 1px solid #000; padding-bottom: 3px; margin-bottom: 3px; }
    .totals-row { display: flex; justify-content: space-between; padding: 2px 0; font-size: 12px; }
    .grand-total { display: flex; justify-content: space-between; font-size: 16px; font-weight: bold; padding: 4px 0; margin-top: 2px; }
    .inv-info { font-size: 10px; display: flex; justify-content: space-between; margin: 2px 0; }
    .footer { font-size: 10px; text-align: center; margin-top: 8px; color: #333; }
    @media print { body { width: 80mm; } @page { margin: 0; size: 80mm auto; } }
  </style>
</head>
<body>
  <div class="restaurant-name">SK BIRYANI</div>
  <div class="sub-title">Restaurant & Fast Food</div>
  <hr class="divider-solid">
  <div class="inv-info"><span>BILL NO-${seqPart}</span><span>${dateStr}</span></div>
  <div class="inv-info"><span>Payment: ${sale.paymentMethod}</span><span>${timeStr}</span></div>
  <hr class="divider">
  <div class="header-row">
    <span style="flex:1">ITEM</span>
    <span style="width:24px;text-align:center">QTY</span>
    <span style="width:56px;text-align:right">AMT</span>
  </div>
  ${sale.items.map(item => `
  <div class="row">
    <span class="name">${item.product.name}</span>
    <span class="qty">${item.quantity}</span>
    <span class="price">₹${(item.quantity * item.product.price).toFixed(2)}</span>
  </div>`).join('')}
  <hr class="divider">
  <div class="totals-row"><span>Subtotal</span><span>₹${sale.subtotal.toFixed(2)}</span></div>
  ${sale.discount > 0 ? `<div class="totals-row"><span>Discount</span><span>-₹${sale.discount.toFixed(2)}</span></div>` : ''}
  ${sale.tax > 0 ? `<div class="totals-row"><span>Tax</span><span>₹${sale.tax.toFixed(2)}</span></div>` : ''}
  <hr class="divider-solid">
  <div class="grand-total"><span>TOTAL</span><span>₹${sale.total.toFixed(2)}</span></div>
  <hr class="divider">
  <div class="footer">*** Thank You, Visit Again! ***</div>
  <script>
    window.onload = function() { window.print(); setTimeout(function() { window.close(); }, 1000); }
  </script>
</body>
</html>`)
      printWindow.document.close()
    }
  }

  
  if (!mounted) return null;

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-zinc-900">Sales & Bills</h1>
          <p className="text-zinc-500">Overview of your recent transactions.</p>
        </div>
        <button
          onClick={async () => {
            if (!confirm("Are you sure you want to reset ALL sales? This cannot be undone.")) return;
            setResetting(true);
            try {
              await clearAllSales();
              clearSales();
            } catch (e) {
              console.error("Failed to clear sales:", e);
            } finally {
              setResetting(false);
            }
          }}
          disabled={resetting || allSales.length === 0}
          className="flex items-center gap-2 rounded-lg bg-red-50 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-100 disabled:opacity-40 border border-red-200"
        >
          <Trash2 className="h-4 w-4" />
          {resetting ? "Resetting..." : "Reset All Sales"}
        </button>
      </div>

      <div className="mb-8 grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <SummaryCard title="Total Revenue" value={totalSales} icon={IndianRupee} color="blue" />
        <SummaryCard title="Cash Sales" value={cashSales} icon={Banknote} color="emerald" />
        <SummaryCard title="Card Sales" value={cardSales} icon={CreditCard} color="purple" />
        <SummaryCard title="UPI Sales" value={upiSales} icon={Wallet} color="orange" />
      </div>

      <div className="rounded-xl border border-zinc-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-6 py-4 font-medium">Bill ID</th>
              <th className="px-6 py-4 font-medium">Date & Time</th>
              <th className="px-6 py-4 font-medium">Items</th>
              <th className="px-6 py-4 font-medium">Payment Method</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Total Amount</th>
              <th className="px-6 py-4 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {allSales.length === 0 ? (
              <tr>
                <td colSpan={7} className="px-6 py-12 text-center text-zinc-500">
                  <Receipt className="mx-auto mb-3 h-8 w-8 text-zinc-300" />
                  No sales recorded yet.
                </td>
              </tr>
            ) : allSales.map((sale, index) => (
              <tr
                key={`${sale.id}-${index}`}
                className="hover:bg-zinc-50 cursor-pointer"
                onClick={() => setSelectedSale(sale)}
              >
                <td className="px-6 py-4 font-medium text-zinc-900">{sale.id}</td>
                <td className="px-6 py-4">
                  {new Date(sale.timestamp).toLocaleDateString()} {new Date(sale.timestamp).toLocaleTimeString()}
                </td>
                <td className="px-6 py-4">
                  {sale.items.reduce((sum, item) => sum + item.quantity, 0)} items
                </td>
                <td className="px-6 py-4">
                  <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${
                    sale.paymentMethod === 'Cash' ? 'bg-emerald-100 text-emerald-800' :
                    sale.paymentMethod === 'Card' ? 'bg-purple-100 text-purple-800' :
                    'bg-orange-100 text-orange-800'
                  }`}>
                    {sale.paymentMethod}
                  </span>
                </td>
                <td className="px-6 py-4">
                  {sale.syncStatus === 'PENDING_SYNC' ? (
                    <span className="inline-flex items-center rounded-full bg-yellow-100 px-2.5 py-0.5 text-xs font-medium text-yellow-800">
                      PENDING
                    </span>
                  ) : (
                    <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-xs font-medium text-green-800">
                      COMPLETED
                    </span>
                  )}
                </td>
                <td className="px-6 py-4 text-right font-bold text-zinc-900">
                  ₹{sale.total.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrint(sale); }}
                    className="inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-xs text-zinc-700 hover:bg-gray-200 hover:text-black"
                    title="Print Receipt"
                  >
                    <Printer className="h-3 w-3" /> Print
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Bill Preview Popup */}
      {selectedSale && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50"
          onClick={() => setSelectedSale(null)}
        >
          <div
            className="relative bg-white rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto no-scrollbar"
            style={{ width: '340px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close & Print buttons */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-zinc-700">Receipt Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePrint(selectedSale)}
                  className="flex items-center gap-1 rounded-md bg-black px-3 py-1.5 text-xs font-medium text-white hover:bg-gray-800"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="flex items-center justify-center rounded-md bg-zinc-100 p-1.5 hover:bg-zinc-200"
                >
                  <X className="h-4 w-4 text-zinc-600" />
                </button>
              </div>
            </div>

            {/* Thermal Receipt Preview */}
            <div className="bg-white overflow-hidden shadow-sm" style={{ width: '80mm', minHeight: '300px', margin: '0 auto', border: '1px solid #e4e4e7' }}>
              <iframe
                 title="Receipt Preview"
                 srcDoc={generateReceiptHtml(selectedSale, usePrinterDesignStore())}
                 className="w-full h-full border-0"
                 style={{ minHeight: '400px' }}
               />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: React.ElementType, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-gray-200 text-black",
    emerald: "bg-emerald-100 text-emerald-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
  }

  return (
    <div className="rounded-xl border border-zinc-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorMap[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-zinc-500">{title}</p>
          <p className="text-2xl font-bold text-zinc-900">₹{value.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}

