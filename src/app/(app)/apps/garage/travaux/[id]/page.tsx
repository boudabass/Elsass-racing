import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/garage/ecran"
import { FicheOrdreEcran } from "@/apps/garage/composants/fiche-ordre"
import { lireChoixTravaux, lireOrdre, lireStock } from "@/apps/garage/lectures-serveur"
import { EcranVide } from "@/components/qg/ecran-vide"
import { aAuMoins } from "@/core/droits/niveaux"
import { LIEN } from "@/lib/classes-formulaire"

// Fiche d'un ordre de travail (tâche 4.3, §3). Un ordre qui n'est pas accessible à ce compte est introuvable.
export default async function PageOrdre({ params }: { params: Promise<{ id: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour au QG", href: "/qg" }} />
  }

  const { id } = await params
  const fiche = await lireOrdre(id)
  if (!fiche) notFound()

  const choix = fiche.peutEcrire ? await lireChoixTravaux(fiche.vehicleId) : null
  const dejaSurOrdre = new Set(fiche.pieces.map((piece) => piece.partId))
  const stock = fiche.peutEcrire
    ? ((await lireStock(fiche.vehicleId)) ?? [])
        .filter((piece) => !dejaSurOrdre.has(piece.id))
        .map((piece) => ({ id: piece.id, designation: piece.designation }))
    : null

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/apps/garage/travaux?vehicule=${fiche.vehicleId}`} className={`${LIEN} self-start`}>
        Retour aux travaux
      </Link>
      <FicheOrdreEcran fiche={fiche} choix={choix} stock={stock} peutAvancer={aAuMoins(acces.niveau, "contribution")} />
    </div>
  )
}
