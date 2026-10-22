import type { Config } from "tailwindcss";

const config: Config = {
  content: ["./src/**/*.{js,ts,jsx,tsx,mdx}"],
  theme: {
    extend: {
      colors: {
        ink: "#17231d",
        muted: "#6f7c74",
        line: "#e5eae6",
        canvas: "#f6f8f6",
        skeleton: "#edf1ee",
        brand: "#217a50",
        "brand-soft": "#e5f4eb",
      },
      boxShadow: {
        soft: "0 8px 30px rgba(23, 35, 29, 0.05)",
      },
    },
  },
  plugins: [],
};
export default config;
