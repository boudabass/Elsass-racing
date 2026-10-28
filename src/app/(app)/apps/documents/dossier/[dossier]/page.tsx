import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { DossierEcran } from "@/apps/documents/composants/dossier-ecran"
import { accesEcran } from "@/apps/documents/ecran"
import { lireDossier, lireDossiersRangement } from "@/apps/documents/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Un dossier (tâche 5.3, brief §5) : liste triée par échéance, filtres type et propriétaire dans l'URL, archivés repliés.
export default async function PageDossier({
  params,
  searchParams,
}: {
  params: Promise<{ dossier: string }>
  searchParams: Promise<{ type?: string; proprietaire?: string }>
}) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { dossier } = await params
  const { type, proprietaire } = await searchParams
  const donnees = await lireDossier(dossier, { type, proprietaire })
  // Dossier inconnu ou non visible pour cette personne : même réponse, sans fuite.
  if (!donnees) notFound()
  const rangement = donnees.peutAjouter.permis ? await lireDossiersRangement() : []
  return <DossierEcran donnees={donnees} rangement={rangement} type={type ?? null} proprietaire={proprietaire ?? null} />
}
