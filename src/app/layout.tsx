import type { CSSProperties } from "react"
import type { Metadata } from "next"
import { Barlow, Barlow_Condensed } from "next/font/google"
import { cookies } from "next/headers"

import { ThemeProvider } from "@/components/theme-provider"
import { COOKIE_TERRAIN } from "@/core/qg/cookies"
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
  const terrain = (await cookies()).get(COOKIE_TERRAIN)?.value === "1"

  return (
    <html
      lang="fr"
      className={`${texte.variable} ${titre.variable}${terrain ? " terrain" : ""}`}
      style={styleTeam}
      suppressHydrationWarning
    >
      <body>
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  )
}
