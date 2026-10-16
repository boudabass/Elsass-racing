import type { CSSProperties } from "react"
import type { Metadata } from "next"
import { Barlow, Barlow_Condensed } from "next/font/google"

import { ThemeProvider } from "@/components/theme-provider"
import { JournalErreurs } from "@/components/journal-erreurs"
import { prefsMembre } from "@/apps/settings/preferences-serveur"
import { variablesDeTeam } from "@/core/theme/variables"
import { teamCourante } from "@/core/auth/team-serveur"

import "./globals.css"

// Texte courant : Barlow. Titres et chiffres forts : Barlow Condensed.
const texte = Barlow({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--font-texte",
  display: "swap",
})

const titre = Barlow_Condensed({
  subsets: ["latin"],
  weight: ["600", "700", "800"],
  variable: "--font-titre",
  display: "swap",
})

export const metadata: Metadata = {
  title: "Elsass Racing",
  description: "Plateforme de gestion de team",
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Couleurs de la team courante, quand il y en a une (sinon : couleurs par défaut).
  const courante = await teamCourante().catch(() => null)
  const styleTeam = courante ? (variablesDeTeam(courante.team) as CSSProperties) : undefined
  // Préférences du membre, lues ici pour que le rendu serveur ait déjà le bon thème et la
  // bonne taille de texte (pas de flash à l'arrivée). Sans team : valeurs par défaut.
  const prefs = courante
    ? await prefsMembre({ teamId: courante.team.id, userId: courante.membership.userId, membership: { id: courante.membership.id, role: courante.membership.role } })
    : null
  const theme = prefs?.theme ?? "sombre"

  // Sombre par défaut ; « système » part en sombre et le client corrige selon le système.
  const classes = [
    texte.variable,
    titre.variable,
    theme === "clair" ? "" : "dark",
    prefs?.tailleTexte === "grande" ? "texte-grand" : "",
    prefs?.modeTerrain ? "terrain" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <html lang="fr" className={classes} style={styleTeam} suppressHydrationWarning>
      <body>
        <JournalErreurs />
        <ThemeProvider theme={theme}>{children}</ThemeProvider>
      </body>
    </html>
  )
}
