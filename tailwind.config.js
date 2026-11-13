/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: { easy: "#00b8a3", medium: "#ffc01e", hard: "#ef4743" },
    },
  },
  plugins: [],
};
