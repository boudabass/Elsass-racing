import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { FichePieceEcran } from "@/apps/garage/composants/fiche-piece"
import { lireFichePiece } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"

// Fiche d'une pièce du Garage (tâche 4.2, §3). Une pièce absente de la team renvoie 404.
export default async function PagePiece({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }
  const { id } = await params
  const fiche = await lireFichePiece(id)
  if (!fiche) notFound()
  return <FichePieceEcran fiche={fiche} niveau={acces.niveau} />
}
