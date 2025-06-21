/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        'claude-bg': '#1a1a1a',
        'claude-surface': '#2a2a2a',
        'claude-border': '#3a3a3a',
        'claude-primary': '#4a9eff',
        'claude-success': '#10b981',
        'claude-warning': '#f59e0b',
        'claude-error': '#ef4444',
      }
    },
  },
  plugins: [],
}