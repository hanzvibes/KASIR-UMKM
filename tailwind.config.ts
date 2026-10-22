import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#18251e",
        muted: "#68776e",
        line: "#e2e9e3",
        canvas: "#f4f7f4",
        skeleton: "#edf1ee",
        brand: "#1d754b",
        "brand-soft": "#e6f3ea",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(23, 35, 29, 0.045)",
        card: "0 2px 8px rgba(23, 35, 29, 0.035), 0 14px 36px rgba(23, 35, 29, 0.035)",
      },
    },
  },
  plugins: [],
};
export default config;
