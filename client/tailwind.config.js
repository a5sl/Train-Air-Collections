/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  theme: {
    extend: {
      colors: {
        surface: {
          DEFAULT: 'rgb(var(--c-surface) / <alpha-value>)',
          card: 'rgb(var(--c-surface-card) / <alpha-value>)',
          'card-alt': 'rgb(var(--c-surface-card-alt) / <alpha-value>)',
          screen: 'rgb(var(--c-surface-screen) / <alpha-value>)',
        },
        content: {
          DEFAULT: 'rgb(var(--c-content) / <alpha-value>)',
          secondary: 'rgb(var(--c-content-secondary) / <alpha-value>)',
          tertiary: 'rgb(var(--c-content-tertiary) / <alpha-value>)',
        },
        line: {
          DEFAULT: 'rgb(var(--c-line) / <alpha-value>)',
          subtle: 'rgb(var(--c-line-subtle) / <alpha-value>)',
        },
        brand: {
          DEFAULT: 'rgb(var(--c-brand) / <alpha-value>)',
          hover: 'rgb(var(--c-brand-hover) / <alpha-value>)',
          deep: 'rgb(var(--c-brand-deep) / <alpha-value>)',
          glow: 'rgb(var(--c-brand-glow) / <alpha-value>)',
          tint: 'rgb(var(--c-brand-tint) / <alpha-value>)',
        },
        accent: {
          DEFAULT: 'rgb(var(--c-accent) / <alpha-value>)',
          tint: 'rgb(var(--c-accent-tint) / <alpha-value>)',
        },
        screentext: 'rgb(var(--c-screen-text) / <alpha-value>)',
        screendata: 'rgb(var(--c-screen-data) / <alpha-value>)',
        rail: {
          50: "#f0f4ff", 100: "#dbe4ff", 200: "#bac8ff", 300: "#91a7ff",
          400: "#748ffc", 500: "#5c7cfa", 600: "#4c6ef5", 700: "#4263eb",
          800: "#3b5bdb", 900: "#364fc7",
        },
        air: {
          50: "#e6fcf5", 100: "#c3fae8", 200: "#96f2d7", 300: "#63e6be",
          400: "#38d9a9", 500: "#20c997", 600: "#12b886", 700: "#0ca678",
          800: "#099268", 900: "#087f5b",
        },
        parchment: {
          50: "#fdfaf5", 100: "#faf5ed", 200: "#f5ede0", 300: "#ede0cc",
          400: "#e0cfb0", 500: "#d4bf98", 600: "#c4ad82", 700: "#a88f65",
          800: "#8c754f", 900: "#6b583a",
        },
        ink: {
          50: "#f5f2f0", 100: "#e8e2dc", 200: "#d4cbc3", 300: "#b8aca1",
          400: "#a89484", 500: "#8c7a6a", 600: "#6b5d50", 700: "#4a3728",
          800: "#3a2b1e", 900: "#2a1e13",
        },
        terracotta: {
          50: "#faf4f1", 100: "#f3e6df", 200: "#e8cfc3", 300: "#d9b19e",
          400: "#ca947a", 500: "#b47157", 600: "#a05e44", 700: "#854b36",
          800: "#6b3c2b", 900: "#563024",
        },
      },
      fontFamily: {
        sans: ["var(--font-body)", "system-ui", "sans-serif"],
        display: ["var(--font-display)", "serif"],
        mono: ["var(--font-mono)", "monospace"],
      },
      keyframes: {
        'fade-up': {
          '0%': { opacity: '0', transform: 'translateY(12px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        'stamp-in': {
          '0%': { opacity: '0', transform: 'scale(1.6) rotate(-10deg)' },
          '60%': { opacity: '1', transform: 'scale(0.95) rotate(-4deg)' },
          '100%': { opacity: '1', transform: 'scale(1) rotate(-4deg)' },
        },
        'spin-slow': {
          '0%': { transform: 'rotate(0deg)' },
          '100%': { transform: 'rotate(360deg)' },
        },
        'blink': {
          '0%, 100%': { opacity: '1' },
          '50%': { opacity: '0.3' },
        },
      },
      animation: {
        'fade-up': 'fade-up 0.5s cubic-bezier(.22,1,.36,1) both',
        'stamp-in': 'stamp-in 0.32s cubic-bezier(.34,1.56,.64,1) both',
        'spin-slow': 'spin-slow 2s linear infinite',
        'blink': 'blink 1s step-end infinite',
      },
    },
  },
  plugins: [],
};