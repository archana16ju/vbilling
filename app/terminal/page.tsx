import TerminalHeader from "@/components/terminal/TerminalHeader"
import CategoryPanel from "@/components/terminal/CategoryPanel"
import ProductPanel from "@/components/terminal/ProductPanel"
import CartPanel from "@/components/terminal/CartPanel"

export default function TerminalPage() {
  return (
    <main className="flex h-screen flex-col bg-slate-100 overflow-hidden">
      <TerminalHeader />

      <div className="flex flex-1 overflow-hidden">
        <div className="hidden w-64 shrink-0 lg:block">
          <CategoryPanel />
        </div>

        <div className="flex-1 overflow-hidden border-l border-slate-200">
          <ProductPanel />
        </div>

        <div className="w-[380px] shrink-0 border-l border-slate-200 xl:w-[420px]">
          <CartPanel />
        </div>
      </div>
    </main>
  )
}