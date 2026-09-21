// Chart color tokens — mirror of tailwind.config series/status colors so
// Recharts (which needs raw hex) and Tailwind stay in sync.

export const SERIES = {
  1: '#2a78d6', // blue
  2: '#eb6834', // orange
  3: '#1baf7a', // aqua
  4: '#eda100', // yellow
  5: '#e87ba4', // magenta
} as const

export const STATUS = {
  good: '#0ca30c',
  warning: '#e0900a',
  serious: '#ec835a',
  critical: '#d03b3b',
  series1: '#2a78d6',
  series3: '#1baf7a',
} as const

export const INK = {
  primary: '#16150f',
  secondary: '#57564f',
  muted: '#8a887f',
  grid: '#eceae3',
}

export const seriesHex = (k: 1 | 2 | 3 | 4 | 5) => SERIES[k]
