import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/checklist/ecran"
import { PageListe } from "@/apps/checklist/composants/page-liste"
import { pageListe, pagePoint } from "@/apps/checklist/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Une liste (tâche 5.6, §1.2) : avertissement avant phase si « ?avertir=1 », fiche d'un point si « ?point= ».
export default async function PageListeEcran({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ avertir?: string; point?: string }>
}) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { id } = await params
  const { avertir, point } = await searchParams
  const donnees = await pageListe(id, avertir === "1")
  if (!donnees) notFound()
  const fiche = point ? await pagePoint(point) : null
  return <PageListe donnees={donnees} pointOuvert={fiche && fiche.point.section.liste.id === id ? fiche : null} />
}
