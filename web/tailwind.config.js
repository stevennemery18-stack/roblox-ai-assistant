/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './pages/**/*.{js,ts,jsx,tsx}',
    './components/**/*.{js,ts,jsx,tsx}',
    './app/**/*.{js,ts,jsx,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        'roblox-dark': '#191919',
        'roblox-darker': '#0f0f0f',
        'roblox-accent': '#00a2ff',
        'roblox-accent-dark': '#0081cc',
      },
    },
  },
  plugins: [],
}
