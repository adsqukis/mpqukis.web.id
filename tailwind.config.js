/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // Surfaces — premium warm-neutral, high-end SaaS
        paper: '#f7f6f2',        // page plane
        surface: '#ffffff',      // card surface
        'surface-2': '#faf9f6',  // subtle raised
        line: '#eceae3',         // hairline border
        // Ink
        ink: '#16150f',          // primary text
        'ink-2': '#57564f',      // secondary text
        'ink-3': '#8a887f',      // muted / axis
        // Brand — Generos warm gold accent
        brand: {
          DEFAULT: '#c8892b',
          soft: '#f3e6cf',
          ink: '#8a5a12',
        },
        // Validated categorical series (dataviz palette)
        series: {
          1: '#2a78d6', // blue   — Generos Klasik
          2: '#eb6834', // orange — Generos Milk Madu
          3: '#1baf7a', // aqua   — Generos Milk Vanilla
          4: '#eda100', // yellow
          5: '#e87ba4', // magenta
        },
        // Status (fixed, never themed)
        good: '#0ca30c',
        warning: '#e0900a',
        serious: '#ec835a',
        critical: '#d03b3b',
      },
      fontFamily: {
        sans: ['system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
      },
      borderRadius: {
        xl: '14px',
        '2xl': '18px',
      },
      boxShadow: {
        card: '0 1px 2px rgba(22,21,15,0.04), 0 1px 3px rgba(22,21,15,0.06)',
        'card-hover': '0 4px 12px rgba(22,21,15,0.08), 0 2px 4px rgba(22,21,15,0.06)',
        pop: '0 8px 28px rgba(22,21,15,0.12)',
      },
    },
  },
  plugins: [],
}
