import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { FicheEcran } from "@/apps/documents/composants/fiche-ecran"
import { accesEcran } from "@/apps/documents/ecran"
import { lireDocument, lireDossiersRangement, lirePersonnesPartage } from "@/apps/documents/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'un document (tâche 5.3, brief §5). Document inconnu ou non visible : même réponse, sans fuite.
export default async function PageDocument({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { id } = await params
  const fiche = await lireDocument(id)
  if (!fiche) notFound()
  // Listes d'écriture : lues seulement si le geste correspondant est permis (les lectures refusent sinon).
  const rangement = fiche.gestes.deplacer.permis ? await lireDossiersRangement() : []
  const personnes = fiche.gestes.partager.permis ? await lirePersonnesPartage() : []
  return <FicheEcran fiche={fiche} rangement={rangement} personnes={personnes} />
}
