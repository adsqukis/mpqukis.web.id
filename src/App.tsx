import { useState } from 'react'
import { Sidebar, type TabKey } from './components/layout/Sidebar'
import { Topbar } from './components/layout/Topbar'
import { OrdersTab } from './features/OrdersTab'
import { IncomeTab } from './features/IncomeTab'
import { ProductsTab } from './features/ProductsTab'

export default function App() {
  const [tab, setTab] = useState<TabKey>('pesanan')

  return (
    <div className="flex min-h-screen bg-paper">
      <Sidebar active={tab} onChange={setTab} />
      <div className="flex min-w-0 flex-1 flex-col">
        <Topbar active={tab} onChange={setTab} />
        <main className="mx-auto w-full max-w-[1200px] flex-1 px-4 py-5 sm:px-6">
          {tab === 'pesanan' && <OrdersTab />}
          {tab === 'penghasilan' && <IncomeTab />}
          {tab === 'produk' && <ProductsTab />}
        </main>
        <footer className="border-t border-line px-4 py-4 text-center text-[12px] text-ink-3 sm:px-6">
          MP Qukis · Dashboard Seller Generos Official Store
        </footer>
      </div>
    </div>
  )
}
