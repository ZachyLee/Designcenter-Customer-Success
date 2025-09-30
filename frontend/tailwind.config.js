/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'neumo-bg': '#e0e5ec',
        'neumo-light': '#ffffff',
        'neumo-dark': '#a3b1c6',
        'neumo-shadow-light': '#ffffff',
        'neumo-shadow-dark': '#a3b1c6',
      },
      boxShadow: {
        'neumo': '9px 9px 16px #a3b1c6, -9px -9px 16px #ffffff',
        'neumo-inset': 'inset 9px 9px 16px #a3b1c6, inset -9px -9px 16px #ffffff',
        'neumo-small': '5px 5px 10px #a3b1c6, -5px -5px 10px #ffffff',
        'neumo-button': '6px 6px 12px #a3b1c6, -6px -6px 12px #ffffff',
        'neumo-pressed': 'inset 6px 6px 12px #a3b1c6, inset -6px -6px 12px #ffffff',
      },
    },
  },
  plugins: [],
}