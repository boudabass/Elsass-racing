import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { FicheOrganeEcran } from "@/apps/garage/composants/fiche-organe"
import { lireFicheOrgane } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'un organe du Garage (tâche 4.2, §2). Un organe absent de la team renvoie 404.
export default async function PageOrgane({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { id } = await params
  const fiche = await lireFicheOrgane(id)
  if (!fiche) notFound()
  return <FicheOrganeEcran fiche={fiche} niveau={acces.niveau} />
}
