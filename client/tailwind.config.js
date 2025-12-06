/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        openserve: {
          green: '#00A651',
          'green-dark': '#008C45',
          'green-light': '#33B873',
        },
        warning: '#F59E0B',
        error: '#EF4444',
      },
    },
  },
  plugins: [],
}
