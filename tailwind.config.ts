import type { Config } from "tailwindcss";
import animate from "tailwindcss-animate";

// Couleurs en var() (pas hsl) : elles viennent de globals.css, qui gère le thème clair et sombre.
export default {
  darkMode: ["class"],
  content: ["./src/**/*.{ts,tsx}"],
  theme: {
    extend: {
      fontFamily: {
        texte: ["var(--font-texte)", "ui-sans-serif", "system-ui", "sans-serif"],
        titre: ["var(--font-titre)", "ui-sans-serif", "system-ui", "sans-serif"],
        sans: ["var(--font-texte)", "ui-sans-serif", "system-ui", "sans-serif"],
      },
      spacing: {
        // Échelle 4/8/12/16/24/32 : les valeurs usuelles sont déjà en multiples de 4.
      },
      colors: {
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: {
          DEFAULT: "var(--card)",
          foreground: "var(--card-foreground)",
        },
        popover: {
          DEFAULT: "var(--popover)",
          foreground: "var(--popover-foreground)",
        },
        primary: {
          DEFAULT: "var(--primary)",
          foreground: "var(--primary-foreground)",
        },
        secondary: {
          DEFAULT: "var(--secondary)",
          foreground: "var(--secondary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        accent: {
          DEFAULT: "var(--accent)",
          foreground: "var(--accent-foreground)",
        },
        destructive: {
          DEFAULT: "var(--destructive)",
          foreground: "var(--destructive-foreground)",
        },
        border: "var(--border)",
        input: "var(--input)",
        ring: "var(--ring)",
        // Couleurs propres à l'app.
        fond: "var(--fond)",
        surface: "var(--surface)",
        "surface-2": "var(--surface-2)",
        texte: "var(--texte)",
        "texte-discret": "var(--texte-discret)",
        bordure: "var(--bordure)",
        "bordure-champ": "var(--bordure-champ)",
        marque: "var(--marque)",
        "marque-texte": "var(--marque-texte)",
        "marque-2": "var(--marque-2)",
        "etat-ok": "var(--etat-ok)",
        "etat-orange": "var(--etat-orange)",
        "etat-rouge": "var(--etat-rouge)",
        "etat-rouge-texte": "var(--etat-rouge-texte)",
      },
      borderRadius: {
        lg: "0.75rem",
        md: "0.5rem",
        sm: "0.375rem",
      },
    },
  },
  plugins: [animate],
} satisfies Config;
