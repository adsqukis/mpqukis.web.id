import { Icon, type IconName } from '../ui/Icon'
import { store } from '../../data/dashboard'

export type TabKey = 'pesanan' | 'penghasilan' | 'produk'

const NAV: { key: TabKey; label: string; icon: IconName }[] = [
  { key: 'pesanan', label: 'Pesanan', icon: 'orders' },
  { key: 'penghasilan', label: 'Penghasilan', icon: 'wallet' },
  { key: 'produk', label: 'Produk', icon: 'box' },
]

export function Sidebar({
  active,
  onChange,
}: {
  active: TabKey
  onChange: (k: TabKey) => void
}) {
  return (
    <aside className="hidden w-60 shrink-0 border-r border-line bg-surface lg:flex lg:flex-col">
      <div className="flex items-center gap-2.5 px-5 py-5">
        <div className="grid h-9 w-9 place-items-center rounded-xl bg-brand text-white shadow-card">
          <Icon name="dashboard" size={18} />
        </div>
        <div className="leading-tight">
          <div className="text-[15px] font-semibold text-ink">MP Qukis</div>
          <div className="text-[11px] text-ink-3">Dashboard Seller</div>
        </div>
      </div>

      <nav className="mt-2 flex flex-col gap-1 px-3">
        {NAV.map((n) => {
          const on = active === n.key
          return (
            <button
              key={n.key}
              onClick={() => onChange(n.key)}
              className={`flex items-center gap-3 rounded-xl px-3 py-2.5 text-[14px] font-medium transition-colors ${
                on
                  ? 'bg-brand-soft text-brand-ink'
                  : 'text-ink-2 hover:bg-surface-2 hover:text-ink'
              }`}
              aria-current={on ? 'page' : undefined}
            >
              <Icon name={n.icon} size={19} />
              {n.label}
            </button>
          )
        })}
      </nav>

      <div className="mt-auto p-4">
        <div className="rounded-xl border border-line bg-surface-2 p-3">
          <div className="text-[12px] font-medium text-ink-2">{store.name}</div>
          <div className="mt-0.5 text-[11px] text-ink-3">Periode {store.periode}</div>
        </div>
      </div>
    </aside>
  )
}
