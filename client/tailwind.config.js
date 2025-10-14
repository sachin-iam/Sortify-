/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        primary: {
          50: '#f8fafc',
          100: '#f1f5f9',
          200: '#e2e8f0',
          300: '#cbd5e1',
          400: '#94a3b8',
          500: '#64748b',
          600: '#475569',
          700: '#334155',
          800: '#1e293b',
          900: '#0f172a',
        },
        // Muted pastel accents
        sage: {
          50: '#f7f8f6',
          100: '#eef0eb',
          200: '#dde2d8',
          300: '#c8d0c0',
          400: '#a8b5a0',
          500: '#8a9a84',
          600: '#6d7c67',
          700: '#566254',
          800: '#464e44',
          900: '#3b4139',
        },
        terracotta: {
          50: '#fdf8f6',
          100: '#f9f0ec',
          200: '#f2e0d6',
          300: '#e7c8b8',
          400: '#d9a896',
          500: '#c9a58b',
          600: '#b08968',
          700: '#956d56',
          800: '#7b594a',
          900: '#664a3f',
        },
        periwinkle: {
          50: '#f8fafd',
          100: '#f0f4fa',
          200: '#e1e8f2',
          300: '#cbd7e8',
          400: '#b4c7e7',
          500: '#8fa4c7',
          600: '#6d85a8',
          700: '#566b8a',
          800: '#485770',
          900: '#3e4a5f',
        },
        dustyrose: {
          50: '#fdf9f9',
          100: '#faf2f2',
          200: '#f3e4e4',
          300: '#e9d1d1',
          400: '#d4b5b5',
          500: '#c09999',
          600: '#a87c7c',
          700: '#8f6565',
          800: '#765353',
          900: '#634545',
        },
        glass: {
          white: 'rgba(255, 255, 255, 0.15)',
          dark: 'rgba(15, 23, 42, 0.2)',
          cream: 'rgba(254, 253, 248, 0.2)',
        }
      },
      backdropBlur: {
        xs: '2px',
      },
      spacing: {
        '18': '4.5rem',
        '22': '5.5rem',
        '26': '6.5rem',
        '30': '7.5rem',
      },
      fontSize: {
        '2xs': ['0.625rem', { lineHeight: '0.875rem' }],
      },
      animation: {
        'fade-in': 'fadeIn 0.2s ease-out',
        'slide-up': 'slideUp 0.2s ease-out',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(4px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
