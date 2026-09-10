/** @type {import('tailwindcss').Config} */
export default {
  darkMode: "class",
  content: ["./index.html", "./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      colors: {
        app: "rgb(var(--bg-app) / <alpha-value>)",
        surface: "rgb(var(--bg-surface) / <alpha-value>)",
        surface2: "rgb(var(--bg-surface-2) / <alpha-value>)",
        border: "rgb(var(--border-color) / <alpha-value>)",
        primary: "rgb(var(--text-primary) / <alpha-value>)",
        secondary: "rgb(var(--text-secondary) / <alpha-value>)",
        muted: "rgb(var(--text-muted) / <alpha-value>)",
        accent: "rgb(var(--accent) / <alpha-value>)",
        "accent-fg": "rgb(var(--accent-fg) / <alpha-value>)",
        success: "rgb(var(--status-success) / <alpha-value>)",
        warning: "rgb(var(--status-warning) / <alpha-value>)",
        danger: "rgb(var(--status-danger) / <alpha-value>)",
        info: "rgb(var(--status-info) / <alpha-value>)",
      },
      fontFamily: {
        mono: ["'JetBrains Mono'", "ui-monospace", "SFMono-Regular", "Menlo", "monospace"],
        sans: ["Inter", "system-ui", "sans-serif"],
      },
      fontSize: {
        xs: "0.7rem",
        sm: "0.8rem",
      },
    },
  },
  plugins: [],
};
