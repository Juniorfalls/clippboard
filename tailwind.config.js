/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    screens: {
      xs: "480px",
      sm: "640px",
      md: "768px",
      lg: "1024px",
      xl: "1280px",
      "2xl": "1536px",
    },
    extend: {
      colors: {
        "warm-white": "#F9F7F4",
        "soft-black": "#1C1C1C",
        "brand-blue": {
          DEFAULT: "#3B82F6",
          hover: "#93C5FD",
          light: "#DBEAFE",
        },
        "border-gray": "#E5E7EB",
      },
      fontFamily: {
        // Swap for Satoshi later by changing the --font-sans variable in layout.tsx
        sans: ["var(--font-sans)", "Inter", "system-ui", "sans-serif"],
      },
      borderRadius: {
        // Numeric radii used across the spec: rounded-2 / rounded-3
        2: "8px",
        3: "12px",
      },
      letterSpacing: {
        // Tailwind negates this: `-tracking-1` => -0.02em
        1: "0.02em",
      },
      maxWidth: {
        shell: "1280px",
      },
      keyframes: {
        "select-in": {
          from: { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
          to: { opacity: "1", transform: "translateY(0) scale(1)" },
        },
        "select-out": {
          from: { opacity: "1", transform: "translateY(0) scale(1)" },
          to: { opacity: "0", transform: "translateY(-4px) scale(0.98)" },
        },
        marquee: {
          "0%": { transform: "translateX(0)" },
          "100%": { transform: "translateX(-50%)" },
        },
      },
      animation: {
        "select-in": "select-in 120ms ease-out",
        "select-out": "select-out 90ms ease-in",
        marquee: "marquee 38s linear infinite",
      },
    },
  },
  plugins: [],
};
