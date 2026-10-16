"use client"

import { ThemeProvider as ThemeProviderBase } from "next-themes"

// Thème du membre (préférence stockée en base, lue par le layout racine). L'attribut class
// pose « dark » sur <html>. Sombre ou clair fixés : le client suit la préférence, sans
// localStorage. « Système » suit le réglage du système d'exploitation.
export function ThemeProvider({ theme, children }: { theme: "sombre" | "clair" | "systeme"; children: React.ReactNode }) {
  const force = theme === "sombre" ? "dark" : theme === "clair" ? "light" : undefined
  return (
    <ThemeProviderBase
      attribute="class"
      defaultTheme={theme === "systeme" ? "system" : "dark"}
      forcedTheme={force}
      enableSystem={theme === "systeme"}
      disableTransitionOnChange
    >
      {children}
    </ThemeProviderBase>
  )
}
