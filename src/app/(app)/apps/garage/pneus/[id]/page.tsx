import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { FicheTrain } from "@/apps/garage/composants/pneus"
import { lireTrain } from "@/apps/garage/lectures-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'un train de pneus (tâche 4.4, §2) : monter, usure et statut, historique d'usure.
export default async function PageTrain({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const { id } = await params
  const fiche = await lireTrain(id)
  if (!fiche) notFound()

  return (
    <FicheTrain
      train={fiche.train}
      organePneusId={fiche.organePneusId}
      usures={fiche.usures}
      peutEcrire={aAuMoins(acces.niveau, "ecriture")}
    />
  )
}
