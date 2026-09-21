import { Icon } from '../ui/Icon'
import type { TabKey } from './Sidebar'

const TITLES: Record<TabKey, { title: string; subtitle: string }> = {
  pesanan: { title: 'Pesanan', subtitle: 'Pantau status dan resume pesanan tokomu' },
  penghasilan: { title: 'Penghasilan', subtitle: 'Rincian komponen penghasilan dan payout' },
  produk: { title: 'Produk', subtitle: 'Performa produk dan statistik siaran langsung' },
}

const TABS: TabKey[] = ['pesanan', 'penghasilan', 'produk']

export function Topbar({
  active,
  onChange,
}: {
  active: TabKey
  onChange: (k: TabKey) => void
}) {
  const t = TITLES[active]
  return (
    <header className="sticky top-0 z-10 border-b border-line bg-paper/85 backdrop-blur">
      <div className="flex items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <div>
          <h1 className="text-[19px] font-semibold tracking-tight text-ink sm:text-[22px]">
            {t.title}
          </h1>
          <p className="mt-0.5 text-[13px] text-ink-2">{t.subtitle}</p>
        </div>
        <div className="flex items-center gap-2">
          <button className="hidden h-9 items-center gap-2 rounded-xl border border-line bg-surface px-3 text-[13px] text-ink-2 hover:text-ink sm:flex">
            <Icon name="search" size={16} /> Cari
          </button>
          <button className="relative grid h-9 w-9 place-items-center rounded-xl border border-line bg-surface text-ink-2 hover:text-ink">
            <Icon name="bell" size={17} />
            <span className="absolute right-2 top-2 h-1.5 w-1.5 rounded-full bg-critical" />
          </button>
          <div className="grid h-9 w-9 place-items-center rounded-full bg-brand text-[13px] font-semibold text-white">
            G
          </div>
        </div>
      </div>

      {/* Mobile tab switcher */}
      <div className="flex gap-1 overflow-x-auto px-4 pb-2 sm:px-6 lg:hidden">
        {TABS.map((k) => (
          <button
            key={k}
            onClick={() => onChange(k)}
            className={`whitespace-nowrap rounded-lg px-3 py-1.5 text-[13px] font-medium capitalize ${
              active === k ? 'bg-brand-soft text-brand-ink' : 'text-ink-2'
            }`}
          >
            {k}
          </button>
        ))}
      </div>
    </header>
  )
}
