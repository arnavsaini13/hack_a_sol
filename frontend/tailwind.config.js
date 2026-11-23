/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        agri: {
          dark: '#1B5E20',       // Deep agricultural header green
          primary: '#2E7D32',    // Primary action button green
          hover: '#1B5E20',
          light: '#E8F5E9',      // Success / pill background green
          border: '#C8E6C9',
        },
        alert: {
          amber: '#EF6C00',      // Overdue / warning
          amberLight: '#FFF3E0',
          amberBorder: '#FFE0B2',
          red: '#C62828',        // Rejections / overcharge / critical alert
          redLight: '#FFEBEE',
          redBorder: '#FFCDD2',
        },
        surface: {
          bg: '#F8FAF8',         // Subtle organic off-white
          card: '#FFFFFF',       // Clean card surface
          border: '#E0E0E0',
          muted: '#F5F5F5',
        },
        text: {
          primary: '#1B2E1E',    // Deep contrast dark text
          secondary: '#4E6B52',  // Subtitle / muted text
          hint: '#757575',
        }
      },
      fontFamily: {
        sans: ['"Noto Sans Devanagari"', '"Noto Sans"', '-apple-system', 'BlinkMacSystemFont', '"Segoe UI"', 'Roboto', 'sans-serif'],
      },
      minHeight: {
        touch: '48px',
      },
      minWidth: {
        touch: '48px',
      }
    },
  },
  plugins: [],
}

