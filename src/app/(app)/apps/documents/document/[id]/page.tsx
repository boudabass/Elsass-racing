import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { FicheEcran } from "@/apps/documents/composants/fiche-ecran"
import { accesEcran } from "@/apps/documents/ecran"
import { lireDocument, lireDossiersRangement, lirePersonnesPartage } from "@/apps/documents/lectures-serveur"
import { lireContactsPartage, lirePartages } from "@/apps/documents/lectures-partages"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'un document (tâche 5.3, brief §5 ; liens de partage et « Renouveler », tâche 5.4). Document inconnu ou non
// visible : même réponse, sans fuite.
export default async function PageDocument({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>
  searchParams: Promise<Record<string, string | string[] | undefined>>
}) {
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
  // Liens de ce document seulement, et contacts pour le destinataire facultatif (écriture seulement).
  const partages = fiche.liensVisibles ? await lirePartages(id) : null
  const contacts = fiche.gestes.partageLien.permis ? await lireContactsPartage() : []
  const brut = await searchParams
  const ouvrirRenouvellement = brut.renouveler === "1"
  return (
    <FicheEcran
      fiche={fiche}
      rangement={rangement}
      personnes={personnes}
      partages={partages}
      contacts={contacts}
      ouvrirRenouvellement={ouvrirRenouvellement}
    />
  )
}
