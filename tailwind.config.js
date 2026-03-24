/** @type {import('tailwindcss').Config} */
export default {
  darkMode: ["class"],
  content: [
    './pages/**/*.{ts,tsx}',
    './components/**/*.{ts,tsx}',
    './app/**/*.{ts,tsx}',
    './src/**/*.{ts,tsx}',
  ],
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        white: {
          DEFAULT: "#f8f9fa", // Refined darker white globally
        },
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
        // Google Stitch Design Tokens
        stitch: {
          "primary": "var(--stitch-primary)",
          "on-primary": "var(--stitch-on-primary)",
          "primary-container": "var(--stitch-primary-container)",
          "on-primary-container": "var(--stitch-on-primary-container)",
          "secondary": "var(--stitch-secondary)",
          "on-secondary": "var(--stitch-on-secondary)",
          "secondary-container": "var(--stitch-secondary-container)",
          "on-secondary-container": "var(--stitch-on-secondary-container)",
          "tertiary": "var(--stitch-tertiary)",
          "on-tertiary": "var(--stitch-on-tertiary)",
          "tertiary-container": "var(--stitch-tertiary-container)",
          "on-tertiary-container": "var(--stitch-on-tertiary-container)",
          "background": "var(--stitch-background)",
          "on-background": "var(--stitch-on-background)",
          "surface": "var(--stitch-surface)",
          "on-surface": "var(--stitch-on-surface)",
          "surface-variant": "var(--stitch-surface-variant)",
          "on-surface-variant": "var(--stitch-on-surface-variant)",
          "outline": "var(--stitch-outline)",
          "outline-variant": "var(--stitch-outline-variant)",
          "surface-container-lowest": "var(--stitch-surface-container-lowest)",
          "surface-container-low": "var(--stitch-surface-container-low)",
          "surface-container": "var(--stitch-surface-container)",
          "surface-container-high": "var(--stitch-surface-container-high)",
          "surface-container-highest": "var(--stitch-surface-container-highest)",
          // Deprecated/Compatibility tokens (linking to new variables)
          "secondary-fixed": "var(--stitch-secondary-container)",
          "tertiary-fixed": "var(--stitch-tertiary-container)",
          "inverse-surface": "var(--stitch-on-surface)",
          "inverse-on-surface": "var(--stitch-surface)",
          "surface-dim": "var(--stitch-surface-container-high)",
          "surface-bright": "var(--stitch-surface-container-low)",
        }
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        // Stitch border radius
        'stitch-sm': '0.25rem',
        'stitch-md': '0.5rem',
        'stitch-lg': '0.75rem',
      },
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        headline: ["Plus Jakarta Sans", "sans-serif"],
        body: ["Inter", "sans-serif"],
        label: ["Inter", "sans-serif"],
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0" },
          to: { opacity: "1" },
        },
        "slide-up": {
          from: { transform: "translateY(10px)", opacity: "0" },
          to: { transform: "translateY(0)", opacity: "1" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.8" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.5s ease-out",
        "slide-up": "slide-up 0.5s ease-out",
        "pulse-slow": "pulse-slow 3s infinite ease-in-out",
      },
    },
  },
  plugins: [require("tailwindcss-animate")],
}
