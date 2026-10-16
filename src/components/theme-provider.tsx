"use client"

import { ThemeProvider as ThemeProviderBase } from "next-themes"

// Thème sombre par défaut, clair possible. L'attribut class pose « dark » sur <html>.
export function ThemeProvider({ children }: { children: React.ReactNode }) {
  return (
    <ThemeProviderBase attribute="class" defaultTheme="dark" enableSystem={false} disableTransitionOnChange>
      {children}
    </ThemeProviderBase>
  )
}
