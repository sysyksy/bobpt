/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'dark-bg': '#0a0a0a',
        'dark-secondary': '#1a1a1a',
        'dark-border': '#2a2a2a',
        'neon-blue': '#00d4ff',
        'neon-blue-dim': '#0088aa',
      },
      boxShadow: {
        'neon': '0 0 10px rgba(0, 212, 255, 0.5)',
        'neon-strong': '0 0 20px rgba(0, 212, 255, 0.8)',
      }
    },
  },
  plugins: [],
}
