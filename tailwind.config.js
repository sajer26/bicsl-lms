/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        // "Healthcare Blue" — primary brand color per UI/UX Design Spec §4
        brand: {
          50: '#EAF2FB',
          100: '#CFE3F6',
          200: '#9FC7ED',
          300: '#6FAAE4',
          400: '#3F8EDB',
          500: '#1671C9',   // primary
          600: '#0F5AA3',
          700: '#0C477F',
          800: '#09355C',
          900: '#062339',
        },
        success: { DEFAULT: '#1E9E52', bg: '#E8F7EE' },
        warning: { DEFAULT: '#D97706', bg: '#FEF3E2' },
        error: { DEFAULT: '#DC2626', bg: '#FDEAEA' },
        ink: '#111111', // primary body text — never light gray per spec
      },
      fontFamily: {
        // Primary Font per UI/UX Design Spec §5: Times New Roman
        sans: ['"Times New Roman"', 'Times', 'serif'],
      },
      borderRadius: {
        card: '12px',
        control: '8px',
      },
      boxShadow: {
        card: '0 2px 10px rgba(9, 53, 92, 0.08)',
        cardHover: '0 6px 20px rgba(9, 53, 92, 0.14)',
      },
    },
  },
  plugins: [],
};
