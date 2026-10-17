// Contraste WCAG et ajustement des couleurs de team. Pur.
//
// Une couleur de team peut être trop proche du fond du thème pour être lue (texte ou
// bouton). On l'éclaircit ou on l'assombrit, par pas, jusqu'à atteindre le minimum.

const MINIMUM_TEXTE = 4.5

function canaux(hex: string): [number, number, number] {
  const h = hex.replace("#", "")
  const complet = h.length === 3 ? h.split("").map((c) => c + c).join("") : h
  return [
    parseInt(complet.slice(0, 2), 16),
    parseInt(complet.slice(2, 4), 16),
    parseInt(complet.slice(4, 6), 16),
  ]
}

function versHex([r, g, b]: [number, number, number]): string {
  return "#" + [r, g, b].map((c) => Math.round(c).toString(16).padStart(2, "0")).join("").toUpperCase()
}

// Luminance relative (WCAG 2.x), entre 0 (noir) et 1 (blanc).
export function luminance(hex: string): number {
  const lineaire = canaux(hex).map((c) => {
    const s = c / 255
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4)
  })
  return 0.2126 * lineaire[0] + 0.7152 * lineaire[1] + 0.0722 * lineaire[2]
}

export function contraste(a: string, b: string): number {
  const [clair, sombre] = [luminance(a), luminance(b)].sort((x, y) => y - x)
  return (clair + 0.05) / (sombre + 0.05)
}

function melanger(couleur: string, cible: string, t: number): string {
  const a = canaux(couleur)
  const b = canaux(cible)
  return versHex([a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t])
}

// Renvoie la couleur inchangée si elle est déjà assez contrastée sur ce fond. Sinon, la
// rapproche du blanc (fond sombre) ou du noir (fond clair), par pas de 5 %, jusqu'au minimum.
export function ajusterPourFond(couleur: string, fond: string, minimum = MINIMUM_TEXTE): string {
  if (contraste(couleur, fond) >= minimum) return couleur.toUpperCase()

  const cible = luminance(fond) < 0.5 ? "#FFFFFF" : "#000000"
  for (let etape = 1; etape <= 20; etape++) {
    const candidate = melanger(couleur, cible, etape * 0.05)
    if (contraste(candidate, fond) >= minimum) return candidate
  }
  return cible
}

// Texte posé sur une couleur pleine (bouton, pastille) : blanc ou quasi-noir, celui qui contraste le mieux.
export const TEXTE_CLAIR = "#FFFFFF"
export const TEXTE_SOMBRE = "#111113"

export function texteSur(fond: string): string {
  return contraste(TEXTE_CLAIR, fond) >= contraste(TEXTE_SOMBRE, fond) ? TEXTE_CLAIR : TEXTE_SOMBRE
}
