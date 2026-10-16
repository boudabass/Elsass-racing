import { notFound } from "next/navigation"

import { RubriqueEquipe } from "@/apps/settings/composants/rubriques"
import { estRubriqueEquipe, RUBRIQUES_PERSONNELLES } from "@/apps/settings/rubriques"

// Rubriques de la team. Les rubriques personnelles (1.10b) ne sont pas encore ouvertes.
export default async function PageRubrique({
  params,
  searchParams,
}: {
  params: Promise<{ rubrique: string }>
  searchParams: Promise<{ ok?: string; erreur?: string }>
}) {
  const { rubrique } = await params
  const { ok, erreur } = await searchParams

  if (estRubriqueEquipe(rubrique)) {
    return <RubriqueEquipe chemin={rubrique} messageOk={ok === "1"} erreur={erreur} />
  }
  if (RUBRIQUES_PERSONNELLES.some((r) => r.chemin === rubrique)) {
    return <p className="text-texte-discret">Cette rubrique personnelle arrive en 1.10b.</p>
  }
  notFound()
}
