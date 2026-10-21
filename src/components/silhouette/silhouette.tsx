// Silhouette du véhicule (brief 4.2, point 0) : le dessin du gabarit en SVG, sans rien d'autre. Les rôles de couleur sont
// des variables du thème, donc la silhouette suit le thème clair ou sombre. Le filet rouge du dessin d'origine n'est plus
// dessiné (retour de John) : les gabarits le gardent, le filtre se fait au rendu. Chaque app pose ses calques (emplacements,
// repères) par-dessus, en enfants du SVG.

import type { CSSProperties, ReactNode, Ref } from "react"

import type { ElementDessin, RoleDessin } from "./types"

// Épaisseur à partir de laquelle un trait « detail » est le filet rouge du dessin d'origine.
const EPAISSEUR_FILET = 4

const STYLE_ROLE: Record<RoleDessin, CSSProperties> = {
  caisse: { fill: "var(--surface-2)", stroke: "var(--bordure)", strokeWidth: 1 },
  vitre: { fill: "color-mix(in srgb, var(--surface) 50%, var(--bordure))", stroke: "var(--bordure)", strokeWidth: 0.8 },
  roue: { fill: "var(--fond)", stroke: "var(--texte-discret)", strokeWidth: 1 },
  jante: { fill: "var(--texte-discret)", stroke: "none" },
  detail: { fill: "none", stroke: "var(--bordure)", strokeWidth: 1 },
  sol: { fill: "none", stroke: "var(--bordure)", strokeWidth: 1.5 },
}

export interface SilhouetteProps {
  viewBox: string
  elements: ElementDessin[]
  // Vue en miroir (le côté gauche) : le dessin droit, retourné autour de l'axe vertical du viewBox.
  retourne?: boolean
  nomAccessible: string
  ref?: Ref<SVGSVGElement>
  style?: CSSProperties
  // Calques par-dessus le dessin : emplacements, repères, définitions SVG.
  children?: ReactNode
}

// Trait « detail » épais : le filet rouge du dessin d'origine. Il reste dans les gabarits, mais n'est plus dessiné.
export function estFilet(element: ElementDessin): boolean {
  return element.role === "detail" && Number(element.attributs["stroke-width"] ?? 0) >= EPAISSEUR_FILET
}

// Les éléments à dessiner : tous, sauf le filet.
export function elementsDessines(elements: ElementDessin[]): ElementDessin[] {
  return elements.filter((element) => !estFilet(element))
}

export function Silhouette({ viewBox, elements, retourne = false, nomAccessible, ref, style, children }: SilhouetteProps) {
  const [x, , largeur] = viewBox.trim().split(/\s+/).map(Number)
  const dessines = elementsDessines(elements)
  return (
    <svg ref={ref} viewBox={viewBox} role="group" aria-label={nomAccessible} className="block h-auto w-full" style={style}>
      {dessines.length > 0 && (
        <g transform={retourne ? `translate(${x + largeur} 0) scale(-1 1)` : undefined}>
          {dessines.map((element, index) => (
            <TraitDessin key={index} element={element} />
          ))}
        </g>
      )}
      {children}
    </svg>
  )
}

function TraitDessin({ element }: { element: ElementDessin }) {
  const { "stroke-width": epaisseurAttribut, ...geometrie } = element.attributs
  const style: CSSProperties = {
    ...STYLE_ROLE[element.role],
    ...(epaisseurAttribut !== undefined ? { strokeWidth: Number(epaisseurAttribut) } : {}),
  }
  if (element.type === "circle") return <circle {...geometrie} style={style} />
  if (element.type === "line") return <line {...geometrie} style={style} />
  return <path {...geometrie} style={style} />
}
