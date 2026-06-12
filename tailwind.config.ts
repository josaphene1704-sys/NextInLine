import type { Config } from "tailwindcss";

const config: Config = {
  darkMode: ["class"],
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ["var(--font-sans)", "system-ui", "sans-serif"],
      },
      colors: {
        border:      "hsl(var(--border))",
        input:       "hsl(var(--input))",
        ring:        "hsl(var(--ring))",
        background:  "hsl(var(--background))",
        foreground:  "hsl(var(--foreground))",
        primary: {
          DEFAULT:    "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT:    "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        muted: {
          DEFAULT:    "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT:    "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        destructive: {
          DEFAULT:    "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        card: {
          DEFAULT:    "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      borderRadius: {
        lg:   "var(--radius)",
        md:   "calc(var(--radius) - 2px)",
        sm:   "calc(var(--radius) - 4px)",
        "4xl": "2rem",
        "5xl": "2.5rem",
      },
      boxShadow: {
        glass:           "0 4px 24px rgba(0,0,0,0.055), 0 1px 4px rgba(0,0,0,0.035), inset 0 1px 0 rgba(255,255,255,0.90)",
        "glass-md":      "0 8px 32px rgba(0,0,0,0.080), 0 2px 8px rgba(0,0,0,0.042), inset 0 1px 0 rgba(255,255,255,0.92)",
        "glass-lg":      "0 16px 48px rgba(0,0,0,0.100), 0 4px 16px rgba(0,0,0,0.055), inset 0 1px 0 rgba(255,255,255,0.94)",
        "glass-primary": "0 8px 28px hsl(345 50% 52% / 0.30), 0 2px 8px hsl(345 50% 52% / 0.16), inset 0 1px 0 rgba(255,255,255,0.26)",
      },
      backdropBlur: {
        xs:      "4px",
        sm:      "8px",
        DEFAULT: "12px",
        md:      "16px",
        lg:      "20px",
        xl:      "24px",
        "2xl":   "32px",
      },
      backgroundImage: {
        "primary-glass": "linear-gradient(148deg, hsl(345 52% 57%) 0%, hsl(345 50% 52%) 45%, hsl(345 56% 44%) 100%)",
      },
      transitionTimingFunction: {
        glass: "cubic-bezier(0.22, 0.61, 0.36, 1)",
      },
    },
  },
  plugins: [],
};

export default config;
