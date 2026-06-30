/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./pages/**/*.{js,jsx}', './components/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: { 50: '#f0fdf4', 500: '#22c55e', 700: '#15803d' },
        accessible: { low: '#ef4444', mid: '#f59e0b', high: '#22c55e' }
      }
    }
  },
  plugins: []
};
