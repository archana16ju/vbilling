'use client'
import { useTerminalStore, Sale } from "@/store/useTerminalStore"
import { IndianRupee, CreditCard, Banknote, Wallet, Receipt, X, Printer, Trash2 } from "lucide-react"
import { useState } from "react"
import { clearAllSales } from "@/lib/actions/db"

export default function SalesPage() {
  const { sales, clearSales } = useTerminalStore()
  const [selectedSale, setSelectedSale] = useState<Sale | null>(null)
  const [resetting, setResetting] = useState(false)

  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const cashSales = sales.filter(s => s.paymentMethod === 'Cash').reduce((sum, sale) => sum + sale.total, 0)
  const cardSales = sales.filter(s => s.paymentMethod === 'Card').reduce((sum, sale) => sum + sale.total, 0)
  const upiSales = sales.filter(s => s.paymentMethod === 'UPI').reduce((sum, sale) => sum + sale.total, 0)

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

  return (
    <div>
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Sales & Bills</h1>
          <p className="text-slate-500">Overview of your recent transactions.</p>
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
          disabled={resetting || sales.length === 0}
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

      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <table className="w-full text-left text-sm text-slate-600">
          <thead className="bg-slate-50 text-xs uppercase text-slate-500">
            <tr>
              <th className="px-6 py-4 font-medium">Bill ID</th>
              <th className="px-6 py-4 font-medium">Date & Time</th>
              <th className="px-6 py-4 font-medium">Items</th>
              <th className="px-6 py-4 font-medium">Payment Method</th>
              <th className="px-6 py-4 font-medium text-right">Total Amount</th>
              <th className="px-6 py-4 font-medium text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={6} className="px-6 py-12 text-center text-slate-500">
                  <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  No sales recorded yet.
                </td>
              </tr>
            ) : sales.map((sale) => (
              <tr
                key={sale.id}
                className="hover:bg-slate-50 cursor-pointer"
                onClick={() => setSelectedSale(sale)}
              >
                <td className="px-6 py-4 font-medium text-slate-900">{sale.id}</td>
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
                <td className="px-6 py-4 text-right font-bold text-slate-900">
                  ₹{sale.total.toFixed(2)}
                </td>
                <td className="px-6 py-4 text-center">
                  <button
                    onClick={(e) => { e.stopPropagation(); handlePrint(sale); }}
                    className="inline-flex items-center gap-1 rounded-md bg-slate-100 px-2 py-1 text-xs text-slate-700 hover:bg-blue-100 hover:text-blue-700"
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
            className="relative bg-white rounded-xl shadow-2xl p-6 max-h-[90vh] overflow-y-auto"
            style={{ width: '340px' }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close & Print buttons */}
            <div className="flex justify-between items-center mb-4">
              <span className="text-sm font-semibold text-slate-700">Receipt Preview</span>
              <div className="flex gap-2">
                <button
                  onClick={() => handlePrint(selectedSale)}
                  className="flex items-center gap-1 rounded-md bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700"
                >
                  <Printer className="h-3.5 w-3.5" /> Print
                </button>
                <button
                  onClick={() => setSelectedSale(null)}
                  className="flex items-center justify-center rounded-md bg-slate-100 p-1.5 hover:bg-slate-200"
                >
                  <X className="h-4 w-4 text-slate-600" />
                </button>
              </div>
            </div>

            {/* Thermal Receipt Preview */}
            <div style={{ fontFamily: "'Courier New', Courier, monospace", fontSize: '12px', color: '#000' }}>
              <div style={{ textAlign: 'center', fontWeight: 'bold', fontSize: '20px', letterSpacing: '1px', marginBottom: '2px' }}>SK BIRYANI</div>
              <div style={{ textAlign: 'center', fontSize: '10px', color: '#555', marginBottom: '8px' }}>Restaurant & Fast Food</div>
              <hr style={{ borderTop: '1px solid #000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '2px' }}>
                <span>BILL NO-{selectedSale.id.includes('-') ? selectedSale.id.split('-').pop() : selectedSale.id}</span>
                <span>{new Date(selectedSale.timestamp).toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' })}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '11px', marginBottom: '4px' }}>
                <span>Payment: {selectedSale.paymentMethod}</span>
                <span>{new Date(selectedSale.timestamp).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true })}</span>
              </div>
              <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 'bold', fontSize: '11px', borderBottom: '1px solid #000', paddingBottom: '4px', marginBottom: '4px' }}>
                <span style={{ flex: 1 }}>ITEM</span>
                <span style={{ width: '30px', textAlign: 'center' }}>QTY</span>
                <span style={{ width: '65px', textAlign: 'right' }}>AMT</span>
              </div>
              {selectedSale.items.map((item, i) => (
                <div key={i} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '3px', fontSize: '12px' }}>
                  <span style={{ flex: 1, paddingRight: '4px', wordBreak: 'break-word' }}>{item.product.name}</span>
                  <span style={{ width: '30px', textAlign: 'center' }}>{item.quantity}</span>
                  <span style={{ width: '65px', textAlign: 'right' }}>₹{(item.quantity * item.product.price).toFixed(2)}</span>
                </div>
              ))}
              <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                <span>Subtotal</span><span>₹{selectedSale.subtotal.toFixed(2)}</span>
              </div>
              {selectedSale.discount > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span>Discount</span><span>-₹{selectedSale.discount.toFixed(2)}</span>
                </div>
              )}
              {selectedSale.tax > 0 && (
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', marginBottom: '2px' }}>
                  <span>Tax</span><span>₹{selectedSale.tax.toFixed(2)}</span>
                </div>
              )}
              <hr style={{ borderTop: '1px solid #000', margin: '6px 0' }} />
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '17px', fontWeight: 'bold', padding: '2px 0' }}>
                <span>TOTAL</span><span>₹{selectedSale.total.toFixed(2)}</span>
              </div>
              <hr style={{ borderTop: '1px dashed #000', margin: '6px 0' }} />
              <div style={{ textAlign: 'center', fontSize: '11px', color: '#444', marginTop: '6px' }}>
                *** Thank You, Visit Again! ***
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

function SummaryCard({ title, value, icon: Icon, color }: { title: string, value: number, icon: React.ElementType, color: string }) {
  const colorMap: Record<string, string> = {
    blue: "bg-blue-100 text-blue-600",
    emerald: "bg-emerald-100 text-emerald-600",
    purple: "bg-purple-100 text-purple-600",
    orange: "bg-orange-100 text-orange-600",
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex items-center gap-4">
        <div className={`rounded-lg p-3 ${colorMap[color]}`}>
          <Icon className="h-6 w-6" />
        </div>
        <div>
          <p className="text-sm font-medium text-slate-500">{title}</p>
          <p className="text-2xl font-bold text-slate-900">₹{value.toFixed(2)}</p>
        </div>
      </div>
    </div>
  )
}
