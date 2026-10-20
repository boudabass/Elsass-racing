import Link from "next/link"
import { notFound } from "next/navigation"
import { Lock } from "lucide-react"

import { accesEcran } from "@/apps/voiture/ecran"
import { FicheReglageLecture } from "@/apps/voiture/composants/fiche-reglage"
import { ModifierFicheReglage, type OptionEpreuveReglage, type ValeursFormulaireReglage } from "@/apps/voiture/composants/formulaire-reglage"
import { lireChampsMasques, lireEpreuvesDuVehicule, lireReglage } from "@/apps/voiture/lectures-serveur"
import { valeurDeReglageEnTexte } from "@/apps/voiture/libelles"
import { EcranVide } from "@/components/qg/ecran-vide"
import { jourDeParis } from "@/core/dates"
import { aAuMoins } from "@/core/droits/niveaux"

// Fiche d'une épreuve de réglage, en lecture. « Modifier la fiche » ouvre un tiroir, si le membre peut modifier (brief 3.13b).
export default async function PageFicheReglage({ params }: { params: Promise<{ id: string; reglageId: string }> }) {
  const acces = await accesEcran("lecture")
  if (!acces.ok) {
    return <EcranVide icone={Lock} titre={acces.titre} lignes={acces.lignes} action={{ libelle: "Retour aux véhicules", href: "/apps/voiture" }} />
  }
  const { id, reglageId } = await params
  const detail = await lireReglage(reglageId)
  if (!detail || detail.fiche.vehicleId !== id) notFound()

  const niveau = acces.niveau
  const peutEcrire = aAuMoins(niveau, "ecriture")
  // La contribution ne modifie que ses propres fiches ; l'écriture modifie toutes les fiches.
  const peutModifier = peutEcrire || (aAuMoins(niveau, "contribution") && detail.fiche.createdBy === acces.ctx.userId)
  const masques = await lireChampsMasques()

  return (
    <section className="flex max-w-3xl flex-col gap-6">
      <Link href={`/apps/voiture/vehicules/${id}?onglet=reglages`} className="cible-tactile inline-flex items-center text-sm text-texte-discret">
        ← Réglages
      </Link>
      <h1 className="titre-rallye text-3xl">Fiche de réglage</h1>

      <FicheReglageLecture
        vehicleId={id}
        reglageId={reglageId}
        detail={{
          date: detail.fiche.date,
          epreuve: detail.epreuve,
          conditions: detail.fiche.conditions,
          revetement: detail.fiche.revetement,
          note: detail.fiche.note,
          auteur: detail.auteur,
          remarques: detail.fiche.remarques,
          valeurs: Object.fromEntries(detail.champs.filter((c) => c.valeur !== null).map((c) => [c.cle, c.valeur as string | number])),
        }}
        masques={masques}
        actionModifier={peutModifier ? <EditionReglage vehicleId={id} reglageId={reglageId} detail={detail} masques={masques} /> : null}
        peutEcrire={peutEcrire}
      />
    </section>
  )
}

// Modification : les valeurs de la fiche, et les épreuves où le véhicule est engagé. Le tiroir est dans la fiche.
async function EditionReglage({
  vehicleId,
  reglageId,
  detail,
  masques,
}: {
  vehicleId: string
  reglageId: string
  detail: NonNullable<Awaited<ReturnType<typeof lireReglage>>>
  masques: string[]
}) {
  const epreuves = await lireEpreuvesDuVehicule(vehicleId, new Date(`${jourDeParis(new Date())}T00:00:00Z`))
  const options: OptionEpreuveReglage[] = epreuves.map((e) => ({ valeur: `${e.entryId}|${e.eventId}`, libelle: e.nom }))
  const initiales: ValeursFormulaireReglage = {
    date: detail.fiche.date.toISOString().slice(0, 10),
    epreuve: detail.fiche.entryId && detail.fiche.eventId ? `${detail.fiche.entryId}|${detail.fiche.eventId}` : "",
    conditions: detail.fiche.conditions ?? "",
    revetement: detail.fiche.revetement ?? "",
    remarques: detail.fiche.remarques,
    note: detail.fiche.note ? String(detail.fiche.note) : "",
    valeurs: Object.fromEntries(detail.champs.filter((c) => c.valeur !== null).map((c) => [c.cle, valeurDeReglageEnTexte(c.cle, c.valeur)])),
  }
  return <ModifierFicheReglage vehicleId={vehicleId} reglageId={reglageId} initiales={initiales} masques={masques} epreuves={options} modeleId={detail.fiche.setupTemplateId} />
}
