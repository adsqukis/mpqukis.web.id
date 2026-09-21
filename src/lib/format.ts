// Formatting helpers — Indonesian locale (Rupiah, ribuan, persen).

export const rupiah = (n: number, opts?: { compact?: boolean }): string => {
  if (opts?.compact) {
    if (Math.abs(n) >= 1_000_000_000)
      return `Rp${(n / 1_000_000_000).toFixed(1).replace('.0', '')} M`
    if (Math.abs(n) >= 1_000_000)
      return `Rp${(n / 1_000_000).toFixed(1).replace('.0', '')} jt`
    if (Math.abs(n) >= 1_000)
      return `Rp${(n / 1_000).toFixed(0)}rb`
  }
  return new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(n)
}

export const ribuan = (n: number): string =>
  new Intl.NumberFormat('id-ID').format(n)

export const persen = (n: number, digits = 1): string =>
  `${n > 0 ? '+' : ''}${n.toFixed(digits)}%`
