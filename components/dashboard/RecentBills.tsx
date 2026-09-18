import { Eye } from "lucide-react"

export default function RecentBills() {
  const bills = [
    { id: "POS-4892", time: "Today 14:32", customer: "Walk-in Customer", items: "5 items", payment: "UPI", amount: 1250, status: "Paid" },
    { id: "POS-4891", time: "Today 14:18", customer: "Ravi", items: "3 items", payment: "Cash", amount: 840, status: "Paid" },
    { id: "POS-4890", time: "Today 13:45", customer: "Sanjay", items: "12 items", payment: "Card", amount: 3450, status: "Paid" },
    { id: "POS-4889", time: "Today 12:10", customer: "Walk-in Customer", items: "1 item", payment: "Cash", amount: 120, status: "Paid" },
  ]

  return (
    <div className="rounded-xl border border-zinc-200 bg-white shadow-sm">
      <div className="border-b border-zinc-200 p-6">
        <h2 className="text-lg font-bold text-zinc-800">Recent Bills</h2>
      </div>
      <div className="overflow-x-auto p-0">
        <table className="w-full text-left text-sm text-zinc-600">
          <thead className="bg-zinc-50 text-xs uppercase text-zinc-500">
            <tr>
              <th className="px-6 py-4 font-medium">Bill No</th>
              <th className="px-6 py-4 font-medium">Date</th>
              <th className="px-6 py-4 font-medium">Customer</th>
              <th className="px-6 py-4 font-medium">Items</th>
              <th className="px-6 py-4 font-medium">Payment</th>
              <th className="px-6 py-4 font-medium">Amount</th>
              <th className="px-6 py-4 font-medium">Status</th>
              <th className="px-6 py-4 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-200">
            {bills.map((bill) => (
              <tr key={bill.id} className="hover:bg-zinc-50">
                <td className="px-6 py-4 font-medium text-zinc-900">{bill.id}</td>
                <td className="px-6 py-4">{bill.time}</td>
                <td className="px-6 py-4">{bill.customer}</td>
                <td className="px-6 py-4">{bill.items}</td>
                <td className="px-6 py-4">{bill.payment}</td>
                <td className="px-6 py-4 font-medium text-zinc-900">₹{bill.amount.toLocaleString()}</td>
                <td className="px-6 py-4">
                  <span className="rounded-full bg-green-100 px-2.5 py-1 text-xs font-medium text-green-800">
                    {bill.status}
                  </span>
                </td>
                <td className="px-6 py-4 text-right">
                  <button className="inline-flex items-center gap-1 text-black hover:text-black">
                    <Eye className="h-4 w-4" /> View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
