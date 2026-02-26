import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        navy: { DEFAULT: "#0a0e1a", light: "#111827" },
        amber: { warm: "#c4956a", glow: "#d4a574" },
      },
      fontFamily: {
        sans: ["var(--font-inter)", "system-ui", "sans-serif"],
        mono: ["var(--font-geist-mono)", "monospace"],
      },
      backdropBlur: { glass: "24px" },
      animation: {
        "float": "float 6s ease-in-out infinite",
        "twinkle": "twinkle 3s ease-in-out infinite",
      },
      keyframes: {
        float: {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-10px)" },
        },
        twinkle: {
          "0%, 100%": { opacity: "0.3" },
          "50%": { opacity: "1" },
        },
      },
    },
  },
  plugins: [],
};
export default config;
