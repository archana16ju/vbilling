'use client'
import { useTerminalStore } from "@/store/useTerminalStore"
import { IndianRupee, CreditCard, Banknote, Wallet, Receipt } from "lucide-react"

export default function SalesPage() {
  const { sales } = useTerminalStore()

  const totalSales = sales.reduce((sum, sale) => sum + sale.total, 0)
  const cashSales = sales.filter(s => s.paymentMethod === 'Cash').reduce((sum, sale) => sum + sale.total, 0)
  const cardSales = sales.filter(s => s.paymentMethod === 'Card').reduce((sum, sale) => sum + sale.total, 0)
  const upiSales = sales.filter(s => s.paymentMethod === 'UPI').reduce((sum, sale) => sum + sale.total, 0)

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-slate-900">Sales & Bills</h1>
        <p className="text-slate-500">Overview of your recent transactions.</p>
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
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-200">
            {sales.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-6 py-12 text-center text-slate-500">
                  <Receipt className="mx-auto mb-3 h-8 w-8 text-slate-300" />
                  No sales recorded yet.
                </td>
              </tr>
            ) : sales.map((sale) => (
              <tr key={sale.id} className="hover:bg-slate-50">
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
              </tr>
            ))}
          </tbody>
        </table>
      </div>
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
