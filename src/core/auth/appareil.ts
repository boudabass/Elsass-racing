// Nom lisible d'un appareil, déduit du user-agent (ex. « Chrome sur Windows »).
// Approximatif par nature : c'est un libellé pour la liste des appareils, pas une mesure.

export function nomDeAppareil(userAgent: string | null | undefined): string {
  const ua = userAgent ?? ""

  const navigateur = ua.includes("Edg/")
    ? "Edge"
    : ua.includes("Firefox/")
      ? "Firefox"
      : ua.includes("Chrome/") || ua.includes("Chromium/")
        ? "Chrome"
        : ua.includes("Safari/")
          ? "Safari"
          : "Navigateur"

  const systeme = /iPhone|iPad/.test(ua)
    ? "iOS"
    : ua.includes("Android")
      ? "Android"
      : ua.includes("Windows")
        ? "Windows"
        : ua.includes("Mac OS X")
          ? "macOS"
          : ua.includes("Linux")
            ? "Linux"
            : "système inconnu"

  return `${navigateur} sur ${systeme}`
}
