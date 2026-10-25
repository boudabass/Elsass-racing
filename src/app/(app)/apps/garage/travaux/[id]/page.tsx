import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { ajouterPhotoOrdreAction, retirerNoteOrdreAction, retirerPhotoOrdreAction } from "@/apps/garage/notes-actions"
import { controleOrdre } from "@/apps/garage/notes-serveur"
import { accesEcran } from "@/apps/garage/ecran"
import { FicheOrdreEcran } from "@/apps/garage/composants/fiche-ordre"
import { lireChoixTravaux, lireOrdre, lireStock } from "@/apps/garage/lectures-serveur"
import { NotesEtPhotos } from "@/components/notes-photos/notes-et-photos"
import { EcranVide } from "@/components/qg/ecran-vide"
import { exigerContexte } from "@/core/droits/garde-serveur"
import { aAuMoins } from "@/core/droits/niveaux"
import { nomsDesMembres, notesEtPhotos } from "@/core/notes/notes-serveur"
import { LIEN } from "@/lib/classes-formulaire"

// Fiche d'un ordre de travail (tâche 4.3, §3). Un ordre qui n'est pas accessible à ce compte est introuvable.
// Notes et photos (brief 5.0) : les notes se lisent sur la base locale, les photos viennent d'ici.
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

  const { contexte } = await exigerContexte()
  const controle = controleOrdre(id)
  const [{ photos }, noms, peutAjouter, peutGerer] = await Promise.all([
    notesEtPhotos(contexte, controle),
    nomsDesMembres(contexte),
    controle.contribuer(contexte).then(
      () => true,
      () => false,
    ),
    controle.gerer(contexte),
  ])

  return (
    <div className="flex flex-col gap-6">
      <Link href={`/apps/garage/travaux?vehicule=${fiche.vehicleId}`} className={`${LIEN} self-start`}>
        Retour aux travaux
      </Link>
      <FicheOrdreEcran fiche={fiche} choix={choix} stock={stock} peutAvancer={aAuMoins(acces.niveau, "contribution")} />
      <NotesEtPhotos
        fiche={{ app: "garage", ficheType: "ordre", ficheId: id }}
        userId={contexte.userId}
        noms={noms}
        photos={photos.map((photo) => ({ id: photo.id, fileId: photo.fileId, nom: photo.nom, auteur: photo.auteur, creeLe: photo.creeLe.toISOString(), retirable: photo.retirable }))}
        peutAjouter={peutAjouter}
        raisonRefus="Seul l'équipage affecté à cet ordre peut y ajouter une note ou une photo."
        peutGerer={peutGerer}
        actions={{ ajouterPhoto: ajouterPhotoOrdreAction, retirerPhoto: retirerPhotoOrdreAction, retirerNote: retirerNoteOrdreAction }}
      />
    </div>
  )
}
