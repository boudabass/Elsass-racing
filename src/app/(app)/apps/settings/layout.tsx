import type { ReactNode } from "react"

// Coquille de Réglages : titre et contenu. Le menu des rubriques est celui du socle, en haut de
// l'app, comme pour les autres apps ; il masque les rubriques de la team sous le niveau lecture.
export default function LayoutReglages({ children }: { children: ReactNode }) {
  return (
    <div className="flex flex-col gap-6">
      <h1 className="titre-rallye text-3xl">Réglages</h1>
      <div className="min-w-0">{children}</div>
    </div>
  )
}
