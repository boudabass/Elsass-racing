import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { FicheCasse } from "@/apps/garage/composants/casses"
import { lireFicheCasse } from "@/apps/garage/lectures-casses-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'une casse (tâche 4.4, §3) : à compléter par l'équipage et le responsable, en lecture pour l'assistance.
export default async function PageCasse({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const { id } = await params
  const fiche = await lireFicheCasse(id)
  if (!fiche) notFound()

  return <FicheCasse fiche={fiche} peutEcrire={aAuMoins(acces.niveau, "ecriture")} />
}
