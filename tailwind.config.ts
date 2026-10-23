import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231d",
        muted: "#68776e",
        line: "#e2e9e3",
        canvas: "#f3f6f2",
        skeleton: "#edf1ee",
        brand: "#1d754b",
        "brand-soft": "#e6f3ea",
      },
      boxShadow: {
        soft: "0 2px 5px rgba(23, 35, 29, 0.03), 0 12px 28px rgba(23, 35, 29, 0.04)",
        card: "0 2px 6px rgba(23, 35, 29, 0.03), 0 18px 44px rgba(23, 35, 29, 0.045)",
      },
    },
  },
  plugins: [],
};
export default config;
