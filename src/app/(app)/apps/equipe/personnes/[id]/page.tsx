import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/equipe/ecran"
import { FichePersonneEcran, ongletsPersonne, type OngletPersonne } from "@/apps/equipe/composants/fiche-personne"
import { pagePersonne } from "@/apps/equipe/lectures-ecran"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'une personne (tâche 5.2, brief §1). L'onglet demandé est dans l'URL ; un onglet non permis retombe sur Profil.
export default async function PageFichePersonne({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<{ onglet?: string }>
}) {
  const { id } = await params
  const { onglet } = await searchParams
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const donnees = await pagePersonne(id)
  if (!donnees) notFound()

  const permis = ongletsPersonne(donnees.peutVoirRessenti, donnees.fiche.roles)
  const demande = permis.find((cle) => cle === onglet) ?? "profil"
  return <FichePersonneEcran donnees={donnees} onglet={demande as OngletPersonne} />
}
